/**
 * Orkiestracja zespolu: COO planuje, specjalisci pracuja rownolegle, COO sklada
 * jedna odpowiedz. Kazdy krok emituje zdarzenie, ktore steruje animacja mapy
 * hierarchii i wpisami procesu w czacie.
 *
 * Reuzywa sendMessage (a przez to buildSystemPrompt) z ai.ts, wiec dziedziczy
 * pelny tryb pracy (klucz uzytkownika / proxy / env / demo) bez duplikacji.
 */
import { sendMessage, buildSystemPrompt, callModel, getMode } from './ai'
import { getAgentPrompt } from './content'
import { agents, getAgent } from '../data/agents'

// buildSystemPrompt jest reuzywany posrednio przez sendMessage; reeksportujemy,
// zeby byl dostepny dla ewentualnych wywolan niskopoziomowych i testow.
export { buildSystemPrompt }

/** Slugi specjalistow, do ktorych COO moze delegowac (bez samego COO). */
const DOZWOLONE_SLUGI = agents
  .filter((a) => a.slug !== 'coo')
  .map((a) => a.slug)

/** Pojedynczy krok planu: ktory agent i jego konkretne zadanie. */
export interface KrokPlanu {
  agent: string
  zadanie: string
}

export type TrybPracy = 'sam' | 'deleguj'

/** Zdarzenia emitowane w trakcie orkiestracji (steruja UI). */
export type ZdarzenieOrk =
  | { typ: 'plan'; tryb: TrybPracy; plan: KrokPlanu[] }
  | { typ: 'start'; agent: string }
  | { typ: 'koniec'; agent: string }
  | { typ: 'synteza' }
  | { typ: 'final'; text: string }
  | { typ: 'blad'; agent?: string; wiadomosc: string }

export type OnEvent = (zdarzenie: ZdarzenieOrk) => void

/** Raport jednego specjalisty po wykonaniu zadania. */
interface RaportSpecjalisty {
  agent: string
  zadanie: string
  raport: string
  ok: boolean
}

/**
 * Wyluskuje pierwszy pelny blok {...} z tekstu, respektujac stringi i escapy.
 * Zwraca surowy JSON-string albo null, gdy nie ma zbalansowanego bloku.
 */
function wyluskajJson(tekst: string): string | null {
  const start = tekst.indexOf('{')
  if (start < 0) return null

  let glebokosc = 0
  let wString = false
  let escape = false

  for (let i = start; i < tekst.length; i++) {
    const ch = tekst[i]

    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      if (wString) escape = true
      continue
    }
    if (ch === '"') {
      wString = !wString
      continue
    }
    if (wString) continue

    if (ch === '{') glebokosc++
    else if (ch === '}') {
      glebokosc--
      if (glebokosc === 0) return tekst.slice(start, i + 1)
    }
  }
  return null
}

interface WynikPlanu {
  tryb: TrybPracy
  plan: KrokPlanu[]
  odpowiedz: string
}

/** Parsuje odpowiedz COO na plan. Odporne: gdy sie nie uda, zwraca null. */
function parsujPlan(surowe: string): WynikPlanu | null {
  const json = wyluskajJson(surowe)
  if (!json) return null

  let dane: unknown
  try {
    dane = JSON.parse(json)
  } catch {
    return null
  }
  if (!dane || typeof dane !== 'object') return null

  const obj = dane as Record<string, unknown>
  const trybRaw = obj.tryb === 'deleguj' ? 'deleguj' : 'sam'
  const odpowiedz = typeof obj.odpowiedz === 'string' ? obj.odpowiedz : ''

  const planRaw = Array.isArray(obj.plan) ? obj.plan : []
  const plan: KrokPlanu[] = []
  const uzyte = new Set<string>()

  for (const p of planRaw) {
    if (!p || typeof p !== 'object') continue
    const rec = p as Record<string, unknown>
    const agent = typeof rec.agent === 'string' ? rec.agent.trim() : ''
    const zadanie = typeof rec.zadanie === 'string' ? rec.zadanie.trim() : ''
    // tylko realne slugi, bez duplikatow, maks 4 agentow
    if (!DOZWOLONE_SLUGI.includes(agent)) continue
    if (uzyte.has(agent)) continue
    if (!zadanie) continue
    uzyte.add(agent)
    plan.push({ agent, zadanie })
    if (plan.length >= 4) break
  }

  // Tryb deleguj bez realnego planu traktujemy jak "sam".
  if (trybRaw === 'deleguj' && plan.length === 0) {
    return { tryb: 'sam', plan: [], odpowiedz }
  }
  return { tryb: trybRaw, plan, odpowiedz }
}

/**
 * DEDYKOWANY system prompt etapu PLAN. Krotki i szybki: persona COO plus lista
 * agentow plus twarda instrukcja "tylko JSON". Swiadomie BEZ pelnego mozgu firmy
 * i BEZ zasad rozmowy (CHAT_RULES) z ai.ts, bo one kaza pisac proza i psuja parser.
 */
function systemPlanu(): string {
  const persona = getAgentPrompt('coo') ?? ''
  const listaAgentow = agents
    .filter((a) => a.slug !== 'coo')
    .map((a) => `- ${a.slug}: ${a.role}`)
    .join('\n')

  return [
    persona,
    '',
    '=== ZADANIE: PLANOWANIE DELEGACJI ===',
    'Jestes planista delegacji. Na podstawie pytania wlasciciela zdecyduj, czy odpowiadasz sam, czy delegujesz do specjalistow.',
    '',
    'Dostepni specjalisci (slug: rola):',
    listaAgentow,
    '',
    'Odpowiedz WYLACZNIE czystym obiektem JSON, bez tekstu przed i po, bez markdown, bez blokow kodu. Dokladnie taki ksztalt:',
    '{"tryb":"sam"|"deleguj","plan":[{"agent":"<slug>","zadanie":"<konkretne zadanie po polsku>"}],"odpowiedz":"<tryb sam: pelna odpowiedz prostym polskim; tryb deleguj: pusty string>"}',
    '',
    `Dozwolone slugi agentow: ${DOZWOLONE_SLUGI.join(', ')}.`,
    'Deleguj maksymalnie do 4 agentow i tylko gdy realnie potrzeba ich roznych kompetencji. Proste pytania rob sam (tryb "sam").',
    'Zadania musza byc konkretne i wykonalne, po polsku.',
  ].join('\n')
}

/**
 * Buduje plan przez callModel z dedykowanym system promptem. Odporny: gdy parser
 * padnie (model odpowiedzial proza), ponawia RAZ z ostrzejsza instrukcja.
 * Zwraca surowa odpowiedz (do ewentualnego fallbacku) oraz sparsowany wynik (albo null).
 */
async function zbudujPlan(
  pytanie: string,
): Promise<{ surowy: string; wynik: WynikPlanu | null }> {
  const system = systemPlanu()

  const surowy = await callModel(system, [{ role: 'user', content: pytanie }])
  const wynik = parsujPlan(surowy)
  if (wynik) return { surowy, wynik }

  // Ponow RAZ: pokazujemy modelowi jego wlasna (nieczytelna) odpowiedz i zaostrzamy.
  const surowy2 = await callModel(system, [
    { role: 'user', content: pytanie },
    { role: 'assistant', content: surowy },
    {
      role: 'user',
      content:
        'Poprzednia odpowiedz nie byla czystym JSON. Zwroc tylko JSON w podanym ksztalcie, bez zadnego innego tekstu.',
    },
  ])
  const wynik2 = parsujPlan(surowy2)
  return { surowy: surowy2, wynik: wynik2 }
}

/** Instrukcja dla COO na etapie SYNTEZA. */
function promptSyntezy(pytanie: string, raporty: RaportSpecjalisty[]): string {
  const bloki = raporty
    .map((r) => {
      const agent = getAgent(r.agent)
      const nazwa = agent?.name ?? r.agent
      return `## ${nazwa} (zadanie: ${r.zadanie})\n${r.raport}`
    })
    .join('\n\n')

  return [
    'ZADANIE SYNTEZY. Jestes COO. Zespol wykonal zadania, masz ich raporty.',
    `Pytanie wlasciciela: ${pytanie}`,
    '',
    'Raporty specjalistow:',
    bloki,
    '',
    'Zloz to w JEDNA spojna odpowiedz prostym polskim: najpierw wniosek i co KONKRETNIE zrobic (numerowane kroki, jesli pasuja), potem krotkie uzasadnienie.',
    'Nie powtarzaj raportow po kolei, nie pisz kto co powiedzial. Bez zargonu, bez angielskich etykiet, bez myslnika em-dash, bez zmyslonych liczb.',
  ].join('\n')
}

// --- TRYB DEMO: symulacja przeplywu (bez klucza API) ------------------------

/** Krotka pauza, zeby animacja delegacji byla widoczna. */
function czekaj(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Losowy czas kroku 800..1500 ms. */
function losowaPauza(): number {
  return 800 + Math.floor(Math.random() * 701)
}

/** Slowa kluczowe -> specjalista. Prosty dobor pod tresc pytania w demo. */
const MAPA_SLOW: { slug: string; slowa: string[] }[] = [
  { slug: 'analityk', slowa: ['rynek', 'rynk', 'konkurenc', 'research', 'analiz', 'dane', 'trend', 'segment', 'icp', 'badani'] },
  { slug: 'handlowiec', slowa: ['sprzeda', 'oferta', 'ofert', 'cena', 'cen', 'pricing', 'klient', 'domkni', 'obiekcj', 'lead', 'deal', 'diagnoz'] },
  { slug: 'copywriter', slowa: ['tresc', 'tekst', 'content', 'kampani', 'linkedin', 'social', 'post', 'marketing', 'seo', 'email', 'mail', 'reklam'] },
  { slug: 'opiekun-klienta', slowa: ['obsluga', 'retencj', 'onboarding', 'relacj', 'utrzyman', 'opieka'] },
  { slug: 'wiedza-produkt', slowa: ['material', 'ebook', 'skrypt', 'produkt', 'wiedza', 'szkoleni'] },
  { slug: 'operacje', slowa: ['zadani', 'proces', 'sop', 'brief', 'organizac', 'ogarn', 'porzadek', 'rytm'] },
  { slug: 'pamiec-zespolu', slowa: ['pamiec', 'mozg', 'kontekst', 'wersj', 'historia'] },
  { slug: 'drugi-glos', slowa: ['decyzj', 'strategi', 'ryzyko', 'marka', 'red team', 'kontr', 'pomysl', 'watpliw'] },
]

/** Gotowe, generyczne zadania demo dla poszczegolnych specjalistow. */
const ZADANIA_DEMO: Record<string, string> = {
  analityk: 'Zbadaj kontekst rynkowy i konkurencje pod to pytanie.',
  handlowiec: 'Ujmij to od strony sprzedazy i wartosci dla klienta.',
  copywriter: 'Zaproponuj tresci i komunikaty do tego celu.',
  'opiekun-klienta': 'Sprawdz watek relacji i utrzymania klienta.',
  'wiedza-produkt': 'Wskaz materialy i wiedze potrzebne do tego zadania.',
  operacje: 'Rozpisz to na konkretne kroki i zadania.',
  'pamiec-zespolu': 'Podaj kontekst z mozgu firmy do tego tematu.',
  'drugi-glos': 'Zakwestionuj plan i wskaz ryzyka.',
}

/** Dobiera 2-3 agentow po slowach kluczowych; domyslnie analityk plus handlowiec. */
function dobierzAgentow(pytanie: string): string[] {
  const t = pytanie.toLowerCase()
  const trafienia: string[] = []
  for (const { slug, slowa } of MAPA_SLOW) {
    if (slowa.some((w) => t.includes(w))) trafienia.push(slug)
  }
  if (trafienia.length === 0) return ['analityk', 'handlowiec']
  if (trafienia.length === 1) {
    const dodatkowy = trafienia[0] === 'analityk' ? 'handlowiec' : 'analityk'
    return [trafienia[0], dodatkowy]
  }
  return trafienia.slice(0, 3)
}

/**
 * SYMULACJA delegacji w trybie demo. Sztuczny plan, zdarzenia start/koniec
 * rozlozone w czasie, synteza i finalny tekst demo. Dzieki temu animacja mapy
 * jest widoczna ZAWSZE, nawet bez klucza API.
 */
async function symulujOrkiestracje(
  pytanie: string,
  onEvent: OnEvent,
): Promise<void> {
  const slugi = dobierzAgentow(pytanie)
  const plan: KrokPlanu[] = slugi.map((slug) => ({
    agent: slug,
    zadanie: ZADANIA_DEMO[slug] ?? 'Przeanalizuj to pytanie w swojej domenie.',
  }))

  onEvent({ typ: 'plan', tryb: 'deleguj', plan })

  // Specjalisci zapalaja sie po kolei (widoczny start delegacji).
  for (const krok of plan) {
    onEvent({ typ: 'start', agent: krok.agent })
    await czekaj(300)
  }
  // Po chwili pracy kolejno koncza.
  for (const krok of plan) {
    await czekaj(losowaPauza())
    onEvent({ typ: 'koniec', agent: krok.agent })
  }

  onEvent({ typ: 'synteza' })
  await czekaj(losowaPauza())
  onEvent({
    typ: 'final',
    text: 'To symulacja przeplywu. Dodaj klucz w Ustawieniach, aby zespol pracowal naprawde.',
  })
}

/**
 * Uruchamia pelna orkiestracje dla pytania. Emituje zdarzenia przez onEvent.
 * Nigdy nie rzuca w gore: bledy pojedynczych agentow sa raportowane jako
 * zdarzenie 'blad', a caly przebieg konczy sie zdarzeniem 'final'.
 */
export async function runOrchestration(
  pytanie: string,
  onEvent: OnEvent,
): Promise<void> {
  const tekst = pytanie.trim()
  if (!tekst) {
    onEvent({ typ: 'final', text: 'Napisz pytanie, a rozloze je na zespol.' })
    return
  }

  // --- TRYB DEMO: symulacja przeplywu, animacja widoczna bez klucza API ---
  if (getMode() === 'demo') {
    await symulujOrkiestracje(tekst, onEvent)
    return
  }

  // --- Krok PLAN (dedykowany system prompt, callModel, retry raz) ---
  let surowyPlan: string
  let wynik: WynikPlanu | null
  try {
    const r = await zbudujPlan(tekst)
    surowyPlan = r.surowy
    wynik = r.wynik
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onEvent({ typ: 'blad', wiadomosc: `Nie udalo sie zbudowac planu: ${msg}` })
    onEvent({
      typ: 'final',
      text: 'Nie udalo sie teraz zaplanowac pracy zespolu. Sprawdz konfiguracje (klucz API lub proxy) i sprobuj ponownie.',
    })
    return
  }

  // Parsowanie padlo dwa razy: fallback jak dotad plus wpis procesu w logu.
  if (!wynik) {
    onEvent({ typ: 'plan', tryb: 'sam', plan: [] })
    onEvent({
      typ: 'blad',
      wiadomosc: 'COO odpowiedzial bez delegacji (plan nieczytelny)',
    })
    onEvent({ typ: 'final', text: surowyPlan.trim() })
    return
  }

  // --- Tryb SAM: COO odpowiada bez delegacji ---
  if (wynik.tryb === 'sam') {
    onEvent({ typ: 'plan', tryb: 'sam', plan: [] })
    const text = wynik.odpowiedz.trim() || surowyPlan.trim()
    onEvent({ typ: 'final', text })
    return
  }

  // --- Tryb DELEGUJ ---
  onEvent({ typ: 'plan', tryb: 'deleguj', plan: wynik.plan })

  // --- Krok PRACA: specjalisci rownolegle ---
  const raporty = await Promise.all(
    wynik.plan.map(async (krok): Promise<RaportSpecjalisty> => {
      onEvent({ typ: 'start', agent: krok.agent })
      try {
        const raport = await sendMessage(krok.agent, [
          { role: 'user', content: krok.zadanie },
        ])
        onEvent({ typ: 'koniec', agent: krok.agent })
        return { agent: krok.agent, zadanie: krok.zadanie, raport, ok: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        onEvent({ typ: 'blad', agent: krok.agent, wiadomosc: msg })
        onEvent({ typ: 'koniec', agent: krok.agent })
        return {
          agent: krok.agent,
          zadanie: krok.zadanie,
          raport: `(Ten specjalista nie odpowiedzial: ${msg})`,
          ok: false,
        }
      }
    }),
  )

  // --- Krok SYNTEZA: COO sklada odpowiedz ---
  onEvent({ typ: 'synteza' })
  try {
    const finalna = await sendMessage('coo', [
      { role: 'user', content: promptSyntezy(tekst, raporty) },
    ])
    onEvent({ typ: 'final', text: finalna.trim() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onEvent({ typ: 'blad', wiadomosc: `Synteza sie nie powiodla: ${msg}` })
    // Awaryjnie sklej raporty, zeby uzytkownik nie zostal z niczym.
    const fallback = raporty
      .filter((r) => r.ok)
      .map((r) => {
        const nazwa = getAgent(r.agent)?.name ?? r.agent
        return `Od ${nazwa}:\n${r.raport}`
      })
      .join('\n\n')
    onEvent({
      typ: 'final',
      text:
        fallback ||
        'Nie udalo sie zlozyc odpowiedzi. Sprawdz konfiguracje i sprobuj ponownie.',
    })
  }
}

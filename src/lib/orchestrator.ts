/**
 * Orkiestracja zespolu: COO planuje, specjalisci pracuja rownolegle, COO sklada
 * jedna odpowiedz. Kazdy krok emituje zdarzenie, ktore steruje animacja mapy
 * hierarchii i wpisami procesu w czacie.
 *
 * Reuzywa sendMessage (a przez to buildSystemPrompt) z ai.ts, wiec dziedziczy
 * pelny tryb pracy (klucz uzytkownika / proxy / env / demo) bez duplikacji.
 */
import { sendMessage, buildSystemPrompt } from './ai'
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

/** Instrukcja dla COO na etapie PLAN. Wymusza czysty JSON. */
function promptPlanu(pytanie: string): string {
  return [
    'ZADANIE ORKIESTRACJI. Jestes COO i planujesz prace zespolu.',
    'Przeanalizuj pytanie wlasciciela i zdecyduj, czy odpowiadasz sam, czy delegujesz do specjalistow.',
    '',
    'Odpowiedz WYLACZNIE czystym JSON, bez komentarza, bez blokow kodu, bez tekstu przed ani po. Dokladnie taki ksztalt:',
    '{"tryb":"sam"|"deleguj","plan":[{"agent":"<slug>","zadanie":"<konkretne zadanie po polsku>"}],"odpowiedz":"<jesli tryb sam: pelna odpowiedz prostym polskim; przy deleguj: pusty string>"}',
    '',
    `Dozwolone slugi agentow: ${DOZWOLONE_SLUGI.join(', ')}.`,
    'Deleguj maksymalnie do 4 agentow i tylko gdy realnie potrzeba ich roznych kompetencji. Proste pytania rob sam (tryb "sam").',
    'Zadania musza byc konkretne i wykonalne, po polsku.',
    '',
    `PYTANIE WLASCICIELA: ${pytanie}`,
  ].join('\n')
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

  // --- Krok PLAN ---
  let surowyPlan: string
  try {
    surowyPlan = await sendMessage('coo', [{ role: 'user', content: promptPlanu(tekst) }])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onEvent({ typ: 'blad', wiadomosc: `Nie udalo sie zbudowac planu: ${msg}` })
    onEvent({
      typ: 'final',
      text: 'Nie udalo sie teraz zaplanowac pracy zespolu. Sprawdz konfiguracje (klucz API lub proxy) i sprobuj ponownie.',
    })
    return
  }

  const wynik = parsujPlan(surowyPlan)

  // Parsowanie padlo lub COO od razu dal odpowiedz tekstowa: traktuj jako odpowiedz bezposrednia.
  if (!wynik) {
    onEvent({ typ: 'plan', tryb: 'sam', plan: [] })
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

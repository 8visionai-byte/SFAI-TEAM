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

/**
 * Twardy limit delegacji = liczba WSZYSTKICH dostepnych specjalistow (bez COO).
 * Dzieki temu COO moze przy szerokiej naradzie zaangazowac CALY zespol, a
 * walidacja planu nie utnie go ponizej realnej potrzeby.
 */
const LIMIT_DELEGACJI = DOZWOLONE_SLUGI.length

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
    // tylko realne slugi, bez duplikatow, maks caly zespol (LIMIT_DELEGACJI)
    if (!DOZWOLONE_SLUGI.includes(agent)) continue
    if (uzyte.has(agent)) continue
    if (!zadanie) continue
    uzyte.add(agent)
    plan.push({ agent, zadanie })
    if (plan.length >= LIMIT_DELEGACJI) break
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
    'Jestes szefowa zespolu. Na podstawie wypowiedzi wlasciciela zdecyduj, czy odpowiadasz sama, czy to sprawa dla kolezanek. DOMYSLNIE odpowiadasz sama.',
    'Gdy wlasciciel tylko opowiada, informuje albo mysli na glos ("mam takiego klienta, ktory...", "bylem na spotkaniu", "zastanawiam sie, czy") i o nic nie prosi: tryb "sam", a w polu odpowiedz zareaguj po ludzku i dopytaj o jeden konkret. Zadnej delegacji.',
    '',
    'Dostepni specjalisci (slug: rola):',
    listaAgentow,
    '',
    'Odpowiedz WYLACZNIE czystym obiektem JSON, bez tekstu przed i po, bez markdown, bez blokow kodu. Dokladnie taki ksztalt:',
    '{"tryb":"sam"|"deleguj","plan":[{"agent":"<slug>","zadanie":"<konkretne zadanie po polsku>"}],"odpowiedz":"<tryb sam: pelna odpowiedz prostym polskim; tryb deleguj: pusty string>"}',
    '',
    `Dozwolone slugi agentow: ${DOZWOLONE_SLUGI.join(', ')}.`,
    'ZASADA DOBORU: gdy juz delegujesz, zaangazuj kazdego agenta, ktorego kompetencja realnie dotyczy pytania. Proste, waskie pytania rob sama (tryb "sam"), bez delegacji na sile.',
    'GRAMATYKA DECYDUJE: "co myslisz", "sprawdz", "zrob" (liczba pojedyncza) = pytanie do Ciebie, tryb "sam". "co myslicie", "sprawdzcie", "zrobcie" (liczba mnoga) = prosba do zespolu, tryb "deleguj".',
    'NARADA CALEGO ZESPOLU tylko wtedy, gdy wlasciciel WPROST o nia prosi. PROSBY, ktore ja odpalaja: "zrobmy narade", "zbierz zespol", "zaangazuj caly zespol", "zrobcie burze mozgow", "co o tym myslicie", "potrzebuje opinii zespolu". Wtedy kazdy dostaje zadanie ze swojej perspektywy i czesto jest to 8-11 osob.',
    'TEMATY, ktore SAME Z SIEBIE narady NIE odpalaja: "strategia na kwartal", "gdzie jestesmy", "jak rozwinac firme", "mam takiego klienta". To sa tematy do rozmowy, nie polecenia. Rzeczownik ("klient", "oferta", "research") to temat, poleceniem jest czasownik w trybie rozkazujacym albo "potrzebuje", "chce, zebyscie". Przy nich odpowiadasz sama albo bierzesz 1-2 osoby, chyba ze wlasciciel doda prosbe o zespol.',
    `Deleguj maksymalnie do ${LIMIT_DELEGACJI} agentow (caly dostepny zespol). Nie dodawaj osob, ktorych kompetencja nie dotyka pytania.`,
    'Przyklady mapowania tematu na agentow:',
    '- "jak zwiekszyc sprzedaz": analityk (rynek, konkurencja), handlowiec (oferta, domykanie, lejek), wiedza-produkt (opis oferty i argumenty), copywriter-marki (teksty i zaczepki), analityk-social (kanaly i tresci), czesto drugi-glos (ryzyka strategii) i pamiec-zespolu (marza, cena).',
    '- "wejscie na nowy rynek / nowa nisza": analityk (sizing, ICP), operacje (kierunek i trend), drugi-glos (ryzyka, pre-mortem), handlowiec (jak sprzedac), wiedza-produkt (czego brakuje w materialach), pamiec-zespolu (czy nas stac).',
    '- "kampania w social / marketing": analityk-social (kanaly, kalendarz, co skalowac), copywriter-marki (napisanie tekstow), wiedza-produkt (obietnica i dowod), analityk (segment, ICP), czasem drugi-glos (spojnosc z marka) i prawnik-ai (obietnice, RODO w kampanii).',
    '- "poprawic obsluge / retencje klienta": opiekun-klienta (onboarding, retencja), wiedza-produkt (materialy), pamiec-zespolu (czy ryczalt jest rentowny), czasem analityk (dane o odejsciach).',
    '- "ile mamy na tym marzy / jak to wycenic / czy nas na to stac": pamiec-zespolu (Vera, finanse i wyceny), czesto analityk (ceny rynkowe).',
    '- "dokad idzie rynek / co rozwijac, co wygasic": operacje (Mia, rozwoj i trendy), analityk (fakty i dane), pamiec-zespolu (czy nas stac).',
    '- "skad wziac leady poza social / partnerstwa / polecenia": handlowiec (Jade, wlasciciel lejka i liczby 50 leadow), analityk (listy firm ICP), copywriter-marki (zaczepki i sekwencje), opiekun-klienta (polecenia).',
    '- "czy to wolno / RODO / AI Act / umowa / co musi byc w aplikacji": prawnik-ai (Ada, ryzyko i wymogi), czesto copywriter (Mila, lista kontrolna przed oddaniem) i pamiec-zespolu (zapisy o platnosciach).',
    '- "czy dowozimy / ile to zajmuje / dlaczego wdrozenia sie przeciagaja": copywriter (Mila, dostawa i jakosc wdrozen), pamiec-zespolu (godziny kontra marza), handlowiec (co zostalo sprzedane).',
    '- "zrobmy narade jak rozwinac firme w tym kwartale": narada calego zespolu, deleguj do WSZYSTKICH agentow, ktorych kompetencja cokolwiek wnosi (analityk, handlowiec, copywriter, copywriter-marki, analityk-social, wiedza-produkt, opiekun-klienta, operacje, pamiec-zespolu, drugi-glos, prawnik-ai), kazdy ze swojej perspektywy.',
    '- "popraw ten jeden naglowek": tryb "sam" albo jeden agent (copywriter-marki), bez angazowania zespolu.',
    '- waskie pytanie o jeden temat (np. "napisz jeden post na LinkedIn"): jeden agent (copywriter-marki, a gdy chodzi o kanal i kalendarz analityk-social) albo tryb "sam".',
    '- "mam takiego klienta, ktory chce zeby AI odbieralo mu telefony": tryb "sam". To opowiesc, nie zlecenie. W polu odpowiedz dopytaj o konkret (branza, skala, budzet), nie rozdawaj zadan.',
    'Zadania musza byc konkretne i wykonalne, po polsku, kazde dopasowane do kompetencji danego agenta.',
  ].join('\n')
}

/**
 * BRAMKA DWUCZLONOWA: czy wlasciciel JAWNIE prosi o prace calego zespolu.
 *
 * Poprzednia wersja (`SYGNALY_NARADY`) reagowala na pojedyncze slowa
 * "wszyscy", "wszystkich", "narad", "cala firma". W polszczyznie mowionej
 * padaja one bez zwiazku z narada, przez co 8 z 14 zwyklych zdan (57%) lapalo
 * regex: "mam takiego klienta, ktory chce WSZYSTKICH handlowcow przeszkolic",
 * "u niego CALA FIRMA siedzi na Excelu", "wczoraj mielismy NARADE u klienta".
 * Pomiary w .planning/v2/AUDYT-DELEGACJI.md, sekcja 2.
 *
 * Teraz trafienie wymaga DWOCH czlonow w tej samej wypowiedzi:
 * czasownika prosby ORAZ rzeczownika oznaczajacego zespol. Slowa "wszyscy"
 * i "wszystkich" wypadly calkowicie (same nigdy nie znacza "caly zespol").
 *
 * Czasownik musi byc w formie POLECENIA (tryb rozkazujacy, "zrobmy", albo
 * pytanie "zrobisz"), nie w czasie przeszlym. Bez tego "wczoraj ZROBILEM narade
 * z zespolem" i "URUCHOMILEM juz zespol" (relacja, nie prosba) lapaly bramke.
 * Dodatkowo bezNegacji zdejmuje zwroty, po ktorych czasownik nie jest prosba:
 * "NIE CHCE, zeby cala firma o tym wiedziala", "ten KLIENT POTRZEBUJE calego
 * zespolu ludzi". Pomiary i zestaw testowy: webapp/testy/test-intencje.mjs
 * (25 zdan wlasciciela + przypadki brzegowe), 0 falszywych alarmow.
 *
 * Uzywana w DWOCH miejscach (jedno zrodlo prawdy): tutaj w wymusNarade oraz
 * w realtime.ts przy dopelnianiu narady po wywolaniu uruchom_zespol.
 */
const CZASOWNIK_PROSBY =
  /(zr(o|ó)b(cie|my|isz|icie)?\b|zwo(l|ł)a(j|jcie|jmy|sz)\b|zbierz(cie|my|esz)?\b|odpal(cie|my|isz|icie)?\b|uruchom(cie|my|isz|icie)?\b|zaanga(z|ż)uj(cie|my|esz)?\b|w(l|ł)(a|ą)cz(cie|my|ysz)?\b|rozda(j|jcie|jmy|sz)\b|\bniech\b(?! (im|mu|ci|mi|jej|ich|to|tam)\b)|dawaj|potrzebuj(e|ę)|prosz(e|ę)|chc(e|ę),? ?(zeby|żeby))/i
const RZECZOWNIK_ZESPOLU =
  /(narad(a|e|ę|y|zie|zmy|zcie)|burz(a|e|ę|y) m(o|ó)zg|zesp(o|ó)(l|ł)|ca(l|ł)(a|ą|ej|ym) firm|ekip(a|e|ę)|dziewczyn)/i

/**
 * Zdejmuje z wypowiedzi fragmenty, w ktorych czasownik prosby NIE jest prosba:
 * negacje ("nie chce, zeby...", "nie zbieraj") i osobe trzecia
 * ("klient potrzebuje", "on potrzebuje"). Dzieki temu bramka nie musi uzywac
 * lookbehind, ktorego starsze Safari nie parsuje.
 */
function bezNegacji(tekst: string): string {
  return tekst
    .replace(
      /\bnie\s+(chc|potrzebuj|zr(o|ó)b|zbierz|odpal|uruchom|zaanga|w(l|ł)(a|ą)cz|rozdaj|zwo(l|ł)a)[a-ząćęłńóśźż]*/gi,
      ' ',
    )
    .replace(
      /\b(on|ona|oni|klient|klienci|klientka|szef|firma|zesp(o|ó)(l|ł))[a-ząćęłńóśźż]*\s+potrzebuj[a-ząćęłńóśźż]*/gi,
      ' ',
    )
}

/** Czy wypowiedz jest JAWNA prosba o prace calego zespolu (bramka dwuczlonowa). */
export function prosbaOZespol(tekst: string): boolean {
  if (!tekst) return false
  const t = bezNegacji(tekst)
  return CZASOWNIK_PROSBY.test(t) && RZECZOWNIK_ZESPOLU.test(t)
}

/**
 * DETERMINISTYCZNA gwarancja narady: gdy wlasciciel wprost prosi o caly zespol,
 * plan MUSI objac wszystkich specjalistow, niezaleznie od tego, ilu wybral model.
 * Brakujacym dokladamy zadanie z ich perspektywy. To usuwa losowosc
 * "modelowi sie nie chcialo".
 *
 * WAZNE: to jest DOPELNIENIE istniejacej narady, a nie tworzenie jej z niczego.
 * Gdy model swiadomie zwrocil tryb "sam" (uznal, ze wystarczy odpowiedziec),
 * NIE nadpisujemy tej decyzji. Wczesniej wymusNarade zamieniala "sam" na
 * "deleguj" z pelnym skladem zespolu, czyli regex przebijal ocene modelu.
 */
function wymusNarade(pytanie: string, wynik: WynikPlanu): WynikPlanu {
  if (wynik.tryb !== 'deleguj') return wynik
  if (!prosbaOZespol(pytanie)) return wynik
  const obecni = new Set(wynik.plan.map((k) => k.agent))
  const plan = [...wynik.plan]
  for (const slug of DOZWOLONE_SLUGI) {
    if (!obecni.has(slug)) {
      plan.push({
        agent: slug,
        zadanie: `Z perspektywy Twojej roli odnies sie do tematu: "${pytanie}". Podaj konkretne wnioski i 1-2 rekomendacje.`,
      })
    }
  }
  return { ...wynik, tryb: 'deleguj', plan }
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
  if (wynik) return { surowy, wynik: wymusNarade(pytanie, wynik) }

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
  return {
    surowy: surowy2,
    wynik: wynik2 ? wymusNarade(pytanie, wynik2) : null,
  }
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
  { slug: 'copywriter', slowa: ['outbound', 'zaczep', 'polecen', 'partner', 'partnerstw', 'lista firm', 'klub', 'wydarzen', 'networking', 'kontakt do'] },
  { slug: 'opiekun-klienta', slowa: ['obsluga', 'retencj', 'onboarding', 'relacj', 'utrzyman', 'opieka'] },
  { slug: 'wiedza-produkt', slowa: ['material', 'ebook', 'skrypt', 'produkt', 'usluga', 'uslug', 'oferta nasz', 'wiedza', 'szkoleni', 'obiekcj'] },
  { slug: 'operacje', slowa: ['trend', 'kierunek', 'rozwoj firmy', 'nisza', 'nisz', 'przyszlosc', 'ksef', 'ai act', 'regulac'] },
  { slug: 'pamiec-zespolu', slowa: ['marz', 'wycen', 'koszt', 'budzet', 'rentown', 'oplacal', 'rabat', 'gotowk', 'finans'] },
  { slug: 'drugi-glos', slowa: ['decyzj', 'strategi', 'ryzyko', 'marka', 'red team', 'kontr', 'pomysl', 'watpliw'] },
  { slug: 'analityk-social', slowa: ['tresc', 'tekst', 'content', 'kampani', 'linkedin', 'social', 'post', 'marketing', 'seo', 'reklam'] },
]

/** Gotowe, generyczne zadania demo dla poszczegolnych specjalistow. */
const ZADANIA_DEMO: Record<string, string> = {
  analityk: 'Zbadaj kontekst rynkowy i konkurencje pod to pytanie.',
  handlowiec: 'Ujmij to od strony sprzedazy i wartosci dla klienta.',
  copywriter: 'Wskaz, skad wziac na to leady poza social: kogo zaczepiamy i przez kogo.',
  'opiekun-klienta': 'Sprawdz watek relacji i utrzymania klienta.',
  'wiedza-produkt': 'Opisz, ktora nasza usluga to rozwiazuje, dla kogo i z jakim dowodem.',
  operacje: 'Powiedz, co to znaczy dla kierunku firmy na 6-24 miesiace.',
  'pamiec-zespolu': 'Policz, ile to kosztuje, jaka jest marza i czy sie oplaca.',
  'drugi-glos': 'Zakwestionuj plan i wskaz ryzyka.',
  'analityk-social': 'Zaproponuj tresci i kanaly do tego celu.',
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

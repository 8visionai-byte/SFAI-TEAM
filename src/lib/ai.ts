import { getAgent } from '../data/agents'
import { getAgentPrompt, getFullBrain, getBrainCard } from './content'
// Import bezpieczny: storage.ts bierze z ai.ts wylacznie typ (import type),
// wiec nie powstaje cykl w czasie dzialania.
import { aktywneSkilleAgenta } from './storage'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// --- Ustawienia uzytkownika (localStorage) ---------------------------------
// Klucz API i model trzymamy WYLACZNIE w przegladarce uzytkownika.
// Nie sa wbudowane w bundle i nie trafiaja na zaden serwer poza Anthropic.
const KEY_STORAGE = 'sf_anthropic_key'
const MODEL_STORAGE = 'sf_anthropic_model'
const DEFAULT_MODEL = import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-4-6'

// Jakosc glosu rozmowy realtime (OpenAI). 'wysoka' = model pelny (lepszy, drozszy),
// 'szybka' = model mini (tanszy). Trzymamy WYLACZNIE w przegladarce uzytkownika.
const VOICE_QUALITY_STORAGE = 'sf_glos_jakosc'
export type JakoscGlosu = 'wysoka' | 'szybka'

/** Bezpieczny dostep do localStorage (SSR/prywatny tryb moga rzucic wyjatek). */
function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** Zwraca klucz API zapisany przez uzytkownika albo null. */
export function getApiKey(): string | null {
  const v = safeStorage()?.getItem(KEY_STORAGE)?.trim()
  return v ? v : null
}

/** Zapisuje klucz API uzytkownika w localStorage. */
export function setApiKey(value: string): void {
  const v = value.trim()
  if (!v) {
    clearApiKey()
    return
  }
  safeStorage()?.setItem(KEY_STORAGE, v)
}

/** Usuwa klucz API uzytkownika (powrot do trybu demo). */
export function clearApiKey(): void {
  safeStorage()?.removeItem(KEY_STORAGE)
}

/** Czy uzytkownik ma zapisany wlasny klucz (tryb realny). */
export function hasApiKey(): boolean {
  return getApiKey() !== null
}

/** Zwraca wybrany model albo domyslny. */
export function getModel(): string {
  const v = safeStorage()?.getItem(MODEL_STORAGE)?.trim()
  return v ? v : DEFAULT_MODEL
}

/** Zapisuje wybrany model w localStorage. */
export function setModel(value: string): void {
  const v = value.trim()
  if (!v) {
    safeStorage()?.removeItem(MODEL_STORAGE)
    return
  }
  safeStorage()?.setItem(MODEL_STORAGE, v)
}

// --- Jakosc glosu realtime (localStorage sf_glos_jakosc) -------------------

/** Zwraca wybrana jakosc glosu (domyslnie 'wysoka' = pelny model). */
export function getVoiceQuality(): JakoscGlosu {
  const v = safeStorage()?.getItem(VOICE_QUALITY_STORAGE)?.trim()
  return v === 'szybka' ? 'szybka' : 'wysoka'
}

/** Zapisuje wybrana jakosc glosu ('wysoka' | 'szybka'). */
export function setVoiceQuality(value: JakoscGlosu): void {
  safeStorage()?.setItem(
    VOICE_QUALITY_STORAGE,
    value === 'szybka' ? 'szybka' : 'wysoka',
  )
}

/**
 * Mapuje wybrana jakosc glosu na nazwe modelu OpenAI Realtime:
 *  - 'wysoka' -> 'gpt-realtime'       (pelny, najwyzsza jakosc, drozszy)
 *  - 'szybka' -> 'gpt-realtime-mini'  (tanszy, szybszy)
 * Nazwy sa aliasami GA (podazaja za najnowsza wersja), zweryfikowane w whiteliscie
 * po stronie /api/realtime-token (patrz RESEARCH-GLOS-JAKOSC.md).
 */
export function getVoiceModel(): string {
  return getVoiceQuality() === 'szybka' ? 'gpt-realtime-mini' : 'gpt-realtime'
}

const CHAT_RULES = [
  'ZASADY ROZMOWY W APLIKACJI (nadrzędne nad formatem raportowym z persony):',
  '- Rozmawiasz z właścicielem firmy, nie piszesz raportu. Mów TYLKO prostym polskim.',
  '- ZAKAZ angielskich etykiet i wtrąceń w odpowiedzi (BLUF, so what, insight, lead, framework itp.). Pojęcia tłumacz po polsku.',
  '- Struktura odpowiedzi: najpierw wniosek i co KONKRETNIE zrobić (numerowane kroki jeśli pasują), potem krótkie uzasadnienie. Bez ścian tekstu.',
  '- Zakaz myślnika em-dash. Zakaz zmyślonych liczb: liczby tylko z mózgu, inaczej powiedz czego brakuje.',
  '- Jeśli czegoś nie ma w mózgu, powiedz wprost i zaproponuj, jakie dane uzupełnić.',
].join('\n')

/** Buduje system prompt dla danego agenta z osadzonego mozgu i persony. */
export function buildSystemPrompt(agentSlug: string): string {
  const agent = getAgent(agentSlug)
  const brain = getFullBrain()

  let persona: string
  if (agent?.hasPrompt) {
    persona = getAgentPrompt(agentSlug) ?? ''
  } else {
    persona = agent
      ? [
          `# ROLA: ${agent.name} (${agent.role})`,
          ``,
          `Misja: ${agent.mission}`,
          ``,
          'Ten agent dziala w trybie podstawowym (brak pelnego system promptu).',
          'Trzymaj sie tozsamosci i tonu marki z Karty Mozgu powyzej.',
          'Gdy temat wykracza poza Twoja role, zaproponuj wlasciwego agenta z zespolu.',
        ].join('\n')
      : ''
  }

  // Wlasne umiejetnosci od wlasciciela (localStorage, sf_skille): tylko aktywne.
  // Dziala w kazdym trybie polaczenia (klucz/proxy/env), bo kazdy z nich
  // dostaje ten sam system prompt z buildSystemPrompt.
  const skille = aktywneSkilleAgenta(agentSlug)
  const sekcjaSkilli =
    skille.length > 0
      ? [
          '=== DODATKOWE UMIEJETNOSCI OD WLASCICIELA (stosuj) ===',
          ...skille.map((s) => `- ${s.nazwa}: ${s.instrukcja}`),
        ].join('\n')
      : ''

  return [
    '=== MOZG FIRMY (pelna tresc, czytaj przed odpowiedzia) ===',
    brain,
    '',
    '=== TWOJA PERSONA ===',
    persona,
    ...(sekcjaSkilli ? ['', sekcjaSkilli] : []),
    '',
    CHAT_RULES,
  ].join('\n')
}

/**
 * Wersja promptu dla ROZMOWY GLOSOWEJ (OpenAI Realtime). Realtime ma twardy
 * limit 16384 tokenow na instrukcje, wiec zamiast calego mozgu (getFullBrain)
 * dajemy rdzen (Karta Mozgu) + persone + skille + zasady. Zwiezle, ale spojne
 * z marka i tozsamoscia. Pelen mozg zostaje w czacie tekstowym.
 */
export function buildVoicePrompt(agentSlug: string): string {
  const agent = getAgent(agentSlug)
  const card = getBrainCard()

  // (1) NAJPIERW mocny blok tozsamosci: model ma znac firme jak CEO, nie gadac
  // ogolnikami, a po szczegoly siegac narzedziem przeszukaj_wiedze.
  const imie = agent?.personImie ?? agent?.name ?? 'asystent zespolu'
  const rola = agent?.role ?? 'czlonek zespolu SimpleFast.ai'
  const misja =
    agent?.mission ??
    'pomagamy firmom wdrazac AI, ktore realnie sprzedaje i oszczedza czas.'
  const tozsamosc = [
    `Jestes ${imie}, ${rola} w SimpleFast.ai. Znasz firme na wylot: ${misja}`,
    'Odpowiadasz KONKRETNIE, realnymi danymi firmy, nigdy ogolnikami.',
    'Gdy pytanie wymaga szczegolu (cennik, case study, ICP, proces, oferta, dane firmy), UZYJ narzedzia przeszukaj_wiedze i powiedz krotko "daj mi chwile, sprawdze", a potem odpowiedz na podstawie tego, co znalazles.',
    'Nie zmyslasz liczb ani faktow: jesli czegos nie ma w wiedzy, powiedz to wprost.',
    'Masz tez narzedzie zapisz_do_bazy: mozesz utrwalac wazne ustalenia w bazie wiedzy firmy. Gdy w rozmowie padnie trwaly, warty zapamietania fakt (nowa cena, decyzja, ustalenie o kliencie idealnym, sprawdzony sposob na obiekcje, nowa informacja o ofercie), PROAKTYWNIE zaproponuj zapis: "Chcesz, zebym zapisal to do naszej bazy?". Po wyraznej zgodzie wywolaj zapisz_do_bazy z rzeczowym tytulem i zwiezla trescia. Nie zapisuj rzeczy ulotnych, dygresji ani niepotwierdzonych liczb i nie zapisuj bez zgody.',
  ].join(' ')

  let persona: string
  if (agent?.hasPrompt) {
    persona = getAgentPrompt(agentSlug) ?? ''
  } else {
    persona = agent
      ? `# ROLA: ${agent.name} (${agent.role})\n\nMisja: ${agent.mission}\n\nTrzymaj sie tozsamosci i tonu marki z Karty Mozgu.`
      : ''
  }
  // Realtime ma twardy budzet ~16k tokenow na instrukcje. Gdy persona jest duza,
  // TNIEMY persone (blok tozsamosci i Karta Mozgu zostaja w calosci).
  const PERSONA_LIMIT = 18000
  if (persona.length > PERSONA_LIMIT) {
    persona =
      persona.slice(0, PERSONA_LIMIT) +
      '\n\n[...persona przycieta na potrzeby rozmowy glosowej; pelna wersja dziala w czacie tekstowym...]'
  }

  const skille = aktywneSkilleAgenta(agentSlug)
  const sekcjaSkilli =
    skille.length > 0
      ? [
          '=== DODATKOWE UMIEJETNOSCI OD WLASCICIELA (stosuj) ===',
          ...skille.map((s) => `- ${s.nazwa}: ${s.instrukcja}`),
        ].join('\n')
      : ''

  const preambula = [
    '=== PREAMBULA PRZED NARZEDZIEM ===',
    'Zanim wywolasz przeszukaj_wiedze, powiedz jedno krotkie, naturalne zdanie po polsku, ze wlasnie sprawdzasz (np. "Juz sprawdzam to w naszej bazie." / "Chwilke, zaraz to znajde."). Bez filerow typu "hmm". Po odebraniu wyniku odpowiedz konkretnie z tego, co znalazles.',
  ].join('\n')

  const out = [
    '=== KIM JESTES (najwazniejsze, czytaj najpierw) ===',
    tozsamosc,
    '',
    '=== RDZEN WIEDZY O FIRMIE (Karta Mozgu) ===',
    card,
    '',
    '=== TWOJA PERSONA ===',
    persona,
    ...(sekcjaSkilli ? ['', sekcjaSkilli] : []),
    '',
    preambula,
    '',
    CHAT_RULES,
    '',
    'To rozmowa GLOSOWA: mow zwiezle i naturalnie, krotkie zdania, jak czlowiek przez telefon. Bez list punktowanych na glos. Bez em-dash.',
  ].join('\n')

  // Twardy sufit calosci, zeby zmiescic prompt + opisy narzedzi w budzecie instrukcji.
  const LIMIT = 40000
  return out.length > LIMIT ? out.slice(0, LIMIT) : out
}

/** Odpowiedz MOCK, gdy brak klucza API (tryb demo). */
function mockResponse(agentSlug: string): string {
  const agent = getAgent(agentSlug)
  const name = agent?.name ?? 'Agent'
  const role = agent?.role ?? 'zespol SF AI'
  const mission = agent?.mission ?? ''

  const modeNote = agent?.hasPrompt
    ? 'Mam wgrany pelny system prompt z pliku AGENT.md.'
    : 'Dzialam w trybie podstawowym (opis roli plus mozg firmy).'

  return [
    `Jestem ${name}, ${role}. Teraz dzialam w trybie demo, bez polaczenia z modelem.`,
    '',
    mission ? `Moja misja: ${mission}` : '',
    '',
    modeNote,
    '',
    'Zeby uruchomic mnie naprawde, z pelnym kontekstem mozgu firmy:',
    '1. W Lovable wejdz w ustawienia projektu i dodaj sekret VITE_ANTHROPIC_API_KEY.',
    '2. Opcjonalnie ustaw VITE_ANTHROPIC_MODEL (domyslnie claude-sonnet-4-6).',
    '3. Przebuduj aplikacje. Od tego momentu odpowiadam realnie, na bazie Karty Mozgu i swojej persony.',
    '',
    'REKOMENDACJA: dodaj sekret w Lovable, potem zadaj mi konkretne pytanie z mojej domeny.',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

type AnthropicMessage = { role: 'user' | 'assistant'; content: string }

/** Tryb, w ktorym zadziala wywolanie modelu (wg kolejnosci wyboru w sendMessage). */
export type TrybModelu = 'klucz' | 'proxy' | 'env' | 'demo'

/**
 * Zwraca tryb, ktory zostanie realnie uzyty:
 *  - 'klucz'  klucz uzytkownika z localStorage (wywolanie wprost z przegladarki),
 *  - 'proxy'  VITE_AGENT_API_URL (klucz na serwerze),
 *  - 'env'    VITE_ANTHROPIC_API_KEY w bundlu (tylko testy wewnetrzne),
 *  - 'demo'   brak jakiegokolwiek polaczenia z modelem.
 */
export function getMode(): TrybModelu {
  if (getApiKey()) return 'klucz'
  if (import.meta.env.VITE_AGENT_API_URL) return 'proxy'
  if (import.meta.env.VITE_ANTHROPIC_API_KEY) return 'env'
  return 'demo'
}

/**
 * Tryb BEZPIECZNY: wywolanie przez proxy Supabase. Klucz API zostaje na serwerze,
 * nie trafia do przegladarki. Zalecane do publicznego uzycia.
 */
async function callProxy(
  proxyUrl: string,
  system: string,
  messages: AnthropicMessage[],
  model: string,
): Promise<string> {
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system, messages, model, max_tokens: 4000 }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const errBody = await res.json()
      detail = errBody?.error ?? JSON.stringify(errBody)
    } catch {
      detail = await res.text().catch(() => '')
    }
    return `Nie udalo sie pobrac odpowiedzi z proxy (HTTP ${res.status}). ${detail}`.trim()
  }

  const data = await res.json()
  const text: string | undefined = data?.text
  if (!text) {
    return 'Proxy zwrocilo pusta odpowiedz. Sprobuj ponownie albo przeformuluj pytanie.'
  }
  return text
}

/**
 * Tryb TESTOWY (tylko wewnetrzny): wywolanie Anthropic bezposrednio z przegladarki.
 * Klucz API trafia do klienta, wiec nie uzywaj tego na publicznym wdrozeniu.
 */
async function callDirect(
  apiKey: string,
  system: string,
  messages: AnthropicMessage[],
  model: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 4000, system, messages }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const errBody = await res.json()
      detail = errBody?.error?.message ?? JSON.stringify(errBody)
    } catch {
      detail = await res.text().catch(() => '')
    }
    return `Nie udalo sie pobrac odpowiedzi (HTTP ${res.status}). ${detail}`.trim()
  }

  const data = await res.json()
  const text: string | undefined = data?.content?.[0]?.text
  if (!text) {
    return 'Model zwrocil pusta odpowiedz. Sprobuj ponownie albo przeformuluj pytanie.'
  }
  return text
}

/**
 * Niskopoziomowe wywolanie modelu z GOTOWYM system promptem i historia rozmowy.
 * Wybiera tryb wg getMode() i NIE doklada zadnych zasad (system jest podawany
 * w calosci przez wolajacego). Uzywane przez sendMessage oraz przez orkiestracje,
 * ktora na etapie planu potrzebuje wlasnego, dedykowanego system promptu.
 *
 * W trybie demo rzuca wyjatek: brak polaczenia z modelem. Wolajacy powinien
 * najpierw sprawdzic getMode() === 'demo' i obsluzyc to po swojemu.
 */
export async function callModel(
  system: string,
  history: ChatMessage[],
): Promise<string> {
  const messages: AnthropicMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const mode = getMode()

  // (a) Klucz uzytkownika ma pierwszenstwo: tryb realny z modelem z ustawien.
  if (mode === 'klucz') {
    return await callDirect(getApiKey() as string, system, messages, getModel())
  }

  // Model z ustawien uzytkownika (getModel), z fallbackiem na env/domyslny.
  // Dzieki temu wybor z Settings trafia takze do body proxy i trybu env.
  const model = getModel()

  // (b) Proxy: bezpieczne, klucz po stronie serwera.
  if (mode === 'proxy') {
    return await callProxy(
      import.meta.env.VITE_AGENT_API_URL as string,
      system,
      messages,
      model,
    )
  }

  // (c) Klucz z env w przegladarce, tylko do testow wewnetrznych.
  if (mode === 'env') {
    return await callDirect(
      import.meta.env.VITE_ANTHROPIC_API_KEY as string,
      system,
      messages,
      model,
    )
  }

  // (d) Tryb demo: brak realnego polaczenia z modelem.
  throw new Error('Tryb demo: brak polaczenia z modelem.')
}

/**
 * Wysyla rozmowe do agenta. Kolejnosc wyboru trybu:
 *  (a) klucz uzytkownika w localStorage -> wywolanie z przegladarki wprost do Anthropic,
 *      model z getModel() (tryb REALNY, klucz zostaje w przegladarce uzytkownika),
 *  (b) inaczej VITE_AGENT_API_URL -> proxy (klucz na serwerze, BEZPIECZNE),
 *  (c) inaczej VITE_ANTHROPIC_API_KEY -> wywolanie z przegladarki (klucz z env),
 *  (d) inaczej -> MOCK (tryb demo).
 * Cala logika owinieta w try/catch, zwraca czytelny komunikat bledu.
 */
export async function sendMessage(
  agentSlug: string,
  history: ChatMessage[],
): Promise<string> {
  // (d) Brak klucza uzytkownika, brak proxy i brak klucza env -> tryb demo.
  if (getMode() === 'demo') {
    return mockResponse(agentSlug)
  }

  try {
    const system = buildSystemPrompt(agentSlug)
    return await callModel(system, history)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `Wystapil blad podczas rozmowy z agentem: ${msg}. Sprawdz konfiguracje (klucz API lub proxy) i polaczenie z siecia.`
  }
}

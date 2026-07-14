import { getAgent } from '../data/agents'
import { getAgentPrompt, getBrainCard } from './content'

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

const STYLE_RULES = [
  'Odpowiadaj po polsku, w stylu BLUF (wniosek najpierw).',
  'Zakaz myslnika em-dash (dluga kreska). Uzywaj przecinka, dwukropka albo krotszego zdania.',
  'Zero zmyslonych liczb, tylko dane z mozgu. Brak pokrycia oznaczaj jako "nie wiem" plus [INPUT PAWLA].',
].join(' ')

/** Buduje system prompt dla danego agenta z osadzonego mozgu i persony. */
function buildSystemPrompt(agentSlug: string): string {
  const agent = getAgent(agentSlug)
  const card = getBrainCard()

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

  return [
    '=== KARTA MOZGU (rdzen, czytaj przed odpowiedzia) ===',
    card,
    '',
    '=== TWOJA PERSONA ===',
    persona,
    '',
    '=== ZASADY STYLU (nadrzedne) ===',
    STYLE_RULES,
  ].join('\n')
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
    `BLUF: Jestem ${name}, ${role}. Teraz dzialam w trybie demo, bez polaczenia z modelem.`,
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
    body: JSON.stringify({ system, messages, model }),
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
    body: JSON.stringify({ model, max_tokens: 1500, system, messages }),
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
  const userKey = getApiKey()
  const proxyUrl = import.meta.env.VITE_AGENT_API_URL
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  // (d) Brak klucza uzytkownika, brak proxy i brak klucza env -> tryb demo.
  if (!userKey && !proxyUrl && !envKey) {
    return mockResponse(agentSlug)
  }

  try {
    const system = buildSystemPrompt(agentSlug)
    const messages: AnthropicMessage[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // (a) Klucz uzytkownika ma pierwszenstwo: tryb realny z modelem z ustawien.
    if (userKey) {
      return await callDirect(userKey, system, messages, getModel())
    }

    const model = import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-4-6'

    // (b) Proxy: bezpieczne, klucz po stronie serwera.
    if (proxyUrl) {
      return await callProxy(proxyUrl, system, messages, model)
    }

    // (c) Klucz z env w przegladarce, tylko do testow wewnetrznych.
    // W tym punkcie envKey jest na pewno ustawiony (gwarantuje to wczesniejszy return).
    return await callDirect(envKey as string, system, messages, model)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `Wystapil blad podczas rozmowy z agentem: ${msg}. Sprawdz konfiguracje (klucz API lub proxy) i polaczenie z siecia.`
  }
}

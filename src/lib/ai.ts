import { getAgent } from '../data/agents'
import { getAgentPrompt, getBrainCard } from './content'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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

/**
 * Wysyla rozmowe do agenta. Z kluczem API odpytuje Anthropic, bez klucza zwraca MOCK.
 * Cala logika owinieta w try/catch, zwraca czytelny komunikat bledu.
 */
export async function sendMessage(
  agentSlug: string,
  history: ChatMessage[],
): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey) {
    return mockResponse(agentSlug)
  }

  try {
    const system = buildSystemPrompt(agentSlug)
    const model = import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-4-6'

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      }),
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `Wystapil blad podczas rozmowy z agentem: ${msg}. Sprawdz klucz API i polaczenie z siecia.`
  }
}

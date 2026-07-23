// Vercel serverless function: proxy czatu do Anthropic z GLOBALNYM kluczem firmy.
// Dzieki temu Marcin (i Pawel) nie ustawiaja wlasnego klucza: klucz zyje na serwerze.
//
// Ustaw sekret w Vercel: Project (webapp) > Settings > Environment Variables
//   ANTHROPIC_API_KEY = sk-ant-...   (globalny, NIE trafia do klienta)
// Opcjonalnie: ANTHROPIC_MODEL (domyslny model, gdy klient nie poda).
//
// Kontrakt: POST /api/chat  { system, messages, model?, maxTokens?, agentSlug? }
//   -> 200 { text }                          (sklejone bloki tekstu odpowiedzi)
//   -> 401 { error: 'wymagane-logowanie' }   (brak/zly token, gdy AUTH_SECRET ustawiony)
//   -> 503 { error: 'brak-klucza' }          (brak ANTHROPIC_API_KEY -> klient robi fallback)
//   -> 400/502 { error }                     (zle wejscie / blad Anthropic)
//
// Dla agentSlug 'analityk'/'analityk-social' dokladamy narzedzie web_search
// (jak w kliencie callDirect) i sklejamy WSZYSTKIE bloki typu text.
//
// Luzne typy (bez @vercel/node). Poza tsconfig include:["src"], wiec `npm run build`
// go nie kompiluje.
import { weryfikacjaTokenu } from './_auth'

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
const DEFAULT_MAX_TOKENS = 4000
const AGENCI_Z_WEBEM = new Set(['analityk', 'analityk-social'])

function czytajBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  if (typeof req.body === 'string' && req.body.length) {
    try {
      return Promise.resolve(JSON.parse(req.body))
    } catch {
      return Promise.resolve({})
    }
  }
  return new Promise((resolve) => {
    let dane = ''
    req.on('data', (c: any) => {
      dane += c
    })
    req.on('end', () => {
      if (!dane) return resolve({})
      try {
        resolve(JSON.parse(dane))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'tylko-post' })
    return
  }

  // Bramka logowania: przy ustawionym AUTH_SECRET wymaga waznego tokenu.
  const auth = weryfikacjaTokenu(req)
  if (!auth.ok) {
    res.status(401).json({ error: 'wymagane-logowanie' })
    return
  }

  const klucz = process.env.ANTHROPIC_API_KEY
  if (!klucz) {
    res.status(503).json({ error: 'brak-klucza' })
    return
  }

  const body = await czytajBody(req)
  const system = typeof body?.system === 'string' ? body.system : ''
  const messages = Array.isArray(body?.messages) ? body.messages : null
  const model =
    typeof body?.model === 'string' && body.model.trim()
      ? body.model.trim()
      : DEFAULT_MODEL
  const maxTokens =
    typeof body?.maxTokens === 'number' && body.maxTokens > 0
      ? Math.min(body.maxTokens, 8192)
      : DEFAULT_MAX_TOKENS
  const agentSlug = typeof body?.agentSlug === 'string' ? body.agentSlug : ''

  if (!messages || messages.length === 0) {
    res.status(400).json({ error: 'brak-messages' })
    return
  }

  const zadanie: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
  }
  if (system) zadanie.system = system
  // Internet dla analitykow (Rae, Zoe): serwerowe narzedzie web_search Anthropic.
  if (AGENCI_Z_WEBEM.has(agentSlug)) {
    zadanie.tools = [
      { type: 'web_search_20250305', name: 'web_search', max_uses: 5 },
    ]
  }

  try {
    const odp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': klucz,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(zadanie),
    })

    if (!odp.ok) {
      const tresc = await odp.text().catch(() => '')
      res
        .status(odp.status)
        .json({ error: 'anthropic-blad', szczegoly: tresc.slice(0, 500) })
      return
    }

    const dane: any = await odp.json()
    // Odpowiedz moze miec WIELE blokow content (tekst + wyniki web_search).
    // Sklejamy WSZYSTKIE bloki typu 'text', nie tylko content[0].
    const bloki: any[] = Array.isArray(dane?.content) ? dane.content : []
    const text = bloki
      .filter((b) => b?.type === 'text' && typeof b?.text === 'string')
      .map((b) => b.text as string)
      .join('\n')
      .trim()

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ text })
  } catch (e: any) {
    res.status(502).json({
      error: 'polaczenie-anthropic',
      szczegoly: String(e?.message ?? e).slice(0, 300),
    })
  }
}

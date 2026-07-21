// Vercel serverless function: mint ephemeral OpenAI Realtime token.
//
// Ustaw sekret w Vercel: Project (webapp) > Settings > Environment Variables
//   OPENAI_API_KEY = sk-...   (NIE trafia do klienta, zyje tylko tutaj)
//
// Kontrakt: POST /api/realtime-token  { voice?, instructions? }  (body opcjonalne)
//   -> 200 { value: "ek_...", expiresAt, model }   (token do WebRTC)
//   -> 503 { error: "brak-klucza" }                (sygnal fallbacku, nie blad krytyczny)
//
// Luzne typy (bez @vercel/node), zeby nie wchodzic w zaleznosci frontu.
// Ten plik jest poza tsconfig include:["src"], wiec `npm run build` go nie kompiluje.

// Szybki wariant realtime (nizsza latencja). Mozna nadpisac przez env.
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini'
// Model transkrypcji wejscia (wymagany przez sesje realtime). Szybki wariant.
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe'

// Glosy dzialajace stabilnie na wariancie mini (bez cedar/marin - nowe, moga nie grac).
const GLOSY_OK = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse']
const GLOS_DOMYSLNY = 'ash' // meski, gdy body.voice nieprawidlowy

function czytajBody(req: any): Promise<any> {
  // Vercel zwykle parsuje JSON do req.body. Gdy nie, czytamy strumien recznie.
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  if (typeof req.body === 'string' && req.body.length) {
    try { return Promise.resolve(JSON.parse(req.body)) } catch { return Promise.resolve({}) }
  }
  return new Promise((resolve) => {
    let dane = ''
    req.on('data', (c: any) => { dane += c })
    req.on('end', () => {
      if (!dane) return resolve({})
      try { resolve(JSON.parse(dane)) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req: any, res: any) {
  // CORS same-origin (dla lokalnego dev / preview).
  const origin = req.headers?.origin
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'tylko-post' })
    return
  }

  // Wlasciciel dodal w Vercel zmienna 'openaiapi'; obsluzmy tez inne nazwy.
  const klucz = process.env.OPENAI_API_KEY || process.env.openaiapi || process.env.OPENAI_KEY
  if (!klucz) {
    res.status(503).json({ error: 'brak-klucza' })
    return
  }

  const body = await czytajBody(req)
  const voice = typeof body?.voice === 'string' && GLOSY_OK.includes(body.voice)
    ? body.voice
    : GLOS_DOMYSLNY
  // OpenAI Realtime ma twardy limit 16384 tokenow na instrukcje. Tniemy do
  // bezpiecznej dlugosci znakowej (ok. 40000 znakow ~ 12-13k tokenow), zeby
  // sesja nigdy nie padla na 400 za dlugie instrukcje. Klient i tak wysyla
  // zwiezly prompt glosowy (buildVoicePrompt), to jest zabezpieczenie.
  const MAX_INSTR = 40000
  const raw = typeof body?.instructions === 'string' ? body.instructions : ''
  const instructions = raw.length > 0
    ? raw.slice(0, MAX_INSTR)
    : 'Prowadzisz rozmowe glosowa prostym polskim. Bez em-dash, bez zmyslonych liczb.'

  try {
    const odp = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${klucz}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: OPENAI_REALTIME_MODEL,
          instructions,
          audio: {
            input: {
              transcription: { model: OPENAI_TRANSCRIBE_MODEL, language: 'pl' },
              // Serwerowe wykrywanie konca wypowiedzi = plynna rozmowa (jak ChatGPT).
              turn_detection: { type: 'server_vad' },
            },
            output: { voice },
          },
        },
      }),
    })

    if (!odp.ok) {
      const tresc = await odp.text().catch(() => '')
      res.status(odp.status).json({ error: 'openai-blad', szczegoly: tresc.slice(0, 500) })
      return
    }

    const dane: any = await odp.json()
    // Ksztalt odpowiedzi OpenAI: { value: "ek_...", expires_at, session: {...} }.
    // NIE zwracamy klucza glownego, tylko krotkozyciowy sekret sesji.
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      value: dane?.value ?? dane?.client_secret?.value,
      expiresAt: dane?.expires_at ?? dane?.client_secret?.expires_at ?? null,
      model: OPENAI_REALTIME_MODEL,
    })
  } catch (e: any) {
    res.status(502).json({ error: 'polaczenie-openai', szczegoly: String(e?.message ?? e).slice(0, 300) })
  }
}

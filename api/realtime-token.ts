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

const OPENAI_REALTIME_MODEL = 'gpt-realtime-2.1'

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

  const klucz = process.env.OPENAI_API_KEY
  if (!klucz) {
    res.status(503).json({ error: 'brak-klucza' })
    return
  }

  const body = await czytajBody(req)
  const voice = typeof body?.voice === 'string' && /^[a-z]+$/.test(body.voice)
    ? body.voice
    : 'cedar'
  // Instrukcje persony (mozg + persona + skille z buildSystemPrompt) bywaja
  // dlugie; dopuszczamy do 200000 znakow, inaczej sesja dostaje pusty prompt.
  const instructions = typeof body?.instructions === 'string' && body.instructions.length <= 200000
    ? body.instructions
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
            input: { transcription: { language: 'pl' } },
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

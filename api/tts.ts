// Vercel serverless function: proxy do ElevenLabs streaming TTS (glos persony).
//
// Ustaw sekret w Vercel: Project (webapp) > Settings > Environment Variables
//   ELEVENLABS_API_KEY = ...   (NIE trafia do klienta, zyje tylko tutaj)
//
// Kontrakt: POST /api/tts  { text: string, voiceId: string }
//   -> 200 audio/mpeg (strumien)      (usta persony)
//   -> 400 { error: "..." }           (zle wejscie)
//   -> 503 { error: "brak-klucza" }   (sygnal fallbacku do voice.ts)
//
// Luzne typy (bez @vercel/node). Poza tsconfig include:["src"], wiec `npm run build`
// go nie kompiluje.

const MODEL_ID = 'eleven_flash_v2_5' // multilingual, niska latencja; jezyk PL wykrywany z tekstu
const MAX_ZNAKOW = 3000

function czytajBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  if (typeof req.body === 'string' && req.body.length) {
    try { return Promise.resolve(JSON.parse(req.body)) } catch { return Promise.resolve(null) }
  }
  return new Promise((resolve) => {
    let dane = ''
    req.on('data', (c: any) => { dane += c })
    req.on('end', () => {
      if (!dane) return resolve(null)
      try { resolve(JSON.parse(dane)) } catch { resolve(null) }
    })
    req.on('error', () => resolve(null))
  })
}

export default async function handler(req: any, res: any) {
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

  // Wlasciciel moze dodac klucz pod rozna nazwa; obsluzmy warianty.
  const klucz = process.env.ELEVENLABS_API_KEY || process.env.elevenlabsapi || process.env.ELEVEN_API_KEY
  if (!klucz) {
    res.status(503).json({ error: 'brak-klucza' })
    return
  }

  const body = await czytajBody(req)
  const text = body?.text
  const voiceId = body?.voiceId

  if (typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'brak-tekstu' })
    return
  }
  if (text.length > MAX_ZNAKOW) {
    res.status(400).json({ error: 'tekst-za-dlugi', max: MAX_ZNAKOW })
    return
  }
  if (typeof voiceId !== 'string' || !/^[A-Za-z0-9]+$/.test(voiceId)) {
    res.status(400).json({ error: 'zly-voiceid' })
    return
  }

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=2`
    const odp = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': klucz,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })

    if (!odp.ok || !odp.body) {
      const tresc = await odp.text().catch(() => '')
      res.status(odp.status || 502).json({ error: 'elevenlabs-blad', szczegoly: tresc.slice(0, 500) })
      return
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')

    // Przekaz strumien audio 1:1. Web ReadableStream -> Node response.
    const reader = odp.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) res.write(Buffer.from(value))
    }
    res.end()
  } catch (e: any) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'polaczenie-elevenlabs', szczegoly: String(e?.message ?? e).slice(0, 300) })
    } else {
      res.end()
    }
  }
}

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

import { createHmac, timingSafeEqual } from 'node:crypto'

// --- Autoryzacja INLINE. Celowo kopiowana w kazdej funkcji: wspoldzielony
// import ('./_auth') nie byl dolaczany przez bundler funkcji Vercela i kazda
// funkcja z tym importem padala z FUNCTION_INVOCATION_FAILED (500).
// Tryb otwarty: brak AUTH_SECRET -> { ok:true, otwarty:true }.
function weryfikacjaTokenu(req: any): { ok: boolean; otwarty?: boolean; uzytkownik?: string; rola?: string } {
  const secret = process.env.AUTH_SECRET
  if (!secret) return { ok: true, otwarty: true }

  const h = req?.headers || {}
  const rawAuth = h.authorization ?? h.Authorization ?? ''
  const auth = typeof rawAuth === 'string' ? rawAuth : ''
  if (!/^Bearer\s+/i.test(auth)) return { ok: false }
  const token = auth.replace(/^Bearer\s+/i, '').trim()

  const kropka = token.indexOf('.')
  if (kropka <= 0) return { ok: false }
  const payload = token.slice(0, kropka)
  const sig = token.slice(kropka + 1)
  if (!payload || !sig) return { ok: false }

  const oczekiwany = createHmac('sha256', secret).update(payload).digest()
  let podany: Buffer
  try {
    podany = Buffer.from(sig, 'base64url')
  } catch {
    return { ok: false }
  }
  if (oczekiwany.length !== podany.length) return { ok: false }
  if (!timingSafeEqual(oczekiwany, podany)) return { ok: false }

  let dane: any
  try {
    dane = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return { ok: false }
  }
  if (typeof dane?.exp !== 'number' || dane.exp < Date.now()) {
    return { ok: false }
  }
  return { ok: true, uzytkownik: dane.u, rola: dane.rola }
}

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
  if (!weryfikacjaTokenu(req).ok) {
    res.status(401).json({ error: 'wymagane-logowanie' })
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

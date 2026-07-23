// Vercel serverless function: logowanie (2 konta, hasla w env, sesja HMAC, bez bazy).
//
// Ustaw sekrety w Vercel: Project (webapp) > Settings > Environment Variables
//   AUTH_SECRET  = <losowy, dlugi string>   (sekret podpisu tokenu)
//   HASLO_PAWEL  = <haslo Pawla>
//   HASLO_MARCIN = <haslo Marcina>
//
// Kontrakt: POST /api/login  { uzytkownik: 'pawel'|'marcin', haslo }
//   -> 200 { token, uzytkownik, rola }        (poprawne haslo)
//   -> 401 { error: 'zle-haslo' }             (bledne haslo)
//   -> 400 { error: 'zle-wejscie' }           (zly uzytkownik/haslo)
//   -> 503 { error: 'brak-konfiguracji' }     (brak env -> klient wchodzi w tryb otwarty)
//
// Token: base64url(payload {u, rola, exp}) + "." + base64url(HMAC-SHA256(payload, AUTH_SECRET)).
// Waznosc 30 dni. Role: pawel = admin-techniczny, marcin = admin.
//
// Luzne typy (bez @vercel/node). Poza tsconfig include:["src"], wiec `npm run build`
// go nie kompiluje.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const DNI_30_MS = 30 * 24 * 60 * 60 * 1000

const ROLE: Record<string, string> = {
  pawel: 'admin-techniczny',
  marcin: 'admin',
}

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

/** Porownanie hasel odporne na pomiar czasu (na sha256 rownej dlugosci). */
function hasloRowne(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

/** Buduje podpisany token sesji. */
function zbudujToken(u: string, rola: string, secret: string): string {
  const payloadObj = { u, rola, exp: Date.now() + DNI_30_MS }
  const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString(
    'base64url',
  )
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
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

  const secret = process.env.AUTH_SECRET
  const haslaEnv: Record<string, string | undefined> = {
    pawel: process.env.HASLO_PAWEL,
    marcin: process.env.HASLO_MARCIN,
  }

  // Brak konfiguracji (sekret lub oba hasla) -> tryb otwarty po stronie klienta.
  if (!secret || (!haslaEnv.pawel && !haslaEnv.marcin)) {
    res.status(503).json({ error: 'brak-konfiguracji' })
    return
  }

  const body = await czytajBody(req)
  const uzytkownik =
    typeof body?.uzytkownik === 'string' ? body.uzytkownik.trim() : ''
  const haslo = typeof body?.haslo === 'string' ? body.haslo : ''

  if (uzytkownik !== 'pawel' && uzytkownik !== 'marcin') {
    res.status(400).json({ error: 'zle-wejscie' })
    return
  }

  const oczekiwane = haslaEnv[uzytkownik]
  // Haslo dla konkretnego konta nieustawione -> traktuj jak bledne (nie 503).
  if (!oczekiwane || !haslo || !hasloRowne(haslo, oczekiwane)) {
    res.status(401).json({ error: 'zle-haslo' })
    return
  }

  const rola = ROLE[uzytkownik]
  const token = zbudujToken(uzytkownik, rola, secret)
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ token, uzytkownik, rola })
}

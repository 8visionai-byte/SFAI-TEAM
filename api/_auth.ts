// Helper autoryzacji dla funkcji serwerowych (NIE endpoint: prefix "_" sprawia,
// ze Vercel nie tworzy z niego trasy). Weryfikuje token sesji podpisany HMAC.
//
// Model tokenu (patrz api/login.ts):
//   token = base64url(JSON payload {u, rola, exp}) + "." + base64url(HMAC-SHA256(payload, AUTH_SECRET))
//
// Tryb otwarty: gdy AUTH_SECRET nie jest ustawiony, aplikacja dziala jak dotad
// (bez logowania), wiec weryfikacja zwraca { ok:true, otwarty:true }.
//
// Luzne typy (bez @vercel/node). Poza tsconfig include:["src"], wiec `npm run build`
// go nie kompiluje.
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface WynikAutoryzacji {
  ok: boolean
  /** true, gdy serwer nie ma AUTH_SECRET (logowanie wylaczone). */
  otwarty?: boolean
  uzytkownik?: string
  rola?: string
}

/** Czyta naglowek Authorization niezaleznie od wielkosci liter. */
function czytajAuth(req: any): string {
  const h = req?.headers || {}
  const v = h.authorization ?? h.Authorization ?? ''
  return typeof v === 'string' ? v : ''
}

/**
 * Weryfikuje token z naglowka Authorization: Bearer <token>.
 * - Brak AUTH_SECRET -> { ok:true, otwarty:true } (tryb otwarty).
 * - Poprawny podpis HMAC + niewygasly exp -> { ok:true, uzytkownik, rola }.
 * - Wszystko inne -> { ok:false }.
 */
export function weryfikacjaTokenu(req: any): WynikAutoryzacji {
  const secret = process.env.AUTH_SECRET
  if (!secret) return { ok: true, otwarty: true }

  const auth = czytajAuth(req)
  if (!/^Bearer\s+/i.test(auth)) return { ok: false }
  const token = auth.replace(/^Bearer\s+/i, '').trim()

  const kropka = token.indexOf('.')
  if (kropka <= 0) return { ok: false }
  const payload = token.slice(0, kropka)
  const sig = token.slice(kropka + 1)
  if (!payload || !sig) return { ok: false }

  // Porownanie podpisow timing-safe (na rownej dlugosci bufora).
  const oczekiwany = createHmac('sha256', secret).update(payload).digest()
  let podany: Buffer
  try {
    podany = Buffer.from(sig, 'base64url')
  } catch {
    return { ok: false }
  }
  if (oczekiwany.length !== podany.length) return { ok: false }
  if (!timingSafeEqual(oczekiwany, podany)) return { ok: false }

  // Podpis OK: parsujemy payload i sprawdzamy waznosc (exp w ms).
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

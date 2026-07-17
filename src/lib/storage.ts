import type { ChatMessage } from './ai'

/** Zapisana rozmowa z agentem (localStorage, klucz sf_rozmowy). */
export interface Rozmowa {
  id: string
  agentSlug: string
  tytul: string
  messages: ChatMessage[]
  updatedAt: string
}

/** Notatka zapisana do pamieci (localStorage, klucz sf_notatki). */
export interface Notatka {
  id: string
  /** Skad pochodzi notatka (np. "Czat: Analityk rynku", "Centrum Dowodzenia"). */
  zrodlo: string
  /** Data zapisu (ISO). */
  data: string
  tytul: string
  /** Tresc w markdown. */
  tresc: string
}

const KEY_ROZMOWY = 'sf_rozmowy'
const KEY_NOTATKI = 'sf_notatki'

/** Bezpieczny dostep do localStorage (tryb prywatny moze rzucic wyjatek). */
function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function readList<T>(key: string): T[] {
  try {
    const raw = safeStorage()?.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeList<T>(key: string, list: T[]): void {
  try {
    safeStorage()?.setItem(key, JSON.stringify(list))
  } catch {
    // Brak miejsca lub tryb prywatny: pomijamy zapis, apka dziala dalej.
  }
}

/** Prosty unikalny identyfikator (czas + losowa koncowka). */
export function nowyId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// --- Rozmowy ---------------------------------------------------------------

/** Wszystkie zapisane rozmowy. */
export function wczytajRozmowy(): Rozmowa[] {
  return readList<Rozmowa>(KEY_ROZMOWY)
}

/** Rozmowy danego agenta, najnowsze pierwsze. */
export function rozmowyAgenta(agentSlug: string): Rozmowa[] {
  return wczytajRozmowy()
    .filter((r) => r.agentSlug === agentSlug)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Zapisuje lub nadpisuje rozmowe (po id). */
export function zapiszRozmowe(rozmowa: Rozmowa): void {
  const list = wczytajRozmowy()
  const i = list.findIndex((r) => r.id === rozmowa.id)
  if (i >= 0) list[i] = rozmowa
  else list.push(rozmowa)
  writeList(KEY_ROZMOWY, list)
}

/** Usuwa rozmowe po id. */
export function usunRozmowe(id: string): void {
  writeList(
    KEY_ROZMOWY,
    wczytajRozmowy().filter((r) => r.id !== id),
  )
}

// --- Notatki ---------------------------------------------------------------

/** Wszystkie notatki, najnowsze pierwsze. */
export function wczytajNotatki(): Notatka[] {
  return readList<Notatka>(KEY_NOTATKI).sort((a, b) =>
    b.data.localeCompare(a.data),
  )
}

/** Dodaje notatke. */
export function zapiszNotatke(notatka: Notatka): void {
  const list = readList<Notatka>(KEY_NOTATKI)
  list.push(notatka)
  writeList(KEY_NOTATKI, list)
}

/** Usuwa notatke po id. */
export function usunNotatke(id: string): void {
  writeList(
    KEY_NOTATKI,
    readList<Notatka>(KEY_NOTATKI).filter((n) => n.id !== id),
  )
}

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

/** Pojedynczy wpis przebiegu w Centrum Dowodzenia (localStorage, klucz sf_centrum). */
export type WpisCentrum =
  | { rodzaj: 'user'; tekst: string }
  | { rodzaj: 'system'; tekst: string }
  | { rodzaj: 'final'; tekst: string }

/** Wlasna umiejetnosc agenta dodana przez wlasciciela (localStorage, klucz sf_skille). */
export interface Umiejetnosc {
  id: string
  agentSlug: string
  nazwa: string
  /** Instrukcja tekstowa doklejana do system promptu agenta, gdy aktywna. */
  instrukcja: string
  aktywna: boolean
}

/** Nadpis lokalny pliku mozgu (localStorage, klucz sf_mozg_nadpisy). */
export interface NadpisMozgu {
  /** Pelna sciezka pliku z bundla (klucz import.meta.glob). */
  sciezka: string
  /** Nadpisana tresc markdown (zastepuje oryginal z bundla). */
  tresc: string
  updatedAt: string
}

/** Wlasny plik mozgu dodany przez uzytkownika (localStorage, klucz sf_mozg_wlasne). */
export interface PlikWlasnyMozgu {
  /** Wygenerowana sciezka, np. "wlasne/cennik-dodatkowy.md" (unikalna). */
  sciezka: string
  tresc: string
  /** Klucz grupy mozgu (np. "proof" albo "wlasne"). */
  grupa: string
  updatedAt: string
}

const KEY_ROZMOWY = 'sf_rozmowy'
const KEY_NOTATKI = 'sf_notatki'
const KEY_CENTRUM = 'sf_centrum'
const KEY_SKILLE = 'sf_skille'
const KEY_MOZG_NADPISY = 'sf_mozg_nadpisy'
const KEY_MOZG_WLASNE = 'sf_mozg_wlasne'

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

// --- Wlasne umiejetnosci agentow (sf_skille) --------------------------------

/** Wszystkie wlasne umiejetnosci (wszystkich agentow). */
export function wczytajSkille(): Umiejetnosc[] {
  return readList<Umiejetnosc>(KEY_SKILLE)
}

/** Wlasne umiejetnosci danego agenta (w kolejnosci dodania). */
export function skilleAgenta(agentSlug: string): Umiejetnosc[] {
  return wczytajSkille().filter((s) => s.agentSlug === agentSlug)
}

/** Aktywne umiejetnosci agenta (doklejane do jego system promptu). */
export function aktywneSkilleAgenta(agentSlug: string): Umiejetnosc[] {
  return skilleAgenta(agentSlug).filter((s) => s.aktywna)
}

/** Dodaje wlasna umiejetnosc. */
export function dodajSkilla(skill: Umiejetnosc): void {
  const list = wczytajSkille()
  list.push(skill)
  writeList(KEY_SKILLE, list)
}

/** Przelacza aktywna/wylaczona po id. */
export function przelaczSkilla(id: string): void {
  const list = wczytajSkille().map((s) =>
    s.id === id ? { ...s, aktywna: !s.aktywna } : s,
  )
  writeList(KEY_SKILLE, list)
}

/** Usuwa wlasna umiejetnosc po id. */
export function usunSkilla(id: string): void {
  writeList(
    KEY_SKILLE,
    wczytajSkille().filter((s) => s.id !== id),
  )
}

// --- Mozg: nadpisy lokalne plikow (sf_mozg_nadpisy) -------------------------

/** Wszystkie nadpisy lokalne plikow mozgu. */
export function wczytajNadpisyMozgu(): NadpisMozgu[] {
  return readList<NadpisMozgu>(KEY_MOZG_NADPISY)
}

/** Nadpis lokalny danego pliku albo null (brak = obowiazuje oryginal). */
export function wczytajNadpisMozgu(sciezka: string): NadpisMozgu | null {
  return wczytajNadpisyMozgu().find((n) => n.sciezka === sciezka) ?? null
}

/** Zapisuje lub aktualizuje nadpis lokalny pliku mozgu. */
export function zapiszNadpisMozgu(sciezka: string, tresc: string): void {
  const list = wczytajNadpisyMozgu().filter((n) => n.sciezka !== sciezka)
  list.push({ sciezka, tresc, updatedAt: new Date().toISOString() })
  writeList(KEY_MOZG_NADPISY, list)
}

/** Usuwa nadpis lokalny (przywraca oryginal z bundla). */
export function usunNadpisMozgu(sciezka: string): void {
  writeList(
    KEY_MOZG_NADPISY,
    wczytajNadpisyMozgu().filter((n) => n.sciezka !== sciezka),
  )
}

// --- Mozg: wlasne pliki uzytkownika (sf_mozg_wlasne) ------------------------

/** Wszystkie wlasne pliki mozgu dodane przez uzytkownika. */
export function wczytajWlasnePlikiMozgu(): PlikWlasnyMozgu[] {
  return readList<PlikWlasnyMozgu>(KEY_MOZG_WLASNE)
}

/** Dodaje lub aktualizuje wlasny plik mozgu (po sciezce). */
export function zapiszWlasnyPlikMozgu(plik: PlikWlasnyMozgu): void {
  const list = wczytajWlasnePlikiMozgu().filter(
    (p) => p.sciezka !== plik.sciezka,
  )
  list.push(plik)
  writeList(KEY_MOZG_WLASNE, list)
}

/**
 * Wygodne dodanie wlasnego pliku mozgu bez recznego ustawiania updatedAt.
 * Zapis trafia do sf_mozg_wlasne, wiec plik jest od razu czytany przez
 * getBrainFiles() i szukajWMozgu() (narzedzia glosowe + Baza wiedzy).
 */
export function dodajPlikMozgu(plik: {
  sciezka: string
  tresc: string
  grupa: string
}): void {
  zapiszWlasnyPlikMozgu({ ...plik, updatedAt: new Date().toISOString() })
}

/** Usuwa wlasny plik mozgu po sciezce. */
export function usunWlasnyPlikMozgu(sciezka: string): void {
  writeList(
    KEY_MOZG_WLASNE,
    wczytajWlasnePlikiMozgu().filter((p) => p.sciezka !== sciezka),
  )
}

// --- Centrum Dowodzenia: trwalosc biezacej rozmowy -------------------------

/** Odczytuje ostatni przebieg Centrum ([] gdy brak). */
export function wczytajCentrum(): WpisCentrum[] {
  try {
    const raw = safeStorage()?.getItem(KEY_CENTRUM)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { wpisy?: unknown }).wpisy)
    ) {
      return (parsed as { wpisy: WpisCentrum[] }).wpisy
    }
    return []
  } catch {
    return []
  }
}

/** Zapisuje biezacy przebieg Centrum (pojedynczy obiekt, nie lista). */
export function zapiszCentrum(wpisy: WpisCentrum[]): void {
  try {
    safeStorage()?.setItem(
      KEY_CENTRUM,
      JSON.stringify({ wpisy, updatedAt: new Date().toISOString() }),
    )
  } catch {
    // Brak miejsca lub tryb prywatny: pomijamy zapis, apka dziala dalej.
  }
}

/** Kasuje zapamietany przebieg Centrum. */
export function wyczyscCentrum(): void {
  try {
    safeStorage()?.removeItem(KEY_CENTRUM)
  } catch {
    // Ignorujemy, brak dostepu do storage nie moze zablokowac UI.
  }
}

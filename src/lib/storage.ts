import type { ChatMessage } from './ai'
import { getAgent } from '../data/agents'

/** Zapisana rozmowa z agentem (localStorage, klucz sf_rozmowy). */
export interface Rozmowa {
  id: string
  agentSlug: string
  tytul: string
  messages: ChatMessage[]
  updatedAt: string
  /** Imie profilu, ktory prowadzil rozmowe (Pawel / Marcin). */
  uczestnik?: string
  /**
   * Czy z tej rozmowy zapisano juz streszczenie do pamieci agenta.
   * Flaga chroni przed dublowaniem (odejscie + "Nowa rozmowa" moga wystrzelic razem).
   */
  pamiecZapisana?: boolean
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
  /** Imie profilu, ktory zapisal notatke (Pawel / Marcin). */
  uczestnik?: string
}

/** Identyfikator profilu uzytkownika. */
export type IdProfilu = 'pawel' | 'marcin'

/**
 * Rola uprawnien:
 *  - 'admin-techniczny' (Pawel): pelne korzystanie + sekcja kluczy i integracji,
 *  - 'admin' (Marcin): pelne korzystanie, bez sekcji kluczy i integracji.
 */
export type Rola = 'admin-techniczny' | 'admin'

/** Profil uzytkownika (tozsamosc + rola). Wywodzony z sesji (sf_sesja). */
export interface Profil {
  id: IdProfilu
  imie: string
  rola: Rola
}

/** Dwa stale profile firmy. Pawel = admin techniczny (widzi klucze i integracje). */
export const PROFILE: Profil[] = [
  { id: 'pawel', imie: 'Pawel', rola: 'admin-techniczny' },
  { id: 'marcin', imie: 'Marcin', rola: 'admin' },
]

/** Sesja logowania (localStorage sf_sesja). token '' = tryb otwarty (bez hasla). */
export interface Sesja {
  token: string
  uzytkownik: IdProfilu
  rola: Rola
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

/**
 * Edytowalna persona agenta ustawiona przez wlasciciela (localStorage, klucz
 * sf_persona_nadpis). Nadrzedna nad domyslnym stylem persony w promptach.
 */
export interface PersonaNadpis {
  agentSlug: string
  /** "Kim jest i jaka jest" (tozsamosc/charakter nadany przez wlasciciela). */
  kimJestem: string
  /** "Jak zwraca sie do nas" (forma zwracania sie, ton powitania). */
  jakSieZwracam: string
  updatedAt: string
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
const KEY_PERSONA_NADPIS = 'sf_persona_nadpis'
const KEY_CENTRUM = 'sf_centrum'
const KEY_SKILLE = 'sf_skille'
const KEY_MOZG_NADPISY = 'sf_mozg_nadpisy'
const KEY_MOZG_WLASNE = 'sf_mozg_wlasne'
const KEY_PAMIEC_AUTO = 'sf_pamiec_auto'
const KEY_SESJA = 'sf_sesja'
const KEY_TRANSKRYPCJE_AUTO = 'sf_transkrypcje_auto'

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

/** Slug do sciezki pliku: male litery, bez polskich znakow, spacje->'-'. */
function slugProsty(tekst: string): string {
  const slug = (tekst || 'plik')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'plik'
}

// --- Sesja logowania i profil (localStorage sf_sesja) ----------------------

/** Zwraca zapisana sesje logowania albo null. */
export function getSesja(): Sesja | null {
  try {
    const raw = safeStorage()?.getItem(KEY_SESJA)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const u = (parsed as { uzytkownik?: unknown }).uzytkownik
      const t = (parsed as { token?: unknown }).token
      const znany = PROFILE.find((p) => p.id === u)
      // Rola bierzemy z PROFILE (autorytatywna), nie ze storage.
      if (znany && typeof t === 'string') {
        return { token: t, uzytkownik: znany.id, rola: znany.rola }
      }
    }
    return null
  } catch {
    return null
  }
}

/** Zapisuje sesje logowania (token, uzytkownik, rola). */
export function setSesja(sesja: Sesja): void {
  try {
    safeStorage()?.setItem(KEY_SESJA, JSON.stringify(sesja))
  } catch {
    // Brak dostepu do storage nie moze zablokowac UI.
  }
}

/** Kasuje sesje (wylogowanie). */
export function wyloguj(): void {
  try {
    safeStorage()?.removeItem(KEY_SESJA)
  } catch {
    // Brak dostepu do storage nie moze zablokowac UI.
  }
}

/**
 * Naglowek autoryzacji do wywolan /api/* (Bearer z tokenu sesji).
 * Gdy token pusty (tryb otwarty) lub brak sesji, zwraca pusty obiekt.
 */
export function authNaglowek(): Record<string, string> {
  const t = getSesja()?.token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/** Zwraca profil (Pawel / Marcin) wywodzony z sesji albo null. */
export function getProfil(): Profil | null {
  const s = getSesja()
  if (!s) return null
  return PROFILE.find((p) => p.id === s.uzytkownik) ?? null
}

/** Imie zalogowanego uczestnika (do tagowania zapisow); fallback 'Uzytkownik'. */
export function imieUczestnika(): string {
  return getProfil()?.imie ?? 'Uzytkownik'
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

// --- Edytowalna persona agenta (sf_persona_nadpis) --------------------------

/** Nadpis persony danego agenta albo null (brak = obowiazuje domyslna persona). */
export function wczytajPersonaNadpis(agentSlug: string): PersonaNadpis | null {
  return (
    readList<PersonaNadpis>(KEY_PERSONA_NADPIS).find(
      (p) => p.agentSlug === agentSlug,
    ) ?? null
  )
}

/** Zapisuje/aktualizuje nadpis persony danego agenta (po agentSlug). */
export function zapiszPersonaNadpis(
  agentSlug: string,
  kimJestem: string,
  jakSieZwracam: string,
): void {
  const list = readList<PersonaNadpis>(KEY_PERSONA_NADPIS).filter(
    (p) => p.agentSlug !== agentSlug,
  )
  list.push({
    agentSlug,
    kimJestem: kimJestem.trim(),
    jakSieZwracam: jakSieZwracam.trim(),
    updatedAt: new Date().toISOString(),
  })
  writeList(KEY_PERSONA_NADPIS, list)
}

/** Usuwa nadpis persony (przywraca domyslny styl persony). */
export function usunPersonaNadpis(agentSlug: string): void {
  writeList(
    KEY_PERSONA_NADPIS,
    readList<PersonaNadpis>(KEY_PERSONA_NADPIS).filter(
      (p) => p.agentSlug !== agentSlug,
    ),
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

// --- Pamiec agentow (grupa 'pamiec-<slug>' w sf_mozg_wlasne) ----------------

/**
 * Zapisuje wpis PAMIECI danego agenta do mozgu firmy (sf_mozg_wlasne).
 * Kazdy agent ma wlasna pamiec wczesniejszych rozmow: grupa 'pamiec-<slug>',
 * sciezka 'pamiec/<slug>/<data>-<id>.md'. Plik dostaje naglowek z tytulem,
 * data i uczestnikiem (imie persony), a pod nim tresc streszczenia.
 *
 * Poniewaz zapis idzie do sf_mozg_wlasne, plik jest od razu czytany przez
 * getBrainFiles(), getFullBrain() (kontekst czatu) i szukajWMozgu() (glos).
 */
export function zapiszPamiecAgenta(
  slug: string,
  tytul: string,
  tresc: string,
): void {
  const data = new Date().toISOString().slice(0, 10)
  const id = nowyId()
  const agent = getAgent(slug)
  const imie = agent?.personImie ?? agent?.name ?? slug
  const uczestnik = imieUczestnika()
  const tytulCzysty = (tytul || `Rozmowa z ${imie} ${data}`).trim()
  const naglowek = [
    `# ${tytulCzysty}`,
    '',
    `- Data: ${data}`,
    `- Agent: ${imie}`,
    `- Uczestnik: ${uczestnik}`,
    '',
    tresc.trim(),
    '',
  ].join('\n')
  zapiszWlasnyPlikMozgu({
    sciezka: `pamiec/${slug}/${data}-${id}.md`,
    tresc: naglowek,
    grupa: `pamiec-${slug}`,
    updatedAt: new Date().toISOString(),
  })
}

/** Pliki pamieci danego agenta, najnowsze pierwsze. */
export function pamiecAgenta(slug: string): PlikWlasnyMozgu[] {
  return wczytajWlasnePlikiMozgu()
    .filter((p) => p.grupa === `pamiec-${slug}`)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

// --- Ustawienie: automatyczna pamiec rozmow (sf_pamiec_auto) -----------------

/** Czy auto-zapis pamieci rozmow jest wlaczony (domyslnie TAK, gdy brak wpisu). */
export function pamiecAutoWlaczona(): boolean {
  try {
    const v = safeStorage()?.getItem(KEY_PAMIEC_AUTO)
    return v == null ? true : v === '1'
  } catch {
    return true
  }
}

/** Wlacza/wylacza auto-zapis pamieci rozmow. */
export function ustawPamiecAuto(wl: boolean): void {
  try {
    safeStorage()?.setItem(KEY_PAMIEC_AUTO, wl ? '1' : '0')
  } catch {
    // Brak dostepu do storage nie moze zablokowac UI.
  }
}

// --- Pelne transkrypcje rozmow glosowych (grupa 'transkrypcje') -------------

/** Czy auto-zapis PELNYCH transkrypcji jest wlaczony (domyslnie TAK). */
export function transkrypcjeAutoWlaczone(): boolean {
  try {
    const v = safeStorage()?.getItem(KEY_TRANSKRYPCJE_AUTO)
    return v == null ? true : v === '1'
  } catch {
    return true
  }
}

/** Wlacza/wylacza auto-zapis pelnych transkrypcji rozmow. */
export function ustawTranskrypcjeAuto(wl: boolean): void {
  try {
    safeStorage()?.setItem(KEY_TRANSKRYPCJE_AUTO, wl ? '1' : '0')
  } catch {
    // Brak dostepu do storage nie moze zablokowac UI.
  }
}

/**
 * Zapisuje PELNA transkrypcje rozmowy glosowej do mozgu (sf_mozg_wlasne,
 * grupa 'transkrypcje'). Obok streszczenia pamieci trzymamy pelny zapis wypowiedzi.
 * Sciezka: transkrypcje/<data>-<slug persony>-<uczestnik>-<id>.md (id chroni przed
 * nadpisaniem kolejnych rozmow tego samego dnia). Naglowek: data, agent, uczestnik.
 */
export function zapiszTranskrypcje(agentImie: string, pelnaTresc: string): void {
  const data = new Date().toISOString().slice(0, 10)
  const uczestnik = imieUczestnika()
  const id = nowyId()
  const naglowek = [
    `# Transkrypcja rozmowy z ${agentImie} ${data}`,
    '',
    `- Data: ${data}`,
    `- Agent: ${agentImie}`,
    `- Uczestnik: ${uczestnik}`,
    '',
    pelnaTresc.trim(),
    '',
  ].join('\n')
  zapiszWlasnyPlikMozgu({
    sciezka: `transkrypcje/${data}-${slugProsty(agentImie)}-${slugProsty(uczestnik)}-${id}.md`,
    tresc: naglowek,
    grupa: 'transkrypcje',
    updatedAt: new Date().toISOString(),
  })
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

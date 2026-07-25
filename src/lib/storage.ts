import type { ChatMessage } from './ai'
import { agents, getAgent } from '../data/agents'

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
/** Flaga jednorazowej migracji starych zapisow do standardu metadanych. */
const KEY_MIGRACJA_V34 = 'sf_migracja_v34'

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

// --- STANDARD ZAPISU: naglowek metadanych (kazdy nowy plik pamieci) --------

/**
 * STANDARD ZAPISU (obowiazuje kazdy nowy plik pamieci, faktow, briefingu,
 * transkrypcji i notatki). Kazdy plik zaczyna sie naglowkiem metadanych:
 *
 *   ---
 *   typ: fakty | pamiec | briefing | transkrypcja | notatka
 *   agent: <slug albo "firma">
 *   imie: <Imie persony albo "Zespol">
 *   uczestnik: <Pawel | Marcin>
 *   data: RRRR-MM-DD
 *   osoby: [lista osob wymienionych]
 *   tagi: [krotkie tagi tematyczne]
 *   ---
 *
 * Pod naglowkiem sekcje ze STALYMI naglowkami H2 (per typ) i ATOMOWE fakty:
 * jeden fakt = jedna linia "- **[[Nazwa]]** | pole: wartosc | zrodlo: [[plik]]".
 */
export type TypZapisu =
  | 'fakty'
  | 'pamiec'
  | 'briefing'
  | 'transkrypcja'
  | 'notatka'

/** Pola naglowka metadanych (osoby i tagi moga byc puste). */
export interface PolaMeta {
  typ: TypZapisu
  /** Slug agentki albo "firma" dla pamieci wspolnej. */
  agent: string
  /** Imie persony albo "Zespol". */
  imie: string
  /** Pawel | Marcin (albo "nieznany" przy migracji starych plikow). */
  uczestnik?: string
  /** Data RRRR-MM-DD (domyslnie dzisiaj). */
  data?: string
  osoby?: string[]
  tagi?: string[]
}

/** Dzisiejsza data w formacie RRRR-MM-DD. */
function dzisiaj(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Skladnia listy w naglowku: "[a, b]" albo "[]" gdy pusto. */
function listaMeta(v: string[] | undefined): string {
  const czyste = (v ?? []).map((x) => x.trim()).filter(Boolean)
  return `[${Array.from(new Set(czyste)).join(', ')}]`
}

/** Buduje naglowek metadanych wg STANDARDU ZAPISU (z domykajacym "---"). */
export function naglowekMeta(p: PolaMeta): string {
  return [
    '---',
    `typ: ${p.typ}`,
    `agent: ${p.agent || 'firma'}`,
    `imie: ${p.imie || 'Zespol'}`,
    `uczestnik: ${p.uczestnik || imieUczestnika()}`,
    `data: ${p.data || dzisiaj()}`,
    `osoby: ${listaMeta(p.osoby)}`,
    `tagi: ${listaMeta(p.tagi)}`,
    '---',
  ].join('\n')
}

/** Czy tresc ma juz naglowek metadanych (zaczyna sie od bloku "---"). */
export function maNaglowekMeta(tresc: string): boolean {
  const t = (tresc ?? '').trimStart()
  if (!t.startsWith('---')) return false
  // Blok musi sie domykac druga linia "---" w pierwszych ~20 liniach.
  const linie = t.split('\n').slice(1, 21)
  return linie.some((l) => l.trim() === '---')
}

/** Zdejmuje naglowek metadanych z tresci (gdy model dokleil swoj wlasny). */
export function usunNaglowekMeta(tresc: string): string {
  const t = (tresc ?? '').trimStart()
  if (!maNaglowekMeta(t)) return (tresc ?? '').trim()
  const linie = t.split('\n')
  for (let i = 1; i < Math.min(linie.length, 21); i++) {
    if (linie[i].trim() === '---') return linie.slice(i + 1).join('\n').trim()
  }
  return t.trim()
}

/**
 * Gwarantuje naglowek metadanych: gdy tresc juz go ma, zwraca ja bez zmian
 * (idempotentne), w przeciwnym razie dokleja naglowek na poczatku.
 */
export function zapewnijNaglowekMeta(tresc: string, p: PolaMeta): string {
  const t = (tresc ?? '').trim()
  if (maNaglowekMeta(t)) return t
  return `${naglowekMeta(p)}\n\n${t}\n`
}

/** Buduje plik: naglowek metadanych (zawsze nasz) + znormalizowana tresc. */
export function zbudujPlikZeStandardem(tresc: string, p: PolaMeta): string {
  return `${naglowekMeta(p)}\n\n${usunNaglowekMeta(tresc)}\n`
}

/**
 * Wykrywa osoby wymienione w tekscie: imiona person z zespolu oraz wlascicieli
 * (Pawel, Marcin). Porownanie bez polskich znakow i wielkosci liter. Sluzy do
 * pola "osoby" w naglowku metadanych (zapis deterministyczny, bez modelu).
 */
export function wykryjOsoby(tekst: string): string[] {
  const znane = [
    'Pawel',
    'Marcin',
    ...agents.map((a) => a.personImie ?? a.name),
  ]
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l')
  const wTekscie = norm(tekst ?? '')
  const out: string[] = []
  for (const imie of znane) {
    const igla = norm(imie)
    if (!igla) continue
    // Granica slowa na znakach nie-alfanumerycznych (dziala dla polskich form).
    const re = new RegExp(`(^|[^a-z0-9])${igla}([^a-z0-9]|$)`)
    if (re.test(wTekscie) && !out.includes(imie)) out.push(imie)
  }
  return out
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
  const data = dzisiaj()
  const id = nowyId()
  const agent = getAgent(slug)
  const imie = agent?.personImie ?? agent?.name ?? slug
  const uczestnik = imieUczestnika()
  const tytulCzysty = (tytul || `Rozmowa z ${imie} ${data}`).trim()
  const czysta = usunNaglowekMeta(tresc)
  // STANDARD ZAPISU: naglowek metadanych budujemy my (mamy pewne dane), a od
  // modelu bierzemy sama tresc z sekcjami H2 i atomowymi liniami faktow.
  const plik = [
    naglowekMeta({
      typ: 'pamiec',
      agent: slug,
      imie,
      uczestnik,
      data,
      osoby: wykryjOsoby(`${tytulCzysty}\n${czysta}`),
      tagi: ['rozmowa', slug],
    }),
    '',
    `# ${tytulCzysty}`,
    '',
    czysta,
    '',
  ].join('\n')
  zapiszWlasnyPlikMozgu({
    sciezka: `pamiec/${slug}/${data}-${id}.md`,
    tresc: plik,
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
export function zapiszTranskrypcje(
  agentImie: string,
  pelnaTresc: string,
  agentSlug?: string,
): void {
  const data = dzisiaj()
  const uczestnik = imieUczestnika()
  const id = nowyId()
  const czysta = usunNaglowekMeta(pelnaTresc)
  // STANDARD ZAPISU: naglowek metadanych + czytelny zapis czatu (**Ty:** /
  // **<Imie>:**) skladany przez wolajacego (RozmowaWMiejscu).
  const naglowek = [
    naglowekMeta({
      typ: 'transkrypcja',
      agent: agentSlug || slugProsty(agentImie),
      imie: agentImie,
      uczestnik,
      data,
      osoby: wykryjOsoby(czysta),
      tagi: ['transkrypcja', 'rozmowa-glosowa'],
    }),
    '',
    `# Transkrypcja rozmowy z ${agentImie} ${data}`,
    '',
    czysta,
    '',
  ].join('\n')
  zapiszWlasnyPlikMozgu({
    sciezka: `transkrypcje/${data}-${slugProsty(agentImie)}-${slugProsty(uczestnik)}-${id}.md`,
    tresc: naglowek,
    grupa: 'transkrypcje',
    updatedAt: new Date().toISOString(),
  })
}

/** Pelne transkrypcje rozmow danej agentki, najnowsze pierwsze. */
export function transkrypcjeAgenta(imie: string): PlikWlasnyMozgu[] {
  const slug = slugProsty(imie)
  return wczytajWlasnePlikiMozgu()
    .filter((p) => p.grupa === 'transkrypcje' && p.sciezka.includes(`-${slug}-`))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

// --- Twarde fakty agenta (JEDEN zywy plik, grupa 'fakty') -------------------

/**
 * MODEL PAMIECI DLUGOTRWALEJ: kazda agentka ma DOKLADNIE JEDEN zywy plik twardych
 * faktow (osoby, firmy, projekty, preferencje wlascicieli, trwale ustalenia,
 * skojarzenia). Sciezka 'fakty/<slug>.md', grupa 'fakty'. Aktualizowany po kazdej
 * rozmowie (scalanie przez model), wstrzykiwany do promptu czatu i glosu.
 *
 * Zapis idzie do sf_mozg_wlasne, wiec plik jest od razu czytany przez getFullBrain()
 * (kontekst czatu) i szukajWMozgu() (glos, narzedzie przeszukaj_wiedze).
 */
function sciezkaFaktow(slug: string): string {
  return `fakty/${slug}.md`
}

/** Wczytuje plik twardych faktow agentki (tresc MD) albo null, gdy jeszcze nie ma. */
export function wczytajFaktyAgenta(slug: string): string | null {
  const p = wczytajWlasnePlikiMozgu().find(
    (x) => x.sciezka === sciezkaFaktow(slug),
  )
  return p ? p.tresc : null
}

/** Zapisuje/nadpisuje plik twardych faktow agentki (grupa 'fakty'). */
export function zapiszFaktyAgenta(slug: string, tresc: string): void {
  const agent = getAgent(slug)
  const imie = agent?.personImie ?? agent?.name ?? slug
  // Model ma zwrocic plik ze standardowym naglowkiem; gdy go pominie, dokladamy.
  const zeStandardem = zapewnijNaglowekMeta(tresc, {
    typ: 'fakty',
    agent: slug,
    imie,
    uczestnik: imieUczestnika(),
    data: dzisiaj(),
    osoby: wykryjOsoby(tresc),
    tagi: ['fakty', slug],
  })
  zapiszWlasnyPlikMozgu({
    sciezka: sciezkaFaktow(slug),
    tresc: zeStandardem,
    grupa: 'fakty',
    updatedAt: new Date().toISOString(),
  })
}

// --- GLOBALNA PAMIEC FIRMY (JEDEN zywy plik wspolny, grupa 'pamiec-firmy') --

/**
 * GLOBALNA PAMIEC FIRMY: jeden zywy plik markdown WSPOLNY dla calego zespolu.
 * Wszystko, co wlasciciele ustala z DOWOLNA agentka, trafia tutaj, a plik jest
 * wstrzykiwany do promptu KAZDEJ agentki (czat i glos). Dzieki temu rozmowa
 * z Lea o Klaudiuszu jest znana takze Rae.
 *
 * Sciezka 'pamiec-firmy/fakty-firmy.md', grupa 'pamiec-firmy', limit ~10000
 * znakow. Zapis idzie do sf_mozg_wlasne, wiec plik od razu widzi getFullBrain()
 * (czat), szukajWMozgu() (glos) i Baza wiedzy.
 */
export const SCIEZKA_PAMIEC_FIRMY = 'pamiec-firmy/fakty-firmy.md'
export const GRUPA_PAMIEC_FIRMY = 'pamiec-firmy'
/** Twardy limit dlugosci pliku pamieci firmy (znaki). */
export const LIMIT_PAMIEC_FIRMY = 10000

/** Wczytuje globalna pamiec firmy (tresc MD) albo null, gdy jeszcze jej nie ma. */
export function wczytajPamiecFirmy(): string | null {
  const p = wczytajWlasnePlikiMozgu().find(
    (x) => x.sciezka === SCIEZKA_PAMIEC_FIRMY,
  )
  return p ? p.tresc : null
}

/**
 * Zapisuje/nadpisuje globalna pamiec firmy (jeden plik). Tresc przycinana do
 * LIMIT_PAMIEC_FIRMY znakow; naglowek metadanych dokladany, gdy model go pominie.
 */
export function zapiszPamiecFirmy(tresc: string): void {
  const surowa = (tresc ?? '').trim()
  if (!surowa) return
  const zeStandardem = zapewnijNaglowekMeta(surowa, {
    typ: 'pamiec',
    agent: 'firma',
    imie: 'Zespol',
    uczestnik: imieUczestnika(),
    data: dzisiaj(),
    osoby: wykryjOsoby(surowa),
    tagi: ['pamiec-firmy', 'wspolna'],
  })
  const przyciety =
    zeStandardem.length > LIMIT_PAMIEC_FIRMY
      ? zeStandardem.slice(0, LIMIT_PAMIEC_FIRMY)
      : zeStandardem
  zapiszWlasnyPlikMozgu({
    sciezka: SCIEZKA_PAMIEC_FIRMY,
    tresc: przyciety,
    grupa: GRUPA_PAMIEC_FIRMY,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * ZRODLA do przebudowy GLOBALNEJ PAMIECI FIRMY od zera: ostatnie pliki pamieci,
 * transkrypcji i briefingow ze WSZYSTKICH agentek (nie tylko jednej), najnowsze
 * pierwsze. Sam plik pamieci firmy jest pomijany (buduje sie od zera).
 */
export function zrodlaPamieciFirmy(limit = 15): PlikWlasnyMozgu[] {
  return wczytajWlasnePlikiMozgu()
    .filter(
      (p) =>
        p.grupa === 'transkrypcje' ||
        p.grupa === 'briefingi' ||
        (p.grupa.startsWith('pamiec-') && p.grupa !== GRUPA_PAMIEC_FIRMY),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, Math.max(1, limit))
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

// --- MIGRACJA starych zapisow do STANDARDU ZAPISU (sf_migracja_v34) --------

/** Typ zapisu wywodzony z grupy pliku wlasnego. */
function typZGrupy(grupa: string): TypZapisu {
  if (grupa === 'fakty') return 'fakty'
  if (grupa === 'transkrypcje') return 'transkrypcja'
  if (grupa === 'briefingi') return 'briefing'
  if (grupa === GRUPA_PAMIEC_FIRMY) return 'pamiec'
  if (grupa.startsWith('pamiec-')) return 'pamiec'
  return 'notatka'
}

/** Slug agentki wywodzony z grupy/sciezki ("firma" dla pamieci wspolnej). */
function agentZPliku(plik: PlikWlasnyMozgu): string {
  if (plik.grupa === GRUPA_PAMIEC_FIRMY) return 'firma'
  if (plik.grupa.startsWith('pamiec-')) return plik.grupa.slice('pamiec-'.length)
  if (plik.grupa === 'fakty') {
    const m = plik.sciezka.match(/^fakty\/(.+)\.md$/)
    if (m) return m[1]
  }
  if (plik.grupa === 'transkrypcje') {
    // transkrypcje/<data>-<slug persony>-<uczestnik>-<id>.md
    const m = plik.sciezka.match(/^transkrypcje\/\d{4}-\d{2}-\d{2}-([a-z0-9]+)-/)
    if (m) {
      const zn = agents.find(
        (a) => slugProsty(a.personImie ?? a.name) === m[1],
      )
      if (zn) return zn.slug
    }
  }
  return 'firma'
}

/** Data RRRR-MM-DD z nazwy pliku, inaczej z updatedAt. */
function dataZPliku(plik: PlikWlasnyMozgu): string {
  const m = plik.sciezka.match(/(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = (plik.updatedAt ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dzisiaj()
}

/** Uczestnik wyciagniety ze starego naglowka ("- Uczestnik: X" / "> Uczestnik: X"). */
function uczestnikZTresci(tresc: string): string {
  const m = (tresc ?? '').match(/^[>-]\s*Uczestnik:\s*(.+)$/m)
  return m ? m[1].trim() : 'nieznany'
}

/**
 * MIGRACJA v3.4 (jednorazowa, flaga sf_migracja_v34): istniejacym plikom wlasnym
 * BEZ naglowka metadanych dokleja naglowek wyliczony ze sciezki i grupy
 * (typ, agent, imie, uczestnik, data, osoby). TRESCI NIE ZMIENIA.
 *
 * Bezpieczna i idempotentna: pomija pliki, ktore juz maja naglowek, a po
 * przebiegu zapisuje flage, wiec drugie wywolanie (StrictMode) nic nie robi.
 */
export function migrujStareZapisy(): void {
  try {
    if (safeStorage()?.getItem(KEY_MIGRACJA_V34) === '1') return
  } catch {
    return
  }
  try {
    const pliki = wczytajWlasnePlikiMozgu()
    let zmienione = 0
    const nowe = pliki.map((p) => {
      if (maNaglowekMeta(p.tresc)) return p
      const slug = agentZPliku(p)
      const agent = getAgent(slug)
      const imie =
        slug === 'firma' ? 'Zespol' : agent?.personImie ?? agent?.name ?? slug
      const naglowek = naglowekMeta({
        typ: typZGrupy(p.grupa),
        agent: slug,
        imie,
        uczestnik: uczestnikZTresci(p.tresc),
        data: dataZPliku(p),
        osoby: wykryjOsoby(p.tresc),
        tagi: [p.grupa],
      })
      zmienione++
      // Tresc zostaje bez zmian, doklejamy wylacznie naglowek metadanych.
      return { ...p, tresc: `${naglowek}\n\n${p.tresc}` }
    })
    if (zmienione > 0) writeList(KEY_MOZG_WLASNE, nowe)
    safeStorage()?.setItem(KEY_MIGRACJA_V34, '1')
  } catch {
    // Migracja nie moze zablokowac startu aplikacji.
  }
}

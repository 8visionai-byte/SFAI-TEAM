/**
 * Wczytuje osadzona tresc mozgu i person agentow w czasie buildu (eager raw import).
 * Pliki lezą w src/content/ (skopiowane z systemu Claude Code).
 *
 * WARSTWA NADPISOW: getBrainFiles/getBrainFile/getFullBrain/getBrainCard najpierw
 * sprawdzaja lokalne nadpisy i wlasne pliki uzytkownika (localStorage, storage.ts),
 * a dopiero potem oryginaly z bundla. Dzieki temu edycje w Bazie wiedzy REALNIE
 * zmieniaja wiedze agentow (ai.ts buduje system prompt z getFullBrain).
 */

// Import bezpieczny: storage.ts bierze z ai.ts wylacznie typ (import type),
// wiec nie powstaje cykl w czasie dzialania.
import { wczytajNadpisyMozgu, wczytajWlasnePlikiMozgu, wczytajNotatki } from './storage'

// --- MOZG: wszystkie pliki .md (z podfolderami) ---
const brainModules = import.meta.glob('../content/mozg/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// --- AGENCI: pliki <slug>.md ---
const agentModules = import.meta.glob('../content/agenci/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface BrainFile {
  /** Sciezka pelna (klucz import.meta.glob) */
  path: string
  /** Folder: tozsamosc, rynek-klient, oferta-komercja, proof, zespol-i-decyzje, root */
  group: string
  /** Nazwa pliku bez rozszerzenia */
  name: string
  /** Surowy markdown */
  content: string
  /** Tresc nadpisana lokalnie w przegladarce (badge "zmieniono lokalnie"). */
  zmieniony?: boolean
  /** Plik wlasny uzytkownika (dodany w aplikacji, edytowalny i usuwalny). */
  wlasny?: boolean
}

function fileNameFromPath(path: string): string {
  const parts = path.split('/')
  const file = parts[parts.length - 1]
  return file.replace(/\.md$/, '')
}

function groupFromPath(path: string): string {
  // ../content/mozg/<group>/<file>.md  lub  ../content/mozg/<file>.md (root)
  const marker = '/content/mozg/'
  const idx = path.indexOf(marker)
  const rest = idx >= 0 ? path.slice(idx + marker.length) : path
  const segments = rest.split('/')
  return segments.length > 1 ? segments[0] : 'root'
}

/** Lista ORYGINALNYCH plikow mozgu z bundla (bez warstwy nadpisow). */
export const brainFiles: BrainFile[] = Object.entries(brainModules)
  .map(([path, content]) => ({
    path,
    group: groupFromPath(path),
    name: fileNameFromPath(path),
    content,
  }))
  .sort((a, b) => {
    if (a.group === b.group) return a.name.localeCompare(b.name, 'pl')
    return a.group.localeCompare(b.group, 'pl')
  })

/**
 * Lista plikow mozgu z warstwa lokalna (to JA zasila UI, graf i agentow):
 * - nadpis z localStorage zastepuje tresc oryginalu (flaga zmieniony),
 * - wlasne pliki uzytkownika dolaczone do listy (flaga wlasny).
 */
export function getBrainFiles(): BrainFile[] {
  const nadpisy = new Map(
    wczytajNadpisyMozgu().map((n) => [n.sciezka, n.tresc]),
  )
  const bazowe: BrainFile[] = brainFiles.map((f) => {
    const tresc = nadpisy.get(f.path)
    return tresc != null ? { ...f, content: tresc, zmieniony: true } : f
  })
  const wlasne: BrainFile[] = wczytajWlasnePlikiMozgu().map((p) => ({
    path: p.sciezka,
    group: p.grupa,
    name: fileNameFromPath(p.sciezka),
    content: p.tresc,
    wlasny: true,
  }))
  return [...bazowe, ...wlasne].sort((a, b) => {
    if (a.group === b.group) return a.name.localeCompare(b.name, 'pl')
    return a.group.localeCompare(b.group, 'pl')
  })
}

/** Pojedynczy plik mozgu przez warstwe nadpisow (nadpis > oryginal > wlasny). */
export function getBrainFile(path: string): BrainFile | undefined {
  return getBrainFiles().find((f) => f.path === path)
}

/** Kolejnosc i etykiety grup w UI */
export const brainGroupOrder: { key: string; label: string }[] = [
  { key: 'root', label: 'Rdzen' },
  { key: 'tozsamosc', label: 'Tozsamosc' },
  { key: 'rynek-klient', label: 'Rynek i klient' },
  { key: 'oferta-komercja', label: 'Oferta i komercja' },
  { key: 'proof', label: 'Dowody' },
  { key: 'zespol-i-decyzje', label: 'Zespol i decyzje' },
]

/** Tresc Karty Mozgu (rdzen pre-load do system promptu), z warstwa nadpisow. */
export function getBrainCard(): string {
  const card = getBrainFiles().find((f) => f.name === '_KARTA-MOZGU')
  return card?.content ?? ''
}

/** Sciezka wzgledna pliku mozgu (od src/content/mozg/) */
function relativeBrainPath(path: string): string {
  const marker = '/content/mozg/'
  const idx = path.indexOf(marker)
  return idx >= 0 ? path.slice(idx + marker.length) : path
}

/**
 * CALY mozg jako jeden string: wszystkie pliki .md sklejone,
 * kazdy poprzedzony naglowkiem "=== PLIK: <sciezka wzgledna> ===".
 * Kolejnosc grup jak w brainGroupOrder (rdzen na poczatku).
 * Uwzglednia warstwe nadpisow: nadpisy lokalne zastepuja oryginaly,
 * a wlasne pliki uzytkownika sa doklejane z naglowkiem "PLIK (wlasny)".
 */
export function getFullBrain(): string {
  const groupRank = (group: string): number => {
    const idx = brainGroupOrder.findIndex((g) => g.key === group)
    return idx >= 0 ? idx : brainGroupOrder.length
  }
  return getBrainFiles()
    .sort((a, b) => {
      const diff = groupRank(a.group) - groupRank(b.group)
      if (diff !== 0) return diff
      return a.name.localeCompare(b.name, 'pl')
    })
    .map((f) => {
      const naglowek = f.wlasny
        ? `=== PLIK (wlasny): ${relativeBrainPath(f.path)} ===`
        : `=== PLIK: ${relativeBrainPath(f.path)} ===`
      return `${naglowek}\n${f.content.trim()}`
    })
    .join('\n\n')
}

/** Pelny system prompt agenta (AGENT.md), jesli istnieje */
export function getAgentPrompt(slug: string): string | null {
  const key = Object.keys(agentModules).find((k) =>
    k.endsWith(`/${slug}.md`),
  )
  return key ? agentModules[key] : null
}

// --- Wyszukiwarka mozgu (dla narzedzia glosowego przeszukaj_wiedze) ---------

/**
 * Normalizuje tekst do porownan: male litery, bez polskich znakow diakrytycznych
 * (ą->a, ł->l, ż->z ...), zeby dopasowanie bylo case- i diakrytyko-insensitive.
 */
function normalizujTekst(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
}

// Krotkie polskie slowa funkcyjne pomijane przy budowie slow kluczowych.
const STOP_SLOWA = new Set([
  'co', 'jak', 'na', 'do', 'to', 'sie', 'jest', 'czy', 'ale', 'lub', 'oraz',
  'dla', 'the', 'and', 'jaki', 'jaka', 'jakie', 'ktore', 'ktora', 'ktory',
  'gdzie', 'kiedy', 'ile', 'wiec', 'ten', 'tego', 'nasz', 'nasza', 'nasze',
  'moze', 'mam', 'masz', 'aby', 'przy', 'pod', 'nad', 'bez', 'ich',
])

/**
 * Wycina z tresci fragment skupiony wokol pierwszego trafienia slowa kluczowego,
 * przyciety do maxLen znakow. Gdy tresc miesci sie w limicie, zwraca calosc.
 */
function wytnijFragment(tresc: string, slowa: string[], maxLen: number): string {
  const czysta = tresc.trim()
  if (czysta.length <= maxLen) return czysta

  const norm = normalizujTekst(czysta)
  let poz = -1
  for (const kw of slowa) {
    const i = norm.indexOf(kw)
    if (i >= 0 && (poz < 0 || i < poz)) poz = i
  }
  if (poz < 0) return czysta.slice(0, maxLen).trim() + '...'

  const start = Math.max(0, poz - Math.floor(maxLen / 3))
  const koniec = Math.min(czysta.length, start + maxLen)
  const wyciety = czysta.slice(start, koniec).trim()
  return (start > 0 ? '...' : '') + wyciety + (koniec < czysta.length ? '...' : '')
}

/**
 * Przeszukuje CALY mozg (pliki przez warstwe nadpisow) oraz notatki uzytkownika.
 * Proste scoring po nakladaniu slow kluczowych zapytania (case- i diakrytyko-
 * insensitive, polskie znaki). Zwraca 1-3 najlepiej pasujace fragmenty, kazdy z
 * naglowkiem zrodla, przyciete lacznie do limitZnakow. Gdy nic nie pasuje albo
 * zapytanie jest puste, zwraca krotka informacje, ze brak danych.
 *
 * Uzywane przez narzedzie glosowe przeszukaj_wiedze (realtime.ts).
 */
export function szukajWMozgu(zapytanie: string, limitZnakow = 6000): string {
  const slowa = Array.from(
    new Set(
      normalizujTekst(zapytanie ?? '')
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 2 && !STOP_SLOWA.has(w)),
    ),
  )
  if (slowa.length === 0) {
    return 'Brak danych: puste lub zbyt ogolne zapytanie do bazy wiedzy.'
  }

  type Jednostka = { etykieta: string; tresc: string }
  const jednostki: Jednostka[] = [
    ...getBrainFiles().map((f) => ({
      etykieta: relativeBrainPath(f.path),
      tresc: f.content,
    })),
    ...wczytajNotatki().map((n) => ({
      etykieta: `notatka: ${n.tytul || n.zrodlo || 'bez tytulu'}`,
      tresc: n.tresc,
    })),
  ]

  const oceny = jednostki
    .map((j) => {
      const norm = normalizujTekst(j.tresc)
      let trafione = 0
      let wystapienia = 0
      for (const kw of slowa) {
        let idx = norm.indexOf(kw)
        if (idx >= 0) {
          trafione++
          while (idx >= 0) {
            wystapienia++
            idx = norm.indexOf(kw, idx + kw.length)
          }
        }
      }
      // Waga: liczba TRAFIONYCH slow kluczowych wazniejsza niz liczba wystapien.
      const wynik = trafione * 1000 + wystapienia
      return { ...j, wynik, trafione }
    })
    .filter((o) => o.trafione > 0)
    .sort((a, b) => b.wynik - a.wynik)
    .slice(0, 3)

  if (oceny.length === 0) {
    return `Brak danych w mozgu na zapytanie: "${zapytanie}". Powiedz o tym uzytkownikowi i zaproponuj, jakie dane uzupelnic w Bazie wiedzy.`
  }

  const bloki: string[] = []
  let pozostalo = limitZnakow
  const budzetNaBlok = Math.max(600, Math.ceil(limitZnakow / oceny.length))
  for (const o of oceny) {
    if (pozostalo <= 200) break
    const naglowek = `=== ZRODLO: ${o.etykieta} ===\n`
    const budzetTresci = Math.max(0, Math.min(budzetNaBlok, pozostalo - naglowek.length))
    if (budzetTresci < 60) break
    const blok = naglowek + wytnijFragment(o.tresc, slowa, budzetTresci)
    bloki.push(blok)
    pozostalo -= blok.length + 2
  }

  return bloki.join('\n\n')
}

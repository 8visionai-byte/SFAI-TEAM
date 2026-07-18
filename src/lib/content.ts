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
import { wczytajNadpisyMozgu, wczytajWlasnePlikiMozgu } from './storage'

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

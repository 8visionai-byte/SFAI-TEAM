/**
 * Wczytuje osadzona tresc mozgu i person agentow w czasie buildu (eager raw import).
 * Pliki lezą w src/content/ (skopiowane z systemu Claude Code).
 */

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

/** Lista plikow mozgu, posortowana i pogrupowana */
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

/** Kolejnosc i etykiety grup w UI */
export const brainGroupOrder: { key: string; label: string }[] = [
  { key: 'root', label: 'Rdzen' },
  { key: 'tozsamosc', label: 'Tozsamosc' },
  { key: 'rynek-klient', label: 'Rynek i klient' },
  { key: 'oferta-komercja', label: 'Oferta i komercja' },
  { key: 'proof', label: 'Dowody' },
  { key: 'zespol-i-decyzje', label: 'Zespol i decyzje' },
]

/** Tresc Karty Mozgu (rdzen pre-load do system promptu) */
export function getBrainCard(): string {
  const card = brainFiles.find((f) => f.name === '_KARTA-MOZGU')
  return card?.content ?? ''
}

/** Pelny system prompt agenta (AGENT.md), jesli istnieje */
export function getAgentPrompt(slug: string): string | null {
  const key = Object.keys(agentModules).find((k) =>
    k.endsWith(`/${slug}.md`),
  )
  return key ? agentModules[key] : null
}

/**
 * Model grafu wiedzy ("mozg jako siec").
 * Buduje wezly i krawedzie z realnej tresci mozgu, person zespolu i notatek uzytkownika.
 * Pure: bez fizyki i bez DOM. Fizyke liczy komponent BrainGraph.tsx.
 */

import { getBrainFiles, getAgentPrompt, type BrainFile } from './content'
import { agents } from '../data/agents'
import type { Notatka } from './storage'

export type NodeKind = 'file' | 'hub' | 'persona' | 'note'
export type LinkKind = 'hub' | 'ref' | 'reads' | 'note' | 'backbone'

export interface GraphNode {
  /** Unikalny identyfikator wezla. */
  id: string
  kind: NodeKind
  /** Etykieta widoczna przy wezle. */
  label: string
  /** Klucz grupy (do kolorowania i legendy). */
  group: string
  /** Rozwiazany kolor wezla (hex). */
  color: string
  /** Promien wezla (px w przestrzeni logicznej). */
  size: number
  /** Sciezka pliku mozgu (tylko kind === 'file'), do otwarcia podgladu. */
  path?: string
  /** Plik z trescia nadpisana lokalnie (delikatna obwodka w grafie). */
  zmieniony?: boolean
  /** Wlasny plik uzytkownika. */
  wlasny?: boolean
}

export interface GraphLink {
  /** id wezla zrodlowego. */
  source: string
  /** id wezla docelowego. */
  target: string
  kind: LinkKind
}

export interface GroupMeta {
  key: string
  label: string
  color: string
}

export interface BrainGraphModel {
  nodes: GraphNode[]
  links: GraphLink[]
  /** Grupy realnie obecne w grafie, w kolejnosci do legendy. */
  groups: GroupMeta[]
  stats: {
    files: number
    personas: number
    notes: number
    hubs: number
    links: number
    refLinks: number
    readsLinks: number
  }
}

/** Kolory grup, spojne z motywem (brand + akcenty person z agents.ts). */
const GROUP_COLOR: Record<string, string> = {
  root: '#5B8DEF', // brand
  tozsamosc: '#A78BFA',
  'rynek-klient': '#38BDF8',
  'oferta-komercja': '#34D399',
  proof: '#FBBF24',
  'zespol-i-decyzje': '#F472B6',
  zespol: '#FB923C', // persony (kazda ma tez wlasny akcent)
  wlasne: '#2DD4BF', // wlasne pliki uzytkownika
  notatki: '#E4E4E7', // twoje notatki
}

/** Czytelne etykiety grup w legendzie. */
const GROUP_LABEL: Record<string, string> = {
  root: 'Rdzen',
  tozsamosc: 'Tozsamosc',
  'rynek-klient': 'Rynek i klient',
  'oferta-komercja': 'Oferta i komercja',
  proof: 'Dowody',
  'zespol-i-decyzje': 'Zespol i decyzje',
  zespol: 'Persony zespolu',
  wlasne: 'Wlasne pliki',
  notatki: 'Twoje notatki',
}

/** Kolejnosc grup w legendzie. */
const GROUP_RANK = [
  'root',
  'tozsamosc',
  'rynek-klient',
  'oferta-komercja',
  'proof',
  'zespol-i-decyzje',
  'zespol',
  'wlasne',
  'notatki',
]

/** Opisy grup (1-2 zdania, prosty polski) do panelu bocznego i tooltipow legendy. */
export const GROUP_OPIS: Record<string, string> = {
  root: 'Serce mozgu firmy. Karta Mozgu i pliki-korzenie, ktore kazdy agent wczytuje na starcie, zanim cokolwiek odpowie.',
  tozsamosc:
    'Kim jest SimpleFast.ai: misja, glos marki i zasady. Nadaje ton kazdej wypowiedzi zespolu.',
  'rynek-klient':
    'Kto jest naszym klientem: profil idealnego klienta, jego bole, jezyk i miejsca, w ktorych go szukamy.',
  'oferta-komercja':
    'Co sprzedajemy i za ile: uslugi, pakiety, model wyceny oraz sciezka od diagnozy do umowy.',
  proof:
    'Twarde dowody do sprzedazy: przyklady wdrozen, liczby i argumenty, ktore rozbrajaja obiekcje klienta.',
  'zespol-i-decyzje':
    'Jak zespol pracuje i decyduje: role, zasady wspolpracy i sposob rozstrzygania sporow.',
  zespol:
    'Agenci AI jako wezly. Kazda persona ma wlasny kolor i nici do plikow mozgu, ktore realnie czyta.',
  wlasne:
    'Pliki dodane recznie w aplikacji. Zapisane w tej przegladarce i czytane przez agentow razem z reszta mozgu.',
  notatki:
    'Rozmowy i ustalenia zapisane recznie przyciskiem Zapisz do pamieci. Twoja warstwa wiedzy dopieta do grafu.',
}

export function groupColor(key: string): string {
  return GROUP_COLOR[key] ?? '#71717A'
}

export function groupLabel(key: string): string {
  return GROUP_LABEL[key] ?? key
}

/** Sciezka wzgledna pliku mozgu (od katalogu mozg/), np. "rynek-klient/icp.md". */
function relativePathOf(group: string, name: string): string {
  return group === 'root' ? `${name}.md` : `${group}/${name}.md`
}

/** Skraca etykiete do czytelnej dlugosci. */
function shortLabel(raw: string, max = 22): string {
  const clean = raw.replace(/^_/, '').replace(/-/g, ' ')
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trimEnd()}…`
}

/** Promien wezla-pliku wg dlugosci tresci. */
function fileRadius(len: number): number {
  const r = 7 + Math.sqrt(len) / 11
  return Math.max(7, Math.min(17, r))
}

/**
 * Buduje model grafu z aktualnej tresci mozgu + person + przekazanych notatek.
 * Pliki mozgu ida przez warstwe nadpisow (getBrainFiles), wiec nadpisane
 * i wlasne pliki tez sa widoczne w grafie. Liste mozna podac z zewnatrz,
 * zeby memoizacja w Brain.tsx reagowala na edycje.
 */
export function buildBrainGraph(
  notatki: Notatka[],
  pliki: BrainFile[] = getBrainFiles(),
): BrainGraphModel {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []

  // --- 1. Huby grup folderow (obecne w plikach mozgu) + backbone do rdzenia ---
  const folderGroups = new Set<string>()
  for (const f of pliki) folderGroups.add(f.group)

  const hubId = (g: string) => `hub:${g}`
  for (const g of folderGroups) {
    nodes.push({
      id: hubId(g),
      kind: 'hub',
      label: groupLabel(g),
      group: g,
      color: groupColor(g),
      size: 12,
    })
  }
  // Backbone: kazdy hub folderu podpiety pod rdzen (root), zeby siec miala kregoslup.
  if (folderGroups.has('root')) {
    for (const g of folderGroups) {
      if (g === 'root') continue
      links.push({ source: hubId(g), target: hubId('root'), kind: 'backbone' })
    }
  }

  // --- 2. Wezly plikow + krawedz do huba grupy ---
  const relToId = new Map<string, string>() // "rynek-klient/icp.md" -> node id
  for (const f of pliki) {
    const id = `file:${f.path}`
    nodes.push({
      id,
      kind: 'file',
      label: shortLabel(f.name),
      group: f.group,
      color: groupColor(f.group),
      size: fileRadius(f.content.length),
      path: f.path,
      zmieniony: f.zmieniony,
      wlasny: f.wlasny,
    })
    // Relacje "czyta" (AGENT.md) dotycza tylko plikow z repo, nie wlasnych.
    if (!f.wlasny) relToId.set(relativePathOf(f.group, f.name), id)
    links.push({ source: id, target: hubId(f.group), kind: 'hub' })
  }

  // --- 3. Odwolania miedzy plikami (skan tresci pod nazwy innych plikow) ---
  const refSeen = new Set<string>() // nieskierowane, unikamy duplikatow
  let refLinks = 0
  for (const a of pliki) {
    const aId = `file:${a.path}`
    for (const b of pliki) {
      if (a.path === b.path) continue
      const needle = `${b.name}.md`
      if (!a.content.includes(needle)) continue
      const key =
        aId < `file:${b.path}` ? `${aId}|file:${b.path}` : `file:${b.path}|${aId}`
      if (refSeen.has(key)) continue
      refSeen.add(key)
      links.push({ source: aId, target: `file:${b.path}`, kind: 'ref' })
      refLinks++
    }
  }

  // --- 4. Persony zespolu + hub 'zespol' + krawedzie "czyta" do plikow mozgu ---
  nodes.push({
    id: hubId('zespol'),
    kind: 'hub',
    label: groupLabel('zespol'),
    group: 'zespol',
    color: groupColor('zespol'),
    size: 12,
  })
  if (folderGroups.has('root')) {
    links.push({ source: hubId('zespol'), target: hubId('root'), kind: 'backbone' })
  }

  let readsLinks = 0
  const personaIdByName = new Map<string, string>()
  for (const agent of agents) {
    const pid = `persona:${agent.slug}`
    nodes.push({
      id: pid,
      kind: 'persona',
      label: shortLabel(agent.name, 20),
      group: 'zespol',
      color: agent.accent, // wlasny akcent persony
      size: 13, // wiekszy wezel: w srodku renderuje sie miniatura postaci
    })
    personaIdByName.set(agent.name, pid)
    links.push({ source: pid, target: hubId('zespol'), kind: 'hub' })

    // Skan AGENT.md pod sciezki mozg-wspolny/<relative>
    const prompt = getAgentPrompt(agent.slug)
    if (!prompt) continue
    const readsSeen = new Set<string>()
    for (const [rel, fileNodeId] of relToId) {
      if (readsSeen.has(fileNodeId)) continue
      if (prompt.includes(`mozg-wspolny/${rel}`)) {
        readsSeen.add(fileNodeId)
        links.push({ source: pid, target: fileNodeId, kind: 'reads' })
        readsLinks++
      }
    }
  }

  // --- 5. Notatki uzytkownika + hub 'notatki'; powiazanie z persona-zrodlem ---
  let noteCount = 0
  if (notatki.length > 0) {
    nodes.push({
      id: hubId('notatki'),
      kind: 'hub',
      label: groupLabel('notatki'),
      group: 'notatki',
      color: groupColor('notatki'),
      size: 11,
    })
    if (folderGroups.has('root')) {
      links.push({
        source: hubId('notatki'),
        target: hubId('root'),
        kind: 'backbone',
      })
    }
    for (const n of notatki) {
      const nid = `note:${n.id}`
      nodes.push({
        id: nid,
        kind: 'note',
        label: shortLabel(n.tytul, 20),
        group: 'notatki',
        color: groupColor('notatki'),
        size: 6,
      })
      links.push({ source: nid, target: hubId('notatki'), kind: 'hub' })
      noteCount++
      // Jesli zrodlo notatki wskazuje persone, dorzuc realna krawedz.
      for (const [name, pid] of personaIdByName) {
        if (n.zrodlo.includes(name)) {
          links.push({ source: nid, target: pid, kind: 'note' })
          break
        }
      }
    }
  }

  // --- 6. Grupy do legendy (tylko realnie obecne) ---
  const present = new Set(nodes.map((n) => n.group))
  const groups: GroupMeta[] = GROUP_RANK.filter((g) => present.has(g)).map(
    (g) => ({ key: g, label: groupLabel(g), color: groupColor(g) }),
  )

  const hubs = nodes.filter((n) => n.kind === 'hub').length

  return {
    nodes,
    links,
    groups,
    stats: {
      files: pliki.length,
      personas: agents.length,
      notes: noteCount,
      hubs,
      links: links.length,
      refLinks,
      readsLinks,
    },
  }
}

/**
 * Model grafu wiedzy ("mozg jako siec").
 * Buduje wezly i krawedzie z realnej tresci mozgu, person zespolu i notatek uzytkownika.
 * Pure: bez fizyki i bez DOM. Fizyke liczy komponent BrainGraph.tsx.
 */

import { getBrainFiles, getAgentPrompt, type BrainFile } from './content'
import { agents, getAgent } from '../data/agents'
import type { Notatka } from './storage'

export type NodeKind = 'file' | 'hub' | 'persona' | 'note' | 'encja'
export type LinkKind =
  | 'hub'
  | 'ref'
  | 'reads'
  | 'note'
  | 'backbone'
  | 'encja'

/** Klucz grupy globalnej pamieci firmy (spojny ze storage.GRUPA_PAMIEC_FIRMY). */
export const GRUPA_PAMIEC_FIRMY = 'pamiec-firmy'
/** Klucz grupy encji wyciagnietych z linkow [[...]] (osoby, firmy, tematy). */
export const GRUPA_ENCJE = 'encje'

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
  /** Pelna nazwa encji z linku [[...]] (label bywa skrocony do etykiety). */
  pelnaNazwa?: string
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
    /** Wezly-encje wyciagniete z linkow [[...]] (osoby, firmy, tematy). */
    encje: number
    /** Krawedzie plik -> encja. */
    encjaLinks: number
    /** Krawedzie plik -> plik zbudowane z linkow [[...]]. */
    wikiLinks: number
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
  briefingi: '#C084FC', // briefingi z narad zespolu
  transkrypcje: '#22D3EE', // pelne transkrypcje rozmow glosowych
  fakty: '#EAB308', // twarde fakty agentow (pamiec dlugotrwala)
  [GRUPA_PAMIEC_FIRMY]: '#5B8DEF', // wspolna pamiec calego zespolu (brand)
  [GRUPA_ENCJE]: '#F59E0B', // encje z linkow [[...]]: osoby, firmy, tematy
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
  briefingi: 'Briefingi z narad',
  transkrypcje: 'Transkrypcje rozmow',
  fakty: 'Twarde fakty (agentki)',
  [GRUPA_PAMIEC_FIRMY]: 'Pamiec firmy',
  [GRUPA_ENCJE]: 'Osoby i encje',
}

/** Kolejnosc grup w legendzie. */
const GROUP_RANK = [
  GRUPA_PAMIEC_FIRMY,
  'root',
  'tozsamosc',
  'rynek-klient',
  'oferta-komercja',
  'proof',
  'zespol-i-decyzje',
  'zespol',
  'fakty',
  GRUPA_ENCJE,
  'wlasne',
  'notatki',
  'briefingi',
  'transkrypcje',
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
  briefingi:
    'Zwiezle briefingi z narad zespolu: temat, ustalenia, decyzje i nastepne kroki, zapisane na koniec rozmowy.',
  transkrypcje:
    'Pelne zapisy wypowiedzi z rozmow glosowych. Obok streszczen pamieci, do dokladnego odtworzenia, co padlo i z kim.',
  fakty:
    'Zywy plik twardych faktow kazdej agentki: osoby, firmy, projekty, preferencje wlascicieli i trwale ustalenia. Pamiec dlugotrwala, scalana po kazdej rozmowie.',
  [GRUPA_PAMIEC_FIRMY]:
    'Jeden wspolny plik pamieci calego zespolu. To, co ustalisz z dowolna agentka, trafia tutaj, a stad do glowy kazdej z nich. Serce pamieci firmy, dlatego stoi w srodku grafu.',
  [GRUPA_ENCJE]:
    'Osoby, firmy i tematy wyciagniete z linkow [[...]] w plikach. Jedna encja spina kilka plikow naraz, wiec widac realne sieci powiazan, a nie same foldery.',
}

/** Slug agenta z klucza grupy pamieci 'pamiec-<slug>' (albo null). */
function slugZPamieci(key: string): string | null {
  // UWAGA: 'pamiec-firmy' to grupa WSPOLNEJ pamieci firmy, nie agentki o slugu
  // "firmy". Musi byc wykluczona, inaczej dostanie etykiete "Pamiec: firmy".
  if (key === GRUPA_PAMIEC_FIRMY) return null
  return key.startsWith('pamiec-') ? key.slice('pamiec-'.length) : null
}

export function groupColor(key: string): string {
  // Grupy pamieci dziedzicza kolor akcentu swojego agenta (wspolny fallback fiolet).
  const slug = slugZPamieci(key)
  if (slug) return getAgent(slug)?.accent ?? '#8B5CF6'
  return GROUP_COLOR[key] ?? '#71717A'
}

export function groupLabel(key: string): string {
  const slug = slugZPamieci(key)
  if (slug) {
    const a = getAgent(slug)
    return `Pamiec: ${a?.personImie ?? a?.name ?? slug}`
  }
  return GROUP_LABEL[key] ?? key
}

// --- Linki [[Nazwa]] (styl Obsidian): parsowanie i dopasowanie -------------

/**
 * Wyciaga nazwy z linkow [[Nazwa]] w tresci. Obsluguje alias [[Cel|tekst]]
 * (bierzemy CEL) i pomija puste nawiasy. Zwraca nazwy w kolejnosci wystapien.
 */
export function parsujLinkiWiki(tresc: string): string[] {
  const out: string[] = []
  const re = /\[\[([^[\]|]+?)(?:\|[^[\]]*)?\]\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tresc ?? '')) !== null) {
    const nazwa = m[1].trim()
    if (nazwa) out.push(nazwa)
  }
  return out
}

/**
 * Klucz porownania nazwy linku: male litery, bez polskich znakow, bez ".md",
 * separatory sciezki i spacje sprowadzone do "-". Dzieki temu [[Fakty firmy]],
 * [[fakty-firmy]] i [[pamiec-firmy/fakty-firmy.md]] trafiaja w ten sam plik.
 */
export function kluczLinku(nazwa: string): string {
  return (nazwa ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Tytul pliku z pierwszego naglowka "# ..." (albo null). */
function tytulH1(tresc: string): string | null {
  const m = (tresc ?? '').match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : null
}

/** Wszystkie klucze, pod ktorymi plik da sie trafic linkiem [[...]]. */
function kluczePliku(f: BrainFile): string[] {
  const klucze = [
    kluczLinku(f.name),
    kluczLinku(f.path),
    kluczLinku(relativePathOf(f.group, f.name)),
  ]
  const t = tytulH1(f.content)
  if (t) klucze.push(kluczLinku(t))
  return Array.from(new Set(klucze.filter(Boolean)))
}

/** Mapa klucz linku -> plik (pierwszy wygrywa, zeby wynik byl stabilny). */
function mapaPlikowPoKluczu(pliki: BrainFile[]): Map<string, BrainFile> {
  const map = new Map<string, BrainFile>()
  for (const f of pliki) {
    for (const k of kluczePliku(f)) if (!map.has(k)) map.set(k, f)
  }
  return map
}

/**
 * Dopasowanie linku do pliku: najpierw doslowne, potem (tylko dla linkow
 * wygladajacych na SCIEZKE) jednoznaczne dopasowanie po prefiksie. Agentki
 * pisza zrodla skrocone, np. [[transkrypcje/2026-07-20-lea-pawel]] przy pliku
 * transkrypcje/2026-07-20-lea-pawel-<id>.md. Prefiks stosujemy tylko wtedy,
 * gdy pasuje DOKLADNIE jeden plik, zeby nie sklejac przypadkowych par.
 */
function dopasujPlik(
  nazwa: string,
  mapa: Map<string, BrainFile>,
): BrainFile | undefined {
  const klucz = kluczLinku(nazwa)
  if (!klucz) return undefined
  const doslowne = mapa.get(klucz)
  if (doslowne) return doslowne
  const jakSciezka = nazwa.includes('/') || /\.md$/i.test(nazwa.trim())
  if (!jakSciezka) return undefined
  const kandydaci = new Set<BrainFile>()
  for (const [k, f] of mapa) {
    if (k.startsWith(`${klucz}-`)) kandydaci.add(f)
  }
  return kandydaci.size === 1 ? [...kandydaci][0] : undefined
}

/** Plik, na ktory wskazuje link [[Nazwa]], albo undefined (to encja). */
export function znajdzPlikLinku(
  nazwa: string,
  pliki: BrainFile[],
): BrainFile | undefined {
  return dopasujPlik(nazwa, mapaPlikowPoKluczu(pliki))
}

/** Pliki, w ktorych wystepuje link [[Nazwa]] (dowolny wariant zapisu). */
export function plikiZLinkiem(nazwa: string, pliki: BrainFile[]): BrainFile[] {
  const szukany = kluczLinku(nazwa)
  if (!szukany) return []
  return pliki.filter((f) =>
    parsujLinkiWiki(f.content).some((l) => kluczLinku(l) === szukany),
  )
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
      // Pamiec firmy jest wspolna dla calego zespolu: wyrozniona wielkoscia.
      color: groupColor(g),
      size: g === GRUPA_PAMIEC_FIRMY ? 17 : 12,
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
      // Plik pamieci firmy zawsze duzy: czyta go KAZDA agentka.
      size:
        f.group === GRUPA_PAMIEC_FIRMY
          ? Math.max(15, fileRadius(f.content.length))
          : fileRadius(f.content.length),
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

  // Plik globalnej pamieci firmy: KAZDA persona ma go w swoim prompcie (ai.ts
  // wstrzykuje go do buildSystemPrompt i buildVoicePrompt), wiec kazda dostaje
  // realna krawedz "czyta". To ona ustawia pamiec firmy w centrum grafu.
  const pamiecFirmyNode = nodes.find(
    (n) => n.kind === 'file' && n.group === GRUPA_PAMIEC_FIRMY,
  )

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

    if (pamiecFirmyNode) {
      links.push({ source: pid, target: pamiecFirmyNode.id, kind: 'reads' })
      readsLinks++
    }

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

  // --- 5b. Linki [[Nazwa]] w plikach wlasnych: plik->plik oraz plik->ENCJA ---
  // Pliki pisane przez agentki (pamiec, fakty, briefingi) trzymaja standard
  // zapisu z linkami [[...]]. Gdy nazwa trafia w inny plik, laczymy pliki.
  // Gdy nie trafia (np. [[Klaudiusz]]), powstaje wezel-ENCJA, ktory spina
  // wszystkie pliki mowiace o tej osobie, firmie albo temacie.
  const wlasnePliki = pliki.filter((f) => f.wlasny)
  const mapaKluczy = mapaPlikowPoKluczu(pliki)
  /** klucz encji -> { etykieta, id plikow, ktore o niej mowia }. */
  const encje = new Map<string, { label: string; pliki: Set<string> }>()
  const wikiSeen = new Set<string>() // unikalne relacje plik->plik z [[...]]
  const encjaSeen = new Set<string>() // dedup krawedzi plik->encja
  let wikiLinks = 0 // ile RELACJI plik->plik daja linki [[...]]
  let wikiNowe = 0 // ile z nich to NOWE krawedzie (reszta juz byla ze skanu tresci)
  let encjaLinks = 0

  for (const f of wlasnePliki) {
    const zId = `file:${f.path}`
    for (const nazwa of parsujLinkiWiki(f.content)) {
      const klucz = kluczLinku(nazwa)
      if (!klucz) continue
      const cel = dopasujPlik(nazwa, mapaKluczy)
      if (cel) {
        // Link do innego pliku (nie do samego siebie).
        if (cel.path === f.path) continue
        const celId = `file:${cel.path}`
        const para =
          zId < celId ? `${zId}|${celId}` : `${celId}|${zId}`
        if (!wikiSeen.has(para)) {
          wikiSeen.add(para)
          wikiLinks++
        }
        // Krawedz mogla juz powstac ze skanu tresci (krok 3): nie dublujemy.
        if (refSeen.has(para)) continue
        refSeen.add(para)
        links.push({ source: zId, target: celId, kind: 'ref' })
        wikiNowe++
        continue
      }
      // Encja: osoba, firma albo temat bez wlasnego pliku.
      const wpis = encje.get(klucz)
      if (wpis) wpis.pliki.add(zId)
      else encje.set(klucz, { label: nazwa, pliki: new Set([zId]) })
    }
  }

  for (const [klucz, wpis] of encje) {
    const eid = `encja:${klucz}`
    nodes.push({
      id: eid,
      kind: 'encja',
      label: shortLabel(wpis.label, 18),
      group: GRUPA_ENCJE,
      color: groupColor(GRUPA_ENCJE),
      pelnaNazwa: wpis.label,
      // Encja spinajaca wiecej plikow jest wieksza (widac wezly sieci).
      size: Math.min(9, 4.5 + wpis.pliki.size * 0.9),
    })
    for (const zId of wpis.pliki) {
      const para = `${zId}|${eid}`
      if (encjaSeen.has(para)) continue
      encjaSeen.add(para)
      links.push({ source: zId, target: eid, kind: 'encja' })
      encjaLinks++
    }
  }

  // --- 6. Grupy do legendy (tylko realnie obecne) ---
  const present = new Set(nodes.map((n) => n.group))
  const groups: GroupMeta[] = GROUP_RANK.filter((g) => present.has(g)).map(
    (g) => ({ key: g, label: groupLabel(g), color: groupColor(g) }),
  )
  // Dynamiczne grupy pamieci ('pamiec-<slug>') nie sa w GROUP_RANK: dopinamy je
  // do legendy z etykieta i kolorem agenta, gdy realnie wystepuja w grafie.
  for (const g of present) {
    if (g.startsWith('pamiec-') && !groups.some((x) => x.key === g)) {
      groups.push({ key: g, label: groupLabel(g), color: groupColor(g) })
    }
  }

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
      refLinks: refLinks + wikiNowe,
      readsLinks,
      encje: encje.size,
      encjaLinks,
      wikiLinks,
    },
  }
}

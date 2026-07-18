import { Link } from 'react-router-dom'
import {
  X,
  FileText,
  StickyNote,
  Users,
  BookOpen,
  ArrowRight,
  Download,
  Network,
} from 'lucide-react'
import {
  type BrainGraphModel,
  type GraphNode,
  GROUP_OPIS,
  groupLabel,
} from '../lib/brainGraph'
import type { BrainFile } from '../lib/content'
import { agents, getAgent } from '../data/agents'
import type { Notatka } from '../lib/storage'
import Avatar from './Avatar'
import MarkdownView from './MarkdownView'

interface Props {
  /** Wybrany wezel (podglad) lub null (stan pusty). */
  node: GraphNode | null
  model: BrainGraphModel
  notatki: Notatka[]
  /** Pliki mozgu przez warstwe nadpisow (nadpisy lokalne + wlasne pliki). */
  pliki: BrainFile[]
  /** Ustawia podglad na inny wezel (np. z listy w hubie). */
  onSelect: (node: GraphNode) => void
  /** Zamyka panel (X). */
  onClose: () => void
  /** Jawne przejscie do Bazy wiedzy z podgladem pliku. */
  onOpenFile: (path: string) => void
  /** Pobiera notatke jako .md. */
  onDownloadNote: (n: Notatka) => void
}

/** Ladniejsza nazwa pliku (bez podkreslnika/myslnikow technicznych). */
function prettyName(name: string): string {
  return name.replace(/^_/, '').replace(/-/g, ' ')
}

/** Pigulka koloru grupy z etykieta. */
function GrupaPill({ group }: { group: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium text-zinc-300"
      style={{ borderColor: '#3f3f46' }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: '#71717a' }}
        aria-hidden
      />
      {groupLabel(group)}
    </span>
  )
}

export default function GrafPanel({
  node,
  model,
  notatki,
  pliki,
  onSelect,
  onClose,
  onOpenFile,
  onDownloadNote,
}: Props) {
  // --- Stan pusty: podpowiedz zamiast pustego prostokata ---
  if (!node) {
    return (
      <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Network size={30} className="text-zinc-700" aria-hidden />
          <p className="text-sm leading-relaxed text-zinc-500">
            Kliknij wezel, aby zobaczyc szczegoly tutaj. Najedz, aby podswietlic
            sasiadow. Przeciagnij, aby ulozyc.
          </p>
        </div>
      </aside>
    )
  }

  // Wspolny naglowek panelu.
  let tytul = node.label
  let Ikona = FileText
  if (node.kind === 'hub') {
    tytul = groupLabel(node.group)
    Ikona = node.group === 'zespol' ? Users : node.group === 'notatki' ? StickyNote : Network
  } else if (node.kind === 'persona') {
    const slug = node.id.slice('persona:'.length)
    tytul = getAgent(slug)?.name ?? node.label
    Ikona = Users
  } else if (node.kind === 'note') {
    Ikona = StickyNote
  } else if (node.kind === 'file') {
    const f = pliki.find((x) => x.path === node.path)
    tytul = f ? prettyName(f.name) : node.label
    Ikona = FileText
  }

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50">
      {/* Naglowek */}
      <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-zinc-800 bg-zinc-900/80 px-5 py-3.5 backdrop-blur">
        <span
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: node.color }}
          aria-hidden
        />
        <Ikona size={15} className="flex-shrink-0 text-zinc-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-200">
          {tytul}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij podglad"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      {/* Tresc wg typu wezla */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {node.kind === 'file' && <TrescPliku node={node} pliki={pliki} />}
        {node.kind === 'persona' && <TrescPersony node={node} />}
        {node.kind === 'hub' && (
          <TrescHuba
            node={node}
            model={model}
            notatki={notatki}
            pliki={pliki}
            onSelect={onSelect}
          />
        )}
        {node.kind === 'note' && (
          <TrescNotatki
            node={node}
            notatki={notatki}
            onDownloadNote={onDownloadNote}
          />
        )}
      </div>

      {/* Stopka: akcje zalezne od typu */}
      {node.kind === 'file' && node.path && (
        <footer className="border-t border-zinc-800 p-3">
          <button
            type="button"
            onClick={() => node.path && onOpenFile(node.path)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition-colors hover:bg-brand-soft"
          >
            <BookOpen size={15} aria-hidden />
            Otworz w Bazie wiedzy
          </button>
        </footer>
      )}
    </aside>
  )
}

/** Podglad pliku mozgu w panelu (nie przenosi uzytkownika). */
function TrescPliku({ node, pliki }: { node: GraphNode; pliki: BrainFile[] }) {
  const f = pliki.find((x) => x.path === node.path)
  if (!f) {
    return <p className="text-sm text-zinc-500">Nie znaleziono pliku.</p>
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <GrupaPill group={f.group} />
        {f.zmieniony && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-amber-300">
            zmieniono lokalnie
          </span>
        )}
        {f.wlasny && (
          <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-teal-300">
            plik wlasny
          </span>
        )}
      </div>
      <MarkdownView>{f.content}</MarkdownView>
    </div>
  )
}

/** Karta persony: awatar, misja, subagenci, przycisk rozmowy. */
function TrescPersony({ node }: { node: GraphNode }) {
  const slug = node.id.slice('persona:'.length)
  const agent = getAgent(slug)
  if (!agent) {
    return <p className="text-sm text-zinc-500">Nie znaleziono persony.</p>
  }
  return (
    <div>
      <div className="flex items-center gap-3.5">
        <Avatar agent={agent} size="lg" aura="soft" glow />
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-50">
            {agent.name}
          </h3>
          <p
            className="mt-0.5 text-sm font-medium"
            style={{ color: agent.accent }}
          >
            {agent.role}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[0.95rem] leading-relaxed text-zinc-300">
        {agent.mission}
      </p>

      {agent.subagents.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Zespol wykonawczy
          </div>
          <div className="flex flex-wrap gap-1.5">
            {agent.subagents.map((sub) => (
              <span
                key={sub}
                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] text-zinc-300"
                style={{ borderColor: `${agent.accent}55` }}
              >
                {sub}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        to={`/czat/${agent.slug}`}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition-colors hover:bg-brand-soft"
      >
        Rozmawiaj
        <ArrowRight size={15} aria-hidden />
      </Link>
    </div>
  )
}

/** Opis grupy + lista jej elementow (klik = podglad w panelu). */
function TrescHuba({
  node,
  model,
  notatki,
  pliki,
  onSelect,
}: {
  node: GraphNode
  model: BrainGraphModel
  notatki: Notatka[]
  pliki: BrainFile[]
  onSelect: (node: GraphNode) => void
}) {
  const key = node.group
  const opis = GROUP_OPIS[key] ?? ''

  // Zbuduj liste elementow grupy z modelu (spojne id do podgladu).
  type Poz = { id: string; label: string; find: () => GraphNode | undefined }
  let pozycje: Poz[] = []
  let naglowekListy = 'Pliki w grupie'

  if (key === 'zespol') {
    naglowekListy = 'Persony'
    pozycje = agents.map((a) => ({
      id: `persona:${a.slug}`,
      label: a.name,
      find: () => model.nodes.find((n) => n.id === `persona:${a.slug}`),
    }))
  } else if (key === 'notatki') {
    naglowekListy = 'Notatki'
    pozycje = notatki.map((n) => ({
      id: `note:${n.id}`,
      label: n.tytul,
      find: () => model.nodes.find((x) => x.id === `note:${n.id}`),
    }))
  } else {
    pozycje = pliki
      .filter((f) => f.group === key)
      .map((f) => ({
        id: `file:${f.path}`,
        label: prettyName(f.name),
        find: () => model.nodes.find((n) => n.id === `file:${f.path}`),
      }))
  }

  return (
    <div>
      <p className="text-[0.95rem] leading-relaxed text-zinc-300">{opis}</p>

      <div className="mt-5 mb-2 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {naglowekListy}
        <span className="rounded-full bg-zinc-800/80 px-1.5 py-px text-[0.65rem] font-medium tabular-nums text-zinc-400">
          {pozycje.length}
        </span>
      </div>

      {pozycje.length === 0 ? (
        <p className="text-sm text-zinc-500">Brak elementow w tej grupie.</p>
      ) : (
        <div className="space-y-0.5">
          {pozycje.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                const n = p.find()
                if (n) onSelect(n)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100"
            >
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: node.color }}
                aria-hidden
              />
              <span className="truncate capitalize">{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Podglad notatki uzytkownika. */
function TrescNotatki({
  node,
  notatki,
  onDownloadNote,
}: {
  node: GraphNode
  notatki: Notatka[]
  onDownloadNote: (n: Notatka) => void
}) {
  const id = node.id.slice('note:'.length)
  const n = notatki.find((x) => x.id === id)
  if (!n) {
    return <p className="text-sm text-zinc-500">Nie znaleziono notatki.</p>
  }
  return (
    <div>
      <p className="mb-4 text-xs text-zinc-500">{n.zrodlo}</p>
      <MarkdownView>{n.tresc}</MarkdownView>
      <button
        type="button"
        onClick={() => onDownloadNote(n)}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
      >
        <Download size={14} aria-hidden />
        Pobierz .md
      </button>
    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  FileText,
  Brain as BrainIcon,
  StickyNote,
  Trash2,
  Download,
  Share2,
} from 'lucide-react'
import {
  brainFiles,
  brainGroupOrder,
  type BrainFile,
} from '../lib/content'
import {
  wczytajNotatki,
  usunNotatke,
  type Notatka,
} from '../lib/storage'
import MarkdownView from '../components/MarkdownView'
import BrainGraph from '../components/BrainGraph'
import { buildBrainGraph } from '../lib/brainGraph'

/** Ladniejsza nazwa pliku do listy. */
function prettyName(name: string): string {
  return name.replace(/^_/, '').replace(/-/g, ' ')
}

/** Czytelna data notatki. */
function formatujDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Pobiera notatke jako plik .md. */
function pobierzNotatke(n: Notatka) {
  const md = [
    `# ${n.tytul}`,
    '',
    `Zrodlo: ${n.zrodlo}`,
    `Data: ${formatujDate(n.data)}`,
    '',
    n.tresc,
    '',
  ].join('\n')
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `notatka-${n.id}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

type Widok = 'baza' | 'notatki' | 'graf'

export default function Brain() {
  const [widok, setWidok] = useState<Widok>('baza')
  const [activePath, setActivePath] = useState<string>(
    brainFiles[0]?.path ?? '',
  )
  const [notatki, setNotatki] = useState<Notatka[]>(() => wczytajNotatki())
  const [aktywnaNotatkaId, setAktywnaNotatkaId] = useState<string>('')

  const grouped = useMemo(() => {
    const map = new Map<string, BrainFile[]>()
    for (const f of brainFiles) {
      const arr = map.get(f.group) ?? []
      arr.push(f)
      map.set(f.group, arr)
    }
    // grupy wg kolejnosci, reszta na koniec
    const ordered: { key: string; label: string; files: BrainFile[] }[] = []
    for (const g of brainGroupOrder) {
      const files = map.get(g.key)
      if (files && files.length) {
        ordered.push({ key: g.key, label: g.label, files })
        map.delete(g.key)
      }
    }
    for (const [key, files] of map) {
      ordered.push({ key, label: key, files })
    }
    return ordered
  }, [])

  // Statystyki grafu (liczba wezlow / powiazan) do naglowka zakladki Graf.
  const grafStats = useMemo(() => buildBrainGraph(notatki).stats, [notatki])

  function otworzPlikZGrafu(path: string) {
    setActivePath(path)
    setWidok('baza')
  }

  const active = brainFiles.find((f) => f.path === activePath)
  const aktywnaNotatka =
    notatki.find((n) => n.id === aktywnaNotatkaId) ?? notatki[0]

  function otworzNotatki() {
    setNotatki(wczytajNotatki())
    setWidok('notatki')
  }

  function usunZNotatek(id: string) {
    usunNotatke(id)
    const nast = wczytajNotatki()
    setNotatki(nast)
    if (id === aktywnaNotatka?.id) {
      setAktywnaNotatkaId(nast[0]?.id ?? '')
    }
  }

  const zakladka = (aktywna: boolean) =>
    [
      'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
      aktywna
        ? 'bg-brand/10 text-white ring-1 ring-brand/30'
        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
    ].join(' ')

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col">
      <header className="px-5 py-6 sm:px-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <BrainIcon size={12} className="text-brand-soft" />
          Wspolna wiedza
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-3xl">
          Mozg firmy
        </h1>
        <p className="mt-2 max-w-2xl text-[0.975rem] leading-relaxed text-zinc-400">
          Wspolna baza wiedzy. To samo zrodlo prawdy, ktore czyta kazdy agent
          przed odpowiedzia.
        </p>

        {/* Zakladki: baza wiedzy / notatki */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWidok('baza')}
            className={zakladka(widok === 'baza')}
          >
            <FileText size={15} aria-hidden />
            Baza wiedzy
          </button>
          <button
            type="button"
            onClick={otworzNotatki}
            className={zakladka(widok === 'notatki')}
          >
            <StickyNote size={15} aria-hidden />
            Notatki
            <span className="rounded-full bg-zinc-800/80 px-1.5 py-px text-[0.65rem] font-medium tabular-nums text-zinc-400">
              {notatki.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setWidok('graf')}
            className={zakladka(widok === 'graf')}
          >
            <Share2 size={15} aria-hidden />
            Graf
          </button>
        </div>
      </header>

      {widok === 'baza' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 px-5 pb-10 sm:px-8 lg:grid-cols-[280px_1fr]">
          {/* Lista plikow */}
          <nav className="lg:overflow-y-auto lg:pr-1">
            <div className="space-y-5">
              {grouped.map((group) => (
                <div key={group.key}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      {group.label}
                    </span>
                    <span className="rounded-full bg-zinc-800/80 px-1.5 py-px text-[0.65rem] font-medium tabular-nums text-zinc-500">
                      {group.files.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {group.files.map((f) => {
                      const isActive = f.path === activePath
                      return (
                        <button
                          key={f.path}
                          onClick={() => setActivePath(f.path)}
                          className={[
                            'relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150',
                            isActive
                              ? 'bg-brand/10 text-white ring-1 ring-brand/30'
                              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
                          ].join(' ')}
                        >
                          {isActive && (
                            <span
                              className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
                              aria-hidden
                            />
                          )}
                          <FileText
                            size={15}
                            className={
                              isActive ? 'text-brand-soft' : 'text-zinc-600'
                            }
                          />
                          <span className="truncate capitalize">
                            {prettyName(f.name)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* Podglad markdown */}
          <article className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 lg:overflow-y-auto">
            {active ? (
              <>
                <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-zinc-800 bg-zinc-900/80 px-6 py-3.5 backdrop-blur sm:px-8">
                  <FileText size={15} className="flex-shrink-0 text-brand-soft" />
                  <span className="truncate text-sm font-semibold capitalize text-zinc-200">
                    {prettyName(active.name)}
                  </span>
                </div>
                <div className="p-6 sm:p-8">
                  <MarkdownView>{active.content}</MarkdownView>
                </div>
              </>
            ) : (
              <p className="p-6 text-zinc-500 sm:p-8">
                Wybierz dokument z listy.
              </p>
            )}
          </article>
        </div>
      ) : widok === 'notatki' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 px-5 pb-10 sm:px-8 lg:grid-cols-[320px_1fr]">
          {/* Lista notatek */}
          <nav className="lg:overflow-y-auto lg:pr-1">
            {notatki.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm leading-relaxed text-zinc-400">
                Brak notatek. Uzyj przycisku "Zapisz do pamięci" w czacie z
                agentem albo w Centrum Dowodzenia, a notatka pojawi sie tutaj.
              </div>
            ) : (
              <div className="space-y-1.5">
                {notatki.map((n) => {
                  const isActive = n.id === aktywnaNotatka?.id
                  return (
                    <div key={n.id} className="flex items-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAktywnaNotatkaId(n.id)}
                        className={[
                          'flex min-w-0 flex-1 flex-col rounded-xl px-3 py-2.5 text-left transition-colors',
                          isActive
                            ? 'bg-brand/10 ring-1 ring-brand/30'
                            : 'hover:bg-zinc-900',
                        ].join(' ')}
                      >
                        <span className="truncate text-sm font-medium text-zinc-200">
                          {n.tytul}
                        </span>
                        <span className="mt-0.5 text-[0.7rem] text-zinc-500">
                          {n.zrodlo}, {formatujDate(n.data)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => usunZNotatek(n.id)}
                        aria-label={`Usun notatke: ${n.tytul}`}
                        className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </nav>

          {/* Podglad notatki */}
          <article className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 lg:overflow-y-auto">
            {aktywnaNotatka ? (
              <>
                <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-zinc-800 bg-zinc-900/80 px-6 py-3.5 backdrop-blur sm:px-8">
                  <StickyNote
                    size={15}
                    className="flex-shrink-0 text-brand-soft"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-200">
                    {aktywnaNotatka.tytul}
                  </span>
                  <button
                    type="button"
                    onClick={() => pobierzNotatke(aktywnaNotatka)}
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                  >
                    <Download size={14} aria-hidden />
                    Pobierz .md
                  </button>
                </div>
                <div className="p-6 sm:p-8">
                  <p className="mb-4 text-xs text-zinc-500">
                    {aktywnaNotatka.zrodlo}, zapisano{' '}
                    {formatujDate(aktywnaNotatka.data)}
                  </p>
                  <MarkdownView>{aktywnaNotatka.tresc}</MarkdownView>
                </div>
              </>
            ) : (
              <p className="p-6 text-zinc-500 sm:p-8">
                Wybierz notatke z listy.
              </p>
            )}
          </article>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-5 pb-8 sm:px-8">
          {/* Licznik wezlow i powiazan */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>
              <span className="font-semibold tabular-nums text-zinc-300">
                {grafStats.files +
                  grafStats.personas +
                  grafStats.notes +
                  grafStats.hubs}
              </span>{' '}
              wezlow
            </span>
            <span>
              <span className="font-semibold tabular-nums text-zinc-300">
                {grafStats.links}
              </span>{' '}
              powiazan
            </span>
            <span className="text-zinc-600">
              {grafStats.files} plikow, {grafStats.personas} person,{' '}
              {grafStats.notes} notatek, {grafStats.readsLinks} relacji "czyta",{' '}
              {grafStats.refLinks} odwolan miedzy plikami
            </span>
            <span className="ml-auto hidden text-zinc-600 sm:inline">
              Najedz, aby podswietlic sasiadow. Kliknij plik, aby otworzyc
              podglad. Przeciagnij wezel, aby ulozyc.
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <BrainGraph notatki={notatki} onOpenFile={otworzPlikZGrafu} />
          </div>
        </div>
      )}
    </div>
  )
}

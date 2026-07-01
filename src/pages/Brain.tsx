import { useMemo, useState } from 'react'
import { FileText, Brain as BrainIcon } from 'lucide-react'
import {
  brainFiles,
  brainGroupOrder,
  type BrainFile,
} from '../lib/content'
import MarkdownView from '../components/MarkdownView'

/** Ladniejsza nazwa pliku do listy. */
function prettyName(name: string): string {
  return name.replace(/^_/, '').replace(/-/g, ' ')
}

export default function Brain() {
  const [activePath, setActivePath] = useState<string>(
    brainFiles[0]?.path ?? '',
  )

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

  const active = brainFiles.find((f) => f.path === activePath)

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
      </header>

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
            <p className="p-6 text-zinc-500 sm:p-8">Wybierz dokument z listy.</p>
          )}
        </article>
      </div>
    </div>
  )
}

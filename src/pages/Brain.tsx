import { useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          Mozg firmy
        </h1>
        <p className="mt-1 text-zinc-400">
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
                <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.files.map((f) => {
                    const isActive = f.path === activePath
                    return (
                      <button
                        key={f.path}
                        onClick={() => setActivePath(f.path)}
                        className={[
                          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          isActive
                            ? 'bg-brand/10 text-white ring-1 ring-brand/30'
                            : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
                        ].join(' ')}
                      >
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
        <article className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 lg:overflow-y-auto">
          {active ? (
            <MarkdownView>{active.content}</MarkdownView>
          ) : (
            <p className="text-zinc-500">Wybierz dokument z listy.</p>
          )}
        </article>
      </div>
    </div>
  )
}

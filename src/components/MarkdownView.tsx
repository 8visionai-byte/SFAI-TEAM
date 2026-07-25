import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewProps {
  children: string
  className?: string
  /**
   * Klik w link [[Nazwa]] (styl Obsidian). Gdy podany, linki renderuja sie jako
   * klikalne pigulki; bez niego jako zwykle, nieklikalne pigulki.
   */
  onEncja?: (nazwa: string) => void
}

/** Prefiks href dla linkow [[...]]. Hash przechodzi domyslny sanitizer URL. */
const PREFIKS_ENCJI = '#sfencja-'

/**
 * Zamienia linki [[Nazwa]] i [[Cel|tekst]] na zwykle linki markdown
 * "[tekst](#sfencja-<Cel>)", zeby ReactMarkdown wyrenderowal je jako element,
 * ktory mozemy przechwycic w komponencie "a". Fragmenty kodu (``` i `...`)
 * zostaja nietkniete, zeby nie psuc przykladow skladni w tresci.
 */
function zamienLinkiWiki(tresc: string): string {
  const czesci = (tresc ?? '').split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  return czesci
    .map((czesc, i) => {
      // Nieparzyste indeksy to zlapane fragmenty kodu: zostawiamy bez zmian.
      if (i % 2 === 1) return czesc
      return czesc.replace(
        /\[\[([^[\]|]+?)(?:\|([^[\]]*))?\]\]/g,
        (dopasowanie, cel: string, alias?: string) => {
          const nazwa = cel.trim()
          if (!nazwa) return dopasowanie
          const etykieta = (alias ?? '').trim() || nazwa
          // Nawiasy w etykiecie zepsulyby skladnie linku markdown.
          const bezpieczna = etykieta.replace(/[[\]]/g, '')
          return `[${bezpieczna}](${PREFIKS_ENCJI}${encodeURIComponent(nazwa)})`
        },
      )
    })
    .join('')
}

/** Nazwa encji z href "#sfencja-..." albo null, gdy to zwykly link. */
function nazwaZHref(href: string | undefined): string | null {
  if (!href || !href.startsWith(PREFIKS_ENCJI)) return null
  try {
    return decodeURIComponent(href.slice(PREFIKS_ENCJI.length))
  } catch {
    return href.slice(PREFIKS_ENCJI.length)
  }
}

const pigulkaEncji =
  'mx-0.5 inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-px align-baseline text-[0.85em] font-medium text-amber-200'

/** Renderuje markdown ostylowany dla ciemnego tla (GFM: tabele, listy zadan). */
export default function MarkdownView({
  children,
  className = '',
  onEncja,
}: MarkdownViewProps) {
  return (
    <div className={`md-view text-zinc-200 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 text-2xl font-bold text-zinc-50 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-2.5 text-xl font-semibold text-zinc-100 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-2 text-base font-semibold text-zinc-100">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-4 mb-1.5 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-3 text-[0.95rem] text-zinc-300">{children}</p>
          ),
          a: ({ children, href }) => {
            const encja = nazwaZHref(href)
            if (encja !== null) {
              if (!onEncja) {
                return <span className={pigulkaEncji}>{children}</span>
              }
              return (
                <button
                  type="button"
                  onClick={() => onEncja(encja)}
                  title={`Pokaz powiazania: ${encja}`}
                  className={`${pigulkaEncji} transition-colors hover:border-amber-400/70 hover:bg-amber-500/20 hover:text-amber-100`}
                >
                  {children}
                </button>
              )
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
              >
                {children}
              </a>
            )
          },
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-100">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="my-3 ml-5 list-disc space-y-1.5 text-[0.95rem] text-zinc-300 marker:text-zinc-600">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-5 list-decimal space-y-1.5 text-[0.95rem] text-zinc-300 marker:text-zinc-500">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-brand/60 bg-zinc-900/60 py-1 pl-4 pr-3 text-zinc-400 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-zinc-800" />,
          code: ({ className, children }) => {
            const isBlock = (className ?? '').includes('language-')
            if (isBlock) {
              return (
                <code className="block whitespace-pre-wrap break-words font-mono text-[0.82rem] text-zinc-200">
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.82em] text-brand-soft">
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-900">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-zinc-800 px-3 py-2 text-left font-semibold text-zinc-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-zinc-800/70 px-3 py-2 align-top text-zinc-300">
              {children}
            </td>
          ),
        }}
      >
        {zamienLinkiWiki(children)}
      </ReactMarkdown>
    </div>
  )
}

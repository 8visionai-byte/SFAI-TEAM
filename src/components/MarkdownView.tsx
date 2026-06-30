import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewProps {
  children: string
  className?: string
}

/** Renderuje markdown ostylowany dla ciemnego tla (GFM: tabele, listy zadan). */
export default function MarkdownView({
  children,
  className = '',
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
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
            >
              {children}
            </a>
          ),
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
        {children}
      </ReactMarkdown>
    </div>
  )
}

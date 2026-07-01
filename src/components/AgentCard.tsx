import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Agent } from '../data/agents'

interface AgentCardProps {
  agent: Agent
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Kafelek agenta w siatce zespolu. Akcent koloru per agent. */
export default function AgentCard({ agent }: AgentCardProps) {
  const active = agent.hasPrompt

  return (
    <Link
      to={`/czat/${agent.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-900 hover:shadow-card-hover focus-visible:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* Akcentowa hairline u gory, podswietla sie na hover */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-70"
        style={{
          background: `linear-gradient(90deg, transparent, ${agent.accent}, transparent)`,
        }}
        aria-hidden
      />
      {/* Akcentowy pasek po lewej, podswietla sie na hover */}
      <span
        className="pointer-events-none absolute inset-y-4 left-0 w-[3px] rounded-r-full opacity-60 transition-all duration-200 group-hover:inset-y-0 group-hover:opacity-100"
        style={{ backgroundColor: agent.accent }}
        aria-hidden
      />
      {/* Subtelny poblysk akcentu w rogu na hover */}
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ backgroundColor: agent.accent }}
        aria-hidden
      />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none"
          style={{
            background: `linear-gradient(135deg, ${agent.accent}2e, ${agent.accent}12)`,
            color: agent.accent,
            boxShadow: `inset 0 0 0 1px ${agent.accent}55`,
          }}
          aria-hidden
        >
          {initials(agent.name)}
        </div>

        <span
          className={[
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium',
            active
              ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25'
              : 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700',
          ].join(' ')}
        >
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              active ? 'bg-emerald-400' : 'bg-zinc-500',
            ].join(' ')}
            aria-hidden
          />
          {active ? 'Aktywny' : 'Wkrotce'}
        </span>
      </div>

      <div className="mb-1.5 inline-flex w-fit items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-600">
        <span
          className="h-1 w-1 rounded-full"
          style={{ backgroundColor: agent.accent }}
          aria-hidden
        />
        Kafelek {agent.tileNo}
      </div>
      <h3 className="text-base font-semibold leading-snug text-zinc-50">
        {agent.name}
      </h3>
      <p
        className="mt-1 text-sm font-medium"
        style={{ color: agent.accent }}
      >
        {agent.role}
      </p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">
        {agent.mission}
      </p>

      <div
        className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-zinc-400 transition-colors group-hover:text-zinc-100"
        style={{ ['--acc' as string]: agent.accent }}
      >
        <span className="transition-colors group-hover:[color:var(--acc)]">
          Rozmawiaj
        </span>
        <ArrowRight
          size={16}
          className="transition-transform duration-200 group-hover:translate-x-1 group-hover:[color:var(--acc)] motion-reduce:transform-none"
        />
      </div>
    </Link>
  )
}

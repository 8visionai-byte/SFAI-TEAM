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
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-900 hover:shadow-card-hover focus-visible:-translate-y-1"
    >
      {/* Akcentowy pasek po lewej, podswietla sie na hover */}
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] opacity-70 transition-opacity duration-200 group-hover:opacity-100"
        style={{ backgroundColor: agent.accent }}
        aria-hidden
      />
      {/* Subtelny poblysk akcentu w rogu na hover */}
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-20"
        style={{ backgroundColor: agent.accent }}
        aria-hidden
      />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1"
          style={{
            backgroundColor: agent.accent + '1f',
            color: agent.accent,
            borderColor: 'transparent',
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

      <div className="mb-1 text-[0.7rem] font-medium uppercase tracking-wider text-zinc-600">
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

      <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors group-hover:text-zinc-100">
        Rozmawiaj
        <ArrowRight
          size={16}
          className="transition-transform duration-200 group-hover:translate-x-1"
        />
      </div>
    </Link>
  )
}

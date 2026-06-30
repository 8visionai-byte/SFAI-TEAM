import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Agent } from '../data/agents'

interface AgentCardProps {
  agent: Agent
}

/** Kafelek agenta w siatce zespolu. */
export default function AgentCard({ agent }: AgentCardProps) {
  const active = agent.hasPrompt

  return (
    <Link
      to={`/czat/${agent.slug}`}
      className="group relative flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900"
      style={{ borderTopColor: agent.accent + '66' }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 rounded-full ring-4"
            style={{
              backgroundColor: agent.accent,
              boxShadow: `0 0 12px ${agent.accent}99`,
            }}
            aria-hidden
          />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Kafelek {agent.tileNo}
          </span>
        </div>
        <span
          className={[
            'rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium',
            active
              ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
              : 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700',
          ].join(' ')}
        >
          {active ? 'Aktywny' : 'Wkrotce'}
        </span>
      </div>

      <h3 className="text-base font-semibold text-zinc-100">{agent.name}</h3>
      <p className="mt-0.5 text-sm font-medium" style={{ color: agent.accent }}>
        {agent.role}
      </p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">
        {agent.mission}
      </p>

      <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition-colors group-hover:text-white">
        Rozmawiaj
        <ArrowRight
          size={16}
          className="transition-transform group-hover:translate-x-1"
        />
      </div>
    </Link>
  )
}

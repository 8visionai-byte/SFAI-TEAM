import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { coo, teamAgents } from '../data/agents'
import AgentCard from '../components/AgentCard'

export default function Team() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          Twoj zespol AI
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Dziewieciu agentow SimpleFast.ai. Powiedz COO swoj cel, on rozlozy go
          na zadania i deleguje do reszty zespolu. Albo wejdz wprost do
          konkretnego specjalisty.
        </p>
      </header>

      {/* COO, wyrozniona szeroka karta */}
      <Link
        to={`/czat/${coo.slug}`}
        className="group relative mb-10 block overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/15 via-zinc-900 to-zinc-900 p-6 transition-all duration-200 hover:border-brand/50 sm:p-8"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: coo.accent }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand-soft ring-1 ring-brand/30">
                <Sparkles size={13} />
                Orkiestrator
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Warstwa nad zespolem
              </span>
            </div>
            <h2 className="text-2xl font-bold text-zinc-50">{coo.name}</h2>
            <p className="mt-1 text-sm font-medium text-brand-soft">
              {coo.role}
            </p>
            <p className="mt-3 text-zinc-300">{coo.mission}</p>
          </div>
          <div className="flex flex-shrink-0">
            <span className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform group-hover:translate-x-1">
              Porozmawiaj z COO
              <ArrowRight size={17} />
            </span>
          </div>
        </div>
      </Link>

      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Specjalisci
        </h2>
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-xs text-zinc-600">8 kafelkow</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teamAgents.map((agent) => (
          <AgentCard key={agent.slug} agent={agent} />
        ))}
      </div>
    </div>
  )
}

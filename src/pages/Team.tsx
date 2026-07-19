import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { coo, teamAgents } from '../data/agents'
import AgentCard from '../components/AgentCard'
import Avatar from '../components/Avatar'

export default function Team() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <header className="mb-8 animate-fade-up">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          Centrum Dowodzenia
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-4xl">
          Twoj zespol AI
        </h1>
        <p className="mt-3 max-w-2xl text-[0.975rem] leading-relaxed text-zinc-400">
          Dziesieciu agentow SimpleFast.ai. Powiedz COO swoj cel, on rozlozy go
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
          {/* Portret COO z aura (zdjecie-first, wiekszy niz kafelki specjalistow) */}
          <Avatar agent={coo} size="2xl" aura="strong" profile className="mx-auto flex-shrink-0 sm:mx-0" />
          <div className="max-w-2xl sm:flex-1">
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
            <span className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition-all group-hover:translate-x-1 group-hover:bg-brand-soft motion-reduce:group-hover:translate-x-0">
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
        <span className="text-xs text-zinc-600">9 kafelkow</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {teamAgents.map((agent, i) => (
          <div
            key={agent.slug}
            className="animate-fade-up"
            style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
          >
            <AgentCard agent={agent} />
          </div>
        ))}
      </div>
    </div>
  )
}

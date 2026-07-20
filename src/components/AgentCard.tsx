import { Link } from 'react-router-dom'
import { ArrowRight, Mic } from 'lucide-react'
import Avatar from './Avatar'
import type { Agent } from '../data/agents'

interface AgentCardProps {
  agent: Agent
  /** Akcja "porozmawiaj glosem" (ikona mikrofonu). Gdy brak, przycisku nie ma. */
  onGlos?: (agent: Agent) => void
}

/**
 * Kafelek agenta w galerii zespolu: PORTRET na pierwszym planie, pod nim nazwa,
 * a rola najmniejszym wygaszonym tekstem. Akcent koloru per agent.
 * Klik w karte otwiera PROFIL agenta (/agent/slug), a przycisk "Rozmawiaj"
 * prowadzi wprost do czatu. Rozwiazane wzorcem rozciagnietego linku (link-nakladka),
 * zeby nie zagniezdzac <a> w <a>.
 */
export default function AgentCard({ agent, onGlos }: AgentCardProps) {
  const active = agent.hasPrompt

  return (
    <div className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 px-3 pb-5 pt-7 text-center shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-900 hover:shadow-card-hover focus-within:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:px-5 sm:pb-6">
      {/* Link-nakladka: cala karta prowadzi do profilu agenta */}
      <Link
        to={`/agent/${agent.slug}`}
        aria-label={`Profil agenta ${agent.name}`}
        className="absolute inset-0 z-10 rounded-2xl"
      />
      {/* Stala aura odcienia agenta (radial od gory za portretem), mocniejsza na hover */}
      <span
        className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120% 70% at 50% 0%, ${agent.accent}18, transparent 62%)`,
        }}
        aria-hidden
      />
      {/* Akcentowa hairline u gory, podswietla sie na hover */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-70"
        style={{
          background: `linear-gradient(90deg, transparent, ${agent.accent}, transparent)`,
        }}
        aria-hidden
      />

      {/* Dyskretny status w rogu */}
      <span
        className={[
          'absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.62rem] font-medium',
          active
            ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25'
            : 'bg-zinc-800/80 text-zinc-400 ring-1 ring-zinc-700',
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

      {/* Akcja glosu: mikrofon w rogu (osobna od kliku w karte i "Rozmawiaj") */}
      {onGlos && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onGlos(agent)
          }}
          aria-label={`Porozmawiaj glosem z agentem ${agent.name}`}
          title="Porozmawiaj glosem"
          className="absolute left-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/70 text-zinc-300 transition-colors hover:border-brand/50 hover:text-brand-soft"
        >
          <Mic size={15} aria-hidden />
        </button>
      )}

      {/* PORTRET dominuje: duzy, wysrodkowany, aura koloru, hover wideo/lift */}
      <Avatar
        agent={agent}
        size="2xl"
        aura="soft"
        hover
        className="relative !h-28 !w-28 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.03] motion-reduce:transform-none sm:!h-36 sm:!w-36 lg:!h-40 lg:!w-40"
      />

      {/* NAZWA agenta (wyrazna) */}
      <h3 className="mt-4 text-base font-semibold leading-snug text-zinc-50">
        {agent.name}
      </h3>
      {/* ROLA najmniejszym, wygaszonym tekstem */}
      <p className="mt-1 text-xs text-zinc-400">{agent.role}</p>

      {/* Przycisk "Rozmawiaj": nad linkiem-nakladka, prowadzi wprost do czatu */}
      <Link
        to={`/czat/${agent.slug}`}
        aria-label={`Rozmawiaj z agentem ${agent.name}`}
        className="relative z-20 mt-4 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-400 transition-colors hover:text-zinc-100 group-hover:text-zinc-100"
        style={{ ['--acc' as string]: agent.accent }}
      >
        <span className="transition-colors group-hover:[color:var(--acc)]">
          Rozmawiaj
        </span>
        <ArrowRight
          size={16}
          className="transition-transform duration-200 group-hover:translate-x-1 group-hover:[color:var(--acc)] motion-reduce:transform-none"
        />
      </Link>
    </div>
  )
}

import { useState } from 'react'
import type { Agent } from '../data/agents'

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

/** Rozmiary zgodne z obecnym UI (sm: wiadomosc, md: wezly mapy, lg: naglowek i kafelek, xl: hero). */
const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 rounded-lg text-xs',
  md: 'h-10 w-10 rounded-xl text-xs',
  lg: 'h-11 w-11 rounded-xl text-sm',
  xl: 'h-16 w-16 rounded-2xl text-base',
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    // Krotkie akronimy (np. COO) pokazujemy w calosci
    if (words[0].length <= 3) return words[0].toUpperCase()
    return words[0].slice(0, 2).toUpperCase()
  }
  return (words[0][0] + words[1][0]).toUpperCase()
}

interface AvatarProps {
  agent: Agent
  size?: AvatarSize
  /** Agent wlasnie pracuje: subtelny "oddech" (puls poswiaty). */
  working?: boolean
  /** Poswiata akcentu pod kaflem (np. naglowek czatu). */
  glow?: boolean
  /** Dodatkowe klasy (np. node-pulse w Centrum Dowodzenia). */
  className?: string
}

/**
 * Awatar agenta. Probuje obrazka /avatars/<slug>.png (webapp/public/avatars/).
 * Gdy pliku nie ma, pokazuje dotychczasowy kafelek inicjalow na tle akcentu,
 * wiec brak grafik niczego nie psuje. Obrazek pojawia sie plynnie po zaladowaniu.
 */
export default function Avatar({
  agent,
  size = 'md',
  working = false,
  glow = false,
  className = '',
}: AvatarProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div
      className={[
        'relative flex flex-shrink-0 select-none items-center justify-center overflow-hidden font-bold ring-1 ring-white/10',
        SIZE_CLASSES[size],
        working ? 'avatar-breath' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        background: `linear-gradient(135deg, ${agent.accent}2e, ${agent.accent}12)`,
        color: agent.accent,
        boxShadow: glow ? `0 6px 18px -6px ${agent.accent}80` : undefined,
        ['--glow' as string]: `${agent.accent}88`,
      }}
      aria-hidden
    >
      {/* Fallback: inicjaly rysowane zawsze pod obrazkiem (zero skoku layoutu) */}
      <span aria-hidden>{initials(agent.name)}</span>
      {!failed && (
        <img
          src={`${import.meta.env.BASE_URL}avatars/${agent.slug}.png`}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={[
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
            loaded ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
      )}
    </div>
  )
}

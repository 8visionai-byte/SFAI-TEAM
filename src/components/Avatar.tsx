import { useRef, useState } from 'react'
import type { Agent } from '../data/agents'
import CharacterAvatar from './CharacterAvatar'

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/** Realny rozmiar w px per rozmiar UI (steruje bramka detali w portrecie). */
const SIZE_PX: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 96,
  '2xl': 160,
}

/** Rozmiary zgodne z obecnym UI (sm: wiadomosc, md: wezly mapy, lg: naglowek, xl: hero, 2xl: portret-first na kafelku i w hero profilu, 160px). */
const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 rounded-lg text-xs',
  md: 'h-10 w-10 rounded-xl text-xs',
  lg: 'h-12 w-12 rounded-xl text-sm',
  xl: 'h-24 w-24 rounded-[22px] text-xl',
  '2xl': 'h-40 w-40 rounded-[28px] text-2xl',
}

/** Hairline tla rozdzielajacy portret od pierscienia-aury (jak w scenie neuronu). */
const HAIRLINE = '#0E0E11'

/** Czy urzadzenie potrafi hover (mysz). Na dotyku steruje tapniecie. */
function canHover(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover)').matches
  )
}

/** Czy uzytkownik prosi o ograniczona animacje. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
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
  /**
   * Pierscien-aura w odcieniu agenta (spojny z tokenami sceny neuronu, 2.2):
   * 'soft' = cienki wygaszony ring (kafelki, naglowki), 'strong' = podwojny
   * ring z poswiata (hero profilu).
   */
  aura?: 'soft' | 'strong'
  /** Animacja po najechaniu: uniesienie + poswiata w kolorze agenta. */
  hover?: boolean
  /**
   * Hero profilu (nie lista). Na urzadzeniach dotykowych wideo odtwarza sie
   * dopiero po tapnieciu i tylko gdy true, zeby listy nie odgrywaly klipow.
   */
  profile?: boolean
  /** Dodatkowe klasy (np. node-pulse w Centrum Dowodzenia). */
  className?: string
}

/**
 * Awatar agenta. Kolejnosc warstw (od spodu): inicjaly -> wektorowy portret
 * CharacterAvatar -> obrazek PNG /avatars/<slug>.png -> wideo /avatars/<slug>.mp4
 * (webapp/public/avatars/). Domyslnie widac wektorowy portret persony (ostry w
 * kazdym rozmiarze, bez assetow). Gdy istnieje PNG (wersja premium z Higgsfield),
 * przykrywa wektor plynnie po zaladowaniu. Gdy istnieje MP4, po najechaniu myszka
 * (a na dotyku po tapnieciu w profilu) odtwarza sie krotki klip nad portretem.
 * Gdy brak karty postaci, zostaja inicjaly. Zaden brakujacy element niczego nie psuje.
 */
export default function Avatar({
  agent,
  size = 'md',
  working = false,
  glow = false,
  aura,
  hover = false,
  profile = false,
  className = '',
}: AvatarProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  // Warstwa wideo: gdy brak pliku, onError wylacza ja na stale (zero bledow petli).
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const playVideo = () => {
    const v = videoRef.current
    if (!v || videoFailed || prefersReducedMotion()) return
    try {
      v.currentTime = 0
    } catch {
      // ignorujemy: metadane moga jeszcze nie byc gotowe
    }
    const p = v.play()
    if (p && typeof p.then === 'function') {
      p.then(() => setVideoPlaying(true)).catch(() => {
        // przegladarka moze odmowic autoodtwarzania: zostajemy na portrecie
      })
    } else {
      setVideoPlaying(true)
    }
  }

  const stopVideo = () => {
    const v = videoRef.current
    setVideoPlaying(false)
    if (!v) return
    v.pause()
    try {
      v.currentTime = 0
    } catch {
      // ignorujemy
    }
  }

  // Pierscien-aura (box-shadow podaza za border-radius, wiec dziala i na squircle).
  const auraShadow =
    aura === 'strong'
      ? `0 0 0 3px ${HAIRLINE}, 0 0 0 5px ${agent.accent}66, 0 0 0 9px ${agent.accent}22, 0 0 26px 4px ${agent.accent}40`
      : aura === 'soft'
        ? `0 0 0 3px ${HAIRLINE}, 0 0 0 4px ${agent.accent}33`
        : undefined
  const glowShadow = glow ? `0 6px 18px -6px ${agent.accent}80` : undefined
  const boxShadow =
    [auraShadow, glowShadow].filter(Boolean).join(', ') || undefined

  return (
    <div
      className={[
        'relative flex flex-shrink-0 select-none items-center justify-center overflow-hidden font-bold ring-1 ring-white/10',
        SIZE_CLASSES[size],
        working ? 'avatar-breath' : '',
        hover ? 'avatar-hover' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        background: `linear-gradient(135deg, ${agent.accent}2e, ${agent.accent}12)`,
        color: agent.accent,
        boxShadow,
        ['--glow' as string]: `${agent.accent}88`,
        ['--accent-ring' as string]: `${agent.accent}59`,
      }}
      onMouseEnter={() => {
        if (canHover()) playVideo()
      }}
      onMouseLeave={() => {
        if (canHover()) stopVideo()
      }}
      onClick={() => {
        // Dotyk: tap odtwarza tylko w hero profilu, nigdy w listach.
        if (canHover() || !profile) return
        if (videoPlaying) stopVideo()
        else playVideo()
      }}
      aria-hidden
    >
      {/* Fallback: inicjaly rysowane zawsze pod portretem (zero skoku layoutu) */}
      <span aria-hidden>{initials(agent.name)}</span>
      {/* Wektorowy portret persony (domyslny, gdy brak PNG) */}
      <CharacterAvatar agent={agent} px={SIZE_PX[size]} />
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
      {/* Warstwa wideo NAD portretem. Brak pliku -> onError wylacza ja na stale. */}
      {!videoFailed && (
        <video
          ref={videoRef}
          src={`${import.meta.env.BASE_URL}avatars/${agent.slug}.mp4`}
          muted
          playsInline
          loop={false}
          preload="metadata"
          onEnded={stopVideo}
          onError={() => setVideoFailed(true)}
          draggable={false}
          className={[
            'pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
            videoPlaying ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          aria-hidden
        />
      )}
    </div>
  )
}

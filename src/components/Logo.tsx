import { useState } from 'react'

interface LogoProps {
  size?: number
  className?: string
}

/**
 * Znak marki SF AI TEAM. Kolejnosc prob (lancuszek onError, bez skoku layoutu):
 * 1) /logo-mark.png  (sam wykadrowany znak, robi go osobny skrypt),
 * 2) /logo.png       (pelne logo dostarczone przez klienta),
 * 3) wektorowy cyrkiel SVG ponizej (zawsze dziala, czytelny w malym rozmiarze).
 * Pliki wrzuca sie do webapp/public/ (patrz webapp/public/BRANDING.md).
 */
export default function Logo({ size = 36, className = '' }: LogoProps) {
  const sources = [
    `${import.meta.env.BASE_URL}logo-mark.png`,
    `${import.meta.env.BASE_URL}logo.png`,
  ]
  const [idx, setIdx] = useState(0)
  const [useSvg, setUseSvg] = useState(false)

  if (!useSvg) {
    return (
      <img
        src={sources[idx]}
        width={size}
        height={size}
        alt="SF AI TEAM"
        draggable={false}
        onError={() => {
          if (idx < sources.length - 1) setIdx(idx + 1)
          else setUseSvg(true)
        }}
        className={['object-contain', className].filter(Boolean).join(' ')}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="SF AI TEAM"
    >
      <defs>
        <linearGradient id="sf-bg" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0" stopColor="#16161a" />
          <stop offset="1" stopColor="#0d0d10" />
        </linearGradient>
        <linearGradient id="sf-leg" x1="16" y1="17" x2="48" y2="49">
          <stop offset="0" stopColor="#7BA4F2" />
          <stop offset="1" stopColor="#3F6FD1" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#sf-bg)" />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="13.25"
        stroke="#27272a"
        strokeWidth="1.5"
      />
      {/* Ledwo widoczna poswiata akcentu u gory */}
      <ellipse cx="32" cy="12" rx="20" ry="10" fill="#5B8DEF" opacity="0.1" />
      <circle
        cx="32"
        cy="17"
        r="4"
        fill="none"
        stroke="url(#sf-leg)"
        strokeWidth="2.5"
      />
      <path
        d="M30 20 L17 49"
        stroke="url(#sf-leg)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M34 20 L47 49"
        stroke="url(#sf-leg)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Poprzeczka cyrkla, akcent architektow */}
      <path
        d="M26 30 L38 30"
        stroke="#5B8DEF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <text
        x="32"
        y="42"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="13"
        fontWeight="800"
        fill="#E4E4E7"
        textAnchor="middle"
      >
        SF
      </text>
    </svg>
  )
}

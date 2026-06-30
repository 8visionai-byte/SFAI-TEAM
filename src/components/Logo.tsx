interface LogoProps {
  size?: number
  className?: string
}

/** Znak marki SF AI TEAM: stylizowany cyrkiel z literami SF. */
export default function Logo({ size = 36, className = '' }: LogoProps) {
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
      <rect width="64" height="64" rx="14" fill="#0f0f12" />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="13.25"
        stroke="#27272a"
        strokeWidth="1.5"
      />
      <circle
        cx="32"
        cy="17"
        r="4"
        fill="none"
        stroke="#5B8DEF"
        strokeWidth="2.5"
      />
      <path
        d="M30 20 L17 49"
        stroke="#5B8DEF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M34 20 L47 49"
        stroke="#5B8DEF"
        strokeWidth="2.5"
        strokeLinecap="round"
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

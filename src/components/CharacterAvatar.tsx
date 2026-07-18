import type { ReactNode } from 'react'
import type { Agent } from '../data/agents'
import {
  characters,
  hairPal,
  skinPal,
  mix,
  COPPER_STREAK,
  type CharacterCard,
} from '../data/characters'

/**
 * Parametryczny portret persony rysowany wektorowo w SVG (viewBox 0 0 96 96).
 * Jeden komponent rysuje wszystkie 10 postaci z tabeli `characters.ts`.
 * Zero zewnetrznych assetow: postac jest kodem, ostra w kazdym rozmiarze.
 *
 * Warstwy (od spodu): tlo -> ubranie -> szyja -> wlosy tyl -> uszy -> glowa
 * -> rim light -> brwi -> oczy -> nos -> zarost -> usta -> wlosy front
 * -> okulary -> akcesoria. Kolejnosc wg ART-SPEC-V18 sekcja 1.2.
 *
 * Kazdy <defs> ma id sufiksowane slugiem, bo na jednej stronie renderuje sie
 * do 10 awatarow naraz (kolizja id = bledne gradienty). To WYMOG.
 *
 * Gdy brak karty dla sluga -> zwraca null (Avatar pokazuje wtedy inicjaly).
 * Brak danych niczego nie psuje (kontrakt).
 */
interface CharacterAvatarProps {
  agent: Agent
  /** realny rozmiar w px (32/40/44/64/80/96/112): steruje bramka detali */
  px: number
  shape?: 'squircle' | 'circle'
  working?: boolean
  className?: string
  /** opcjonalne nadpisanie karty (domyslnie czytane z characters[slug]) */
  card?: CharacterCard
}

const NEAR_BLACK = '#0E0E11'
const IRIS = '#2A2320'
const EYE_WHITE = '#F6F1EA'
const LIP = '#B5695A'

export default function CharacterAvatar({
  agent,
  px,
  shape = 'squircle',
  working = false,
  className = '',
  card: cardOverride,
}: CharacterAvatarProps) {
  const card = cardOverride ?? characters[agent.slug]
  if (!card) return null

  const slug = agent.slug
  const accent = agent.accent
  const detail = px >= 64

  // Palety
  const skin = skinPal[card.skin]
  const skinBase = card.skinLight ? mix(skin.base, '#FFFFFF', 0.08) : skin.base
  const skinShadow = card.skinLight
    ? mix(skin.shadow, '#FFFFFF', 0.06)
    : skin.shadow
  const hair = hairPal[card.hairColor]

  // Kolor ubrania: akcent +18% biel (gora), akcent +30% czern (dol)
  const clothTop = mix(accent, '#FFFFFF', 0.18)
  const clothBottom = mix(accent, '#000000', 0.3)
  const accentBright = mix(accent, '#FFFFFF', 0.35)
  const scarfCol = mix(accent, '#FFFFFF', 0.3)
  // Brwi: naturalny ciemny odcien wyprowadzony ze skory
  const browColor = mix(skinShadow, '#000000', 0.5)
  const rim = card.rim ?? 0.5

  const id = (p: string) => `${p}-${slug}`

  // Geometria twarzy zalezna od zuchwy
  const face =
    card.jaw === 'soft'
      ? 'M 48 19 C 58 19 67 27 67 38 C 67 51 59 60 48 63 C 37 60 29 51 29 38 C 29 27 38 19 48 19 Z'
      : 'M 48 19 C 59 19 69 27 69 39 C 69 49 65 57 55 62 Q 48 65 41 62 C 31 57 27 49 27 39 C 27 27 37 19 48 19 Z'

  const rightCheek =
    card.jaw === 'soft'
      ? 'M 48 20 C 59 20 67 28 67 39 C 67 51 59 60 48 63 C 53 56 55 48 55 39 C 55 30 52 24 48 20 Z'
      : 'M 48 20 C 59 20 69 28 69 39 C 69 49 65 57 55 62 C 57 54 57 46 55 39 C 54 30 52 25 48 20 Z'

  const hairLayers = renderHair(card, id)
  const collar = renderCollar(card, clothTop, clothBottom)

  return (
    <svg
      viewBox="0 0 96 96"
      width="100%"
      height="100%"
      className={[
        'absolute inset-0 block h-full w-full',
        working ? 'avatar-breath' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label={agent.name}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id={id('bg')} cx="0.5" cy="0.3" r="0.85">
          <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.1" />
          <stop offset="100%" stopColor={NEAR_BLACK} stopOpacity="1" />
        </radialGradient>
        <linearGradient id={id('skin')} x1="0.25" y1="0.1" x2="0.8" y2="0.95">
          <stop offset="0%" stopColor={skinBase} />
          <stop offset="100%" stopColor={skinShadow} />
        </linearGradient>
        <linearGradient id={id('hair')} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={hair.base} />
          <stop offset="100%" stopColor={hair.shadow} />
        </linearGradient>
        <linearGradient id={id('cloth')} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={clothTop} />
          <stop offset="100%" stopColor={clothBottom} />
        </linearGradient>
        <filter id={id('soft')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
        {shape === 'circle' && (
          <clipPath id={id('clip')}>
            <circle cx="48" cy="48" r="48" />
          </clipPath>
        )}
      </defs>

      {/* 1. Tlo */}
      {shape === 'circle' ? (
        <circle cx="48" cy="48" r="48" fill={`url(#${id('bg')})`} />
      ) : (
        <rect x="0" y="0" width="96" height="96" fill={`url(#${id('bg')})`} />
      )}
      <g clipPath={shape === 'circle' ? `url(#${id('clip')})` : undefined}>
        {/* gorny sheen */}
        <ellipse cx="48" cy="10" rx="60" ry="22" fill="#FFFFFF" opacity="0.04" />

        {/* 2. Ubranie / ramiona */}
        <path
          d="M 8 96 C 8 77 25 70 48 70 C 71 70 88 77 88 96 Z"
          fill={`url(#${id('cloth')})`}
        />
        {collar}
        {card.accessory === 'szalik' && (
          <path
            d="M 33 73 Q 48 80 63 73 L 63 82 Q 48 87 33 82 Z"
            fill={scarfCol}
            opacity="0.92"
          />
        )}

        {/* 3. Szyja + cien pod szczeka */}
        <path
          d="M 41 60 L 41 71 Q 48 74 55 71 L 55 60 Z"
          fill={`url(#${id('skin')})`}
        />
        <ellipse cx="48" cy="61" rx="9" ry="3" fill={skinShadow} opacity="0.5" />

        {/* 4. Wlosy: tyl */}
        {hairLayers.back}

        {/* 5. Uszy */}
        <circle cx="28" cy="44" r="4" fill={skinBase} />
        <circle cx="68" cy="44" r="4" fill={skinBase} />

        {/* 6. Glowa + cien policzka */}
        <path d={face} fill={`url(#${id('skin')})`} />
        <path
          d={rightCheek}
          fill={skinShadow}
          opacity="0.32"
          filter={`url(#${id('soft')})`}
        />

        {/* 7. Rim light (lewa krawedz, charakter SF) */}
        <path
          d="M 47 19 C 38 19 29 27 29 39 C 29 48 33 56 42 61"
          stroke={accent}
          strokeWidth="1.6"
          fill="none"
          opacity={rim}
          filter={`url(#${id('soft')})`}
          strokeLinecap="round"
        />

        {/* 8. Brwi */}
        {renderBrows(card.brow, browColor)}

        {/* 9. Oczy */}
        {renderEyes(card.eyes, detail)}

        {/* 10. Nos */}
        <path
          d="M 48 44 L 45.5 50 Q 48 51.2 50.5 50 Z"
          fill={skinShadow}
          opacity="0.38"
        />
        {detail && (
          <>
            <path d="M 46 50.2 L 46.4 51" stroke={skinShadow} strokeWidth="0.3" />
            <path d="M 50 50.2 L 49.6 51" stroke={skinShadow} strokeWidth="0.3" />
          </>
        )}

        {/* 11. Zarost (pod ustami) */}
        {renderFacialHair(card, id, detail)}

        {/* 12. Usta */}
        {renderMouth(card.mouth)}

        {/* 13. Wlosy: front */}
        {hairLayers.front}
        {card.copperStreak && detail && (
          <path
            d="M 33 33 Q 30 42 34 50"
            stroke={COPPER_STREAK}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            opacity="0.9"
          />
        )}

        {/* 14. Okulary */}
        {renderGlasses(card.glasses, accent)}

        {/* 15. Akcesoria drobne (detail) */}
        {renderAccessory(card, accentBright, detail)}
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Fryzury: kazdy styl ma warstwe 'tyl' (za glowa) i 'front' (nad czolem).    */
/* -------------------------------------------------------------------------- */

function renderHair(
  card: CharacterCard,
  id: (p: string) => string,
): { back: ReactNode; front: ReactNode } {
  const fill = `url(#${id('hair')})`
  const temple = hairPal[card.hairColor].temple

  switch (card.hairStyle) {
    case 'bob-krotki':
      return {
        back: (
          <path
            d="M 27 52 C 25 24 42 17 48 17 C 54 17 71 24 69 52 C 69 40 62 29 48 29 C 34 29 27 40 27 52 Z"
            fill={fill}
          />
        ),
        front: (
          <path
            d="M 29 34 Q 33 22 48 21 Q 63 22 67 34 Q 60 27 48 27 Q 40 27 34 33 Z"
            fill={fill}
          />
        ),
      }
    case 'krotkie-siwe':
      return {
        back: (
          <path
            d="M 30 41 C 29 24 40 20 48 20 C 56 20 67 24 66 41 C 66 30 58 27 48 27 C 38 27 30 31 30 41 Z"
            fill={fill}
          />
        ),
        front: (
          <path
            d="M 32 33 Q 40 26 48 26 Q 56 26 64 33 Q 56 30 48 30 Q 40 30 32 33 Z"
            fill={fill}
          />
        ),
      }
    case 'kucyk-wysoki':
      return {
        back: (
          <path
            d="M 66 28 Q 84 34 78 54 Q 76 46 68 42 Q 70 36 66 30 Z"
            fill={fill}
          />
        ),
        front: (
          <path
            d="M 30 38 C 29 22 40 18 48 18 C 56 18 67 22 66 38 C 64 28 58 25 48 25 C 38 25 32 28 30 38 Z"
            fill={fill}
          />
        ),
      }
    case 'bardzo-krotkie':
      return {
        back: (
          <path
            d="M 31 39 C 30 24 40 21 48 21 C 56 21 66 24 65 39 C 65 31 58 28 48 28 C 38 28 31 31 31 39 Z"
            fill={fill}
          />
        ),
        front: (
          <path
            d="M 32 31 Q 40 28 48 28 Q 56 28 64 31 L 63 34 Q 56 31 48 31 Q 40 31 33 34 Z"
            fill={fill}
          />
        ),
      }
    case 'kok-niski-siwy':
      return {
        back: (
          <>
            <circle cx="48" cy="60" r="6.5" fill={fill} />
            <path
              d="M 30 38 C 29 22 40 19 48 19 C 56 19 67 22 66 38 C 64 27 58 26 48 26 C 38 26 32 27 30 38 Z"
              fill={fill}
            />
          </>
        ),
        front: (
          <path
            d="M 31 34 Q 40 25 48 25 Q 56 25 65 34 Q 57 29 48 30 Q 39 29 31 34 Z"
            fill={fill}
          />
        ),
      }
    case 'kredzone-krotkie':
      return {
        back: (
          <path
            d="M 29 44 C 27 24 40 18 48 18 C 56 18 69 24 67 44 C 66 30 58 27 48 27 C 38 27 30 31 29 44 Z"
            fill={fill}
          />
        ),
        front: (
          <path
            d="M 30 33 Q 32 24 37 26 Q 39 21 45 25 Q 48 20 52 25 Q 58 21 60 26 Q 65 24 66 33 Q 60 28 54 30 Q 48 27 42 30 Q 35 28 30 33 Z"
            fill={fill}
          />
        ),
      }
    case 'krotkie-czupryna':
      return {
        back: (
          <path
            d="M 30 40 C 29 24 40 20 48 20 C 56 20 67 24 66 40 C 66 30 58 27 48 27 C 38 27 30 30 30 40 Z"
            fill={fill}
          />
        ),
        front: (
          <path
            d="M 31 33 Q 34 24 40 27 Q 44 21 50 26 Q 56 23 60 28 Q 64 26 65 33 Q 58 29 50 30 Q 42 30 36 32 Z"
            fill={fill}
          />
        ),
      }
    case 'do-ramion':
      return {
        back: (
          <path
            d="M 24 72 C 22 40 24 24 48 20 C 72 24 74 40 72 72 C 70 50 66 34 48 33 C 30 34 26 50 24 72 Z"
            fill={fill}
          />
        ),
        front: (
          <path
            d="M 29 35 Q 33 23 48 21 Q 62 23 67 35 Q 60 27 46 28 Q 39 28 34 34 Z"
            fill={fill}
          />
        ),
      }
    case 'krotkie-siwiejace':
      return {
        back: (
          <>
            <path
              d="M 30 40 C 29 24 40 20 48 20 C 56 20 67 24 66 40 C 66 30 58 27 48 27 C 38 27 30 30 30 40 Z"
              fill={fill}
            />
            {temple && (
              <>
                <path d="M 30 34 Q 29 41 31 46 L 34 45 Q 32 39 33 34 Z" fill={temple} opacity="0.85" />
                <path d="M 66 34 Q 67 41 65 46 L 62 45 Q 64 39 63 34 Z" fill={temple} opacity="0.85" />
              </>
            )}
          </>
        ),
        front: (
          <path
            d="M 31 33 Q 36 25 48 24 Q 60 25 65 33 Q 58 28 48 29 Q 40 29 34 32 Z"
            fill={fill}
          />
        ),
      }
    case 'bob-asymetryczny':
      return {
        back: (
          <path
            d="M 28 60 C 26 26 40 18 48 18 C 56 18 70 24 68 44 L 64 42 C 64 30 58 27 48 27 C 38 27 30 32 30 46 Z"
            fill={fill}
          />
        ),
        front: (
          <path
            d="M 29 34 Q 33 22 48 20 Q 62 22 67 33 Q 58 26 46 27 Q 38 28 33 34 Z"
            fill={fill}
          />
        ),
      }
    default:
      return { back: null, front: null }
  }
}

/* -------------------------------------------------------------------------- */
/* Brwi (linia y=35), warianty przez ksztalt/wysokosc luku.                   */
/* -------------------------------------------------------------------------- */

function renderBrows(brow: CharacterCard['brow'], color: string): ReactNode {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    fill: 'none',
    strokeLinecap: 'round' as const,
  }
  switch (brow) {
    case 'uniesiona':
      return (
        <>
          <path d="M 35 35.5 Q 40 33.8 45 35" {...common} />
          <path d="M 51 33.2 Q 56 31.4 61 32.8" {...common} />
        </>
      )
    case 'skupione':
      return (
        <>
          <path d="M 36 36.4 Q 40 35.3 44.5 36.8" {...common} />
          <path d="M 51.5 36.8 Q 56 35.3 60 36.4" {...common} />
        </>
      )
    case 'miekkie':
      return (
        <>
          <path d="M 35.5 35.6 Q 40 34.6 44.5 35.6" {...common} />
          <path d="M 51.5 35.6 Q 56 34.6 60.5 35.6" {...common} />
        </>
      )
    case 'neutralne':
    default:
      return (
        <>
          <path d="M 35 35.5 Q 40 33.8 45 35" {...common} />
          <path d="M 51 35 Q 56 33.8 61 35.5" {...common} />
        </>
      )
  }
}

/* -------------------------------------------------------------------------- */
/* Oczy (linia y=42), spojrzenie przez przesuniecie teczy.                     */
/* -------------------------------------------------------------------------- */

function renderEyes(eyes: CharacterCard['eyes'], detail: boolean): ReactNode {
  // przesuniecie teczy w pionie wg spojrzenia
  const irisDy = eyes === 'skupione' ? 0.6 : eyes === 'cieple' ? -0.4 : 0
  const warm = eyes === 'cieple'

  const eye = (cx: number) => (
    <g key={cx}>
      <ellipse cx={cx} cy="42" rx="3.2" ry="2.1" fill={EYE_WHITE} opacity="0.9" />
      <circle cx={cx} cy={42 + irisDy} r="1.9" fill={IRIS} />
      {detail && (
        <circle
          cx={cx - 0.6}
          cy={42 + irisDy - 0.6}
          r="0.6"
          fill="#FFFFFF"
          opacity="0.85"
        />
      )}
      {warm && (
        <path
          d={`M ${cx - 3} 42.6 Q ${cx} 44.4 ${cx + 3} 42.6`}
          stroke={IRIS}
          strokeWidth="0.5"
          fill="none"
          opacity="0.5"
          strokeLinecap="round"
        />
      )}
    </g>
  )

  return (
    <>
      {eye(40)}
      {eye(56)}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Usta.                                                                       */
/* -------------------------------------------------------------------------- */

function renderMouth(mouth: CharacterCard['mouth']): ReactNode {
  const stroke = { stroke: LIP, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const }
  switch (mouth) {
    case 'usmiech':
      return <path d="M 43 53.4 Q 48 57 53 53.4" {...stroke} />
    case 'usmiech-cieply':
      return <path d="M 43 53.6 Q 48 56.4 53 53.6" {...stroke} />
    case 'usmiech-otwarty':
      return (
        <>
          <path d="M 43 53 Q 48 58.4 53 53 Q 48 55.2 43 53 Z" fill="#7A3B34" />
          <rect x="45" y="53" width="6" height="1.6" rx="0.8" fill="#F4EDE6" />
        </>
      )
    case 'smirk':
      return <path d="M 44 54 Q 49 55.4 52 53.4" {...stroke} />
    case 'spokojne':
    default:
      return <path d="M 44 54 Q 48 55.4 52 54" {...stroke} />
  }
}

/* -------------------------------------------------------------------------- */
/* Zarost.                                                                      */
/* -------------------------------------------------------------------------- */

function renderFacialHair(
  card: CharacterCard,
  id: (p: string) => string,
  detail: boolean,
): ReactNode {
  const beard =
    'M 31 44 Q 31 58 48 64 Q 65 58 65 44 Q 60 53 48 54.5 Q 36 53 31 44 Z'
  switch (card.facialHair) {
    case 'broda-krotka':
      return <path d={beard} fill={`url(#${id('hair')})`} opacity="0.96" />
    case 'broda-siwa':
      return <path d={beard} fill={hairPal.srebrny.base} opacity="0.92" />
    case 'stubble':
      return detail ? (
        <path d={beard} fill={hairPal.czarny.base} opacity="0.22" />
      ) : null
    case 'brak':
    default:
      return null
  }
}

/* -------------------------------------------------------------------------- */
/* Okulary.                                                                     */
/* -------------------------------------------------------------------------- */

function renderGlasses(glasses: CharacterCard['glasses'], accent: string): ReactNode {
  const frame = { stroke: '#2B2620', strokeWidth: 1.6, fill: accent, fillOpacity: 0.06 }
  switch (glasses) {
    case 'prostokatne':
      return (
        <>
          <rect x="34" y="38" width="12" height="9" rx="3" {...frame} />
          <rect x="50" y="38" width="12" height="9" rx="3" {...frame} />
          <line x1="46" y1="42" x2="50" y2="42" stroke="#2B2620" strokeWidth="1.6" />
          <line x1="34" y1="41" x2="28" y2="41.5" stroke="#2B2620" strokeWidth="1.4" />
          <line x1="62" y1="41" x2="68" y2="41.5" stroke="#2B2620" strokeWidth="1.4" />
        </>
      )
    case 'okragle':
      return (
        <>
          <circle cx="40" cy="42" r="5" {...frame} />
          <circle cx="56" cy="42" r="5" {...frame} />
          <line x1="45" y1="42" x2="51" y2="42" stroke="#2B2620" strokeWidth="1.6" />
        </>
      )
    case 'brak':
    default:
      return null
  }
}

/* -------------------------------------------------------------------------- */
/* Akcesoria drobne.                                                            */
/* -------------------------------------------------------------------------- */

function renderAccessory(
  card: CharacterCard,
  accentBright: string,
  detail: boolean,
): ReactNode {
  switch (card.accessory) {
    case 'pin':
      return detail ? (
        <rect x="36" y="82" width="2.6" height="2.6" rx="0.7" fill={accentBright} />
      ) : null
    case 'brooch':
      return detail ? (
        <circle cx="44" cy="82" r="2" fill={accentBright} />
      ) : null
    case 'kolczyk':
      return detail ? <circle cx="28" cy="49" r="1.4" fill="#D9D9DE" /> : null
    case 'earbud':
      return detail ? (
        <rect x="66.5" y="43" width="3" height="5" rx="1.4" fill="#EDEDF0" />
      ) : null
    // 'szalik' rysowany w warstwie ubrania; 'brak' nic
    case 'szalik':
    case 'brak':
    default:
      return null
  }
}

/* -------------------------------------------------------------------------- */
/* Kolnierz / krój przy szyi.                                                   */
/* -------------------------------------------------------------------------- */

function renderCollar(
  card: CharacterCard,
  clothTop: string,
  clothBottom: string,
): ReactNode {
  switch (card.collar) {
    case 'golf':
      // ciemny golf pod marynarka w akcencie
      return (
        <>
          <path d="M 41 68 Q 48 64 55 68 L 55 74 Q 48 71 41 74 Z" fill="#23232A" />
          <path d="M 40 71 L 46 96 L 40 96 Z" fill={clothBottom} opacity="0.9" />
          <path d="M 56 71 L 50 96 L 56 96 Z" fill={clothBottom} opacity="0.9" />
        </>
      )
    case 'lapel':
      // welniana marynarka: klapy
      return (
        <>
          <path d="M 40 71 L 48 80 L 40 92 Z" fill={clothBottom} opacity="0.85" />
          <path d="M 56 71 L 48 80 L 56 92 Z" fill={clothBottom} opacity="0.85" />
          <path d="M 45 72 L 48 82 L 51 72 Z" fill={mix(clothBottom, '#000000', 0.35)} />
        </>
      )
    case 'otwarty':
      // koszula/bomberka z rozpietym kolnierzem, dekolt widoczny
      return (
        <>
          <path d="M 44 71 L 48 82 L 52 71 Z" fill={mix(clothBottom, '#000000', 0.4)} />
          <path d="M 40 71 L 45 71 L 40 80 Z" fill={clothTop} opacity="0.8" />
          <path d="M 56 71 L 51 71 L 56 80 Z" fill={clothTop} opacity="0.8" />
        </>
      )
    case 'okragly':
    default:
      // dekolt okragly (crew)
      return (
        <path
          d="M 40 72 Q 48 78 56 72"
          stroke={clothBottom}
          strokeWidth="1.6"
          fill="none"
          opacity="0.7"
        />
      )
  }
}

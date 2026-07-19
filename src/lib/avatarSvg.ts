// Wspolny, bezramkowy renderer portretu persony -> zwraca czysty string SVG
// (wnetrze elementu <svg viewBox="0 0 96 96">). Korzystaja z niego:
//  - komponent React CharacterAvatar.tsx (przez dangerouslySetInnerHTML),
//  - generator podgladu podglad-awatary.html.
// Dzieki jednemu zrodlu prawdy podglad = 1:1 to, co widzi aplikacja.
//
// Implementacja wg .planning/v2/SPEC-V19.md czesc 1 (sekcje 1.2-1.9):
//  4 ksztalty twarzy, 4 budowy ramion, 3 tony skory + rim + highlight,
//  warstwa wieku (zmarszczki), objetosc wlosow per persona, znak roli w 40px.
//
// Kazdy <defs> ma id sufiksowane slugiem, bo na jednej stronie renderuje sie
// do 10 awatarow naraz (kolizja id = bledne gradienty). To WYMOG.

import {
  hairPal,
  skinPal,
  mix,
  COPPER_STREAK,
  type CharacterCard,
  type FaceShape,
  type Build,
} from '../data/characters'

const NEAR_BLACK = '#0E0E11'
const IRIS = '#3D2E24' // tecza (brazowa, dorosla)
const PUPIL = '#17120F'
const EYE_WHITE = '#F6F1EA'
const LIP = '#B5695A'
const EYELID = '#2A2320'

export interface AvatarRenderOpts {
  slug: string
  accent: string
  name: string
  /** realny rozmiar w px: steruje bramka detali (>=64 = detail) */
  px: number
  shape?: 'squircle' | 'circle'
}

/* -------------------------------------------------------------------------- */
/* 1.2 Cztery ksztalty twarzy: kontur + cien policzka + plan posredni.         */
/* jaw:'defined' poszerza kontur (scaleX ~1.08 wzgledem osi x=48).            */
/* -------------------------------------------------------------------------- */

interface FaceGeom {
  outline: string
  cheek: string // 1.2 cien policzka (prawa polowa wciagnieta do srodka)
  midtone: string // 1.4 plan posredni (prawa-dolna cwiartka)
  rimLeft: string // 1.4 rim light: lewa krawedz KONTURU (per ksztalt, nie owal)
  rimTop: string // 1.4 rim light: gorna krawedz glowy
  chinY: number
  earOff: number
}

const FACE: Record<FaceShape, FaceGeom> = {
  owalna: {
    outline:
      'M 48 19 C 58 19 67 27 67 38 C 67 51 59 60 48 63 C 37 60 29 51 29 38 C 29 27 38 19 48 19 Z',
    cheek:
      'M 48 21 C 57 21 65 29 66 39 C 66 50 58 59 48 62 C 52 55 54 47 54 39 C 54 31 52 26 48 21 Z',
    midtone: 'M 48 41 C 55 41 61 47 62 52 C 59 58 54 61 48 62 C 51 56 50 48 48 41 Z',
    rimLeft: 'M 47 19 C 38 19 29 27 29 39 C 29 48 33 56 42 61',
    rimTop: 'M 34 25 Q 48 18.5 62 25',
    chinY: 63,
    earOff: 20,
  },
  kanciasta: {
    outline:
      'M 48 19 C 60 19 69 26 69 37 L 69 44 C 69 53 63 61 55 64 Q 48 66 41 64 C 33 61 27 53 27 44 L 27 37 C 27 26 36 19 48 19 Z',
    cheek:
      'M 48 21 C 59 21 67 28 67 37 L 67 44 C 67 52 61 59 54 63 C 55 54 56 46 55 39 C 54 31 52 26 48 21 Z',
    midtone: 'M 48 42 C 56 42 62 48 64 53 C 60 59 54 63 48 64 C 51 57 50 49 48 42 Z',
    rimLeft: 'M 47 19 C 37 19 28 26 28 37 L 28 44 C 28 52 32 58 40 62',
    rimTop: 'M 33 24 Q 48 18 63 24',
    chinY: 64,
    earOff: 21,
  },
  okragla: {
    outline:
      'M 48 20 C 60 20 68.5 28 68.5 39 C 68.5 50 60 60 48 60 C 36 60 27.5 50 27.5 39 C 27.5 28 36 20 48 20 Z',
    cheek:
      'M 48 22 C 58 22 66 29 66.5 39 C 66.5 49 59 57 48 60 C 52 54 54 47 54 39 C 54 32 52 27 48 22 Z',
    midtone: 'M 48 41 C 56 41 62 46 63 51 C 60 56 54 60 48 60 C 51 54 50 47 48 41 Z',
    rimLeft: 'M 47 20 C 37 20 28 28 28 39 C 28 48 34 56 42 59',
    rimTop: 'M 33 26 Q 48 19.5 63 26',
    chinY: 60,
    earOff: 20.5,
  },
  pociagla: {
    outline:
      'M 48 19 C 56 19 65 26 65 37 C 65 50 58 61 48 65 C 38 61 31 50 31 37 C 31 26 40 19 48 19 Z',
    cheek:
      'M 48 21 C 55 21 63 28 63 38 C 63 51 57 61 48 65 C 51 57 53 48 53 39 C 53 31 51 26 48 21 Z',
    midtone: 'M 48 42 C 54 42 59 48 60 54 C 57 60 53 64 48 65 C 50 57 49 49 48 42 Z',
    rimLeft: 'M 47 19 C 40 19 31 26 31 37 C 31 49 37 59 44 63',
    rimTop: 'M 35 25 Q 48 18.5 61 25',
    chinY: 65,
    earOff: 20,
  },
}

/* -------------------------------------------------------------------------- */
/* 1.3 Cztery typy budowy: ramiona + szerokosc szyi.                           */
/* -------------------------------------------------------------------------- */

interface BuildGeom {
  shoulder: string
  neckHalf: number
  shoulderTopY: number
}

const BUILD: Record<Build, BuildGeom> = {
  szerokie: {
    shoulder: 'M 3 96 C 3 74 23 67 48 67 C 73 67 93 74 93 96 Z',
    neckHalf: 8,
    shoulderTopY: 67,
  },
  waskie: {
    shoulder: 'M 15 96 C 15 79 29 73 48 73 C 67 73 81 79 81 96 Z',
    neckHalf: 6,
    shoulderTopY: 73,
  },
  pochylone: {
    shoulder: 'M 7 96 C 7 81 26 75 48 75 C 70 75 89 81 89 96 Z',
    neckHalf: 6.5,
    shoulderTopY: 75,
  },
  normalne: {
    shoulder: 'M 8 96 C 8 77 25 70 48 70 C 71 70 88 77 88 96 Z',
    neckHalf: 7,
    shoulderTopY: 70,
  },
}

/* -------------------------------------------------------------------------- */
/* Glowny builder.                                                             */
/* -------------------------------------------------------------------------- */

export function buildAvatarInner(
  card: CharacterCard,
  opts: AvatarRenderOpts,
): string {
  const { slug, accent, px, shape = 'squircle' } = opts
  const detail = px >= 64
  const id = (p: string) => `${p}-${slug}`

  // Palety skory (3 tony + rozswietlenie), z korekta dla jasniejszego wariantu
  const sp = skinPal[card.skin]
  const skinBase = card.skinLight ? mix(sp.base, '#FFFFFF', 0.08) : sp.base
  const skinShadow = card.skinLight ? mix(sp.shadow, '#FFFFFF', 0.06) : sp.shadow
  const skinMid = mix(skinBase, skinShadow, 0.5)
  const skinLight = mix(skinBase, '#FFFFFF', 0.14)
  const hair = hairPal[card.hairColor]

  const clothTop = mix(accent, '#FFFFFF', 0.18)
  const clothBottom = mix(accent, '#000000', 0.3)
  const accentBright = mix(accent, '#FFFFFF', 0.35)
  const scarfCol = mix(accent, '#FFFFFF', 0.3)
  const browColor = mix(skinShadow, '#000000', 0.5)
  const wiekColor = mix(skinShadow, '#000000', 0.35)
  const rim = card.rim ?? 0.5

  const geom = FACE[card.faceShape]
  const bld = BUILD[card.build]
  const chinY = geom.chinY
  const jawScale = card.jaw === 'defined' ? 1.08 : 0.985
  const earCx = 48 + geom.earOff
  const neckTopY = chinY - 3
  const neckBotY = bld.shoulderTopY + 3
  const nh = bld.neckHalf

  const hairLayers = renderHair(card, id)
  const sig = card.signature

  const out: string[] = []

  // defs
  out.push(`<defs>`)
  out.push(
    `<radialGradient id="${id('bg')}" cx="0.5" cy="0.3" r="0.85">` +
      `<stop offset="0%" stop-color="${accent}" stop-opacity="0.34"/>` +
      `<stop offset="55%" stop-color="${accent}" stop-opacity="0.1"/>` +
      `<stop offset="100%" stop-color="${NEAR_BLACK}" stop-opacity="1"/>` +
      `</radialGradient>`,
  )
  out.push(
    `<linearGradient id="${id('skin')}" x1="0.25" y1="0.1" x2="0.8" y2="0.95">` +
      `<stop offset="0%" stop-color="${skinBase}"/>` +
      `<stop offset="100%" stop-color="${skinShadow}"/>` +
      `</linearGradient>`,
  )
  out.push(
    `<linearGradient id="${id('hair')}" x1="0.3" y1="0" x2="0.7" y2="1">` +
      `<stop offset="0%" stop-color="${hair.base}"/>` +
      `<stop offset="100%" stop-color="${hair.shadow}"/>` +
      `</linearGradient>`,
  )
  out.push(
    `<linearGradient id="${id('cloth')}" x1="0.5" y1="0" x2="0.5" y2="1">` +
      `<stop offset="0%" stop-color="${clothTop}"/>` +
      `<stop offset="100%" stop-color="${clothBottom}"/>` +
      `</linearGradient>`,
  )
  out.push(
    `<filter id="${id('soft')}" x="-30%" y="-30%" width="160%" height="160%">` +
      `<feGaussianBlur stdDeviation="0.8"/></filter>`,
  )
  if (shape === 'circle') {
    out.push(`<clipPath id="${id('clip')}"><circle cx="48" cy="48" r="48"/></clipPath>`)
  }
  out.push(`</defs>`)

  // 1. Tlo
  if (shape === 'circle') {
    out.push(`<circle cx="48" cy="48" r="48" fill="url(#${id('bg')})"/>`)
  } else {
    out.push(`<rect x="0" y="0" width="96" height="96" fill="url(#${id('bg')})"/>`)
  }

  const clipOpen =
    shape === 'circle' ? `<g clip-path="url(#${id('clip')})">` : `<g>`
  out.push(clipOpen)

  // gorny sheen
  out.push(`<ellipse cx="48" cy="10" rx="60" ry="22" fill="#FFFFFF" opacity="0.04"/>`)

  // 2. Ubranie / ramiona (per budowa) + kolnierz + szalik/poszetka (znaki zawsze)
  out.push(`<path d="${bld.shoulder}" fill="url(#${id('cloth')})"/>`)
  out.push(renderCollar(card, clothTop, clothBottom))
  if (card.accessory === 'szalik' || sig === 'szalik') {
    // 1.6 szalik: mocniejszy (opacity 1), 2px grubszy, ZAWSZE
    out.push(
      `<path d="M 31 72 Q 48 81 65 72 L 65 83 Q 48 89 31 83 Z" fill="${scarfCol}" opacity="1"/>`,
    )
    out.push(
      `<path d="M 31 83 Q 48 89 65 83" stroke="${mix(scarfCol, '#000000', 0.25)}" stroke-width="1" fill="none" opacity="0.6"/>`,
    )
  }
  if (sig === 'poszetka') {
    // 1.6 poszetka: trojkat na klapie, ZAWSZE
    out.push(`<path d="M 43 78 L 47 82 L 47 78 Z" fill="${accentBright}"/>`)
  }

  // 3. Szyja (per budowa) + cien pod zuchwa (mocniejszy)
  out.push(
    `<path d="M ${48 - nh} ${neckTopY} L ${48 - nh} ${neckBotY} Q 48 ${neckBotY + 3} ${48 + nh} ${neckBotY} L ${48 + nh} ${neckTopY} Z" fill="url(#${id('skin')})"/>`,
  )
  out.push(
    `<ellipse cx="48" cy="${chinY - 2}" rx="${nh + 1}" ry="3" fill="${skinShadow}" opacity="0.55" filter="url(#${id('soft')})"/>`,
  )

  // 4. Wlosy: tyl (+ kok/kucyk sylwetka jako znak)
  out.push(hairLayers.back)

  // 5. Uszy (przesuniete z szerokoscia twarzy)
  out.push(`<circle cx="${48 - geom.earOff}" cy="44" r="4" fill="${skinBase}"/>`)
  out.push(`<circle cx="${earCx}" cy="44" r="4" fill="${skinBase}"/>`)

  // 6. Glowa (kontur per ksztalt, jaw skaluje X)
  out.push(
    `<g transform="translate(48,0) scale(${jawScale},1) translate(-48,0)"><path d="${geom.outline}" fill="url(#${id('skin')})"/></g>`,
  )

  // 7. Plan posredni (midtone) - objetosc
  out.push(
    `<path d="${geom.midtone}" fill="${skinMid}" opacity="0.42" filter="url(#${id('soft')})"/>`,
  )

  // 8. Cien policzka
  out.push(
    `<path d="${geom.cheek}" fill="${skinShadow}" opacity="0.30" filter="url(#${id('soft')})"/>`,
  )

  // 9. Rozswietlenie: czolo + grzbiet nosa (rozbija plaskosc)
  out.push(
    `<ellipse cx="48" cy="28" rx="11" ry="6" fill="${skinLight}" opacity="0.5" filter="url(#${id('soft')})"/>`,
  )
  out.push(
    `<ellipse cx="48" cy="41" rx="2.2" ry="6" fill="${skinLight}" opacity="0.5" filter="url(#${id('soft')})"/>`,
  )
  if (card.bald) {
    // polysk czaszki (lysina jako sylwetka)
    out.push(
      `<ellipse cx="45" cy="26" rx="11" ry="7" fill="#FFFFFF" opacity="0.12" filter="url(#${id('soft')})"/>`,
    )
    out.push(
      `<ellipse cx="52" cy="24" rx="5" ry="3.5" fill="#FFFFFF" opacity="0.14" filter="url(#${id('soft')})"/>`,
    )
  }

  // 10. Rim light: 2 luki na PRAWDZIWEJ krawedzi konturu (per ksztalt + jaw)
  out.push(
    `<g transform="translate(48,0) scale(${jawScale},1) translate(-48,0)">` +
      `<path d="${geom.rimLeft}" stroke="${accent}" stroke-width="1.6" fill="none" opacity="${rim}" filter="url(#${id('soft')})" stroke-linecap="round"/>` +
      `<path d="${geom.rimTop}" stroke="${accent}" stroke-width="1.4" fill="none" opacity="${(rim * 0.7).toFixed(3)}" filter="url(#${id('soft')})" stroke-linecap="round"/>` +
      `</g>`,
  )

  // 11. Brwi (obnizone dla starszy)
  out.push(renderBrows(card.brow, browColor, card.age))

  // 12. Oczy (migdal + gorna powieka, mniejsza tecza, rozstaw z eyeSet)
  out.push(renderEyes(card, detail))

  // 13. Nos
  out.push(
    `<path d="M 48 44 L 45.5 50 Q 48 51.2 50.5 50 Z" fill="${skinShadow}" opacity="0.38"/>`,
  )
  if (detail) {
    out.push(
      `<path d="M 46 50.2 L 46.4 51" stroke="${skinShadow}" stroke-width="0.3"/>` +
        `<path d="M 50 50.2 L 49.6 51" stroke="${skinShadow}" stroke-width="0.3"/>`,
    )
  }

  // 14. Warstwa wieku (zmarszczki / rumieniec)
  out.push(renderWiek(card.age, wiekColor, detail))

  // 15. Zarost / broda (broda = znak dla handlowca/wiedzy)
  out.push(renderFacialHair(card, id, detail))

  // 16. Usta
  out.push(renderMouth(card.mouth))

  // 17. Wlosy: front (brak grzywki gdy bald) + pasmo miedziane (detail)
  out.push(hairLayers.front)
  if (card.copperStreak && detail) {
    out.push(
      `<path d="M 33 33 Q 30 42 34 50" stroke="${COPPER_STREAK}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.9"/>`,
    )
  }

  // 18. Okulary (znak dla analityka, zawsze)
  out.push(renderGlasses(card.glasses, accent))

  // 19. Akcesoria: znak roli ZAWSZE (kolczyk/earbud/brooch), reszta detail
  out.push(renderAccessory(card, accentBright, accent, detail))

  out.push(`</g>`)
  return out.join('')
}

/* -------------------------------------------------------------------------- */
/* Fryzury: kazdy styl ma warstwe 'tyl' (za glowa) i 'front' (nad czolem).     */
/* Objetosci realnie rozne (sekcja 1.8): jez, bob, kok, kucyk, dlugie, kredy.  */
/* -------------------------------------------------------------------------- */

function renderHair(
  card: CharacterCard,
  id: (p: string) => string,
): { back: string; front: string } {
  const fill = `url(#${id('hair')})`
  const temple = hairPal[card.hairColor].temple

  switch (card.hairStyle) {
    case 'bob-krotki':
      return {
        back: `<path d="M 27 52 C 25 24 42 17 48 17 C 54 17 71 24 69 52 C 69 40 62 29 48 29 C 34 29 27 40 27 52 Z" fill="${fill}"/>`,
        front: `<path d="M 29 34 Q 33 22 48 21 Q 63 22 67 34 Q 60 27 48 27 Q 40 27 34 33 Z" fill="${fill}"/>`,
      }
    case 'krotkie-siwe':
      return {
        back: `<path d="M 30 41 C 29 24 40 20 48 20 C 56 20 67 24 66 41 C 66 30 58 27 48 27 C 38 27 30 31 30 41 Z" fill="${fill}"/>`,
        front: `<path d="M 32 33 Q 40 26 48 26 Q 56 26 64 33 Q 56 30 48 30 Q 40 30 32 33 Z" fill="${fill}"/>`,
      }
    case 'kucyk-wysoki':
      return {
        // widoczna wypustka kucyka za prawym uchem = znak (zawsze)
        back:
          `<path d="M 66 26 Q 86 32 80 56 Q 78 47 69 42 Q 71 34 66 28 Z" fill="${fill}"/>` +
          `<path d="M 70 30 Q 82 36 77 52" stroke="${hairPal[card.hairColor].shadow}" stroke-width="1" fill="none" opacity="0.5"/>`,
        front: `<path d="M 30 38 C 29 22 40 18 48 18 C 56 18 67 22 66 38 C 64 28 58 25 48 25 C 38 25 32 28 30 38 Z" fill="${fill}"/>`,
      }
    case 'bardzo-krotkie':
      return {
        back: `<path d="M 31 39 C 30 24 40 21 48 21 C 56 21 66 24 65 39 C 65 31 58 28 48 28 C 38 28 31 31 31 39 Z" fill="${fill}"/>`,
        front: `<path d="M 32 31 Q 40 28 48 28 Q 56 28 64 31 L 63 34 Q 56 31 48 31 Q 40 31 33 34 Z" fill="${fill}"/>`,
      }
    case 'kok-niski-siwy': {
      const shd = hairPal[card.hairColor].shadow
      return {
        // pelna srebrna czupryna (kryje czubek) + widoczny kok z boku-tylu (znak)
        back:
          `<circle cx="60" cy="50" r="6" fill="${fill}"/>` +
          `<circle cx="60" cy="50" r="6" fill="none" stroke="${shd}" stroke-width="0.8" opacity="0.7"/>` +
          `<path d="M 54 47 Q 58 46 60 49" stroke="${shd}" stroke-width="0.8" fill="none" opacity="0.6"/>` +
          `<path d="M 29 40 C 28 21 40 18 48 18 C 56 18 68 21 67 40 C 66 27 58 24 48 24 C 38 24 30 27 29 40 Z" fill="${fill}"/>`,
        // grzywka zaczesana, kryje czubek do y21 + przedzialek + linia wlosow
        front:
          `<path d="M 29 33 Q 40 21 48 21 Q 56 21 67 33 Q 57 27 48 28 Q 39 27 29 33 Z" fill="${fill}"/>` +
          `<path d="M 48 21 L 48 27" stroke="${shd}" stroke-width="0.6" opacity="0.5"/>` +
          `<path d="M 30 32 Q 48 26 66 32" stroke="${shd}" stroke-width="0.7" fill="none" opacity="0.45"/>`,
      }
    }
    case 'kredzone-krotkie':
      return {
        // WYSOKA, falista objetosc nad czolem (kontur bumpy) - wyroznia pociagla twarz
        back: `<path d="M 28 46 C 25 20 40 14 48 14 C 56 14 71 20 68 46 C 67 30 58 25 48 25 C 38 25 29 30 28 46 Z" fill="${fill}"/>`,
        front: `<path d="M 29 33 Q 30 21 36 24 Q 38 16 45 22 Q 48 14 52 22 Q 59 16 61 24 Q 67 21 67 33 Q 60 26 54 29 Q 48 25 42 29 Q 35 26 29 33 Z" fill="${fill}"/>`,
      }
    case 'krotkie-czupryna':
      return {
        back: `<path d="M 30 40 C 29 24 40 20 48 20 C 56 20 67 24 66 40 C 66 30 58 27 48 27 C 38 27 30 30 30 40 Z" fill="${fill}"/>`,
        front: `<path d="M 31 33 Q 34 24 40 27 Q 44 21 50 26 Q 56 23 60 28 Q 64 26 65 33 Q 58 29 50 30 Q 42 30 36 32 Z" fill="${fill}"/>`,
      }
    case 'do-ramion':
      return {
        // MASA opadajaca ponizej barkow, szeroka sylwetka (znak: dlugie wlosy)
        back: `<path d="M 21 78 C 19 40 22 22 48 18 C 74 22 77 40 75 78 C 73 52 68 33 48 32 C 28 33 23 52 21 78 Z" fill="${fill}"/>`,
        front: `<path d="M 28 35 Q 32 22 48 20 Q 64 22 68 35 Q 60 27 46 28 Q 38 28 33 34 Z" fill="${fill}"/>`,
      }
    case 'krotkie-siwiejace':
      return {
        // zakola w litere M + siwe skronie
        back:
          `<path d="M 30 40 C 29 24 40 20 48 20 C 56 20 67 24 66 40 C 66 30 58 27 48 27 C 38 27 30 30 30 40 Z" fill="${fill}"/>` +
          (temple
            ? `<path d="M 30 33 Q 29 41 31 46 L 34 45 Q 32 39 33 33 Z" fill="${temple}" opacity="0.85"/>` +
              `<path d="M 66 33 Q 67 41 65 46 L 62 45 Q 64 39 63 33 Z" fill="${temple}" opacity="0.85"/>`
            : ''),
        // grzywka z zakolami (M): dwa luki cofniete przy skroniach
        front: `<path d="M 31 34 Q 35 27 40 30 Q 43 25 48 27 Q 53 25 56 30 Q 61 27 65 34 Q 58 30 53 31 Q 48 29 48 31 Q 48 29 43 31 Q 38 30 31 34 Z" fill="${fill}"/>`,
      }
    case 'bob-asymetryczny':
      return {
        // lewa strona do zuchwy, prawa krotka za ucho
        back: `<path d="M 27 62 C 25 26 40 18 48 18 C 56 18 70 24 68 44 L 64 42 C 64 30 58 27 48 27 C 38 27 29 32 30 48 Z" fill="${fill}"/>`,
        front: `<path d="M 28 35 Q 32 21 48 20 Q 63 22 67 33 Q 58 26 46 27 Q 37 28 32 35 Z" fill="${fill}"/>`,
      }
    case 'lysina-broda':
      return {
        // lysina: brak grzywki, tylko boczno-tylny wieniec wlosow nisko (znak)
        back:
          `<path d="M 27 40 C 26 49 29 56 34 58 C 31 51 31 45 32 40 Q 30 39 27 40 Z" fill="${fill}"/>` +
          `<path d="M 69 40 C 70 49 67 56 62 58 C 65 51 65 45 64 40 Q 66 39 69 40 Z" fill="${fill}"/>` +
          `<path d="M 34 44 Q 48 40 62 44 L 62 47 Q 48 43 34 47 Z" fill="${fill}" opacity="0.85"/>`,
        // brak wlosow-front (bald); polysk czaszki dodany w warstwie glowy
        front: '',
      }
    default:
      return { back: '', front: '' }
  }
}

/* -------------------------------------------------------------------------- */
/* Brwi (linia y=35). Age 'starszy' obniza brwi o 0.6px i lekko zweza.         */
/* -------------------------------------------------------------------------- */

function renderBrows(
  brow: CharacterCard['brow'],
  color: string,
  age: CharacterCard['age'],
): string {
  const dy = age === 'starszy' ? 0.6 : 0
  const w = age === 'starszy' ? 1.6 : 1.8
  const attr = `stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"`
  const p = (d: string) => `<path d="${shiftY(d, dy)}" ${attr}/>`
  switch (brow) {
    case 'uniesiona':
      return p('M 35 35.5 Q 40 33.8 45 35') + p('M 51 32.6 Q 56 30.6 61 32.4')
    case 'skupione':
      return p('M 36 36.4 Q 40 35.3 44.5 36.8') + p('M 51.5 36.8 Q 56 35.3 60 36.4')
    case 'miekkie':
      return p('M 35.5 35.6 Q 40 34.6 44.5 35.6') + p('M 51.5 35.6 Q 56 34.6 60.5 35.6')
    case 'neutralne':
    default:
      return p('M 35 35.5 Q 40 33.8 45 35') + p('M 51 35 Q 56 33.8 61 35.5')
  }
}

// przesuwa wszystkie wspolrzedne Y w prostym path-u (M/Q z parami x y) o dy
function shiftY(d: string, dy: number): string {
  if (!dy) return d
  const toks = d.split(' ')
  let i = 0
  return toks
    .map((t) => {
      if (/^[MQLC]$/.test(t)) {
        i = 0
        return t
      }
      const n = Number(t)
      if (Number.isNaN(n)) return t
      i++
      // co druga liczba to Y
      return i % 2 === 0 ? String(+(n + dy).toFixed(2)) : t
    })
    .join(' ')
}

/* -------------------------------------------------------------------------- */
/* Oczy (1.7): migdal + gorna powieka, mniejsza tecza, rozstaw z eyeSet.       */
/* -------------------------------------------------------------------------- */

function renderEyes(card: CharacterCard, detail: boolean): string {
  const irisDy = card.eyes === 'skupione' ? 0.6 : card.eyes === 'cieple' ? -0.4 : 0
  const warm = card.eyes === 'cieple'
  const es = card.eyeSet ?? 0
  const cxL = 40 - es
  const cxR = 56 + es

  const eye = (cx: number) => {
    const white = `M ${cx - 3.2} 42 Q ${cx} 40.3 ${cx + 3.2} 42 Q ${cx} 43.9 ${cx - 3.2} 42 Z`
    const lid = `M ${cx - 3.2} 42 Q ${cx} 40.3 ${cx + 3.2} 42`
    let s = `<path d="${white}" fill="${EYE_WHITE}" opacity="0.92"/>`
    s += `<circle cx="${cx}" cy="${(42 + irisDy).toFixed(2)}" r="1.6" fill="${IRIS}"/>`
    s += `<circle cx="${cx}" cy="${(42 + irisDy).toFixed(2)}" r="0.7" fill="${PUPIL}"/>`
    if (detail) {
      s += `<circle cx="${cx - 0.6}" cy="${(42 + irisDy - 0.6).toFixed(2)}" r="0.5" fill="#FFFFFF" opacity="0.85"/>`
    }
    s += `<path d="${lid}" stroke="${EYELID}" stroke-width="0.9" fill="none" opacity="0.55" stroke-linecap="round"/>`
    if (warm) {
      s += `<path d="M ${cx - 3} 43 Q ${cx} 44.4 ${cx + 3} 43" stroke="${IRIS}" stroke-width="0.4" fill="none" opacity="0.4" stroke-linecap="round"/>`
    }
    return s
  }
  return eye(cxL) + eye(cxR)
}

/* -------------------------------------------------------------------------- */
/* Warstwa wieku (1.5): rumieniec (mlody) / bruzda (dojrzaly) / pelny (starszy).*/
/* -------------------------------------------------------------------------- */

function renderWiek(
  age: CharacterCard['age'],
  color: string,
  detail: boolean,
): string {
  switch (age) {
    case 'mlody':
      // lekki rumieniec, gladko
      return (
        `<ellipse cx="40" cy="48" rx="4" ry="2.4" fill="#E8908A" opacity="0.10"/>` +
        `<ellipse cx="56" cy="48" rx="4" ry="2.4" fill="#E8908A" opacity="0.10"/>`
      )
    case 'dojrzaly':
      // jedna delikatna bruzda nosowo-wargowa po cieniowanej stronie (detail)
      return detail
        ? `<path d="M 53 49 Q 54.5 53 53.5 55.5" stroke="${color}" stroke-width="0.8" fill="none" opacity="0.18" stroke-linecap="round"/>`
        : ''
    case 'starszy': {
      // bruzdy nosowo-wargowe widoczne juz od 40px (sygnal wieku)
      let s =
        `<path d="M 43 49 Q 41.5 53 42.5 55.5" stroke="${color}" stroke-width="0.8" fill="none" opacity="0.20" stroke-linecap="round"/>` +
        `<path d="M 53 49 Q 54.5 53 53.5 55.5" stroke="${color}" stroke-width="0.8" fill="none" opacity="0.20" stroke-linecap="round"/>`
      if (detail) {
        // linie na czole + kurze lapki
        s +=
          `<path d="M 39 30 Q 48 28.5 57 30" stroke="${color}" stroke-width="0.7" fill="none" opacity="0.22" stroke-linecap="round"/>` +
          `<path d="M 40 33 Q 48 31.8 56 33" stroke="${color}" stroke-width="0.7" fill="none" opacity="0.22" stroke-linecap="round"/>` +
          `<path d="M 34 41 L 31.5 40" stroke="${color}" stroke-width="0.5" opacity="0.24" stroke-linecap="round"/>` +
          `<path d="M 34 43 L 31.5 43" stroke="${color}" stroke-width="0.5" opacity="0.24" stroke-linecap="round"/>` +
          `<path d="M 62 41 L 64.5 40" stroke="${color}" stroke-width="0.5" opacity="0.24" stroke-linecap="round"/>` +
          `<path d="M 62 43 L 64.5 43" stroke="${color}" stroke-width="0.5" opacity="0.24" stroke-linecap="round"/>`
      }
      return s
    }
    default:
      return ''
  }
}

/* -------------------------------------------------------------------------- */
/* Usta.                                                                       */
/* -------------------------------------------------------------------------- */

function renderMouth(mouth: CharacterCard['mouth']): string {
  const s = `stroke="${LIP}" stroke-width="1.6" fill="none" stroke-linecap="round"`
  switch (mouth) {
    case 'usmiech':
      return `<path d="M 43 53.4 Q 48 57 53 53.4" ${s}/>`
    case 'usmiech-cieply':
      return `<path d="M 43 53.6 Q 48 56.4 53 53.6" ${s}/>`
    case 'usmiech-otwarty':
      return (
        `<path d="M 43 53 Q 48 58.4 53 53 Q 48 55.2 43 53 Z" fill="#7A3B34"/>` +
        `<rect x="45" y="53" width="6" height="1.6" rx="0.8" fill="#F4EDE6"/>`
      )
    case 'smirk':
      return `<path d="M 44 54 Q 49 55.4 52 53.4" ${s}/>`
    case 'spokojne':
    default:
      return `<path d="M 44 54 Q 48 55.4 52 54" ${s}/>`
  }
}

/* -------------------------------------------------------------------------- */
/* Zarost / broda. broda-krotka i broda-siwa (znaki) rysowane zawsze.          */
/* -------------------------------------------------------------------------- */

function renderFacialHair(
  card: CharacterCard,
  id: (p: string) => string,
  detail: boolean,
): string {
  const beard = 'M 31 44 Q 31 58 48 64 Q 65 58 65 44 Q 60 53 48 54.5 Q 36 53 31 44 Z'
  // pelniejsza, dluzsza broda dla lysina-broda (najbardziej odrebna sylwetka)
  const beardFull =
    'M 30 43 Q 29 60 48 67 Q 67 60 66 43 Q 60 54 48 55.5 Q 36 54 30 43 Z'
  switch (card.facialHair) {
    case 'broda-krotka':
      return `<path d="${beard}" fill="url(#${id('hair')})" opacity="0.96"/>`
    case 'broda-siwa':
      return (
        `<path d="${beardFull}" fill="${hairPal.srebrny.base}" opacity="0.95"/>` +
        `<path d="${beardFull}" fill="none" stroke="${hairPal.srebrny.shadow}" stroke-width="0.6" opacity="0.5"/>`
      )
    case 'stubble':
      return detail
        ? `<path d="${beard}" fill="${hairPal.czarny.base}" opacity="0.22"/>`
        : ''
    case 'brak':
    default:
      return ''
  }
}

/* -------------------------------------------------------------------------- */
/* Okulary (znak analityka: prostokatne, powiekszone, zawsze).                 */
/* -------------------------------------------------------------------------- */

function renderGlasses(glasses: CharacterCard['glasses'], accent: string): string {
  const frame = `stroke="#2B2620" stroke-width="1.8" fill="${accent}" fill-opacity="0.06"`
  switch (glasses) {
    case 'prostokatne':
      return (
        `<rect x="33" y="38" width="13" height="9" rx="3" ${frame}/>` +
        `<rect x="50" y="38" width="13" height="9" rx="3" ${frame}/>` +
        `<line x1="46" y1="42" x2="50" y2="42" stroke="#2B2620" stroke-width="1.8"/>` +
        `<line x1="33" y1="41" x2="27" y2="41.5" stroke="#2B2620" stroke-width="1.4"/>` +
        `<line x1="63" y1="41" x2="69" y2="41.5" stroke="#2B2620" stroke-width="1.4"/>`
      )
    case 'okragle':
      return (
        `<circle cx="40" cy="42" r="5" ${frame}/>` +
        `<circle cx="56" cy="42" r="5" ${frame}/>` +
        `<line x1="45" y1="42" x2="51" y2="42" stroke="#2B2620" stroke-width="1.6"/>`
      )
    case 'brak':
    default:
      return ''
  }
}

/* -------------------------------------------------------------------------- */
/* Akcesoria: znak roli ZAWSZE (kolczyk/earbud/brooch), pin -> detail.         */
/* -------------------------------------------------------------------------- */

function renderAccessory(
  card: CharacterCard,
  accentBright: string,
  accent: string,
  detail: boolean,
): string {
  switch (card.accessory) {
    case 'pin':
      return detail
        ? `<rect x="41" y="80" width="2.6" height="2.6" rx="0.7" fill="${accentBright}"/>`
        : ''
    case 'brooch':
      // maly brooch przy dekolcie, zawsze (towarzyszy kokowi)
      return `<circle cx="44" cy="80" r="2" fill="${accentBright}"/>`
    case 'kolczyk':
      // srebrny kolczyk przy lewym uchu, ZAWSZE (znak copywritera)
      return `<circle cx="${48 - 20}" cy="49" r="1.6" fill="#D9D9DE"/>`
    case 'earbud':
      // earbud przy prawym uchu + kropka akcentu, ZAWSZE (znak social)
      return (
        `<rect x="66.5" y="43" width="3" height="5" rx="1.4" fill="#EDEDF0"/>` +
        `<circle cx="68" cy="47" r="0.9" fill="${accent}"/>`
      )
    case 'szalik':
    case 'brak':
    default:
      return ''
  }
}

/* -------------------------------------------------------------------------- */
/* Kolnierz / krój przy szyi.                                                   */
/* -------------------------------------------------------------------------- */

function renderCollar(
  card: CharacterCard,
  clothTop: string,
  clothBottom: string,
): string {
  switch (card.collar) {
    case 'golf':
      return (
        `<path d="M 41 68 Q 48 64 55 68 L 55 74 Q 48 71 41 74 Z" fill="#23232A"/>` +
        `<path d="M 40 71 L 46 96 L 40 96 Z" fill="${clothBottom}" opacity="0.9"/>` +
        `<path d="M 56 71 L 50 96 L 56 96 Z" fill="${clothBottom}" opacity="0.9"/>`
      )
    case 'lapel':
      return (
        `<path d="M 40 71 L 48 80 L 40 92 Z" fill="${clothBottom}" opacity="0.85"/>` +
        `<path d="M 56 71 L 48 80 L 56 92 Z" fill="${clothBottom}" opacity="0.85"/>` +
        `<path d="M 45 72 L 48 82 L 51 72 Z" fill="${mix(clothBottom, '#000000', 0.35)}"/>`
      )
    case 'otwarty':
      return (
        `<path d="M 44 71 L 48 82 L 52 71 Z" fill="${mix(clothBottom, '#000000', 0.4)}"/>` +
        `<path d="M 40 71 L 45 71 L 40 80 Z" fill="${clothTop}" opacity="0.8"/>` +
        `<path d="M 56 71 L 51 71 L 56 80 Z" fill="${clothTop}" opacity="0.8"/>`
      )
    case 'okragly':
    default:
      return `<path d="M 40 72 Q 48 78 56 72" stroke="${clothBottom}" stroke-width="1.6" fill="none" opacity="0.7"/>`
  }
}

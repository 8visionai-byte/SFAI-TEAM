// Karty postaci dla wektorowych portretow (CharacterAvatar).
// Zrodlo prawdy stylu: .planning/v2/ART-SPEC-V18.md, czesc 1 (sekcje 1.4-1.6).
// Akcentow NIE duplikujemy tutaj: kolor bierze sie z agent.accent (agents.ts).

export type SkinKey = 'porcelana' | 'ciepla' | 'oliwkowa' | 'ciemna'
export type HairKey =
  | 'ciemny-braz'
  | 'czarny'
  | 'auburn'
  | 'srebrny'
  | 'siwiejacy'
export type HairStyle =
  | 'bob-krotki'
  | 'krotkie-siwe'
  | 'kucyk-wysoki'
  | 'bardzo-krotkie'
  | 'kok-niski-siwy'
  | 'kredzone-krotkie'
  | 'krotkie-czupryna'
  | 'do-ramion'
  | 'krotkie-siwiejace'
  | 'bob-asymetryczny'
export type Brow = 'neutralne' | 'uniesiona' | 'skupione' | 'miekkie'
export type Eyes = 'wprost' | 'skupione' | 'cieple'
export type Mouth =
  | 'spokojne'
  | 'usmiech'
  | 'usmiech-otwarty'
  | 'usmiech-cieply'
  | 'smirk'
export type Glasses = 'brak' | 'prostokatne' | 'okragle'
export type FacialHair = 'brak' | 'stubble' | 'broda-krotka' | 'broda-siwa'
export type Accessory =
  | 'brak'
  | 'kolczyk'
  | 'earbud'
  | 'szalik'
  | 'brooch'
  | 'pin'
/** Krój przy szyi/ramionach (niesie charakter ubrania) */
export type Collar = 'golf' | 'lapel' | 'otwarty' | 'okragly'
export type Jaw = 'soft' | 'defined'

/** Pelna karta jednej postaci. Kazde pole = dokladna wartosc rysowana w SVG. */
export interface CharacterCard {
  jaw: Jaw
  skin: SkinKey
  /** jasniejszy wariant odcienia skory (np. operacje) */
  skinLight?: boolean
  hairStyle: HairStyle
  hairColor: HairKey
  /** miedziane pasmo we wlosach (tylko detail) */
  copperStreak?: boolean
  brow: Brow
  eyes: Eyes
  mouth: Mouth
  glasses: Glasses
  facialHair: FacialHair
  accessory: Accessory
  collar: Collar
  /** sila rim lightu (domyslnie 0.5; COO 0.55) */
  rim?: number
}

/** Palety skory: base + cien (sekcja 1.4). */
export const skinPal: Record<SkinKey, { base: string; shadow: string }> = {
  porcelana: { base: '#F2D2BE', shadow: '#E0B49E' },
  ciepla: { base: '#E7B590', shadow: '#CE9569' },
  oliwkowa: { base: '#C89873', shadow: '#AC7B57' },
  ciemna: { base: '#9A6544', shadow: '#7A4F34' },
}

/** Kolory wlosow: base + cien (+ pasmo skroni dla siwiejacego). */
export const hairPal: Record<
  HairKey,
  { base: string; shadow: string; temple?: string }
> = {
  'ciemny-braz': { base: '#3B2A22', shadow: '#241812' },
  czarny: { base: '#211C1A', shadow: '#100D0C' },
  auburn: { base: '#6E3B26', shadow: '#4C2618' },
  srebrny: { base: '#C9C7C9', shadow: '#A6A4A7' },
  siwiejacy: { base: '#33261F', shadow: '#1C120E', temple: '#B7B4B6' },
}

/** Miedziane pasmo (Analityk Social, tylko detail). */
export const COPPER_STREAK = '#B5643C'

/* -------------------------------------------------------------------------- */
/* Helper koloru: mieszanie dwoch hexow w proporcji t (0..1).                 */
/* Uzywany do koloru ubrania (akcent +18% biel / +30% czern) i akcesoriow.    */
/* -------------------------------------------------------------------------- */

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function toHex(r: number, g: number, b: number): string {
  const s = (n: number) => clamp(n).toString(16).padStart(2, '0')
  return `#${s(r)}${s(g)}${s(b)}`
}

/** Miesza hex z targetem: t=0 zwraca hex, t=1 zwraca target. */
export function mix(hex: string, target: string, t: number): string {
  const [r1, g1, b1] = parseHex(hex)
  const [r2, g2, b2] = parseHex(target)
  return toHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  )
}

/* -------------------------------------------------------------------------- */
/* 10 kart postaci (sekcja 1.6), kluczowane slugiem z agents.ts.              */
/* -------------------------------------------------------------------------- */

export const characters: Record<string, CharacterCard> = {
  // 0. COO: spokojny dowodca, dojrzaly lider
  coo: {
    jaw: 'soft',
    skin: 'porcelana',
    hairStyle: 'bob-krotki',
    hairColor: 'ciemny-braz',
    brow: 'neutralne',
    eyes: 'wprost',
    mouth: 'spokojne',
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'pin',
    collar: 'golf',
    rim: 0.55,
  },
  // 1. Wiedza i materialy: mistrz-bibliotekarz
  'wiedza-produkt': {
    jaw: 'defined',
    skin: 'ciepla',
    hairStyle: 'krotkie-siwe',
    hairColor: 'srebrny',
    brow: 'miekkie',
    eyes: 'cieple',
    mouth: 'usmiech-cieply',
    glasses: 'brak',
    facialHair: 'broda-siwa',
    accessory: 'brak',
    collar: 'okragly',
  },
  // 2. Operacje: energiczna, ogarnieta
  operacje: {
    jaw: 'soft',
    skin: 'ciepla',
    skinLight: true,
    hairStyle: 'kucyk-wysoki',
    hairColor: 'czarny',
    brow: 'neutralne',
    eyes: 'cieple',
    mouth: 'usmiech',
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'brak',
    collar: 'otwarty',
  },
  // 3. Analityk rynku: skupiony, okulary
  analityk: {
    jaw: 'defined',
    skin: 'ciemna',
    hairStyle: 'bardzo-krotkie',
    hairColor: 'czarny',
    brow: 'skupione',
    eyes: 'skupione',
    mouth: 'spokojne',
    glasses: 'prostokatne',
    facialHair: 'brak',
    accessory: 'brak',
    collar: 'okragly',
  },
  // 4. Pamiec zespolu: strazniczka archiwum
  'pamiec-zespolu': {
    jaw: 'soft',
    skin: 'porcelana',
    hairStyle: 'kok-niski-siwy',
    hairColor: 'srebrny',
    brow: 'miekkie',
    eyes: 'cieple',
    mouth: 'usmiech-cieply',
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'brooch',
    collar: 'okragly',
  },
  // 5. Copywriter: kreatywny, luzny
  copywriter: {
    jaw: 'soft',
    skin: 'ciepla',
    hairStyle: 'kredzone-krotkie',
    hairColor: 'czarny',
    brow: 'neutralne',
    eyes: 'wprost',
    mouth: 'usmiech',
    glasses: 'brak',
    facialHair: 'stubble',
    accessory: 'kolczyk',
    collar: 'otwarty',
  },
  // 6. Handlowiec: otwarty, najszerszy usmiech
  handlowiec: {
    jaw: 'defined',
    skin: 'oliwkowa',
    hairStyle: 'krotkie-czupryna',
    hairColor: 'ciemny-braz',
    brow: 'neutralne',
    eyes: 'cieple',
    mouth: 'usmiech-otwarty',
    glasses: 'brak',
    facialHair: 'broda-krotka',
    accessory: 'brak',
    collar: 'otwarty',
  },
  // 7. Opiekun klienta: empatyczna, ciepla
  'opiekun-klienta': {
    jaw: 'soft',
    skin: 'porcelana',
    hairStyle: 'do-ramion',
    hairColor: 'auburn',
    brow: 'miekkie',
    eyes: 'cieple',
    mouth: 'usmiech-cieply',
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'szalik',
    collar: 'okragly',
  },
  // 8. Drugi glos / strateg: uniesiona brew to podpis
  'drugi-glos': {
    jaw: 'defined',
    skin: 'oliwkowa',
    hairStyle: 'krotkie-siwiejace',
    hairColor: 'siwiejacy',
    brow: 'uniesiona',
    eyes: 'skupione',
    mouth: 'smirk',
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'brak',
    collar: 'lapel',
  },
  // 9. Analityk Social: nowoczesna, bystra
  'analityk-social': {
    jaw: 'soft',
    skin: 'porcelana',
    hairStyle: 'bob-asymetryczny',
    hairColor: 'czarny',
    copperStreak: true,
    brow: 'neutralne',
    eyes: 'skupione',
    mouth: 'spokojne',
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'earbud',
    collar: 'otwarty',
  },
}

/** Szybki dostep; brak karty => undefined (fallback do inicjalow w Avatar). */
export function getCharacter(slug: string | undefined): CharacterCard | undefined {
  if (!slug) return undefined
  return characters[slug]
}

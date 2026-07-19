// Karty postaci dla wektorowych portretow (CharacterAvatar).
// Zrodlo prawdy stylu: .planning/v2/ART-SPEC-V18.md + V19 (czesc 1, sekcje 1.1-1.9).
// V19: koniec klonow. Kazda persona ma INNA geometrie (ksztalt twarzy, budowe
// ramion, wiek, objetosc wlosow, znak roli w 40px), nie tylko inny kolor.
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
  | 'lysina-broda'
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

/** Ksztalt konturu glowy (osobny path per wariant, sekcja 1.2). */
export type FaceShape = 'owalna' | 'kanciasta' | 'okragla' | 'pociagla'
/** Budowa ramion + szerokosc szyi (sekcja 1.3). */
export type Build = 'szerokie' | 'waskie' | 'pochylone' | 'normalne'
/** Warstwa wieku: zmarszczki i modelunek (sekcja 1.5). */
export type Age = 'mlody' | 'dojrzaly' | 'starszy'
/** Znak roli, ktory MUSI czytac sie juz w 40px (sekcja 1.6). */
export type Signature =
  | 'okulary'
  | 'kolczyk'
  | 'szalik'
  | 'earbud'
  | 'poszetka'
  | 'broda'
  | 'kok'
  | 'kucyk'
  | 'lysina-broda'
  | 'bob'

/** Pelna karta jednej postaci. Kazde pole = dokladna wartosc rysowana w SVG. */
export interface CharacterCard {
  /** ksztalt konturu glowy (osobny path, sekcja 1.2) */
  faceShape: FaceShape
  /** sylwetka ramion + szerokosc szyi (sekcja 1.3) */
  build: Build
  /** warstwa zmarszczek + modelunek (sekcja 1.5) */
  age: Age
  /** modyfikator szerokosci zuchwy wewnatrz ksztaltu ('defined' poszerza) */
  jaw: Jaw
  skin: SkinKey
  /** jasniejszy wariant odcienia skory (np. operacje) */
  skinLight?: boolean
  hairStyle: HairStyle
  hairColor: HairKey
  /** lysina / wysokie zakola: brak grzywki, dochodzi polysk czaszki */
  bald?: boolean
  /** miedziane pasmo we wlosach (tylko detail) */
  copperStreak?: boolean
  brow: Brow
  eyes: Eyes
  mouth: Mouth
  /** korekta rozstawu oczu w px viewBox (szeroka twarz +1, waska -1) */
  eyeSet?: number
  glasses: Glasses
  facialHair: FacialHair
  accessory: Accessory
  collar: Collar
  /** znak roli czytelny w 40px (sekcja 1.6) */
  signature: Signature
  /** sila rim lightu (domyslnie 0.5; COO 0.55) */
  rim?: number
}

/* -------------------------------------------------------------------------- */
/* Helper koloru: mieszanie dwoch hexow w proporcji t (0..1).                 */
/* Uzywany do koloru ubrania, tonow skory (mid/light) i akcesoriow.           */
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

/** Palety skory: base + mid + light + cien (sekcja 1.4, 3 tony + rozswietlenie).
 *  mid = mix(base, shadow, 0.5); light = mix(base, bialy, 0.14). */
export const skinPal: Record<
  SkinKey,
  { base: string; mid: string; light: string; shadow: string }
> = build3Tone({
  porcelana: { base: '#F2D2BE', shadow: '#E0B49E' },
  ciepla: { base: '#E7B590', shadow: '#CE9569' },
  oliwkowa: { base: '#C89873', shadow: '#AC7B57' },
  ciemna: { base: '#9A6544', shadow: '#7A4F34' },
})

function build3Tone(
  base: Record<SkinKey, { base: string; shadow: string }>,
): Record<SkinKey, { base: string; mid: string; light: string; shadow: string }> {
  const out = {} as Record<
    SkinKey,
    { base: string; mid: string; light: string; shadow: string }
  >
  ;(Object.keys(base) as SkinKey[]).forEach((k) => {
    const p = base[k]
    out[k] = {
      base: p.base,
      mid: mix(p.base, p.shadow, 0.5),
      light: mix(p.base, '#FFFFFF', 0.14),
      shadow: p.shadow,
    }
  })
  return out
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
/* 10 kart postaci V2 (sekcja 1.8), kluczowane slugiem z agents.ts.           */
/* Rozklad roznorodnosci: ksztalt twarzy owalna x3 / kanciasta x3 /           */
/* okragla x2 / pociagla x2; budowa szerokie x2 / waskie x3 / pochylone x2 /  */
/* normalne x3; wiek mlody x2 / dojrzaly x5 / starszy x3.                      */
/* -------------------------------------------------------------------------- */

export const characters: Record<string, CharacterCard> = {
  // 0. COO: spokojna, pewna liderka, twarz zbalansowana
  coo: {
    faceShape: 'owalna',
    build: 'normalne',
    age: 'dojrzaly',
    jaw: 'soft',
    skin: 'porcelana',
    hairStyle: 'bob-krotki',
    hairColor: 'ciemny-braz',
    brow: 'neutralne',
    eyes: 'wprost',
    mouth: 'spokojne',
    eyeSet: 0,
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'pin',
    collar: 'lapel',
    signature: 'bob',
    rim: 0.55,
  },
  // 1. Wiedza: mistrz-bibliotekarz, lysina + srebrna broda (najbardziej odrebny)
  'wiedza-produkt': {
    faceShape: 'kanciasta',
    build: 'szerokie',
    age: 'starszy',
    jaw: 'defined',
    skin: 'ciepla',
    hairStyle: 'lysina-broda',
    hairColor: 'srebrny',
    bald: true,
    brow: 'miekkie',
    eyes: 'cieple',
    mouth: 'usmiech-cieply',
    eyeSet: 1,
    glasses: 'brak',
    facialHair: 'broda-siwa',
    accessory: 'brak',
    collar: 'okragly',
    signature: 'lysina-broda',
  },
  // 2. Operacje: energiczna, okragla mloda twarz, wysoki kucyk
  operacje: {
    faceShape: 'okragla',
    build: 'waskie',
    age: 'mlody',
    jaw: 'soft',
    skin: 'ciepla',
    skinLight: true,
    hairStyle: 'kucyk-wysoki',
    hairColor: 'czarny',
    brow: 'neutralne',
    eyes: 'cieple',
    mouth: 'usmiech',
    eyeSet: -1,
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'brak',
    collar: 'otwarty',
    signature: 'kucyk',
  },
  // 3. Analityk rynku: skupiony, kanciasta twarz, okulary niosa tozsamosc
  analityk: {
    faceShape: 'kanciasta',
    build: 'normalne',
    age: 'dojrzaly',
    jaw: 'defined',
    skin: 'ciemna',
    hairStyle: 'bardzo-krotkie',
    hairColor: 'czarny',
    brow: 'skupione',
    eyes: 'skupione',
    mouth: 'spokojne',
    eyeSet: 0,
    glasses: 'prostokatne',
    facialHair: 'brak',
    accessory: 'brak',
    collar: 'okragly',
    signature: 'okulary',
  },
  // 4. Pamiec: strazniczka archiwum, spadziste barki, srebrny kok
  'pamiec-zespolu': {
    faceShape: 'owalna',
    build: 'pochylone',
    age: 'starszy',
    jaw: 'soft',
    skin: 'porcelana',
    hairStyle: 'kok-niski-siwy',
    hairColor: 'srebrny',
    brow: 'miekkie',
    eyes: 'cieple',
    mouth: 'usmiech-cieply',
    eyeSet: 0,
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'brooch',
    collar: 'okragly',
    signature: 'kok',
  },
  // 5. Copywriter: kreatywny, pociagla twarz, wysoka falista objetosc wlosow
  copywriter: {
    faceShape: 'pociagla',
    build: 'normalne',
    age: 'dojrzaly',
    jaw: 'soft',
    skin: 'ciepla',
    hairStyle: 'kredzone-krotkie',
    hairColor: 'czarny',
    brow: 'neutralne',
    eyes: 'wprost',
    mouth: 'usmiech',
    eyeSet: 0,
    glasses: 'brak',
    facialHair: 'stubble',
    accessory: 'kolczyk',
    collar: 'otwarty',
    signature: 'kolczyk',
  },
  // 6. Handlowiec: barczysty, otwarty, najszerszy usmiech, krotka broda
  handlowiec: {
    faceShape: 'kanciasta',
    build: 'szerokie',
    age: 'dojrzaly',
    jaw: 'defined',
    skin: 'oliwkowa',
    hairStyle: 'krotkie-czupryna',
    hairColor: 'ciemny-braz',
    brow: 'neutralne',
    eyes: 'cieple',
    mouth: 'usmiech-otwarty',
    eyeSet: 1,
    glasses: 'brak',
    facialHair: 'broda-krotka',
    accessory: 'brak',
    collar: 'otwarty',
    signature: 'broda',
  },
  // 7. Opiekun: empatyczna, dlugie wlosy do ramion = wyrazna sylwetka
  'opiekun-klienta': {
    faceShape: 'owalna',
    build: 'waskie',
    age: 'dojrzaly',
    jaw: 'soft',
    skin: 'porcelana',
    hairStyle: 'do-ramion',
    hairColor: 'auburn',
    brow: 'miekkie',
    eyes: 'cieple',
    mouth: 'usmiech-cieply',
    eyeSet: -1,
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'szalik',
    collar: 'okragly',
    signature: 'szalik',
  },
  // 8. Drugi glos: adwokat diabla, pociagla powazna twarz, uniesiona brew + poszetka
  'drugi-glos': {
    faceShape: 'pociagla',
    build: 'pochylone',
    age: 'starszy',
    jaw: 'defined',
    skin: 'oliwkowa',
    hairStyle: 'krotkie-siwiejace',
    hairColor: 'siwiejacy',
    brow: 'uniesiona',
    eyes: 'skupione',
    mouth: 'smirk',
    eyeSet: 1,
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'brak',
    collar: 'lapel',
    signature: 'poszetka',
  },
  // 9. Analityk Social: nowoczesna, asymetryczny bob + earbud to znaki
  'analityk-social': {
    faceShape: 'okragla',
    build: 'waskie',
    age: 'mlody',
    jaw: 'soft',
    skin: 'porcelana',
    hairStyle: 'bob-asymetryczny',
    hairColor: 'czarny',
    copperStreak: true,
    brow: 'neutralne',
    eyes: 'skupione',
    mouth: 'spokojne',
    eyeSet: -1,
    glasses: 'brak',
    facialHair: 'brak',
    accessory: 'earbud',
    collar: 'otwarty',
    signature: 'earbud',
  },
}

/** Szybki dostep; brak karty => undefined (fallback do inicjalow w Avatar). */
export function getCharacter(slug: string | undefined): CharacterCard | undefined {
  if (!slug) return undefined
  return characters[slug]
}

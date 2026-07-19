import type { Agent } from '../data/agents'
import { characters, type CharacterCard } from '../data/characters'
import { buildAvatarInner } from '../lib/avatarSvg'

/**
 * Parametryczny portret persony rysowany wektorowo w SVG (viewBox 0 0 96 96).
 * Jeden komponent rysuje wszystkie 10 postaci z tabeli `characters.ts`.
 * Zero zewnetrznych assetow: postac jest kodem, ostra w kazdym rozmiarze.
 *
 * Cala geometria i cieniowanie zyje we WSPOLNYM rendererze `lib/avatarSvg.ts`
 * (to samo zrodlo prawdy zasila podglad-awatary.html, wiec podglad = apka).
 * Warstwy (V19, sekcja 1.9): tlo -> ubranie (per budowa) -> szyja -> wlosy tyl
 * -> uszy -> glowa (per ksztalt) -> midtone -> cien policzka -> highlight
 * -> rim (2 luki) -> brwi -> oczy (migdal) -> nos -> wiek -> zarost -> usta
 * -> wlosy front -> okulary -> akcesoria (znak roli zawsze).
 *
 * Kazdy <defs> ma id sufiksowane slugiem (do 10 awatarow na stronie: kolizja
 * id = bledne gradienty). To WYMOG.
 *
 * Gdy brak karty dla sluga -> zwraca null (Avatar pokazuje wtedy inicjaly).
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

  const inner = buildAvatarInner(card, {
    slug: agent.slug,
    accent: agent.accent,
    name: agent.name,
    px,
    shape,
  })

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
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

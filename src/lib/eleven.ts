/**
 * Glos persony przez ElevenLabs (proxy /api/tts). Uzywane do:
 *  - powitania na starcie rozmowy (tozsamosc glosu persony),
 *  - czytania odpowiedzi w torze podstawowym (gdy jest ELEVENLABS_API_KEY).
 *
 * Gdy /api/tts zwroci 503 (brak ELEVENLABS_API_KEY) -> fallback do voice.ts
 * speak() (darmowy polski glos przegladarki). Zaden sekret nie trafia do klienta.
 */
import type { Agent } from '../data/agents'
import { speak, cancel, oczyscDoMowy } from './voice'
import { authNaglowek, getProfil } from './storage'

/** Aktualnie grane audio ElevenLabs (do zatrzymania przy sprzataniu / barge-in). */
let biezaceAudio: HTMLAudioElement | null = null
let biezacyUrl: string | null = null

/** Zatrzymuje mowe persony: audio ElevenLabs oraz ewentualny fallback voice.ts. */
export function zatrzymajMowe(): void {
  if (biezaceAudio) {
    biezaceAudio.pause()
    biezaceAudio.srcObject = null
    biezaceAudio = null
  }
  if (biezacyUrl) {
    URL.revokeObjectURL(biezacyUrl)
    biezacyUrl = null
  }
  cancel() // przerwij tez Web Speech (fallback)
}

/**
 * Buduje tekst powitania persony: krotkie, personalne, BEZ przedstawiania sie
 * (rozmowca wie, z kim rozmawia). Po imieniu usera, gdy jest profil.
 * Tor podstawowy nie zna plci uzytkownika modelu, wiec trzymamy neutralne,
 * cieple powitanie zgodne z tonem person (od razu do rzeczy).
 */
export function powitanieTekst(): string {
  const user = getProfil()?.imie
  return user ? `Czesc ${user}! Co tam u Ciebie?` : 'Czesc! Co tam u Ciebie?'
}

export interface OpcjeMowyPersony {
  onStart?: () => void
  onEnd?: () => void
  onError?: (kod: string) => void
}

/**
 * Czyta podany tekst glosem persony (ElevenLabs). Przy 503 / bledzie spada na
 * voice.ts speak(). Zawsze wola onEnd na koniec (lub onError przy twardym bledzie).
 */
export async function mowTekstem(
  agent: Agent,
  tekst: string,
  opcje: OpcjeMowyPersony = {},
): Promise<void> {
  const voiceId = agent.elevenVoiceId
  const czysty = oczyscDoMowy(tekst)
  if (!czysty) {
    opcje.onEnd?.()
    return
  }

  // Brak przypisanego glosu ElevenLabs -> od razu fallback.
  if (!voiceId) {
    fallbackSpeak(czysty, opcje)
    return
  }

  zatrzymajMowe()

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authNaglowek() },
      body: JSON.stringify({ text: czysty, voiceId }),
    })

    // Brak klucza albo blad serwera -> darmowy glos przegladarki.
    if (res.status === 503 || !res.ok) {
      fallbackSpeak(czysty, opcje)
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    biezaceAudio = audio
    biezacyUrl = url

    audio.onplay = () => opcje.onStart?.()
    audio.onended = () => {
      if (biezacyUrl === url) {
        URL.revokeObjectURL(url)
        biezacyUrl = null
      }
      if (biezaceAudio === audio) biezaceAudio = null
      opcje.onEnd?.()
    }
    audio.onerror = () => {
      // Odtwarzanie padlo mimo poprawnej odpowiedzi -> sprobuj przegladarka.
      fallbackSpeak(czysty, opcje)
    }
    await audio.play().catch(() => fallbackSpeak(czysty, opcje))
  } catch {
    fallbackSpeak(czysty, opcje)
  }
}

/** Fallback: czyta tekst darmowym polskim glosem z voice.ts. */
function fallbackSpeak(tekst: string, opcje: OpcjeMowyPersony): void {
  speak(tekst, {
    onStart: opcje.onStart,
    onEnd: opcje.onEnd,
    onError: (kod) => {
      // Brak glosu PL / brak wsparcia: nie wieszamy maszyny stanow.
      opcje.onError?.(kod)
      opcje.onEnd?.()
    },
  })
}

/**
 * Wita uzytkownika glosem persony. Powitanie krotkie i personalne, bez auto-
 * prezentacji (patrz powitanieTekst). ElevenLabs gdy jest klucz, inaczej voice.ts.
 */
export async function mowPowitanie(
  agent: Agent,
  opcje: OpcjeMowyPersony = {},
): Promise<void> {
  await mowTekstem(agent, powitanieTekst(), opcje)
}

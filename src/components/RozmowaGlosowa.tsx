import { useEffect, useRef, useState } from 'react'
import { Mic, Square, X } from 'lucide-react'
import type { Agent } from '../data/agents'
import {
  startRozmowa,
  type StanRozmowy,
  type UchwytRozmowy,
} from '../lib/realtime'
import { mowPowitanie, mowTekstem, zatrzymajMowe } from '../lib/eleven'
import { sendMessage, type ChatMessage } from '../lib/ai'
import { isSttSupported, startListening, stopListening } from '../lib/voice'
import CharacterAvatar from './CharacterAvatar'
import MarkdownView from './MarkdownView'

/** Stan UI: 'gotowy' = przed startem, reszta z maszyny rozmowy. */
type StanUI = 'gotowy' | StanRozmowy
/** Ktory tor glosu realnie dziala. */
type TorGlosu = 'realtime' | 'podstawowy' | null

interface Props {
  agent: Agent
  onClose: () => void
}

/** Wykrywa preferencje ograniczonej animacji. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onZmiana = () => setReduced(mq.matches)
    mq.addEventListener('change', onZmiana)
    return () => mq.removeEventListener('change', onZmiana)
  }, [])
  return reduced
}

/** Aura box-shadow wokol portretu, reaguje na stan i poziom dzwieku. */
function auraCien(
  stan: StanUI,
  poziom: number,
  accent: string,
  reduced: boolean,
): string {
  const baza = `0 0 0 3px #0E0E11`
  if (reduced) return `${baza}, 0 0 0 5px ${accent}77`
  if (stan === 'slucham') {
    const r = (6 + poziom * 24).toFixed(1)
    const s = (2 + poziom * 10).toFixed(1)
    return `${baza}, 0 0 0 5px ${accent}, 0 0 ${r}px ${s}px ${accent}66`
  }
  if (stan === 'mowie') {
    return `${baza}, 0 0 0 5px ${accent}, 0 0 26px 6px ${accent}77`
  }
  if (stan === 'mysle' || stan === 'laczenie') {
    return `${baza}, 0 0 0 5px ${accent}aa, 0 0 18px 2px ${accent}55`
  }
  return `${baza}, 0 0 0 4px ${accent}55`
}

/**
 * Portret persony w rozmowie: wektor + PNG + wideo (gra podczas mowy agenta).
 * Aura jako box-shadow na okragłym portrecie, puls jako osobna warstwa.
 */
function PortretGlos({
  agent,
  mowa,
  aura,
  pulsuj,
  reduced,
}: {
  agent: Agent
  mowa: boolean
  aura: string
  pulsuj: boolean
  reduced: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Wideo odtwarza sie, gdy agent mowi (i ruch nie jest ograniczony).
  useEffect(() => {
    const v = videoRef.current
    if (!v || videoFailed || reduced) return
    if (mowa) {
      try {
        v.currentTime = 0
      } catch {
        // metadane moga nie byc gotowe
      }
      v.play().catch(() => {})
    } else {
      v.pause()
      try {
        v.currentTime = 0
      } catch {
        // ignorujemy
      }
    }
  }, [mowa, videoFailed, reduced])

  return (
    <div className="relative h-44 w-44 sm:h-52 sm:w-52">
      {pulsuj && !reduced && (
        <span
          className="node-pulse pointer-events-none absolute inset-0 rounded-full"
          style={{ ['--glow' as string]: `${agent.accent}88` }}
          aria-hidden
        />
      )}
      <div
        className="relative h-full w-full overflow-hidden rounded-full transition-shadow duration-150"
        style={{
          boxShadow: aura,
          background: `linear-gradient(135deg, ${agent.accent}2e, ${agent.accent}12)`,
        }}
      >
        <CharacterAvatar agent={agent} px={208} shape="circle" />
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
        {!videoFailed && (
          <video
            ref={videoRef}
            src={`${import.meta.env.BASE_URL}avatars/${agent.slug}.mp4`}
            muted
            playsInline
            loop
            preload="metadata"
            onError={() => setVideoFailed(true)}
            draggable={false}
            className={[
              'pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
              mowa && !videoFailed ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            aria-hidden
          />
        )}
      </div>
    </div>
  )
}

/**
 * Pelnoekranowy overlay rozmowy glosowej z persona.
 *
 * Start: powitanie glosem persony (ElevenLabs, fallback voice.ts), potem
 * probuje tor realtime (OpenAI Realtime WebRTC, mozg = buildSystemPrompt).
 * Gdy brak klucza OpenAI (503) -> tor podstawowy: voice.ts STT + mozg
 * sendMessage + glos persony (ElevenLabs albo Web Speech). Zamkniecie sprzata
 * mikrofon, WebRTC i audio.
 */
export default function RozmowaGlosowa({ agent, onClose }: Props) {
  const reduced = useReducedMotion()
  const [stan, setStan] = useState<StanUI>('gotowy')
  const [tor, setTor] = useState<TorGlosu>(null)
  const [transkryptUser, setTranskryptUser] = useState('')
  const [transkryptAgent, setTranskryptAgent] = useState('')
  const [odpowiedz, setOdpowiedz] = useState('')
  const [poziom, setPoziom] = useState(0)
  const [blad, setBlad] = useState<string | null>(null)
  const [baner, setBaner] = useState(false)

  const uchwytRef = useRef<UchwytRozmowy | null>(null)
  const historiaRef = useRef<ChatMessage[]>([])
  const aktywnyRef = useRef(true)

  const imie = agent.personImie ?? agent.name
  const mowaAgenta = stan === 'mowie'

  // --- Sprzatanie ------------------------------------------------------------

  function sprzataj() {
    aktywnyRef.current = false
    uchwytRef.current?.zakoncz()
    uchwytRef.current = null
    stopListening()
    zatrzymajMowe()
  }

  function zamknij() {
    sprzataj()
    onClose()
  }

  useEffect(() => {
    aktywnyRef.current = true
    return () => sprzataj()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc zamyka overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') zamknij()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Start rozmowy: powitanie -> tor realtime lub podstawowy ---------------

  function rozpocznij() {
    setBlad(null)
    setBaner(false)
    setOdpowiedz('')
    setTranskryptAgent('')
    setTranskryptUser('')
    setStan('mowie')
    // Powitanie glosem persony, po nim podlaczamy wlasciwy tor rozmowy.
    mowPowitanie(agent, {
      onEnd: () => {
        if (!aktywnyRef.current) return
        polaczRealtime()
      },
      onError: () => {
        if (!aktywnyRef.current) return
        polaczRealtime()
      },
    })
  }

  async function polaczRealtime() {
    try {
      const uchwyt = await startRozmowa(agent, {
        onStan: (s) => {
          if (aktywnyRef.current) setStan(s)
        },
        onTranskrypt: (tekst, kto, finalne) => {
          if (!aktywnyRef.current) return
          if (kto === 'user') {
            setTranskryptUser(tekst)
          } else {
            setTranskryptAgent(tekst)
            if (finalne) setOdpowiedz(tekst)
          }
        },
        onPoziom: (p) => {
          if (aktywnyRef.current) setPoziom(p)
        },
        onBlad: () => {
          // Blad w trakcie sesji: nie wywalamy, informujemy dyskretnie.
          if (aktywnyRef.current) setBlad('Cos przeszkodzilo w rozmowie.')
        },
      })
      if (!aktywnyRef.current) {
        uchwyt.zakoncz()
        return
      }
      uchwytRef.current = uchwyt
      setTor('realtime')
    } catch (err) {
      // Brak klucza OpenAI (503) albo inny problem realtime -> tor podstawowy.
      const kod = err instanceof Error ? err.message : String(err)
      if (kod !== 'brak-klucza') {
        // Zostawiamy slad w konsoli, UI po prostu schodzi na fallback.
        console.warn('Realtime niedostepny, tryb podstawowy:', kod)
      }
      if (!aktywnyRef.current) return
      setTor('podstawowy')
      setBaner(true)
      startPodstawowy()
    }
  }

  // --- Tor podstawowy (voice.ts STT + sendMessage + glos persony) ------------

  function startPodstawowy() {
    if (!isSttSupported()) {
      setStan('czuwa')
      setBlad(
        'Rozmowa glosem dziala w Chrome i Edge. Odpowiedz i tak przeczytam na glos.',
      )
      return
    }
    nasluch()
  }

  function nasluch() {
    if (!aktywnyRef.current) return
    setBlad(null)
    setTranskryptUser('')
    setStan('slucham')
    startListening({
      lang: 'pl-PL',
      onPartial: (t) => setTranskryptUser(t),
      onFinal: (t) => onUserFinal(t),
      onLevel: (v) => setPoziom(v),
      onError: (kod) => onSttError(kod),
    })
  }

  async function onUserFinal(tekst: string) {
    stopListening()
    setPoziom(0)
    const t = tekst.trim()
    if (!t) {
      setStan('czuwa')
      return
    }
    setTranskryptUser(t)
    setStan('mysle')
    setTranskryptAgent('')
    historiaRef.current.push({ role: 'user', content: t })
    try {
      const odp = await sendMessage(agent.slug, historiaRef.current)
      if (!aktywnyRef.current) return
      historiaRef.current.push({ role: 'assistant', content: odp })
      setOdpowiedz(odp)
      setTranskryptAgent(odp)
      setStan('mowie')
      mowTekstem(agent, odp, {
        onEnd: () => {
          if (!aktywnyRef.current) return
          // Petla hands-free: po odpowiedzi znow sluchamy.
          nasluch()
        },
      })
    } catch {
      if (!aktywnyRef.current) return
      setBlad('Nie udalo sie teraz odpowiedziec. Sprobuj ponownie.')
      setStan('czuwa')
    }
  }

  function onSttError(kod: string) {
    if (kod === 'mic-level') return
    if (kod === 'no-speech' || kod === 'aborted') {
      setStan('czuwa')
      return
    }
    if (kod === 'not-allowed' || kod === 'service-not-allowed') {
      setBlad('Nie mam dostepu do mikrofonu. Wlacz go w ustawieniach przegladarki.')
    } else if (kod === 'not-supported') {
      setBlad('Rozmowa glosem dziala w Chrome i Edge.')
    } else {
      setBlad('Cos przeszkodzilo w nasluchu. Sprobuj ponownie.')
    }
    setStan('czuwa')
  }

  /** Klik w portret/orb w torze podstawowym: start/stop/barge-in. */
  function klikPortret() {
    if (tor !== 'podstawowy') return // realtime ma auto-wykrywanie tury
    if (stan === 'slucham') {
      stopListening()
      setPoziom(0)
      setStan('czuwa')
    } else if (stan === 'mowie') {
      zatrzymajMowe()
      nasluch()
    } else if (stan === 'czuwa') {
      nasluch()
    }
  }

  // --- Etykieta stanu --------------------------------------------------------

  function etykieta(): string {
    if (blad) return blad
    switch (stan) {
      case 'gotowy':
        return `${imie} czeka. Kliknij, zeby zaczac.`
      case 'laczenie':
        return 'Lacze glos...'
      case 'mowie':
        return `${imie} mowi...`
      case 'slucham':
        return 'Slucham...'
      case 'mysle':
        return 'Mysle...'
      case 'czuwa':
        return tor === 'podstawowy' ? 'Twoja kolej, kliknij i mow' : 'Twoja kolej'
      case 'blad':
        return 'Cos poszlo nie tak.'
      default:
        return ''
    }
  }

  const pulsuj = stan === 'mysle' || stan === 'mowie' || stan === 'laczenie'
  const aura = auraCien(stan, poziom, agent.accent, reduced)
  const trwa = stan !== 'gotowy'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 p-6 backdrop-blur-md animate-fade-up"
      onClick={zamknij}
      role="dialog"
      aria-modal="true"
      aria-label={`Rozmowa glosowa z ${imie}`}
    >
      <button
        type="button"
        onClick={zamknij}
        aria-label="Zakoncz rozmowe"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
      >
        <X size={18} aria-hidden />
      </button>

      <div
        className="flex w-full max-w-xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Portret z aura reagujaca na dzwiek */}
        <button
          type="button"
          onClick={klikPortret}
          disabled={tor !== 'podstawowy'}
          aria-label={
            tor === 'podstawowy'
              ? 'Sterowanie nasluchem'
              : `Portret ${imie}`
          }
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-default"
        >
          <PortretGlos
            agent={agent}
            mowa={mowaAgenta}
            aura={aura}
            pulsuj={pulsuj}
            reduced={reduced}
          />
        </button>

        {/* Imie + rola */}
        <div className="mt-5 text-center">
          <div className="text-xl font-bold text-zinc-50">{imie}</div>
          <div
            className="mt-0.5 text-sm font-medium"
            style={{ color: agent.accent }}
          >
            {agent.role}
          </div>
        </div>

        {/* Etykieta stanu / wskaznik */}
        <div
          className={[
            'mt-4 text-sm font-medium',
            blad ? 'text-amber-200' : 'text-brand-soft',
          ].join(' ')}
          aria-live="polite"
        >
          {etykieta()}
        </div>

        {/* Przycisk startu (przed rozpoczeciem) */}
        {stan === 'gotowy' && (
          <button
            type="button"
            onClick={rozpocznij}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition-all hover:bg-brand-soft active:scale-95 motion-reduce:active:scale-100"
          >
            <Mic size={18} aria-hidden />
            Porozmawiaj z glosem
          </button>
        )}

        {/* Transkrypt na zywo: co powiedzial uzytkownik */}
        {trwa && transkryptUser && (
          <p
            className="mt-5 max-w-xl text-center text-base text-zinc-400"
            aria-live="polite"
          >
            {transkryptUser}
          </p>
        )}

        {/* Odpowiedz / transkrypt agenta */}
        {trwa && (transkryptAgent || odpowiedz) && (
          <div className="mt-5 max-h-56 w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left text-[0.95rem] leading-relaxed text-zinc-100">
            <MarkdownView>{odpowiedz || transkryptAgent}</MarkdownView>
          </div>
        )}

        {/* Plakietka trybu podstawowego (brak kluczy premium) */}
        {baner && (
          <p className="mt-5 max-w-md text-center text-xs text-zinc-500">
            Tryb podstawowy glosu. Dodaj klucze OpenAI i ElevenLabs w Vercel dla
            trybu premium (glos persony i plynny realtime).
          </p>
        )}

        {/* Akcje w trakcie rozmowy */}
        {trwa && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {tor === 'podstawowy' && (
              <button
                type="button"
                onClick={klikPortret}
                disabled={stan === 'mysle'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Square size={14} aria-hidden />
                {stan === 'slucham' ? 'Przerwij nasluch' : stan === 'mowie' ? 'Przerwij i mow' : 'Mow'}
              </button>
            )}
            <button
              type="button"
              onClick={zamknij}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-rose-300"
            >
              <X size={14} aria-hidden />
              Zakoncz
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

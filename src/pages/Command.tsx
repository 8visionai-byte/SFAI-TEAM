import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Mic,
  RotateCcw,
  Save,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { coo, teamAgents, getAgent, type Agent } from '../data/agents'
import { hasApiKey, getMode } from '../lib/ai'
import { runOrchestration, type ZdarzenieOrk } from '../lib/orchestrator'
import {
  isSttSupported,
  startListening,
  stopListening,
  speak,
  cancel,
  czyDostepnyGlosPL,
  czytajAutoWlaczone,
  czyAutoUstawione,
  ustawCzytajAuto,
} from '../lib/voice'
import {
  nowyId,
  zapiszNotatke,
  wczytajCentrum,
  zapiszCentrum,
  wyczyscCentrum,
  type WpisCentrum,
} from '../lib/storage'
import ChatMessage from '../components/ChatMessage'
import CharacterAvatar from '../components/CharacterAvatar'
import MarkdownView from '../components/MarkdownView'
import Toast, { useToast } from '../components/Toast'

// --- Pomocnicze -------------------------------------------------------------

/** Stan pojedynczego wezla mapy. */
type StanWezla = 'idle' | 'active' | 'done'
/** Stan orkiestratora COO. */
type StanCoo = 'idle' | 'thinking' | 'synth'

/** Stan trybu glosowego (orb + overlay). */
type GlosStan = 'czuwa' | 'slucham' | 'mysle' | 'mowie'

/** Etykiety stanow orbu w overlayu (SPEC-V19 2.1). */
const ETYKIETA_GLOSU: Record<GlosStan, string> = {
  czuwa: 'Kliknij i mow',
  slucham: 'Slucham...',
  mysle: 'Mysle...',
  mowie: 'Mowie...',
}

/** Klasa orbu zalezna od stanu (animacje z index.css). */
function orbKlasa(stan: GlosStan): string {
  const baza = 'orb relative flex items-center justify-center rounded-full'
  if (stan === 'slucham') return `${baza} orb-listen`
  if (stan === 'mysle') return `${baza} orb-think`
  if (stan === 'mowie') return `${baza} orb-speak orb-wave`
  return baza
}

/** Wpis w panelu czatu (wspoldzielony z warstwa trwalosci). */
type Wpis = WpisCentrum

const STANY_POCZATKOWE: Record<string, StanWezla> = Object.fromEntries(
  teamAgents.map((a) => [a.slug, 'idle' as StanWezla]),
)

const PRZYKLADY = [
  'Mam cel: 10 projektow w tym miesiacu. Rozloz go na zespol i powiedz od czego zaczac.',
  'Klient mowi, ze automatyzacja AI jest niebezpieczna dla jego danych. Jak to rozegrac?',
  'Zaplanuj kampanie na LinkedIn, ktora przyciagnie wlascicieli MSP na bezplatna diagnoze.',
]

const KOLOR_DONE = '#34D399'
/** Hairline oddzielajacy pierscienie-aure od portretu (prawie czern pod UI). */
const HAIRLINE = '#0E0E11'
/** Mikrozloty akcent syntezy (uzywany oszczednie, tylko przy skladaniu). */
const ZLOTO = '#E8C879'

/** Odstep okregu od krawedzi sceny (miejsce na wezel 80px + podpis nazwa/rola). */
const MARG = 108

/**
 * Podwojny pierscien-aura specjalisty (box-shadow, od wewnatrz).
 * idle: cienki wygaszony pierscien. active: podwojny ring + glow w akcencie.
 * done: pierscien zielony bez glow. Wartosci wg ART-SPEC-V18 sekcja 2.2.
 */
function auraSpecjalisty(stan: StanWezla, accent: string): string {
  if (stan === 'active') {
    return `0 0 0 3px ${HAIRLINE}, 0 0 0 5px ${accent}, 0 0 0 9px ${accent}44, 0 0 22px 2px ${accent}66`
  }
  if (stan === 'done') {
    return `0 0 0 3px ${HAIRLINE}, 0 0 0 5px ${KOLOR_DONE}, 0 0 0 9px ${KOLOR_DONE}33`
  }
  return `0 0 0 3px ${HAIRLINE}, 0 0 0 4px ${accent}33`
}

/**
 * Pierscien-aura COO (bazowy kolor brand). W thinking i synth ring aktywny.
 * W synth dodatkowo mikrozloty hairline nad ringiem (moment zlozenia odpowiedzi).
 */
function auraCoo(stanCoo: StanCoo): string {
  const brand = '#5B8DEF'
  if (stanCoo === 'synth') {
    return `0 0 0 3px ${HAIRLINE}, 0 0 0 4px ${ZLOTO}aa, 0 0 0 6px ${brand}, 0 0 0 10px ${brand}44, 0 0 22px 2px ${brand}66`
  }
  if (stanCoo === 'thinking') {
    return `0 0 0 3px ${HAIRLINE}, 0 0 0 5px ${brand}, 0 0 0 9px ${brand}44, 0 0 22px 2px ${brand}66`
  }
  return `0 0 0 3px ${HAIRLINE}, 0 0 0 4px ${brand}33`
}

/** Wykrywa preferencje ograniczonej animacji i reaguje na jej zmiany. */
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

// --- Mapa neuronu -----------------------------------------------------------

interface MapaProps {
  stanCoo: StanCoo
  stany: Record<string, StanWezla>
  /** Gdy zespol pracuje, wezly nie sa klikalne (klik prowadzi do profilu). */
  running?: boolean
}

/** Wyliczona geometria pojedynczego specjalisty na okregu. */
interface Wezel {
  slug: string
  nx: number
  ny: number
  d: string
  ctrlx: number
  ctrly: number
}

/** Punkt na kwadratowej krzywej Beziera dla parametru t (0..1). */
function punktBezier(
  x0: number,
  y0: number,
  cxp: number,
  cyp: number,
  x1: number,
  y1: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t
  const x = u * u * x0 + 2 * u * t * cxp + t * t * x1
  const y = u * u * y0 + 2 * u * t * cyp + t * t * y1
  return { x, y }
}

interface PortretProps {
  agent: Agent
  /** realny rozmiar w px (steruje bramka detali portretu wektorowego) */
  px: number
  /** klasy rozmiaru kontenera (skaluja portret na mniejszych ekranach) */
  sizeClass: string
  /** pierscien-aura jako box-shadow (2.2) */
  aura: string
  /** czy aura ma oddychac (node-pulse) */
  pulsuj: boolean
  /** kolor poswiaty pulsu (--glow) */
  glow: string
  /** wygaszenie w stanie idle */
  przygaszony?: boolean
}

/**
 * Okragly portret persony w scenie neuronu: wektorowy CharacterAvatar (shape
 * 'circle') w kontenerze z podwojnym pierscieniem-aura (box-shadow). Puls aury
 * jest osobna warstwa (node-pulse), zeby nie nadpisywac statycznego ringu.
 * Gdy istnieje PNG (wersja premium z Higgsfield), przykrywa wektor po zaladowaniu.
 */
function Portret({
  agent,
  px,
  sizeClass,
  aura,
  pulsuj,
  glow,
  przygaszony = false,
}: PortretProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div
      className={`avatar-hover relative ${sizeClass}`}
      style={{ ['--accent-ring' as string]: glow }}
    >
      {/* Puls aury jako osobna warstwa (nie koliduje ze statycznym ringiem) */}
      {pulsuj && (
        <span
          className="node-pulse pointer-events-none absolute inset-0 rounded-full"
          style={{ ['--glow' as string]: glow }}
          aria-hidden
        />
      )}
      <div
        className={[
          'relative h-full w-full overflow-hidden rounded-full transition-opacity duration-300',
          przygaszony ? 'opacity-90' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          boxShadow: aura,
          background: `linear-gradient(135deg, ${agent.accent}2e, ${agent.accent}12)`,
        }}
      >
        <CharacterAvatar agent={agent} px={px} shape="circle" />
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
      </div>
    </div>
  )
}

/**
 * Uklad radialny (neuron): COO w srodku, specjalisci rownomiernie na okregu,
 * zakrzywione nici SVG (Q-bezier) od srodka do kazdego wezla. Podczas pracy po
 * nici plynie czasteczka w kolorze agenta; po zakonczeniu wraca do COO i nic
 * zielenieje. Geometria liczona matematycznie i skalowana przez ResizeObserver.
 */
function MapaNeuronu({ stanCoo, stany, running = false }: MapaProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [wym, setWym] = useState({ w: 0, h: 0 })
  const reduced = useReducedMotion()

  // Czasteczki powrotu (specjalista -> COO) pokazywane ~700ms po 'active'->'done'.
  // Licznik (nie flaga): kazde przejscie zwieksza wartosc, a zmiana klucza JSX
  // wymusza remount <animateMotion>, wiec SMIL startuje od nowa za kazdym razem.
  const [powroty, setPowroty] = useState<Record<string, number>>({})
  const prevStany = useRef<Record<string, StanWezla>>(stany)
  // Timery ukrycia per agent, NIEZALEZNE od cyklu efektu (kasowane tylko przy
  // odmontowaniu). Wczesniej cleanup efektu kasowal je przy kazdej zmianie
  // stanow i kropki "wisialy" albo nie wracaly przy kolejnych delegacjach.
  const powrotTimery = useRef<Record<string, number>>({})

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const zmierz = () => {
      const r = el.getBoundingClientRect()
      setWym({ w: r.width, h: r.height })
    }
    zmierz()
    const ro = new ResizeObserver(zmierz)
    ro.observe(el)
    window.addEventListener('resize', zmierz)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', zmierz)
    }
  }, [])

  useEffect(() => {
    if (reduced) {
      prevStany.current = stany
      return
    }
    const prev = prevStany.current
    for (const a of teamAgents) {
      const p = prev[a.slug] ?? 'idle'
      const c = stany[a.slug] ?? 'idle'
      if (p === 'active' && c === 'done') {
        // Nowe zdarzenie powrotu: skasuj poprzedni timer TEGO agenta (jesli
        // wisi) i podbij licznik, zeby czasteczka zawsze wystartowala od zera.
        if (powrotTimery.current[a.slug]) {
          clearTimeout(powrotTimery.current[a.slug])
        }
        setPowroty((r) => ({ ...r, [a.slug]: (r[a.slug] ?? 0) + 1 }))
        powrotTimery.current[a.slug] = window.setTimeout(() => {
          delete powrotTimery.current[a.slug]
          setPowroty((r) => {
            const n = { ...r }
            delete n[a.slug]
            return n
          })
        }, 750)
      }
    }
    prevStany.current = stany
  }, [stany, reduced])

  // Sprzatanie timerow powrotu wylacznie przy odmontowaniu mapy.
  useEffect(() => {
    const timery = powrotTimery.current
    return () => {
      Object.values(timery).forEach((id) => clearTimeout(id))
    }
  }, [])

  const cooAktywny = stanCoo !== 'idle'
  const { w, h } = wym
  const gotowe = w > 0 && h > 0
  const cx = w / 2
  const cy = h / 2
  const N = teamAgents.length
  const R = Math.max(150, w / 2 - MARG)

  const wezly: Wezel[] = gotowe
    ? teamAgents.map((a, i) => {
        const theta = -Math.PI / 2 + i * ((2 * Math.PI) / N)
        const nx = cx + R * Math.cos(theta)
        const ny = cy + R * Math.sin(theta)
        const dx = nx - cx
        const dy = ny - cy
        const mx = (cx + nx) / 2
        const my = (cy + ny) / 2
        const len = Math.hypot(dx, dy) || 1
        const nrmx = -dy / len
        const nrmy = dx / len
        const bow = 0.16 * len
        const ctrlx = mx + nrmx * bow
        const ctrly = my + nrmy * bow
        const d = `M ${cx} ${cy} Q ${ctrlx} ${ctrly} ${nx} ${ny}`
        return { slug: a.slug, nx, ny, d, ctrlx, ctrly }
      })
    : []

  return (
    <div
      ref={stageRef}
      className="relative mx-auto aspect-square w-full max-w-[640px]"
    >
      {/* Warstwa 0: glebokie tlo sceny (radial + winieta + siatka) */}
      <div
        className="neuron-scene-bg pointer-events-none absolute inset-0 z-0 rounded-3xl"
        aria-hidden
      />

      {/* Warstwa nici (SVG) pod wezlami */}
      {gotowe && (
        <svg
          className="pointer-events-none absolute inset-0 z-[1]"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden
        >
          <defs>
            <filter
              id="nicGlow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="3.0" />
            </filter>
            {wezly.map((n) => {
              const agent = getAgent(n.slug)
              const kolor = agent?.accent ?? '#5B8DEF'
              return (
                <linearGradient
                  key={n.slug}
                  id={`grad-${n.slug}`}
                  gradientUnits="userSpaceOnUse"
                  x1={cx}
                  y1={cy}
                  x2={n.nx}
                  y2={n.ny}
                >
                  <stop offset="0%" stopColor={kolor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={kolor} stopOpacity={1} />
                </linearGradient>
              )
            })}
          </defs>

          {/* Orbita-prowadnica: ledwo widoczny slad okregu wezlow (premium) */}
          <circle
            cx={cx}
            cy={cy}
            r={R}
            stroke="#ffffff"
            strokeOpacity={0.04}
            strokeWidth={1}
            fill="none"
            strokeDasharray="2 6"
          />

          {wezly.map((n) => {
            const stan = stany[n.slug] ?? 'idle'
            const agent = getAgent(n.slug)
            const accent = agent?.accent ?? '#5B8DEF'
            const kolor = stan === 'active' ? accent : KOLOR_DONE
            const powrot = powroty[n.slug]
            // Statyczna kropka na 60% nici, gdy ruch ograniczony.
            const p60 =
              stan === 'active' && reduced
                ? punktBezier(cx, cy, n.ctrlx, n.ctrly, n.nx, n.ny, 0.6)
                : null
            return (
              <g key={n.slug}>
                {/* Baza: zawsze delikatna nic */}
                <path
                  d={n.d}
                  stroke="#3f3f46"
                  strokeWidth={1.6}
                  fill="none"
                  opacity={0.5}
                />
                {stan !== 'idle' && (
                  <>
                    {/* Rozmyta kopia pod ostra nakladka (poswiata / glebia) */}
                    <path
                      d={n.d}
                      stroke={
                        stan === 'active' ? `url(#grad-${n.slug})` : KOLOR_DONE
                      }
                      strokeWidth={stan === 'active' ? 3.4 : 2.6}
                      strokeLinecap="round"
                      fill="none"
                      opacity={0.55}
                      filter="url(#nicGlow)"
                    />
                    {/* Ostra nakladka: aktywna z gradientem, gotowa na zielono */}
                    <path
                      id={`nic-${n.slug}`}
                      d={n.d}
                      stroke={
                        stan === 'active' ? `url(#grad-${n.slug})` : KOLOR_DONE
                      }
                      strokeWidth={stan === 'active' ? 3.4 : 2.6}
                      strokeLinecap="round"
                      fill="none"
                      className={
                        stan === 'active' && !reduced ? 'thread-flow' : undefined
                      }
                      opacity={stan === 'active' ? 1 : 0.85}
                    />
                  </>
                )}

                {/* Czasteczka plynaca podczas pracy (COO -> specjalista) */}
                {stan === 'active' && !reduced && (
                  <circle r={4.6} fill={accent} filter="url(#nicGlow)">
                    <animateMotion
                      dur="1.05s"
                      repeatCount="indefinite"
                      keyPoints="0;1"
                      keyTimes="0;1"
                      calcMode="linear"
                    >
                      <mpath href={`#nic-${n.slug}`} />
                    </animateMotion>
                  </circle>
                )}

                {/* Czasteczka powrotu po zakonczeniu (specjalista -> COO).
                    Klucz z licznikiem = swiezy element przy kazdym zdarzeniu,
                    wiec animacja SMIL zawsze startuje od poczatku. */}
                {powrot && !reduced && (
                  <circle
                    key={`powrot-${n.slug}-${powrot}`}
                    r={4.0}
                    fill={KOLOR_DONE}
                    filter="url(#nicGlow)"
                  >
                    <animateMotion
                      dur="0.7s"
                      repeatCount="1"
                      keyPoints="1;0"
                      keyTimes="0;1"
                      calcMode="linear"
                    >
                      <mpath href={`#nic-${n.slug}`} />
                    </animateMotion>
                  </circle>
                )}

                {/* Ograniczony ruch: statyczny wskaznik zamiast czasteczki */}
                {p60 && <circle cx={p60.x} cy={p60.y} r={4.6} fill={kolor} />}
              </g>
            )
          })}

          {/* Synteza: 1-2 zlote krople "esencji" plyna do COO (oszczednie) */}
          {stanCoo === 'synth' &&
            !reduced &&
            wezly
              .filter((n) => (stany[n.slug] ?? 'idle') === 'done')
              .slice(0, 2)
              .map((n) => (
                <circle key={`zloto-${n.slug}`} r={1.6} fill={ZLOTO} opacity={0.75}>
                  <animateMotion
                    dur="1.4s"
                    repeatCount="indefinite"
                    keyPoints="1;0"
                    keyTimes="0;1"
                    calcMode="linear"
                  >
                    <mpath href={`#nic-${n.slug}`} />
                  </animateMotion>
                </circle>
              ))}
        </svg>
      )}

      {/* COO w geometrycznym srodku (klik, gdy nie trwa praca -> profil) */}
      {gotowe &&
        (() => {
          const zawartoscCoo = (
            <div className="flex flex-col items-center text-center">
              <Portret
                agent={coo}
                px={112}
                sizeClass="h-24 w-24 sm:h-28 sm:w-28"
                aura={auraCoo(stanCoo)}
                pulsuj={cooAktywny}
                glow="#5B8DEFaa"
              />
              <div className="mt-2 w-40 leading-tight">
                <div className="text-sm font-semibold text-zinc-50">
                  {coo.name}
                </div>
                <div className="text-xs font-medium text-brand-soft">
                  {stanCoo === 'thinking'
                    ? 'Analizuje i planuje...'
                    : stanCoo === 'synth'
                      ? 'Sklada odpowiedz...'
                      : coo.role}
                </div>
              </div>
            </div>
          )
          const stylCoo = {
            left: cx,
            top: cy,
            transform: 'translate(-50%,-50%)',
          }
          return running ? (
            <div className="absolute z-10" style={stylCoo}>
              {zawartoscCoo}
            </div>
          ) : (
            <Link
              to={`/agent/${coo.slug}`}
              aria-label={`Profil agenta ${coo.name}`}
              title={coo.name}
              className="absolute z-10 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              style={stylCoo}
            >
              {zawartoscCoo}
            </Link>
          )
        })()}

      {/* Specjalisci na okregu */}
      {wezly.map((n) => {
        const a = getAgent(n.slug)!
        const stan = stany[n.slug] ?? 'idle'
        const pokazChipy = stan === 'active' || stan === 'done'
        // Kolor roli w podpisie: akcent gdy pracuje, zielony gdy gotowe.
        const rolaKolor =
          stan === 'active' ? a.accent : stan === 'done' ? KOLOR_DONE : undefined
        const zawartoscWezla = (
          <div className="flex flex-col items-center text-center">
            <Portret
              agent={a}
              px={80}
              sizeClass="h-16 w-16 sm:h-20 sm:w-20"
              aura={auraSpecjalisty(stan, a.accent)}
              pulsuj={stan === 'active'}
              glow={`${a.accent}aa`}
              przygaszony={stan === 'idle'}
            />
            <div
              className="mt-2 w-[96px] text-[0.72rem] font-medium leading-tight"
              style={{ color: rolaKolor }}
            >
              <span className={rolaKolor ? undefined : 'text-zinc-300'}>
                {a.role}
              </span>
            </div>
          </div>
        )
        return (
          <div
            key={n.slug}
            className="absolute z-10 flex flex-col items-center"
            style={{ left: n.nx, top: n.ny, transform: 'translate(-50%,-50%)' }}
          >
            {/* Klik w wezel (gdy nie trwa praca) otwiera profil agenta */}
            {running ? (
              <div
                className="flex flex-col items-center"
                title={a.name}
                aria-label={a.name}
              >
                {zawartoscWezla}
              </div>
            ) : (
              <Link
                to={`/agent/${n.slug}`}
                aria-label={`Profil agenta ${a.name}`}
                title={a.name}
                className="flex flex-col items-center rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                {zawartoscWezla}
              </Link>
            )}

            {/* Chipy zespolu wykonawczego (pod podpisem, nie zaslaniaja sasiadow) */}
            {pokazChipy && (
              <div className="pointer-events-none absolute left-1/2 top-full mt-1 flex -translate-x-1/2 flex-wrap justify-center gap-1">
                {a.subagents.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className={[
                      'whitespace-nowrap rounded-full border bg-zinc-950/80 px-1.5 py-0.5 text-[0.6rem] leading-none text-zinc-400',
                      stan === 'active' && !reduced ? 'chip-flicker' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ borderColor: `${a.accent}55` }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- Strona -----------------------------------------------------------------

export default function Command() {
  const [wpisy, setWpisy] = useState<Wpis[]>(() => wczytajCentrum())
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [stanCoo, setStanCoo] = useState<StanCoo>('idle')
  const [stany, setStany] =
    useState<Record<string, StanWezla>>(STANY_POCZATKOWE)
  const [potwierdzWyczysc, setPotwierdzWyczysc] = useState(false)
  const { toast, pokazToast } = useToast()

  // --- Glos JARVIS: stan trybu glosowego ---
  const sttOK = isSttSupported()
  const [glosOtwarty, setGlosOtwarty] = useState(false)
  const [glosStan, setGlosStan] = useState<GlosStan>('czuwa')
  const [glosTranskrypt, setGlosTranskrypt] = useState('')
  const [glosOdpowiedz, setGlosOdpowiedz] = useState('')
  const [glosPoziom, setGlosPoziom] = useState(0)
  const [glosBlad, setGlosBlad] = useState<string | null>(null)
  const [czytajAuto, setCzytajAuto] = useState(() => czytajAutoWlaczone())
  // Znacznik: biezacy przebieg zostal odpalony glosem (final ma isc do TTS/overlay).
  const glosAktywnyRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Tryb pracy (demo/realny) do dyskretnego wskaznika nad czatem.
  const tryb = getMode()

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [wpisy, running])

  // Trwalosc: zapisujemy finalny ksztalt przebiegu po zakonczeniu pracy zespolu.
  useEffect(() => {
    if (!running && wpisy.length > 0) {
      zapiszCentrum(wpisy)
    }
  }, [wpisy, running])

  function dopisz(w: Wpis) {
    setWpisy((prev) => [...prev, w])
  }

  function obsluzZdarzenie(z: ZdarzenieOrk) {
    switch (z.typ) {
      case 'plan': {
        if (z.tryb === 'deleguj') {
          // COO oddaje robote specjalistom: przestaje pulsowac, czeka na raporty.
          setStanCoo('idle')
          const nazwy = z.plan
            .map((p) => getAgent(p.agent)?.name ?? p.agent)
            .join(', ')
          dopisz({ rodzaj: 'system', tekst: `COO deleguje do: ${nazwy}` })
        } else {
          dopisz({ rodzaj: 'system', tekst: 'COO odpowiada sam.' })
        }
        break
      }
      case 'start': {
        setStany((prev) => ({ ...prev, [z.agent]: 'active' }))
        const nazwa = getAgent(z.agent)?.name ?? z.agent
        dopisz({ rodzaj: 'system', tekst: `${nazwa} pracuje...` })
        break
      }
      case 'koniec': {
        setStany((prev) => ({ ...prev, [z.agent]: 'done' }))
        const nazwa = getAgent(z.agent)?.name ?? z.agent
        dopisz({ rodzaj: 'system', tekst: `${nazwa} skonczyl.` })
        break
      }
      case 'synteza': {
        setStanCoo('synth')
        dopisz({ rodzaj: 'system', tekst: 'COO sklada odpowiedz...' })
        break
      }
      case 'final': {
        dopisz({ rodzaj: 'final', tekst: z.text })
        // Tryb glosowy: pokaz odpowiedz w overlayu i (gdy wlaczone) przeczytaj.
        if (glosAktywnyRef.current) {
          setGlosOdpowiedz(z.text)
          if (czytajAutoWlaczone()) {
            setGlosStan('mowie')
            speak(z.text, {
              onEnd: () => setGlosStan('czuwa'),
              onError: () => setGlosStan('czuwa'),
            })
          } else {
            setGlosStan('czuwa')
          }
        }
        break
      }
      case 'blad': {
        const nazwa = z.agent ? getAgent(z.agent)?.name ?? z.agent : null
        dopisz({
          rodzaj: 'system',
          tekst: nazwa
            ? `Problem u agenta ${nazwa}: ${z.wiadomosc}`
            : `Problem: ${z.wiadomosc}`,
        })
        break
      }
    }
  }

  async function zapytaj(tekst: string) {
    const trimmed = tekst.trim()
    if (!trimmed || running) return

    dopisz({ rodzaj: 'user', tekst: trimmed })
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
    setStany(STANY_POCZATKOWE)
    setStanCoo('thinking')
    setRunning(true)

    try {
      await runOrchestration(trimmed, obsluzZdarzenie)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      dopisz({
        rodzaj: 'final',
        tekst: `Cos poszlo nie tak po mojej stronie: ${msg}. Sprobuj ponownie za chwile.`,
      })
      // Tryb glosowy: nie zostawiaj orbu w "mysle" po nieoczekiwanym bledzie.
      if (glosAktywnyRef.current) {
        setGlosBlad('Cos poszlo nie tak. Sprobuj ponownie.')
        setGlosStan('czuwa')
      }
    } finally {
      setRunning(false)
      setStanCoo('idle')
    }
  }

  // --- Glos JARVIS: sterowanie trybem glosowym ------------------------------

  /** Rozpoczyna nasluch (stan slucham) i podpina transkrypcje na zywo. */
  function startNasluchu() {
    setGlosBlad(null)
    setGlosTranskrypt('')
    setGlosStan('slucham')
    startListening({
      lang: 'pl-PL',
      onPartial: (t) => setGlosTranskrypt(t),
      onFinal: (t) => {
        setGlosTranskrypt(t)
        onGlosFinal(t)
      },
      onLevel: (v) => setGlosPoziom(v),
      onError: (kod, _wiad) => obsluzBladGlosu(kod),
    })
  }

  /** Po zatwierdzonej transkrypcji: odpal ta sama orkiestracje co czat tekstowy. */
  function onGlosFinal(tekst: string) {
    const t = tekst.trim()
    if (!t) {
      setGlosStan('czuwa')
      return
    }
    stopListening()
    setGlosPoziom(0)
    setGlosStan('mysle')
    setGlosOdpowiedz('')
    glosAktywnyRef.current = true
    zapytaj(t)
  }

  /** Mapuje kody bledu STT na komunikat po polsku i wraca do czuwania. */
  function obsluzBladGlosu(kod: string) {
    if (kod === 'mic-level') return // sam metr poziomu, nie blokuje nasluchu
    if (kod === 'no-speech' || kod === 'aborted') {
      setGlosStan('czuwa')
      return
    }
    if (kod === 'not-allowed' || kod === 'service-not-allowed') {
      setGlosBlad(
        'Nie mam dostepu do mikrofonu. Wlacz go w ustawieniach przegladarki.',
      )
    } else if (kod === 'not-supported') {
      setGlosBlad('Tryb glosowy dziala w przegladarce Chrome i Edge.')
    } else {
      setGlosBlad('Cos przeszkodzilo w nasluchu. Sprobuj ponownie.')
    }
    setGlosStan('czuwa')
  }

  /** Otwiera overlay i od razu zaczyna nasluch (klik orbu obok pola). */
  function otworzGlos() {
    if (!sttOK || running) return
    // Domyslnie wlaczamy auto-czytanie przy pierwszym uzyciu glosu.
    if (!czyAutoUstawione()) {
      ustawCzytajAuto(true)
      setCzytajAuto(true)
    }
    setGlosOdpowiedz('')
    setGlosOtwarty(true)
    startNasluchu()
  }

  /** Klik w orb overlay: start/stop/przerwanie zaleznie od stanu. */
  function klikOrb() {
    if (glosStan === 'slucham') {
      stopListening()
      setGlosPoziom(0)
      setGlosStan('czuwa')
    } else if (glosStan === 'mowie') {
      cancel()
      setGlosStan('czuwa')
    } else if (glosStan === 'czuwa') {
      startNasluchu()
    }
    // 'mysle': zespol juz pracuje, orkiestracji nie przerywamy.
  }

  /** Zamyka overlay i sprzata nasluch oraz czytanie. */
  function zamknijGlos() {
    stopListening()
    cancel()
    glosAktywnyRef.current = false
    setGlosOtwarty(false)
    setGlosStan('czuwa')
    setGlosTranskrypt('')
    setGlosPoziom(0)
    setGlosBlad(null)
  }

  /** Ponownie czyta ostatnia odpowiedz (przycisk "Powtorz glosem"). */
  function powtorzGlosem() {
    if (!glosOdpowiedz) return
    setGlosStan('mowie')
    speak(glosOdpowiedz, {
      onEnd: () => setGlosStan('czuwa'),
      onError: () => setGlosStan('czuwa'),
    })
  }

  /** Przelacza auto-czytanie odpowiedzi (wspoldzielone z Ustawieniami). */
  function przelaczCzytaj() {
    const nowy = !czytajAuto
    setCzytajAuto(nowy)
    ustawCzytajAuto(nowy)
    if (!nowy) cancel()
  }

  // Esc zamyka overlay; sprzataj nasluch/czytanie przy odmontowaniu.
  useEffect(() => {
    if (!glosOtwarty) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') zamknijGlos()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glosOtwarty])

  useEffect(() => {
    return () => {
      stopListening()
      cancel()
    }
  }, [])

  /** Zapisuje przebieg pracy zespolu jako notatke (sf_notatki). */
  function zapiszDoPamieci() {
    if (wpisy.length === 0) return
    const pierwszy = wpisy.find((w) => w.rodzaj === 'user')
    const tytulRaw = (pierwszy?.tekst ?? 'Praca zespolu').trim()
    const tytul =
      tytulRaw.length > 60 ? `${tytulRaw.slice(0, 60)}...` : tytulRaw
    const tresc = wpisy
      .map((w) => {
        if (w.rodzaj === 'user') return `**Ty:** ${w.tekst}`
        if (w.rodzaj === 'final') return `**Odpowiedz zespolu:** ${w.tekst}`
        return `_${w.tekst}_`
      })
      .join('\n\n')
    zapiszNotatke({
      id: nowyId(),
      zrodlo: 'Centrum Dowodzenia',
      data: new Date().toISOString(),
      tytul,
      tresc,
    })
    pokazToast(
      'Zapisano notatkę. W kolejnej wersji trafi automatycznie do mózgu firmy.',
    )
  }

  /** Kasuje biezacy przebieg Centrum (log + stany wezlow). */
  function wyczyscRozmowe() {
    wyczyscCentrum()
    setWpisy([])
    setStany(STANY_POCZATKOWE)
    setStanCoo('idle')
    setPotwierdzWyczysc(false)
    pokazToast('Wyczyszczono biezaca rozmowe.')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      zapytaj(input)
    }
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Lewa czesc: mapa neuronu (~60%) */}
      <section className="flex min-h-0 flex-col border-b border-zinc-800/80 lg:w-3/5 lg:border-b-0 lg:border-r">
        <header className="border-b border-zinc-800/80 bg-zinc-950/80 px-5 py-4 backdrop-blur sm:px-8">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            <Sparkles size={12} className="text-brand-soft" aria-hidden />
            Centrum Dowodzenia
          </div>
          <h1 className="text-lg font-semibold leading-tight text-zinc-50">
            Zespol w akcji
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            COO rozklada Twoje pytanie na zadania, deleguje do specjalistow i
            sklada jedna odpowiedz. Sledz przeplyw na zywo.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          <MapaNeuronu stanCoo={stanCoo} stany={stany} running={running} />

          <p className="mt-6 text-center text-xs text-zinc-600">
            COO w srodku, zespol na okregu. Aktywna nic swieci kolorem
            specjalisty, ukonczona na zielono.
          </p>
        </div>
      </section>

      {/* Prawa czesc: panel czatu (~40%) */}
      <section className="flex min-h-0 flex-1 flex-col lg:w-2/5">
        {/* Wskaznik trybu nad czatem (dyskretny) */}
        <div className="flex items-center gap-2 border-b border-zinc-800/80 bg-zinc-950/80 px-5 py-2 text-[0.7rem] font-medium text-zinc-500 sm:px-6">
          <span
            className={[
              'h-1.5 w-1.5 flex-shrink-0 rounded-full',
              tryb === 'demo' ? 'bg-amber-400/70' : 'bg-emerald-400/80',
            ].join(' ')}
            aria-hidden
          />
          <span>{tryb === 'demo' ? 'Tryb demo, symulacja przeplywu' : 'Tryb realny'}</span>
        </div>
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto"
          role="log"
          aria-live="polite"
          aria-label="Przebieg pracy zespolu"
        >
          <div className="space-y-4 px-5 py-6 sm:px-6">
            {!hasApiKey() && (
              <div className="flex flex-col gap-2 rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm text-brand-soft sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-start gap-2.5">
                  <SettingsIcon
                    size={16}
                    className="mt-0.5 flex-shrink-0"
                    aria-hidden
                  />
                  <span>
                    Tryb demo. Dodaj swoj klucz Anthropic w Ustawieniach, aby
                    zespol pracowal naprawde.
                  </span>
                </span>
                <Link
                  to="/ustawienia"
                  className="inline-flex flex-shrink-0 items-center gap-1.5 self-start rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-brand-soft sm:self-auto"
                >
                  Przejdz do Ustawien
                </Link>
              </div>
            )}

            {wpisy.length === 0 && (
              <div className="animate-fade-up">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <p className="text-sm leading-relaxed text-zinc-300">
                    Powiedz COO swoj cel albo problem. On zdecyduje, czy odpowie
                    sam, czy odpali zespol.
                  </p>
                </div>
                <div className="mt-5">
                  <div className="mb-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Przyklady pytan
                  </div>
                  <div className="flex flex-col gap-2">
                    {PRZYKLADY.map((s) => (
                      <button
                        key={s}
                        onClick={() => zapytaj(s)}
                        disabled={running}
                        className="group flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-2.5 text-left text-sm text-zinc-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:hover:translate-y-0"
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand opacity-70 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {wpisy.map((w, i) => {
              if (w.rodzaj === 'user') {
                return (
                  <ChatMessage
                    key={i}
                    role="user"
                    content={w.tekst}
                    agent={coo}
                  />
                )
              }
              if (w.rodzaj === 'final') {
                return (
                  <ChatMessage
                    key={i}
                    role="assistant"
                    content={w.tekst}
                    agent={coo}
                  />
                )
              }
              // Wiersz procesu (systemowy), dyskretny.
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 pl-1 text-xs text-zinc-500 animate-fade-up"
                >
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-600"
                    aria-hidden
                  />
                  <span>{w.tekst}</span>
                </div>
              )
            })}

            {running && (
              <div className="flex items-center gap-2 pl-1 text-xs text-zinc-500 animate-fade-up">
                <span className="thinking-dot" aria-hidden>
                  .
                </span>
                <span
                  className="thinking-dot"
                  style={{ animationDelay: '0.2s' }}
                  aria-hidden
                >
                  .
                </span>
                <span
                  className="thinking-dot"
                  style={{ animationDelay: '0.4s' }}
                  aria-hidden
                >
                  .
                </span>
                <span className="ml-1">zespol pracuje</span>
              </div>
            )}
          </div>
        </div>

        {/* Pole wpisywania */}
        <div className="border-t border-zinc-800/80 bg-zinc-950 px-5 py-4 sm:px-6">
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={otworzGlos}
              disabled={!sttOK || running}
              aria-label="Rozmawiaj glosem z COO"
              title={
                sttOK
                  ? 'Rozmawiaj glosem z COO'
                  : 'Glos dziala w Chrome i Edge'
              }
              className={[
                orbKlasa('czuwa'),
                'h-12 w-12 flex-shrink-0',
                !sttOK ? 'opacity-40' : '',
                'disabled:cursor-not-allowed disabled:opacity-40',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Mic size={18} aria-hidden />
            </button>
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                const ta = e.currentTarget
                ta.style.height = 'auto'
                ta.style.height = `${ta.scrollHeight}px`
              }}
              onKeyDown={onKeyDown}
              rows={1}
              aria-label="Napisz pytanie do COO"
              placeholder="Powiedz COO cel albo problem..."
              className="max-h-40 min-h-[48px] flex-1 resize-none overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-[0.95rem] leading-relaxed text-zinc-100 shadow-card outline-none transition-colors placeholder:text-zinc-600 focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
            />
            <button
              onClick={() => zapytaj(input)}
              disabled={running || !input.trim()}
              aria-label="Wyslij pytanie do COO"
              className="flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-zinc-950 shadow-glow transition-all hover:bg-brand-soft active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none motion-reduce:active:scale-100"
            >
              <Send size={16} aria-hidden />
              <span className="hidden sm:inline">Wyslij</span>
            </button>
          </div>

          {!sttOK && (
            <p className="mt-2 text-xs text-zinc-600">
              Tryb glosowy dziala w przegladarce Chrome i Edge. W tej
              przegladarce uzyj pola tekstowego.
            </p>
          )}

          {/* Potwierdzenie czyszczenia (inline, bez natywnego alertu) */}
          {potwierdzWyczysc && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2.5 text-xs text-rose-200 sm:flex-row sm:items-center sm:justify-between">
              <span>Wyczyscic biezaca rozmowe? Log tej sesji zniknie.</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={wyczyscRozmowe}
                  className="rounded-lg bg-rose-500/90 px-2.5 py-1 font-semibold text-zinc-950 transition-colors hover:bg-rose-400"
                >
                  Tak, wyczysc
                </button>
                <button
                  type="button"
                  onClick={() => setPotwierdzWyczysc(false)}
                  className="rounded-lg border border-zinc-700 px-2.5 py-1 font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-600">
              Enter wysyla, Shift plus Enter dodaje nowa linie.
            </p>
            <div className="flex items-center gap-2">
              {wpisy.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400/70"
                    aria-hidden
                  />
                  Rozmowa zapamietana w tej przegladarce
                </span>
              )}
              <button
                type="button"
                onClick={() => setPotwierdzWyczysc(true)}
                disabled={running || wpisy.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={14} aria-hidden />
                Wyczysc rozmowe
              </button>
              <button
                type="button"
                onClick={zapiszDoPamieci}
                disabled={running || wpisy.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save size={14} aria-hidden />
                Zapisz do pamięci
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Overlay rozmowy glosowej (pelnoekranowy) */}
      {glosOtwarty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-6 backdrop-blur-md animate-fade-up"
          onClick={zamknijGlos}
          role="dialog"
          aria-modal="true"
          aria-label="Tryb glosowy"
        >
          <button
            type="button"
            onClick={zamknijGlos}
            aria-label="Zamknij tryb glosowy"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X size={18} aria-hidden />
          </button>

          <div
            className="flex w-full max-w-xl flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Orb 160px ze stanami */}
            <button
              type="button"
              onClick={klikOrb}
              aria-label={
                glosStan === 'slucham'
                  ? 'Przerwij nasluch'
                  : glosStan === 'mowie'
                    ? 'Przerwij mowienie'
                    : 'Zacznij mowic'
              }
              className={`${orbKlasa(glosStan)} h-40 w-40`}
            >
              {glosStan === 'slucham' && (
                <span
                  className="orb-level"
                  style={{
                    boxShadow: `0 0 0 ${(2 + glosPoziom * 8).toFixed(1)}px rgba(91,141,239,0.4)`,
                  }}
                  aria-hidden
                />
              )}
              {glosStan === 'mowie' && (
                <span className="orb-wave-3" aria-hidden />
              )}
              <Mic size={40} aria-hidden />
            </button>

            {/* Etykieta stanu */}
            <div
              className="mt-6 text-sm font-medium text-brand-soft"
              aria-live="polite"
            >
              {ETYKIETA_GLOSU[glosStan]}
            </div>

            {/* Transkrypcja na zywo */}
            {glosTranskrypt && (
              <p
                className={[
                  'mt-4 max-w-xl text-center text-lg',
                  glosStan === 'slucham' ? 'text-zinc-400' : 'text-zinc-100',
                ].join(' ')}
                aria-live="polite"
              >
                {glosTranskrypt}
              </p>
            )}

            {/* Komunikat bledu glosu */}
            {glosBlad && (
              <p className="mt-4 max-w-md text-center text-sm text-amber-200">
                {glosBlad}
              </p>
            )}

            {/* Odpowiedz zespolu (czytana rownolegle przez TTS) */}
            {glosOdpowiedz && (
              <div className="mt-6 max-h-64 w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left text-[0.95rem] leading-relaxed text-zinc-100">
                <MarkdownView>{glosOdpowiedz}</MarkdownView>
              </div>
            )}

            {/* Pasek akcji */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={klikOrb}
                disabled={glosStan === 'czuwa' || glosStan === 'mysle'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Square size={14} aria-hidden />
                Przerwij
              </button>
              <button
                type="button"
                onClick={powtorzGlosem}
                disabled={!glosOdpowiedz || !czyDostepnyGlosPL()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw size={14} aria-hidden />
                Powtorz glosem
              </button>
              <button
                type="button"
                onClick={przelaczCzytaj}
                disabled={!czyDostepnyGlosPL()}
                aria-pressed={czytajAuto}
                className={[
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  czytajAuto
                    ? 'border-brand/40 bg-brand/10 text-brand-soft'
                    : 'border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 hover:text-white',
                ].join(' ')}
              >
                {czytajAuto ? (
                  <Volume2 size={14} aria-hidden />
                ) : (
                  <VolumeX size={14} aria-hidden />
                )}
                Czytaj odpowiedzi na glos
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast text={toast} />
    </div>
  )
}

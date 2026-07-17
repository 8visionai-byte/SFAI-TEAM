import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import { Save, Send, Settings as SettingsIcon, Sparkles } from 'lucide-react'
import { coo, teamAgents, getAgent } from '../data/agents'
import { hasApiKey } from '../lib/ai'
import { runOrchestration, type ZdarzenieOrk } from '../lib/orchestrator'
import { nowyId, zapiszNotatke } from '../lib/storage'
import ChatMessage from '../components/ChatMessage'
import Avatar from '../components/Avatar'
import Toast, { useToast } from '../components/Toast'

// --- Pomocnicze -------------------------------------------------------------

/** Stan pojedynczego wezla mapy. */
type StanWezla = 'idle' | 'active' | 'done'
/** Stan orkiestratora COO. */
type StanCoo = 'idle' | 'thinking' | 'synth'

/** Wpis w panelu czatu. */
type Wpis =
  | { rodzaj: 'user'; tekst: string }
  | { rodzaj: 'system'; tekst: string }
  | { rodzaj: 'final'; tekst: string }

const STANY_POCZATKOWE: Record<string, StanWezla> = Object.fromEntries(
  teamAgents.map((a) => [a.slug, 'idle' as StanWezla]),
)

const PRZYKLADY = [
  'Mam cel: 10 projektow w tym miesiacu. Rozloz go na zespol i powiedz od czego zaczac.',
  'Klient mowi, ze automatyzacja AI jest niebezpieczna dla jego danych. Jak to rozegrac?',
  'Zaplanuj kampanie na LinkedIn, ktora przyciagnie wlascicieli MSP na bezplatna diagnoze.',
]

const KOLOR_DONE = '#34D399'

// --- Mapa hierarchii --------------------------------------------------------

interface MapaProps {
  stanCoo: StanCoo
  stany: Record<string, StanWezla>
}

interface Linia {
  slug: string
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Hierarchia zespolu: COO u gory, 8 specjalistow pod nim, nici SVG lacza wezly. */
function MapaHierarchii({ stanCoo, stany }: MapaProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cooRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [linie, setLinie] = useState<Linia[]>([])
  const [wymiary, setWymiary] = useState({ w: 0, h: 0 })

  const zmierz = useCallback(() => {
    const wrap = wrapRef.current
    const cooEl = cooRef.current
    if (!wrap || !cooEl) return
    const wb = wrap.getBoundingClientRect()
    setWymiary({ w: wb.width, h: wb.height })

    const cb = cooEl.getBoundingClientRect()
    const cx = cb.left + cb.width / 2 - wb.left
    const cyDol = cb.bottom - wb.top

    const nast: Linia[] = []
    for (const a of teamAgents) {
      const el = nodeRefs.current.get(a.slug)
      if (!el) continue
      const nb = el.getBoundingClientRect()
      const nx = nb.left + nb.width / 2 - wb.left
      const nyGora = nb.top - wb.top
      nast.push({ slug: a.slug, x1: cx, y1: cyDol, x2: nx, y2: nyGora })
    }
    setLinie(nast)
  }, [])

  useLayoutEffect(() => {
    zmierz()
    const ro = new ResizeObserver(() => zmierz())
    if (wrapRef.current) ro.observe(wrapRef.current)
    window.addEventListener('resize', zmierz)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', zmierz)
    }
  }, [zmierz])

  // Chipy subagentow zmieniaja wysokosc wezlow, wiec przelicz po zmianie stanow.
  useLayoutEffect(() => {
    zmierz()
  }, [stany, zmierz])

  const cooAktywny = stanCoo !== 'idle'

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Warstwa nici (SVG) pod wezlami */}
      <svg
        className="pointer-events-none absolute inset-0"
        width={wymiary.w}
        height={wymiary.h}
        viewBox={`0 0 ${wymiary.w} ${wymiary.h}`}
        aria-hidden
      >
        {linie.map((l) => {
          const stan = stany[l.slug] ?? 'idle'
          const agent = getAgent(l.slug)
          const kolor =
            stan === 'active'
              ? agent?.accent ?? '#5B8DEF'
              : stan === 'done'
                ? KOLOR_DONE
                : '#3f3f46'
          return (
            <g key={l.slug}>
              {/* Baza: zawsze delikatna nic */}
              <line
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="#3f3f46"
                strokeWidth={1.5}
              />
              {/* Nakladka: zapala sie gdy specjalista pracuje (animowany dash) lub skonczyl (zielony) */}
              {stan !== 'idle' && (
                <line
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke={kolor}
                  strokeWidth={stan === 'active' ? 2.5 : 2}
                  strokeLinecap="round"
                  className={stan === 'active' ? 'thread-flow' : undefined}
                  opacity={stan === 'active' ? 1 : 0.85}
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Warstwa wezlow */}
      <div className="relative z-10 flex flex-col items-center">
        {/* COO */}
        <div
          ref={cooRef}
          className={[
            'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-300',
            cooAktywny
              ? 'border-brand/60 bg-brand/10'
              : 'border-zinc-800 bg-zinc-900/70',
          ].join(' ')}
        >
          <Avatar
            agent={coo}
            size="lg"
            className={cooAktywny ? 'node-pulse' : ''}
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-zinc-50">{coo.name}</div>
            <div className="text-xs font-medium text-brand-soft">
              {stanCoo === 'thinking'
                ? 'Analizuje i planuje...'
                : stanCoo === 'synth'
                  ? 'Sklada odpowiedz...'
                  : coo.role}
            </div>
          </div>
        </div>

        {/* Pionowy lacznik dekoracyjny pod COO */}
        <div
          className={[
            'h-5 w-px transition-colors duration-300',
            cooAktywny ? 'bg-brand/50' : 'bg-zinc-700',
          ].join(' ')}
          aria-hidden
        />

        {/* Siatka specjalistow */}
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {teamAgents.map((a) => {
            const stan = stany[a.slug] ?? 'idle'
            const pokazChipy = stan === 'active' || stan === 'done'
            const ring =
              stan === 'active'
                ? 'border-2'
                : stan === 'done'
                  ? 'border'
                  : 'border'
            return (
              <div
                key={a.slug}
                ref={(el) => {
                  if (el) nodeRefs.current.set(a.slug, el)
                }}
                className={[
                  'flex flex-col items-center rounded-xl bg-zinc-900/70 px-2 py-3 text-center transition-all duration-300',
                  ring,
                ].join(' ')}
                style={{
                  borderColor:
                    stan === 'active'
                      ? a.accent
                      : stan === 'done'
                        ? KOLOR_DONE
                        : '#27272a',
                }}
              >
                <Avatar
                  agent={a}
                  size="md"
                  className={[
                    stan === 'active' ? 'node-pulse' : '',
                    stan === 'idle' ? 'opacity-80' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
                <div className="mt-1.5 text-[0.72rem] font-medium leading-tight text-zinc-300">
                  {a.role}
                </div>

                {/* Chipy zespolu wykonawczego (subagenci) aktywnego specjalisty */}
                {pokazChipy && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {a.subagents.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className={[
                          'rounded-full border px-1.5 py-0.5 text-[0.6rem] leading-none text-zinc-400',
                          stan === 'active' ? 'chip-flicker' : '',
                        ].join(' ')}
                        style={{
                          borderColor: `${a.accent}55`,
                          color: stan === 'done' ? '#a1a1aa' : undefined,
                        }}
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
      </div>
    </div>
  )
}

// --- Strona -----------------------------------------------------------------

export default function Command() {
  const [wpisy, setWpisy] = useState<Wpis[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [stanCoo, setStanCoo] = useState<StanCoo>('idle')
  const [stany, setStany] =
    useState<Record<string, StanWezla>>(STANY_POCZATKOWE)
  const { toast, pokazToast } = useToast()

  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
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
    } finally {
      setRunning(false)
      setStanCoo('idle')
    }
  }

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

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      zapytaj(input)
    }
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Lewa czesc: mapa hierarchii (~60%) */}
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
          <MapaHierarchii stanCoo={stanCoo} stany={stany} />

          <p className="mt-6 text-center text-xs text-zinc-600">
            Nici lacza COO z zespolem. Aktywna sciezka swieci kolorem
            specjalisty, ukonczona na zielono.
          </p>
        </div>
      </section>

      {/* Prawa czesc: panel czatu (~40%) */}
      <section className="flex min-h-0 flex-1 flex-col lg:w-2/5">
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
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-600">
              Enter wysyla, Shift plus Enter dodaje nowa linie.
            </p>
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
      </section>

      <Toast text={toast} />
    </div>
  )
}

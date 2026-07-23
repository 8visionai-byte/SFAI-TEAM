import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Send,
  Info,
  Settings as SettingsIcon,
  History,
  Mic,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { getAgent } from '../data/agents'
import {
  sendMessage,
  hasApiKey,
  callModel,
  getMode,
  buildPamiecPrompt,
  type ChatMessage as Msg,
} from '../lib/ai'
import { isSttSupported, startListening, stopListening } from '../lib/voice'
import {
  nowyId,
  rozmowyAgenta,
  wczytajRozmowy,
  zapiszRozmowe,
  usunRozmowe,
  zapiszNotatke,
  zapiszPamiecAgenta,
  pamiecAutoWlaczona,
  type Rozmowa,
} from '../lib/storage'
import ChatMessage from '../components/ChatMessage'
import Avatar from '../components/Avatar'
import Toast, { useToast } from '../components/Toast'

/** Przykladowe pytania pokazywane na starcie rozmowy. */
function starterPrompts(slug: string): string[] {
  if (slug === 'coo') {
    return [
      'Mam cel: 10 projektow w tym miesiacu. Rozloz go na zespol.',
      'Ktorych agentow odpalic, zeby podniesc win rate?',
      'Zsyntetyzuj rekomendacje: na czym skupic sie w tym tygodniu?',
    ]
  }
  switch (slug) {
    case 'handlowiec':
      return [
        'Klient mowi, ze to za drogo. Jak odpowiadam bez rabatu?',
        'Pomoz mi zdiagnozowac luke u potencjalnego klienta.',
      ]
    case 'copywriter':
      return [
        'Napisz naglowek na strone, ktory buduje zaufanie.',
        'Przerob ten tekst na jezyk korzysci dla klienta.',
      ]
    case 'analityk':
      return [
        'Kim jest nasz idealny klient (ICP) i gdzie go szukac?',
        'Daj mi battlecard przeciw najtanszemu chatbotowi.',
      ]
    case 'pamiec-zespolu':
      return [
        'Co wiemy o pozycjonowaniu marki SimpleFast.ai?',
        'Jakie mamy twarde dowody (proof) do uzycia w sprzedazy?',
      ]
    case 'wiedza-produkt':
      return [
        'Jakie uslugi mamy w ofercie i dla kogo?',
        'Jaki material wyslac klientowi po diagnozie?',
      ]
    case 'drugi-glos':
      return [
        'Zakwestionuj ten pomysl: rabat 20% na pierwszy projekt.',
        'Czy ten przekaz jest zgodny z marka? Powiedz wprost.',
      ]
    case 'operacje':
      return [
        'Uporzadkuj moje zadania na ten tydzien.',
        'Przygotuj brief dla zespolu z tego celu.',
      ]
    case 'opiekun-klienta':
      return [
        'Jak zaplanowac onboarding nowego klienta?',
        'Co zrobic, zeby utrzymac klienta po projekcie?',
      ]
    default:
      return []
  }
}

/** Krotkie sformatowanie daty do listy rozmow. */
function formatujDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Tytul rozmowy = poczatek pierwszej wiadomosci uzytkownika. */
function tytulRozmowy(messages: Msg[]): string {
  const pierwsza = messages.find((m) => m.role === 'user')
  const t = (pierwsza?.content ?? 'Rozmowa').trim()
  return t.length > 60 ? `${t.slice(0, 60)}...` : t
}

/** Przycina tekst do zapisu awaryjnego pamieci (brak klucza albo blad modelu). */
function skrocTekst(t: string, max = 1500): string {
  return t.length > max ? `${t.slice(0, max)}\n...(skrocono)` : t
}

/**
 * AUTO-ZAPIS PAMIECI z rozmowy tekstowej (po id rozmowy z sf_rozmowy).
 * Wolane przy "Nowa rozmowa" oraz przy odejsciu/zmianie agenta. Warunki:
 * rozmowa ma > 4 wpisy, przelacznik sf_pamiec_auto wlaczony i nie zapisano jej
 * jeszcze (flaga pamiecZapisana w obiekcie rozmowy chroni przed dublowaniem).
 * Czyta rozmowe ze storage po id, wiec ma pewny agentSlug nawet przy zmianie trasy.
 */
async function zapiszPamiecZRozmowy(id: string): Promise<void> {
  const rozmowa = wczytajRozmowy().find((r) => r.id === id)
  if (!rozmowa) return
  if (rozmowa.messages.length <= 4) return
  if (!pamiecAutoWlaczona()) return
  if (rozmowa.pamiecZapisana) return
  const a = getAgent(rozmowa.agentSlug)
  if (!a) return
  // Oznacz od razu (idempotencja): "Nowa rozmowa" i odejscie moga wystrzelic razem.
  zapiszRozmowe({ ...rozmowa, pamiecZapisana: true })
  const imie = a.personImie ?? a.name
  const tekst = rozmowa.messages
    .map((m) =>
      m.role === 'user' ? `Wlasciciel: ${m.content}` : `${a.name}: ${m.content}`,
    )
    .join('\n')
  const dataDnia = new Date().toISOString().slice(0, 10)
  const tytul = `Rozmowa z ${imie} ${dataDnia}`
  let streszczenie = ''
  try {
    if (getMode() !== 'demo') {
      streszczenie = (
        await callModel(buildPamiecPrompt(imie), [
          { role: 'user', content: tekst },
        ])
      ).trim()
    } else {
      streszczenie = skrocTekst(tekst)
    }
  } catch {
    streszczenie = skrocTekst(tekst)
  }
  if (!streszczenie) streszczenie = skrocTekst(tekst)
  zapiszPamiecAgenta(a.slug, tytul, streszczenie)
}

export default function Chat() {
  const { slug } = useParams<{ slug: string }>()
  const agent = getAgent(slug)

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [convId, setConvId] = useState<string>(() => nowyId())
  const [historia, setHistoria] = useState<Rozmowa[]>([])
  const [pokazHistorie, setPokazHistorie] = useState(false)
  const { toast, pokazToast } = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Dyktowanie do pola (STT przegladarki). Baza = tekst juz wpisany recznie.
  const sttOK = isSttSupported()
  const [dyktuje, setDyktuje] = useState(false)
  const bazaInputRef = useRef('')

  // reset rozmowy przy zmianie agenta + wczytanie historii tego agenta
  useEffect(() => {
    stopListening()
    setDyktuje(false)
    setMessages([])
    setInput('')
    setLoading(false)
    setConvId(nowyId())
    setHistoria(slug ? rozmowyAgenta(slug) : [])
    setPokazHistorie(false)
  }, [slug])

  // Zawsze aktualne id biezacej rozmowy: cleanup efektu odejscia czyta je z ref,
  // wiec przy zmianie agenta zapisze pamiec POPRZEDNIEJ rozmowy (stan jeszcze stary).
  const convIdRef = useRef(convId)
  convIdRef.current = convId

  // Sprzataj nasluch przy odmontowaniu strony.
  useEffect(() => {
    return () => stopListening()
  }, [])

  // Odejscie ze strony lub zmiana agenta: auto-zapis pamieci biezacej rozmowy.
  // Cleanup [slug] odpala sie przy zmianie sluga i przy odmontowaniu.
  useEffect(() => {
    return () => {
      void zapiszPamiecZRozmowy(convIdRef.current)
    }
  }, [slug])

  // automatyczny zapis biezacej rozmowy do localStorage (sf_rozmowy)
  useEffect(() => {
    if (!agent || messages.length === 0) return
    const zapisana = wczytajRozmowy().find((r) => r.id === convId)
    // nie nadpisuj, gdy nic sie nie zmienilo (np. po wczytaniu starej rozmowy)
    if (
      zapisana &&
      JSON.stringify(zapisana.messages) === JSON.stringify(messages)
    ) {
      return
    }
    zapiszRozmowe({
      id: convId,
      agentSlug: agent.slug,
      tytul: tytulRozmowy(messages),
      messages,
      updatedAt: new Date().toISOString(),
    })
    setHistoria(rozmowyAgenta(agent.slug))
  }, [messages, convId, agent])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, loading])

  if (!agent) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="text-2xl font-bold text-zinc-100">
          Nie znaleziono agenta
        </h1>
        <p className="mt-2 text-zinc-400">
          Ten agent nie istnieje w zespole.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
        >
          <ArrowLeft size={16} />
          Wroc do zespolu
        </Link>
      </div>
    )
  }

  async function handleSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading || !agent) return

    const nextHistory: Msg[] = [
      ...messages,
      { role: 'user', content: trimmed },
    ]
    setMessages(nextHistory)
    setInput('')
    // reset wysokosci pola po wyslaniu
    if (taRef.current) taRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const reply = await sendMessage(agent.slug, nextHistory)
      setMessages([...nextHistory, { role: 'assistant', content: reply }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages([
        ...nextHistory,
        {
          role: 'assistant',
          content: `Cos poszlo nie tak po mojej stronie: ${msg}. Sprobuj ponownie za chwile.`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  /** Zaczyna nowa, pusta rozmowe (poprzednia jest juz auto-zapisana). */
  function nowaRozmowa() {
    if (loading) return
    // Zapisz pamiec z konczonej rozmowy, zanim przelaczymy id na nowe.
    void zapiszPamiecZRozmowy(convId)
    setConvId(nowyId())
    setMessages([])
    setInput('')
  }

  /** Wczytuje zapisana rozmowe do okna czatu. */
  function wczytajDoCzatu(r: Rozmowa) {
    if (loading) return
    setConvId(r.id)
    setMessages(r.messages)
    setPokazHistorie(false)
  }

  /** Usuwa rozmowe z historii; jesli to biezaca, zaczyna nowa. */
  function usunZHistorii(id: string) {
    usunRozmowe(id)
    if (agent) setHistoria(rozmowyAgenta(agent.slug))
    if (id === convId) {
      setConvId(nowyId())
      setMessages([])
    }
  }

  /** Zapisuje biezaca rozmowe jako notatke (sf_notatki). */
  function zapiszDoPamieci() {
    if (!agent || messages.length === 0) return
    const tresc = messages
      .map((m) =>
        m.role === 'user' ? `**Ty:** ${m.content}` : `**${agent.name}:** ${m.content}`,
      )
      .join('\n\n')
    zapiszNotatke({
      id: nowyId(),
      zrodlo: `Czat: ${agent.name}`,
      data: new Date().toISOString(),
      tytul: tytulRozmowy(messages),
      tresc,
    })
    pokazToast(
      'Zapisano notatkę. W kolejnej wersji trafi automatycznie do mózgu firmy.',
    )
  }

  /** Wlacza/wylacza dyktowanie glosem do pola tekstowego. */
  function przelaczDyktowanie() {
    if (!sttOK || loading) return
    if (dyktuje) {
      stopListening()
      setDyktuje(false)
      return
    }
    bazaInputRef.current = input ? `${input} ` : ''
    setDyktuje(true)
    startListening({
      lang: 'pl-PL',
      onPartial: (t) => setInput(bazaInputRef.current + t),
      onFinal: (t) => {
        const scalony = (bazaInputRef.current + t).trim()
        setInput(scalony)
        bazaInputRef.current = `${scalony} `
      },
      onError: () => setDyktuje(false),
      onEnd: () => setDyktuje(false),
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const starters = starterPrompts(agent.slug)
  const przyciskSm =
    'inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex h-full flex-col">
      {/* Naglowek z tozsamoscia */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 px-5 py-4 backdrop-blur sm:px-8">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={14} />
          Wroc do zespolu
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar agent={agent} size="lg" aura="soft" glow />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold leading-tight text-zinc-50">
              {agent.name}
            </h1>
            <p
              className="truncate text-sm font-medium"
              style={{ color: agent.accent }}
            >
              {agent.role}
            </p>
          </div>
          {/* Akcje rozmowy */}
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/agent/${agent.slug}`} className={przyciskSm}>
              <Info size={14} aria-hidden />
              Profil
            </Link>
            <button
              type="button"
              onClick={() => setPokazHistorie((v) => !v)}
              aria-expanded={pokazHistorie}
              className={przyciskSm}
            >
              <History size={14} aria-hidden />
              Poprzednie rozmowy
              <span className="rounded-full bg-zinc-800 px-1.5 py-px text-[0.65rem] tabular-nums text-zinc-400">
                {historia.length}
              </span>
            </button>
            <button
              type="button"
              onClick={nowaRozmowa}
              disabled={loading || messages.length === 0}
              className={przyciskSm}
            >
              <Plus size={14} aria-hidden />
              Nowa rozmowa
            </button>
            <button
              type="button"
              onClick={zapiszDoPamieci}
              disabled={loading || messages.length === 0}
              className={przyciskSm}
            >
              <Save size={14} aria-hidden />
              Zapisz do pamięci
            </button>
          </div>
        </div>

        {/* Lista poprzednich rozmow tego agenta */}
        {pokazHistorie && (
          <div className="mt-3 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
            {historia.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-zinc-500">
                Brak zapisanych rozmow z tym agentem. Napisz cos, rozmowa
                zapisze sie sama.
              </p>
            )}
            {historia.map((r) => {
              const biezaca = r.id === convId
              return (
                <div key={r.id} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => wczytajDoCzatu(r)}
                    className={[
                      'flex min-w-0 flex-1 flex-col rounded-lg px-2.5 py-1.5 text-left transition-colors',
                      biezaca
                        ? 'bg-brand/10 ring-1 ring-brand/30'
                        : 'hover:bg-zinc-800/80',
                    ].join(' ')}
                  >
                    <span className="truncate text-xs font-medium text-zinc-200">
                      {r.tytul}
                    </span>
                    <span className="text-[0.65rem] text-zinc-500">
                      {formatujDate(r.updatedAt)}, wiadomosci: {r.messages.length}
                      {biezaca ? ', otwarta teraz' : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => usunZHistorii(r.id)}
                    aria-label={`Usun rozmowe: ${r.tytul}`}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </header>

      {/* Lista wiadomosci */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label={`Rozmowa z agentem ${agent.name}`}
      >
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-6 sm:px-8">
          {!hasApiKey() && (
            <div className="flex flex-col gap-2 rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm text-brand-soft sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2.5">
                <SettingsIcon size={16} className="mt-0.5 flex-shrink-0" aria-hidden />
                <span>
                  Tryb demo. Dodaj swoj klucz Anthropic w Ustawieniach, aby
                  agenci odpowiadali naprawde.
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

          {!agent.hasPrompt && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
              <Info size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                Ten agent jest w budowie, odpowiada w trybie podstawowym (opis
                roli plus mozg firmy).
              </span>
            </div>
          )}

          {messages.length === 0 && (
            <div className="animate-fade-up">
              <div
                className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"
                style={{ ['--acc' as string]: agent.accent }}
              >
                <Avatar agent={agent} size="md" />
                <p className="text-sm leading-relaxed text-zinc-300">
                  {agent.mission}
                </p>
              </div>
              {agent.slug === 'coo' && (
                <p className="mt-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand-soft">
                  Powiedz mi cel sprzedazowy, rozloze go na zespol.
                </p>
              )}
              {starters.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Przyklady pytan
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {starters.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="group flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-2.5 text-left text-sm text-zinc-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-800 hover:text-white motion-reduce:hover:translate-y-0"
                        style={{ ['--acc' as string]: agent.accent }}
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full opacity-60 transition-opacity group-hover:opacity-100"
                          style={{ backgroundColor: agent.accent }}
                          aria-hidden
                        />
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <ChatMessage
              key={i}
              role={m.role}
              content={m.content}
              agent={agent}
              czytelny={m.role === 'assistant'}
            />
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-zinc-500 animate-fade-up">
              <Avatar agent={agent} size="sm" working />
              <span
                className="flex items-center gap-1 text-sm"
                aria-label={`${agent.name} mysli`}
              >
                <span aria-hidden>mysli</span>
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
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pole wpisywania */}
      <div className="border-t border-zinc-800/80 bg-zinc-950 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              // auto-rosnace pole (do max-h ustawionego klasa)
              const ta = e.currentTarget
              ta.style.height = 'auto'
              ta.style.height = `${ta.scrollHeight}px`
            }}
            onKeyDown={onKeyDown}
            rows={1}
            aria-label={`Napisz wiadomosc do agenta ${agent.name}`}
            placeholder={`Napisz do agenta ${agent.name}...`}
            className="max-h-40 min-h-[48px] flex-1 resize-none overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-[0.95rem] leading-relaxed text-zinc-100 shadow-card outline-none transition-colors placeholder:text-zinc-600 focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
          />
          {sttOK && (
            <button
              type="button"
              onClick={przelaczDyktowanie}
              disabled={loading}
              aria-label={dyktuje ? 'Zatrzymaj dyktowanie' : 'Dyktuj glosem'}
              aria-pressed={dyktuje}
              title={dyktuje ? 'Zatrzymaj dyktowanie' : 'Dyktuj glosem'}
              className={[
                'orb flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40',
                dyktuje ? 'orb-listen' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Mic size={18} aria-hidden />
            </button>
          )}
          <button
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            aria-label="Wyslij wiadomosc"
            className="flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-zinc-950 shadow-glow transition-all hover:bg-brand-soft active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none motion-reduce:active:scale-100"
          >
            <Send size={16} aria-hidden />
            <span className="hidden sm:inline">Wyslij</span>
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-xs text-zinc-600">
          Enter wysyla, Shift plus Enter dodaje nowa linie. Rozmowa zapisuje
          sie sama w tej przegladarce.
        </p>
      </div>

      <Toast text={toast} />
    </div>
  )
}

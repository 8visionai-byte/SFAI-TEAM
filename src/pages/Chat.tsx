import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Send, Info } from 'lucide-react'
import { getAgent } from '../data/agents'
import { sendMessage, type ChatMessage as Msg } from '../lib/ai'
import ChatMessage from '../components/ChatMessage'

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

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

export default function Chat() {
  const { slug } = useParams<{ slug: string }>()
  const agent = getAgent(slug)

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // reset rozmowy przy zmianie agenta
  useEffect(() => {
    setMessages([])
    setInput('')
    setLoading(false)
  }, [slug])

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
    setLoading(true)

    const reply = await sendMessage(agent.slug, nextHistory)
    setMessages([...nextHistory, { role: 'assistant', content: reply }])
    setLoading(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const starters = starterPrompts(agent.slug)

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
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-zinc-950"
            style={{ backgroundColor: agent.accent }}
            aria-hidden
          >
            {initials(agent.name)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-zinc-50">
              {agent.name}
            </h1>
            <p
              className="truncate text-sm font-medium"
              style={{ color: agent.accent }}
            >
              {agent.role}
            </p>
          </div>
        </div>
      </header>

      {/* Lista wiadomosci */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-6 sm:px-8">
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
              <p className="text-zinc-400">{agent.mission}</p>
              {agent.slug === 'coo' && (
                <p className="mt-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand-soft">
                  Powiedz mi cel sprzedazowy, rozloze go na zespol.
                </p>
              )}
              {starters.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
                    Przyklady pytan
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {starters.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-left text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                      >
                        {s}
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
            />
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-zinc-500 animate-fade-up">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-zinc-950"
                style={{ backgroundColor: agent.accent }}
                aria-hidden
              >
                {initials(agent.name)}
              </div>
              <span className="flex items-center gap-1 text-sm">
                mysli
                <span className="thinking-dot">.</span>
                <span className="thinking-dot" style={{ animationDelay: '0.2s' }}>
                  .
                </span>
                <span className="thinking-dot" style={{ animationDelay: '0.4s' }}>
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Napisz do agenta ${agent.name}...`}
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-[0.95rem] text-zinc-100 placeholder:text-zinc-600 focus:border-brand/50"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            className="flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Wyslij</span>
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-xs text-zinc-600">
          Enter wysyla, Shift plus Enter dodaje nowa linie.
        </p>
      </div>
    </div>
  )
}

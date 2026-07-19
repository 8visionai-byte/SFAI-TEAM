import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import MarkdownView from './MarkdownView'
import Avatar from './Avatar'
import type { Agent } from '../data/agents'
import { isTtsSupported, czyDostepnyGlosPL, speak, cancel } from '../lib/voice'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  agent: Agent
  /** Pokaz przycisk "czytaj na glos" pod odpowiedzia agenta (TTS przegladarki). */
  czytelny?: boolean
}

/** Maly przycisk czytania odpowiedzi na glos (speak/cancel). */
function PrzyciskCzytaj({ tekst }: { tekst: string }) {
  const [mowi, setMowi] = useState(false)

  // Bez wsparcia TTS albo bez polskiego glosu nie pokazujemy przycisku.
  if (!isTtsSupported() || !czyDostepnyGlosPL()) return null

  function klik() {
    if (mowi) {
      cancel()
      setMowi(false)
      return
    }
    speak(tekst, {
      onStart: () => setMowi(true),
      onEnd: () => setMowi(false),
      onError: () => setMowi(false),
    })
  }

  return (
    <button
      type="button"
      onClick={klik}
      aria-label={mowi ? 'Zatrzymaj czytanie' : 'Przeczytaj na glos'}
      aria-pressed={mowi}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-[0.7rem] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
    >
      {mowi ? <VolumeX size={13} aria-hidden /> : <Volume2 size={13} aria-hidden />}
      {mowi ? 'Zatrzymaj' : 'Przeczytaj na glos'}
    </button>
  )
}

/** Pojedyncza wiadomosc: user po prawej, agent po lewej (markdown). */
export default function ChatMessage({
  role,
  content,
  agent,
  czytelny = false,
}: ChatMessageProps) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-brand/30 bg-gradient-to-br from-brand/15 to-brand/10 px-4 py-3 text-[0.95rem] leading-relaxed text-zinc-100 shadow-card whitespace-pre-wrap">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start gap-3 animate-fade-up">
      <Avatar agent={agent} size="sm" className="mt-0.5 shadow-sm" />
      <div className="min-w-0 max-w-[85%]">
        <div
          className="mb-1 text-xs font-semibold"
          style={{ color: agent.accent }}
        >
          {agent.name}
        </div>
        <div className="rounded-2xl rounded-tl-md border border-zinc-800 bg-zinc-900 px-4 py-2 shadow-card">
          <MarkdownView>{content}</MarkdownView>
        </div>
        {czytelny && <PrzyciskCzytaj tekst={content} />}
      </div>
    </div>
  )
}

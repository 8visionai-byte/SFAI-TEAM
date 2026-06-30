import MarkdownView from './MarkdownView'
import type { Agent } from '../data/agents'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  agent: Agent
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Pojedyncza wiadomosc: user po prawej, agent po lewej (markdown). */
export default function ChatMessage({ role, content, agent }: ChatMessageProps) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-brand/30 bg-brand/10 px-4 py-3 text-[0.95rem] leading-relaxed text-zinc-100 whitespace-pre-wrap">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start gap-3 animate-fade-up">
      <div
        className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-zinc-950"
        style={{ backgroundColor: agent.accent }}
        aria-hidden
      >
        {initials(agent.name)}
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 px-4 py-1 shadow-sm">
        <MarkdownView>{content}</MarkdownView>
      </div>
    </div>
  )
}

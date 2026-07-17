import MarkdownView from './MarkdownView'
import Avatar from './Avatar'
import type { Agent } from '../data/agents'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  agent: Agent
}

/** Pojedyncza wiadomosc: user po prawej, agent po lewej (markdown). */
export default function ChatMessage({ role, content, agent }: ChatMessageProps) {
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
      </div>
    </div>
  )
}

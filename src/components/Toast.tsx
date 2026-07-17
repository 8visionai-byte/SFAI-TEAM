import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

/** Hook do krotkich potwierdzen: pokazToast(tekst) wyswietla dymek na kilka sekund. */
export function useToast(czasMs = 4000): {
  toast: string | null
  pokazToast: (tekst: string) => void
} {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  function pokazToast(tekst: string) {
    setToast(tekst)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), czasMs)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { toast, pokazToast }
}

/** Dymek potwierdzenia na dole ekranu. Renderuj zawsze, sam znika gdy text = null. */
export default function Toast({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-zinc-900/95 px-4 py-3 text-sm text-emerald-200 shadow-card backdrop-blur animate-fade-up"
    >
      <Check size={16} className="flex-shrink-0 text-emerald-400" aria-hidden />
      <span>{text}</span>
    </div>
  )
}

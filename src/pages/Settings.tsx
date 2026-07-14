import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Trash2,
  Check,
  ExternalLink,
} from 'lucide-react'
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  hasApiKey,
  getModel,
  setModel,
} from '../lib/ai'

const MODELS: { value: string; label: string }[] = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (domyslny)' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
]

/** Maskuje klucz: pokazuje prefiks i 4 ostatnie znaki. */
function maskKey(key: string): string {
  if (key.length <= 12) return 'sk-ant-...'
  const tail = key.slice(-4)
  return `sk-ant-...${tail}`
}

export default function Settings() {
  const [keyInput, setKeyInput] = useState(getApiKey() ?? '')
  const [model, setModelState] = useState(getModel())
  const [showKey, setShowKey] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(getApiKey())
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const realMode = hasApiKey()

  function handleSave() {
    setApiKey(keyInput)
    setModel(model)
    const stored = getApiKey()
    setSavedKey(stored)
    setConfirmation(
      stored
        ? 'Zapisano. Tryb realny aktywny, agenci odpowiadaja przez Twoj klucz.'
        : 'Zapisano ustawienia. Bez klucza aplikacja dziala w trybie demo.',
    )
  }

  function handleClear() {
    clearApiKey()
    setKeyInput('')
    setSavedKey(null)
    setShowKey(false)
    setConfirmation('Usunieto klucz. Aplikacja wrocila do trybu demo.')
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft size={14} />
        Wroc do zespolu
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          Ustawienia
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Podlacz wlasny klucz Anthropic, aby agenci odpowiadali naprawde.
        </p>
      </header>

      {/* Status trybu */}
      <div
        className={[
          'mb-6 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium',
          realMode
            ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-200'
            : 'border-amber-500/25 bg-amber-500/5 text-amber-200',
        ].join(' ')}
        role="status"
      >
        <span
          className={[
            'h-2 w-2 flex-shrink-0 rounded-full',
            realMode ? 'bg-emerald-400' : 'bg-amber-400',
          ].join(' ')}
          aria-hidden
        />
        {realMode ? 'Tryb realny aktywny' : 'Tryb demo'}
      </div>

      <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
        {/* Klucz API */}
        <div>
          <label
            htmlFor="api-key"
            className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-200"
          >
            <KeyRound size={15} className="text-brand-soft" aria-hidden />
            Klucz API Anthropic
          </label>
          <div className="relative">
            <input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 pr-12 font-mono text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Ukryj klucz' : 'Pokaz klucz'}
              aria-pressed={showKey}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-soft transition-colors hover:text-brand"
          >
            Pobierz klucz
            <ExternalLink size={12} aria-hidden />
          </a>
        </div>

        {/* Model */}
        <div>
          <label
            htmlFor="model"
            className="mb-1.5 block text-sm font-semibold text-zinc-200"
          >
            Model
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModelState(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Akcje */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-zinc-950 shadow-glow transition-all hover:bg-brand-soft active:scale-95 motion-reduce:active:scale-100"
          >
            <Check size={16} aria-hidden />
            Zapisz
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!savedKey}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-5 text-sm font-medium text-zinc-300 transition-colors hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:bg-zinc-950 disabled:hover:text-zinc-300"
          >
            <Trash2 size={16} aria-hidden />
            Usun klucz
          </button>
        </div>

        {/* Potwierdzenie */}
        {confirmation && (
          <div
            className="animate-fade-up rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200"
            role="status"
          >
            <p>{confirmation}</p>
            {savedKey && (
              <p className="mt-1 font-mono text-xs text-emerald-300/80">
                Zapisany klucz: {maskKey(savedKey)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Informacja o prywatnosci */}
      <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3.5 text-sm leading-relaxed text-zinc-400">
        <ShieldCheck
          size={18}
          className="mt-0.5 flex-shrink-0 text-brand-soft"
          aria-hidden
        />
        <p>
          Twoj klucz zostaje wylacznie w tej przegladarce (localStorage). Nie
          trafia do naszego kodu ani na nasz serwer, wysylany jest tylko
          bezposrednio do Anthropic. Zalecenie: na czas testow uzyj klucza z
          ustawionym limitem wydatkow (spend limit) w panelu Anthropic.
        </p>
      </div>
    </div>
  )
}

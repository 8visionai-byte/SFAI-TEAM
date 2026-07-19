import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  ImageIcon,
  KeyRound,
  Mic,
  ShieldCheck,
  Trash2,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getMode,
  getModel,
  setModel,
} from '../lib/ai'
import {
  isTtsSupported,
  isSttSupported,
  czyDostepnyGlosPL,
  czytajAutoWlaczone,
  ustawCzytajAuto,
} from '../lib/voice'

const MODELS: { value: string; label: string }[] = [
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (domyslny, szybki)' },
  { value: 'claude-sonnet-5', label: 'Sonnet 5 (nowszy)' },
  { value: 'claude-opus-4-8', label: 'Opus 4.8 (mocny)' },
  { value: 'claude-fable-5', label: 'Fable 5 (najmocniejszy)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (najtanszy)' },
]

type StatusIntegracji = 'aktywne' | 'w-budowie' | 'do-wygenerowania'

const STATUS_BADGE: Record<StatusIntegracji, { label: string; klasa: string }> =
  {
    aktywne: {
      label: 'Aktywne',
      klasa: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    },
    'do-wygenerowania': {
      label: 'Do wygenerowania',
      klasa: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
    },
    'w-budowie': {
      label: 'W budowie',
      klasa: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
    },
  }

interface Integracja {
  tytul: string
  /** Jedno zdanie: co ta integracja da wlascicielowi firmy. */
  opis: string
  /** Dodatkowa informacja techniczna (sciezki plikow itp.). */
  meta?: string
  /** Uczciwe "kiedy" wg roadmapy 2.0 (tylko karty w budowie). */
  kiedy?: string
  status: StatusIntegracji
  /** Wlasna etykieta na plakietce (nadpisuje domyslna dla statusu). */
  etykietaBadge?: string
  Ikona: LucideIcon
}

const INTEGRACJE: Integracja[] = [
  {
    tytul: 'Awatary person (Higgsfield)',
    opis: 'Kazda persona dostaje twarz zamiast inicjalow na kafelkach zespolu.',
    meta: 'Prompty gotowe w pliku AWATARY-HIGGSFIELD-PROMPTY.md, wygenerowane obrazki wrzucasz do webapp/public/avatars.',
    status: 'do-wygenerowania',
    Ikona: ImageIcon,
  },
  {
    tytul: 'Glos JARVIS (rozmowa na zywo)',
    opis: 'Mow do COO i sluchaj odpowiedzi. Rozpoznawanie i czytanie dziala w przegladarce (Chrome, Edge).',
    status: 'aktywne',
    etykietaBadge: 'Aktywny (glos przegladarki)',
    Ikona: Mic,
  },
  {
    tytul: 'Obsidian / eksport-import mozgu',
    opis: 'W zakladce Mozg firmy eksportujesz caly mozg do jednego pliku .md i importujesz notatki z Obsidiana jako pliki wlasne.',
    status: 'aktywne',
    etykietaBadge: 'Aktywny',
    Ikona: BookOpen,
  },
  {
    tytul: 'Google Drive (foldery wiedzy do mozgu)',
    opis: 'Wrzucasz plik do folderu na Drive, a mozg zespolu poznaje go bez Twojej recznej roboty.',
    kiedy: 'Wkrotce · Faza 7 roadmapy 2.0',
    status: 'w-budowie',
    Ikona: FolderOpen,
  },
  {
    tytul: 'Social media i GA4 (dane marketingowe)',
    opis: 'Analityk odpowiada realnymi liczbami z Twoich kanalow, ze zrodlem i data pobrania.',
    kiedy: 'Wkrotce · Faza 7 roadmapy 2.0',
    status: 'w-budowie',
    Ikona: BarChart3,
  },
  {
    tytul: 'Make.com (most danych z firmowych systemow)',
    opis: 'Dane z firmowych systemow same splywaja do mozgu zespolu.',
    kiedy: 'Wkrotce · Faza 7 roadmapy 2.0',
    status: 'w-budowie',
    Ikona: Workflow,
  },
  {
    tytul: 'Mozg w bazie (RAG, upload plikow)',
    opis: 'Nowa wiedza trafia do zespolu bez przebudowy aplikacji.',
    kiedy: 'Wkrotce · Faza 3 roadmapy 2.0',
    status: 'w-budowie',
    Ikona: Database,
  },
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

  // Glos JARVIS: przelacznik auto-czytania odpowiedzi w Centrum.
  const glosTtsOK = isTtsSupported() && czyDostepnyGlosPL()
  const glosSttOK = isSttSupported()
  const [autoCzytaj, setAutoCzytaj] = useState(() => czytajAutoWlaczone())

  function przelaczAutoCzytaj() {
    if (!glosTtsOK) return
    const nowy = !autoCzytaj
    setAutoCzytaj(nowy)
    ustawCzytajAuto(nowy)
  }

  // Tryb realny = jakiekolwiek dzialajace polaczenie z modelem
  // (klucz uzytkownika, proxy serwera albo klucz z env), nie tylko klucz lokalny.
  const realMode = getMode() !== 'demo'

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

      {/* Sekcja: polaczenie z modelem */}
      <section aria-label="Polaczenie z modelem">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Polaczenie z modelem
          </h2>
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
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
          </span>
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
      </section>

      {/* Sekcja: Glos JARVIS */}
      <section aria-label="Glos JARVIS" className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Mic size={14} className="text-brand-soft" aria-hidden />
          Glos JARVIS
        </h2>
        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-200">
                Automatycznie czytaj odpowiedzi w Centrum
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Po zakonczeniu pracy zespolu COO przeczyta odpowiedz na glos.
                {glosSttOK
                  ? ' Rozmowa glosem dziala w tej przegladarce.'
                  : ' Rozpoznawanie mowy dziala w Chrome i Edge.'}
              </p>
              {!glosTtsOK && (
                <p className="mt-1 text-xs text-amber-200/90">
                  Brak polskiego glosu w tej przegladarce, wiec czytanie jest
                  niedostepne.
                </p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoCzytaj}
              aria-label="Automatycznie czytaj odpowiedzi w Centrum"
              onClick={przelaczAutoCzytaj}
              disabled={!glosTtsOK}
              className={[
                'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                autoCzytaj ? 'bg-brand' : 'bg-zinc-700',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 transform rounded-full bg-zinc-950 transition-transform',
                  autoCzytaj ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
                aria-hidden
              />
            </button>
          </div>
          <p className="border-t border-zinc-800 pt-3 text-xs leading-relaxed text-zinc-500">
            Wersja pro (ElevenLabs / OpenAI realtime, naturalny glos i nizsze
            opoznienia) jest w przygotowaniu.
          </p>
        </div>
      </section>

      {/* Sekcja: integracje i mozliwosci */}
      <section aria-label="Integracje i mozliwosci" className="mt-10">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Integracje i mozliwosci
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-zinc-500">
          Stan faktyczny na dzis: karty oznaczone "W budowie" nie maja jeszcze
          zadnych dzialajacych funkcji, terminy wg roadmapy 2.0.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {INTEGRACJE.map((item) => {
            const badge = STATUS_BADGE[item.status]
            const wBudowie = item.status === 'w-budowie'
            return (
              <div
                key={item.tytul}
                className={[
                  'flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4',
                  wBudowie ? 'opacity-75' : '',
                ]
                  .join(' ')
                  .trim()}
              >
                <div className="flex items-start justify-between gap-2">
                  <item.Ikona
                    size={18}
                    className="mt-0.5 flex-shrink-0 text-brand-soft"
                    aria-hidden
                  />
                  <span
                    className={[
                      'inline-flex flex-shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                      badge.klasa,
                    ].join(' ')}
                  >
                    {item.etykietaBadge ?? badge.label}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {item.tytul}
                </h3>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {item.opis}
                </p>
                {item.meta && (
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    {item.meta}
                  </p>
                )}
                {item.kiedy && (
                  <p className="mt-auto pt-1 text-[11px] font-medium text-zinc-500">
                    {item.kiedy}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

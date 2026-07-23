import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Lock } from 'lucide-react'
import {
  PROFILE,
  setSesja,
  type IdProfilu,
  type Profil,
  type Rola,
} from '../lib/storage'
import { useProfil } from './ProfilContext'
import Logo from './Logo'

/** Kolor akcentu kafla per profil (spojny z Sidebar). */
const AKCENT: Record<string, string> = {
  pawel: '#5B8DEF',
  marcin: '#34D399',
}

/** Wynik proby logowania na /api/login. */
type OdpLogowania =
  | { stan: 'ok'; token: string; rola: Rola }
  | { stan: 'otwarty'; rola: Rola }
  | { stan: 'zle-haslo' }
  | { stan: 'blad'; kod: string }

/** Rola przypisana na sztywno do konta (spojna z PROFILE i serwerem). */
function rolaKonta(id: IdProfilu): Rola {
  return id === 'pawel' ? 'admin-techniczny' : 'admin'
}

/** POST /api/login: 200 -> token, 503 -> tryb otwarty, 401 -> zle haslo. */
async function logujRequest(
  uzytkownik: IdProfilu,
  haslo: string,
): Promise<OdpLogowania> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uzytkownik, haslo }),
    })
    if (res.status === 503) {
      // brak-konfiguracji (AUTH_SECRET/HASLO_* nieustawione) -> tryb otwarty.
      return { stan: 'otwarty', rola: rolaKonta(uzytkownik) }
    }
    if (res.status === 401) return { stan: 'zle-haslo' }
    if (!res.ok) return { stan: 'blad', kod: `HTTP ${res.status}` }
    const dane = await res.json()
    if (typeof dane?.token === 'string' && dane?.rola) {
      return { stan: 'ok', token: dane.token, rola: dane.rola }
    }
    return { stan: 'blad', kod: 'zla-odpowiedz' }
  } catch {
    return { stan: 'blad', kod: 'siec' }
  }
}

/**
 * Ekran logowania: kafle kont (Pawel/Marcin) + pole hasla + POST /api/login.
 * Gdy serwer nie ma konfiguracji (503) przechodzi w tryb otwarty: konta logują
 * sie bez hasla (jak dotychczasowe profile), z dyskretna nota.
 */
export default function Logowanie() {
  const { odswiez } = useProfil()
  const [konto, setKonto] = useState<Profil | null>(null)
  const [haslo, setHaslo] = useState('')
  const [blad, setBlad] = useState<string | null>(null)
  const [ladowanie, setLadowanie] = useState(false)
  const [trybOtwarty, setTrybOtwarty] = useState(false)

  // Wykrycie trybu otwartego: pusta proba logowania. 503 -> serwer bez konfiguracji.
  useEffect(() => {
    let zywy = true
    logujRequest('pawel', '').then((r) => {
      if (zywy && r.stan === 'otwarty') setTrybOtwarty(true)
    })
    return () => {
      zywy = false
    }
  }, [])

  /** Zapisuje sesje i wpuszcza do aplikacji. */
  function zaloguj(uzytkownik: IdProfilu, token: string, rola: Rola) {
    setSesja({ token, uzytkownik, rola })
    odswiez()
  }

  /** Klik w kafel: tryb otwarty -> od razu wejscie; inaczej pokaz pole hasla. */
  async function wybierzKonto(profil: Profil) {
    setBlad(null)
    if (trybOtwarty) {
      zaloguj(profil.id, '', rolaKonta(profil.id))
      return
    }
    setKonto(profil)
    setHaslo('')
  }

  /** Wyslanie hasla dla wybranego konta. */
  async function wyslijHaslo(e: React.FormEvent) {
    e.preventDefault()
    if (!konto || ladowanie) return
    setBlad(null)
    setLadowanie(true)
    const r = await logujRequest(konto.id, haslo)
    setLadowanie(false)
    if (r.stan === 'ok') {
      zaloguj(konto.id, r.token, r.rola)
      return
    }
    if (r.stan === 'otwarty') {
      setTrybOtwarty(true)
      zaloguj(konto.id, '', r.rola)
      return
    }
    if (r.stan === 'zle-haslo') {
      setBlad('Nieprawidlowe haslo. Sprobuj ponownie.')
      return
    }
    setBlad(`Nie udalo sie zalogowac (${r.kod}). Sprawdz polaczenie.`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={52} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">
            {konto ? `Zaloguj sie, ${konto.imie}` : 'Kto dzis pracuje?'}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            {konto
              ? 'Podaj haslo swojego konta, aby wejsc do zespolu.'
              : 'Wybierz swoje konto. Zespol bedzie zwracal sie do Ciebie po imieniu.'}
          </p>
        </div>

        {!konto && (
          <div className="grid grid-cols-2 gap-4">
            {PROFILE.map((p) => (
              <KafelKonta
                key={p.id}
                profil={p}
                onWybierz={() => void wybierzKonto(p)}
              />
            ))}
          </div>
        )}

        {konto && (
          <form
            onSubmit={wyslijHaslo}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6"
          >
            <label
              htmlFor="haslo"
              className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-200"
            >
              <Lock size={15} className="text-brand-soft" aria-hidden />
              Haslo
            </label>
            <input
              id="haslo"
              type="password"
              value={haslo}
              onChange={(e) => setHaslo(e.target.value)}
              autoComplete="current-password"
              autoFocus
              placeholder="Twoje haslo"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
            />

            {blad && (
              <p
                className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-200"
                role="alert"
              >
                {blad}
              </p>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={ladowanie || haslo.length === 0}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-zinc-950 shadow-glow transition-all hover:bg-brand-soft active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:active:scale-100"
              >
                {ladowanie ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                ) : null}
                Zaloguj sie
              </button>
              <button
                type="button"
                onClick={() => {
                  setKonto(null)
                  setBlad(null)
                  setHaslo('')
                }}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
              >
                <ArrowLeft size={15} aria-hidden />
                Wroc
              </button>
            </div>
          </form>
        )}

        {trybOtwarty && !konto && (
          <p className="mt-6 text-center text-xs text-zinc-600">
            Logowanie nieskonfigurowane. Wejscie bez hasla.
          </p>
        )}
        {!trybOtwarty && !konto && (
          <p className="mt-6 text-center text-xs text-zinc-600">
            Dostep chroniony haslem. Haslo ustawia administrator.
          </p>
        )}
      </div>
    </div>
  )
}

function KafelKonta({
  profil,
  onWybierz,
}: {
  profil: Profil
  onWybierz: () => void
}) {
  const akcent = AKCENT[profil.id] ?? '#5B8DEF'
  const inicjal = profil.imie.charAt(0).toUpperCase()
  const opisRoli =
    profil.rola === 'admin-techniczny' ? 'Admin techniczny' : 'Admin'

  return (
    <button
      type="button"
      onClick={onWybierz}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-7 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 motion-reduce:hover:translate-y-0"
      style={{ ['--acc' as string]: akcent }}
    >
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-zinc-950 transition-transform duration-200 group-hover:scale-105"
        style={{
          background: `linear-gradient(135deg, ${akcent}, ${akcent}bb)`,
          boxShadow: `0 0 22px 1px ${akcent}55`,
        }}
        aria-hidden
      >
        {inicjal}
      </span>
      <span className="text-base font-semibold text-zinc-50">{profil.imie}</span>
      <span
        className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
        style={{
          borderColor: `${akcent}44`,
          color: akcent,
          backgroundColor: `${akcent}12`,
        }}
      >
        {opisRoli}
      </span>
    </button>
  )
}

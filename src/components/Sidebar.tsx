import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Brain, Settings, Repeat } from 'lucide-react'
import Logo from './Logo'
import { useProfil } from './ProfilContext'

interface SidebarProps {
  /** Wywolywane po kliknieciu linku (zamyka panel na mobile) */
  onNavigate?: () => void
}

/** Kolor akcentu per profil (spojny z ekranem wyboru). */
const AKCENT_PROFILU: Record<string, string> = {
  pawel: '#5B8DEF',
  marcin: '#34D399',
}

/** Przelacznik profilu: avatar-inicjal + imie, klik = zmiana na drugi profil. */
function PrzelacznikProfilu() {
  const { profil, przelacz } = useProfil()
  if (!profil) return null
  const akcent = AKCENT_PROFILU[profil.id] ?? '#5B8DEF'
  const inicjal = profil.imie.charAt(0).toUpperCase()
  const rola = profil.rola === 'admin' ? 'Admin' : 'Uzytkownik'

  return (
    <button
      type="button"
      onClick={przelacz}
      title="Zmien profil"
      aria-label={`Zalogowany profil: ${profil.imie}. Kliknij, aby zmienic profil.`}
      className="group mb-1 flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900"
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-zinc-950"
        style={{
          background: `linear-gradient(135deg, ${akcent}, ${akcent}bb)`,
          boxShadow: `0 0 12px 0 ${akcent}55`,
        }}
        aria-hidden
      >
        {inicjal}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold text-zinc-100">
          {profil.imie}
        </span>
        <span className="block truncate text-[0.7rem] text-zinc-500">
          {rola} · zmien profil
        </span>
      </span>
      <Repeat
        size={15}
        className="flex-shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300"
        aria-hidden
      />
    </button>
  )
}

const navItems = [
  { to: '/', label: 'Centrum', icon: LayoutDashboard, end: true },
  { to: '/zespol', label: 'Zespol', icon: Users, end: false },
  { to: '/mozg', label: 'Mozg', icon: Brain, end: false },
  { to: '/ustawienia', label: 'Ustawienia', icon: Settings, end: false },
]

export default function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-zinc-950/60">
      <div className="flex items-center gap-3 px-5 py-6">
        <Logo size={40} />
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight text-zinc-50">
            SF AI TEAM
          </div>
          <div className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Centrum Dowodzenia
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        <div className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-zinc-600">
          Nawigacja
        </div>
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-brand/10 text-white ring-1 ring-brand/30'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {/* Akcentowy znacznik aktywnej pozycji */}
                <span
                  className={[
                    'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-opacity duration-200',
                    isActive ? 'opacity-100' : 'opacity-0',
                  ].join(' ')}
                  aria-hidden
                />
                <Icon
                  size={18}
                  className={
                    isActive
                      ? 'text-brand-soft'
                      : 'text-zinc-500 transition-colors group-hover:text-zinc-300'
                  }
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 border-t border-zinc-800/80 px-2 py-5">
        <PrzelacznikProfilu />
        <div className="mt-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          <div className="text-xs font-semibold text-zinc-300">
            SimpleFast.ai
          </div>
        </div>
        <div className="mt-1 text-xs leading-relaxed text-zinc-500">
          Agent dziala, nie tylko gada.
        </div>
      </div>
    </div>
  )
}

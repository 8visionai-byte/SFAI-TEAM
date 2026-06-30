import { NavLink } from 'react-router-dom'
import { Users, Brain } from 'lucide-react'
import Logo from './Logo'

interface SidebarProps {
  /** Wywolywane po kliknieciu linku (zamyka panel na mobile) */
  onNavigate?: () => void
}

const navItems = [
  { to: '/', label: 'Zespol', icon: Users, end: true },
  { to: '/mozg', label: 'Mozg', icon: Brain, end: false },
]

export default function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="flex items-center gap-3 px-5 py-6">
        <Logo size={40} />
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight text-zinc-50">
            SF AI TEAM
          </div>
          <div className="text-xs text-zinc-500">Centrum Dowodzenia</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand/10 text-white ring-1 ring-brand/30'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
              ].join(' ')
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-zinc-800/80 px-5 py-5">
        <div className="text-xs font-semibold text-zinc-300">SimpleFast.ai</div>
        <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">
          Agent dziala, nie tylko gada.
        </div>
      </div>
    </div>
  )
}

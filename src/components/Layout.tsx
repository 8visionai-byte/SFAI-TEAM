import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import Logo from './Logo'
import { ProfilProvider, useProfil } from './ProfilContext'
import Logowanie from './Logowanie'

export default function Layout() {
  return (
    <ProfilProvider>
      <LayoutInner />
    </ProfilProvider>
  )
}

function LayoutInner() {
  const { profil } = useProfil()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Zamknij menu mobilne przy zmianie trasy
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Escape zamyka menu mobilne
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  // Brak sesji: ekran logowania zamiast aplikacji.
  if (!profil) {
    return <Logowanie />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar staly (desktop) */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-zinc-800/80 lg:block">
        <Sidebar />
      </aside>

      {/* Sidebar wysuwany (mobile) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside
            className="absolute left-0 top-0 h-full w-64 border-r border-zinc-800 shadow-2xl animate-fade-up"
            role="dialog"
            aria-modal="true"
            aria-label="Menu nawigacji"
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              aria-label="Zamknij menu"
            >
              <X size={18} />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Pasek mobilny */}
        <header className="flex items-center gap-3 border-b border-zinc-800/80 px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white"
            aria-label="Otworz menu"
          >
            <Menu size={20} />
          </button>
          <Logo size={28} />
          <span className="text-sm font-bold text-zinc-100">SF AI TEAM</span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

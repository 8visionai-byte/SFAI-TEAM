import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { getProfil, wyloguj as wylogujSesja, type Profil } from '../lib/storage'

interface ProfilCtx {
  /** Aktywny profil (z sesji sf_sesja) albo null, gdy nie zalogowano. */
  profil: Profil | null
  /** Ponownie czyta profil z sesji (po zalogowaniu w ekranie logowania). */
  odswiez: () => void
  /** Wylogowuje: kasuje sesje i wraca do ekranu logowania. */
  wyloguj: () => void
}

const Ctx = createContext<ProfilCtx | null>(null)

/** Dostarcza aktywny profil calej aplikacji (Sidebar, Ustawienia, ton rozmowy). */
export function ProfilProvider({ children }: { children: ReactNode }) {
  const [profil, setP] = useState<Profil | null>(() => getProfil())

  const odswiez = useCallback(() => {
    setP(getProfil())
  }, [])

  const wyloguj = useCallback(() => {
    wylogujSesja()
    setP(null)
  }, [])

  return (
    <Ctx.Provider value={{ profil, odswiez, wyloguj }}>
      {children}
    </Ctx.Provider>
  )
}

/** Hook dostepu do aktywnego profilu. Musi byc uzyty w ProfilProvider. */
export function useProfil(): ProfilCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useProfil uzyty poza ProfilProvider')
  return c
}

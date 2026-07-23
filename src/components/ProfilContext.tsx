import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import {
  getProfil,
  setProfil as zapiszProfil,
  PROFILE,
  type Profil,
} from '../lib/storage'

interface ProfilCtx {
  /** Aktywny profil albo null, gdy jeszcze nie wybrano. */
  profil: Profil | null
  /** Ustawia profil (zapis do localStorage + rerender). */
  wybierz: (p: Profil) => void
  /** Przelacza na drugi profil (Pawel <-> Marcin). */
  przelacz: () => void
}

const Ctx = createContext<ProfilCtx | null>(null)

/** Dostarcza aktywny profil calej aplikacji (Sidebar, Ustawienia, ton rozmowy). */
export function ProfilProvider({ children }: { children: ReactNode }) {
  const [profil, setP] = useState<Profil | null>(() => getProfil())

  const wybierz = useCallback((p: Profil) => {
    zapiszProfil(p)
    setP(p)
  }, [])

  const przelacz = useCallback(() => {
    const aktualny = getProfil()
    const inny =
      PROFILE.find((p) => p.id !== aktualny?.id) ?? PROFILE[0]
    zapiszProfil(inny)
    setP(inny)
  }, [])

  return (
    <Ctx.Provider value={{ profil, wybierz, przelacz }}>
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

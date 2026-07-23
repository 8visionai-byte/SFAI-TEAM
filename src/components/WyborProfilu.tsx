import { PROFILE, type Profil } from '../lib/storage'
import { useProfil } from './ProfilContext'
import Logo from './Logo'

/** Kolor akcentu kafla per profil. */
const AKCENT: Record<string, string> = {
  pawel: '#5B8DEF',
  marcin: '#34D399',
}

/**
 * Ekran wyboru profilu przy pierwszym wejsciu: dwa eleganckie kafle z imionami.
 * Po kliknieciu zapisuje profil (localStorage) i wpuszcza do aplikacji.
 */
export default function WyborProfilu() {
  const { wybierz } = useProfil()

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={52} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">
            Kto dzis pracuje?
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Wybierz swoj profil. Zespol bedzie zwracal sie do Ciebie po imieniu.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {PROFILE.map((p) => (
            <KafelProfilu key={p.id} profil={p} onWybierz={() => wybierz(p)} />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Profil zmienisz w kazdej chwili w panelu bocznym.
        </p>
      </div>
    </div>
  )
}

function KafelProfilu({
  profil,
  onWybierz,
}: {
  profil: Profil
  onWybierz: () => void
}) {
  const akcent = AKCENT[profil.id] ?? '#5B8DEF'
  const inicjal = profil.imie.charAt(0).toUpperCase()
  const opisRoli = profil.rola === 'admin' ? 'Admin' : 'Uzytkownik'

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

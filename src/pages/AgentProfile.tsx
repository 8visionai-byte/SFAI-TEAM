import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Brain, Mic, Plus, Trash2 } from 'lucide-react'
import { getAgent } from '../data/agents'
import {
  nowyId,
  skilleAgenta,
  dodajSkilla,
  przelaczSkilla,
  usunSkilla,
  pamiecAgenta,
  usunWlasnyPlikMozgu,
  wczytajPersonaNadpis,
  zapiszPersonaNadpis,
  usunPersonaNadpis,
  type Umiejetnosc,
  type PlikWlasnyMozgu,
} from '../lib/storage'
import Avatar from '../components/Avatar'
import RozmowaGlosowa from '../components/RozmowaGlosowa'
import Toast, { useToast } from '../components/Toast'

/** Naglowek sekcji profilu (jednolity styl). */
function NaglowekSekcji({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
      {children}
    </h2>
  )
}

/** Tytul pliku pamieci: pierwsza linia "# ..." albo nazwa pliku. */
function tytulPamieci(p: PlikWlasnyMozgu): string {
  const m = p.tresc.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : 'Rozmowa'
}

/** Krotka data pliku pamieci (z updatedAt). */
function dataPamieci(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Podglad tresci pamieci: pomija tytul i linie metadanych (Data/Uczestnik). */
function podgladPamieci(tresc: string, max = 220): string {
  const czyste = tresc
    .split('\n')
    .filter(
      (l) =>
        !l.startsWith('#') &&
        !/^-\s*(Data|Uczestnik)\s*:/i.test(l.trim()) &&
        l.trim() !== '',
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return czyste.length > max ? `${czyste.slice(0, max)}...` : czyste
}

/**
 * Profil agenta: hero z aura koloru, misja, zespol wykonawczy, umiejetnosci
 * wbudowane (z AGENT.md, statyczne w agents.ts) oraz wlasne umiejetnosci
 * dodawane przez wlasciciela (localStorage, sf_skille). Aktywne wlasne
 * umiejetnosci sa realnie doklejane do system promptu agenta w kazdej rozmowie.
 */
export default function AgentProfile() {
  const { slug } = useParams<{ slug: string }>()
  const agent = getAgent(slug)

  const [skille, setSkille] = useState<Umiejetnosc[]>([])
  const [nazwa, setNazwa] = useState('')
  const [instrukcja, setInstrukcja] = useState('')
  const [glosOtwarty, setGlosOtwarty] = useState(false)
  const [pamiec, setPamiec] = useState<PlikWlasnyMozgu[]>([])
  // Edytowalna persona (nadpis od wlasciciela): dwa pola tekstowe.
  const [kimJestem, setKimJestem] = useState('')
  const [jakSieZwracam, setJakSieZwracam] = useState('')
  const { toast, pokazToast } = useToast()

  // Wczytanie wlasnych umiejetnosci, pamieci i nadpisu persony przy zmianie agenta.
  useEffect(() => {
    setSkille(slug ? skilleAgenta(slug) : [])
    setPamiec(slug ? pamiecAgenta(slug) : [])
    const nadpis = slug ? wczytajPersonaNadpis(slug) : null
    setKimJestem(nadpis?.kimJestem ?? '')
    setJakSieZwracam(nadpis?.jakSieZwracam ?? '')
    setNazwa('')
    setInstrukcja('')
  }, [slug])

  if (!agent) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="text-2xl font-bold text-zinc-100">
          Nie znaleziono agenta
        </h1>
        <p className="mt-2 text-zinc-400">Ten agent nie istnieje w zespole.</p>
        <Link
          to="/zespol"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
        >
          <ArrowLeft size={16} />
          Wroc do zespolu
        </Link>
      </div>
    )
  }

  const aktywny = agent.hasPrompt

  function dodaj() {
    if (!agent) return
    const n = nazwa.trim()
    const i = instrukcja.trim()
    if (!n || !i) return
    const skill: Umiejetnosc = {
      id: nowyId(),
      agentSlug: agent.slug,
      nazwa: n,
      instrukcja: i,
      aktywna: true,
    }
    dodajSkilla(skill)
    setSkille(skilleAgenta(agent.slug))
    setNazwa('')
    setInstrukcja('')
    pokazToast('Dodano umiejetnosc. Agent zastosuje ja w kolejnej rozmowie.')
  }

  function przelacz(id: string) {
    if (!agent) return
    przelaczSkilla(id)
    setSkille(skilleAgenta(agent.slug))
  }

  function usun(id: string) {
    if (!agent) return
    usunSkilla(id)
    setSkille(skilleAgenta(agent.slug))
    pokazToast('Usunieto umiejetnosc.')
  }

  function usunPamiec(sciezka: string) {
    if (!agent) return
    usunWlasnyPlikMozgu(sciezka)
    setPamiec(pamiecAgenta(agent.slug))
    pokazToast('Usunieto wpis pamieci.')
  }

  function zapiszPersone() {
    if (!agent) return
    zapiszPersonaNadpis(agent.slug, kimJestem, jakSieZwracam)
    pokazToast('Zapisano persone. Agent zastosuje ja w kolejnej rozmowie.')
  }

  function przywrocPersone() {
    if (!agent) return
    usunPersonaNadpis(agent.slug)
    setKimJestem('')
    setJakSieZwracam('')
    pokazToast('Przywrocono domyslna persone.')
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <Link
        to="/zespol"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft size={14} />
        Wroc do zespolu
      </Link>

      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 animate-fade-up sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl"
          style={{ background: agent.accent }}
          aria-hidden
        />
        {/* Aura odcienia agenta za portretem hero */}
        <div
          className="pointer-events-none absolute -left-10 -top-10 h-44 w-44 rounded-full opacity-20 blur-3xl"
          style={{ background: agent.accent }}
          aria-hidden
        />
        <Avatar agent={agent} size="2xl" aura="strong" profile />
        <h1 className="mt-4 text-2xl font-bold text-zinc-50 sm:text-3xl">
          {agent.name}
        </h1>
        <p
          className="mt-1 text-sm font-medium"
          style={{ color: agent.accent }}
        >
          {agent.role}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            <span
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: agent.accent }}
              aria-hidden
            />
            Kafelek {agent.tileNo}
          </span>
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium',
              aktywny
                ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25'
                : 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700',
            ].join(' ')}
          >
            <span
              className={[
                'h-1.5 w-1.5 rounded-full',
                aktywny ? 'bg-emerald-400' : 'bg-zinc-500',
              ].join(' ')}
              aria-hidden
            />
            {aktywny ? 'Aktywny' : 'Wkrotce'}
          </span>
        </div>
        <p className="mt-4 max-w-2xl text-[0.975rem] leading-relaxed text-zinc-300">
          {agent.mission}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            to={`/czat/${agent.slug}`}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition-all hover:bg-brand-soft active:scale-95 motion-reduce:active:scale-100"
          >
            Rozmawiaj
            <ArrowRight size={17} />
          </Link>
          <button
            type="button"
            onClick={() => setGlosOtwarty(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-brand/40 bg-zinc-950/40 px-5 py-3 text-sm font-semibold text-brand-soft transition-colors hover:border-brand/70 hover:bg-brand/10"
          >
            <Mic size={17} aria-hidden />
            Porozmawiaj z glosem
          </button>
        </div>
      </div>

      {/* Persona (edytowalna) */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <NaglowekSekcji>Persona (edytowalna)</NaglowekSekcji>
        <p className="mt-1.5 text-xs text-zinc-500">
          Twoje ustawienia maja pierwszenstwo nad domyslnym stylem tej persony.
          Wpisz kim ma byc i jak ma sie do Was zwracac. Dziala od nastepnej
          wiadomosci, tak samo w czacie i w rozmowie glosem.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="persona-kim"
              className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-zinc-500"
            >
              Kim jest i jaka jest
            </label>
            <textarea
              id="persona-kim"
              value={kimJestem}
              onChange={(e) => setKimJestem(e.target.value)}
              rows={3}
              placeholder="Np. Ciepla, konkretna i lekko zadziorna. Traktuje mnie jak partnera, nie klienta."
              className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm leading-relaxed text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
            />
          </div>
          <div>
            <label
              htmlFor="persona-zwrot"
              className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-zinc-500"
            >
              Jak zwraca sie do nas
            </label>
            <textarea
              id="persona-zwrot"
              value={jakSieZwracam}
              onChange={(e) => setJakSieZwracam(e.target.value)}
              rows={2}
              placeholder="Np. Mow mi po imieniu, na luzie. Zaczynaj krotko: 'Czesc! Co robimy?'"
              className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm leading-relaxed text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.7rem] text-zinc-600">
              Zapisuje sie w tej przegladarce.
            </p>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={przywrocPersone}
                disabled={!kimJestem.trim() && !jakSieZwracam.trim()}
                className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Przywroc domyslne
              </button>
              <button
                type="button"
                onClick={zapiszPersone}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-brand-soft"
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Zespol wykonawczy */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <NaglowekSekcji>Zespol wykonawczy</NaglowekSekcji>
        <p className="mt-1.5 text-xs text-zinc-500">
          Subagenci, do ktorych ten agent deleguje robote wykonawcza.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {agent.subagents.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-zinc-300"
              style={{ borderColor: `${agent.accent}55` }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: agent.accent }}
                aria-hidden
              />
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* Umiejetnosci wbudowane */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <NaglowekSekcji>Umiejetnosci wbudowane</NaglowekSekcji>
        <p className="mt-1.5 text-xs text-zinc-500">
          Frameworki i metody zapisane na stale w instrukcji tego agenta.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {agent.skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-200"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: agent.accent }}
                aria-hidden
              />
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* Wlasne umiejetnosci */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <NaglowekSekcji>Wlasne umiejetnosci</NaglowekSekcji>
        <p className="mt-1.5 text-xs text-zinc-500">
          Twoje dodatkowe instrukcje dla tego agenta. Aktywne sa doklejane do
          jego instrukcji w kazdej rozmowie.
        </p>

        {/* Lista dodanych */}
        <div className="mt-4 space-y-2">
          {skille.length === 0 && (
            <p className="text-xs text-zinc-500">
              Brak wlasnych umiejetnosci. Dodaj pierwsza ponizej.
            </p>
          )}
          {skille.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 animate-pop-in"
            >
              <button
                type="button"
                role="switch"
                aria-checked={s.aktywna}
                aria-label={
                  s.aktywna
                    ? `Wylacz umiejetnosc: ${s.nazwa}`
                    : `Wlacz umiejetnosc: ${s.nazwa}`
                }
                onClick={() => przelacz(s.id)}
                className={[
                  'relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors',
                  s.aktywna ? '' : 'bg-zinc-700',
                ].join(' ')}
                style={{
                  backgroundColor: s.aktywna ? agent.accent : undefined,
                }}
              >
                <span
                  className={[
                    'absolute top-0.5 h-4 w-4 rounded-full bg-zinc-950 transition-all',
                    s.aktywna ? 'left-[18px]' : 'left-0.5',
                  ].join(' ')}
                  aria-hidden
                />
              </button>
              <div className="min-w-0 flex-1">
                <div
                  className={[
                    'text-sm font-semibold',
                    s.aktywna ? 'text-zinc-100' : 'text-zinc-500 line-through',
                  ].join(' ')}
                >
                  {s.nazwa}
                </div>
                <p
                  className={[
                    'mt-0.5 text-xs leading-relaxed',
                    s.aktywna ? 'text-zinc-400' : 'text-zinc-600',
                  ].join(' ')}
                >
                  {s.instrukcja}
                </p>
                <div className="mt-1 text-[0.65rem] font-medium">
                  {s.aktywna ? (
                    <span className="text-emerald-300">Aktywna</span>
                  ) : (
                    <span className="text-zinc-500">Wylaczona</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => usun(s.id)}
                aria-label={`Usun umiejetnosc: ${s.nazwa}`}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>

        {/* Formularz dodawania */}
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
          <div className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Dodaj umiejetnosc
          </div>
          <input
            value={nazwa}
            onChange={(e) => setNazwa(e.target.value)}
            aria-label="Nazwa umiejetnosci"
            placeholder="Nazwa, np. Oferty pisz zawsze w trzech wariantach"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
          />
          <textarea
            value={instrukcja}
            onChange={(e) => setInstrukcja(e.target.value)}
            rows={3}
            aria-label="Instrukcja umiejetnosci"
            placeholder="Instrukcja dla agenta: co ma robic, jak i kiedy..."
            className="mt-2 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm leading-relaxed text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[0.7rem] text-zinc-600">
              Zapisuje sie w tej przegladarce, dziala od nastepnej wiadomosci.
            </p>
            <button
              type="button"
              onClick={dodaj}
              disabled={!nazwa.trim() || !instrukcja.trim()}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} aria-hidden />
              Dodaj
            </button>
          </div>
        </div>
      </section>

      {/* Pamiec agenta */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Brain size={15} style={{ color: agent.accent }} aria-hidden />
          <NaglowekSekcji>Pamiec</NaglowekSekcji>
          <span className="rounded-full bg-zinc-800/80 px-1.5 py-px text-[0.65rem] font-medium tabular-nums text-zinc-400">
            {pamiec.length}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          Streszczenia wczesniejszych rozmow z {agent.personImie ?? agent.name}.
          Agent czyta je razem z mozgiem i przywola, gdy zapytasz o wczesniejsze
          ustalenia. Zapis wlaczysz lub wylaczysz w Ustawieniach.
        </p>

        <div className="mt-4 space-y-2">
          {pamiec.length === 0 && (
            <p className="text-xs text-zinc-500">
              Brak zapisanej pamieci. Po zakonczeniu rozmowy pojawi sie tutaj
              automatycznie.
            </p>
          )}
          {pamiec.map((p) => (
            <div
              key={p.sciezka}
              className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-100">
                  {tytulPamieci(p)}
                </div>
                <div className="mt-0.5 text-[0.65rem] text-zinc-500">
                  {dataPamieci(p.updatedAt)}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {podgladPamieci(p.tresc)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => usunPamiec(p.sciezka)}
                aria-label={`Usun wpis pamieci: ${tytulPamieci(p)}`}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </section>

      {glosOtwarty && (
        <RozmowaGlosowa agent={agent} onClose={() => setGlosOtwarty(false)} />
      )}

      <Toast text={toast} />
    </div>
  )
}

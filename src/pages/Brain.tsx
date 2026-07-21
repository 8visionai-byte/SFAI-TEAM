import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  FileText,
  Brain as BrainIcon,
  StickyNote,
  Trash2,
  Download,
  Share2,
  Pencil,
  Save,
  Upload,
  X,
  RotateCcw,
  Plus,
  Search,
} from 'lucide-react'
import {
  getBrainFiles,
  brainGroupOrder,
  type BrainFile,
} from '../lib/content'
import {
  wczytajNotatki,
  usunNotatke,
  zapiszNadpisMozgu,
  usunNadpisMozgu,
  zapiszWlasnyPlikMozgu,
  usunWlasnyPlikMozgu,
  type Notatka,
} from '../lib/storage'
import MarkdownView from '../components/MarkdownView'
import BrainGraph from '../components/BrainGraph'
import GrafPanel from '../components/GrafPanel'
import Toast, { useToast } from '../components/Toast'
import { buildBrainGraph, type GraphNode } from '../lib/brainGraph'

/** Ladniejsza nazwa pliku do listy. */
function prettyName(name: string): string {
  return name.replace(/^_/, '').replace(/-/g, ' ')
}

/** Czytelna data notatki. */
function formatujDate(iso: string): string {
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

/** Pobiera notatke jako plik .md. */
function pobierzNotatke(n: Notatka) {
  const md = [
    `# ${n.tytul}`,
    '',
    `Zrodlo: ${n.zrodlo}`,
    `Data: ${formatujDate(n.data)}`,
    '',
    n.tresc,
    '',
  ].join('\n')
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `notatka-${n.id}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Slug nazwy wlasnego pliku (bez polskich znakow i spacji). */
function slugNazwy(nazwa: string): string {
  const mapa: Record<string, string> = {
    ą: 'a',
    ć: 'c',
    ę: 'e',
    ł: 'l',
    ń: 'n',
    ó: 'o',
    ś: 's',
    ź: 'z',
    ż: 'z',
  }
  const slug = nazwa
    .trim()
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => mapa[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'plik'
}

/** Grupy do wyboru przy dodawaniu wlasnego pliku. */
const GRUPY_WLASNE: { key: string; label: string }[] = [
  { key: 'wlasne', label: 'Wlasne pliki' },
  ...brainGroupOrder,
]

/** Grupy do wyboru przy imporcie .md (domyslnie "notatki"). */
const GRUPY_IMPORTU: { key: string; label: string }[] = [
  { key: 'notatki', label: 'Notatki' },
  ...GRUPY_WLASNE,
]

/** Etykieta grupy w liscie plikow (grupy spoza brainGroupOrder). */
function etykietaGrupy(key: string): string {
  if (key === 'wlasne') return 'Wlasne pliki'
  if (key === 'notatki') return 'Notatki'
  if (key === 'z-rozmow') return 'Z rozmow'
  return key
}

/** Polska odmiana slowa "plik" dla licznikow. */
function odmienPliki(n: number): string {
  if (n === 1) return '1 plik'
  const r = n % 10
  const r100 = n % 100
  if (r >= 2 && r <= 4 && (r100 < 12 || r100 > 14)) return `${n} pliki`
  return `${n} plikow`
}

/** Sciezka wzgledna pliku mozgu (od src/content/mozg/) do naglowka eksportu. */
function wzglednaSciezka(path: string): string {
  const marker = '/content/mozg/'
  const idx = path.indexOf(marker)
  return idx >= 0 ? path.slice(idx + marker.length) : path
}

/** Pobiera tekst jako plik przez Blob (bez zaleznosci zewnetrznych). */
function pobierzPlikTekstowy(nazwa: string, tresc: string): void {
  const blob = new Blob([tresc], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nazwa
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const przyciskSm =
  'inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white'

const poleTekstowe =
  'w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-brand/50 focus:ring-1 focus:ring-brand/40'

type Widok = 'baza' | 'notatki' | 'graf'

export default function Brain() {
  const [widok, setWidok] = useState<Widok>('baza')
  // Licznik wersji warstwy nadpisow: kazda edycja podbija i wymusza odczyt storage.
  const [wersja, setWersja] = useState(0)
  const pliki = useMemo(() => getBrainFiles(), [wersja])

  const [activePath, setActivePath] = useState<string>(
    () => getBrainFiles()[0]?.path ?? '',
  )
  const [notatki, setNotatki] = useState<Notatka[]>(() => wczytajNotatki())
  const [aktywnaNotatkaId, setAktywnaNotatkaId] = useState<string>('')
  // Wybrany wezel grafu: podglad w panelu bocznym (nie nawiguje).
  const [wybrany, setWybrany] = useState<GraphNode | null>(null)

  // Wyszukiwarka po tytulach plikow (proste filtrowanie listy).
  const [szukaj, setSzukaj] = useState('')

  // Tryb edycji pliku + potwierdzenia inline.
  const [edycja, setEdycja] = useState(false)
  const [draft, setDraft] = useState('')
  const [potwierdzPrzywroc, setPotwierdzPrzywroc] = useState(false)
  const [potwierdzUsun, setPotwierdzUsun] = useState(false)

  // Formularz "Dodaj plik" (wlasny plik uzytkownika).
  const [dodawanie, setDodawanie] = useState(false)
  const [nowaNazwa, setNowaNazwa] = useState('')
  const [nowaGrupa, setNowaGrupa] = useState('wlasne')
  const [nowaTresc, setNowaTresc] = useState('')

  // Most Obsidian: eksport calego mozgu do jednego .md i import notatek .md.
  const [grupaImportu, setGrupaImportu] = useState('notatki')
  const importInputRef = useRef<HTMLInputElement>(null)

  const { toast, pokazToast } = useToast()

  const grouped = useMemo(() => {
    const q = szukaj.trim().toLowerCase()
    const widoczne = q
      ? pliki.filter((f) => prettyName(f.name).toLowerCase().includes(q))
      : pliki
    const map = new Map<string, BrainFile[]>()
    for (const f of widoczne) {
      const arr = map.get(f.group) ?? []
      arr.push(f)
      map.set(f.group, arr)
    }
    // grupy wg kolejnosci, reszta na koniec
    const ordered: { key: string; label: string; files: BrainFile[] }[] = []
    for (const g of brainGroupOrder) {
      const files = map.get(g.key)
      if (files && files.length) {
        ordered.push({ key: g.key, label: g.label, files })
        map.delete(g.key)
      }
    }
    for (const [key, files] of map) {
      ordered.push({ key, label: etykietaGrupy(key), files })
    }
    return ordered
  }, [pliki, szukaj])

  // Model grafu budowany raz i wspoldzielony przez BrainGraph i GrafPanel.
  // Czyta przez warstwe nadpisow: nadpisane i wlasne pliki tez sa widoczne.
  const grafModel = useMemo(
    () => buildBrainGraph(notatki, pliki),
    [notatki, pliki],
  )
  const grafStats = grafModel.stats

  // Gdy model sie zmieni (np. usunieto notatke), wyczysc podglad nieistniejacego wezla.
  useEffect(() => {
    if (wybrany && !grafModel.nodes.some((n) => n.id === wybrany.id)) {
      setWybrany(null)
    }
  }, [grafModel, wybrany])

  // Zmiana aktywnego pliku wychodzi z trybu edycji i chowa potwierdzenia (MVP wg spec).
  useEffect(() => {
    setEdycja(false)
    setPotwierdzPrzywroc(false)
    setPotwierdzUsun(false)
  }, [activePath])

  // Gdy aktywny plik zniknal (usuniety plik wlasny), przejdz na pierwszy z listy.
  useEffect(() => {
    if (activePath && !pliki.some((f) => f.path === activePath)) {
      setActivePath(pliki[0]?.path ?? '')
    }
  }, [pliki, activePath])

  function otworzPlikZGrafu(path: string) {
    setActivePath(path)
    setDodawanie(false)
    setWidok('baza')
  }

  const active = pliki.find((f) => f.path === activePath)
  const aktywnaNotatka =
    notatki.find((n) => n.id === aktywnaNotatkaId) ?? notatki[0]

  function otworzNotatki() {
    setNotatki(wczytajNotatki())
    setWidok('notatki')
  }

  function usunZNotatek(id: string) {
    usunNotatke(id)
    const nast = wczytajNotatki()
    setNotatki(nast)
    if (id === aktywnaNotatka?.id) {
      setAktywnaNotatkaId(nast[0]?.id ?? '')
    }
  }

  // --- Edycja mozgu (nadpisy lokalne + pliki wlasne) -----------------------

  function zacznijEdycje() {
    if (!active) return
    setDraft(active.content)
    setEdycja(true)
    setPotwierdzPrzywroc(false)
    setPotwierdzUsun(false)
  }

  function zapiszEdycje() {
    if (!active) return
    if (active.wlasny) {
      zapiszWlasnyPlikMozgu({
        sciezka: active.path,
        tresc: draft,
        grupa: active.group,
        updatedAt: new Date().toISOString(),
      })
      pokazToast('Zapisano zmiany w pliku wlasnym.')
    } else {
      zapiszNadpisMozgu(active.path, draft)
      pokazToast('Zapisano lokalnie. Oryginal w repo bez zmian.')
    }
    setEdycja(false)
    setWersja((w) => w + 1)
  }

  function przywrocOryginal() {
    if (!active) return
    usunNadpisMozgu(active.path)
    setPotwierdzPrzywroc(false)
    setWersja((w) => w + 1)
    pokazToast('Przywrocono oryginal pliku.')
  }

  function usunPlikWlasny() {
    if (!active) return
    usunWlasnyPlikMozgu(active.path)
    setPotwierdzUsun(false)
    setWersja((w) => w + 1)
    pokazToast('Usunieto plik wlasny.')
  }

  function dodajPlik() {
    const nazwa = nowaNazwa.trim()
    if (!nazwa) return
    const baza = slugNazwy(nazwa)
    const zajete = new Set(pliki.map((f) => f.path))
    let sciezka = `wlasne/${baza}.md`
    let nr = 2
    while (zajete.has(sciezka)) {
      sciezka = `wlasne/${baza}-${nr}.md`
      nr++
    }
    zapiszWlasnyPlikMozgu({
      sciezka,
      tresc: nowaTresc,
      grupa: nowaGrupa,
      updatedAt: new Date().toISOString(),
    })
    setDodawanie(false)
    setNowaNazwa('')
    setNowaTresc('')
    setNowaGrupa('wlasne')
    setWersja((w) => w + 1)
    setActivePath(sciezka)
    pokazToast('Dodano plik wlasny. Agenci czytaja go razem z mozgiem.')
  }

  // --- Most Obsidian: eksport / import mozgu -------------------------------

  /**
   * Eksport calego mozgu (z warstwa nadpisow i plikami wlasnymi) do JEDNEGO
   * pliku markdown z separatorami "=== PLIK: sciezka ===".
   */
  function eksportujMozg() {
    const md = pliki
      .map((f) => `=== PLIK: ${wzglednaSciezka(f.path)} ===\n${f.content.trim()}`)
      .join('\n\n')
    const data = new Date().toISOString().slice(0, 10)
    pobierzPlikTekstowy(`mozg-sfai-${data}.md`, `${md}\n`)
    pokazToast(`Wyeksportowano mozg: ${odmienPliki(pliki.length)} w jednym .md.`)
  }

  /** Import wybranych plikow .md jako pliki wlasne mozgu (sf_mozg_wlasne). */
  async function importujPliki(e: ChangeEvent<HTMLInputElement>) {
    const wybrane = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (wybrane.length === 0) return
    const zajete = new Set(pliki.map((f) => f.path))
    let dodane = 0
    for (const plik of wybrane) {
      const tresc = await plik.text()
      const baza = slugNazwy(plik.name.replace(/\.(md|markdown|txt)$/i, ''))
      let sciezka = `wlasne/${baza}.md`
      let nr = 2
      while (zajete.has(sciezka)) {
        sciezka = `wlasne/${baza}-${nr}.md`
        nr++
      }
      zajete.add(sciezka)
      zapiszWlasnyPlikMozgu({
        sciezka,
        tresc,
        grupa: grupaImportu,
        updatedAt: new Date().toISOString(),
      })
      dodane++
    }
    setWersja((w) => w + 1)
    pokazToast(
      `Zaimportowano ${odmienPliki(dodane)} do mozgu (grupa: ${etykietaGrupy(grupaImportu)}).`,
    )
  }

  const zakladka = (aktywna: boolean) =>
    [
      'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
      aktywna
        ? 'bg-brand/10 text-white ring-1 ring-brand/30'
        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
    ].join(' ')

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col">
      <header className="px-5 py-6 sm:px-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <BrainIcon size={12} className="text-brand-soft" />
          Wspolna wiedza
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-3xl">
          Mozg firmy
        </h1>
        <p className="mt-2 max-w-2xl text-[0.975rem] leading-relaxed text-zinc-400">
          Wspolna baza wiedzy. To samo zrodlo prawdy, ktore czyta kazdy agent
          przed odpowiedzia. Zmiany zapisuja sie w tej przegladarce; po
          podlaczeniu bazy przejda na serwer.
        </p>

        {/* Zakladki: baza wiedzy / notatki */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWidok('baza')}
            className={zakladka(widok === 'baza')}
          >
            <FileText size={15} aria-hidden />
            Baza wiedzy
          </button>
          <button
            type="button"
            onClick={otworzNotatki}
            className={zakladka(widok === 'notatki')}
          >
            <StickyNote size={15} aria-hidden />
            Notatki
            <span className="rounded-full bg-zinc-800/80 px-1.5 py-px text-[0.65rem] font-medium tabular-nums text-zinc-400">
              {notatki.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setWidok('graf')}
            className={zakladka(widok === 'graf')}
          >
            <Share2 size={15} aria-hidden />
            Graf
          </button>
        </div>
      </header>

      {widok === 'baza' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 px-5 pb-10 sm:px-8 lg:grid-cols-[280px_1fr]">
          {/* Lista plikow */}
          <nav className="lg:overflow-y-auto lg:pr-1">
            <div className="mb-4 space-y-2">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  aria-hidden
                />
                <input
                  type="search"
                  value={szukaj}
                  onChange={(e) => setSzukaj(e.target.value)}
                  placeholder="Szukaj pliku..."
                  aria-label="Szukaj pliku po tytule"
                  className={`${poleTekstowe} pl-8`}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setDodawanie(true)
                  setEdycja(false)
                  setPotwierdzPrzywroc(false)
                  setPotwierdzUsun(false)
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <Plus size={15} aria-hidden />
                Dodaj plik
              </button>

              {/* Most Obsidian: eksport calego mozgu i import notatek .md */}
              <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-2.5">
                <button
                  type="button"
                  onClick={eksportujMozg}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  <Download size={14} aria-hidden />
                  Eksportuj mozg (.md)
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                  >
                    <Upload size={14} aria-hidden />
                    Importuj .md
                  </button>
                  <select
                    value={grupaImportu}
                    onChange={(e) => setGrupaImportu(e.target.value)}
                    aria-label="Grupa dla importowanych plikow"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-300 outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
                  >
                    {GRUPY_IMPORTU.map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".md,.markdown,.txt"
                  multiple
                  onChange={importujPliki}
                  className="hidden"
                  aria-hidden
                  tabIndex={-1}
                />
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  Dziala z Obsidianem: eksportuj do vaulta, importuj notatki z
                  powrotem.
                </p>
              </div>
            </div>

            {grouped.length === 0 ? (
              <p className="px-1 text-sm leading-relaxed text-zinc-500">
                Brak plikow pasujacych do wyszukiwania.
              </p>
            ) : (
              <div className="space-y-5">
                {grouped.map((group) => (
                  <div key={group.key}>
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        {group.label}
                      </span>
                      <span className="rounded-full bg-zinc-800/80 px-1.5 py-px text-[0.65rem] font-medium tabular-nums text-zinc-500">
                        {group.files.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {group.files.map((f) => {
                        const isActive = f.path === activePath && !dodawanie
                        return (
                          <button
                            key={f.path}
                            onClick={() => {
                              setActivePath(f.path)
                              setDodawanie(false)
                            }}
                            className={[
                              'relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150',
                              isActive
                                ? 'bg-brand/10 text-white ring-1 ring-brand/30'
                                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
                            ].join(' ')}
                          >
                            {isActive && (
                              <span
                                className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
                                aria-hidden
                              />
                            )}
                            <FileText
                              size={15}
                              className={
                                isActive ? 'text-brand-soft' : 'text-zinc-600'
                              }
                            />
                            <span className="min-w-0 flex-1 truncate capitalize">
                              {prettyName(f.name)}
                            </span>
                            {f.zmieniony && (
                              <span
                                className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400"
                                title="zmieniono lokalnie"
                                aria-label="zmieniono lokalnie"
                              />
                            )}
                            {f.wlasny && (
                              <span
                                className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-400"
                                title="plik wlasny"
                                aria-label="plik wlasny"
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </nav>

          {/* Podglad / edycja / formularz nowego pliku */}
          <article className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 lg:overflow-y-auto">
            {dodawanie ? (
              <>
                <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-zinc-800 bg-zinc-900/80 px-6 py-3.5 backdrop-blur sm:px-8">
                  <Plus size={15} className="flex-shrink-0 text-brand-soft" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-200">
                    Nowy plik wlasny
                  </span>
                  <button
                    type="button"
                    onClick={() => setDodawanie(false)}
                    aria-label="Zamknij formularz"
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <div className="space-y-4 p-6 sm:p-8">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Nazwa pliku
                    </span>
                    <input
                      value={nowaNazwa}
                      onChange={(e) => setNowaNazwa(e.target.value)}
                      placeholder="np. cennik uslug dodatkowych"
                      className={poleTekstowe}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Grupa
                    </span>
                    <select
                      value={nowaGrupa}
                      onChange={(e) => setNowaGrupa(e.target.value)}
                      className={poleTekstowe}
                    >
                      {GRUPY_WLASNE.map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Tresc (markdown)
                    </span>
                    <textarea
                      value={nowaTresc}
                      onChange={(e) => setNowaTresc(e.target.value)}
                      spellCheck={false}
                      placeholder="Tresc pliku w markdown..."
                      className="min-h-[280px] w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-[0.85rem] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
                    />
                  </label>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Plik trafi do mozgu firmy i agenci beda go czytac razem z
                    reszta wiedzy. Zmiany zapisuja sie w tej przegladarce; po
                    podlaczeniu bazy przejda na serwer.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={dodajPlik}
                      disabled={!nowaNazwa.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-zinc-950 shadow-glow transition-colors hover:bg-brand-soft disabled:opacity-40"
                    >
                      <Plus size={15} aria-hidden />
                      Dodaj plik
                    </button>
                    <button
                      type="button"
                      onClick={() => setDodawanie(false)}
                      className={przyciskSm}
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              </>
            ) : active ? (
              <>
                <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-6 py-3.5 backdrop-blur sm:px-8">
                  <FileText size={15} className="flex-shrink-0 text-brand-soft" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold capitalize text-zinc-200">
                    {prettyName(active.name)}
                  </span>

                  {edycja ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[0.65rem] font-medium text-brand-soft">
                        <Pencil size={11} aria-hidden />
                        tryb edycji
                      </span>
                      <button
                        type="button"
                        onClick={zapiszEdycje}
                        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-brand-soft"
                      >
                        <Save size={14} aria-hidden />
                        Zapisz
                      </button>
                      <button
                        type="button"
                        onClick={() => setEdycja(false)}
                        className={przyciskSm}
                      >
                        <X size={14} aria-hidden />
                        Anuluj
                      </button>
                    </>
                  ) : (
                    <>
                      {active.wlasny && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-teal-300">
                          plik wlasny
                        </span>
                      )}
                      {active.zmieniony && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-amber-300">
                          <Pencil size={11} aria-hidden />
                          zmieniono lokalnie
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={zacznijEdycje}
                        className={przyciskSm}
                      >
                        <Pencil size={14} aria-hidden />
                        Edytuj
                      </button>
                      {active.zmieniony && !active.wlasny && (
                        <button
                          type="button"
                          onClick={() => setPotwierdzPrzywroc(true)}
                          className={`${przyciskSm} hover:text-rose-300`}
                        >
                          <RotateCcw size={14} aria-hidden />
                          Przywroc oryginal
                        </button>
                      )}
                      {active.wlasny && (
                        <button
                          type="button"
                          onClick={() => setPotwierdzUsun(true)}
                          className={`${przyciskSm} hover:text-rose-300`}
                        >
                          <Trash2 size={14} aria-hidden />
                          Usun plik
                        </button>
                      )}
                    </>
                  )}
                </div>

                {potwierdzPrzywroc && (
                  <div className="flex flex-wrap items-center gap-3 border-b border-rose-500/30 bg-rose-500/5 px-6 py-2.5 text-sm text-rose-200 sm:px-8">
                    <span>Przywrocic oryginal? Lokalne zmiany znikna.</span>
                    <button
                      type="button"
                      onClick={przywrocOryginal}
                      className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/30"
                    >
                      Tak, przywroc
                    </button>
                    <button
                      type="button"
                      onClick={() => setPotwierdzPrzywroc(false)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                    >
                      Anuluj
                    </button>
                  </div>
                )}

                {potwierdzUsun && (
                  <div className="flex flex-wrap items-center gap-3 border-b border-rose-500/30 bg-rose-500/5 px-6 py-2.5 text-sm text-rose-200 sm:px-8">
                    <span>Usunac plik wlasny? Tej operacji nie da sie cofnac.</span>
                    <button
                      type="button"
                      onClick={usunPlikWlasny}
                      className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/30"
                    >
                      Tak, usun
                    </button>
                    <button
                      type="button"
                      onClick={() => setPotwierdzUsun(false)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                    >
                      Anuluj
                    </button>
                  </div>
                )}

                <div className="p-6 sm:p-8">
                  {edycja ? (
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                      aria-label={`Edycja pliku: ${prettyName(active.name)}`}
                      className="min-h-[420px] w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-[0.85rem] leading-relaxed text-zinc-200 outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/40"
                    />
                  ) : (
                    <MarkdownView>{active.content}</MarkdownView>
                  )}
                </div>
              </>
            ) : (
              <p className="p-6 text-zinc-500 sm:p-8">
                Wybierz dokument z listy.
              </p>
            )}
          </article>
        </div>
      ) : widok === 'notatki' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 px-5 pb-10 sm:px-8 lg:grid-cols-[320px_1fr]">
          {/* Lista notatek */}
          <nav className="lg:overflow-y-auto lg:pr-1">
            {notatki.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm leading-relaxed text-zinc-400">
                Brak notatek. Uzyj przycisku "Zapisz do pamięci" w czacie z
                agentem albo w Centrum Dowodzenia, a notatka pojawi sie tutaj.
              </div>
            ) : (
              <div className="space-y-1.5">
                {notatki.map((n) => {
                  const isActive = n.id === aktywnaNotatka?.id
                  return (
                    <div key={n.id} className="flex items-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAktywnaNotatkaId(n.id)}
                        className={[
                          'flex min-w-0 flex-1 flex-col rounded-xl px-3 py-2.5 text-left transition-colors',
                          isActive
                            ? 'bg-brand/10 ring-1 ring-brand/30'
                            : 'hover:bg-zinc-900',
                        ].join(' ')}
                      >
                        <span className="truncate text-sm font-medium text-zinc-200">
                          {n.tytul}
                        </span>
                        <span className="mt-0.5 text-[0.7rem] text-zinc-500">
                          {n.zrodlo}, {formatujDate(n.data)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => usunZNotatek(n.id)}
                        aria-label={`Usun notatke: ${n.tytul}`}
                        className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </nav>

          {/* Podglad notatki */}
          <article className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 lg:overflow-y-auto">
            {aktywnaNotatka ? (
              <>
                <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-zinc-800 bg-zinc-900/80 px-6 py-3.5 backdrop-blur sm:px-8">
                  <StickyNote
                    size={15}
                    className="flex-shrink-0 text-brand-soft"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-200">
                    {aktywnaNotatka.tytul}
                  </span>
                  <button
                    type="button"
                    onClick={() => pobierzNotatke(aktywnaNotatka)}
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                  >
                    <Download size={14} aria-hidden />
                    Pobierz .md
                  </button>
                </div>
                <div className="p-6 sm:p-8">
                  <p className="mb-4 text-xs text-zinc-500">
                    {aktywnaNotatka.zrodlo}, zapisano{' '}
                    {formatujDate(aktywnaNotatka.data)}
                  </p>
                  <MarkdownView>{aktywnaNotatka.tresc}</MarkdownView>
                </div>
              </>
            ) : (
              <p className="p-6 text-zinc-500 sm:p-8">
                Wybierz notatke z listy.
              </p>
            )}
          </article>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-5 pb-8 sm:px-8">
          {/* Licznik wezlow i powiazan */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>
              <span className="font-semibold tabular-nums text-zinc-300">
                {grafStats.files +
                  grafStats.personas +
                  grafStats.notes +
                  grafStats.hubs}
              </span>{' '}
              wezlow
            </span>
            <span>
              <span className="font-semibold tabular-nums text-zinc-300">
                {grafStats.links}
              </span>{' '}
              powiazan
            </span>
            <span className="text-zinc-600">
              {grafStats.files} plikow, {grafStats.personas} person,{' '}
              {grafStats.notes} notatek, {grafStats.readsLinks} relacji "czyta",{' '}
              {grafStats.refLinks} odwolan miedzy plikami
            </span>
            <span className="ml-auto hidden text-zinc-600 sm:inline">
              Kliknij wezel, aby zobaczyc szczegoly w panelu obok. Najedz, aby
              podswietlic sasiadow. Przeciagnij wezel, aby ulozyc.
            </span>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
            <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 lg:min-h-0">
              <BrainGraph
                model={grafModel}
                selectedId={wybrany?.id ?? null}
                onSelect={setWybrany}
              />
            </div>
            <div className="min-h-0 max-h-[65vh] lg:max-h-none lg:overflow-hidden">
              <GrafPanel
                node={wybrany}
                model={grafModel}
                notatki={notatki}
                pliki={pliki}
                onSelect={setWybrany}
                onClose={() => setWybrany(null)}
                onOpenFile={otworzPlikZGrafu}
                onDownloadNote={pobierzNotatke}
              />
            </div>
          </div>
        </div>
      )}

      <Toast text={toast} />
    </div>
  )
}

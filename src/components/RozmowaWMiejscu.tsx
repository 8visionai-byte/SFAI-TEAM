import { useEffect, useRef, useState } from 'react'
import { Mic, Save, Square, X } from 'lucide-react'
import { getAgent, type Agent } from '../data/agents'
import {
  startRozmowa,
  type KtoMowi,
  type StanRozmowy,
  type UchwytRozmowy,
  type ZdarzenieZespolu,
} from '../lib/realtime'
import { mowPowitanie, mowTekstem, zatrzymajMowe } from '../lib/eleven'
import { callModel, getMode, sendMessage, type ChatMessage } from '../lib/ai'
import { dodajPlikMozgu } from '../lib/storage'
import { isSttSupported, startListening, stopListening } from '../lib/voice'
import CharacterAvatar from './CharacterAvatar'
import Toast, { useToast } from './Toast'

/** Stan UI: 'gotowy' = przed startem, reszta z maszyny rozmowy. */
export type StanRozmowyUI = 'gotowy' | StanRozmowy
/** Ktory tor glosu realnie dziala. */
type TorGlosu = 'realtime' | 'podstawowy' | null

/**
 * Wpis pelnego transkryptu rozmowy. Oprocz wypowiedzi usera/persony lapiemy tez
 * raporty zespolu i wzmianki o delegacji, zeby briefing narady mial pelny obraz.
 */
type WpisTranskryptu =
  | { kto: KtoMowi; tekst: string }
  | { kto: 'raport'; agent: string; tekst: string }
  | { kto: 'delegacja'; agent: string }

interface Props {
  agent: Agent
  /** Zamkniecie paska (klik "Zakoncz rozmowe" albo ponowny klik mikrofonu). */
  onZamknij: () => void
  /**
   * Raportuje stan i poziom dzwieku (0..1) w gore, zeby wezel persony na mapie
   * neuronu pulsowal i swiecil aura reagujaca na glos. Wolane z throttlingiem.
   */
  onStan?: (stan: StanRozmowyUI, poziom: number) => void
  /**
   * Zdarzenia orkiestracji zespolu z toru realtime (narzedzie uruchom_zespol,
   * tylko gdy rozmawiamy z COO). Command uzywa ich do zapalenia wezlow specjalistow
   * na mapie (start->active, koniec->done) i wpisow w panelu czatu Centrum.
   */
  onZespolZdarzenie?: (z: ZdarzenieZespolu) => void
}

/**
 * KOMPAKTOWY pasek rozmowy glosowej z persona (dolny panel, nie pelny ekran).
 *
 * Ta sama logika co pelnoekranowa RozmowaGlosowa: start -> tor realtime
 * (OpenAI Realtime WebRTC, mozg = buildSystemPrompt), a przy 503/bledzie tor
 * podstawowy (voice.ts STT + sendMessage + glos persony ElevenLabs/Web Speech).
 * Rozmowa startuje SAMA po zamontowaniu (klik mikrofonu przy wezle to gest
 * startu, wiec zaden dodatkowy krok nie jest potrzebny). Sprzata mikrofon,
 * WebRTC i audio przy zamknieciu oraz przy odmontowaniu (przelaczenie persony).
 *
 * Pulsowanie/swiecenie odbywa sie NA MAPIE (wezel persony) przez onStan;
 * ten komponent jest tylko dyskretnym sterowaniem i transkryptem na zywo.
 */
export default function RozmowaWMiejscu({
  agent,
  onZamknij,
  onStan,
  onZespolZdarzenie,
}: Props) {
  const [stan, setStan] = useState<StanRozmowyUI>('gotowy')
  const [tor, setTor] = useState<TorGlosu>(null)
  const [transkryptUser, setTranskryptUser] = useState('')
  const [transkryptAgent, setTranskryptAgent] = useState('')
  const [odpowiedz, setOdpowiedz] = useState('')
  const [poziom, setPoziom] = useState(0)
  const [blad, setBlad] = useState<string | null>(null)
  const [baner, setBaner] = useState(false)
  const [zapisywanie, setZapisywanie] = useState(false)
  // Pytanie na koniec: "Zapisac briefing z tej rozmowy do mozgu?" (gdy byla
  // delegacja albo rozmowa byla dluzsza). Do czasu wyboru pasek zostaje otwarty.
  const [pytajBriefing, setPytajBriefing] = useState(false)
  const [zapisBriefingu, setZapisBriefingu] = useState(false)
  const { toast, pokazToast } = useToast()

  const uchwytRef = useRef<UchwytRozmowy | null>(null)
  const historiaRef = useRef<ChatMessage[]>([])
  // Pelny transkrypt rozmowy (oba tory): finalne wypowiedzi usera i persony ORAZ
  // raporty zespolu (typ 'raport' z onZespol, z oznaczeniem agenta) i wzmianki
  // o delegacji (typ 'delegacja'). Zrodlo dla zapisu rozmowy i briefingu narady.
  const transkryptRef = useRef<WpisTranskryptu[]>([])
  // Czy w rozmowie byla realna delegacja (padl choc jeden raport zespolu).
  // Decyduje razem z dlugoscia rozmowy o propozycji zapisu briefingu.
  const bylRaportRef = useRef(false)
  const aktywnyRef = useRef(true)
  // Ostatni zaraportowany poziom (throttling, zeby nie odswiezac mapy co klatke).
  const ostatniPoziomRef = useRef(0)
  // Zawsze aktualny callback zdarzen zespolu. startRozmowa odpala sie raz (mount),
  // wiec trzymamy referencje w ref, zeby nie zlapac przestarzalej wersji propsa.
  const onZespolRef = useRef(onZespolZdarzenie)
  onZespolRef.current = onZespolZdarzenie

  const imie = agent.personImie ?? agent.name

  // Raportujemy stan + poziom w gore (pulsowanie wezla na mapie).
  useEffect(() => {
    onStan?.(stan, poziom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stan, poziom])

  // --- Sprzatanie ------------------------------------------------------------

  function sprzataj() {
    aktywnyRef.current = false
    uchwytRef.current?.zakoncz()
    uchwytRef.current = null
    stopListening()
    zatrzymajMowe()
  }

  /**
   * Klik "Zakoncz" (albo Esc): sprzatamy glos, a potem decydujemy, czy
   * zaproponowac zapis briefingu. Proponujemy, gdy byla delegacja (choc jeden
   * raport zespolu) LUB rozmowa byla dluzsza niz 6 wpisow. W innym wypadku
   * zamykamy od razu. Gdy pasek briefingu juz wisi, drugi Esc zamyka calkiem.
   */
  function naKoniec() {
    if (pytajBriefing) {
      onZamknij()
      return
    }
    sprzataj()
    const proponuj =
      bylRaportRef.current || transkryptRef.current.length > 6
    if (proponuj) setPytajBriefing(true)
    else onZamknij()
  }
  // Zawsze aktualna referencja do naKoniec: handler Esc rejestruje sie raz, wiec
  // przez ref nie zlapie przestarzalego stanu pytajBriefing.
  const naKoniecRef = useRef(naKoniec)
  naKoniecRef.current = naKoniec

  // Start rozmowy od razu po zamontowaniu (klik mikrofonu = gest startu).
  useEffect(() => {
    aktywnyRef.current = true
    rozpocznij()
    return () => sprzataj()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc konczy rozmowe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') naKoniecRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Aktualizuje poziom dzwieku z progiem, zeby ograniczyc odswiezenia mapy. */
  function ustawPoziom(p: number) {
    if (!aktywnyRef.current) return
    if (Math.abs(p - ostatniPoziomRef.current) < 0.04 && p !== 0) return
    ostatniPoziomRef.current = p
    setPoziom(p)
  }

  // --- Start rozmowy: powitanie -> tor realtime lub podstawowy ---------------

  /** Instrukcja powitania dla modelu realtime: wita sie glosem persony. */
  function powitanieInstrukcja(): string {
    return (
      `Przywitaj sie krotko po polsku: "Czesc, jestem ${imie}, ` +
      `${agent.role.toLowerCase()}." i zapytaj krotko, w czym mozesz pomoc. ` +
      `Bez em-dash, bez zmyslonych liczb, nie dodawaj nic wiecej.`
    )
  }

  function rozpocznij() {
    setBlad(null)
    setBaner(false)
    setOdpowiedz('')
    setTranskryptAgent('')
    setTranskryptUser('')
    setStan('laczenie')
    // Najpierw OpenAI Realtime: powitanie idzie glosem persony (ten sam model).
    // Dopiero gdy OpenAI niedostepny -> powitanie ElevenLabs/Web + tor podstawowy.
    polaczRealtime()
  }

  async function polaczRealtime() {
    try {
      const uchwyt = await startRozmowa(agent, {
        powitanie: powitanieInstrukcja(),
        onStan: (s) => {
          if (aktywnyRef.current) setStan(s)
        },
        onTranskrypt: (tekst, kto, finalne) => {
          if (!aktywnyRef.current) return
          if (kto === 'user') {
            setTranskryptUser(tekst)
          } else {
            setTranskryptAgent(tekst)
            if (finalne) setOdpowiedz(tekst)
          }
          // Zbieramy tylko finalne, niepuste linie do zapisu rozmowy.
          if (finalne && tekst.trim()) {
            transkryptRef.current.push({ kto, tekst: tekst.trim() })
          }
        },
        onPoziom: (p) => ustawPoziom(p),
        onBlad: () => {
          if (aktywnyRef.current) setBlad('Cos przeszkodzilo w rozmowie.')
        },
        // Orkiestracja zespolu (tylko COO): oddajemy zdarzenia w gore do Command,
        // ktory zapala wezly na mapie i dopisuje raporty do panelu czatu.
        // Rownolegle dopisujemy raporty i delegacje do transkryptu rozmowy, zeby
        // briefing narady widzial, kto pracowal i co ustalil.
        onZespol: (z) => {
          if (!aktywnyRef.current) return
          if (z.typ === 'raport' && z.tresc && z.tresc.trim()) {
            bylRaportRef.current = true
            transkryptRef.current.push({
              kto: 'raport',
              agent: z.agent,
              tekst: z.tresc.trim(),
            })
          } else if (z.typ === 'start') {
            transkryptRef.current.push({ kto: 'delegacja', agent: z.agent })
          }
          onZespolRef.current?.(z)
        },
      })
      if (!aktywnyRef.current) {
        uchwyt.zakoncz()
        return
      }
      uchwytRef.current = uchwyt
      setTor('realtime')
    } catch (err) {
      // Brak klucza OpenAI (503) albo inny problem realtime -> tor podstawowy.
      const kod = err instanceof Error ? err.message : String(err)
      if (kod !== 'brak-klucza') {
        console.warn('Realtime niedostepny, tryb podstawowy:', kod)
      }
      if (!aktywnyRef.current) return
      setTor('podstawowy')
      setBaner(true)
      // OpenAI niedostepny: powitanie glosem persony (ElevenLabs, potem Web
      // Speech), po nim tor podstawowy.
      setStan('mowie')
      mowPowitanie(agent, {
        onEnd: () => {
          if (!aktywnyRef.current) return
          startPodstawowy()
        },
        onError: () => {
          if (!aktywnyRef.current) return
          startPodstawowy()
        },
      })
    }
  }

  // --- Tor podstawowy (voice.ts STT + sendMessage + glos persony) ------------

  function startPodstawowy() {
    if (!isSttSupported()) {
      setStan('czuwa')
      setBlad(
        'Rozmowa glosem dziala w Chrome i Edge. Odpowiedz i tak przeczytam na glos.',
      )
      return
    }
    nasluch()
  }

  function nasluch() {
    if (!aktywnyRef.current) return
    setBlad(null)
    setTranskryptUser('')
    setStan('slucham')
    startListening({
      lang: 'pl-PL',
      onPartial: (t) => setTranskryptUser(t),
      onFinal: (t) => onUserFinal(t),
      onLevel: (v) => ustawPoziom(v),
      onError: (kod) => onSttError(kod),
    })
  }

  async function onUserFinal(tekst: string) {
    stopListening()
    ustawPoziom(0)
    const t = tekst.trim()
    if (!t) {
      setStan('czuwa')
      return
    }
    setTranskryptUser(t)
    setStan('mysle')
    setTranskryptAgent('')
    historiaRef.current.push({ role: 'user', content: t })
    transkryptRef.current.push({ kto: 'user', tekst: t })
    try {
      const odp = await sendMessage(agent.slug, historiaRef.current)
      if (!aktywnyRef.current) return
      historiaRef.current.push({ role: 'assistant', content: odp })
      transkryptRef.current.push({ kto: 'agent', tekst: odp })
      setOdpowiedz(odp)
      setTranskryptAgent(odp)
      setStan('mowie')
      mowTekstem(agent, odp, {
        onEnd: () => {
          if (!aktywnyRef.current) return
          // Petla hands-free: po odpowiedzi znow sluchamy.
          nasluch()
        },
      })
    } catch {
      if (!aktywnyRef.current) return
      setBlad('Nie udalo sie teraz odpowiedziec. Sprobuj ponownie.')
      setStan('czuwa')
    }
  }

  function onSttError(kod: string) {
    if (kod === 'mic-level') return
    if (kod === 'no-speech' || kod === 'aborted') {
      setStan('czuwa')
      return
    }
    if (kod === 'not-allowed' || kod === 'service-not-allowed') {
      setBlad('Nie mam dostepu do mikrofonu. Wlacz go w ustawieniach przegladarki.')
    } else if (kod === 'not-supported') {
      setBlad('Rozmowa glosem dziala w Chrome i Edge.')
    } else {
      setBlad('Cos przeszkodzilo w nasluchu. Sprobuj ponownie.')
    }
    setStan('czuwa')
  }

  /** Klik w przycisk toru podstawowego: start/stop/barge-in. */
  function klikMow() {
    if (tor !== 'podstawowy') return // realtime ma auto-wykrywanie tury
    if (stan === 'slucham') {
      stopListening()
      ustawPoziom(0)
      setStan('czuwa')
    } else if (stan === 'mowie') {
      zatrzymajMowe()
      nasluch()
    } else if (stan === 'czuwa') {
      nasluch()
    }
  }

  // --- Zapis rozmowy do mozgu firmy -----------------------------------------

  /** Czytelne imie persony po slugu (do oznaczania raportow i delegacji). */
  function nazwaAgenta(slug: string): string {
    const a = getAgent(slug)
    return a?.personImie ?? a?.name ?? slug
  }

  /**
   * Sklada pelny transkrypt rozmowy do jednego tekstu: wypowiedzi wlasciciela i
   * persony, raporty zespolu (z imieniem agenta) oraz wzmianki o delegacji.
   */
  function budujTranskrypt(): string {
    return transkryptRef.current
      .map((l) => {
        if (l.kto === 'user') return `Wlasciciel: ${l.tekst}`
        if (l.kto === 'raport')
          return `[Raport zespolu] ${nazwaAgenta(l.agent)}:\n${l.tekst}`
        if (l.kto === 'delegacja')
          return `(${imie} deleguje zadanie: ${nazwaAgenta(l.agent)})`
        return `${imie}: ${l.tekst}`
      })
      .join('\n')
  }

  /**
   * Zapisuje biezaca rozmowe do bazy wiedzy (sf_mozg_wlasne, grupa 'z-rozmow').
   * Gdy jest polaczenie z modelem (klucz/proxy/env), Claude wyciaga zwiezly plik MD
   * (wazne dane/ustalenia/fakty o firmie). Bez klucza zapisujemy surowa transkrypcje.
   */
  async function zapiszDoMozgu() {
    if (zapisywanie) return
    if (transkryptRef.current.length === 0) {
      pokazToast('Brak rozmowy do zapisania.')
      return
    }
    setZapisywanie(true)
    const rozmowaTekst = budujTranskrypt()
    const dataDnia = new Date().toISOString().slice(0, 10)
    let tytul = `Rozmowa z ${imie} ${dataDnia}`
    let tresc = ''

    try {
      if (getMode() !== 'demo') {
        const system = [
          'Jestes redaktorem bazy wiedzy firmy SimpleFast.ai.',
          'Z podanej rozmowy glosowej wyciagnij wazne dane, ustalenia i fakty o firmie i zapisz je jako zwiezly plik markdown po polsku.',
          'Pierwsza linia to "# <krotki, rzeczowy tytul>", potem zwiezle punkty.',
          'Zasady: prosty polski, bez em-dash, tylko potwierdzone fakty i liczby. Jesli liczba jest niepewna, napisz [DO UZUPELNIENIA]. Nie zmyslaj. Bez wstepow i komentarzy.',
        ].join('\n')
        const md = await callModel(system, [
          { role: 'user', content: rozmowaTekst },
        ])
        tresc = md.trim()
        const m = tresc.match(/^#\s+(.+)$/m)
        if (m) tytul = m[1].trim()
      } else {
        tresc = `# ${tytul}\n\n\`\`\`\n${rozmowaTekst}\n\`\`\`\n`
      }
    } catch {
      // Blad modelu: zapisujemy surowa transkrypcje, zeby nic nie przepadlo.
      tresc = `# ${tytul}\n\n\`\`\`\n${rozmowaTekst}\n\`\`\`\n`
    }

    const slug = (zrobSlug(tytul) || 'rozmowa') + '-' + Date.now().toString(36)
    dodajPlikMozgu({ sciezka: `z-rozmow/${slug}.md`, tresc, grupa: 'z-rozmow' })
    if (aktywnyRef.current) setZapisywanie(false)
    pokazToast('Zapisano do bazy wiedzy')
  }

  /**
   * Zapisuje BRIEFING z narady do mozgu (sf_mozg_wlasne, grupa 'briefingi').
   * Claude sklada z transkryptu i raportow zespolu zwiezly briefing (temat,
   * ustalenia, decyzje, nastepne kroki, dane warte zapamietania). Bez klucza
   * zapisujemy surowy transkrypt, zeby nic nie przepadlo. Sciezka:
   * briefingi/<data>-<temat-slug>.md.
   */
  async function zapiszBriefing() {
    if (zapisBriefingu) return
    setZapisBriefingu(true)
    const rozmowaTekst = budujTranskrypt()
    const dataDnia = new Date().toISOString().slice(0, 10)
    let tytul = `Briefing z narady ${dataDnia}`
    let tresc = ''

    try {
      if (getMode() !== 'demo') {
        const system = [
          'Przygotuj BRIEFING z narady po polsku:',
          '1) Temat i uczestnicy (imiona person),',
          '2) Kluczowe ustalenia (punkty),',
          '3) Decyzje,',
          '4) Nastepne kroki (kto/co),',
          '5) Dane warte zapamietania.',
          'Zwiezle, w markdown, bez em-dash. Nie zmyslaj liczb ani ustalen. Pierwsza linia to "# <krotki tytul narady>".',
        ].join('\n')
        const md = await callModel(system, [
          { role: 'user', content: rozmowaTekst },
        ])
        tresc = md.trim()
        const m = tresc.match(/^#\s+(.+)$/m)
        if (m) tytul = m[1].trim()
      } else {
        tresc = `# ${tytul}\n\n\`\`\`\n${rozmowaTekst}\n\`\`\`\n`
      }
    } catch {
      // Blad modelu: zapisujemy surowy transkrypt narady.
      tresc = `# ${tytul}\n\n\`\`\`\n${rozmowaTekst}\n\`\`\`\n`
    }

    const slug = zrobSlug(tytul) || 'narada'
    dodajPlikMozgu({
      sciezka: `briefingi/${dataDnia}-${slug}.md`,
      tresc,
      grupa: 'briefingi',
    })
    setZapisBriefingu(false)
    pokazToast('Briefing zapisany do mozgu')
    // Chwila na pokazanie toastu, potem zamykamy pasek rozmowy.
    window.setTimeout(() => onZamknij(), 1200)
  }

  // --- Etykieta stanu --------------------------------------------------------

  function etykieta(): string {
    if (blad) return blad
    switch (stan) {
      case 'gotowy':
      case 'laczenie':
        return 'Lacze glos...'
      case 'mowie':
        return `${imie} mowi...`
      case 'slucham':
        return 'Slucham...'
      case 'mysle':
        return 'Mysle...'
      case 'czuwa':
        return tor === 'podstawowy' ? 'Twoja kolej, kliknij Mow' : 'Twoja kolej'
      case 'blad':
        return 'Cos poszlo nie tak.'
      default:
        return ''
    }
  }

  // Ostatnia linia transkryptu na zywo (jak w ChatGPT): agent gdy mowi, inaczej user.
  const transkryptNaZywo =
    stan === 'mowie' || stan === 'mysle'
      ? transkryptAgent || odpowiedz
      : transkryptUser

  const pokazMow = tor === 'podstawowy' && stan !== 'mysle'
  const etykietaMow =
    stan === 'slucham' ? 'Przerwij' : stan === 'mowie' ? 'Przerwij i mow' : 'Mow'

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:px-6 sm:pb-5"
      role="region"
      aria-label={`Rozmowa glosowa z ${imie}`}
    >
      <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/92 px-3 py-2.5 shadow-card backdrop-blur-md animate-fade-up sm:gap-4 sm:px-4">
        {pytajBriefing ? (
          <div className="flex w-full items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-50">
                Zapisac briefing z tej rozmowy do mozgu?
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Zbiore temat, ustalenia, decyzje i nastepne kroki z narady.
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={zapiszBriefing}
                disabled={zapisBriefingu}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-xs font-semibold text-zinc-950 outline-none transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={14} aria-hidden />
                {zapisBriefingu ? 'Zapisuje...' : 'Zapisz briefing'}
              </button>
              <button
                type="button"
                onClick={onZamknij}
                className="inline-flex h-9 items-center rounded-full border border-zinc-700 bg-zinc-900/80 px-3.5 text-xs font-medium text-zinc-300 outline-none transition-colors hover:bg-zinc-800 hover:text-white focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                Pomin
              </button>
            </div>
          </div>
        ) : (
        <>
        {/* Maly portret persony */}
        <div className="relative h-11 w-11 flex-shrink-0 sm:h-12 sm:w-12">
          <div
            className="relative h-full w-full overflow-hidden rounded-full"
            style={{
              boxShadow: `0 0 0 2px #0E0E11, 0 0 0 3px ${agent.accent}, 0 0 14px 1px ${agent.accent}55`,
              background: `linear-gradient(135deg, ${agent.accent}2e, ${agent.accent}12)`,
            }}
          >
            <CharacterAvatar agent={agent} px={48} shape="circle" />
            <PortretPng agent={agent} />
          </div>
        </div>

        {/* Imie + stan + transkrypt na zywo */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-zinc-50">
              Rozmawiasz z {imie}
            </span>
            <span
              className={[
                'flex-shrink-0 text-xs font-medium',
                blad ? 'text-amber-300' : 'text-brand-soft',
              ].join(' ')}
              aria-live="polite"
            >
              {etykieta()}
            </span>
          </div>
          <p
            className="mt-0.5 h-4 truncate text-xs text-zinc-400"
            aria-live="polite"
          >
            {transkryptNaZywo}
          </p>
          {baner && (
            <p className="mt-0.5 truncate text-[0.66rem] text-zinc-600">
              Tryb podstawowy glosu. Dodaj klucze OpenAI i ElevenLabs w Vercel
              dla trybu premium.
            </p>
          )}
        </div>

        {/* Sterowanie */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {pokazMow && (
            <button
              type="button"
              onClick={klikMow}
              aria-label={etykietaMow}
              title={etykietaMow}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/80 px-3 text-xs font-medium text-zinc-200 outline-none transition-colors hover:bg-zinc-800 hover:text-white focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {stan === 'slucham' ? (
                <Square size={13} aria-hidden />
              ) : (
                <Mic size={14} aria-hidden />
              )}
              <span className="hidden sm:inline">{etykietaMow}</span>
            </button>
          )}
          <button
            type="button"
            onClick={zapiszDoMozgu}
            disabled={zapisywanie}
            aria-label="Zapisz rozmowe do mozgu"
            title="Zapisz rozmowe do mozgu firmy"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/80 px-3 text-xs font-medium text-zinc-200 outline-none transition-colors hover:bg-zinc-800 hover:text-white focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={14} aria-hidden />
            <span className="hidden sm:inline">
              {zapisywanie ? 'Zapisuje...' : 'Zapisz do mozgu'}
            </span>
          </button>
          <button
            type="button"
            onClick={naKoniec}
            aria-label={`Zakoncz rozmowe z ${imie}`}
            title="Zakoncz rozmowe"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 outline-none transition-colors hover:bg-rose-500/20 hover:text-rose-100 focus-visible:ring-2 focus-visible:ring-rose-400/60"
          >
            <X size={14} aria-hidden />
            <span className="hidden sm:inline">Zakoncz</span>
          </button>
        </div>
        </>
        )}
      </div>
      <Toast text={toast} />
    </div>
  )
}

/** Slug tytulu do sciezki pliku (bez polskich znakow, spacji i interpunkcji). */
function zrobSlug(tytul: string): string {
  return tytul
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Nakladka PNG (premium) na maly portret w pasku; znika przy bledzie ladowania. */
function PortretPng({ agent }: { agent: Agent }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={`${import.meta.env.BASE_URL}avatars/${agent.slug}.png`}
      alt=""
      loading="lazy"
      draggable={false}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={[
        'absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
        loaded ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    />
  )
}

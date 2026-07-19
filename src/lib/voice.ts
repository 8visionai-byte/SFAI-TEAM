/**
 * Glos JARVIS V1 - warstwa glosowa dzialajaca w calosci w przegladarce.
 *
 * STT (mowa -> tekst): webkitSpeechRecognition / SpeechRecognition (Chrome, Edge).
 * TTS (tekst -> mowa): speechSynthesis z wyborem najlepszego polskiego glosu.
 *
 * Zero zewnetrznych kluczy, zero zaleznosci npm, zadnych sekretow. Wszystko
 * lokalnie u uzytkownika. Typy Web Speech API zadeklarowane lokalnie, bo nie ma
 * ich w standardowym lib.dom.
 */

// --- Lokalne typy Web Speech API (brak w lib.dom) ---------------------------

interface RozpoznanieAlternatywa {
  transcript: string
  confidence: number
}
interface RozpoznanieWynik {
  readonly length: number
  readonly isFinal: boolean
  item(index: number): RozpoznanieAlternatywa
  [index: number]: RozpoznanieAlternatywa
}
interface RozpoznanieWyniki {
  readonly length: number
  item(index: number): RozpoznanieWynik
  [index: number]: RozpoznanieWynik
}
interface RozpoznanieZdarzenie extends Event {
  readonly resultIndex: number
  readonly results: RozpoznanieWyniki
}
interface RozpoznanieBladZdarzenie extends Event {
  readonly error: string
  readonly message?: string
}
interface RozpoznanieMowy extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: ((ev: Event) => void) | null
  onresult: ((ev: RozpoznanieZdarzenie) => void) | null
  onerror: ((ev: RozpoznanieBladZdarzenie) => void) | null
  onend: ((ev: Event) => void) | null
}
type KonstruktorRozpoznania = new () => RozpoznanieMowy

declare global {
  interface Window {
    webkitSpeechRecognition?: KonstruktorRozpoznania
    SpeechRecognition?: KonstruktorRozpoznania
    webkitAudioContext?: typeof AudioContext
  }
}

// --- Wykrywanie wsparcia -----------------------------------------------------

/** Zwraca konstruktor rozpoznawania mowy albo null (Firefox, Safari bez flagi). */
function konstruktorRozpoznania(): KonstruktorRozpoznania | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/** Czy przegladarka wspiera rozpoznawanie mowy (STT). */
export function isSttSupported(): boolean {
  return konstruktorRozpoznania() !== null
}

/** Czy przegladarka wspiera synteze mowy (TTS). */
export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// --- STT: nasluch ------------------------------------------------------------

export interface OpcjeNasluchu {
  /** Jezyk rozpoznawania, domyslnie 'pl-PL'. */
  lang?: string
  /** Tekst czesciowy (na zywo, jeszcze niepewny). */
  onPartial?: (tekst: string) => void
  /** Tekst koncowy (zatwierdzony przez silnik). */
  onFinal?: (tekst: string) => void
  /** Blad nasluchu (kod Web Speech albo wewnetrzny). */
  onError?: (kod: string, wiadomosc?: string) => void
  /** Poziom glosu 0..1 (RMS z mikrofonu), gdy dostepny. */
  onLevel?: (poziom: number) => void
  /** Start nasluchu (zgoda mikrofonu przyznana). */
  onStart?: () => void
  /** Koniec nasluchu (silnik zakonczyl). */
  onEnd?: () => void
}

let aktywneRozpoznanie: RozpoznanieMowy | null = null
let audioCtx: AudioContext | null = null
let mediaStream: MediaStream | null = null
let rafId: number | null = null

/** Zatrzymuje pomiar poziomu glosu i zwalnia mikrofon. Idempotentne. */
function zatrzymajPoziom(): void {
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
}

/**
 * Uruchamia pomiar poziomu glosu przez getUserMedia + AnalyserNode (RMS).
 * Osobny tor od samego STT: odmowa tutaj nie blokuje rozpoznawania mowy.
 */
function uruchomPoziom(
  onLevel: (poziom: number) => void,
  onError?: (kod: string, wiadomosc?: string) => void,
): void {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return
  }
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      mediaStream = stream
      const AC = window.AudioContext ?? window.webkitAudioContext
      if (!AC) return
      audioCtx = new AC()
      const src = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)
        onLevel(Math.min(1, rms))
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
    })
    .catch((err) => {
      onError?.('mic-level', err instanceof Error ? err.message : String(err))
    })
}

/**
 * Zaczyna nasluch. Zwraca true, gdy start sie powiodl (silnik wspierany).
 * interimResults=true (transkrypcja na zywo), continuous=false (jedna wypowiedz).
 */
export function startListening(opts: OpcjeNasluchu = {}): boolean {
  const Ctor = konstruktorRozpoznania()
  if (!Ctor) {
    opts.onError?.(
      'not-supported',
      'Rozpoznawanie mowy nie jest wspierane w tej przegladarce.',
    )
    return false
  }

  // Przerwij ewentualny poprzedni nasluch, zanim wystartujemy nowy.
  stopListening()

  const rec = new Ctor()
  rec.lang = opts.lang ?? 'pl-PL'
  rec.interimResults = true
  rec.continuous = false
  rec.maxAlternatives = 1

  rec.onstart = () => opts.onStart?.()
  rec.onresult = (ev) => {
    let czesciowy = ''
    let koncowy = ''
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const wynik = ev.results[i]
      const tekst = wynik[0]?.transcript ?? ''
      if (wynik.isFinal) koncowy += tekst
      else czesciowy += tekst
    }
    if (czesciowy && opts.onPartial) opts.onPartial(czesciowy.trim())
    if (koncowy && opts.onFinal) opts.onFinal(koncowy.trim())
  }
  rec.onerror = (ev) => opts.onError?.(ev.error, ev.message)
  rec.onend = () => {
    zatrzymajPoziom()
    aktywneRozpoznanie = null
    opts.onEnd?.()
  }

  aktywneRozpoznanie = rec
  try {
    rec.start()
  } catch (err) {
    // start() rzuca, gdy rozpoznanie jest juz aktywne.
    aktywneRozpoznanie = null
    opts.onError?.('start-failed', err instanceof Error ? err.message : String(err))
    return false
  }

  if (opts.onLevel) uruchomPoziom(opts.onLevel, opts.onError)
  return true
}

/** Zatrzymuje biezacy nasluch (jesli trwa) i zwalnia mikrofon. */
export function stopListening(): void {
  zatrzymajPoziom()
  if (aktywneRozpoznanie) {
    try {
      aktywneRozpoznanie.stop()
    } catch {
      // Rozpoznanie moglo juz sie zakonczyc, ignorujemy.
    }
  }
}

// --- TTS: synteza mowy -------------------------------------------------------

let buforGlosow: SpeechSynthesisVoice[] = []

/** Odswieza bufor glosow z silnika (getVoices bywa puste do 'voiceschanged'). */
function odswiezGlosy(): void {
  if (!isTtsSupported()) return
  const glosy = window.speechSynthesis.getVoices()
  if (glosy.length > 0) buforGlosow = glosy
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  odswiezGlosy()
  // Wiele przegladarek zapelnia liste glosow dopiero po tym zdarzeniu.
  window.speechSynthesis.addEventListener('voiceschanged', odswiezGlosy)
}

/**
 * Wybiera najlepszy polski glos:
 *  1. filtr pl-PL / pl*,
 *  2. preferencja po nazwie: Google polski > Microsoft Paulina > Microsoft Zosia,
 *  3. w ostatecznosci pierwszy dostepny glos pl. Null, gdy brak polskiego glosu.
 */
export function najlepszyGlosPL(): SpeechSynthesisVoice | null {
  if (!isTtsSupported()) return null
  if (buforGlosow.length === 0) odswiezGlosy()
  const pl = buforGlosow.filter(
    (v) => v.lang === 'pl-PL' || v.lang.toLowerCase().startsWith('pl'),
  )
  if (pl.length === 0) return null
  const preferencje = ['google polski', 'microsoft paulina', 'microsoft zosia']
  for (const pref of preferencje) {
    const trafienie = pl.find((v) => v.name.toLowerCase().includes(pref))
    if (trafienie) return trafienie
  }
  return pl[0]
}

/** Czy jest dostepny jakikolwiek polski glos do czytania. */
export function czyDostepnyGlosPL(): boolean {
  return najlepszyGlosPL() !== null
}

/**
 * Czysci tekst przed czytaniem: usuwa markdown (naglowki, pogrubienia, listy,
 * cytaty, linie), zamienia linki na sam widoczny tekst, wycina URL-e i bloki
 * kodu, scala biale znaki. Dzieki temu TTS nie czyta gwiazdek i nawiasow.
 */
export function oczyscDoMowy(tekst: string): string {
  let t = tekst
  t = t.replace(/```[\s\S]*?```/g, ' ') // bloki kodu
  t = t.replace(/`([^`]+)`/g, '$1') // kod inline
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // obrazki
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // linki -> tekst
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '') // naglowki
  t = t.replace(/^\s{0,3}>\s?/gm, '') // cytaty
  t = t.replace(/^\s*[-*+]\s+/gm, '') // punkty listy
  t = t.replace(/^\s*\d+\.\s+/gm, '') // listy numerowane
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1') // pogrubienie
  t = t.replace(/\*([^*]+)\*/g, '$1') // kursywa *
  t = t.replace(/__([^_]+)__/g, '$1') // pogrubienie _
  t = t.replace(/_([^_]+)_/g, '$1') // kursywa _
  t = t.replace(/^\s*([-*_]\s*){3,}$/gm, ' ') // linie poziome
  t = t.replace(/https?:\/\/\S+/g, ' ') // URL-e luzem
  t = t.replace(/\s+/g, ' ').trim() // nadmiar bialych znakow
  return t
}

/**
 * Dzieli tekst na krotsze fragmenty po zdaniach. Kolejkowanie krotkich wypowiedzi
 * omija znany blad silnika (zatrzymanie po ~15 s) i daje plynne czytanie.
 */
function podzielNaFragmenty(tekst: string, maks = 200): string[] {
  const zdania = tekst.match(/[^.!?]+[.!?]*\s*/g) ?? [tekst]
  const fragmenty: string[] = []
  let biezacy = ''
  for (const z of zdania) {
    if ((biezacy + z).length > maks && biezacy) {
      fragmenty.push(biezacy.trim())
      biezacy = z
    } else {
      biezacy += z
    }
  }
  if (biezacy.trim()) fragmenty.push(biezacy.trim())
  return fragmenty
}

export interface OpcjeMowy {
  rate?: number
  pitch?: number
  volume?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: (kod: string) => void
}

/**
 * Czyta tekst polskim glosem. Najpierw przerywa biezaca wypowiedz, potem
 * kolejkuje fragmenty. onStart wola sie na pierwszym fragmencie, onEnd na ostatnim.
 */
export function speak(tekst: string, opts: OpcjeMowy = {}): void {
  if (!isTtsSupported()) {
    opts.onError?.('not-supported')
    return
  }
  const glos = najlepszyGlosPL()
  if (!glos) {
    opts.onError?.('no-pl-voice')
    return
  }
  const czysty = oczyscDoMowy(tekst)
  if (!czysty) {
    opts.onEnd?.()
    return
  }

  // Nowa wypowiedz zawsze zastepuje poprzednia (bez nakladania sie glosow).
  window.speechSynthesis.cancel()

  const fragmenty = podzielNaFragmenty(czysty)
  fragmenty.forEach((frag, idx) => {
    const u = new SpeechSynthesisUtterance(frag)
    u.voice = glos
    u.lang = 'pl-PL'
    u.rate = opts.rate ?? 1.0
    u.pitch = opts.pitch ?? 1.0
    u.volume = opts.volume ?? 1.0
    if (idx === 0) u.onstart = () => opts.onStart?.()
    if (idx === fragmenty.length - 1) u.onend = () => opts.onEnd?.()
    u.onerror = () => opts.onError?.('speak-error')
    window.speechSynthesis.speak(u)
  })
}

/** Przerywa czytanie i czysci kolejke wypowiedzi. */
export function cancel(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel()
}

/** Czy TTS aktualnie mowi (albo ma cos w kolejce). */
export function isSpeaking(): boolean {
  return (
    isTtsSupported() &&
    (window.speechSynthesis.speaking || window.speechSynthesis.pending)
  )
}

// --- Ustawienie: automatyczne czytanie odpowiedzi w Centrum -----------------

const KLUCZ_AUTO = 'sf_glos_auto'

/** Czy wlaczone auto-czytanie odpowiedzi w Centrum (localStorage sf_glos_auto). */
export function czytajAutoWlaczone(): boolean {
  try {
    return window.localStorage.getItem(KLUCZ_AUTO) === '1'
  } catch {
    return false
  }
}

/** Czy uzytkownik kiedykolwiek ustawil ta preferencje (do domyslki "wl. gdy uzyto glosu"). */
export function czyAutoUstawione(): boolean {
  try {
    return window.localStorage.getItem(KLUCZ_AUTO) != null
  } catch {
    return false
  }
}

/** Zapisuje preferencje auto-czytania w Centrum. */
export function ustawCzytajAuto(wlaczone: boolean): void {
  try {
    window.localStorage.setItem(KLUCZ_AUTO, wlaczone ? '1' : '0')
  } catch {
    // Tryb prywatny / brak miejsca: pomijamy, UI dziala dalej.
  }
}

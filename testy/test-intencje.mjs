/**
 * TEST DETERMINISTYCZNY (bez modelu, bez sieci): bramka delegacji.
 *
 * Co sprawdza:
 *  1) 25 realnych zdan wlasciciela z oczekiwana intencja
 *     (SLUCHAJ / PYTAJ_O_WIEDZE / DELEGUJ / ZAPYTAJ_O_ZGODE)
 *     przepuszczonych przez REALNA bramke prosbaOZespol z orchestrator.ts.
 *     Twarda regula: bramka moze trafic WYLACZNIE w zdania DELEGUJ o caly zespol.
 *     Zadne zdanie typu SLUCHAJ / PYTAJ_O_WIEDZE / ZAPYTAJ_O_ZGODE nie ma prawa trafic.
 *  2) wymusNarade: nie nadpisuje decyzji modelu "sam", dopelnia tylko realna narade.
 *  3) Zabezpieczenia zrodla (statyczne): brak starego SYGNALY_NARADY,
 *     brak slow "wszyscy"/"wszystkich" w bramce, jedno zrodlo prawdy
 *     (realtime.ts importuje prosbaOZespol z orchestrator.ts).
 *
 * Regexy i lista agentow sa CZYTANE Z ZRODEL (nie kopiowane), wiec kazda
 * regresja w orchestrator.ts wywroci ten test.
 *
 * Uruchomienie:  node webapp/testy/test-intencje.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const TU = dirname(fileURLToPath(import.meta.url))
/** Katalog webapp/src: obok testu albo wzgledem katalogu, z ktorego odpalasz node. */
const SRC = [
  resolve(TU, '../src'),
  resolve(process.cwd(), 'webapp/src'),
  resolve(process.cwd(), 'src'),
].find((p) => existsSync(resolve(p, 'lib/orchestrator.ts')))
if (!SRC) throw new Error('Nie znalazlem webapp/src (odpal z katalogu projektu)')

const PLIK_ORK = resolve(SRC, 'lib/orchestrator.ts')
const PLIK_RT = resolve(SRC, 'lib/realtime.ts')
const PLIK_AGENCI = resolve(SRC, 'data/agents.ts')

const zrodloOrk = readFileSync(PLIK_ORK, 'utf8')
const zrodloRt = readFileSync(PLIK_RT, 'utf8')
const zrodloAgenci = readFileSync(PLIK_AGENCI, 'utf8')

// --- 1. Wyciagniecie REALNYCH regexow bramki z orchestrator.ts ---------------

function wyciagnijRegex(zrodlo, nazwa) {
  const re = new RegExp(
    `const\\s+${nazwa}\\s*=\\s*(?:\\r?\\n\\s*)?\\/([\\s\\S]*?)\\/([gimsuy]*)\\s*(?:\\r?\\n)`,
  )
  const m = zrodlo.match(re)
  if (!m) throw new Error(`Nie znalazlem regexu ${nazwa} w orchestrator.ts`)
  return new RegExp(m[1], m[2])
}

const CZASOWNIK_PROSBY = wyciagnijRegex(zrodloOrk, 'CZASOWNIK_PROSBY')
const RZECZOWNIK_ZESPOLU = wyciagnijRegex(zrodloOrk, 'RZECZOWNIK_ZESPOLU')

/** Wycina czysta funkcje ze zrodla TS (bez adnotacji typow) i zwraca ja wykonywalna. */
function wyciagnijFunkcje(zrodlo, nazwa) {
  const start = zrodlo.indexOf(`function ${nazwa}(`)
  if (start < 0) throw new Error(`Brak funkcji ${nazwa} w orchestrator.ts`)
  let glebokosc = 0
  let koniec = -1
  for (let i = zrodlo.indexOf('{', start); i < zrodlo.length; i++) {
    if (zrodlo[i] === '{') glebokosc++
    else if (zrodlo[i] === '}') {
      glebokosc--
      if (glebokosc === 0) {
        koniec = i
        break
      }
    }
  }
  if (koniec < 0) throw new Error(`Nie domknalem funkcji ${nazwa}`)
  const kod = zrodlo.slice(start, koniec + 1).replace(/: string/g, '')
  return new Function(`${kod}; return ${nazwa}`)()
}

const bezNegacji = wyciagnijFunkcje(zrodloOrk, 'bezNegacji')

/** Mirror prosbaOZespol z orchestrator.ts (na kodzie wczytanym ze zrodla). */
function prosbaOZespol(tekst) {
  if (!tekst) return false
  const t = bezNegacji(tekst)
  return CZASOWNIK_PROSBY.test(t) && RZECZOWNIK_ZESPOLU.test(t)
}

// Slugi specjalistow (bez COO) czytane z agents.ts.
const SLUGI = [...zrodloAgenci.matchAll(/^\s*slug:\s*'([a-z-]+)'/gm)]
  .map((m) => m[1])
  .filter((s) => s !== 'coo')

/** Mirror wymusNarade z orchestrator.ts (guard + bramka + dopelnienie). */
function wymusNarade(pytanie, wynik) {
  if (wynik.tryb !== 'deleguj') return wynik
  if (!prosbaOZespol(pytanie)) return wynik
  const obecni = new Set(wynik.plan.map((k) => k.agent))
  const plan = [...wynik.plan]
  for (const slug of SLUGI) {
    if (!obecni.has(slug)) plan.push({ agent: slug, zadanie: 'perspektywa roli' })
  }
  return { ...wynik, tryb: 'deleguj', plan }
}

// --- 2. Zestaw testowy: 25 realnych zdan wlasciciela ------------------------
// intencja: SLUCHAJ | PYTAJ_O_WIEDZE | DELEGUJ | ZAPYTAJ_O_ZGODE
// bramka:   czy prosbaOZespol MA trafic (true tylko przy jawnej prosbie o CALY zespol)

const ZDANIA = [
  // --- SLUCHAJ (wlasciciel opowiada, informuje, mysli na glos) ---
  { t: 'Mam takiego klienta, ktory chce automatyzacje zwrotow.', intencja: 'SLUCHAJ', bramka: false },
  { t: 'Wiesz co, wczoraj gadalem z Marcinem o cenach.', intencja: 'SLUCHAJ', bramka: false },
  { t: 'Myslalem o tym, zeby zrobic rolki na instagrama.', intencja: 'SLUCHAJ', bramka: false },
  { t: 'Bylem dzis na spotkaniu w Krakowie, poszlo slabo.', intencja: 'SLUCHAJ', bramka: false },
  { t: 'U tego klienta cala firma siedzi na Excelu.', intencja: 'SLUCHAJ', bramka: false },
  { t: 'Mam klienta, ktory chce wszystkich swoich handlowcow przeszkolic z AI.', intencja: 'SLUCHAJ', bramka: false },
  { t: 'Wczoraj mielismy narade u klienta i wyszlo, ze nie maja procesu.', intencja: 'SLUCHAJ', bramka: false },
  { t: 'Musze sie naradzic z Marcinem, zanim cokolwiek obiecam.', intencja: 'SLUCHAJ', bramka: false },
  { t: 'Wszyscy mi ostatnio mowia, ze powinienem podniesc ceny.', intencja: 'SLUCHAJ', bramka: false },

  // --- PYTAJ_O_WIEDZE (pyta o fakt z pamieci firmy / bazy) ---
  { t: 'Ile kosztuje Opieka AI?', intencja: 'PYTAJ_O_WIEDZE', bramka: false },
  { t: 'Co wiesz o Klaudiuszu?', intencja: 'PYTAJ_O_WIEDZE', bramka: false },
  { t: 'Czy my w ogole mamy przyklad wdrozenia dla firm produkcyjnych?', intencja: 'PYTAJ_O_WIEDZE', bramka: false },
  { t: 'Czy wszyscy klienci placa nam ryczaltem?', intencja: 'PYTAJ_O_WIEDZE', bramka: false },
  { t: 'Co ustalilismy ostatnio z Marcinem w sprawie cennika?', intencja: 'PYTAJ_O_WIEDZE', bramka: false },

  // --- DELEGUJ (jawna prosba o prace zespolu albo konkretnej osoby) ---
  { t: 'Zrob narade z zespolem.', intencja: 'DELEGUJ', bramka: true },
  { t: 'Zbierz caly zespol i powiedzcie mi, co robic z ta oferta.', intencja: 'DELEGUJ', bramka: true },
  { t: 'Zrobcie burze mozgow na temat nowej uslugi.', intencja: 'DELEGUJ', bramka: true },
  { t: 'Potrzebuje opinii calego zespolu w tej sprawie.', intencja: 'DELEGUJ', bramka: true },
  { t: 'Uruchom zespol do tematu tego klienta.', intencja: 'DELEGUJ', bramka: true },
  { t: 'Rozdaj dziewczynom zadania, niech kazda powie, co o tym mysli.', intencja: 'DELEGUJ', bramka: true },
  // Prosba o JEDNA osobe: to tez delegacja, ale bramka calego zespolu MA milczec.
  { t: 'Zapytaj Rae o rynek voicebotow.', intencja: 'DELEGUJ', bramka: false },
  { t: 'Niech Jade przygotuje oferte dla tego klienta.', intencja: 'DELEGUJ', bramka: false },

  // --- ZAPYTAJ_O_ZGODE (niejasne, trzeba dopytac) ---
  { t: 'Trzeba by to jakos ogarnac.', intencja: 'ZAPYTAJ_O_ZGODE', bramka: false },
  { t: 'Fajnie byloby miec na to jakies liczby.', intencja: 'ZAPYTAJ_O_ZGODE', bramka: false },
  { t: 'To by trzeba policzyc na spokojnie.', intencja: 'ZAPYTAJ_O_ZGODE', bramka: false },
]

// --- 3. Uruchomienie testow -------------------------------------------------

let pass = 0
let fail = 0
const bledy = []

function sprawdz(nazwa, warunek, detale = '') {
  if (warunek) {
    pass++
  } else {
    fail++
    bledy.push(`${nazwa}${detale ? ' :: ' + detale : ''}`)
  }
}

console.log('=== TEST 1: bramka intencji na 25 zdaniach wlasciciela ===\n')
console.log(`Bramka czytana z: ${PLIK_ORK}`)
console.log(`Specjalisci (bez COO): ${SLUGI.length}\n`)

sprawdz('Zestaw ma dokladnie 25 zdan', ZDANIA.length === 25, `jest ${ZDANIA.length}`)

for (const z of ZDANIA) {
  const wynik = prosbaOZespol(z.t)
  const ok = wynik === z.bramka
  sprawdz(
    `[${z.intencja}] "${z.t}"`,
    ok,
    `bramka=${wynik}, oczekiwano=${z.bramka}`,
  )
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${z.intencja.padEnd(16)} bramka=${String(wynik).padEnd(5)} ${z.t}`,
  )
}

// Twarda regula z zadania: trafienie bramki TYLKO w DELEGUJ.
const falszyweAlarmy = ZDANIA.filter(
  (z) => z.intencja !== 'DELEGUJ' && prosbaOZespol(z.t),
)
sprawdz(
  'Zero trafien bramki poza DELEGUJ',
  falszyweAlarmy.length === 0,
  falszyweAlarmy.map((z) => z.t).join(' | '),
)

// --- 3b. Przypadki brzegowe bramki (poza zestawem 25 zdan) ------------------
// Czas przeszly, negacja i osoba trzecia: te formy wygladaja jak polecenie,
// ale nim nie sa. Druga strona: pytanie w 2. osobie ("zrobisz mi narade?")
// oraz tryb rozkazujacy w liczbie mnogiej TO sa realne prosby.

console.log('\n=== TEST 1b: przypadki brzegowe bramki ===\n')

const BRZEGOWE = [
  { t: 'Wczoraj zrobilem narade z zespolem i nic z tego nie wyszlo.', bramka: false },
  { t: 'Uruchomilem juz zespol do tego tematu w zeszlym tygodniu.', bramka: false },
  { t: 'Odpalilem zespol wczoraj wieczorem.', bramka: false },
  { t: 'Zaangazowalem caly zespol w ten projekt u klienta.', bramka: false },
  { t: 'Nie chce, zeby cala firma o tym wiedziala.', bramka: false },
  { t: 'Ten klient potrzebuje calego zespolu ludzi do obslugi.', bramka: false },
  { t: 'Zbieralem zespol w zeszlym tygodniu, nie przyszli.', bramka: false },
  { t: 'Zrobmy narade jutro rano.', bramka: true },
  { t: 'Zrobisz mi narade z dziewczynami?', bramka: true },
  { t: 'Zwolaj narade na poniedzialek.', bramka: true },
  { t: 'Zaangazuj caly zespol w ten temat.', bramka: true },
  { t: 'Wlacz w to caly zespol.', bramka: true },
  { t: 'Zbierzcie sie caly zespol i dajcie mi trzy pomysly.', bramka: true },
  { t: 'Odpal zespol do tego tematu.', bramka: true },
  { t: 'Nie chce tego robic sam, zbierz zespol.', bramka: true },
]

for (const z of BRZEGOWE) {
  const wynik = prosbaOZespol(z.t)
  const ok = wynik === z.bramka
  sprawdz(`[brzegowe] "${z.t}"`, ok, `bramka=${wynik}, oczekiwano=${z.bramka}`)
  console.log(`${ok ? 'PASS' : 'FAIL'}  bramka=${String(wynik).padEnd(5)} ${z.t}`)
}

// --- 4. wymusNarade: zachowanie ---------------------------------------------

console.log('\n=== TEST 2: wymusNarade (orchestrator) ===\n')

const planDwoch = [
  { agent: 'analityk', zadanie: 'rynek' },
  { agent: 'handlowiec', zadanie: 'oferta' },
]

// a) model wybral "sam" + jawna prosba o narade -> NIE nadpisujemy decyzji modelu
const a = wymusNarade('Zrob narade z zespolem.', {
  tryb: 'sam',
  plan: [],
  odpowiedz: 'ok',
})
sprawdz('wymusNarade nie nadpisuje trybu "sam"', a.tryb === 'sam' && a.plan.length === 0, `tryb=${a.tryb}, plan=${a.plan.length}`)
console.log(`${a.tryb === 'sam' ? 'PASS' : 'FAIL'}  tryb "sam" + "Zrob narade z zespolem." -> tryb=${a.tryb}, agentow=${a.plan.length}`)

// b) model deleguje do 2 osob + jawna prosba o caly zespol -> dopelnienie do 9
const b = wymusNarade('Zbierz caly zespol i powiedzcie mi, co robic z ta oferta.', {
  tryb: 'deleguj',
  plan: [...planDwoch],
  odpowiedz: '',
})
sprawdz('wymusNarade dopelnia realna narade do calego zespolu', b.plan.length === SLUGI.length, `agentow=${b.plan.length}, oczekiwano=${SLUGI.length}`)
console.log(`${b.plan.length === SLUGI.length ? 'PASS' : 'FAIL'}  tryb "deleguj" + prosba o caly zespol -> agentow=${b.plan.length}`)

// c) model deleguje do 2 osob + zwykla opowiesc -> bez dopelnienia
const c = wymusNarade('Mam klienta, ktory chce wszystkich swoich handlowcow przeszkolic z AI.', {
  tryb: 'deleguj',
  plan: [...planDwoch],
  odpowiedz: '',
})
sprawdz('wymusNarade nie rozdmuchuje opowiesci', c.plan.length === 2, `agentow=${c.plan.length}`)
console.log(`${c.plan.length === 2 ? 'PASS' : 'FAIL'}  tryb "deleguj" + opowiesc o kliencie -> agentow=${c.plan.length}`)

// d) prosba o JEDNA osobe -> bez dopelnienia do calego zespolu
const d = wymusNarade('Zapytaj Rae o rynek voicebotow.', {
  tryb: 'deleguj',
  plan: [{ agent: 'analityk', zadanie: 'rynek' }],
  odpowiedz: '',
})
sprawdz('wymusNarade nie dopelnia przy prosbie o jedna osobe', d.plan.length === 1, `agentow=${d.plan.length}`)
console.log(`${d.plan.length === 1 ? 'PASS' : 'FAIL'}  tryb "deleguj" + "Zapytaj Rae" -> agentow=${d.plan.length}`)

// --- 5. Zabezpieczenia zrodla (statyczne) -----------------------------------

console.log('\n=== TEST 3: zabezpieczenia zrodla ===\n')

const kontrole = [
  {
    nazwa: 'orchestrator: guard "tryb !== deleguj" na poczatku wymusNarade',
    ok: /function wymusNarade[\s\S]{0,200}?if \(wynik\.tryb !== 'deleguj'\) return wynik/.test(zrodloOrk),
  },
  {
    nazwa: 'orchestrator: stary SYGNALY_NARADY usuniety (brak deklaracji)',
    ok: !/const\s+SYGNALY_NARADY/.test(zrodloOrk),
  },
  {
    nazwa: 'realtime: stary SYGNALY_NARADY usuniety (brak deklaracji)',
    ok: !/const\s+SYGNALY_NARADY/.test(zrodloRt),
  },
  {
    nazwa: 'bramka nie reaguje na samo "wszyscy" / "wszystkich"',
    ok:
      !prosbaOZespol('wszyscy') &&
      !prosbaOZespol('wszystkich') &&
      !CZASOWNIK_PROSBY.test('wszyscy') &&
      !RZECZOWNIK_ZESPOLU.test('wszystkich'),
  },
  {
    nazwa: 'jedno zrodlo prawdy: realtime importuje prosbaOZespol z orchestrator',
    ok: /import \{ prosbaOZespol \} from '\.\/orchestrator'/.test(zrodloRt),
  },
  {
    nazwa: 'realtime uzywa prosbaOZespol przy dopelnianiu narady',
    ok: /if \(prosbaOZespol\(ostatniaWypowiedzUsera\)\)/.test(zrodloRt),
  },
]

for (const k of kontrole) {
  sprawdz(k.nazwa, k.ok)
  console.log(`${k.ok ? 'PASS' : 'FAIL'}  ${k.nazwa}`)
}

// --- 6. Podsumowanie ---------------------------------------------------------

console.log(`\n=== WYNIK: ${pass} PASS / ${fail} FAIL ===`)
if (fail > 0) {
  console.log('\nBledy:')
  for (const b of bledy) console.log(` - ${b}`)
  process.exit(1)
}

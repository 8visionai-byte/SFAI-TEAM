/**
 * TEST PROMPTU (statyczny, bez modelu i bez sieci).
 *
 * Co sprawdza:
 *  1) HIERARCHIA INTENCJI istnieje i jest kompletna w OBU wariantach:
 *     dla COO (Lea, ma uruchom_zespol) i dla zwyklej persony (nie uruchamia nikogo).
 *     Funkcja hierarchiaIntencji jest WYCINANA Z ai.ts i realnie wykonywana,
 *     wiec test czyta to, co naprawde poleci do modelu.
 *  2) Zakaz kalek z angielskiego (ZAKAZANE ZWROTY w TON_PERSONY) trafia do promptu
 *     glosowego i tekstowego kazdej persony (przez regulyZTonem).
 *  3) Przyklady zdanie -> reakcja sa w hierarchii (oba warianty).
 *  4) Opisy narzedzi (realtime.ts) NIE zawieraja "UZYJ ZAWSZE" ani "preferuj ... nad",
 *     a uruchom_zespol ma bramke "UZYJ TYLKO" + "NIE UZYWAJ".
 *  5) buildVoicePrompt zaczyna sie od hierarchii i nie gubi pamieci firmy,
 *     twardych faktow, Karty Mozgu ani zasad rozmowy.
 *  6) Brak myslnika em-dash w promptach.
 *
 * Uruchomienie:  node webapp/testy/test-prompty.mjs
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
].find((p) => existsSync(resolve(p, 'lib/ai.ts')))
if (!SRC) throw new Error('Nie znalazlem webapp/src (odpal z katalogu projektu)')

const PLIK_AI = resolve(SRC, 'lib/ai.ts')
const PLIK_RT = resolve(SRC, 'lib/realtime.ts')
const PLIK_ORK = resolve(SRC, 'lib/orchestrator.ts')

const zrodloAi = readFileSync(PLIK_AI, 'utf8')
const zrodloRt = readFileSync(PLIK_RT, 'utf8')
const zrodloOrk = readFileSync(PLIK_ORK, 'utf8')

let pass = 0
let fail = 0
const bledy = []

function sprawdz(nazwa, warunek, detale = '') {
  if (warunek) {
    pass++
    console.log(`PASS  ${nazwa}`)
  } else {
    fail++
    bledy.push(`${nazwa}${detale ? ' :: ' + detale : ''}`)
    console.log(`FAIL  ${nazwa}${detale ? ' :: ' + detale : ''}`)
  }
}

// --- Narzedzia do wycinania kodu ze zrodla ----------------------------------

/** Znajduje domykajacy nawias, pomijajac zawartosc stringow ' " ` . */
function domknij(zrodlo, odIndex, otw, zam) {
  let glebokosc = 0
  let cudzyslow = null
  let escape = false
  for (let i = odIndex; i < zrodlo.length; i++) {
    const ch = zrodlo[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (cudzyslow) {
      if (ch === cudzyslow) cudzyslow = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      cudzyslow = ch
      continue
    }
    if (ch === otw) glebokosc++
    else if (ch === zam) {
      glebokosc--
      if (glebokosc === 0) return i
    }
  }
  return -1
}

/** Wycina funkcje hierarchiaIntencji z ai.ts i zwraca ja jako wykonywalna funkcje JS. */
function wczytajHierarchie() {
  const start = zrodloAi.indexOf('function hierarchiaIntencji(')
  if (start < 0) throw new Error('Brak funkcji hierarchiaIntencji w ai.ts')
  const otwarcie = zrodloAi.indexOf('{', start)
  const koniec = domknij(zrodloAi, otwarcie, '{', '}')
  if (koniec < 0) throw new Error('Nie domknalem funkcji hierarchiaIntencji')
  const kodTs = zrodloAi.slice(start, koniec + 1)
  // Zdejmujemy adnotacje typow TypeScript (funkcja jest czysta, bez zaleznosci).
  const kodJs = kodTs
    .replace('function hierarchiaIntencji(jestCoo: boolean): string {', 'function hierarchiaIntencji(jestCoo) {')
    .replace(': boolean', '')
    .replace('): string {', ') {')
  return new Function(`${kodJs}; return hierarchiaIntencji`)()
}

/**
 * Wycina tablice stalej (np. TON_PERSONY) i zwraca zlaczony string.
 * `zmienne` podstawia stale, do ktorych tablica sie odwoluje (CHAT_RULES uzywa TON_PERSONY).
 */
function wczytajStalaTablice(nazwa, zmienne = {}) {
  const start = zrodloAi.indexOf(`const ${nazwa} = [`)
  if (start < 0) throw new Error(`Brak stalej ${nazwa} w ai.ts`)
  const otwarcie = zrodloAi.indexOf('[', start)
  const koniec = domknij(zrodloAi, otwarcie, '[', ']')
  if (koniec < 0) throw new Error(`Nie domknalem tablicy ${nazwa}`)
  const nazwy = Object.keys(zmienne)
  const tablica = new Function(
    ...nazwy,
    `return ${zrodloAi.slice(otwarcie, koniec + 1)}`,
  )(...nazwy.map((n) => zmienne[n]))
  return tablica.join('\n')
}

/** Usuwa komentarze blokowe i linie komentarzy (zeby nie mylily wyszukiwania fraz). */
function bezKomentarzy(zrodlo) {
  return zrodlo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n')
}

// --- 1. HIERARCHIA INTENCJI (oba warianty, realnie wykonana) ----------------

console.log('=== TEST 1: hierarchia intencji (COO i zwykla persona) ===\n')

const hierarchiaIntencji = wczytajHierarchie()
const hCoo = hierarchiaIntencji(true)
const hZwykla = hierarchiaIntencji(false)

const WYMAGANE_W_OBU = [
  'HIERARCHIA INTENCJI',
  '1. OPOWIADA',
  '2. PYTA O WIEDZE',
  '3. PROSI',
  '4. NIEJASNE',
  '5. TRUDNA SPRAWA',
  'ROZSTRZYGNIECIE WATPLIWOSCI',
  'GRAMATYKA DECYDUJE',
  'RZECZOWNIK TO TEMAT, NIE POLECENIE',
  'PRZYKLADY',
  'Mam takiego klienta',
]

for (const [nazwaWariantu, tekst] of [
  ['COO', hCoo],
  ['zwykla persona', hZwykla],
]) {
  for (const fraza of WYMAGANE_W_OBU) {
    sprawdz(`[${nazwaWariantu}] hierarchia zawiera "${fraza}"`, tekst.includes(fraza))
  }
  // Przyklady zdanie -> reakcja (min. 4 linie z "->" w bloku PRZYKLADY).
  const blok = tekst.slice(tekst.indexOf('PRZYKLADY'))
  const przyklady = blok.split('\n').filter((l) => l.startsWith('- ') && l.includes('->'))
  sprawdz(
    `[${nazwaWariantu}] hierarchia ma min. 4 przyklady zdanie -> reakcja`,
    przyklady.length >= 4,
    `jest ${przyklady.length}`,
  )
  sprawdz(`[${nazwaWariantu}] hierarchia bez em-dash`, !tekst.includes('—'))
}

// Roznice miedzy wariantami: tylko COO realnie uruchamia zespol.
sprawdz('COO: hierarchia wskazuje uruchom_zespol', hCoo.includes('uruchom_zespol'))
sprawdz('COO: domyslnie pyta o zgode przed uruchomieniem', hCoo.includes('POCZEKAJ na odpowiedz') && hCoo.includes('Milczaca zgoda nie istnieje'))
sprawdz('Zwykla persona: nie uruchamia nikogo sama', hZwykla.includes('nikogo nie uruchamiasz'))
sprawdz('Zwykla persona: bez narzedzia uruchom_zespol', !hZwykla.includes('uruchom_zespol'))
sprawdz('Domyslny przypadek to SLUCHAJ (punkt 1)', hCoo.indexOf('1. OPOWIADA') < hCoo.indexOf('3. PROSI'))

// --- 2. Zakaz kalek (TON_PERSONY) -------------------------------------------

console.log('\n=== TEST 2: zakaz kalek z angielskiego ===\n')

const ton = wczytajStalaTablice('TON_PERSONY')
const ZAKAZANE_W_PROMPCIE = [
  'dobrze Cie slyszec',
  'w czym dzis pomoc',
  'jak moge Ci dzis pomoc',
  'milego dnia',
  'swietne pytanie',
]

sprawdz('TON_PERSONY ma sekcje ZAKAZANE ZWROTY', ton.includes('ZAKAZANE ZWROTY'))
for (const fraza of ZAKAZANE_W_PROMPCIE) {
  sprawdz(`TON_PERSONY wymienia zakazana kalke "${fraza}"`, ton.includes(fraza))
}
sprawdz('TON_PERSONY zakazuje powtarzania wzorcow', ton.includes('ZERO POWTARZANIA WZORCOW'))
sprawdz('TON_PERSONY wymusza formy zenskie', ton.includes('formach zenskich'))
sprawdz('TON_PERSONY bez em-dash', !ton.includes('—'))

// --- 3. buildVoicePrompt: kolejnosc i kompletnosc blokow --------------------

console.log('\n=== TEST 3: buildVoicePrompt (glos) ===\n')

const startVoice = zrodloAi.indexOf('export function buildVoicePrompt')
const koniecVoice = zrodloAi.indexOf('function mockResponse', startVoice)
sprawdz('buildVoicePrompt znaleziony w ai.ts', startVoice > 0 && koniecVoice > startVoice)
const blokVoice = zrodloAi.slice(startVoice, koniecVoice)

// Prompt sklada funkcja zloz(persona, karta): sprawdzamy, ze PIERWSZYM elementem
// skladanej tablicy jest hierarchia intencji (najsilniejsza pozycja w promptcie).
sprawdz(
  'buildVoicePrompt: hierarchia intencji jest PIERWSZYM blokiem promptu',
  /\[\s*\n\s*hierarchiaIntencji\(agent\?\.slug === 'coo'\),\s*\n\s*'',\s*\n\s*'=== KIM JESTES ==='/.test(
    blokVoice,
  ),
)
sprawdz('buildVoicePrompt: hierarchia liczona dla COO i dla zwyklej persony', blokVoice.includes("hierarchiaIntencji(agent?.slug === 'coo')"))
sprawdz('buildVoicePrompt: zasady rozmowy z tonem (regulyZTonem)', blokVoice.includes('regulyZTonem()'))
sprawdz('buildVoicePrompt: pamiec firmy nie zgubiona', blokVoice.includes('pamiecFirmyBlok()'))
sprawdz('buildVoicePrompt: twarde fakty nie zgubione', blokVoice.includes('faktyBlok(agentSlug)'))
sprawdz('buildVoicePrompt: Karta Mozgu nie zgubiona', blokVoice.includes('getBrainCard()'))
sprawdz('buildVoicePrompt: lista kolezanek nie zgubiona', blokVoice.includes('listaKolezanek(agentSlug)'))

// Przepelnienie budzetu: Karta Mozgu, nadpis persony i wlasne umiejetnosci sa
// edytowalne przez wlasciciela i nie maja limitu dlugosci. Gdy prompt urosnie
// ponad 40000 znakow, tniemy PERSONE i Karte Mozgu, nigdy koncowke promptu
// (tam stoja zasady rozmowy z TON_PERSONY i nota o rozmowie glosowej).
sprawdz(
  'budzet: przy przepelnieniu tniemy persone (nie koncowke promptu)',
  /out\.length > LIMIT && personaCieta\.length > 0/.test(blokVoice),
)
sprawdz(
  'budzet: drugi w kolejce do ciecia jest blok Karty Mozgu',
  /out\.length > LIMIT && card\.length > 0/.test(blokVoice),
)
sprawdz(
  'budzet: twardy slice(0, LIMIT) zostaje jako ostatnie zabezpieczenie',
  blokVoice.includes('out.length > LIMIT ? out.slice(0, LIMIT) : out'),
)
// Sufit 44000 to WYNIK POMIARU na zywym API (2026-07-26), nie oszacowanie:
// realne prompty person z polskimi znakami przechodza do okolo 48000 znakow
// (2,93 znaku na token przy limicie 16384 tokenow OpenAI). Gdy ktos chce go
// ruszyc, ma najpierw przemierzyc: testy/pomiar-limitu-instrukcji.mjs.
sprawdz('budzet: sufit promptu glosowego to 44000 znakow', /const LIMIT = 44000/.test(blokVoice))

const startChat = zrodloAi.indexOf('export function buildSystemPrompt')
const blokChat = zrodloAi.slice(startChat, zrodloAi.indexOf('function maWebSearch', startChat))
sprawdz('buildSystemPrompt (czat): zasady rozmowy z tonem', blokChat.includes('regulyZTonem()'))
sprawdz('buildSystemPrompt (czat): pamiec firmy i fakty', blokChat.includes('pamiecFirmyBlok()') && blokChat.includes('faktyBlok(agentSlug)'))

// CHAT_RULES: rozdzielenie "prosi o plan" od "tylko opowiada".
const chatRules = wczytajStalaTablice('CHAT_RULES', { TON_PERSONY: ton })
sprawdz('CHAT_RULES: plan tylko na prosbe o rade albo plan', chatRules.includes('Gdy pyta o radę, o plan'))
sprawdz('CHAT_RULES: gdy tylko opowiada, bez planu', chatRules.includes('NIE odpowiadaj planem'))
sprawdz('CHAT_RULES: zakaz kalek dociera do kazdej persony (TON_PERSONY w srodku)', chatRules.includes('ZAKAZANE ZWROTY'))
sprawdz('CHAT_RULES: zakaz angielskich etykiet', chatRules.includes('ZAKAZ angielskich etykiet'))

// --- 4. Opisy narzedzi (realtime.ts) ----------------------------------------

console.log('\n=== TEST 4: opisy narzedzi w realtime.ts ===\n')

const rtBezKom = bezKomentarzy(zrodloRt)
const aiBezKom = bezKomentarzy(zrodloAi)

const ZAKAZANE_W_OPISACH = [
  'UZYJ ZAWSZE',
  'preferuj je nad',
  'preferuj nad',
  'widac to na mapie',
  'Preamble sample phrases',
  'wymaga pracy kilku rol',
]
for (const fraza of ZAKAZANE_W_OPISACH) {
  sprawdz(`realtime.ts: brak frazy "${fraza}"`, !rtBezKom.includes(fraza))
  sprawdz(`ai.ts: brak frazy "${fraza}"`, !aiBezKom.includes(fraza))
}

const startTool = rtBezKom.indexOf("name: 'uruchom_zespol'")
sprawdz('realtime.ts: narzedzie uruchom_zespol istnieje', startTool > 0)
const opisTool = rtBezKom.slice(startTool, startTool + 3500)
sprawdz('uruchom_zespol: bramka "UZYJ TYLKO"', opisTool.includes('UZYJ TYLKO'))
sprawdz('uruchom_zespol: lista "NIE UZYWAJ"', opisTool.includes('NIE UZYWAJ'))
sprawdz('uruchom_zespol: brak pewnosci = nie wywoluj', opisTool.includes('NIE MASZ PEWNOSCI'))
sprawdz('uruchom_zespol: oszczednie', opisTool.toLowerCase().includes('oszczednie'))

const startSzukaj = rtBezKom.indexOf("name: 'przeszukaj_wiedze'")
const opisSzukaj = rtBezKom.slice(startSzukaj, startSzukaj + 2000)
sprawdz('przeszukaj_wiedze: najpierw pamiec firmy i fakty', opisSzukaj.includes('NAJPIERW sprawdz pamiec firmy'))
sprawdz('przeszukaj_wiedze: przyklady zdan po polsku', opisSzukaj.includes('Przykladowe zdania przed uzyciem narzedzia'))

// --- 5. Em-dash w plikach promptow ------------------------------------------

console.log('\n=== TEST 5: brak em-dash ===\n')

for (const [nazwa, zrodlo] of [
  ['ai.ts', zrodloAi],
  ['realtime.ts', zrodloRt],
  ['orchestrator.ts', zrodloOrk],
]) {
  sprawdz(`${nazwa}: brak myslnika em-dash`, !zrodlo.includes('—'))
}

// --- Podsumowanie ------------------------------------------------------------

console.log(`\n=== WYNIK: ${pass} PASS / ${fail} FAIL ===`)
if (fail > 0) {
  console.log('\nBledy:')
  for (const b of bledy) console.log(` - ${b}`)
  process.exit(1)
}

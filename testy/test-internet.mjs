/**
 * TEST INTERNETU I LANCUCHOW (statyczny, bez modelu i bez sieci).
 *
 * Po co: dostep do internetu (web_search) jest opisany w DWOCH miejscach, ktore
 * nie moga sie importowac nawzajem (funkcje Vercela w api/ nie znosza wspolnych
 * importow). Ten test pilnuje, zeby klient (src/lib/ai.ts) i serwer (api/chat.ts)
 * liczyly TE SAME limity dla TYCH SAMYCH agentek, a lista agentek zgadzala sie
 * z jedynym zrodlem prawdy (src/data/agents.ts).
 *
 * Co sprawdza:
 *  1) Kazda agentka z agents.ts ma internet po stronie serwera (AGENCI_Z_WEBEM).
 *  2) Limity max_uses sa identyczne po obu stronach: Rae 8, Mia 6, Zoe 5, reszta 3.
 *  3) Zdanie o internecie (INTERNET_INFO) ma pelna regule uzycia i cytowania zrodel.
 *  4) Blok TYPOWE LANCUCHY ZADAN ma 6-8 przeplywow, jest bez em-dash i nie lamie
 *     hierarchii intencji (jawnie odsyla do niej), a doklejany jest tylko dla COO.
 *
 * Uruchomienie:  node webapp/testy/test-internet.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const TU = dirname(fileURLToPath(import.meta.url))
const WEBAPP = [
  resolve(TU, '..'),
  resolve(process.cwd(), 'webapp'),
  process.cwd(),
].find((p) => existsSync(resolve(p, 'src/lib/ai.ts')))
if (!WEBAPP) throw new Error('Nie znalazlem katalogu webapp (odpal z katalogu projektu)')

const zrodloAi = readFileSync(resolve(WEBAPP, 'src/lib/ai.ts'), 'utf8')
const zrodloApi = readFileSync(resolve(WEBAPP, 'api/chat.ts'), 'utf8')
const zrodloAgenci = readFileSync(resolve(WEBAPP, 'src/data/agents.ts'), 'utf8')

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

/** Wycina literal (obiekt, tablice albo Set) po naglowku deklaracji i go wykonuje. */
function wczytajLiteral(zrodlo, naglowek, otw, zam) {
  const start = zrodlo.indexOf(naglowek)
  if (start < 0) throw new Error(`Brak deklaracji "${naglowek}"`)
  const o = zrodlo.indexOf(otw, start)
  const k = domknij(zrodlo, o, otw, zam)
  if (k < 0) throw new Error(`Nie domknalem literalu "${naglowek}"`)
  return new Function(`return ${zrodlo.slice(o, k + 1)}`)()
}

/**
 * Wycina funkcje ze zrodla TS (bez adnotacji typow) i zwraca ja wykonywalna.
 * `zmienne` podstawia stale, z ktorych funkcja korzysta (np. tablice limitow).
 */
function wczytajFunkcje(zrodlo, nazwa, zmienne = {}) {
  const start = zrodlo.indexOf(`function ${nazwa}(`)
  if (start < 0) throw new Error(`Brak funkcji ${nazwa}`)
  const o = zrodlo.indexOf('{', start)
  const k = domknij(zrodlo, o, '{', '}')
  const kod = zrodlo
    .slice(start, k + 1)
    .replace(/: string \| undefined/g, '')
    .replace(/: unknown/g, '')
    .replace(/: string/g, '')
    .replace(/: number/g, '')
    .replace(/\): \w+ \{/, ') {')
  const nazwy = Object.keys(zmienne)
  return new Function(...nazwy, `${kod}; return ${nazwa}`)(
    ...nazwy.map((n) => zmienne[n]),
  )
}

// --- Dane wejsciowe ----------------------------------------------------------

const SLUGI = [...zrodloAgenci.matchAll(/^\s*slug: '([a-z-]+)'/gm)].map((m) => m[1])
// Rae 8 (research), Mia 6 (trendy), Zoe 5 (kanaly), Ada 5 (przepisy zyja), reszta 3.
const OCZEKIWANE = { analityk: 8, operacje: 6, 'analityk-social': 5, 'prawnik-ai': 5 }
const DOMYSLNY = 3
/** Liczba person w zespole (COO + specjalistki). Zrodlo prawdy: agents.ts. */
const LICZBA_PERSON = 12

// Klient (ai.ts)
const LIMITY_KLIENT = wczytajLiteral(
  zrodloAi,
  'const LIMITY_WEB: Record<string, number> = {',
  '{',
  '}',
)
const DOMYSLNY_KLIENT = Number(
  zrodloAi.match(/const LIMIT_WEB_DOMYSLNY = (\d+)/)?.[1],
)
// Realna funkcja z ai.ts, z podstawionymi stalymi ze zrodla (nie kopiowana).
const limitKlient = wczytajFunkcje(zrodloAi, 'limitWebSearch', {
  LIMITY_WEB: LIMITY_KLIENT,
  LIMIT_WEB_DOMYSLNY: DOMYSLNY_KLIENT,
})

// Serwer (api/chat.ts)
const AGENCI_Z_WEBEM = new Set(
  wczytajLiteral(zrodloApi, 'const AGENCI_Z_WEBEM = new Set(', '[', ']'),
)
const LIMITY_SERWER = wczytajLiteral(
  zrodloApi,
  'const LIMITY_WEB: Record<string, number> = {',
  '{',
  '}',
)
const DOMYSLNY_SERWER = Number(
  zrodloApi.match(/const LIMIT_WEB_DOMYSLNY = (\d+)/)?.[1],
)
const LIMIT_MAX_SERWER = Number(zrodloApi.match(/const LIMIT_WEB_MAX = (\d+)/)?.[1])

// --- 1. Internet dla WSZYSTKICH ---------------------------------------------

console.log('=== TEST 1: internet dla kazdej agentki ===\n')

sprawdz(
  `agents.ts: znalezione slugi (${LICZBA_PERSON})`,
  SLUGI.length === LICZBA_PERSON,
  `jest ${SLUGI.length}`,
)
for (const nowy of ['copywriter-marki', 'prawnik-ai']) {
  sprawdz(`agents.ts: nowa persona "${nowy}" jest w zespole`, SLUGI.includes(nowy))
}
for (const slug of SLUGI) {
  sprawdz(`serwer: "${slug}" ma internet`, AGENCI_Z_WEBEM.has(slug))
}
sprawdz(
  'serwer: lista agentek nie ma nadmiarowych slugow',
  [...AGENCI_Z_WEBEM].every((s) => SLUGI.includes(s)),
  [...AGENCI_Z_WEBEM].filter((s) => !SLUGI.includes(s)).join(', '),
)

// Klient: maWebSearch bez sluga (ekstrakcja pamieci, faktow) NIE dokleja internetu.
sprawdz(
  'klient: maWebSearch dziala przez getAgent (brak sluga = brak internetu)',
  /function maWebSearch\(agentSlug: string \| undefined\): boolean \{\s*return !!agentSlug && getAgent\(agentSlug\) !== undefined/.test(
    zrodloAi,
  ),
)
sprawdz(
  'klient: callDirect dokleja narzedzie web z limitem wg roli',
  /async function callDirect[\s\S]*?body\.tools = narzedzieWeb\(agentSlug\)/.test(zrodloAi),
)
sprawdz(
  'klient: callProxy dokleja narzedzie web z limitem wg roli',
  /async function callProxy[\s\S]*?body\.tools = narzedzieWeb\(agentSlug\)/.test(zrodloAi),
)
sprawdz(
  'klient: callServerChat wysyla agentSlug i webMaxUses',
  /body\.agentSlug = agentSlug/.test(zrodloAi) &&
    /body\.webMaxUses = limitWebSearch\(agentSlug\)/.test(zrodloAi),
)
sprawdz(
  'serwer: max_uses liczony funkcja limitWeb (a nie na sztywno)',
  /max_uses: limitWeb\(agentSlug, body\?\.webMaxUses\)/.test(zrodloApi),
)
sprawdz(
  'serwer: narzedzie to wbudowany web_search_20250305',
  zrodloApi.includes("type: 'web_search_20250305'") &&
    zrodloAi.includes("type: 'web_search_20250305'"),
)

// --- 2. Zgodnosc limitow klient kontra serwer -------------------------------

console.log('\n=== TEST 2: limity max_uses (klient = serwer) ===\n')

sprawdz(
  'domyslny limit taki sam po obu stronach',
  DOMYSLNY_KLIENT === DOMYSLNY_SERWER && DOMYSLNY_KLIENT === DOMYSLNY,
  `klient=${DOMYSLNY_KLIENT}, serwer=${DOMYSLNY_SERWER}`,
)
sprawdz('serwer: sufit limitu z zadania klienta istnieje', LIMIT_MAX_SERWER >= 8)

const limitSerwer = (slug) => LIMITY_SERWER[slug] || DOMYSLNY_SERWER
for (const slug of SLUGI) {
  const oczekiwany = OCZEKIWANE[slug] ?? DOMYSLNY
  const k = limitKlient(slug)
  const s = limitSerwer(slug)
  sprawdz(
    `limit dla "${slug}" = ${oczekiwany} (klient i serwer)`,
    k === oczekiwany && s === oczekiwany,
    `klient=${k}, serwer=${s}`,
  )
}
sprawdz(
  'klient: tablica limitow zgodna z serwerowa',
  JSON.stringify(LIMITY_KLIENT) === JSON.stringify(LIMITY_SERWER),
  `${JSON.stringify(LIMITY_KLIENT)} kontra ${JSON.stringify(LIMITY_SERWER)}`,
)

// --- 3. Zdanie o internecie w promptach -------------------------------------

console.log('\n=== TEST 3: zasada uzycia internetu w prompcie ===\n')

const startInfo = zrodloAi.indexOf('const INTERNET_INFO = [')
const INTERNET_INFO = new Function(
  `return ${zrodloAi.slice(
    zrodloAi.indexOf('[', startInfo),
    domknij(zrodloAi, zrodloAi.indexOf('[', startInfo), '[', ']') + 1,
  )}`,
)().join(' ')

const WYMAGANE_W_INFO = [
  'Masz dostep do internetu',
  'Uzywaj internetu, gdy pytanie dotyczy aktualnych danych spoza naszego mozgu',
  'rynek, konkurencja, ceny rynkowe, trendy, regulacje',
  'Cytuj zrodlo i date',
  'Nie szukaj, gdy odpowiedz masz w mozgu firmy',
]
for (const fraza of WYMAGANE_W_INFO) {
  sprawdz(`INTERNET_INFO zawiera "${fraza}"`, INTERNET_INFO.includes(fraza))
}
sprawdz('INTERNET_INFO bez em-dash', !INTERNET_INFO.includes('—'))
sprawdz(
  'czat (buildSystemPrompt) dokleja INTERNET_INFO',
  /const webInfo = maWebSearch\(agentSlug\) \? INTERNET_INFO : ''/.test(zrodloAi),
)
sprawdz(
  'glos (buildVoicePrompt) dokleja INTERNET_INFO',
  /if \(maWebSearch\(agent\?\.slug\)\) \{\s*tozsamoscBaza\.push\(INTERNET_INFO\)/.test(
    zrodloAi,
  ),
)

// --- 4. Lancuchy zadan (tylko COO) ------------------------------------------

console.log('\n=== TEST 4: TYPOWE LANCUCHY ZADAN (Lea) ===\n')

const lancuchy = wczytajFunkcje(zrodloAi, 'lancuchyZadan')()
const przeplywy = lancuchy.split('\n').filter((l) => l.startsWith('- '))

sprawdz('blok ma naglowek TYPOWE LANCUCHY ZADAN', lancuchy.includes('TYPOWE LANCUCHY ZADAN'))
sprawdz(
  'blok ma 6-10 przeplywow',
  przeplywy.length >= 6 && przeplywy.length <= 10,
  `jest ${przeplywy.length}`,
)
// Nowe persony musza realnie wystapic w lancuchach, inaczej Lea ich nie uzyje.
sprawdz('lancuchy uwzgledniaja Ige (tresci dla klienta)', lancuchy.includes('Iga'))
sprawdz('lancuchy uwzgledniaja Ade (ryzyko prawne)', lancuchy.includes('Ada'))
sprawdz(
  'lancuchy maja osobny przeplyw ryzyka prawnego',
  przeplywy.some((l) => l.includes('Ryzyko prawne')),
)
sprawdz(
  'lancuchy maja przeplyw dostawy po podpisie (nowa rola Mili)',
  przeplywy.some((l) => l.includes('Wdrozenie po podpisie')),
)
sprawdz(
  'kazdy przeplyw ma kolejnosc krokow (strzalka)',
  przeplywy.every((l) => l.includes('->')),
)
sprawdz(
  'kazdy przeplyw wskazuje wlasciciela wyniku albo decyzje wlasciciela',
  przeplywy.every((l) => l.includes('Wynik:') || l.includes('decyduje wlasciciel')),
)
sprawdz('lancuchy: nie odpalamy wszystkich naraz', lancuchy.includes('nie wszystkie na raz'))
sprawdz(
  'lancuchy: nie lamia hierarchii intencji',
  lancuchy.includes('NIE zmienia hierarchii intencji'),
)
sprawdz('lancuchy: brak danych to [INPUT PAWLA]', lancuchy.includes('[INPUT PAWLA]'))
sprawdz('lancuchy bez em-dash', !lancuchy.includes('—'))
sprawdz(
  'lancuchy tylko dla COO (czat)',
  /const lancuchy = agentSlug === 'coo' \? lancuchyZadan\(\) : ''/.test(zrodloAi),
)
sprawdz(
  'lancuchy tylko dla COO (glos)',
  /const lancuchy = agent\?\.slug === 'coo' \? lancuchyZadan\(\) : ''/.test(zrodloAi),
)

// --- 5. Z kim wspolpracuje kazda agentka ------------------------------------

console.log('\n=== TEST 5: stale uklady wspolpracy ===\n')

const WSPOLPRACA = wczytajLiteral(
  zrodloAi,
  'const WSPOLPRACA: Record<string, string> = {',
  '{',
  '}',
)
for (const slug of SLUGI) {
  const linia = WSPOLPRACA[slug]
  sprawdz(`"${slug}" ma opis wspolpracy`, typeof linia === 'string' && linia.length > 60)
  sprawdz(`"${slug}": opis bez em-dash`, !String(linia ?? '').includes('—'))
}
sprawdz(
  'lista kolezanek dokleja stale uklady',
  /TWOJE STALE UKLADY: \$\{wspolpraca\}/.test(zrodloAi),
)
sprawdz(
  'kazda agentka ma proponowac osobe po imieniu',
  zrodloAi.includes('ZAPROPONUJ ta osobe po imieniu'),
)
sprawdz(
  'propozycja to nie uruchomienie zespolu (hierarchia intencji nienaruszona)',
  zrodloAi.includes('Propozycja to nie uruchomienie'),
)

// --- Podsumowanie ------------------------------------------------------------

console.log(`\n=== WYNIK: ${pass} PASS / ${fail} FAIL ===`)
if (fail > 0) {
  console.log('\nBledy:')
  for (const b of bledy) console.log(` - ${b}`)
  process.exit(1)
}

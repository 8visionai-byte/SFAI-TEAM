/**
 * POMIAR BUDZETU PROMPTU GLOSOWEGO (OpenAI Realtime, sufit 40 000 znakow).
 *
 * Po co: komentarz z arytmetyka w `src/lib/ai.ts` latwo sie rozjezdza z kodem, bo
 * kazdy nowy blok promptu (lancuchy zadan, zdanie o internecie, hierarchia intencji)
 * dokladany jest recznie. Ten skrypt NIE odtwarza skladania promptu z komentarza:
 * bunduje realne `src/lib/ai.ts` przez esbuild z podmienionymi modulami
 * `./content` (czyta pliki .md z dysku) i `./storage` (kontrolowane stany pamieci),
 * po czym wola PRAWDZIWA funkcje `buildVoicePrompt` dla wszystkich person z agents.ts.
 *
 * Domyslny scenariusz = najgorszy realny stan aplikacji: pamiec firmy pelna (8 000),
 * twarde fakty pelne (4 000), realna Karta Mozgu, bez pol wpisywanych przez
 * wlasciciela. Pola wlasciciela (nadpis persony, wlasne umiejetnosci, dluzsza Karta)
 * nie maja limitu dlugosci, wiec da sie je dolozyc parametrami.
 *
 * Uruchomienie (z katalogu webapp):
 *   node testy/pomiar-budzetu.mjs
 *   node testy/pomiar-budzetu.mjs --nadpis=800 --skille=1000
 *   node testy/pomiar-budzetu.mjs --karta=20000 --pamiec=8000 --fakty=4000
 *
 * Kod wyjscia 1, gdy ktorykolwiek prompt przekroczy sufit (nie powinno sie zdarzyc:
 * buildVoicePrompt tnie persone, potem Karte, a na koncu robi twardy slice).
 * Kolumny kontrolne pilnuja, ze ciecie NIE zjadlo koncowki promptu:
 *   zasady   = w prompcie sa zasady jezykowe (ZAKAZANE ZWROTY z TON_PERSONY),
 *   notaGlos = prompt konczy sie nota o rozmowie glosowej.
 */
import { writeFileSync, mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const TU = dirname(fileURLToPath(import.meta.url))
const WEBAPP = [resolve(TU, '..'), resolve(process.cwd(), 'webapp'), process.cwd()].find(
  (p) => existsSync(resolve(p, 'src/lib/ai.ts')),
)
if (!WEBAPP) throw new Error('Nie znalazlem katalogu webapp (odpal z katalogu projektu)')

const require = createRequire(join(WEBAPP, 'noop.js'))
const esbuild = require('esbuild')

const arg = (n, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${n}=`))
  return m ? Number(m.split('=')[1]) : d
}
const PAMIEC = arg('pamiec', 8000)
const FAKTY = arg('fakty', 4000)
const NADPIS = arg('nadpis', 0)
const SKILLE = arg('skille', 0)
const KARTA = arg('karta', 0) // 0 = realna Karta Mozgu z dysku

const stubContent = `
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const W = ${JSON.stringify(WEBAPP)}
export function getAgentPrompt(slug) {
  try { return readFileSync(resolve(W, 'src/content/agenci/' + slug + '.md'), 'utf8') } catch { return '' }
}
export function getFullBrain() { return '' }
export function getBrainCard() {
  const t = readFileSync(resolve(W, 'src/content/mozg/_KARTA-MOZGU.md'), 'utf8')
  return ${KARTA} > 0 ? t.repeat(Math.ceil(${KARTA} / t.length)).slice(0, ${KARTA}) : t
}
`
const stubStorage = `
export function aktywneSkilleAgenta() {
  return ${SKILLE} > 0 ? [{ nazwa: 'Umiejetnosc wlasciciela', instrukcja: 'x'.repeat(${SKILLE}) }] : []
}
export function getProfil() { return { id: 'pawel', imie: 'Pawel' } }
export function getSesja() { return null }
export function authNaglowek() { return {} }
export function wczytajPersonaNadpis() {
  return ${NADPIS} > 0 ? { kimJestem: 'y'.repeat(${NADPIS}), jakSieZwracam: 'po imieniu' } : null
}
export function wczytajFaktyAgenta() { return ${FAKTY} > 0 ? 'f'.repeat(${FAKTY}) : '' }
export function zapiszFaktyAgenta() {}
export function wczytajPamiecFirmy() { return ${PAMIEC} > 0 ? 'p'.repeat(${PAMIEC}) : '' }
export function zapiszPamiecFirmy() {}
export function pamiecAgenta() { return [] }
export function transkrypcjeAgenta() { return [] }
export function zrodlaPamieciFirmy() { return [] }
export function pamiecAutoWlaczona() { return true }
`

const dir = mkdtempSync(join(tmpdir(), 'pomiar-budzetu-'))
writeFileSync(join(dir, 'content.mjs'), stubContent)
writeFileSync(join(dir, 'storage.mjs'), stubStorage)

const podmiana = {
  name: 'podmiana-modulow',
  setup(build) {
    build.onResolve({ filter: /^\.\/content$/ }, () => ({ path: join(dir, 'content.mjs') }))
    build.onResolve({ filter: /^\.\/storage$/ }, () => ({ path: join(dir, 'storage.mjs') }))
  },
}

const wynik = await esbuild.build({
  entryPoints: [resolve(WEBAPP, 'src/lib/ai.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  plugins: [podmiana],
  external: ['node:fs', 'node:path'],
  define: { 'import.meta.env.VITE_ANTHROPIC_MODEL': 'undefined' },
})

const plik = join(dir, 'ai.mjs')
writeFileSync(plik, wynik.outputFiles[0].text)
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const mod = await import('file://' + plik.replace(/\\/g, '/'))

// Slugi czytane wprost z agents.ts (jedyne zrodlo prawdy), zeby kazda nowa
// persona byla mierzona automatycznie, bez edycji tego pliku.
const SLUGI = [
  ...readFileSync(resolve(WEBAPP, 'src/data/agents.ts'), 'utf8').matchAll(
    /^\s*slug: '([a-z-]+)'/gm,
  ),
].map((m) => m[1])
const LIMIT = 40000

console.log(
  `scenariusz: pamiec=${PAMIEC} fakty=${FAKTY} nadpis=${NADPIS} skille=${SKILLE} karta=${
    KARTA || 'realna'
  }\n`,
)
console.log(
  'slug'.padEnd(17),
  'dlugosc'.padStart(8),
  'zapas'.padStart(7),
  'persCieta'.padStart(10),
  'zasady'.padStart(7),
  'notaGlos'.padStart(9),
  'lancuchy'.padStart(9),
)

let max = 0
let bledy = 0
for (const slug of SLUGI) {
  const p = mod.buildVoicePrompt(slug)
  max = Math.max(max, p.length)
  const zasady = p.includes('ZAKAZANE ZWROTY')
  const nota = p.trimEnd().endsWith('zamiast przerywac rada.')
  if (p.length > LIMIT || !zasady || !nota) bledy++
  console.log(
    slug.padEnd(17),
    String(p.length).padStart(8),
    String(LIMIT - p.length).padStart(7),
    String(p.includes('[...persona przycieta')).padStart(10),
    String(zasady).padStart(7),
    String(nota).padStart(9),
    String(p.includes('TYPOWE LANCUCHY ZADAN')).padStart(9),
  )
}

console.log(`\nNAJDLUZSZY: ${max} / ${LIMIT} (zapas ${LIMIT - max})`)
if (bledy > 0) {
  console.log(`\nBLAD: ${bledy} person przekracza sufit albo stracilo koncowke promptu.`)
  process.exit(1)
}

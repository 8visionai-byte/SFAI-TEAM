/**
 * TEST GEOMETRII MAPY NEURONU (regresja: nachodzace podpisy).
 *
 * Po co: wlasciciel DWA RAZY zglosil te sama usterke, raz na Mii, raz na Rae
 * i Idze: opis persony wchodzil na twarz sasiadki, a podpis Lei lezal na niciach.
 * Uklad da sie policzyc, wiec da sie go tez sprawdzic bez przegladarki. Test
 * bunduje PRAWDZIWY `src/lib/geometriaMapy.ts` przez esbuild i dla siatki
 * realnych rozmiarow okna oraz liczby agentek sprawdza, czy cokolwiek na siebie
 * nachodzi.
 *
 * Co jest sprawdzane dla kazdego przypadku:
 *   1. podpis kontra portret sasiadki (glowna usterka),
 *   2. podpis kontra podpis sasiadki,
 *   3. portret kontra portret sasiadki,
 *   4. portret specjalistki kontra portret COO w srodku,
 *   5. czy caly uklad (z podpisami) miesci sie w plotnie,
 *   6. czy podpis Lei nie zachodzi na obszar, z ktorego wychodza nici.
 *
 * Uruchomienie (z katalogu webapp):  node testy/test-geometria.mjs
 * Kod wyjscia 1, gdy jakikolwiek przypadek ma kolizje.
 */
import { writeFileSync, mkdtempSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const KATALOG = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(KATALOG, '..')

// --- zbudowanie realnego modulu geometrii do CommonJS ---------------------
const esbuild = require('esbuild')
const tmp = mkdtempSync(join(tmpdir(), 'sfai-geo-'))
const out = join(tmp, 'geo.cjs')
esbuild.buildSync({
  entryPoints: [resolve(ROOT, 'src/lib/geometriaMapy.ts')],
  outfile: out,
  bundle: true,
  format: 'cjs',
  platform: 'node',
  logLevel: 'silent',
})
const { ukladMapy, pozycjaWezla } = require(out)

// --- narzedzia geometryczne ----------------------------------------------
const prostokatKolo = (box, cxx, cyy, r) => {
  const nx = Math.max(box.x0, Math.min(cxx, box.x1))
  const ny = Math.max(box.y0, Math.min(cyy, box.y1))
  return Math.hypot(cxx - nx, cyy - ny) < r
}
const prostokatProstokat = (a, b) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

function sprawdz(w, h, N) {
  const u = ukladMapy(w, h, N)
  const P = Array.from({ length: N }, (_, i) => pozycjaWezla(u, i, N))
  const boxy = P.map((p) => ({
    x0: p.x - u.etyPx / 2,
    x1: p.x + u.etyPx / 2,
    y0: p.y + u.offPodpis,
    y1: p.y + u.offPodpis + u.hPodpis,
  }))
  const usterki = []
  const rSpec = u.specPx / 2
  const rCoo = u.cooPx / 2

  for (let i = 0; i < N; i++) {
    // 1. podpis i-tej kontra portrety pozostalych
    for (let j = 0; j < N; j++) {
      if (i === j) continue
      if (prostokatKolo(boxy[i], P[j].x, P[j].y, rSpec)) {
        usterki.push(`podpis ${i} na portrecie ${j}`)
      }
    }
    // 2. podpis kontra podpis
    for (let j = i + 1; j < N; j++) {
      if (prostokatProstokat(boxy[i], boxy[j])) {
        usterki.push(`podpis ${i} na podpisie ${j}`)
      }
    }
    // 3. portret kontra portret
    for (let j = i + 1; j < N; j++) {
      if (Math.hypot(P[j].x - P[i].x, P[j].y - P[i].y) < 2 * rSpec - 1) {
        usterki.push(`portret ${i} na portrecie ${j}`)
      }
    }
    // 4. portret kontra COO (dopuszczamy stykanie sie co do 1 px)
    if (Math.hypot(P[i].x - u.cx, P[i].y - u.cy) < rSpec + rCoo - 1) {
      usterki.push(`portret ${i} na COO`)
    }
    // 5. w granicach plotna
    if (
      boxy[i].y1 > h + 1 ||
      boxy[i].y0 < -1 ||
      boxy[i].x0 < -1 ||
      boxy[i].x1 > w + 1 ||
      P[i].y - rSpec < -1 ||
      P[i].x - rSpec < -1 ||
      P[i].x + rSpec > w + 1
    ) {
      usterki.push(`wezel ${i} poza plotnem`)
    }
  }

  // 6. podpis COO (pod jej portretem) kontra portrety specjalistek. Nici
  //    omijaja podpis geometrycznie (promienZajetosci w Command.tsx), ale sam
  //    podpis nie moze wejsc na sasiadke.
  const szerCoo = Math.max(u.etyPx, u.compact ? 96 : 168)
  const boxCoo = {
    x0: u.cx - szerCoo / 2,
    x1: u.cx + szerCoo / 2,
    y0: u.cy + rCoo + u.micWystaje + u.luzPodpisu,
    y1: u.cy + rCoo + u.micWystaje + u.luzPodpisu + u.hPodpis,
  }
  for (let i = 0; i < N; i++) {
    if (prostokatKolo(boxCoo, P[i].x, P[i].y, rSpec)) {
      usterki.push(`podpis COO na portrecie ${i}`)
    }
  }

  return { u, usterki }
}

// --- siatka przypadkow ----------------------------------------------------
const EKRANY = [
  [1700, 900],
  [1700, 1000],
  [1920, 960],
  [1920, 1100],
  [1600, 900],
  [1450, 900],
  [1280, 900],
  [1100, 900],
  [900, 900],
  [768, 900],
  [420, 780],
  [390, 700],
  [360, 640],
]
const LICZBY = [6, 9, 10, 11, 12, 13, 15]

let pass = 0
let fail = 0
const zleSzczegoly = []
console.log('ekran        N   portret  podpis  rola?  wynik')
for (const [w, h] of EKRANY) {
  for (const N of LICZBY) {
    const { u, usterki } = sprawdz(w, h, N)
    const ok = usterki.length === 0
    if (ok) pass++
    else {
      fail++
      zleSzczegoly.push(`${w}x${h} N=${N}: ${[...new Set(usterki)].slice(0, 4).join(', ')}`)
    }
    if (N === 11 || !ok) {
      console.log(
        `${String(w + 'x' + h).padEnd(12)} ${String(N).padStart(2)}   ${String(u.specPx).padStart(5)}   ${String(u.etyPx).padStart(5)}   ${u.podpisPelny ? 'TAK ' : 'nie '}  ${ok ? 'OK' : 'KOLIZJA'}`,
      )
    }
  }
}

if (zleSzczegoly.length) {
  console.log('\n--- USTERKI ---')
  zleSzczegoly.forEach((z) => console.log('  ' + z))
}

// Kontrola dodatkowa: na typowym ekranie desktopowym rola MA byc widoczna.
const typowy = sprawdz(1700, 900, 11)
if (!typowy.u.podpisPelny) {
  console.log(
    '\nUWAGA: na 1700x900 przy 11 osobach rola nie miesci sie w podpisie (portret ' +
      typowy.u.specPx +
      ' px). Uklad jest bezkolizyjny, ale wlasciciel chce widziec role.',
  )
  fail++
}

console.log(`\n=== WYNIK: ${pass} PASS / ${fail} FAIL ===`)
process.exit(fail > 0 ? 1 : 0)

/**
 * POMIAR REALNEGO LIMITU INSTRUKCJI (OpenAI Realtime).
 *
 * Po co: OpenAI ma twardy limit 16384 TOKENOW na instrukcje sesji glosowej, a my
 * pracujemy na ZNAKACH, bo w przegladarce nie liczymy tokenow. Przelicznik zalezy
 * od jezyka: polski tekst promptow person to okolo 2,9-3,1 znaku na token, wiec
 * "bezpieczne 40 000 znakow" bylo oszacowaniem, nie pomiarem, i zostawialo kilka
 * tysiecy tokenow niewykorzystanych. Ten skrypt szuka granicy DOSWIADCZALNIE:
 * wysyla do wdrożonego /api/realtime-token instrukcje o rosnacej dlugosci i
 * sprawdza, kiedy OpenAI odrzuci sesje.
 *
 * WAZNE: skrypt bada endpoint PRODUKCYJNY, wiec widzi rowniez wlasny sufit
 * MAX_INSTR z api/realtime-token.ts. Zeby zmierzyc granice OpenAI, a nie nasza,
 * sufit musi byc chwilowo wyzszy od spodziewanego limitu (zmienna srodowiskowa
 * MAX_INSTRUKCJE_ZNAKI na Vercelu).
 *
 * Uruchomienie:
 *   node testy/pomiar-limitu-instrukcji.mjs
 *   node testy/pomiar-limitu-instrukcji.mjs https://sfaiteam.vercel.app
 */
const BAZA = process.argv[2] ?? 'https://sfaiteam.vercel.app'
const URL = `${BAZA.replace(/\/$/, '')}/api/realtime-token`

// Probka jezykowo zblizona do realnych promptow person (polski, duzo nazw wlasnych).
const PROBKA =
  'Jestes Lea, COO i orkiestratorka zespolu AI SimpleFast.ai. Znasz firme na wylot: premium polska firma wdrazajaca AI Agentow dla malych i srednich firm w Polsce. Odpowiadasz KONKRETNIE, realnymi danymi firmy, nigdy ogolnikami. Nie zmyslasz liczb ani faktow. Twoje kolezanki to Sam, Mia, Rae, Vera, Kaja, Jade, Ella, Nora, Zoe, Iga i Ada. Cel nadrzedny firmy to zwiekszyc sprzedaz: dziesiec projektow miesiecznie, projekt zwykle dziesiec do dwudziestu tysiecy zlotych. '

const pauza = (ms) => new Promise((r) => setTimeout(r, ms))

async function probuj(znaki) {
  const instrukcje = PROBKA.repeat(Math.ceil(znaki / PROBKA.length)).slice(0, znaki)
  try {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voice: 'marin', instructions: instrukcje }),
    })
    const tekst = await r.text()
    if (r.ok) return { ok: true }
    let powod = tekst.slice(0, 200)
    try {
      powod = JSON.stringify(JSON.parse(tekst)).slice(0, 240)
    } catch {
      /* zostaw surowy tekst */
    }
    return { ok: false, status: r.status, powod }
  } catch (e) {
    return { ok: false, status: 0, powod: String(e?.message ?? e) }
  }
}

const main = async () => {
  console.log('Endpoint:', URL)
  console.log('Szukam granicy dlugosci instrukcji (podwajanie, potem polowienie).\n')

  // FAZA 1: rosniemy, az cos padnie.
  let dobre = 0
  let zle = 0
  for (const n of [30000, 40000, 46000, 52000, 60000, 72000, 90000]) {
    const r = await probuj(n)
    console.log(`  ${String(n).padStart(6)} znakow -> ${r.ok ? 'OK' : 'ODRZUCONE (' + r.status + ') ' + r.powod}`)
    if (r.ok) dobre = n
    else {
      zle = n
      break
    }
    await pauza(600)
  }

  if (!zle) {
    console.log(
      `\nGranica NIE zostala osiagnieta do ${dobre} znakow. Albo sufit MAX_INSTR w api/realtime-token.ts jest nizszy (i to on tnie), albo limit modelu jest wyzszy niz zakres testu.`,
    )
    return
  }

  // FAZA 2: polowienie miedzy ostatnim dobrym a pierwszym zlym.
  console.log('\nPolowienie przedzialu...')
  let lo = dobre
  let hi = zle
  while (hi - lo > 1000) {
    const mid = Math.round((lo + hi) / 2)
    const r = await probuj(mid)
    console.log(`  ${String(mid).padStart(6)} znakow -> ${r.ok ? 'OK' : 'ODRZUCONE'}`)
    if (r.ok) lo = mid
    else hi = mid
    await pauza(600)
  }

  const TOKENY = 16384
  console.log(`\n=== GRANICA: okolo ${lo} znakow (pierwsze odrzucenie przy ${hi}) ===`)
  console.log(`Przelicznik: ${(lo / TOKENY).toFixed(2)} znaku na token przy limicie ${TOKENY} tokenow.`)
  console.log(
    `REKOMENDACJA dla MAX_INSTR: ${Math.floor(lo * 0.92)} znakow (8 procent zapasu na dluzsze slowa i edycje wlasciciela).`,
  )
}

main()

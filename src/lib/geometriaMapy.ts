/**
 * GEOMETRIA MAPY NEURONU (czysta matematyka, zero Reacta).
 *
 * Wydzielone z Command.tsx 2026-07-26, po tym jak wlasciciel DWA RAZY zglosil
 * ten sam typ usterki: podpisy wchodzace na twarze sasiadow (Mia, potem Rae pod
 * Vera i Iga na Zoe). Skoro uklad da sie policzyc, da sie go tez przetestowac:
 * `testy/test-geometria.mjs` sprawdza brak kolizji na siatce realnych rozmiarow
 * okna i liczby agentek, wiec regresja wychodzi przed wdrozeniem, nie u wlasciciela.
 *
 * ZASADY UKLADU:
 * 1. Podpis KAZDEGO wezla stoi POD awatarem, wysrodkowany. Jednolicie, bez
 *    wyjatkow (wczesniej podpisy szly radialnie na zewnatrz i przy wezlach
 *    bocznych siegaly blizej srodka niz krawedz portretu).
 * 2. Owal nie moze byc zbyt plaski. Na bardzo szerokim owalu sasiedzi przy lewej
 *    i prawej krawedzi stoja niemal jeden nad drugim, a wtedy podpis gornego
 *    ląduje na twarzy dolnego. Stad ograniczenie rx wzgledem ry.
 * 3. Rozmiar portretu ustepuje podpisowi: liczymy go tak, zeby portret PLUS
 *    mikrofon PLUS podpis zmiescily sie w odstepie miedzy sasiadami.
 * 4. Gdy i to nie wystarcza, podpis schodzi do jednej linii (samo imie), zamiast
 *    pozwolic roli wejsc na sasiada. Rola zostaje w tooltipie i w profilu.
 */

export interface UkladMapy {
  /** Waski ekran (telefon): mniejsze portrety, krotsze podpisy. */
  compact: boolean
  /** Srodek plotna. */
  cx: number
  cy: number
  /** Promienie owalu, na ktorym stoja specjalistki. */
  Rx: number
  Ry: number
  /** Bok portretu specjalistki i COO w px. */
  specPx: number
  cooPx: number
  /** Szerokosc bloku podpisu i jego wysokosc. */
  etyPx: number
  hPodpis: number
  /** Czy w podpisie miesci sie druga linia (rola). */
  podpisPelny: boolean
  /** Przycisk mikrofonu: bok i to, o ile wystaje pod awatar. */
  micPx: number
  micWystaje: number
  /** Odleglosc od srodka wezla do gornej krawedzi podpisu. */
  offPodpis: number
  /** Promienie, na ktorych zaczynaja i koncza sie nici. */
  specEdge: number
  cooEdge: number
  /** Luz miedzy mikrofonem a podpisem. */
  luzPodpisu: number
  /** Najmniejszy odstep sasiadow i najmniejsza odleglosc wezla od srodka. */
  minAdj: number
  minDist: number
}

export function ukladMapy(w: number, h: number, N: number): UkladMapy {
  const cx = w / 2
  const cy = h / 2
  const compact = w < 640

  // Docelowe (maksymalne) boki portretow. Faktyczny rozmiar moze zmalec.
  const specTarget = compact ? 74 : 130

  const margXbaza = compact ? 74 : 116
  const luzPodpisu = compact ? 8 : 12
  const H_PODPIS_PELNY = compact ? 30 : 46
  const H_PODPIS_KROTKI = compact ? 16 : 20
  const margY = (compact ? 60 : 84) + H_PODPIS_PELNY

  const micPx = compact ? 34 : 40
  const micWystaje = Math.round(0.42 * micPx)

  const skalaN = N > 10 ? 10 / N : 1
  const odstep = compact ? 10 : 18

  function owal(marg: number) {
    let rx = Math.max(compact ? 40 : 120, w / 2 - marg)
    let ry = Math.max(compact ? 100 : 150, h / 2 - margY)
    if (compact) ry = Math.min(ry, rx * 2.4)
    else rx = Math.min(rx, ry * 2.2)
    let adj = Infinity
    let dist = Infinity
    for (let i = 0; i < N; i++) {
      const th = -Math.PI / 2 + i * ((2 * Math.PI) / N)
      const px1 = cx + rx * Math.cos(th)
      const py1 = cy + ry * Math.sin(th)
      const d = Math.hypot(px1 - cx, py1 - cy)
      if (d < dist) dist = d
      const th2 = -Math.PI / 2 + ((i + 1) % N) * ((2 * Math.PI) / N)
      const px2 = cx + rx * Math.cos(th2)
      const py2 = cy + ry * Math.sin(th2)
      const ad = Math.hypot(px1 - px2, py1 - py2)
      if (ad < adj) adj = ad
    }
    if (!Number.isFinite(adj)) adj = 2 * rx
    if (!Number.isFinite(dist)) dist = Math.min(rx, ry)
    return { rx, ry, adj, dist }
  }

  const bokSpec = (adj: number, hPodpis: number) => {
    const zOdstepu = Math.round(adj - odstep)
    const podPortretem = micWystaje + luzPodpisu + hPodpis + (compact ? 4 : 11)
    const zPodpisu = Math.round(adj - podPortretem)
    return Math.max(
      compact ? 40 : 72,
      Math.min(Math.round(specTarget * skalaN), zOdstepu, zPodpisu),
    )
  }
  const bokPodpisu = (adj: number) =>
    Math.max(
      compact ? 40 : 76,
      Math.min(compact ? 78 : 150, Math.round(adj - (compact ? 6 : 12))),
    )

  // PRZEBIEG 1: zapas pesymistyczny, zeby poznac realny rozmiar portretu.
  const p1 = owal(margXbaza)
  const spec1 = bokSpec(p1.adj, H_PODPIS_PELNY)
  const ety1 = bokPodpisu(p1.adj)

  // PRZEBIEG 2: realny zapas poziomy (portret i podpis stoja w tej samej osi).
  const margX = Math.min(
    margXbaza,
    Math.max(compact ? 44 : 72, Math.max(spec1, ety1) / 2 + 6),
  )
  const { rx: Rx, ry: Ry, adj: minAdj, dist: minDist } = owal(margX)

  // Wariant podpisu: pelny, dopoki portret nie musi przez to zejsc ponizej progu.
  const PROG_CZYTELNOSCI = compact ? 52 : 92
  const specPelny = bokSpec(minAdj, H_PODPIS_PELNY)
  let podpisPelny = specPelny >= PROG_CZYTELNOSCI
  let hPodpis = podpisPelny ? H_PODPIS_PELNY : H_PODPIS_KROTKI
  let specPx = podpisPelny ? specPelny : bokSpec(minAdj, H_PODPIS_KROTKI)

  const cooCap = Math.round(2 * (minDist - specPx / 2 - (compact ? 6 : 10)))
  const cooPx = Math.max(
    compact ? 84 : 128,
    Math.min(compact ? 116 : 160, cooCap),
  )

  let etyPx = Math.min(
    bokPodpisu(minAdj),
    Math.max(36, Math.round(2 * (w / 2 - Rx))),
  )

  // --- KOREKTA: dopoki cokolwiek na siebie nachodzi, zmniejszaj ------------
  // Wzory wyzej pilnuja odleglosci PIONOWEJ miedzy sasiadami, ale podpis jest
  // szeroki i przy sasiadach stojacych UKOSNIE potrafi siegnac bokiem na czyjs
  // portret. Zamiast mnozyc wzory na kazdy uklad, sprawdzamy realne prostokaty
  // i kolka, i zwezamy podpis (a w ostatecznosci portret), az jest czysto.
  // Dzieki temu uklad jest poprawny dla DOWOLNEJ liczby agentek, takze gdy
  // zespol urosnie, i nie trzeba pamietac o przeliczaniu geometrii.
  const MIN_ETY = compact ? 40 : 64
  const MIN_SPEC = compact ? 36 : 64
  const pozycje = Array.from({ length: N }, (_, i) => {
    const th = -Math.PI / 2 + i * ((2 * Math.PI) / N)
    return { x: cx + Rx * Math.cos(th), y: cy + Ry * Math.sin(th) }
  })
  const kolizje = (spec: number, ety: number, hp: number): boolean => {
    const off = spec / 2 + micWystaje + luzPodpisu
    const r = spec / 2
    for (let i = 0; i < N; i++) {
      const b = {
        x0: pozycje[i].x - ety / 2,
        x1: pozycje[i].x + ety / 2,
        y0: pozycje[i].y + off,
        y1: pozycje[i].y + off + hp,
      }
      // Poza plotnem: przy malej liczbie agentek portrety sa najwieksze, wiec
      // dolny wezel razem z podpisem potrafi wyjsc pod krawedz panelu.
      if (
        b.y1 > h ||
        b.x0 < 0 ||
        b.x1 > w ||
        pozycje[i].y - r < 0 ||
        pozycje[i].x - r < 0 ||
        pozycje[i].x + r > w
      )
        return true
      for (let j = 0; j < N; j++) {
        if (i === j) continue
        const nx = Math.max(b.x0, Math.min(pozycje[j].x, b.x1))
        const ny = Math.max(b.y0, Math.min(pozycje[j].y, b.y1))
        if (Math.hypot(pozycje[j].x - nx, pozycje[j].y - ny) < r) return true
      }
      for (let j = i + 1; j < N; j++) {
        const b2 = {
          x0: pozycje[j].x - ety / 2,
          x1: pozycje[j].x + ety / 2,
          y0: pozycje[j].y + off,
          y1: pozycje[j].y + off + hp,
        }
        if (b.x0 < b2.x1 && b2.x0 < b.x1 && b.y0 < b2.y1 && b2.y0 < b.y1)
          return true
      }
    }
    return false
  }
  for (let krok = 0; krok < 80 && kolizje(specPx, etyPx, hPodpis); krok++) {
    if (etyPx > MIN_ETY) etyPx = Math.max(MIN_ETY, etyPx - 6)
    else if (podpisPelny && hPodpis > H_PODPIS_KROTKI) {
      // Zabraklo miejsca na role: schodzimy do samego imienia i odzyskujemy
      // kilkadziesiat pikseli, zamiast dalej scinac portrety.
      podpisPelny = false
      hPodpis = H_PODPIS_KROTKI
      etyPx = Math.min(
        bokPodpisu(minAdj),
        Math.max(36, Math.round(2 * (w / 2 - Rx))),
      )
    } else if (specPx > MIN_SPEC) specPx = Math.max(MIN_SPEC, specPx - 4)
    else break
  }

  const specEdge = specPx / 2 - 4
  const cooEdge = cooPx / 2 - 4
  const offPodpis = specPx / 2 + micWystaje + luzPodpisu

  return {
    compact,
    cx,
    cy,
    Rx,
    Ry,
    specPx,
    cooPx,
    etyPx,
    hPodpis,
    podpisPelny,
    micPx,
    micWystaje,
    offPodpis,
    specEdge,
    cooEdge,
    luzPodpisu,
    minAdj,
    minDist,
  }
}

/** Pozycja srodka wezla o indeksie i (wezly stoja co rowny kat, start u gory). */
export function pozycjaWezla(
  u: UkladMapy,
  i: number,
  N: number,
): { x: number; y: number; theta: number } {
  const theta = -Math.PI / 2 + i * ((2 * Math.PI) / N)
  return {
    x: u.cx + u.Rx * Math.cos(theta),
    y: u.cy + u.Ry * Math.sin(theta),
    theta,
  }
}

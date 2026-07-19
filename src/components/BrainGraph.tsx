import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  type BrainGraphModel,
  type GraphNode,
  type LinkKind,
  GROUP_OPIS,
} from '../lib/brainGraph'
import { getAgent, type Agent } from '../data/agents'
import { getCharacter } from '../data/characters'
import CharacterAvatar from './CharacterAvatar'

/** Wewnetrzny wezel symulacji (statyka z modelu + stan fizyki). */
interface SimNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
  /** Pozycja zablokowana (przeciaganie). */
  fixed: boolean
}

interface Props {
  /** Gotowy model grafu (budowany raz w Brain.tsx i wspoldzielony z panelem). */
  model: BrainGraphModel
  /** Id aktualnie wybranego wezla (podglad w panelu obok) lub null. */
  selectedId: string | null
  /** Klik na dowolny wezel: pokazuje jego karte w panelu bocznym (nie nawiguje). */
  onSelect: (node: GraphNode) => void
}

/** Docelowa dlugosc sprezyny wg typu krawedzi. */
const REST_LEN: Record<LinkKind, number> = {
  backbone: 160,
  hub: 74,
  ref: 118,
  reads: 128,
  note: 60,
}

/** Grubosc i bazowa przezroczystosc krawedzi wg typu. */
const LINK_STYLE: Record<LinkKind, { w: number; o: number }> = {
  backbone: { w: 1.6, o: 0.5 },
  hub: { w: 1.1, o: 0.35 },
  ref: { w: 1.0, o: 0.45 },
  reads: { w: 0.8, o: 0.22 },
  note: { w: 0.9, o: 0.4 },
}

const TAU = Math.PI * 2
/** Maks. jednoczesnych impulsow (wydajnosc). */
const IMPULSE_MAX = 5
/** Liczba probek wstegi krawedzi (kompromis gladkosc/koszt). */
const EDGE_SAMPLES = 8
/** Amplituda falowania punktu kontrolnego krawedzi (px, "tkanka zyje"). */
const WAVE_AMP = 3
/** Odstep miedzy probami odpalenia impulsu (ms). */
const SPAWN_MS = 850
/** Throttling warstwy zycia (~30 fps wystarczy dla falowania). */
const LIFE_FRAME_MS = 33

/** Swietlny impuls biegnacy wzdluz jednej krawedzi (jak wyladowanie neuronu). */
interface Impulse {
  /** Indeks krawedzi w model.links. */
  edge: number
  /** Postep 0..1 wzdluz krzywej (source -> target). */
  t: number
  /** Predkosc w jednostkach t na sekunde. */
  speed: number
  /** Kolor impulsu (kolor grupy wezla zrodlowego). */
  color: string
}

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Deterministyczny pseudo-random (zeby uklad startowy byl stabilny). */
function seeded(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Inicjaly persony (ta sama logika co w Avatar.tsx). */
function inicjaly(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    if (words[0].length <= 3) return words[0].toUpperCase()
    return words[0].slice(0, 2).toUpperCase()
  }
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Etykieta persony do inicjalow: pelna nazwa agenta (nie skrocona z modelu). */
function personaInicjaly(node: GraphNode): string {
  const slug = node.id.startsWith('persona:') ? node.id.slice(8) : ''
  const agent = getAgent(slug)
  return inicjaly(agent?.name ?? node.label)
}

/** Agent dla wezla persony (do miniatury portretu) lub undefined. */
function personaAgent(node: GraphNode): Agent | undefined {
  if (!node.id.startsWith('persona:')) return undefined
  return getAgent(node.id.slice(8))
}

/**
 * Punkt kontrolny krawedzi: bazowy luk + delikatne falowanie w czasie.
 * Dwie skladowe sinusa o roznych fazach daja organiczny, nieregularny ruch
 * (tkanka zyje). amp=0 => statyka (prefers-reduced-motion).
 */
function edgeControl(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  phase: number,
  time: number,
  amp: number,
): { cx: number; cy: number } {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  // Normalna do odcinka, staly znak => wszystkie nici wygiete w te sama strone.
  const nrmx = -dy / len
  const nrmy = dx / len
  const bow = 0.12 * len
  const wave =
    amp *
    (0.7 * Math.sin(time * 0.9 + phase) + 0.3 * Math.sin(time * 1.7 + phase * 1.4))
  const off = bow + wave
  return { cx: mx + nrmx * off, cy: my + nrmy * off }
}

/**
 * Wstega krawedzi o zmiennej grubosci: grubsza przy wezlach, cienka w srodku
 * (jak nic dendrytu wtapiajaca sie w jadro). Zamknieta sciezka wypelniana kolorem.
 */
function ribbonPath(
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
  wEnd: number,
  wMid: number,
  samples: number,
): string {
  const left: string[] = []
  const right: string[] = []
  for (let k = 0; k <= samples; k++) {
    const t = k / samples
    const mt = 1 - t
    // Punkt na krzywej kwadratowej.
    const px = mt * mt * ax + 2 * mt * t * cx + t * t * bx
    const py = mt * mt * ay + 2 * mt * t * cy + t * t * by
    // Styczna (pochodna krzywej) -> normalna do offsetu grubosci.
    let tx = 2 * mt * (cx - ax) + 2 * t * (bx - cx)
    let ty = 2 * mt * (cy - ay) + 2 * t * (by - cy)
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl
    ty /= tl
    const nx = -ty
    const ny = tx
    // |2t-1| => 1 przy koncach, 0 w srodku => grubiej przy wezlach.
    const half = (wMid + (wEnd - wMid) * Math.abs(2 * t - 1)) / 2
    left.push(`${(px + nx * half).toFixed(2)} ${(py + ny * half).toFixed(2)}`)
    right.push(`${(px - nx * half).toFixed(2)} ${(py - ny * half).toFixed(2)}`)
  }
  right.reverse()
  return `M ${left.join(' L ')} L ${right.join(' L ')} Z`
}

/** Punkt na krzywej kwadratowej (pozycja impulsu wzdluz krawedzi). */
function quadPoint(
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t
  return {
    x: mt * mt * ax + 2 * mt * t * cx + t * t * bx,
    y: mt * mt * ay + 2 * mt * t * cy + t * t * by,
  }
}

export default function BrainGraph({ model, selectedId, onSelect }: Props) {
  // Sasiedzi kazdego wezla (do podswietlania przy hover).
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const n of model.nodes) m.set(n.id, new Set())
    for (const l of model.links) {
      m.get(l.source)?.add(l.target)
      m.get(l.target)?.add(l.source)
    }
    return m
  }, [model])

  const simRef = useRef<SimNode[]>([])
  const byId = useRef<Map<string, SimNode>>(new Map())
  const rafRef = useRef<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const draggingId = useRef<string | null>(null)

  // --- Warstwa "zycia" (imperatywna, bez React re-render): falowanie + impulsy ---
  /** Refy do sciezek krawedzi (setAttribute 'd' per klatke). */
  const edgeRefs = useRef<(SVGPathElement | null)[]>([])
  /** Ostatni punkt kontrolny + konce kazdej krawedzi (dla pozycji impulsow). */
  const edgeCtrl = useRef<
    { cx: number; cy: number; ax: number; ay: number; bx: number; by: number }[]
  >([])
  /** Refy do kropek impulsow (pula o stalym rozmiarze). */
  const impulseRefs = useRef<(SVGCircleElement | null)[]>([])
  /** Aktywne impulsy w puli (null = wolny slot). */
  const impulsesRef = useRef<(Impulse | null)[]>([])
  /** Handle pętli zycia (osobny od fizyki rafRef). */
  const lifeRafRef = useRef<number | null>(null)
  /** Czas animacji (s) do falowania. */
  const timeRef = useRef(0)
  const lastFrameRef = useRef(0)
  const lastSpawnRef = useRef(0)
  /** Czy graf jest widoczny w viewport (IntersectionObserver). */
  const visibleRef = useRef(true)
  /** Losowa faza falowania per krawedz (rozne fazy => tkanka nie pulsuje rowno). */
  const edgePhaseRef = useRef<number[]>([])
  const viewRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: -400,
    y: -300,
    w: 800,
    h: 600,
  })

  // Stan renderowany (snapshot pozycji + viewBox), aktualizowany per klatke.
  const [, setTick] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  // Inicjalizacja ukladu przy zmianie modelu.
  useEffect(() => {
    const groups = model.groups.map((g) => g.key)
    const sim: SimNode[] = model.nodes.map((n, i) => {
      const gi = Math.max(0, groups.indexOf(n.group))
      const ring = n.kind === 'hub' ? 60 : 150
      const ang =
        (gi / Math.max(1, groups.length)) * Math.PI * 2 +
        seeded(i) * 0.9
      return {
        ...n,
        x: Math.cos(ang) * ring + (seeded(i * 3) - 0.5) * 40,
        y: Math.sin(ang) * ring + (seeded(i * 7) - 0.5) * 40,
        vx: 0,
        vy: 0,
        fixed: false,
      }
    })
    simRef.current = sim
    byId.current = new Map(sim.map((s) => [s.id, s]))

    // Reset warstwy zycia dla nowego modelu.
    edgeRefs.current = new Array(model.links.length).fill(null)
    edgeCtrl.current = new Array(model.links.length)
    impulsesRef.current = new Array(IMPULSE_MAX).fill(null)
    edgePhaseRef.current = model.links.map((_, i) => seeded(i * 5 + 1) * TAU)
    timeRef.current = 0
    lastSpawnRef.current = 0

    fitView(true)

    const reduced = prefersReducedMotion()
    if (reduced) {
      for (let i = 0; i < 480; i++) step()
      fitView(true)
      setTick((t) => t + 1)
      // Krawedzie sa malowane imperatywnie => jednorazowy paint po commicie.
      const once = requestAnimationFrame(() => paintEdges())
      return () => cancelAnimationFrame(once)
    }

    let frames = 0
    const loop = () => {
      let energy = 0
      for (let s = 0; s < 2; s++) energy = step()
      fitView(false)
      paintEdges() // krawedzie sledza wezly podczas ustawiania ukladu
      frames++
      setTick((t) => t + 1)
      // Zatrzymanie po ustabilizowaniu lub twardy limit klatek.
      if (energy > 0.03 * simRef.current.length && frames < 600) {
        rafRef.current = requestAnimationFrame(loop)
      } else {
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(loop)

    // Warstwa zycia (falowanie + impulsy) niezalezna od fizyki; pauza gdy
    // karta w tle (document.hidden) lub graf poza ekranem (IntersectionObserver).
    const onVis = () => {
      if (document.hidden) stopLife()
      else if (visibleRef.current) startLife()
    }
    document.addEventListener('visibilitychange', onVis)

    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      io = new IntersectionObserver(
        (entries) => {
          const vis = entries.some((e) => e.isIntersecting)
          visibleRef.current = vis
          if (vis && !document.hidden) startLife()
          else stopLife()
        },
        { threshold: 0 },
      )
      io.observe(containerRef.current)
    } else {
      visibleRef.current = true
    }
    startLife()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      stopLife()
      document.removeEventListener('visibilitychange', onVis)
      if (io) io.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model])

  /** Jeden krok symulacji. Zwraca energie kinetyczna (suma v^2). */
  function step(): number {
    const nodes = simRef.current
    const n = nodes.length
    // Odpychanie (Coulomb) - kazda para.
    for (let i = 0; i < n; i++) {
      const a = nodes[i]
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) {
          dx = (seeded(i + j) - 0.5) * 2
          dy = (seeded(i * j + 1) - 0.5) * 2
          d2 = dx * dx + dy * dy || 1
        }
        const d = Math.sqrt(d2)
        // Wieksze wezly odpychaja mocniej.
        const rep = (1700 * (a.size + b.size)) / 24 / d2
        const fx = (dx / d) * rep
        const fy = (dy / d) * rep
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }
    }
    // Sprezyny (krawedzie).
    for (const l of model.links) {
      const a = byId.current.get(l.source)
      const b = byId.current.get(l.target)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const rest = REST_LEN[l.kind]
      const f = 0.018 * (d - rest)
      const fx = (dx / d) * f
      const fy = (dy / d) * f
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }
    // Grawitacja do srodka + tlumienie + integracja.
    let energy = 0
    for (const s of nodes) {
      if (s.fixed) {
        s.vx = 0
        s.vy = 0
        continue
      }
      s.vx += -s.x * 0.009
      s.vy += -s.y * 0.009
      s.vx *= 0.86
      s.vy *= 0.86
      // Ograniczenie predkosci (stabilnosc).
      const v = Math.sqrt(s.vx * s.vx + s.vy * s.vy)
      if (v > 30) {
        s.vx = (s.vx / v) * 30
        s.vy = (s.vy / v) * 30
      }
      s.x += s.vx
      s.y += s.vy
      energy += s.vx * s.vx + s.vy * s.vy
    }
    return energy
  }

  /** Dopasowuje viewBox do zasiegu wezlow (z marginesem), z opcjonalnym lerp. */
  function fitView(instant: boolean) {
    const nodes = simRef.current
    if (nodes.length === 0) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const s of nodes) {
      minX = Math.min(minX, s.x - s.size)
      minY = Math.min(minY, s.y - s.size)
      maxX = Math.max(maxX, s.x + s.size)
      maxY = Math.max(maxY, s.y + s.size)
    }
    const pad = 60
    const tx = minX - pad
    const ty = minY - pad
    const tw = Math.max(200, maxX - minX + pad * 2)
    const th = Math.max(200, maxY - minY + pad * 2)
    const cur = viewRef.current
    const k = instant ? 1 : 0.16
    cur.x += (tx - cur.x) * k
    cur.y += (ty - cur.y) * k
    cur.w += (tw - cur.w) * k
    cur.h += (th - cur.h) * k
  }

  // --- Warstwa "zycia": imperatywne malowanie krawedzi i impulsow ---

  /** Przelicza 'd' wszystkich krawedzi (wstega + falowanie) prosto na DOM. */
  function paintEdges() {
    const links = model.links
    const amp = prefersReducedMotion() ? 0 : WAVE_AMP
    const time = timeRef.current
    const phases = edgePhaseRef.current
    for (let i = 0; i < links.length; i++) {
      const el = edgeRefs.current[i]
      if (!el) continue
      const l = links[i]
      const a = byId.current.get(l.source)
      const b = byId.current.get(l.target)
      if (!a || !b) {
        el.setAttribute('d', '')
        continue
      }
      const st = LINK_STYLE[l.kind]
      const { cx, cy } = edgeControl(a.x, a.y, b.x, b.y, phases[i] ?? 0, time, amp)
      edgeCtrl.current[i] = { cx, cy, ax: a.x, ay: a.y, bx: b.x, by: b.y }
      const wEnd = st.w * 1.5 + 1.2
      const wMid = st.w * 0.4 + 0.2
      el.setAttribute(
        'd',
        ribbonPath(a.x, a.y, cx, cy, b.x, b.y, wEnd, wMid, EDGE_SAMPLES),
      )
    }
  }

  /** Odpala impuls na losowej krawedzi, jesli jest wolny slot w puli. */
  function spawnImpulse() {
    const links = model.links
    if (links.length === 0) return
    let slot = -1
    for (let k = 0; k < IMPULSE_MAX; k++) {
      if (!impulsesRef.current[k]) {
        slot = k
        break
      }
    }
    if (slot === -1) return
    const i = Math.floor(Math.random() * links.length)
    const l = links[i]
    const a = byId.current.get(l.source)
    if (!a || !byId.current.get(l.target)) return
    impulsesRef.current[slot] = {
      edge: i,
      t: 0,
      speed: 0.6 + Math.random() * 0.5,
      color: a.color,
    }
  }

  /** Przesuwa i maluje impulsy wzdluz ich krawedzi; gasnie po dojsciu do konca. */
  function paintImpulses(dt: number) {
    for (let k = 0; k < IMPULSE_MAX; k++) {
      const c = impulseRefs.current[k]
      if (!c) continue
      const imp = impulsesRef.current[k]
      if (!imp) {
        c.setAttribute('opacity', '0')
        continue
      }
      imp.t += imp.speed * dt
      const ec = edgeCtrl.current[imp.edge]
      if (imp.t >= 1 || !ec) {
        impulsesRef.current[k] = null
        c.setAttribute('opacity', '0')
        continue
      }
      const p = quadPoint(ec.ax, ec.ay, ec.cx, ec.cy, ec.bx, ec.by, imp.t)
      // Jasnosc narasta i gasnie (dzwon) => impuls "przeplywa".
      const fade = Math.sin(imp.t * Math.PI)
      c.setAttribute('cx', p.x.toFixed(2))
      c.setAttribute('cy', p.y.toFixed(2))
      c.setAttribute('fill', imp.color)
      c.setAttribute('opacity', (fade * 0.9).toFixed(3))
    }
  }

  /** Zatrzymuje pętlę zycia (pauza gdy karta/graf niewidoczne, sprzatanie). */
  function stopLife() {
    if (lifeRafRef.current != null) {
      cancelAnimationFrame(lifeRafRef.current)
      lifeRafRef.current = null
    }
  }

  /** Jedna klatka warstwy zycia (throttlowana ~30 fps, pauzowana gdy niewidoczne). */
  function life(now: number) {
    if (typeof document !== 'undefined' && document.hidden) {
      lifeRafRef.current = null
      return
    }
    if (!visibleRef.current) {
      lifeRafRef.current = null
      return
    }
    const elapsed = now - lastFrameRef.current
    if (elapsed < LIFE_FRAME_MS) {
      lifeRafRef.current = requestAnimationFrame(life)
      return
    }
    const dt = Math.min(0.05, elapsed / 1000)
    lastFrameRef.current = now
    timeRef.current += dt
    if (now - lastSpawnRef.current > SPAWN_MS) {
      spawnImpulse()
      lastSpawnRef.current = now
    }
    paintEdges()
    paintImpulses(dt)
    lifeRafRef.current = requestAnimationFrame(life)
  }

  /** Startuje pętlę zycia (nic nie robi przy reduced-motion lub gdy juz biegnie). */
  function startLife() {
    if (prefersReducedMotion()) return
    if (lifeRafRef.current != null) return
    lastFrameRef.current = performance.now()
    lifeRafRef.current = requestAnimationFrame(life)
  }

  // --- Przeciaganie wezlow ---
  const toLogical = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const loc = pt.matrixTransform(ctm.inverse())
    return { x: loc.x, y: loc.y }
  }, [])

  const movedRef = useRef(false)

  const onNodePointerDown = (e: ReactPointerEvent, id: string) => {
    e.stopPropagation()
    const node = byId.current.get(id)
    if (!node) return
    draggingId.current = id
    movedRef.current = false
    node.fixed = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const id = draggingId.current
    if (!id) return
    const node = byId.current.get(id)
    const p = toLogical(e.clientX, e.clientY)
    if (!node || !p) return
    // Odroznij realne przeciaganie od zwyklego klikniecia.
    if (Math.abs(node.x - p.x) > 1.5 || Math.abs(node.y - p.y) > 1.5) {
      movedRef.current = true
    }
    node.x = p.x
    node.y = p.y
    node.vx = 0
    node.vy = 0
    // Krawedzie sledza wezel od razu (dziala tez przy reduced-motion).
    paintEdges()
    // Ozyw symulacje, jesli stoi.
    if (rafRef.current === null && !prefersReducedMotion()) {
      const loop = () => {
        let energy = 0
        for (let s = 0; s < 2; s++) energy = step()
        fitView(false)
        paintEdges()
        setTick((t) => t + 1)
        if (draggingId.current || energy > 0.03 * simRef.current.length) {
          rafRef.current = requestAnimationFrame(loop)
        } else {
          rafRef.current = null
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    setTick((t) => t + 1)
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const id = draggingId.current
    if (id) {
      const node = byId.current.get(id)
      if (node) node.fixed = false
    }
    draggingId.current = null
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  const reduced = prefersReducedMotion()
  const view = viewRef.current
  const nodes = simRef.current
  const highlight = hovered
  const hoverNeighbors = highlight ? neighbors.get(highlight) : null

  const isDim = (id: string): boolean => {
    if (!highlight) return false
    if (id === highlight) return false
    return !(hoverNeighbors?.has(id) ?? false)
  }

  const isEdgeActive = (source: string, target: string): boolean => {
    if (!highlight) return false
    return source === highlight || target === highlight
  }

  return (
    <div ref={containerRef} className="relative flex h-full min-h-0 flex-col">
      {/* Winieta tla: rozjasnia srodek, przyciemnia rogi (glebia, fokus na wezly) */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 40%, rgba(91,141,239,0.06), transparent 60%), radial-gradient(80% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.45))',
        }}
        aria-hidden
      />

      <svg
        ref={svgRef}
        role="img"
        aria-label="Graf wiedzy mozgu firmy: pliki, persony i notatki jako siec powiazan"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="relative z-[1] h-full w-full touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          {/* Poswiata wezlow (glebia) */}
          <filter
            id="wezelGlow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
          {/* Miekki blask swietlnego impulsu */}
          <filter
            id="impulseGlow"
            x="-200%"
            y="-200%"
            width="500%"
            height="500%"
          >
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          {/* Gradient wypelnienia hubow: jadro neuronu (mocny rdzen -> gasnie) */}
          {model.groups.map((g) => (
            <radialGradient key={g.key} id={`hubgrad-${g.key}`}>
              <stop offset="0%" stopColor={g.color} stopOpacity={0.6} />
              <stop offset="45%" stopColor={g.color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={g.color} stopOpacity={0.05} />
            </radialGradient>
          ))}
        </defs>

        {/* Krawedzie: wstegi o zmiennej grubosci (grubsze przy wezlach), falujace
            w czasie i malowane imperatywnie w warstwie zycia (atrybut 'd'). */}
        <g>
          {model.links.map((l, i) => {
            const a = byId.current.get(l.source)
            const b = byId.current.get(l.target)
            if (!a || !b) return null
            const st = LINK_STYLE[l.kind]
            const active = isEdgeActive(l.source, l.target)
            const dim = highlight && !active
            const fill = active ? '#93b4f4' : '#5b6472'
            return (
              <path
                key={i}
                ref={(el) => {
                  edgeRefs.current[i] = el
                }}
                fill={fill}
                fillOpacity={dim ? 0.05 : active ? 0.85 : st.o}
                className="pointer-events-none"
              />
            )
          })}
        </g>

        {/* Impulsy: pula kropek (max IMPULSE_MAX) pozycjonowana w warstwie zycia */}
        <g className="pointer-events-none">
          {Array.from({ length: IMPULSE_MAX }).map((_, k) => (
            <circle
              key={k}
              ref={(el) => {
                impulseRefs.current[k] = el
              }}
              r={2.6}
              fill="#93b4f4"
              opacity={0}
              filter="url(#impulseGlow)"
            />
          ))}
        </g>

        {/* Wezly */}
        <g>
          {nodes.map((s, ni) => {
            const dim = isDim(s.id)
            const breathing =
              !reduced && activeGroup != null && s.group === activeGroup
            const selected = s.id === selectedId
            const isHovered = s.id === highlight
            // Miekka, oddychajaca poswiata z rozna faza per wezel (tkanka zyje).
            const glowStyle: CSSProperties = reduced
              ? { opacity: s.kind === 'hub' ? 0.22 : 0.16 }
              : ({
                  animationDelay: `${(seeded(ni * 13 + 7) * 4).toFixed(2)}s`,
                  '--glow-min': s.kind === 'hub' ? '0.18' : '0.1',
                  '--glow-max': s.kind === 'hub' ? '0.34' : '0.22',
                } as CSSProperties)
            // Miniatura postaci w wezle persony (wektorowy portret, spojny
            // z reszta aplikacji). Brak karty postaci => inicjaly jak dotad.
            const agentPersony =
              s.kind === 'persona' ? personaAgent(s) : undefined
            const zPortretem =
              agentPersony != null &&
              getCharacter(agentPersony.slug) != null
            const showLabel =
              s.kind === 'hub' ||
              s.kind === 'persona' ||
              s.kind === 'file' ||
              s.id === highlight ||
              (hoverNeighbors?.has(s.id) ?? false)
            return (
              <g
                key={s.id}
                transform={`translate(${s.x} ${s.y})`}
                style={{ cursor: 'pointer' }}
                opacity={dim ? 0.2 : 1}
                onPointerDown={(e) => onNodePointerDown(e, s.id)}
                onPointerEnter={() => {
                  setHovered(s.id)
                  setActiveGroup(s.group)
                }}
                onPointerLeave={() => {
                  setHovered((h) => (h === s.id ? null : h))
                }}
                onClick={() => {
                  // Klik = podglad w panelu; ignoruj jesli to bylo przeciaganie.
                  if (movedRef.current) return
                  onSelect(s)
                }}
              >
                {/* Pierscien wyboru */}
                {selected && (
                  <circle
                    r={s.size + 5}
                    fill="none"
                    stroke="#f4f4f5"
                    strokeWidth={1.6}
                    strokeOpacity={0.85}
                    className="pointer-events-none"
                  />
                )}

                {/* Delikatna obwodka: plik nadpisany lokalnie (amber) lub wlasny (kreskowana) */}
                {s.kind === 'file' && (s.zmieniony || s.wlasny) && (
                  <circle
                    r={s.size + 3}
                    fill="none"
                    stroke={s.zmieniony ? '#F59E0B' : s.color}
                    strokeWidth={1}
                    strokeOpacity={0.55}
                    strokeDasharray={
                      s.wlasny && !s.zmieniony ? '2.5 3' : undefined
                    }
                    className="pointer-events-none"
                  />
                )}

                {/* Rozszerzajace sie halo przy hover (jak rozblysk neuronu) */}
                {isHovered && (
                  <circle
                    r={s.size + 6}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={1.4}
                    strokeOpacity={0.5}
                    className={
                      reduced
                        ? 'pointer-events-none'
                        : 'graph-hover-halo pointer-events-none'
                    }
                  />
                )}

                {/* Miekka, oddychajaca poswiata pod wezlem (glebia + zycie) */}
                <circle
                  r={s.size * 1.7}
                  fill={s.color}
                  filter="url(#wezelGlow)"
                  className={
                    reduced
                      ? 'pointer-events-none'
                      : 'graph-glow pointer-events-none'
                  }
                  style={glowStyle}
                />

                {/* Glowne kolo wezla; przy portrecie persony robi za ring-aure */}
                <circle
                  r={s.size}
                  fill={
                    zPortretem
                      ? '#0E0E11'
                      : s.kind === 'hub'
                        ? `url(#hubgrad-${s.group})`
                        : s.color
                  }
                  fillOpacity={
                    zPortretem
                      ? 1
                      : s.kind === 'hub'
                        ? 1
                        : s.kind === 'persona'
                          ? 0.9
                          : s.kind === 'note'
                            ? 0.7
                            : 0.85
                  }
                  stroke={s.color}
                  strokeWidth={s.kind === 'hub' ? 2 : 1.5}
                  strokeOpacity={0.9}
                  className={breathing ? 'graph-breath' : undefined}
                />

                {/* Miniatura postaci (portret wektorowy przyciety do kola) */}
                {zPortretem && agentPersony && (
                  <foreignObject
                    x={-s.size + 1}
                    y={-s.size + 1}
                    width={s.size * 2 - 2}
                    height={s.size * 2 - 2}
                    className="pointer-events-none"
                    style={{ pointerEvents: 'none' }}
                  >
                    <div className="relative h-full w-full overflow-hidden rounded-full">
                      <CharacterAvatar
                        agent={agentPersony}
                        px={s.size * 2}
                        shape="circle"
                      />
                    </div>
                  </foreignObject>
                )}

                {/* Inicjaly w personach bez karty postaci (fallback) */}
                {s.kind === 'persona' && !zPortretem && (
                  <text
                    textAnchor="middle"
                    y={3}
                    fontSize={8}
                    fontWeight={700}
                    fill="#09090b"
                    className="pointer-events-none select-none"
                  >
                    {personaInicjaly(s)}
                  </text>
                )}

                {showLabel && (
                  <text
                    x={s.size + 5}
                    y={3.5}
                    fontSize={s.kind === 'hub' ? 11 : 9.5}
                    fontWeight={s.kind === 'hub' ? 700 : 600}
                    fill={
                      s.kind === 'hub' ||
                      s.id === highlight ||
                      (hoverNeighbors?.has(s.id) ?? false)
                        ? '#f4f4f5'
                        : '#d4d4d8'
                    }
                    className="pointer-events-none"
                    style={{ paintOrder: 'stroke' }}
                    stroke="#09090b"
                    strokeWidth={2.8}
                    strokeOpacity={0.7}
                  >
                    {s.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Legenda grup jako pigulki z opisem (tooltip) */}
      <div className="relative z-[1] flex flex-wrap items-center gap-2 border-t border-zinc-800 px-1 pt-3">
        {model.groups.map((g) => {
          const aktywna = activeGroup === g.key
          return (
            <button
              key={g.key}
              type="button"
              title={GROUP_OPIS[g.key] ?? g.label}
              onPointerEnter={() => setActiveGroup(g.key)}
              onPointerLeave={() => setActiveGroup(null)}
              onClick={() => {
                const hub = model.nodes.find((n) => n.id === `hub:${g.key}`)
                if (hub) onSelect(hub)
              }}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                aktywna
                  ? 'bg-zinc-800/70 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200',
              ].join(' ')}
              style={{ borderColor: aktywna ? g.color : `${g.color}44` }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: g.color }}
                aria-hidden
              />
              {g.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

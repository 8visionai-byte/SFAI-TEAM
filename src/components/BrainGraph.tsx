import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  buildBrainGraph,
  type BrainGraphModel,
  type GraphNode,
  type LinkKind,
} from '../lib/brainGraph'
import type { Notatka } from '../lib/storage'

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
  /** Notatki uzytkownika (localStorage) do wpiecia w graf. */
  notatki: Notatka[]
  /** Klik na wezel-plik: otwiera jego podglad w zakladce Baza wiedzy. */
  onOpenFile: (path: string) => void
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

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Deterministyczny pseudo-random (zeby uklad startowy byl stabilny). */
function seeded(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

export default function BrainGraph({ notatki, onOpenFile }: Props) {
  const model: BrainGraphModel = useMemo(
    () => buildBrainGraph(notatki),
    [notatki],
  )

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
  const draggingId = useRef<string | null>(null)
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

    fitView(true)

    const reduced = prefersReducedMotion()
    if (reduced) {
      for (let i = 0; i < 480; i++) step()
      fitView(true)
      setTick((t) => t + 1)
      return
    }

    let frames = 0
    const loop = () => {
      let energy = 0
      for (let s = 0; s < 2; s++) energy = step()
      fitView(false)
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

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
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

  const onNodePointerDown = (e: ReactPointerEvent, id: string) => {
    e.stopPropagation()
    const node = byId.current.get(id)
    if (!node) return
    draggingId.current = id
    node.fixed = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const id = draggingId.current
    if (!id) return
    const node = byId.current.get(id)
    const p = toLogical(e.clientX, e.clientY)
    if (!node || !p) return
    node.x = p.x
    node.y = p.y
    node.vx = 0
    node.vy = 0
    // Ozyw symulacje, jesli stoi.
    if (rafRef.current === null && !prefersReducedMotion()) {
      const loop = () => {
        let energy = 0
        for (let s = 0; s < 2; s++) energy = step()
        fitView(false)
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
    <div className="flex h-full min-h-0 flex-col">
      <svg
        ref={svgRef}
        role="img"
        aria-label="Graf wiedzy mozgu firmy: pliki, persony i notatki jako siec powiazan"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="h-full w-full touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Krawedzie */}
        <g>
          {model.links.map((l, i) => {
            const a = byId.current.get(l.source)
            const b = byId.current.get(l.target)
            if (!a || !b) return null
            const st = LINK_STYLE[l.kind]
            const active = isEdgeActive(l.source, l.target)
            const dim = highlight && !active
            const stroke = active ? '#93b4f4' : '#52525b'
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={stroke}
                strokeWidth={active ? st.w + 0.6 : st.w}
                strokeOpacity={dim ? 0.06 : active ? 0.9 : st.o}
                strokeDasharray={l.kind === 'reads' ? '3 4' : undefined}
              />
            )
          })}
        </g>

        {/* Wezly */}
        <g>
          {nodes.map((s) => {
            const dim = isDim(s.id)
            const breathing =
              !reduced && activeGroup != null && s.group === activeGroup
            const clickable = s.kind === 'file'
            return (
              <g
                key={s.id}
                transform={`translate(${s.x} ${s.y})`}
                style={{ cursor: clickable ? 'pointer' : 'grab' }}
                opacity={dim ? 0.18 : 1}
                onPointerDown={(e) => onNodePointerDown(e, s.id)}
                onPointerEnter={() => {
                  setHovered(s.id)
                  setActiveGroup(s.group)
                }}
                onPointerLeave={() => {
                  setHovered((h) => (h === s.id ? null : h))
                }}
                onClick={() => {
                  if (s.kind === 'file' && s.path) onOpenFile(s.path)
                }}
              >
                <circle
                  r={s.size}
                  fill={s.color}
                  fillOpacity={
                    s.kind === 'hub' ? 0.22 : s.kind === 'note' ? 0.7 : 0.85
                  }
                  stroke={s.color}
                  strokeWidth={s.kind === 'hub' ? 2 : 1.5}
                  strokeOpacity={0.9}
                  className={breathing ? 'graph-breath' : undefined}
                />
                {(s.kind === 'hub' ||
                  s.kind === 'persona' ||
                  s.kind === 'file' ||
                  s.id === highlight ||
                  (hoverNeighbors?.has(s.id) ?? false)) && (
                  <text
                    x={s.size + 4}
                    y={3.5}
                    fontSize={s.kind === 'hub' ? 11 : 9.5}
                    fontWeight={s.kind === 'hub' ? 700 : 500}
                    fill={
                      s.kind === 'hub' || s.id === highlight
                        ? '#f4f4f5'
                        : '#a1a1aa'
                    }
                    className="pointer-events-none"
                    style={{ paintOrder: 'stroke' }}
                    stroke="#09090b"
                    strokeWidth={2.6}
                    strokeOpacity={0.65}
                  >
                    {s.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Legenda grup */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-800 px-1 pt-3">
        {model.groups.map((g) => (
          <button
            key={g.key}
            type="button"
            onPointerEnter={() => setActiveGroup(g.key)}
            onPointerLeave={() => setActiveGroup(null)}
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors',
              activeGroup === g.key
                ? 'bg-zinc-800/70 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200',
            ].join(' ')}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: g.color }}
              aria-hidden
            />
            {g.label}
          </button>
        ))}
      </div>
    </div>
  )
}

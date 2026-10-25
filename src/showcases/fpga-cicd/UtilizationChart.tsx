import { useEffect, useRef, useState } from "react"

type Props = {
  history: number[]
  capacity: number
  slots: number
  tickSeconds: number
}

const HEIGHT = 180
const PAD = { top: 16, right: 12, bottom: 22, left: 32 }

export default function UtilizationChart({ history, capacity, slots, tickSeconds }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const innerW = Math.max(width - PAD.left - PAD.right, 10)
  const innerH = HEIGHT - PAD.top - PAD.bottom
  // Fixed-width window: the newest sample sits at the right edge.
  const offset = slots - history.length
  const x = (i: number) => PAD.left + ((i + offset) / (slots - 1)) * innerW
  const y = (v: number) => PAD.top + innerH - (v / capacity) * innerH

  const line = history.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")
  const area = history.length > 1 ? `${line}L${x(history.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : ""
  const ticks = [0, Math.round(capacity / 2), capacity]

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = Math.round(((px - PAD.left) / innerW) * (slots - 1)) - offset
    setHover(i >= 0 && i < history.length ? i : null)
  }

  const latest = history[history.length - 1] ?? 0
  const hv = hover !== null ? history[hover] : null
  const hx = hover !== null ? x(hover) : 0

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Busy runners</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          now {latest} / {capacity} · {Math.round((latest / capacity) * 100)}% utilization
        </span>
      </figcaption>
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          className="block touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Busy runners over the last ${history.length} samples. Currently ${latest} of ${capacity}.`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-border"
                strokeDasharray={t === capacity ? "4 4" : undefined}
              />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                {t}
              </text>
            </g>
          ))}
          <text x={width - PAD.right} y={y(capacity) - 5} textAnchor="end" className="fill-muted-foreground text-[10px]">
            capacity
          </text>
          <text x={PAD.left} y={HEIGHT - 4} className="fill-muted-foreground text-[10px]">
            −{Math.round(slots * tickSeconds)}s
          </text>
          <text x={width - PAD.right} y={HEIGHT - 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
            now
          </text>
          {area && <path d={area} fill="var(--viz-series-soft)" />}
          {history.length > 1 && (
            <path d={line} fill="none" stroke="var(--viz-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {hv !== null && (
            <g>
              <line x1={hx} x2={hx} y1={PAD.top} y2={y(0)} className="stroke-muted-foreground/50" />
              <circle cx={hx} cy={y(hv)} r={4} fill="var(--viz-series)" className="stroke-card" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hv !== null && hover !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm"
            style={{ left: Math.min(Math.max(hx - 60, 0), width - 130) }}
          >
            <span className="font-medium tabular-nums">{hv} busy</span>
            <span className="text-muted-foreground"> · {((history.length - 1 - hover) * tickSeconds).toFixed(1)}s ago</span>
          </div>
        )}
      </div>
    </figure>
  )
}

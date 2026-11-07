// The "mood ribbon": valence over time as a monotone curve with teal/coral fills split exactly at neutral,
// glowing dots at mood switches, a moments lane on the same time axis, and a hover scrubber.
// It draws chart-ready samples (filtered + smoothed by the caller); raw data stays in the data layer.
import { useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { area, curveMonotoneX, line } from 'd3-shape'
import { scaleLinear, scaleTime } from 'd3-scale'
import { labelFor, type Timeline } from '../../data'
import type { ContextLabel, EmotionSample, MoodSwitch } from '../../types/contracts'
import { useElementWidth, useFontsReady } from '../../hooks/useElementWidth'
import { useNow } from '../../hooks/useNow'
import { capitalize, formatClock, formatValence, isLive } from '../../lib/format'
import { layoutLane } from '../../lib/laneLayout'
import { emotionTone, nearestSample, toneVar } from '../../lib/mood'
import { PulseDot } from '../LivePill'
import MomentChip from './MomentChip'
import ClusterChip, { clusterChipWidth } from './ClusterChip'

// Geometry (px). Everything sits on a 4 px grid.
const CHART_H = 340
const PAD_TOP = 24
const PAD_BOTTOM = 20
const LEFT = 32
const RIGHT = 16
const LANE_GAP = 20
const ROW_PITCH = 36
const AXIS_H = 32
const EASE = [0.22, 1, 0.36, 1] as const

interface Props {
  timeline: Timeline
  /** Chart-ready samples: low-confidence dropped and smoothed. */
  samples: EmotionSample[]
  highlightId: string | null
  onHighlight: (id: string | null) => void
  onSelect: (id: string) => void
}

export default function MoodRibbon(props: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  return (
    <div ref={ref} className="w-full">
      {props.samples.length === 0 ? (
        <EmptyRibbon rawCount={props.timeline.samples.length} />
      ) : (
        width > 0 && <Ribbon key={props.timeline.session.id} width={width} {...props} />
      )}
    </div>
  )
}

function Ribbon({ width, timeline, samples, highlightId, onHighlight, onSelect }: Props & { width: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const reduce = useReducedMotion()
  const fontsReady = useFontsReady()
  const { session, switches } = timeline
  const live = isLive(session)
  const now = useNow(live)

  // A live session runs up to now (or the newest reading, if the clock is behind it).
  const lastTs = timeline.samples.length ? timeline.samples[timeline.samples.length - 1].ts : session.start
  const endTs = session.end ?? Math.max(now, lastTs)

  // Scales
  const x = useMemo(
    () => scaleTime().domain([new Date(session.start * 1000), new Date(endTs * 1000)]).range([LEFT, width - RIGHT]),
    [session.start, endTs, width]
  )
  const y = useMemo(() => scaleLinear().domain([-1, 1]).range([CHART_H - PAD_BOTTOM, PAD_TOP]), [])
  const px = (ts: number) => x(new Date(ts * 1000))
  const zeroY = y(0)

  // Paths
  const linePath = useMemo(
    () => line<EmotionSample>().x((d) => px(d.ts)).y((d) => y(d.valence)).curve(curveMonotoneX)(samples) ?? '',
    [samples, x, y]
  )
  const areaPath = useMemo(
    () =>
      area<EmotionSample>().x((d) => px(d.ts)).y0(zeroY).y1((d) => y(d.valence)).curve(curveMonotoneX)(samples) ?? '',
    [samples, x, y]
  )

  // Exact y of the drawn curve at any x (binary search along the path), so dots sit on the line.
  const measureRef = useRef<SVGPathElement>(null)
  const [curveY, setCurveY] = useState<(atX: number) => number>(() => () => zeroY)
  useLayoutEffect(() => {
    const p = measureRef.current
    if (!p) return
    const total = p.getTotalLength()
    setCurveY(() => (atX: number) => {
      let lo = 0
      let hi = total
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2
        if (p.getPointAtLength(mid).x < atX) lo = mid
        else hi = mid
      }
      return p.getPointAtLength((lo + hi) / 2).y
    })
  }, [linePath])

  // Moments lane: measure single chips, then pack into ≤ 2 rows, clustering whatever can't fit.
  const chipEls = useRef(new Map<string, HTMLElement>())
  const [chipW, setChipW] = useState<Record<string, number>>({})
  useLayoutEffect(() => {
    const next: Record<string, number> = {}
    chipEls.current.forEach((el, id) => {
      if (Math.abs((chipW[id] ?? 0) - el.offsetWidth) > 0.5) next[id] = el.offsetWidth
    })
    if (Object.keys(next).length) setChipW((prev) => ({ ...prev, ...next }))
  })

  const groups = useMemo(
    () =>
      layoutLane(switches, {
        xOf: (sw) => px(sw.ts),
        singleWidth: (sw) => chipW[sw.id] ?? estimateChipWidth(sw, labelFor(timeline, sw.id)),
        clusterWidth: clusterChipWidth,
        minLeft: LEFT - 8,
        maxRight: width - RIGHT
      }),
    [switches, chipW, x, width, fontsReady, timeline]
  )

  const rows = Math.max(1, ...groups.map((g) => g.row + 1))
  const laneTop = CHART_H + LANE_GAP
  const axisTop = laneTop + rows * ROW_PITCH
  const totalH = axisTop + AXIS_H

  // Hover scrubber
  const [hoverX, setHoverX] = useState<number | null>(null)
  const nearRef = useRef<string | null>(null)
  const setNear = (id: string | null) => {
    if (nearRef.current === id) return
    nearRef.current = id
    onHighlight(id)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    if (my > CHART_H || mx < LEFT || mx > width - RIGHT) {
      setHoverX(null)
      setNear(null)
      return
    }
    setHoverX(mx)
    const near = switches.find((sw) => Math.abs(px(sw.ts) - mx) <= 10)
    setNear(near ? near.id : null)
  }
  const onLeave = () => {
    setHoverX(null)
    setNear(null)
  }

  const hovered = hoverX !== null ? nearestSample(samples, x.invert(hoverX).getTime() / 1000) : undefined

  // A few round-time ticks only: thin d3's suggestion down to at most 6 (4 on narrow widths).
  const maxTicks = width > 900 ? 6 : 4
  const rawTicks = x.ticks(maxTicks)
  const every = Math.ceil(rawTicks.length / maxTicks)
  const ticks = rawTicks.filter((_, i) => i % every === 0)

  const last = samples[samples.length - 1]

  return (
    <div className="relative select-none" style={{ height: totalH }} onPointerMove={onMove} onPointerLeave={onLeave}>
      <svg width={width} height={totalH} className="absolute inset-0 overflow-visible" aria-label="Mood over time">
        <defs>
          <linearGradient id={`up${uid}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={y(1)} y2={zeroY}>
            <stop offset="0" stopColor="var(--positive)" stopOpacity="0.34" />
            <stop offset="1" stopColor="var(--positive)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`down${uid}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={zeroY} y2={y(-1)}>
            <stop offset="0" stopColor="var(--negative)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--negative)" stopOpacity="0.34" />
          </linearGradient>
          <clipPath id={`above${uid}`}>
            <rect x="0" y="0" width={width} height={zeroY} />
          </clipPath>
          <clipPath id={`below${uid}`}>
            <rect x="0" y={zeroY} width={width} height={CHART_H - zeroY} />
          </clipPath>
          <filter id={`glow${uid}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        <NeutralScale y={y} width={width} />

        {/* Fills, split exactly at neutral */}
        <motion.g
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
        >
          <path d={areaPath} fill={`url(#up${uid})`} clipPath={`url(#above${uid})`} />
          <path d={areaPath} fill={`url(#down${uid})`} clipPath={`url(#below${uid})`} />
        </motion.g>

        {/* The curve, teal above neutral and coral below; draws itself in */}
        {(['above', 'below'] as const).map((side) => (
          <motion.path
            key={side}
            d={linePath}
            fill="none"
            stroke={side === 'above' ? 'var(--positive)' : 'var(--negative)'}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath={`url(#${side}${uid})`}
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        ))}
        <path ref={measureRef} d={linePath} fill="none" stroke="none" />

        {/* Scrubber */}
        {hoverX !== null && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={PAD_TOP - 12} y2={CHART_H} stroke="var(--hairline-strong)" />
            <circle cx={hoverX} cy={curveY(hoverX)} r={4} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.5} />
          </g>
        )}

        {/* Lane ticks: where each moment sits on the time axis */}
        {switches.map((sw) => (
          <line key={sw.id} x1={px(sw.ts)} x2={px(sw.ts)} y1={laneTop - 10} y2={laneTop - 4} stroke="var(--faint)" />
        ))}

        {/* Switch dots */}
        {switches.map((sw, i) => (
          <SwitchDot
            key={sw.id}
            cx={px(sw.ts)}
            cy={curveY(px(sw.ts))}
            color={toneVar(labelFor(timeline, sw.id)?.tone)}
            active={highlightId === sw.id}
            connectTo={laneTop - 10}
            glowId={`glow${uid}`}
            delay={reduce ? 0 : 0.55 + Math.min(i, 12) * 0.04}
            onEnter={() => onHighlight(sw.id)}
            onClick={() => onSelect(sw.id)}
          />
        ))}

        {/* Time axis */}
        {ticks.map((t) => (
          <text
            key={+t}
            x={x(t)}
            y={axisTop + 18}
            textAnchor="middle"
            className="font-mono"
            fontSize={11}
            fill="var(--muted)"
          >
            {formatClock(t.getTime() / 1000)}
          </text>
        ))}
      </svg>

      {/* Live: a pulsing dot where the newest reading is */}
      {live && last && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: px(last.ts), top: curveY(px(last.ts)) }}
        >
          <PulseDot />
        </span>
      )}

      {/* Moments lane (HTML so chips get real focus and hover states) */}
      {groups.map((g) => {
        const style = { left: g.left, top: laneTop + g.row * ROW_PITCH }
        if (g.members.length === 1) {
          const sw = g.members[0]
          return (
            <MomentChip
              key={g.key}
              ref={(el) => {
                if (el) chipEls.current.set(sw.id, el)
                else chipEls.current.delete(sw.id)
              }}
              sw={sw}
              label={labelFor(timeline, sw.id)}
              active={highlightId === sw.id}
              style={style}
              onHighlight={onHighlight}
              onSelect={onSelect}
            />
          )
        }
        return (
          <ClusterChip
            key={g.key}
            members={g.members}
            timeline={timeline}
            active={g.members.some((m) => m.id === highlightId)}
            highlightId={highlightId}
            style={style}
            bounds={width}
            onHighlight={onHighlight}
            onSelect={onSelect}
          />
        )
      })}

      {hovered && hoverX !== null && <Readout sample={hovered} x={hoverX} width={width} />}
    </div>
  )
}

/** Faint dashed neutral line with "+ 0 −" marks. */
function NeutralScale({ y, width }: { y: (v: number) => number; width: number }) {
  return (
    <>
      <line x1={LEFT} x2={width - RIGHT} y1={y(0)} y2={y(0)} stroke="var(--faint)" strokeDasharray="2 5" />
      {(
        [
          ['+', y(0.85)],
          ['0', y(0)],
          ['−', y(-0.85)]
        ] as const
      ).map(([t, ty]) => (
        <text key={t} x={8} y={ty} dy="0.35em" className="font-mono" fontSize={12} fill="var(--muted)">
          {t}
        </text>
      ))}
    </>
  )
}

/** Same frame as the ribbon, with a calm message instead of a curve. */
function EmptyRibbon({ rawCount }: { rawCount: number }) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const y = (v: number) => PAD_TOP + ((1 - v) / 2) * (CHART_H - PAD_TOP - PAD_BOTTOM)
  return (
    <div ref={ref} className="relative" style={{ height: CHART_H }}>
      {width > 0 && (
        <svg width={width} height={CHART_H} className="absolute inset-0" aria-hidden>
          <NeutralScale y={y} width={width} />
        </svg>
      )}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 bg-bg px-8 py-4 text-center">
        <span className="text-[15px] font-medium text-ink">
          {rawCount === 0 ? 'No mood readings in this session' : 'Mood readings were too uncertain to chart'}
        </span>
        <span className="max-w-md text-[13px] text-muted">
          {rawCount === 0
            ? 'The camera may have been paused, or no face was in view.'
            : 'The camera rarely had a clear view of your face, so nothing reliable can be shown.'}
        </span>
      </div>
    </div>
  )
}

function SwitchDot(p: {
  cx: number
  cy: number
  color: string
  active: boolean
  connectTo: number
  glowId: string
  delay: number
  onEnter: () => void
  onClick: () => void
}) {
  return (
    <motion.g
      initial={p.delay ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: p.delay, ease: EASE }}
      className="cursor-pointer"
      onPointerEnter={p.onEnter}
      onClick={p.onClick}
    >
      {p.active && (
        <line x1={p.cx} x2={p.cx} y1={p.cy + 10} y2={p.connectTo} stroke={p.color} strokeOpacity={0.55} strokeDasharray="2 3" />
      )}
      <circle cx={p.cx} cy={p.cy} r={p.active ? 14 : 10} fill={p.color} opacity={p.active ? 0.75 : 0.5} filter={`url(#${p.glowId})`} style={{ transition: 'r 150ms, opacity 150ms' }} />
      <circle cx={p.cx} cy={p.cy} r={p.active ? 5.5 : 4} fill={p.color} stroke="var(--bg)" strokeWidth={2} style={{ transition: 'r 150ms' }} />
      <circle cx={p.cx} cy={p.cy} r={14} fill="transparent" />
    </motion.g>
  )
}

function Readout({ sample, x, width }: { sample: EmotionSample; x: number; width: number }) {
  const flip = x > width - 200
  return (
    <div
      className="pointer-events-none absolute top-0 z-20 rounded-[var(--radius-md)] border border-hairline-strong bg-elevated px-3 py-2 shadow-[var(--shadow-pop)]"
      style={{ left: x, transform: `translateX(${flip ? 'calc(-100% - 12px)' : '12px'})` }}
    >
      <div className="font-mono text-[11px] text-muted">{formatClock(sample.ts, true)}</div>
      <div className="mt-1 flex items-center gap-2 text-[13px]">
        <span className="h-2 w-2 rounded-full" style={{ background: toneVar(emotionTone(sample.emotion)) }} />
        <span className="capitalize text-ink">{sample.emotion}</span>
        <span className="font-mono text-ink-2">{formatValence(sample.valence)}</span>
      </div>
    </div>
  )
}

/** First-render guess before a chip is measured (mono "from → to" + sans category + chrome). */
const estimateChipWidth = (sw: MoodSwitch, label: ContextLabel | undefined) =>
  62 + (sw.from.length + sw.to.length + 3) * 6.9 + (label ? capitalize(label.category) : 'Pending').length * 6.5

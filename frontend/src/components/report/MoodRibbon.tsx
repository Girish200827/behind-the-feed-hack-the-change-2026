// The "mood ribbon": valence over time as a monotone curve with teal/coral fills split exactly at neutral,
// glowing dots at mood switches, a moments lane on the same axis, and a hover scrubber.
// It takes one or more session segments. Several segments (the day view) sit side by side on a compressed
// axis with a small "2h 10m later" gap between them. Samples are chart-ready (filtered + smoothed by the caller)
// and are averaged into ~1.5 px buckets here so long sessions stay light to draw.
import { useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { area, curveMonotoneX, line } from 'd3-shape'
import { scaleLinear, scaleTime } from 'd3-scale'
import { labelFor, type Timeline } from '../../data'
import type { ContextLabel, EmotionSample, MoodSwitch } from '../../types/contracts'
import { useElementWidth, useFontsReady } from '../../hooks/useElementWidth'
import { useNow } from '../../hooks/useNow'
import { capitalize, formatClock, formatSpan, formatValence, isLive, platformName } from '../../lib/format'
import { layoutLane } from '../../lib/laneLayout'
import { monotoneSampler } from '../../lib/monotone'
import { emotionTone, toneVar } from '../../lib/mood'
import { PulseDot } from '../LivePill'
import PlatformIcon from '../PlatformIcon'
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
const SEG_HEADER_H = 28
const SEG_GAP = 56
const SEG_MIN_W = 64
const BUCKET_PX = 1.5
const EASE = [0.22, 1, 0.36, 1] as const

export interface RibbonSegment {
  timeline: Timeline
  /** Chart-ready samples: low-confidence dropped and smoothed. */
  samples: EmotionSample[]
}

interface Props {
  segments: RibbonSegment[]
  /** "session": one segment with a time axis. "day": segments side by side with headers and gaps. */
  mode: 'session' | 'day'
  highlightId: string | null
  onHighlight: (id: string | null) => void
  onSelect: (switchId: string, sessionId: string) => void
}

export default function MoodRibbon(props: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const empty = props.segments.every((s) => s.samples.length === 0)
  const key = props.segments.map((s) => s.timeline.session.id).join('|')
  return (
    <div ref={ref} className="w-full">
      {props.mode === 'session' && empty ? (
        <EmptyRibbon rawCount={props.segments[0]?.timeline.samples.length ?? 0} />
      ) : (
        width > 0 && <Ribbon key={key} width={width} {...props} />
      )}
    </div>
  )
}

interface Point {
  x: number
  v: number
  sample: EmotionSample
}

/** Averages samples falling in the same ~1.5 px column, so a 20 min session is ~1 point per column, not 1200. */
function bucket(samples: EmotionSample[], toX: (ts: number) => number): Point[] {
  const out: Point[] = []
  let key = NaN
  let sum = 0
  let n = 0
  let xs = 0
  let first: EmotionSample | undefined
  const flush = () => first && out.push({ x: xs / n, v: sum / n, sample: first })
  for (const s of samples) {
    const x = toX(s.ts)
    const k = Math.round(x / BUCKET_PX)
    if (k !== key) {
      flush()
      key = k
      sum = 0
      n = 0
      xs = 0
      first = s
    }
    sum += s.valence
    xs += x
    n++
  }
  flush()
  return out
}

function Ribbon({ width, segments, mode, highlightId, onHighlight, onSelect }: Props & { width: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const reduce = useReducedMotion()
  const fontsReady = useFontsReady()
  const live = segments.some((s) => isLive(s.timeline.session))
  const now = useNow(live)
  const top = mode === 'day' ? SEG_HEADER_H : 0
  const chartBottom = top + CHART_H

  const y = useMemo(() => scaleLinear().domain([-1, 1]).range([chartBottom - PAD_BOTTOM, top + PAD_TOP]), [top, chartBottom])
  const zeroY = y(0)

  // Each segment gets a minimum width plus a share of the rest proportional to its duration.
  const segs = useMemo(() => {
    const n = segments.length
    const avail = width - LEFT - RIGHT - SEG_GAP * (n - 1)
    const ranges = segments.map(({ timeline: t }) => {
      const last = t.samples.length ? t.samples[t.samples.length - 1].ts : t.session.start
      const end = t.session.end ?? Math.max(now, last)
      return { start: t.session.start, end: Math.max(end, t.session.start + 1) }
    })
    const total = ranges.reduce((a, r) => a + (r.end - r.start), 0)
    const minW = Math.min(SEG_MIN_W, avail / n)
    const extra = Math.max(0, avail - minW * n)
    let x = LEFT
    return segments.map((sg, i) => {
      const { start, end } = ranges[i]
      const x0 = x
      const x1 = x0 + minW + (extra * (end - start)) / total
      x = x1 + SEG_GAP
      const k = (x1 - x0) / (end - start)
      const toX = (ts: number) => x0 + (ts - start) * k
      const toTs = (px: number) => start + (px - x0) / k
      return { ...sg, i, start, end, x0, x1, toX, toTs, pts: bucket(sg.samples, toX) }
    })
  }, [segments, width, now])

  const paths = useMemo(
    () =>
      segs.map((s) => ({
        line: line<Point>().x((p) => p.x).y((p) => y(p.v)).curve(curveMonotoneX)(s.pts) ?? '',
        area: area<Point>().x((p) => p.x).y0(zeroY).y1((p) => y(p.v)).curve(curveMonotoneX)(s.pts) ?? ''
      })),
    [segs, y, zeroY]
  )

  // Exact y of each drawn curve at any x (same maths as d3's monotone curve), so dots and the scrubber sit on the line.
  const curveFns = useMemo(
    () =>
      segs.map((s) =>
        s.pts.length ? monotoneSampler(s.pts.map((p) => p.x), s.pts.map((p) => y(p.v))) : () => zeroY
      ),
    [segs, y, zeroY]
  )
  const curveY = (seg: number, atX: number) => curveFns[seg]?.(atX) ?? zeroY

  // All switches across segments, with their x on the compressed axis.
  const moments = useMemo(
    () => segs.flatMap((s) => s.timeline.switches.map((sw) => ({ sw, seg: s.i, x: s.toX(sw.ts), session: s.timeline.session.id }))),
    [segs]
  )
  const labels = useMemo(() => {
    const m = new Map<string, ContextLabel | undefined>()
    for (const s of segments) for (const sw of s.timeline.switches) m.set(sw.id, labelFor(s.timeline, sw.id))
    return m
  }, [segments])
  const labelOf = (id: string) => labels.get(id)
  const momentOf = useMemo(() => new Map(moments.map((m) => [m.sw.id, m])), [moments])
  const select = (switchId: string) => onSelect(switchId, momentOf.get(switchId)?.session ?? '')

  // Dot positions on the curve: measured once per path change, not on every hover frame.
  const dotY = useMemo(() => new Map(moments.map((m) => [m.sw.id, curveY(m.seg, m.x)])), [curveFns, moments])

  // Moments lane: measure single chips, then pack into ≤ 2 rows, clustering whatever can't fit.
  const chipEls = useRef(new Map<string, HTMLElement>())
  const [chipW, setChipW] = useState<Record<string, number>>({})

  const groups = useMemo(
    () =>
      layoutLane(
        moments.map((m) => m.sw),
        {
          xOf: (sw) => momentOf.get(sw.id)?.x ?? 0,
          singleWidth: (sw) => chipW[sw.id] ?? estimateChipWidth(sw, labels.get(sw.id)),
          clusterWidth: clusterChipWidth,
          minLeft: LEFT - 8,
          maxRight: width - RIGHT
        }
      ),
    [moments, momentOf, chipW, labels, width, fontsReady]
  )

  useLayoutEffect(() => {
    const next: Record<string, number> = {}
    chipEls.current.forEach((el, id) => {
      if (Math.abs((chipW[id] ?? 0) - el.offsetWidth) > 0.5) next[id] = el.offsetWidth
    })
    if (Object.keys(next).length) setChipW((prev) => ({ ...prev, ...next }))
  }, [groups, fontsReady]) // re-measure only when the chips on screen change

  const rows = Math.max(1, ...groups.map((g) => g.row + 1))
  const laneTop = chartBottom + LANE_GAP
  const axisTop = laneTop + rows * ROW_PITCH
  const totalH = axisTop + (mode === 'session' ? 32 : 8)

  // Hover scrubber
  const [hover, setHover] = useState<{ seg: number; x: number } | null>(null)
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
    const seg = my >= top && my <= chartBottom ? segs.find((s) => mx >= s.x0 && mx <= s.x1) : undefined
    if (!seg) {
      setHover(null)
      setNear(null)
      return
    }
    setHover({ seg: seg.i, x: mx })
    const near = moments.find((m) => Math.abs(m.x - mx) <= 10)
    setNear(near ? near.sw.id : null)
  }
  const onLeave = () => {
    setHover(null)
    setNear(null)
  }
  const hoverPoint = hover ? nearestPoint(segs[hover.seg].pts, hover.x) : undefined

  // Session mode: a few round-time ticks only (at most 6, 4 on narrow widths).
  const ticks = useMemo(() => {
    if (mode !== 'session' || !segs[0]) return []
    const s = segs[0]
    const scale = scaleTime().domain([new Date(s.start * 1000), new Date(s.end * 1000)]).range([s.x0, s.x1])
    const max = width > 900 ? 6 : 4
    const raw = scale.ticks(max)
    const every = Math.ceil(raw.length / max)
    return raw.filter((_, i) => i % every === 0).map((t) => ({ x: scale(t), label: formatClock(t.getTime() / 1000) }))
  }, [mode, segs, width])

  // The curves, fills and bands only change with the data or size, not on hover; memoised so hover stays cheap.
  const segmentLayer = useMemo(
    () =>
    segs.map((s, i) => (
              <g key={s.timeline.session.id}>
                {/* In the day view, a barely-lifted band marks each session */}
                {mode === 'day' && (
                  <rect x={s.x0 - 4} y={top + 4} width={s.x1 - s.x0 + 8} height={CHART_H - 8} rx={10} fill="var(--surface)" />
                )}
                <line x1={s.x0} x2={s.x1} y1={zeroY} y2={zeroY} stroke="var(--faint)" strokeDasharray="2 5" />
    
                {/* Fills, split exactly at neutral */}
                <motion.g
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.06, ease: EASE }}
                >
                  <path d={paths[i].area} fill={`url(#up${uid})`} clipPath={`url(#above${uid})`} />
                  <path d={paths[i].area} fill={`url(#down${uid})`} clipPath={`url(#below${uid})`} />
                </motion.g>
    
                {/* The curve, teal above neutral and coral below; draws itself in */}
                {(['above', 'below'] as const).map((side) => (
                  <motion.path
                    key={side}
                    d={paths[i].line}
                    fill="none"
                    stroke={side === 'above' ? 'var(--positive)' : 'var(--negative)'}
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    clipPath={`url(#${side}${uid})`}
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, delay: i * 0.06, ease: EASE }}
                  />
                ))}
    
                {/* Gap to the next session */}
                {mode === 'day' && segs[i + 1] && (
                  <GapLabel x={(s.x1 + segs[i + 1].x0) / 2} y={zeroY} seconds={segs[i + 1].start - s.end} />
                )}
              </g>
            )),
    [segs, paths, mode, top, zeroY, uid, reduce]
  )

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
            <rect x="0" y={zeroY} width={width} height={chartBottom - zeroY} />
          </clipPath>
          <filter id={`glow${uid}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        {/* Scale marks */}
        {(
          [
            ['+', y(0.85)],
            ['0', zeroY],
            ['−', y(-0.85)]
          ] as const
        ).map(([t, ty]) => (
          <text key={t} x={8} y={ty} dy="0.35em" className="font-mono" fontSize={12} fill="var(--muted)">
            {t}
          </text>
        ))}

        {segmentLayer}

        {/* Scrubber */}
        {hover && (
          <g pointerEvents="none">
            <line x1={hover.x} x2={hover.x} y1={top + PAD_TOP - 12} y2={chartBottom} stroke="var(--hairline-strong)" />
            <circle cx={hover.x} cy={curveY(hover.seg, hover.x)} r={4} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.5} />
          </g>
        )}

        {/* Lane ticks: where each moment sits on the axis */}
        {moments.map((m) => (
          <line key={m.sw.id} x1={m.x} x2={m.x} y1={laneTop - 10} y2={laneTop - 4} stroke="var(--faint)" />
        ))}

        {/* Switch dots */}
        {moments.map((m, i) => (
          <SwitchDot
            key={m.sw.id}
            cx={m.x}
            cy={dotY.get(m.sw.id) ?? zeroY}
            color={toneVar(labels.get(m.sw.id)?.tone)}
            active={highlightId === m.sw.id}
            connectTo={laneTop - 10}
            glowId={`glow${uid}`}
            delay={reduce ? 0 : 0.55 + Math.min(i, 12) * 0.04}
            onEnter={() => onHighlight(m.sw.id)}
            onClick={() => select(m.sw.id)}
          />
        ))}

        {/* Time axis (single session) */}
        {ticks.map((t) => (
          <text key={t.x} x={t.x} y={axisTop + 18} textAnchor="middle" className="font-mono" fontSize={11} fill="var(--muted)">
            {t.label}
          </text>
        ))}
      </svg>

      {/* Day view: platform and start time above each session */}
      {mode === 'day' &&
        segs.map((s) => (
          <div
            key={s.timeline.session.id}
            className="pointer-events-none absolute top-0 flex h-5 items-center gap-1.5 overflow-hidden whitespace-nowrap"
            style={{ left: s.x0, maxWidth: s.x1 - s.x0 + 8 }}
          >
            <PlatformIcon platform={s.timeline.session.platform} size={12} />
            {s.x1 - s.x0 > 84 && <span className="font-mono text-[11px] text-muted">{formatClock(s.start)}</span>}
            {isLive(s.timeline.session) && s.x1 - s.x0 > 84 && <PulseDot />}
          </div>
        ))}

      {/* Live: a pulsing dot where the newest reading is */}
      {segs.map((s) => {
        const last = s.pts[s.pts.length - 1]
        if (!isLive(s.timeline.session) || !last) return null
        return (
          <span
            key={s.timeline.session.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: last.x, top: curveY(s.i, last.x) }}
          >
            <PulseDot />
          </span>
        )
      })}

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
              label={labels.get(sw.id)}
              active={highlightId === sw.id}
              style={style}
              onHighlight={onHighlight}
              onSelect={select}
            />
          )
        }
        return (
          <ClusterChip
            key={g.key}
            members={g.members}
            labelOf={labelOf}
            active={g.members.some((m) => m.id === highlightId)}
            highlightId={highlightId}
            style={style}
            bounds={width}
            onHighlight={onHighlight}
            onSelect={select}
          />
        )
      })}

      {hover && hoverPoint && <Readout point={hoverPoint} platform={segs[hover.seg].timeline.session.platform} x={hover.x} top={top} width={width} />}
    </div>
  )
}

function nearestPoint(pts: Point[], x: number): Point | undefined {
  let lo = 0
  let hi = pts.length - 1
  if (hi < 0) return undefined
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (pts[mid].x < x) lo = mid + 1
    else hi = mid
  }
  const prev = pts[lo - 1]
  return prev && Math.abs(prev.x - x) < Math.abs(pts[lo].x - x) ? prev : pts[lo]
}

/** "2h 10m / later" in tiny mono, centred in the gap between two sessions. */
function GapLabel({ x, y, seconds }: { x: number; y: number; seconds: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" className="font-mono" fontSize={10} fill="var(--muted)">
      <tspan x={x} dy="-0.3em">
        {formatSpan(seconds)}
      </tspan>
      <tspan x={x} dy="1.25em" fill="var(--faint)">
        later
      </tspan>
    </text>
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

function Readout({ point, platform, x, top, width }: { point: Point; platform: MoodSwitch['platform']; x: number; top: number; width: number }) {
  const flip = x > width - 220
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-[var(--radius-md)] border border-hairline-strong bg-elevated px-3 py-2 shadow-[var(--shadow-pop)]"
      style={{ left: x, top, transform: `translateX(${flip ? 'calc(-100% - 12px)' : '12px'})` }}
    >
      <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
        {formatClock(point.sample.ts, true)}
        <span className="text-faint">·</span>
        <PlatformIcon platform={platform} size={11} />
        <span className="font-sans text-ink-2">{platformName(platform)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[13px]">
        <span className="h-2 w-2 rounded-full" style={{ background: toneVar(emotionTone(point.sample.emotion)) }} />
        <span className="capitalize text-ink">{point.sample.emotion}</span>
        <span className="font-mono text-ink-2">{formatValence(point.v)}</span>
      </div>
    </div>
  )
}

/** First-render guess before a chip is measured (mono "from → to" + sans category + chrome). */
const estimateChipWidth = (sw: MoodSwitch, label: ContextLabel | undefined) =>
  62 + (sw.from.length + sw.to.length + 3) * 6.9 + (label ? capitalize(label.category) : 'Pending').length * 6.5

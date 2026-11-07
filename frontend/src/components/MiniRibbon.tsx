import { useId, useMemo } from 'react'
import { area, curveMonotoneX, line } from 'd3-shape'
import type { EmotionSample } from '../types/contracts'

interface Props {
  /** Chart-ready samples (already filtered and smoothed), sorted by ts. */
  samples: EmotionSample[]
  width: number
  height: number
  /** Show the soft teal/coral fill under the line. */
  fill?: boolean
}

/** A tiny mood ribbon: same teal-above / coral-below language as the big one, ~1 point per 2 px. */
export default function MiniRibbon({ samples, width, height, fill = true }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const zero = height / 2
  const { linePath, areaPath } = useMemo(() => {
    if (samples.length < 2) return { linePath: '', areaPath: '' }
    const t0 = samples[0].ts
    const t1 = samples[samples.length - 1].ts
    const toX = (ts: number) => ((ts - t0) / (t1 - t0 || 1)) * width
    const toY = (v: number) => zero - v * (height / 2 - 2)
    // Bucket into ~2 px columns.
    const pts: [number, number][] = []
    let key = NaN
    let sum = 0
    let n = 0
    for (const s of samples) {
      const k = Math.round(toX(s.ts) / 2)
      if (k !== key && n) {
        pts.push([key * 2, toY(sum / n)])
        sum = 0
        n = 0
      }
      key = k
      sum += s.valence
      n++
    }
    if (n) pts.push([key * 2, toY(sum / n)])
    return {
      linePath: line().curve(curveMonotoneX)(pts) ?? '',
      areaPath: area().y0(zero).curve(curveMonotoneX)(pts) ?? ''
    }
  }, [samples, width, height, zero])

  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible" aria-hidden>
      <defs>
        <clipPath id={`a${uid}`}>
          <rect x="-2" y="-2" width={width + 4} height={zero + 2} />
        </clipPath>
        <clipPath id={`b${uid}`}>
          <rect x="-2" y={zero} width={width + 4} height={height - zero + 2} />
        </clipPath>
      </defs>
      <line x1={0} x2={width} y1={zero} y2={zero} stroke="var(--faint)" strokeDasharray="1.5 3" />
      {fill && (
        <>
          <path d={areaPath} fill="var(--positive)" opacity={0.16} clipPath={`url(#a${uid})`} />
          <path d={areaPath} fill="var(--negative)" opacity={0.16} clipPath={`url(#b${uid})`} />
        </>
      )}
      <path d={linePath} fill="none" stroke="var(--positive)" strokeWidth={1.5} clipPath={`url(#a${uid})`} />
      <path d={linePath} fill="none" stroke="var(--negative)" strokeWidth={1.5} clipPath={`url(#b${uid})`} />
    </svg>
  )
}

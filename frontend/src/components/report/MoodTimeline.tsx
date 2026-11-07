import { useMemo } from 'react'
import {
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions
} from 'chart.js'
import annotationPlugin, { type AnnotationOptions } from 'chartjs-plugin-annotation'
import { Line } from 'react-chartjs-2'
import { labelFor, type Timeline } from '../../data'
import { formatClock } from '../../lib/format'
import { toneColor, useThemeColors, withAlpha, type ThemeColors } from '../../lib/theme'

ChartJS.register(LinearScale, LineElement, PointElement, Tooltip, annotationPlugin)

type Point = { x: number; y: number; emotion: string }

/** Tick spacing in seconds so the x axis lands on round clock times. */
const tickStep = (duration: number) => (duration <= 15 * 60 ? 60 : duration <= 60 * 60 ? 300 : 900)

const Y_LABELS: Record<number, string> = { 1: 'Positive', 0: 'Neutral', [-1]: 'Negative' }

function switchMarkers(timeline: Timeline, c: ThemeColors): Record<string, AnnotationOptions> {
  const markers: Record<string, AnnotationOptions> = {}
  timeline.switches.forEach((sw, i) => {
    const label = labelFor(timeline, sw.id)
    const color = toneColor(c, label?.tone)
    markers[sw.id] = {
      type: 'line',
      xMin: sw.ts,
      xMax: sw.ts,
      borderColor: color,
      borderWidth: 2,
      borderDash: label ? undefined : [4, 4],
      label: {
        display: true,
        // Alternate top/bottom so neighbouring labels don't collide.
        position: i % 2 === 0 ? 'start' : 'end',
        content: [`${sw.from} → ${sw.to}`, label ? `${label.category} · ${label.topic}` : 'label pending'],
        backgroundColor: c.surface,
        color: c.text,
        borderColor: color,
        borderWidth: 1.5,
        borderRadius: 8,
        padding: { x: 8, y: 5 },
        font: { size: 12 }
      }
    }
  })
  return markers
}

function buildOptions(timeline: Timeline, c: ThemeColors): ChartOptions<'line'> {
  const { start, end } = timeline.session
  const step = tickStep(end - start)
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', intersect: false, axis: 'x' },
    layout: { padding: { top: 8, right: 16 } },
    scales: {
      x: {
        type: 'linear',
        min: start,
        max: end,
        grid: { color: withAlpha(c.border, 0.5) },
        border: { color: c.border },
        ticks: { color: c.muted, callback: (v) => formatClock(Number(v)) },
        afterBuildTicks: (scale) => {
          const ticks = []
          for (let t = Math.ceil(start / step) * step; t <= end; t += step) ticks.push({ value: t })
          scale.ticks = ticks
        }
      },
      y: {
        min: -1,
        max: 1,
        grid: { color: (ctx) => (ctx.tick.value === 0 ? c.border : 'transparent') },
        border: { display: false },
        ticks: { stepSize: 0.5, color: c.muted, callback: (v) => Y_LABELS[Number(v)] ?? '' }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.surface,
        titleColor: c.text,
        bodyColor: c.text,
        borderColor: c.border,
        borderWidth: 1,
        callbacks: {
          title: (items) => formatClock(items[0].parsed.x ?? 0, true),
          label: (item) => {
            const p = item.raw as Point
            return ` ${p.emotion} · mood ${p.y > 0 ? '+' : ''}${p.y.toFixed(2)}`
          }
        }
      },
      annotation: {
        annotations: {
          positiveBand: { type: 'box', yMin: 0, yMax: 1, backgroundColor: withAlpha(c.positive, 0.07), borderWidth: 0, drawTime: 'beforeDatasetsDraw' },
          negativeBand: { type: 'box', yMin: -1, yMax: 0, backgroundColor: withAlpha(c.negative, 0.07), borderWidth: 0, drawTime: 'beforeDatasetsDraw' },
          ...switchMarkers(timeline, c)
        }
      }
    }
  }
}

export default function MoodTimeline({ timeline }: { timeline: Timeline }) {
  const colors = useThemeColors()

  const data: ChartData<'line', Point[]> = useMemo(() => {
    const dense = timeline.samples.length > 60
    return {
      datasets: [
        {
          label: 'Mood',
          data: timeline.samples.map((s) => ({ x: s.ts, y: s.valence, emotion: s.emotion })),
          borderColor: colors.accent,
          backgroundColor: colors.accent,
          borderWidth: 2.5,
          // Monotone smoothing never overshoots past -1..1.
          cubicInterpolationMode: 'monotone',
          pointRadius: dense ? 0 : 3.5,
          pointHoverRadius: 5
        }
      ]
    }
  }, [timeline, colors])

  const options = useMemo(() => buildOptions(timeline, colors), [timeline, colors])

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Mood timeline</h2>
        <Legend colors={colors} />
      </div>
      {timeline.samples.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No mood readings were recorded during this session.</p>
      ) : (
        <div className="h-96">
          <Line data={data} options={options} />
        </div>
      )}
    </div>
  )
}

function Legend({ colors }: { colors: ThemeColors }) {
  const item = (color: string, text: string) => (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {text}
    </span>
  )
  return (
    <div className="flex gap-4 text-xs text-muted">
      {item(colors.accent, 'Mood signal')}
      {item(colors.positive, 'Uplifting content')}
      {item(colors.neutral, 'Neutral content')}
      {item(colors.negative, 'Draining content')}
    </div>
  )
}

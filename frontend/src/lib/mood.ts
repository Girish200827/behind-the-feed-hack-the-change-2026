// Presentation helpers for mood data. Pure functions over the data layer's Timeline; no fetching here.
import { labelFor, type Timeline } from '../data'
import type { Category, EmotionSample, Emotion, Tone } from '../types/contracts'

/** Where each emotion sits on the mood scale, for its small color dot. */
const EMOTION_TONE: Record<Emotion, Tone> = {
  happy: 'positive',
  surprise: 'neutral',
  neutral: 'neutral',
  sad: 'negative',
  angry: 'negative',
  fear: 'negative',
  disgust: 'negative'
}

export const emotionTone = (e: Emotion) => EMOTION_TONE[e]

/** CSS color for a tone. Undefined tone (label not in yet) reads as neutral. */
export const toneVar = (tone: Tone | undefined) =>
  tone === 'positive' ? 'var(--positive)' : tone === 'negative' ? 'var(--negative)' : 'var(--neutral)'

/** Share (0..1) of the sampled time spent below neutral, with linear interpolation across zero. */
export function drainedShare(samples: EmotionSample[]): number {
  if (samples.length < 2) return samples[0] && samples[0].valence < 0 ? 1 : 0
  let below = 0
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    const dt = b.ts - a.ts
    if (a.valence < 0 && b.valence < 0) below += dt
    else if (a.valence < 0 !== b.valence < 0) {
      const crossing = a.valence / (a.valence - b.valence) // fraction of dt before crossing zero
      below += a.valence < 0 ? dt * crossing : dt * (1 - crossing)
    }
  }
  const span = samples[samples.length - 1].ts - samples[0].ts
  return span > 0 ? below / span : 0
}

const mean = (xs: EmotionSample[]) => (xs.length ? xs.reduce((a, s) => a + s.valence, 0) / xs.length : undefined)

/**
 * Mood level just before and just after a switch: the mean over ~10 s windows (the 2 s the new mood had to
 * hold are excluded from "before"). Falls back to the nearest sample on each side when data is sparse.
 */
function around(samples: EmotionSample[], ts: number) {
  const before = mean(samples.filter((s) => s.ts >= ts - 12 && s.ts < ts - 2)) ?? [...samples].reverse().find((s) => s.ts <= ts)?.valence
  const after = mean(samples.filter((s) => s.ts > ts && s.ts <= ts + 10)) ?? samples.find((s) => s.ts > ts)?.valence
  return { before, after }
}

/** Category with the largest mood rise and the largest mood drop across a switch. Pass chart-ready (smoothed) samples. */
export function biggestShifts(t: Timeline, samples: EmotionSample[]): { lift?: Category; drain?: Category } {
  let lift: { c: Category; d: number } | undefined
  let drain: { c: Category; d: number } | undefined
  for (const sw of t.switches) {
    const label = labelFor(t, sw.id)
    const { before, after } = around(samples, sw.ts)
    if (!label || before === undefined || after === undefined) continue
    const d = after - before
    if (d > 0 && (!lift || d > lift.d)) lift = { c: label.category, d }
    if (d < 0 && (!drain || d < drain.d)) drain = { c: label.category, d }
  }
  return { lift: lift?.c, drain: drain?.c }
}

/** Nearest sample to ts (samples sorted by ts). */
export function nearestSample(samples: EmotionSample[], ts: number): EmotionSample | undefined {
  let lo = 0
  let hi = samples.length - 1
  if (hi < 0) return undefined
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].ts < ts) lo = mid + 1
    else hi = mid
  }
  const prev = samples[lo - 1]
  return prev && Math.abs(prev.ts - ts) < Math.abs(samples[lo].ts - ts) ? prev : samples[lo]
}

// Presentation helpers for mood data. Pure functions over the data layer's Timeline; no fetching here.
import { labelFor, type Timeline } from '../data/join'
import type { Category, EmotionSample, Emotion, Platform, Tone } from '../types/contracts'

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

/** Seconds spent below neutral (linear interpolation across zero) and the sampled span, in seconds. */
export function drainedSeconds(samples: EmotionSample[]): { below: number; span: number } {
  if (samples.length < 2) return { below: 0, span: 0 }
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
  return { below, span: samples[samples.length - 1].ts - samples[0].ts }
}

/** Share (0..1) of the sampled time spent below neutral. */
export function drainedShare(samples: EmotionSample[]): number {
  if (samples.length === 1) return samples[0].valence < 0 ? 1 : 0
  const { below, span } = drainedSeconds(samples)
  return span > 0 ? below / span : 0
}

/** Mean valence, or undefined without samples. */
export const avgValence = (samples: EmotionSample[]) =>
  samples.length ? samples.reduce((a, s) => a + s.valence, 0) / samples.length : undefined

/** Overall tone of an average valence (a small dead zone around neutral). */
export const moodTone = (avg: number | undefined): Tone =>
  avg === undefined ? 'neutral' : avg > 0.12 ? 'positive' : avg < -0.12 ? 'negative' : 'neutral'

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

export interface Shift {
  category: Category
  platform: Platform
  /** Change in valence across the switch. */
  delta: number
}

/** The largest mood rise and drop across labelled switches. Pass chart-ready (smoothed) samples. */
export function biggestShifts(t: Timeline, samples: EmotionSample[]): { lift?: Shift; drain?: Shift } {
  let lift: Shift | undefined
  let drain: Shift | undefined
  for (const sw of t.switches) {
    const label = labelFor(t, sw.id)
    const { before, after } = around(samples, sw.ts)
    if (!label || before === undefined || after === undefined) continue
    const shift = { category: label.category, platform: sw.platform, delta: after - before }
    if (shift.delta > 0 && (!lift || shift.delta > lift.delta)) lift = shift
    if (shift.delta < 0 && (!drain || shift.delta < drain.delta)) drain = shift
  }
  return { lift, drain }
}

/** Biggest lift and drain across several sessions. */
export function biggestShiftsAcross(items: { timeline: Timeline; samples: EmotionSample[] }[]) {
  let lift: Shift | undefined
  let drain: Shift | undefined
  for (const it of items) {
    const s = biggestShifts(it.timeline, it.samples)
    if (s.lift && (!lift || s.lift.delta > lift.delta)) lift = s.lift
    if (s.drain && (!drain || s.drain.delta < drain.delta)) drain = s.drain
  }
  return { lift, drain }
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

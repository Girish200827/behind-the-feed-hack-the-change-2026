// Chart-side smoothing. The data layer's raw samples are never modified; this returns new objects.
import type { EmotionSample } from '../types/contracts'

/** Samples below this confidence (looking away, bad light) are left out of the chart. */
export const MIN_CONFIDENCE = 0.4
/** Rolling-average window, centred on each sample: single-session report. */
export const SMOOTH_WINDOW_S = 5
/** Stronger window for the day view, where many sessions share the width and short wiggles are just noise. */
export const DAY_SMOOTH_WINDOW_S = 18

/** Drops low-confidence samples, then applies a centred rolling mean to valence. Input must be sorted by ts. */
export function smoothSamples(samples: EmotionSample[], windowS = SMOOTH_WINDOW_S): EmotionSample[] {
  const kept = samples.filter((s) => s.confidence >= MIN_CONFIDENCE)
  const half = windowS / 2
  const out: EmotionSample[] = []
  let lo = 0
  let hi = 0
  let sum = 0
  for (let i = 0; i < kept.length; i++) {
    const t = kept[i].ts
    while (hi < kept.length && kept[hi].ts <= t + half) sum += kept[hi++].valence
    while (kept[lo].ts < t - half) sum -= kept[lo++].valence
    out.push({ ...kept[i], valence: sum / (hi - lo) })
  }
  return out
}

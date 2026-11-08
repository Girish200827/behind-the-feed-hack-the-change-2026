// Connect-instead nudges: pure detection and wording.
import type { EmotionSample } from '../types/contracts'

/** A stretch must stay below neutral this long to count as draining. */
export const DRAIN_STRETCH_S = 5 * 60
/** Gaps in the readings shorter than this (looking away, a low-confidence second) don't break a stretch. */
const MAX_GAP_S = 20

export interface Stretch {
  start: number
  end: number
  seconds: number
}

/**
 * Finds stretches where the (smoothed) valence stays below neutral for at least `minSeconds`.
 * Pass chart-ready samples: low-confidence readings removed and smoothed, sorted by ts.
 */
export function findDrainingStretches(samples: EmotionSample[], minSeconds = DRAIN_STRETCH_S): Stretch[] {
  const out: Stretch[] = []
  let start: number | null = null
  let last: number | null = null
  const close = () => {
    if (start !== null && last !== null && last - start >= minSeconds) out.push({ start, end: last, seconds: last - start })
    start = null
  }
  for (const s of samples) {
    const gap = last !== null && s.ts - last > MAX_GAP_S
    if (s.valence < 0 && !gap) {
      if (start === null) start = s.ts
    } else {
      close()
      if (s.valence < 0) start = s.ts // a gap ended the old stretch; a new one may begin here
    }
    last = s.ts
  }
  close()
  return out
}

/** The stretch still going on at the newest reading (within `withinS` of it), if any. */
export function ongoingStretch(samples: EmotionSample[], withinS = 30, minSeconds = DRAIN_STRETCH_S): Stretch | null {
  const newest = samples[samples.length - 1]
  if (!newest) return null
  const s = findDrainingStretches(samples, minSeconds).at(-1)
  return s && newest.ts - s.end <= withinS ? s : null
}

export const NUDGE_SUGGESTIONS = ['Message a friend', 'Step outside for 5 minutes', 'Call someone you miss'] as const

/** Rotates through the suggestions so the nudge doesn't feel like a broken record. */
export const suggestionAt = (i: number) => NUDGE_SUGGESTIONS[((i % NUDGE_SUGGESTIONS.length) + NUDGE_SUGGESTIONS.length) % NUDGE_SUGGESTIONS.length]

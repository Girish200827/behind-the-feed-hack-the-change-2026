// Test helpers: build sessions in the contract formats at local clock times.
import type { Timeline } from '../data/join'
import type { Category, ContextLabel, EmotionSample, Emotion, MoodSwitch, Platform, Tone } from '../types/contracts'

/** Unix seconds for a local date/time (month is 1-based). */
export const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).getTime() / 1000

/** One sample per second from `start` for `seconds`, with a fixed valence (or a function of elapsed seconds). */
export function samples(start: number, seconds: number, valence: number | ((s: number) => number), emotion: Emotion = 'neutral', confidence = 0.85): EmotionSample[] {
  return Array.from({ length: seconds }, (_, s) => ({
    ts: start + s + 0.5,
    emotion,
    valence: typeof valence === 'number' ? valence : valence(s),
    confidence
  }))
}

let switchNo = 0

export function moment(ts: number, from: Emotion, to: Emotion, platform: Platform, label?: { category: Category; tone: Tone; topic: string }) {
  const sw: MoodSwitch = { id: `sw_t${++switchNo}`, ts, from, to, platform }
  const lb: ContextLabel | undefined = label && { switch_id: sw.id, ts: ts + 0.4, platform, ...label }
  return { sw, lb }
}

/** A finished session with samples, switches and labels. */
export function session(
  platform: Platform,
  start: number,
  seconds: number,
  sampleList: EmotionSample[],
  moments: { sw: MoodSwitch; lb?: ContextLabel }[] = []
): Timeline {
  return {
    session: { id: `s_${platform}_${start}`, platform, start, end: start + seconds },
    samples: sampleList,
    switches: moments.map((m) => m.sw),
    labels: moments.flatMap((m) => (m.lb ? [m.lb] : []))
  }
}

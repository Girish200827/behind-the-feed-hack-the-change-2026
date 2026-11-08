// Nudge preferences and memory, on this device only (localStorage, try/catch).
import type { BehindFeedBridge } from '../types/bridge'
import { KEYS, readJson, writeJson } from './localStore'

interface NudgeState {
  enabled: boolean
  /** Index of the next suggestion to show. */
  next: number
  /** Stretches already nudged ("sessionId@start"), so each one nudges once. */
  seen: string[]
}

const read = (): NudgeState => ({ enabled: true, next: 0, seen: [], ...readJson<Partial<NudgeState>>(KEYS.nudges, {}) })

export const nudgesEnabled = () => read().enabled
export const setNudgesEnabled = (enabled: boolean) => writeJson(KEYS.nudges, { ...read(), enabled })

/** Returns the suggestion index to use now and advances the rotation. */
export function takeSuggestionIndex(): number {
  const s = read()
  writeJson(KEYS.nudges, { ...s, next: s.next + 1 })
  return s.next
}

/** True the first time a given stretch is seen; false afterwards. */
export function markStretchSeen(key: string): boolean {
  const s = read()
  if (s.seen.includes(key)) return false
  writeJson(KEYS.nudges, { ...s, seen: [key, ...s.seen].slice(0, 50) })
  return true
}

/** Native notification through the main process (no-op outside the desktop app). */
export function notifyNative(title: string, body: string) {
  const b = (window as unknown as { behindfeed?: BehindFeedBridge }).behindfeed
  return b?.notify(title, body).catch(() => undefined)
}

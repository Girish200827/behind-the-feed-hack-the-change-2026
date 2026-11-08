// Small JSON helpers over localStorage. Every access is wrapped in try/catch: storage can be missing,
// full or blocked, and the app must keep working without it.
// Nothing here is sent anywhere; it stays on this device.

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const KEYS = {
  checkins: 'scrollmood.checkins.v1',
  goalHistory: (source: string) => `scrollmood.goalHistory.v1.${source}`,
  circle: 'scrollmood.circle.v1',
  circleSent: 'scrollmood.circleSent.v1',
  nudges: 'scrollmood.nudges.v1',
  consent: 'scrollmood.consent.v1'
} as const

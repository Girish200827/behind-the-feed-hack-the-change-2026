// First-launch consent, remembered on this device (localStorage via try/catch helpers).
// Bump CONSENT_VERSION if what is recorded changes, so people are asked again.
import { KEYS, readJson, writeJson } from './localStore'

export const CONSENT_VERSION = 1

interface Consent {
  version: number
  /** When consent was given (ms since epoch). */
  at: number
}

export function hasConsented(): boolean {
  return readJson<Consent | null>(KEYS.consent, null)?.version === CONSENT_VERSION
}

export function giveConsent(): boolean {
  return writeJson(KEYS.consent, { version: CONSENT_VERSION, at: Date.now() } satisfies Consent)
}

/** For demos: forget consent so the first-launch screen shows again. */
export function resetConsent(): void {
  try {
    localStorage.removeItem(KEYS.consent)
  } catch {
    // Storage blocked: nothing to reset.
  }
}

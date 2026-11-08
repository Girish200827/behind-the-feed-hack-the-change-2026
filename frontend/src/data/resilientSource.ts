// API mode with a safety net: read from Allen's API, and if it can't be reached, fall back to the demo data
// so the app never breaks. The UI shows a small "Backend offline – showing demo data" banner meanwhile.
// Every call tries the API again, so the app switches back on its own once the backend is up.
import { ApiError } from './apiSource'
import type { DataSource } from './source'

type Listener = (online: boolean) => void

export class ResilientSource implements DataSource {
  private online: boolean | null = null
  private listeners = new Set<Listener>()
  /** Session ids that came from the API, so a timeline is asked for in the right place. */
  private apiIds = new Set<string>()

  constructor(
    private api: DataSource,
    private fallback: DataSource
  ) {}

  /** null until the first request has finished. */
  isOnline() {
    return this.online
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(online: boolean, reason?: unknown) {
    if (online === this.online) return
    this.online = online
    if (!online) console.warn('[data] backend offline, showing demo data:', reason instanceof Error ? reason.message : reason)
    this.listeners.forEach((fn) => fn(online))
  }

  async getSessions() {
    try {
      const sessions = await this.api.getSessions()
      sessions.forEach((s) => this.apiIds.add(s.id))
      this.set(true)
      return sessions
    } catch (e) {
      this.set(false, e)
      return this.fallback.getSessions()
    }
  }

  async getTimeline(sessionId: string) {
    const fromApi = this.apiIds.has(sessionId) || this.online !== false
    if (fromApi) {
      try {
        const t = await this.api.getTimeline(sessionId)
        this.set(true)
        if (t) return t
      } catch (e) {
        // Only a network failure means "offline"; an HTTP error from a running backend is a real error.
        if (!(e instanceof ApiError) || e.status === 0) this.set(false, e)
        else throw e
      }
    }
    return this.fallback.getTimeline(sessionId)
  }
}

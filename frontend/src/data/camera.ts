// Camera status and pause/resume. IN MEMORY FOR NOW: the pause flag lives only in this app session.
// TODO(Phase 3): the pause endpoint must be agreed with Allen and added to contracts.md before wiring it here.
// Until then this never talks to the backend; it only changes what the app shows.
import type { DataSource } from './source'

/** Watching: a supported app is active and the camera is on. Paused: you paused it. Off: no supported app is active. */
export type CameraStatus = 'watching' | 'paused' | 'off'

type Listener = (status: CameraStatus) => void

export class CameraControl {
  private paused = false
  private listeners = new Set<Listener>()

  constructor(private source: DataSource) {}

  async getStatus(): Promise<CameraStatus> {
    if (this.paused) return 'paused'
    // A live session (end = null) means Instagram, TikTok, YouTube, X or Facebook is the active window.
    const sessions = await this.source.getSessions().catch(() => [])
    return sessions.some((s) => s.end === null) ? 'watching' : 'off'
  }

  async pause(): Promise<CameraStatus> {
    this.paused = true
    return this.emit()
  }

  async resume(): Promise<CameraStatus> {
    this.paused = false
    return this.emit()
  }

  isPaused() {
    return this.paused
  }

  /** Called whenever pause/resume changes the status. Returns an unsubscribe function. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private async emit() {
    const s = await this.getStatus()
    this.listeners.forEach((fn) => fn(s))
    return s
  }
}

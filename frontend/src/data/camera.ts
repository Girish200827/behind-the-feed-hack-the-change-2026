// Camera status and pause/resume.
// API mode: Pause / Resume call the backend (POST /pause, /resume) and the status comes from GET /status, so the
// camera loop really turns the camera off. Demo mode: the pause flag only lives in this app session.
import type { BackendCameraStatus } from './apiSource'
import type { DataSource } from './source'

/** The backend's camera controls (API mode). */
export interface BackendCamera {
  status: () => Promise<BackendCameraStatus | null>
  setPaused: (paused: boolean) => Promise<boolean>
}

/** Watching: a supported app is active and the camera is on. Paused: you paused it. Off: no supported app is active. */
export type CameraStatus = 'watching' | 'paused' | 'off'

type Listener = (status: CameraStatus) => void

export class CameraControl {
  private paused = false
  private listeners = new Set<Listener>()

  constructor(
    private source: DataSource,
    /** API mode: Allen's GET /status, POST /pause and POST /resume. */
    private backend?: BackendCamera
  ) {}

  /** True when Pause really stops the camera (API mode); false in demo mode. */
  controlsCamera() {
    return this.backend !== undefined
  }

  async getStatus(): Promise<CameraStatus> {
    if (this.backend) {
      // API mode: the backend decides (it also remembers a pause made earlier or from another window).
      const s = await this.backend.status()
      if (!s) return this.paused ? 'paused' : 'off' // unreachable: the camera isn't running either
      this.paused = s.paused
      return s.paused ? 'paused' : s.camera ? 'watching' : 'off'
    }
    if (this.paused) return 'paused'
    // Otherwise a live session (end = null) means Instagram, TikTok, YouTube, X or Facebook is the active window.
    const sessions = await this.source.getSessions().catch(() => [])
    return sessions.some((s) => s.end === null) ? 'watching' : 'off'
  }

  async pause(): Promise<CameraStatus> {
    this.paused = true
    if (this.backend) await this.backend.setPaused(true)
    return this.emit()
  }

  async resume(): Promise<CameraStatus> {
    this.paused = false
    if (this.backend) await this.backend.setPaused(false)
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

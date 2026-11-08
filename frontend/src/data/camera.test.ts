import { describe, expect, it } from 'vitest'
import { CameraControl, type BackendCamera } from './camera'
import type { DataSource } from './source'

const noSessions: DataSource = { getSessions: async () => [], getTimeline: async () => null }

function fakeBackend(start: { scrolling: boolean; paused: boolean }) {
  const state = { ...start, reachable: true }
  const calls: boolean[] = []
  const backend: BackendCamera = {
    status: async () =>
      state.reachable ? { scrolling: state.scrolling, paused: state.paused, camera: state.scrolling && !state.paused } : null,
    setPaused: async (p) => {
      calls.push(p)
      state.paused = p
      return true
    }
  }
  return { state, calls, backend }
}

describe('camera control with the backend', () => {
  it('pause and resume go to the backend and the status follows it', async () => {
    const { calls, backend } = fakeBackend({ scrolling: true, paused: false })
    const cam = new CameraControl(noSessions, backend)
    expect(cam.controlsCamera()).toBe(true)
    expect(await cam.getStatus()).toBe('watching')
    expect(await cam.pause()).toBe('paused')
    expect(await cam.resume()).toBe('watching')
    expect(calls).toEqual([true, false])
  })

  it('shows a pause made elsewhere, and off when no app is open or the backend is down', async () => {
    const { state, backend } = fakeBackend({ scrolling: true, paused: true })
    const cam = new CameraControl(noSessions, backend)
    expect(await cam.getStatus()).toBe('paused')
    state.paused = false
    state.scrolling = false
    expect(await cam.getStatus()).toBe('off')
    state.reachable = false
    expect(await cam.getStatus()).toBe('off')
  })

  it('demo mode keeps pause in memory', async () => {
    const cam = new CameraControl(noSessions)
    expect(cam.controlsCamera()).toBe(false)
    expect(await cam.pause()).toBe('paused')
    expect(await cam.resume()).toBe('off')
  })
})

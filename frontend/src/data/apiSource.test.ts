import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ApiError, fromApiTimeline } from './apiSource'
import { parseEvents } from './loader'
import { ResilientSource } from './resilientSource'
import type { DataSource } from './source'
import type { Session } from '../types/contracts'

const session: Session = { id: 's_1', platform: 'instagram', start: 100, end: 200 }

describe('fromApiTimeline (adapter for GET /sessions/{id}/timeline)', () => {
  it('maps "emotions" to "samples" and keeps switches and labels', () => {
    const t = fromApiTimeline({
      session,
      emotions: [{ ts: 101, emotion: 'sad', valence: -0.6, confidence: 0.8 }],
      switches: [{ id: 'sw_1', ts: 120, from: 'neutral', to: 'sad', platform: 'instagram' }],
      labels: [{ switch_id: 'sw_1', ts: 120.4, platform: 'instagram', category: 'news', tone: 'negative', topic: 'x' }]
    })
    expect(t?.samples).toHaveLength(1)
    expect(t?.switches[0].id).toBe('sw_1')
    expect(t?.labels[0].switch_id).toBe('sw_1')
    expect(t?.session).toEqual(session)
  })

  it('accepts a live session (end: null) and drops malformed events', () => {
    const t = fromApiTimeline({
      session: { ...session, end: null },
      emotions: [{ ts: 101, emotion: 'sad', valence: -0.6, confidence: 0.8 }, { ts: 102, emotion: 'meh', valence: 3 }]
    })
    expect(t?.session.end).toBeNull()
    expect(t?.samples).toHaveLength(1)
    expect(t?.switches).toEqual([])
  })

  it('returns null for an invalid session', () => {
    expect(fromApiTimeline({ session: { id: 's' } })).toBeNull()
  })
})

describe("Allen's fake_session.json (A1) in src/mock", () => {
  it('loads as-is: the loader accepts the timeline-object format', () => {
    const file = join(__dirname, '../../../backend/fake_session.json')
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    const parsed = parseEvents(readFileSync(file, 'utf8'))
    expect(parsed.problems).toEqual([])
    expect(parsed.sessions).toHaveLength(1)
    expect(parsed.samples).toHaveLength(raw.emotions.length)
    expect(parsed.switches).toHaveLength(raw.switches.length)
    expect(parsed.labels).toHaveLength(raw.labels.length)
  })
})

describe('ResilientSource (API with demo-data fallback)', () => {
  const demo: DataSource = { getSessions: async () => [{ ...session, id: 'demo' }], getTimeline: async () => null }

  it('falls back to demo data when the backend is unreachable, and recovers when it comes back', async () => {
    let up = false
    const api: DataSource = {
      getSessions: async () => {
        if (!up) throw new ApiError('down', 0)
        return [session]
      },
      getTimeline: async () => null
    }
    const src = new ResilientSource(api, demo)
    const seen: boolean[] = []
    src.onChange((o) => seen.push(o))

    expect((await src.getSessions())[0].id).toBe('demo')
    expect(src.isOnline()).toBe(false)

    up = true
    expect((await src.getSessions())[0].id).toBe('s_1')
    expect(src.isOnline()).toBe(true)
    expect(seen).toEqual([false, true])
  })

  it('does not treat an HTTP error from a running backend as offline', async () => {
    const api: DataSource = {
      getSessions: async () => [session],
      getTimeline: async () => {
        throw new ApiError('boom', 500)
      }
    }
    const src = new ResilientSource(api, demo)
    await src.getSessions()
    await expect(src.getTimeline('s_1')).rejects.toThrow('boom')
    expect(src.isOnline()).toBe(true)
  })
})

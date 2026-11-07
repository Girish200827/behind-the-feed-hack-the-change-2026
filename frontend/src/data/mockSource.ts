// Reads every .json / .jsonl file in src/mock/. Dropping Allen's A1 file there is the only change needed.
import { buildTimeline, sortSessions } from './join'
import { parseEvents } from './loader'
import type { DataSource } from './source'

const files = import.meta.glob('../mock/*.{json,jsonl}', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const parsed = parseEvents(...Object.values(files))
if (parsed.problems.length) console.warn('[mock data] dropped events:', parsed.problems)

// If two files contain the same session id, keep the first.
const sessions = sortSessions(parsed.sessions.filter((s, i, arr) => arr.findIndex((o) => o.id === s.id) === i))

export const MockSource: DataSource = {
  async getSessions() {
    return sessions
  },
  async getTimeline(sessionId) {
    const session = sessions.find((s) => s.id === sessionId)
    return session ? buildTimeline(session, parsed) : null
  }
}

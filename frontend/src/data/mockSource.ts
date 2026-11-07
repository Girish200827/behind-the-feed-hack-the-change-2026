// Reads .json / .jsonl files from src/mock/. Dropping Allen's A1 file there is the only change needed.
// Pick files with VITE_MOCK_FILE (see constants.ts); by default every top-level file is read.
import { MOCK_FILES } from './constants'
import { buildTimeline, sortSessions } from './join'
import { parseEvents, type ParsedEvents } from './loader'
import type { DataSource } from './source'

const files = import.meta.glob('../mock/**/*.{json,jsonl}', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

/** '../mock/edge/no-samples.json' → 'edge/no-samples' */
const nameOf = (path: string) => path.replace('../mock/', '').replace(/\.jsonl?$/, '')

const selected = Object.entries(files).filter(([path]) =>
  MOCK_FILES === 'all' ? !nameOf(path).includes('/') : MOCK_FILES.includes(nameOf(path))
)
if (MOCK_FILES !== 'all') {
  const missing = MOCK_FILES.filter((n) => !selected.some(([p]) => nameOf(p) === n))
  if (missing.length) console.warn('[mock data] VITE_MOCK_FILE names not found in src/mock/:', missing)
}

const perFile = selected.map(([, text]) => parseEvents(text))
const lastTs = (p: ParsedEvents) =>
  Math.max(...p.samples.map((e) => e.ts), ...p.switches.map((e) => e.ts), ...p.labels.map((e) => e.ts), ...p.sessions.map((s) => s.start))

/**
 * Mock only: a file holding a live session (end: null) is a recording, so we shift its timestamps to
 * finish just now, after every other mock event. This simulates a session in progress. Real data is never shifted.
 */
const finishedLast = Math.max(0, ...perFile.filter((p) => !p.sessions.some((s) => s.end === null)).map(lastTs))
function replayAsLive(p: ParsedEvents): ParsedEvents {
  if (!p.sessions.some((s) => s.end === null)) return p
  const target = Math.max(Date.now() / 1000 - 1, finishedLast + 60)
  const d = target - lastTs(p)
  return {
    ...p,
    sessions: p.sessions.map((s) => ({ ...s, start: s.start + d, end: s.end === null ? null : s.end + d })),
    samples: p.samples.map((e) => ({ ...e, ts: e.ts + d })),
    switches: p.switches.map((e) => ({ ...e, ts: e.ts + d })),
    labels: p.labels.map((e) => ({ ...e, ts: e.ts + d }))
  }
}

const parsed: ParsedEvents = perFile.map(replayAsLive).reduce(
  (all, p) => ({
    sessions: [...all.sessions, ...p.sessions],
    samples: [...all.samples, ...p.samples],
    switches: [...all.switches, ...p.switches],
    labels: [...all.labels, ...p.labels],
    problems: [...all.problems, ...p.problems]
  }),
  { sessions: [], samples: [], switches: [], labels: [], problems: [] }
)
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

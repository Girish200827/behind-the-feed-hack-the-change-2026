// Reads .json / .jsonl files from src/mock/. Dropping Allen's A1 file there is the only change needed.
// Pick files with VITE_MOCK_FILE (see constants.ts); by default every top-level file is read.
import { MOCK_FILES } from './constants'
import { dayStart, dayKey } from './day'
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

// ── Mock-only time travel ─────────────────────────────────────────────
// Recorded mock files have fixed timestamps. So the demo always shows "today":
//  1. finished files are shifted by whole days so their newest day is today, and anything after "now" is cut;
//  2. a file holding a live session (end: null) is shifted to finish just now.
// Real data from Allen's API is never shifted.
const NOW = Date.now() / 1000
const CUTOFF = NOW - 5 * 60

const hasLive = (p: ParsedEvents) => p.sessions.some((s) => s.end === null)

function lastTs(p: ParsedEvents): number {
  let max = -Infinity
  for (const list of [p.samples, p.switches, p.labels]) for (const e of list) if (e.ts > max) max = e.ts
  for (const s of p.sessions) max = Math.max(max, s.end ?? s.start)
  return max
}

function shift(p: ParsedEvents, d: number): ParsedEvents {
  if (d === 0) return p
  return {
    ...p,
    sessions: p.sessions.map((s) => ({ ...s, start: s.start + d, end: s.end === null ? null : s.end + d })),
    samples: p.samples.map((e) => ({ ...e, ts: e.ts + d })),
    switches: p.switches.map((e) => ({ ...e, ts: e.ts + d })),
    labels: p.labels.map((e) => ({ ...e, ts: e.ts + d }))
  }
}

function alignToToday(p: ParsedEvents): ParsedEvents {
  if (hasLive(p) || !p.sessions.length) return p
  const newestStart = Math.max(...p.sessions.map((s) => s.start))
  const days = Math.round((dayStart(dayKey(NOW)) - dayStart(dayKey(newestStart))) / 86400)
  const shifted = shift(p, days * 86400)
  const before = (ts: number) => ts <= CUTOFF
  return {
    ...shifted,
    sessions: shifted.sessions.filter((s) => s.end !== null && before(s.end)),
    samples: shifted.samples.filter((e) => before(e.ts)),
    switches: shifted.switches.filter((e) => before(e.ts)),
    labels: shifted.labels.filter((e) => before(e.ts))
  }
}

const aligned = selected.map(([, text]) => alignToToday(parseEvents(text)))
const finishedLast = Math.max(0, ...aligned.filter((p) => !hasLive(p)).map(lastTs))

function replayAsLive(p: ParsedEvents): ParsedEvents {
  if (!hasLive(p)) return p
  const target = Math.max(NOW - 1, finishedLast + 60)
  return shift(p, target - lastTs(p))
}

const parsed: ParsedEvents = aligned.map(replayAsLive).reduce(
  (all, p) => ({
    sessions: all.sessions.concat(p.sessions),
    samples: all.samples.concat(p.samples),
    switches: all.switches.concat(p.switches),
    labels: all.labels.concat(p.labels),
    problems: all.problems.concat(p.problems)
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

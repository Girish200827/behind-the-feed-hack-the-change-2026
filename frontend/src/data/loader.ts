// Parses mixed contract events from a JSON array or JSONL text,
// detects each event's type by its fields and validates it against src/types/contracts.ts.
import {
  CATEGORIES, EMOTIONS, PLATFORMS, TONES,
  type ContractEvent, type ContextLabel, type EmotionSample, type MoodSwitch, type Session
} from '../types/contracts'

export interface ParsedEvents {
  sessions: Session[]
  samples: EmotionSample[]
  switches: MoodSwitch[]
  labels: ContextLabel[]
  /** Human-readable reasons for any dropped events. */
  problems: string[]
}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const oneOf = <T extends readonly string[]>(list: T, v: unknown): v is T[number] =>
  typeof v === 'string' && (list as readonly string[]).includes(v)

/** Splits text into raw objects. Accepts a JSON array or JSONL (one object per line). */
export function splitRaw(text: string): { items: unknown[]; problems: string[] } {
  const trimmed = text.trim()
  if (!trimmed) return { items: [], problems: [] }
  if (trimmed.startsWith('[')) {
    try {
      return { items: JSON.parse(trimmed) as unknown[], problems: [] }
    } catch (e) {
      return { items: [], problems: [`Could not parse JSON array: ${(e as Error).message}`] }
    }
  }
  const items: unknown[] = []
  const problems: string[] = []
  trimmed.split(/\r?\n/).forEach((line, i) => {
    const l = line.trim()
    if (!l) return
    try {
      items.push(JSON.parse(l))
    } catch {
      problems.push(`Line ${i + 1}: not valid JSON`)
    }
  })
  return { items, problems }
}

/** Detects which contract format an object is, by its fields, and validates it. Returns a reason string if invalid. */
export function detectEvent(raw: unknown): ContractEvent | string {
  if (!isObj(raw)) return 'not an object'

  if ('switch_id' in raw) {
    const ok = isStr(raw.switch_id) && isNum(raw.ts) && oneOf(PLATFORMS, raw.platform) &&
      oneOf(CATEGORIES, raw.category) && oneOf(TONES, raw.tone) && typeof raw.topic === 'string'
    return ok ? { kind: 'context_label', event: raw as unknown as ContextLabel } : 'invalid context_label'
  }
  if ('from' in raw && 'to' in raw) {
    const ok = isStr(raw.id) && isNum(raw.ts) && oneOf(EMOTIONS, raw.from) &&
      oneOf(EMOTIONS, raw.to) && oneOf(PLATFORMS, raw.platform)
    return ok ? { kind: 'mood_switch', event: raw as unknown as MoodSwitch } : 'invalid mood_switch'
  }
  if ('start' in raw && 'end' in raw) {
    const ok = isStr(raw.id) && oneOf(PLATFORMS, raw.platform) && isNum(raw.start) && (isNum(raw.end) || raw.end === null)
    return ok ? { kind: 'session', event: raw as unknown as Session } : 'invalid session'
  }
  if ('emotion' in raw && 'valence' in raw) {
    const ok = isNum(raw.ts) && oneOf(EMOTIONS, raw.emotion) && isNum(raw.valence) &&
      raw.valence >= -1 && raw.valence <= 1 && isNum(raw.confidence)
    return ok ? { kind: 'emotion_sample', event: raw as unknown as EmotionSample } : 'invalid emotion_sample'
  }
  return 'unknown event type'
}

/** Parses one or more files' text into typed, validated events. Invalid events are dropped and reported. */
export function parseEvents(...texts: string[]): ParsedEvents {
  const out: ParsedEvents = { sessions: [], samples: [], switches: [], labels: [], problems: [] }
  for (const text of texts) {
    const { items, problems } = splitRaw(text)
    out.problems.push(...problems)
    items.forEach((raw, i) => {
      const result = detectEvent(raw)
      if (typeof result === 'string') {
        out.problems.push(`Event ${i + 1}: ${result} – ${JSON.stringify(raw).slice(0, 120)}`)
        return
      }
      switch (result.kind) {
        case 'session': out.sessions.push(result.event); break
        case 'emotion_sample': out.samples.push(result.event); break
        case 'mood_switch': out.switches.push(result.event); break
        case 'context_label': out.labels.push(result.event); break
      }
    })
  }
  return out
}

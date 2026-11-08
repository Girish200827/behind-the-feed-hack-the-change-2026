import { describe, expect, it } from 'vitest'
import { computeGoalLocal, computeInsightsLocal, computeTriggers, fromApiGoal, fromApiInsights } from './insights'
import { buildInsightCards } from '../components/insights/InsightCards'
import { at, moment, samples, session } from '../test/fixtures'

const T0 = at(2026, 11, 6, 12)

// Politics: 2 of 2 switches negative. Friends: 0 of 2. Comedy: 1 of 2 (one switch ends in "sad").
const day = [
  session('x', T0, 1200, samples(T0, 1200, (t) => (t < 600 ? 0.3 : -0.4)), [
    moment(T0 + 100, 'neutral', 'angry', 'x', { category: 'politics', tone: 'negative', topic: 'a' }),
    moment(T0 + 300, 'angry', 'disgust', 'x', { category: 'politics', tone: 'negative', topic: 'b' }),
    moment(T0 + 500, 'disgust', 'happy', 'x', { category: 'comedy', tone: 'positive', topic: 'c' }),
    moment(T0 + 700, 'happy', 'sad', 'x', { category: 'comedy', tone: 'positive', topic: 'd' })
  ]),
  session('youtube', T0 + 3600, 600, samples(T0 + 3600, 600, 0.5), [
    moment(T0 + 3700, 'neutral', 'happy', 'youtube', { category: 'friends', tone: 'positive', topic: 'e' }),
    moment(T0 + 3800, 'happy', 'surprise', 'youtube', { category: 'friends', tone: 'positive', topic: 'f' })
  ])
]

describe('local insights (same definitions as backend/app/insights.py)', () => {
  it('scores each category by the share of switches that turned negative, highest first', () => {
    expect(computeTriggers(day)).toEqual([
      { category: 'politics', switches: 2, negative: 2, triggerScore: 1 },
      { category: 'comedy', switches: 2, negative: 1, triggerScore: 0.5 },
      { category: 'friends', switches: 2, negative: 0, triggerScore: 0 }
    ])
  })

  it('builds the platform mix with time and average mood', () => {
    const ins = computeInsightsLocal(day)
    expect(ins.platformMix.map((p) => [p.platform, p.minutes, p.sessions])).toEqual([
      ['x', 20, 1],
      ['youtube', 10, 1]
    ])
    expect(ins.platformMix[1].avgValence).toBeCloseTo(0.5)
    expect(ins.longest).toEqual({ platform: 'x', minutes: 20 })
    // X: first minute +0.3, last minute -0.4 → -0.7; YouTube: 0 → mean -0.35
    expect(ins.avgMoodChange).toBeCloseTo(-0.35, 2)
  })

  it('picks the weekly goal from the top trigger with the backend template', () => {
    expect(computeGoalLocal(computeInsightsLocal(day))).toEqual({
      source: 'local',
      category: 'politics',
      triggerScore: 1,
      text: 'Your mood dipped after 100% of the politics posts you saw. This week, try capping politics content to 10 minutes a day.'
    })
  })

  it('falls back to "not enough data" with no sessions', () => {
    expect(computeGoalLocal(computeInsightsLocal([])).text).toMatch(/^Not enough data yet/)
  })
})

describe("adapters for Allen's A5 responses", () => {
  // A real GET /insights response from the backend (trimmed).
  const raw = {
    triggers: [
      { category: 'politics' as const, switches: 4, negative: 4, trigger_score: 1.0 },
      { category: 'friends' as const, switches: 4, negative: 0, trigger_score: 0.0 }
    ],
    sessions: [{}, {}],
    avg_mood_change: -0.287,
    platform_mix: [
      { platform: 'instagram' as const, sessions: 1, minutes: 20.0 },
      { platform: 'tiktok' as const, sessions: 1, minutes: 1.1 }
    ],
    longest_session: { id: 's_001', platform: 'instagram' as const, start: 0, end: 1200, minutes: 20.0 }
  }

  it('maps /insights and adds the frontend-computed average mood per platform', () => {
    const ins = fromApiInsights(raw, new Map([['instagram', -0.2]]), 2)
    expect(ins.source).toBe('api')
    expect(ins.triggers[0]).toEqual({ category: 'politics', switches: 4, negative: 4, triggerScore: 1 })
    expect(ins.platformMix[0]).toEqual({ platform: 'instagram', sessions: 1, minutes: 20, avgValence: -0.2 })
    expect(ins.platformMix[1].avgValence).toBeUndefined()
    expect(ins.longest).toEqual({ platform: 'instagram', minutes: 20 })
  })

  it('maps /goal and rejects an empty one', () => {
    expect(fromApiGoal({ category: 'politics', trigger_score: 1, text: 'Cap politics.' })).toEqual({
      source: 'api',
      category: 'politics',
      triggerScore: 1,
      text: 'Cap politics.'
    })
    expect(fromApiGoal({ text: '  ' })).toBeNull()
  })

  it('turns insights into 2–3 plain-language cards', () => {
    const cards = buildInsightCards(fromApiInsights(raw, new Map([['instagram', -0.2], ['tiktok', 0.1]]), 2))
    expect(cards.map((c) => c.title)).toEqual(['Politics drains you most', 'Sessions tend to leave you lower', 'You feel best on TikTok'])
  })
})

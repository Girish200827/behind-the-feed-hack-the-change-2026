import { describe, expect, it } from 'vitest'
import { buildChallengeInvite, buildProgressMessage, cleanName, CIRCLE_BOT_NAME } from './circleMessage'
import { computeDayStats, selectDailyGoal } from '../data/dailyGoal'
import { EMOTIONS } from '../types/contracts'
import { at, moment, samples, session } from '../test/fixtures'

describe('Circle progress message', () => {
  const base = { displayName: 'Ahmad', goalTitle: 'No scrolling after 11 PM', outcome: 'met' as const, streak: 4, drainedChange: -0.18 }

  it('contains only the allowed parts', () => {
    const msg = buildProgressMessage(base)
    expect(Object.keys(msg).sort()).toEqual(['content', 'username'])
    expect(msg.username).toBe(CIRCLE_BOT_NAME)
    expect(msg.content).toContain('**Ahmad**')
    expect(msg.content).toContain("Today's goal: No scrolling after 11 PM (done)")
    expect(msg.content).toContain('Streak: 4 days in a row')
    expect(msg.content).toContain('Drained time this week: 18% less than last week')
    expect(msg.content.split('\n')).toHaveLength(5)
  })

  it('omits the weekly change when there is no last-week data', () => {
    expect(buildProgressMessage({ ...base, drainedChange: null }).content).not.toContain('Drained time')
  })

  it('never includes emotions, content topics or raw samples, even when built from real session data', () => {
    // A realistic day with emotions, topics and valence readings...
    const start = at(2026, 11, 6, 8)
    const topics = ['layoff headlines', 'election debate clips', "college roommate's wedding photos"]
    const day = [
      session('x', start, 1200, samples(start, 1200, (t) => (t < 300 ? 0.1 : -0.55), 'sad'), [
        moment(start + 300, 'neutral', 'sad', 'x', { category: 'news', tone: 'negative', topic: topics[0] }),
        moment(start + 700, 'sad', 'angry', 'x', { category: 'politics', tone: 'negative', topic: topics[1] }),
        moment(start + 1000, 'angry', 'happy', 'x', { category: 'friends', tone: 'positive', topic: topics[2] })
      ])
    ]
    const goal = selectDailyGoal(computeDayStats(day))
    // ...goes through the same path the Circle page uses.
    const msg = buildProgressMessage({ ...base, goalTitle: goal.title, outcome: 'in-progress', streak: 2, drainedChange: 0.1 })
    const text = msg.content.toLowerCase()
    for (const e of EMOTIONS) expect(text).not.toMatch(new RegExp(`\\b${e}\\b`))
    for (const t of topics) expect(text).not.toContain(t.toLowerCase())
    expect(text).not.toContain('news')
    expect(text).not.toContain('politics')
    // No valence or confidence numbers (like -0.55 or 0.85).
    expect(text).not.toMatch(/-?\d\.\d+/)
    // The "why" line (which mentions drained share and platform) is not shared.
    expect(text).not.toContain(goal.why.toLowerCase())
  })

  it('cleans display names so they cannot ping or format', () => {
    expect(cleanName('  @everyone  ')).toBe('everyone')
    expect(cleanName('Sam\n**bold**')).toBe('Sam bold')
    expect(cleanName('')).toBe('A friend')
    expect(cleanName('x'.repeat(50))).toHaveLength(32)
  })
})

describe('Circle challenge invite', () => {
  it('names the challenge and nothing personal beyond the display name', () => {
    const msg = buildChallengeInvite('Ahmad', 'swap-for-call')
    expect(msg.content).toContain('**Ahmad** started a challenge: **Swap 1 session for a call**')
    expect(Object.keys(msg).sort()).toEqual(['content', 'username'])
  })
})

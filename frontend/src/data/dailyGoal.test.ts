import { describe, expect, it } from 'vitest'
import { computeDayStats, countStreak, evaluateGoal, selectDailyGoal, type DayStats } from './dailyGoal'
import { at, moment, samples, session } from '../test/fixtures'

// "Yesterday" for these tests: Fri Nov 6 2026, local time.
const Y = (h: number, min = 0) => at(2026, 11, 6, h, min)

describe('selectDailyGoal', () => {
  it('picks a connection swap when posts from friends were the biggest lift', () => {
    const start = Y(12)
    // Neutral, then friends' photos lift the mood from about 0 to 0.6.
    const s = samples(start, 600, (t) => (t < 300 ? 0 : 0.6))
    const day = [session('instagram', start, 600, s, [moment(start + 300, 'neutral', 'happy', 'instagram', { category: 'friends', tone: 'positive', topic: "cousin's new puppy" })])]
    const goal = selectDailyGoal(computeDayStats(day))
    expect(goal.type).toBe('connection')
    expect(goal.id).toBe('connection-swap')
    expect(goal.title).toBe('Swap one scroll session for a call or text')
    expect(goal.needsCheckIn).toBe(true)
  })

  it('picks "No scrolling after 11 PM" when a late-night session drained mood', () => {
    const start = Y(23, 15)
    const day = [session('tiktok', start, 900, samples(start, 900, -0.6, 'sad'))]
    const stats = computeDayStats(day)
    expect(stats.lateNightSessions).toBe(1)
    expect(stats.lateNightDrained).toBe(1)
    const goal = selectDailyGoal(stats)
    expect(goal.type).toBe('timing')
    expect(goal.title).toBe('No scrolling after 11 PM')
    expect(goal.why).toContain('TikTok')
  })

  it('does not pick the timing goal for a late-night session that felt fine', () => {
    const start = Y(23, 15)
    const goal = selectDailyGoal(computeDayStats([session('youtube', start, 600, samples(start, 600, 0.4, 'happy'))]))
    expect(goal.type).not.toBe('timing')
  })

  it('picks "message a friend before opening <platform>" when drained time was high (daytime)', () => {
    const start = Y(8)
    const day = [session('x', start, 1200, samples(start, 1200, (t) => (t < 200 ? 0.2 : -0.5), 'sad'))]
    const stats = computeDayStats(day)
    expect(stats.drainedShare).toBeGreaterThan(0.4)
    const goal = selectDailyGoal(stats)
    expect(goal.type).toBe('connection')
    expect(goal.id).toBe('connection-message-first')
    expect(goal.title).toBe('Message a friend before opening X')
  })

  it('picks the 15-minute limit on an ordinary day, naming the top draining category and platform', () => {
    const start = Y(19)
    // Mostly fine; one short news dip.
    const s = samples(start, 1200, (t) => (t >= 600 && t < 780 ? -0.5 : 0.3))
    const day = [session('facebook', start, 1200, s, [moment(start + 600, 'happy', 'sad', 'facebook', { category: 'news', tone: 'negative', topic: 'road closure updates' })])]
    const stats = computeDayStats(day)
    expect(stats.drainedShare).toBeLessThan(0.4)
    const goal = selectDailyGoal(stats)
    expect(goal.type).toBe('limit')
    expect(goal.title).toBe('Keep draining content under 15 min today')
    expect(goal.why).toContain('news')
    expect(goal.why).toContain('Facebook')
    expect(goal.limitSeconds).toBe(15 * 60)
  })

  it('falls back to a gentle connection goal with no data', () => {
    expect(selectDailyGoal(null).type).toBe('connection')
    expect(selectDailyGoal(computeDayStats([])).type).toBe('connection')
  })
})

describe('evaluateGoal', () => {
  const empty: DayStats = computeDayStats([])
  const withDrain = (seconds: number, late = 0): DayStats => ({ ...empty, sessions: 1, drainedSeconds: seconds, lateNightSessions: late })

  it('connection goals are met by the check-in', () => {
    const goal = selectDailyGoal(null)
    expect(evaluateGoal(goal, empty, { checkedIn: false, complete: false }).status).toBe('pending')
    expect(evaluateGoal(goal, empty, { checkedIn: true, complete: false }).status).toBe('met')
    expect(evaluateGoal(goal, empty, { checkedIn: false, complete: true }).status).toBe('missed')
  })

  it('limit goals track drained minutes against 15 min', () => {
    const goal = { id: 'limit-15', type: 'limit' as const, title: '', why: '', needsCheckIn: false, limitSeconds: 900 }
    const under = evaluateGoal(goal, withDrain(6 * 60), { checkedIn: false, complete: false })
    expect(under).toMatchObject({ status: 'on-track', detail: '6 of 15 min used' })
    expect(under.progress).toBeCloseTo(0.4)
    expect(evaluateGoal(goal, withDrain(6 * 60), { checkedIn: false, complete: true }).status).toBe('met')
    expect(evaluateGoal(goal, withDrain(20 * 60), { checkedIn: false, complete: false }).status).toBe('missed')
  })

  it('timing goals are missed by any session after 11 PM', () => {
    const goal = { id: 'timing-11pm', type: 'timing' as const, title: '', why: '', needsCheckIn: false }
    expect(evaluateGoal(goal, withDrain(0, 0), { checkedIn: false, complete: false }).status).toBe('on-track')
    expect(evaluateGoal(goal, withDrain(0, 0), { checkedIn: false, complete: true }).status).toBe('met')
    expect(evaluateGoal(goal, withDrain(0, 1), { checkedIn: false, complete: false }).status).toBe('missed')
  })
})

describe('countStreak', () => {
  const today = '2026-11-07'
  const results = { '2026-11-06': true, '2026-11-05': true, '2026-11-04': true, '2026-11-03': true, '2026-11-02': false, '2026-11-01': true }

  it('counts consecutive met days back from yesterday (the demo shows 4)', () => {
    expect(countStreak(results, today, false)).toBe(4)
  })
  it('adds today once it is met', () => {
    expect(countStreak(results, today, true)).toBe(5)
  })
  it('is broken by a missed or unscored yesterday', () => {
    expect(countStreak({ ...results, '2026-11-06': false }, today, false)).toBe(0)
    expect(countStreak({ '2026-11-05': true }, today, true)).toBe(1)
  })
  it('crosses month boundaries', () => {
    expect(countStreak({ '2026-11-01': true, '2026-10-31': true, '2026-10-30': true }, '2026-11-02', false)).toBe(3)
  })
})

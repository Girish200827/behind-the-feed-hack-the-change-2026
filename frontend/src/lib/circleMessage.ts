// Builds the exact messages shared with a Scroll Circle (Discord). Pure functions.
// Privacy rule: a message may contain only the display name, today's goal, whether it was met, the streak,
// the change in drained time vs last week and an encouraging line. Never emotions per moment, content topics,
// screenshots or raw samples. The inputs below are the only things these functions can see.
import type { DiscordPayload } from '../types/bridge'

export const CIRCLE_BOT_NAME = 'BehindFeed'

export type GoalOutcome = 'met' | 'in-progress' | 'missed'

export interface ProgressInput {
  displayName: string
  goalTitle: string
  outcome: GoalOutcome
  streak: number
  /** Relative change in drained time vs last week (-0.2 = 20% less), or null if unknown. */
  drainedChange: number | null
}

const ENCOURAGE = {
  met: ['Small steps add up.', 'That counts. Proud of you.', 'People over feeds. Nice work.'],
  'in-progress': ['Still going. Rooting for you.', 'One small step at a time.', 'Halfway there is still there.'],
  missed: ['Tomorrow is a fresh start.', 'Be kind to yourself. Try again tomorrow.', 'Every day is a new chance.']
} as const

/** Display names are trimmed, single-line and short; mentions can't be smuggled in. */
export function cleanName(name: string): string {
  const n = name.replace(/[\r\n@`*_~|>#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32)
  return n || 'A friend'
}

const outcomeText = (o: GoalOutcome) => (o === 'met' ? 'done' : o === 'missed' ? 'not this time' : 'in progress')

function changeLine(change: number | null): string | null {
  if (change === null || !Number.isFinite(change)) return null
  const pct = Math.round(Math.abs(change) * 100)
  if (pct === 0) return 'Drained time this week: about the same as last week'
  return change < 0 ? `Drained time this week: ${pct}% less than last week` : `Drained time this week: ${pct}% more than last week`
}

export function buildProgressMessage(input: ProgressInput): DiscordPayload {
  const name = cleanName(input.displayName)
  const lines = [
    `**${name}** shared a BehindFeed check-in`,
    `Today's goal: ${input.goalTitle.replace(/\s+/g, ' ').trim().slice(0, 120)} (${outcomeText(input.outcome)})`,
    `Streak: ${input.streak} ${input.streak === 1 ? 'day' : 'days'} in a row`,
    changeLine(input.drainedChange),
    ENCOURAGE[input.outcome][input.streak % ENCOURAGE[input.outcome].length]
  ].filter((l): l is string => l !== null)
  return { username: CIRCLE_BOT_NAME, content: lines.join('\n') }
}

export type ChallengeId = 'scroll-less-week' | 'swap-for-call'

export const CHALLENGES: Record<ChallengeId, { title: string; blurb: string }> = {
  'scroll-less-week': { title: 'Scroll less week', blurb: 'Everyone aims for a little less draining scrolling each day for 7 days.' },
  'swap-for-call': { title: 'Swap 1 session for a call', blurb: 'This week, trade one scroll session for a call with someone in the circle.' }
}

export function buildChallengeInvite(displayName: string, id: ChallengeId): DiscordPayload {
  const name = cleanName(displayName)
  const c = CHALLENGES[id]
  return {
    username: CIRCLE_BOT_NAME,
    content: [`**${name}** started a challenge: **${c.title}**`, c.blurb, 'Join in by sharing your check-ins here. Go gently, together.'].join('\n')
  }
}

// Scroll Circle: settings, the share path and the demo feed. Settings and the sent log stay on this device
// (localStorage, try/catch). Sending goes through the Electron main process via the preload bridge.
import type { DiscordPayload, BehindFeedBridge, SendResult } from '../types/bridge'
import { KEYS, readJson, writeJson } from './localStore'

export interface CircleSettings {
  webhookUrl: string
  displayName: string
}

export interface SentItem {
  at: number
  content: string
}

export interface CircleSample {
  name: string
  /** Minutes ago, for a natural-looking demo. */
  minutesAgo: number
  content: string
  sample: true
}

const bridge = (): BehindFeedBridge | undefined => (window as unknown as { behindfeed?: BehindFeedBridge }).behindfeed

export const getCircleSettings = (): CircleSettings => ({ webhookUrl: '', displayName: '', ...readJson<Partial<CircleSettings>>(KEYS.circle, {}) })

export const saveCircleSettings = (s: CircleSettings) => writeJson(KEYS.circle, { webhookUrl: s.webhookUrl.trim(), displayName: s.displayName.trim() })

export const getSentLog = (): SentItem[] => readJson<SentItem[]>(KEYS.circleSent, [])

/** Sends a message to the configured webhook. Only `payload` leaves the device. */
export async function shareToCircle(payload: DiscordPayload): Promise<SendResult> {
  const { webhookUrl } = getCircleSettings()
  const b = bridge()
  if (!b) return { ok: false, error: 'unavailable', message: 'Sharing works in the BehindFeed desktop app.' }
  if (!webhookUrl) return { ok: false, error: 'invalid-url', message: 'Add a Discord webhook URL first.' }
  const result = await b.sendToCircle(webhookUrl, payload)
  if (result.ok) writeJson(KEYS.circleSent, [{ at: Date.now(), content: payload.content }, ...getSentLog()].slice(0, 20))
  return result
}

/** Sample circle messages for demo mode (no webhook set). Clearly labelled as samples in the UI. */
export function getSampleCircleFeed(): CircleSample[] {
  return [
    {
      name: 'Maya',
      minutesAgo: 12,
      sample: true,
      content: "Today's goal: Swap one scroll session for a call or text (done)\nStreak: 6 days in a row\nCalled my sister instead of doom-scrolling at lunch."
    },
    {
      name: 'Jordan',
      minutesAgo: 48,
      sample: true,
      content: "Today's goal: No scrolling after 11 PM (in progress)\nStreak: 2 days in a row\nDrained time this week: 22% less than last week"
    },
    {
      name: 'Priya',
      minutesAgo: 95,
      sample: true,
      content: 'Started a challenge: Scroll less week\nAnyone want to join? Check-ins here every evening.'
    }
  ]
}

// Posts a BehindFeed message to a Discord webhook. Runs in the Electron main process (no CORS there).
// Plain Node: no Electron imports, so tests can call it against a local HTTP server.
import type { DiscordPayload, SendResult } from '../src/types/bridge'
import { isDiscordWebhookUrl } from '../src/lib/webhookUrl'

interface Options {
  /** Tests only: allow a non-Discord URL such as http://127.0.0.1:port. */
  allowAnyUrl?: boolean
  timeoutMs?: number
}

const MAX_CONTENT = 2000 // Discord's limit for message content

/** Validates the payload shape so nothing else can be smuggled into the request body. */
export function cleanPayload(p: unknown): DiscordPayload | null {
  if (!p || typeof p !== 'object') return null
  const { username, content } = p as Record<string, unknown>
  if (typeof username !== 'string' || typeof content !== 'string') return null
  if (!content.trim() || content.length > MAX_CONTENT || username.length > 80) return null
  return { username, content }
}

export async function sendWebhook(url: string, payload: unknown, opts: Options = {}): Promise<SendResult> {
  if (typeof url !== 'string' || (!opts.allowAnyUrl && !isDiscordWebhookUrl(url))) {
    return { ok: false, error: 'invalid-url', message: "That doesn't look like a Discord webhook URL. Copy it from Server Settings → Integrations → Webhooks." }
  }
  const body = cleanPayload(payload)
  if (!body) return { ok: false, error: 'rejected', message: 'The message is empty or too long to share.' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // allowed_mentions: never ping @everyone/@here or users, whatever the text says.
      body: JSON.stringify({ ...body, allowed_mentions: { parse: [] } }),
      signal: controller.signal
    })
    if (res.ok) return { ok: true }
    const message =
      res.status === 401 || res.status === 403 || res.status === 404
        ? 'Discord did not accept this webhook. It may have been deleted, or the URL is incomplete.'
        : res.status === 429
          ? 'Discord is limiting messages right now. Try again in a minute.'
          : `Discord returned an error (${res.status}). Try again later.`
    return { ok: false, error: 'rejected', message, status: res.status }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return { ok: false, error: 'timeout', message: 'Discord took too long to answer. Check your connection and try again.' }
    return { ok: false, error: 'offline', message: "Couldn't reach Discord. Check your internet connection and try again." }
  } finally {
    clearTimeout(timer)
  }
}

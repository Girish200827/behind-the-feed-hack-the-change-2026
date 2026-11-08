// Types shared by the Electron main process, the preload script and the renderer.

/** What we post to a Discord webhook. Only these fields are ever sent. */
export interface DiscordPayload {
  username: string
  content: string
}

export type SendError = 'invalid-url' | 'offline' | 'rejected' | 'timeout' | 'unavailable'

export type SendResult = { ok: true } | { ok: false; error: SendError; message: string; status?: number }

/** The API the preload script exposes on window.scrollMood. */
export interface ScrollMoodBridge {
  sendToCircle(webhookUrl: string, payload: DiscordPayload): Promise<SendResult>
  notify(title: string, body: string): Promise<void>
}

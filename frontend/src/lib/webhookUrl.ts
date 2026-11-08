// Discord webhook URL check, shared by the renderer (form hint) and the main process (enforced before sending).

const HOSTS = new Set(['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com'])

/** https://discord.com/api/webhooks/{id}/{token} (optionally /api/v10/webhooks/...). */
export function isDiscordWebhookUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return false
  }
  return url.protocol === 'https:' && HOSTS.has(url.hostname) && /^\/api\/(v\d+\/)?webhooks\/\d+\/[\w-]+\/?$/.test(url.pathname)
}

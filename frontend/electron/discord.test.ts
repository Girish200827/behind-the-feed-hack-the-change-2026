// Tests the real Discord send path against a tiny local HTTP server (no Discord needed).
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { sendWebhook } from './discord'
import { isDiscordWebhookUrl } from '../src/lib/webhookUrl'
import { buildProgressMessage } from '../src/lib/circleMessage'
import { FEATURES } from '../src/config/features'

// Scroll Circle is behind VITE_ENABLE_CIRCLE; its tests only run when it's on.
const describeCircle = describe.skipIf(!FEATURES.circle)

interface Received {
  method?: string
  url?: string
  contentType?: string
  body: unknown
}

let server: Server | null = null

/** Starts a server that records requests and answers with `status`. Resolves to its base URL. */
function startServer(status = 204): Promise<{ base: string; received: Received[] }> {
  const received: Received[] = []
  server = createServer((req: IncomingMessage, res) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      received.push({ method: req.method, url: req.url, contentType: req.headers['content-type'], body: JSON.parse(data || 'null') })
      res.statusCode = status
      res.end()
    })
  })
  return new Promise((resolve) =>
    server!.listen(0, '127.0.0.1', () => resolve({ base: `http://127.0.0.1:${(server!.address() as AddressInfo).port}`, received }))
  )
}

const stop = () => new Promise<void>((r) => (server ? server.close(() => r()) : r()))
afterEach(async () => {
  await stop()
  server = null
})

const payload = buildProgressMessage({ displayName: 'Ahmad', goalTitle: 'No scrolling after 11 PM', outcome: 'met', streak: 4, drainedChange: -0.2 })

describeCircle('sendWebhook', () => {
  it('POSTs exactly the message JSON (plus no-mentions) to the webhook', async () => {
    const { base, received } = await startServer(204)
    const result = await sendWebhook(`${base}/api/webhooks/123/abc`, payload, { allowAnyUrl: true })
    expect(result).toEqual({ ok: true })
    expect(received).toHaveLength(1)
    expect(received[0].method).toBe('POST')
    expect(received[0].url).toBe('/api/webhooks/123/abc')
    expect(received[0].contentType).toBe('application/json')
    expect(received[0].body).toEqual({ username: 'BehindFeed', content: payload.content, allowed_mentions: { parse: [] } })
  })

  it('strips anything extra a caller tries to add to the payload', async () => {
    const { base, received } = await startServer(204)
    await sendWebhook(`${base}/w`, { ...payload, embeds: [{ title: 'raw samples' }], tts: true }, { allowAnyUrl: true })
    expect(Object.keys(received[0].body as object).sort()).toEqual(['allowed_mentions', 'content', 'username'])
  })

  it('reports "offline" when nothing is listening', async () => {
    const { base, received } = await startServer()
    await stop()
    const result = await sendWebhook(`${base}/api/webhooks/1/x`, payload, { allowAnyUrl: true })
    expect(result).toMatchObject({ ok: false, error: 'offline' })
    expect(received).toHaveLength(0)
  })

  it('reports a rejected webhook (e.g. deleted) with a friendly message', async () => {
    const { base } = await startServer(404)
    const result = await sendWebhook(`${base}/api/webhooks/1/x`, payload, { allowAnyUrl: true })
    expect(result).toMatchObject({ ok: false, error: 'rejected', status: 404 })
    if (!result.ok) expect(result.message).toMatch(/deleted|incomplete/)
  })

  it('refuses non-Discord URLs in the app (no request is made)', async () => {
    const { base, received } = await startServer(204)
    const result = await sendWebhook(`${base}/api/webhooks/1/x`, payload)
    expect(result).toMatchObject({ ok: false, error: 'invalid-url' })
    expect(received).toHaveLength(0)
  })

  it('refuses empty or oversized messages', async () => {
    const { base, received } = await startServer(204)
    expect(await sendWebhook(`${base}/w`, { username: 'BehindFeed', content: '  ' }, { allowAnyUrl: true })).toMatchObject({ ok: false })
    expect(await sendWebhook(`${base}/w`, { username: 'BehindFeed', content: 'x'.repeat(2001) }, { allowAnyUrl: true })).toMatchObject({ ok: false })
    expect(received).toHaveLength(0)
  })
})

describeCircle('isDiscordWebhookUrl', () => {
  it.each([
    ['https://discord.com/api/webhooks/1234567890/abcDEF-123_x', true],
    ['https://discordapp.com/api/webhooks/1/token', true],
    ['https://discord.com/api/v10/webhooks/1/token', true],
    ['http://discord.com/api/webhooks/1/token', false],
    ['https://evil.com/api/webhooks/1/token', false],
    ['https://discord.com.evil.com/api/webhooks/1/token', false],
    ['https://discord.com/channels/1/2', false],
    ['not a url', false]
  ])('%s → %s', (url, ok) => expect(isDiscordWebhookUrl(url)).toBe(ok))
})

// Generates realistic mock data in the four contract formats.
//   node scripts/generate-mock.mjs
// Writes:
//   src/mock/realistic.json  two weeks of scrolling (14 days x 3-6 sessions) across all five platforms, 1 Hz samples
//   src/mock/live.json       one session still in progress (end: null)
// Seeded, so the output is the same every run. The mock source shifts the week so its last day is "today".
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../src/mock')

// ── Random helpers (mulberry32 + gaussian) ─────────────────────────────
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const r = rng(2026)
const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
const between = (a, b) => a + r() * (b - a)
const pick = (xs) => xs[Math.floor(r() * xs.length)]
const round2 = (n) => Math.round(n * 100) / 100
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

const VALENCE = { happy: 0.62, surprise: 0.3, neutral: 0.04, sad: -0.55, angry: -0.68, fear: -0.5, disgust: -0.45 }

// Emotion a piece of content tends to cause.
const EMOTION_FOR = {
  news: ['sad', 'fear', 'sad'],
  politics: ['angry', 'angry', 'disgust'],
  drama: ['disgust', 'angry', 'sad'],
  comedy: ['happy', 'happy', 'surprise'],
  friends: ['happy', 'happy', 'surprise'],
  food: ['happy', 'surprise'],
  fitness: ['happy', 'neutral'],
  ads: ['neutral'],
  other: ['neutral', 'surprise']
}

// ── What each platform tends to show (category, tone, topics, weight) ──
const C = (category, tone, weight, topics) => ({ category, tone, weight, topics })
const POOLS = {
  // X: news and politics, drains.
  x: [
    C('news', 'negative', 5, ['inflation report reactions', 'layoff announcements thread', 'storm damage photos', 'housing costs thread']),
    C('politics', 'negative', 4, [
      'election poll arguments',
      'heated city council debate over transit funding, bike lanes and a proposed property tax increase',
      'quote-tweet pile-on about a minister'
    ]),
    C('comedy', 'positive', 1, ['meme of the day']),
    C('other', 'neutral', 1, ['tech product launch'])
  ],
  // YouTube: comedy and food, lifts.
  youtube: [
    C('comedy', 'positive', 5, ['stand-up special clip', 'sketch comedy compilation', 'pets being dramatic']),
    C('food', 'positive', 3, ['15-minute ramen recipe', 'street food tour in Osaka', 'sourdough for beginners']),
    C('fitness', 'positive', 1, ['beginner yoga flow']),
    C('ads', 'neutral', 1, ['meal kit ad']),
    C('news', 'negative', 1, ['news recap'])
  ],
  // TikTok: mixed by day, drains late at night (see drift below).
  tiktok: [
    C('comedy', 'positive', 4, ['dog reacting to bath time', 'office prank', 'dance trend fail']),
    C('food', 'positive', 2, ['one-pan pasta hack']),
    C('drama', 'negative', 3, ['celebrity breakup comment war', 'influencer apology video', 'storytime about a bad roommate']),
    C('ads', 'neutral', 2, ['skincare ad', 'phone case ad']),
    C('news', 'negative', 1, ['wildfire evacuation footage'])
  ],
  // Instagram: friends lift, comparison and ads dip.
  instagram: [
    C('friends', 'positive', 5, ["college roommate's wedding photos", "cousin's new puppy", 'friends at a concert']),
    C('fitness', 'neutral', 2, ['morning mobility routine', 'gym transformation reel']),
    C('drama', 'negative', 2, ['influencer vacation comparison', 'curated luxury haul']),
    C('ads', 'neutral', 2, ['running shoe ad', 'sunglasses ad'])
  ],
  // Facebook: family lifts, politics drains.
  facebook: [
    C('friends', 'positive', 4, ['family reunion album', "aunt's garden photos", 'school fundraiser update']),
    C('politics', 'negative', 3, ['comment fight under a local news post', 'property tax post in neighbourhood group']),
    C('news', 'negative', 1, ['road closure updates']),
    C('other', 'neutral', 2, ['marketplace listings'])
  ]
}

// ── Daily schedule ──────────────────────────────────────────────────
// [startHour range, platforms likely at that time, duration range in minutes]
const SLOTS = {
  morning: { h: [7.0, 8.4], platforms: ['x', 'x', 'instagram', 'facebook'], dur: [5, 14] },
  commute: { h: [9.0, 9.6], platforms: ['instagram', 'tiktok', 'x'], dur: [4, 9] },
  lunch: { h: [12.0, 12.8], platforms: ['youtube', 'youtube', 'instagram', 'tiktok'], dur: [8, 20] },
  afternoon: { h: [15.4, 16.6], platforms: ['facebook', 'x', 'instagram'], dur: [4, 10] },
  evening: { h: [19.0, 20.8], platforms: ['youtube', 'instagram', 'tiktok', 'facebook'], dur: [10, 25] },
  late: { h: [23.0, 23.5], platforms: ['tiktok'], dur: [15, 30] }
}
const ORDER = ['morning', 'commute', 'lunch', 'afternoon', 'evening', 'late']

let switchNo = 1000
let sessionNo = 100

function weighted(pool, progress, lateNight) {
  // Late at night, draining content gets more likely as the session goes on.
  const w = pool.map((c) => c.weight * (lateNight && c.tone === 'negative' ? 1 + progress * 3 : 1))
  let x = r() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) if ((x -= w[i]) <= 0) return pool[i]
  return pool[pool.length - 1]
}

function buildSession(platform, start, durationS, slot) {
  const lateNight = slot === 'late'
  const sessionId = `s_${sessionNo++}`
  const events = [{ id: sessionId, platform, start, end: start + durationS }]
  let emotion = 'neutral'
  let valence = VALENCE.neutral + gauss() * 0.1
  let drift = 0
  let lowConf = 0
  let nextMoment = between(20, 60)

  for (let s = 0; s < durationS; s++) {
    const progress = s / durationS

    // New content → maybe a new mood. A switch is reported once the mood has held 2 s.
    if (s >= nextMoment) {
      const content = weighted(POOLS[platform], progress, lateNight)
      const to = pick(EMOTION_FOR[content.category])
      if (to !== emotion) {
        const id = `sw_${switchNo++}`
        const ts = start + s + 2
        events.push({ id, ts, from: emotion, to, platform })
        if (r() > 0.07) {
          events.push({
            switch_id: id,
            ts: round2(ts + between(0.3, 1.5)),
            platform,
            category: content.category,
            tone: content.tone,
            topic: pick(content.topics)
          })
        }
        emotion = to
      }
      nextMoment = s + between(50, 200)
    }

    // Valence eases toward the mood, with slow drift, per-second jitter and (late at night) a slow slide down.
    drift = clamp(drift * 0.97 + gauss() * 0.015, -0.15, 0.15)
    const slide = lateNight ? -0.5 * Math.max(0, (progress - 0.25) / 0.75) : 0
    valence += (clamp(VALENCE[emotion] + slide, -1, 1) + drift - valence) * 0.22
    const v = clamp(valence + gauss() * 0.09, -1, 1)

    // Confidence: mostly 0.7-0.9 with short dips (looking away, low light; worse late at night).
    if (lowConf === 0 && r() < (lateNight ? 0.02 : 0.012)) lowConf = 2 + Math.floor(r() * 7)
    const conf = lowConf > 0 ? 0.15 + r() * 0.23 : clamp(0.8 + gauss() * 0.06, 0.41, 0.97)
    if (lowConf > 0) lowConf--

    const shown = r() < 0.05 ? 'neutral' : emotion
    events.push({ ts: round2(start + s + 0.5), emotion: shown, valence: round2(v), confidence: round2(conf) })
  }
  return events
}

// ── A week ending on the anchor day (local time of the machine running this script) ──
const ANCHOR = { y: 2026, m: 10, d: 7 } // Nov 7 2026; the mock source moves it to "today"
// Wall-clock times are written for a fixed UTC offset, not Node's local zone (Node on Windows may lack tz data).
// Default -6 = Calgary (America/Edmonton) as Electron resolves it in Nov 2026. Override: MOCK_UTC_OFFSET=-7 node ...
const UTC_OFFSET_H = Number(process.env.MOCK_UTC_OFFSET ?? -6)
const wallClock = (y, m, d, h, min, s) => Date.UTC(y, m, d, h, min, s) - UTC_OFFSET_H * 3600 * 1000
// Two weeks, so "this week vs last week" has something to compare. Last week (7-13 days back) had a late-night
// TikTok session every day, so this week reads as a gentle improvement.
const week = []
for (let back = 13; back >= 0; back--) {
  const count = 3 + Math.floor(r() * 4) // 3-6 sessions
  const optional = ['commute', 'lunch', 'afternoon', 'late'].sort(() => r() - 0.5)
  const chosen = new Set(['morning', 'evening', ...optional.slice(0, count - 2), ...(back >= 7 ? ['late'] : [])])
  for (const slot of ORDER.filter((s) => chosen.has(s))) {
    const cfg = SLOTS[slot]
    const hour = between(cfg.h[0], cfg.h[1])
    const start = Math.floor(wallClock(ANCHOR.y, ANCHOR.m, ANCHOR.d - back, Math.floor(hour), Math.floor((hour % 1) * 60), Math.floor(r() * 60)) / 1000)
    const minutes = between(cfg.dur[0], cfg.dur[1])
    week.push(...buildSession(pick(cfg.platforms), start, Math.round(minutes * 60), slot))
  }
}

// ── A session in progress (end: null). The mock source shifts it to end "now". ──
sessionNo = 900
switchNo = 9000
const live = buildSession('youtube', 1794080000, 240, 'lunch')
live[0].end = null

const write = (name, events) => {
  const sorted = events.sort((a, b) => (a.ts ?? a.start) - (b.ts ?? b.start))
  writeFileSync(join(outDir, name), '[\n' + sorted.map((e) => JSON.stringify(e)).join(',\n') + '\n]\n')
}
write('realistic.json', week)
write('live.json', live)

const sessions = week.filter((e) => 'start' in e)
console.log(`realistic.json: ${sessions.length} sessions, ${week.length} events; live.json: ${live.length} events`)

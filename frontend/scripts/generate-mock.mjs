// Generates realistic mock sessions in the four contract formats.
//   node scripts/generate-mock.mjs
// Writes src/mock/realistic.json (20 min, finished) and src/mock/live.json (in progress, end: null).
// Seeded, so the output is the same every run.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../src/mock')

// Deterministic PRNG (mulberry32) + gaussian noise.
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
const round2 = (n) => Math.round(n * 100) / 100
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

const VALENCE = { happy: 0.62, surprise: 0.3, neutral: 0.04, sad: -0.55, angry: -0.68, fear: -0.5, disgust: -0.45 }

/**
 * moments: [{ at: secondsIntoSession, to: emotion, label?: {category, tone, topic} }]
 * The mood switch fires 2 s after the mood starts (when it has held 2 s).
 */
function buildSession({ id, platform, start, duration, end, startEmotion, moments, firstSwitch, seed }) {
  const r = rng(seed)
  const events = [{ id, platform, start, end }]
  let emotion = startEmotion
  let valence = VALENCE[startEmotion]
  let drift = 0
  let lowConfLeft = 0
  let m = 0
  let switchNo = firstSwitch

  for (let s = 0; s < duration; s++) {
    // Mood changes at each moment.
    if (m < moments.length && s >= moments[m].at) {
      const mo = moments[m]
      const swId = `sw_${String(switchNo++).padStart(4, '0')}`
      const ts = start + mo.at + 2
      events.push({ id: swId, ts, from: emotion, to: mo.to, platform })
      if (mo.label) events.push({ switch_id: swId, ts: round2(ts + 0.4 + r() * 0.8), platform, ...mo.label })
      emotion = mo.to
      m++
    }
    // Valence eases toward the current mood with slow drift and per-second jitter.
    drift = clamp(drift * 0.97 + gauss(r) * 0.015, -0.15, 0.15)
    valence += (VALENCE[emotion] + drift - valence) * 0.22
    const v = clamp(valence + gauss(r) * 0.09, -1, 1)

    // Confidence: mostly 0.7-0.9, with occasional short dips (looking away, bad light).
    if (lowConfLeft === 0 && r() < 0.012) lowConfLeft = 2 + Math.floor(r() * 7)
    const conf = lowConfLeft > 0 ? 0.15 + r() * 0.23 : clamp(0.8 + gauss(r) * 0.06, 0.41, 0.97)
    if (lowConfLeft > 0) lowConfLeft--

    // The classifier's label flickers to neutral now and then.
    const shown = r() < 0.05 ? 'neutral' : emotion
    events.push({ ts: round2(start + s + 0.5), emotion: shown, valence: round2(v), confidence: round2(conf) })
  }
  return events.sort((a, b) => (a.ts ?? a.start) - (b.ts ?? b.start))
}

const L = (category, tone, topic) => ({ category, tone, topic })

// ── 20-minute TikTok session, finished (Sat Nov 7 2026, late morning MT) ──
const realistic = buildSession({
  id: 's_032',
  platform: 'tiktok',
  start: 1794076200,
  duration: 1200,
  end: 1794077400,
  startEmotion: 'neutral',
  firstSwitch: 200,
  seed: 31,
  moments: [
    { at: 70, to: 'sad', label: L('news', 'negative', 'interest rate hike explainer') },
    { at: 160, to: 'happy', label: L('comedy', 'positive', 'stand-up bit about airport security') },
    { at: 250, to: 'surprise', label: L('other', 'positive', 'street magic trick reveal') },
    { at: 265, to: 'happy', label: L('friends', 'positive', "college roommate's wedding photos") },
    {
      at: 380,
      to: 'angry',
      label: L('politics', 'negative', 'heated city council debate over transit funding, bike lanes and a proposed property tax increase')
    },
    { at: 500, to: 'neutral', label: L('ads', 'neutral', 'running shoe ad') },
    { at: 610, to: 'fear', label: L('news', 'negative', 'wildfire evacuation footage') },
    { at: 625, to: 'sad' }, // no label: the screen labeller never sent one
    { at: 760, to: 'happy', label: L('food', 'positive', '15-minute ramen recipe') },
    { at: 880, to: 'disgust', label: L('drama', 'negative', 'celebrity breakup comment war') },
    { at: 1000, to: 'neutral', label: L('fitness', 'neutral', 'morning mobility routine') },
    { at: 1110, to: 'happy', label: L('comedy', 'positive', 'dog reacting to bath time') }
  ]
})

// ── 4-minute YouTube session still in progress (end: null). The mock source shifts it to end "now". ──
const live = buildSession({
  id: 's_033',
  platform: 'youtube',
  start: 1794080000,
  duration: 240,
  end: null,
  startEmotion: 'neutral',
  firstSwitch: 300,
  seed: 77,
  moments: [
    { at: 40, to: 'happy', label: L('comedy', 'positive', 'sketch comedy compilation') },
    { at: 130, to: 'sad', label: L('news', 'negative', 'housing market slowdown') },
    { at: 215, to: 'neutral' } // label still pending: just happened
  ]
})

writeFileSync(join(outDir, 'realistic.json'), JSON.stringify(realistic, null, 0).replace(/},{/g, '},\n{'))
writeFileSync(join(outDir, 'live.json'), JSON.stringify(live, null, 0).replace(/},{/g, '},\n{'))
console.log(`realistic.json: ${realistic.length} events, live.json: ${live.length} events`)

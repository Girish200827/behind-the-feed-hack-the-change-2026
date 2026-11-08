import { ArrowDownRight, ArrowUpRight, Minus, Sparkles, TrendingDown, type LucideIcon } from 'lucide-react'
import type { Insights } from '../../data'
import { capitalize, platformName } from '../../lib/format'

interface Card {
  icon: LucideIcon
  tone: 'positive' | 'negative' | 'neutral'
  title: string
  body: string
}

const amount = (d: number) => (d < 0.15 ? 'a little' : d < 0.35 ? 'noticeably' : 'much')

/** 2–3 plain-language findings. Mood signals, not a diagnosis, so the wording stays gentle. */
export function buildInsightCards(ins: Insights): Card[] {
  const cards: Card[] = []
  const top = ins.triggers.find((t) => t.negative > 0)
  if (top) {
    cards.push({
      icon: TrendingDown,
      tone: 'negative',
      title: `${capitalize(top.category)} drains you most`,
      body: `Your mood dipped after ${top.negative} of ${top.switches} ${top.category} moments (${Math.round(top.triggerScore * 100)}%).`
    })
  }
  if (ins.avgMoodChange !== null) {
    const c = ins.avgMoodChange
    cards.push(
      Math.abs(c) < 0.05
        ? { icon: Minus, tone: 'neutral', title: 'Your mood holds steady', body: 'On average you end a session feeling about the same as you started.' }
        : c < 0
          ? { icon: ArrowDownRight, tone: 'negative', title: 'Sessions tend to leave you lower', body: `On average your mood signal is ${amount(-c)} lower in the last minute than in the first.` }
          : { icon: ArrowUpRight, tone: 'positive', title: 'Sessions tend to lift you', body: `On average your mood signal is ${amount(c)} higher in the last minute than in the first.` }
    )
  }
  const rated = ins.platformMix.filter((p) => p.avgValence !== undefined).sort((a, b) => (b.avgValence ?? 0) - (a.avgValence ?? 0))
  if (rated.length >= 2) {
    const best = rated[0]
    const worst = rated[rated.length - 1]
    cards.push({
      icon: Sparkles,
      tone: 'positive',
      title: `You feel best on ${platformName(best.platform)}`,
      body: `And lowest on ${platformName(worst.platform)}. Worth noticing where your time goes.`
    })
  } else if (ins.longest) {
    cards.push({
      icon: Sparkles,
      tone: 'neutral',
      title: `Longest scroll: ${Math.round(ins.longest.minutes)} min`,
      body: `On ${platformName(ins.longest.platform)}. Shorter sessions tend to feel better.`
    })
  }
  return cards.slice(0, 3)
}

const TONE_COLOR = { positive: 'var(--positive-ink)', negative: 'var(--negative-ink)', neutral: 'var(--ink-2)' } as const

export default function InsightCards({ insights }: { insights: Insights }) {
  const cards = buildInsightCards(insights)
  if (!cards.length) return null
  return (
    <div className={`grid gap-3 ${cards.length === 3 ? 'grid-cols-3' : cards.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {cards.map((c) => (
        <section key={c.title} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-hairline bg-surface px-6 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface-2" style={{ color: TONE_COLOR[c.tone] }}>
            <c.icon size={15} strokeWidth={1.75} />
          </span>
          <h3 className="text-[16px] font-medium leading-snug tracking-[-0.01em] text-ink">{c.title}</h3>
          <p className="text-[13px] leading-relaxed text-muted">{c.body}</p>
        </section>
      ))}
    </div>
  )
}

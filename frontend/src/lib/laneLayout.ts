// Moment chip layouts for the mood ribbon's lane. Chips never overlap.
//  - layoutLane: one session on a time axis. Chips sit under their switch, in ≤ MAX_ROWS rows; whatever can't fit
//    merges with its nearest neighbour into a cluster chip ("3 moments").
//  - layoutSessionLanes: the day view. Each session's chips start at its panel's left edge, one row per session
//    where possible; chips that don't fit in the session's space collapse into a trailing "+N moments" chip.
import type { MoodSwitch } from '../types/contracts'

export const MAX_ROWS = 2
const GAP = 8

export interface LaneGroup {
  key: string
  members: MoodSwitch[]
  /** Centre x of the chip. */
  cx: number
  left: number
  width: number
  row: number
  /** A cluster that follows single chips of the same session ("+N moments"). */
  plus?: boolean
}

interface Opts {
  xOf: (sw: MoodSwitch) => number
  singleWidth: (sw: MoodSwitch) => number
  clusterWidth: (n: number) => number
  minLeft: number
  maxRight: number
}

function place(groups: MoodSwitch[][], o: Opts): LaneGroup[] {
  const rowEnds = Array<number>(MAX_ROWS).fill(-Infinity)
  return groups.map((members) => {
    const cx = members.reduce((a, sw) => a + o.xOf(sw), 0) / members.length
    const width = members.length === 1 ? o.singleWidth(members[0]) : o.clusterWidth(members.length)
    const left = Math.min(Math.max(cx - width / 2, o.minLeft), o.maxRight - width)
    const row = rowEnds.findIndex((end) => left >= end + GAP)
    if (row !== -1) rowEnds[row] = left + width
    return { key: members.map((m) => m.id).join('+'), members, cx, left, width, row }
  })
}

/** switches must be sorted by ts. */
export function layoutLane(switches: MoodSwitch[], o: Opts): LaneGroup[] {
  let groups = switches.map((sw) => [sw])
  for (let guard = 0; guard <= switches.length; guard++) {
    const placed = place(groups, o)
    const i = placed.findIndex((g) => g.row === -1)
    if (i === -1) return placed
    // Merge the chip that didn't fit with whichever neighbour is closer in time.
    const prev = placed[i - 1]
    const next = placed[i + 1]
    const j = !next || (prev && placed[i].cx - prev.cx <= next.cx - placed[i].cx) ? i - 1 : i + 1
    const [a, b] = [Math.min(i, j), Math.max(i, j)]
    groups = [...groups.slice(0, a), [...groups[a], ...groups[b]], ...groups.slice(b + 1)]
  }
  // Unreachable in practice (one group always fits); keep everything visible just in case.
  return place(groups, o).map((g) => ({ ...g, row: Math.max(g.row, 0) }))
}

export interface SessionLane {
  switches: MoodSwitch[]
  /** Panel left edge. */
  x0: number
  /** Furthest the session's chips may reach (the next panel's left edge minus a gap, or the chart's right edge). */
  maxRight: number
}

export function layoutSessionLanes(
  lanes: SessionLane[],
  o: { singleWidth: (sw: MoodSwitch) => number; clusterWidth: (n: number) => number; chartRight: number }
): LaneGroup[] {
  const rowEnds: number[] = []
  const out: LaneGroup[] = []
  for (const lane of lanes) {
    const sws = lane.switches
    if (!sws.length) continue
    const room = lane.maxRight - lane.x0
    const widths = sws.map(o.singleWidth)

    // As many single chips as fit, then a "+N moments" chip for the rest (or one cluster for all).
    let k = sws.length
    const total = (n: number) => widths.slice(0, n).reduce((a, w) => a + w + GAP, 0)
    if (total(sws.length) - GAP > room) {
      k = sws.length - 1
      while (k > 0 && total(k) + o.clusterWidth(sws.length - k) > room) k--
    }
    const chips: { members: MoodSwitch[]; width: number; plus?: boolean }[] = sws
      .slice(0, k)
      .map((sw, i) => ({ members: [sw], width: widths[i] }))
    if (k < sws.length) {
      const rest = sws.slice(k)
      chips.push(
        rest.length === 1
          ? { members: rest, width: widths[k] }
          : { members: rest, width: o.clusterWidth(rest.length), plus: k > 0 }
      )
    }

    // One row for the session: the first row whose end is left of this panel.
    const rowWidth = chips.reduce((a, c) => a + c.width + GAP, 0) - GAP
    // Start at the panel's left edge, unless that would run past the chart's right edge.
    const start = Math.min(lane.x0, o.chartRight - rowWidth)
    let row = rowEnds.findIndex((end) => start >= end + GAP)
    if (row === -1) row = rowEnds.length
    rowEnds[row] = start + rowWidth

    let left = start
    for (const c of chips) {
      out.push({
        key: c.members.map((m) => m.id).join('+'),
        members: c.members,
        cx: left + c.width / 2,
        left,
        width: c.width,
        row,
        plus: c.plus
      })
      left += c.width + GAP
    }
  }
  return out
}

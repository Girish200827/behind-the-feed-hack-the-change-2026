// Packs moment chips into at most MAX_ROWS rows on a shared time axis, never overlapping.
// When a chip can't fit, it merges with its nearest neighbour into a cluster chip ("3 moments").
import type { MoodSwitch } from '../types/contracts'

export const MAX_ROWS = 2
const GAP = 8

export interface LaneGroup {
  key: string
  members: MoodSwitch[]
  /** Centre x of the chip (mean of member positions). */
  cx: number
  left: number
  width: number
  row: number
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

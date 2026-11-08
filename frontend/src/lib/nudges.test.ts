import { describe, expect, it } from 'vitest'
import { findDrainingStretches, ongoingStretch, suggestionAt, NUDGE_SUGGESTIONS } from './nudges'
import { samples } from '../test/fixtures'

const T = 1_794_000_000

describe('draining-stretch detection', () => {
  it('detects 6 minutes below neutral', () => {
    const s = [...samples(T, 60, 0.3), ...samples(T + 60, 360, -0.4), ...samples(T + 420, 60, 0.2)]
    const found = findDrainingStretches(s)
    expect(found).toHaveLength(1)
    expect(found[0].seconds).toBeGreaterThanOrEqual(359)
    expect(found[0].start).toBeCloseTo(T + 60.5)
  })

  it('ignores 4 minutes below neutral', () => {
    expect(findDrainingStretches([...samples(T, 240, -0.4), ...samples(T + 240, 60, 0.3)])).toEqual([])
  })

  it('a moment above neutral splits the stretch', () => {
    const s = [...samples(T, 200, -0.4), ...samples(T + 200, 10, 0.2), ...samples(T + 210, 200, -0.4)]
    expect(findDrainingStretches(s)).toEqual([])
  })

  it('a long gap in the readings splits the stretch, a short one does not', () => {
    const shortGap = [...samples(T, 200, -0.4), ...samples(T + 210, 200, -0.4)]
    const longGap = [...samples(T, 200, -0.4), ...samples(T + 260, 200, -0.4)]
    expect(findDrainingStretches(shortGap)).toHaveLength(1)
    expect(findDrainingStretches(longGap)).toEqual([])
  })

  it('reports a stretch as ongoing only while it is still going', () => {
    const draining = samples(T, 400, -0.4)
    expect(ongoingStretch(draining)?.seconds).toBeGreaterThanOrEqual(399)
    const recovered = [...draining, ...samples(T + 400, 120, 0.3)]
    expect(ongoingStretch(recovered)).toBeNull()
  })

  it('rotates through the suggestions', () => {
    expect([0, 1, 2, 3].map(suggestionAt)).toEqual([...NUDGE_SUGGESTIONS, NUDGE_SUGGESTIONS[0]])
  })
})

// Exact y-at-x for a d3 curveMonotoneX line, without measuring the SVG path.
// d3 draws each piece as a cubic Bézier whose x control points are evenly spaced (x0, x0+dx/3, x1-dx/3, x1),
// so x is linear in the curve parameter and y follows from the same tangents d3 computes.
// Mirrors d3-shape's src/curve/monotone.js (slope3 / slope2).

const sign = (x: number) => (x < 0 ? -1 : 1)

function slope3(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) {
  const h0 = x1 - x0
  const h1 = x2 - x1
  const s0 = (y1 - y0) / (h0 || (h1 < 0 ? -0 : 0))
  const s1 = (y2 - y1) / (h1 || (h0 < 0 ? -0 : 0))
  const p = (s0 * h1 + s1 * h0) / (h0 + h1)
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
}

function slope2(x0: number, y0: number, x1: number, y1: number, t: number) {
  const h = x1 - x0
  return h ? ((3 * (y1 - y0)) / h - t) / 2 : t
}

/** Returns y(x) along the monotone curve through points (sorted by x, pixel space). */
export function monotoneSampler(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  if (n === 0) return () => NaN
  if (n === 1) return () => ys[0]
  const t = new Array<number>(n)
  if (n === 2) {
    // d3 draws a straight line for two points.
    const s = (ys[1] - ys[0]) / (xs[1] - xs[0] || 1)
    t[0] = t[1] = s
  } else {
    for (let i = 1; i < n - 1; i++) t[i] = slope3(xs[i - 1], ys[i - 1], xs[i], ys[i], xs[i + 1], ys[i + 1])
    t[0] = slope2(xs[0], ys[0], xs[1], ys[1], t[1])
    t[n - 1] = slope2(xs[n - 2], ys[n - 2], xs[n - 1], ys[n - 1], t[n - 2])
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (xs[mid] <= x) lo = mid
      else hi = mid
    }
    const dx = xs[hi] - xs[lo]
    if (!dx) return ys[lo]
    const u = (x - xs[lo]) / dx
    const p0 = ys[lo]
    const p1 = ys[lo] + (dx * t[lo]) / 3
    const p2 = ys[hi] - (dx * t[hi]) / 3
    const p3 = ys[hi]
    const v = 1 - u
    return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3
  }
}

import { useEffect, useState } from 'react'
import type { Tone } from '../types/contracts'

export interface ThemeColors {
  surface: string
  border: string
  text: string
  muted: string
  accent: string
  positive: string
  neutral: string
  negative: string
}

function readColors(): ThemeColors {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    surface: v('--surface'),
    border: v('--border'),
    text: v('--text'),
    muted: v('--muted'),
    accent: v('--accent'),
    positive: v('--positive'),
    neutral: v('--neutral'),
    negative: v('--negative')
  }
}

/** Theme colors from CSS variables, updated when the OS switches light/dark. For Chart.js, which can't read CSS. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(readColors)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setColors(readColors())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return colors
}

export const toneColor = (c: ThemeColors, tone: Tone | undefined) =>
  tone === 'positive' ? c.positive : tone === 'negative' ? c.negative : c.neutral

/** '#rrggbb' + alpha → 'rgba(...)'. */
export function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

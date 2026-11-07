import type { Platform } from '../types/contracts'

const ms = (ts: number) => new Date(ts * 1000)

export const formatClock = (ts: number, seconds = false) =>
  ms(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) })

export const formatDate = (ts: number) =>
  ms(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

export function formatDuration(totalSeconds: number) {
  const mins = Math.round(totalSeconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

const PLATFORM_NAMES: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  facebook: 'Facebook'
}

export const platformName = (p: Platform) => PLATFORM_NAMES[p] ?? p

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

import { siFacebook, siInstagram, siTiktok, siX, siYoutube, type SimpleIcon } from 'simple-icons'
import type { Platform } from '../types/contracts'
import { platformName } from '../lib/format'

const ICONS: Record<Exclude<Platform, 'other'>, SimpleIcon> = {
  instagram: siInstagram,
  tiktok: siTiktok,
  youtube: siYoutube,
  x: siX,
  facebook: siFacebook
}

/** "other" (Reddit, Threads, ...) has no single brand mark: a plain ring. */
const OTHER: Pick<SimpleIcon, 'hex' | 'path'> = {
  hex: '000000',
  path: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zm0 2.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15z'
}

interface Props {
  platform: Platform
  size?: number
  /** Tint with the brand color. Brands whose color is black (X, TikTok) stay monochrome. */
  tint?: boolean
  className?: string
}

/** Official platform mark, monochrome by default. */
export default function PlatformIcon({ platform, size = 16, tint = false, className = '' }: Props) {
  const icon: Pick<SimpleIcon, 'hex' | 'path'> = platform === 'other' ? OTHER : ICONS[platform]
  const brand = `#${icon.hex}`
  const tintable = tint && icon.hex !== '000000'
  return (
    <svg
      role="img"
      aria-label={platformName(platform)}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`shrink-0 ${tintable ? '' : 'text-ink-2'} ${className}`}
      style={tintable ? { color: `color-mix(in oklab, ${brand} 40%, var(--ink-2))` } : undefined}
    >
      <path d={icon.path} fill="currentColor" fillRule={platform === 'other' ? 'evenodd' : undefined} />
    </svg>
  )
}

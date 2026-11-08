import { useId } from 'react'

/** Brand mark: the "B" on the blue gradient (the gradient appears only here and on primary buttons).
 *  Same artwork as the logo file (behindfeed-logo-blue.svg) and the app icon (build/icon.svg). */
export function BrandMark({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  const B =
    'M30 25v50M30 25h17c9 0 13 5 13 11.5S56 48 47 48H30m17 0c10 0 15 5 15 12.5S57 75 47 75H30'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`${id}g`} x1="10" y1="0" x2="90" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7BA7FF" />
          <stop offset="1" stopColor="#4672EE" />
        </linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          <path d={B} fill="none" stroke="#000" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
        </mask>
      </defs>
      <rect width="100" height="100" rx="26" fill={`url(#${id}g)`} />
      <g
        mask={`url(#${id}m)`}
        fill="none"
        stroke="#fff"
        strokeOpacity=".5"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M68 76V36c0-8 4-13 12-13" />
        <path d="M58 47h24" />
      </g>
      <path d={B} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Full logo: mark plus the name, matching the logo file (Inter, bold, tight tracking). */
export default function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center" style={{ gap: size * 0.24 }}>
      <BrandMark size={size} />
      <span
        className="font-bold text-ink"
        style={{ fontSize: size * 0.46 + 2, letterSpacing: '-0.022em', lineHeight: 1 }}
      >
        BehindFeed
      </span>
    </div>
  )
}

/** App mark: a single calm wave crossing a neutral line, plus the name. */
export default function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <rect x="0.5" y="0.5" width="21" height="21" rx="6" fill="var(--surface-2)" stroke="var(--hairline-strong)" />
        <line x1="4" x2="18" y1="11" y2="11" stroke="var(--faint)" strokeWidth="1" strokeDasharray="1.5 2" />
        <path d="M4 12.5 C 7 5.5, 9.5 5.5, 11 11 S 15 16.5, 18 9.5" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink">BehindFeed</span>
    </div>
  )
}

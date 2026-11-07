import { useRef, useState } from 'react'

/** Single line with an ellipsis; when the text is cut off, hovering shows the full text. */
export default function TruncatedText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const show = () => {
    const el = ref.current
    if (el && el.scrollWidth > el.clientWidth + 1) setOpen(true)
  }
  return (
    <span className="relative block min-w-0" onPointerEnter={show} onPointerLeave={() => setOpen(false)}>
      <span ref={ref} className={`block truncate ${className}`}>
        {text}
      </span>
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-max max-w-[420px] whitespace-normal rounded-[var(--radius-md)] border border-hairline-strong bg-elevated px-3 py-2 text-[13px] leading-snug text-ink shadow-[var(--shadow-pop)]"
        >
          {text}
        </span>
      )}
    </span>
  )
}

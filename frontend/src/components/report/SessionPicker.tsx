import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import type { Session } from '../../types/contracts'
import { formatClock, formatDate, formatDuration } from '../../lib/format'
import PlatformIcon from '../PlatformIcon'

interface Props {
  sessions: Session[]
  value: string | undefined
  onChange: (id: string) => void
}

/** Session dropdown: platform mark, date and duration per option. Keyboard: arrows, Enter, Escape. */
export default function SessionPicker({ sessions, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const selected = sessions.find((s) => s.id === value) ?? sessions[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    // Focus the selected option when opening.
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus())
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLElement)
    items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus()
  }

  return (
    <div ref={root} className="no-drag relative" onKeyDown={onKey}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-3 rounded-[var(--radius-md)] border border-hairline bg-surface pl-3 pr-2.5 text-[13px] text-ink-2 transition-colors duration-150 hover:border-hairline-strong hover:bg-surface-2 active:bg-elevated"
      >
        <Option session={selected} />
        <ChevronDown size={14} className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={list}
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-12 z-20 max-h-80 min-w-[320px] origin-top-right overflow-y-auto rounded-[var(--radius-lg)] border border-hairline-strong bg-elevated p-1.5 shadow-[var(--shadow-pop)]"
          >
            {sessions.map((s) => {
              const isSel = s.id === selected.id
              return (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={isSel}
                  tabIndex={-1}
                  onClick={() => {
                    onChange(s.id)
                    setOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onChange(s.id)
                      setOpen(false)
                    }
                  }}
                  className="flex h-10 cursor-pointer items-center justify-between gap-6 rounded-[var(--radius-sm)] px-2.5 text-[13px] text-ink-2 outline-none transition-colors duration-100 hover:bg-surface-2 focus:bg-surface-2 active:bg-hairline"
                >
                  <Option session={s} />
                  {isSel && <Check size={14} className="text-accent" />}
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function Option({ session }: { session: Session }) {
  return (
    <span className="flex items-center gap-3">
      <PlatformIcon platform={session.platform} size={14} tint />
      <span className="text-ink">{formatDate(session.start)}</span>
      <span className="font-mono text-[12px] text-muted">
        {formatClock(session.start)} · {formatDuration(session.end - session.start)}
      </span>
    </span>
  )
}

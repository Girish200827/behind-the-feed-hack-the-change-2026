import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title?: string
  text: string
}

/** Quiet centred empty state: icon in a ring, optional title, one short sentence. */
export default function EmptyState({ icon: Icon, title, text }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-hairline bg-surface px-10 py-20 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface-2">
        <Icon size={18} strokeWidth={1.75} className="text-muted" />
      </span>
      {title && <h2 className="text-[16px] font-medium text-ink">{title}</h2>}
      <p className="max-w-md text-[14px] leading-relaxed text-muted">{text}</p>
    </div>
  )
}

import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  text: string
}

export default function PlaceholderPage({ icon: Icon, title, text }: Props) {
  return (
    <section>
      <h1 className="text-[32px] font-semibold tracking-[-0.025em]">{title}</h1>
      <div className="mt-10 flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-hairline bg-surface px-10 py-20 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface-2">
          <Icon size={18} strokeWidth={1.75} className="text-muted" />
        </span>
        <p className="max-w-md text-[14px] leading-relaxed text-muted">{text}</p>
      </div>
    </section>
  )
}

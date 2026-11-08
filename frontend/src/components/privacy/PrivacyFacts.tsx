import { Eye, HardDrive, PencilLine, Send, ShieldOff, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ONLINE_LABELLING, PRIVACY_FACTS } from '../../content/privacy'

/** What is and isn't recorded, in plain language. `compact` is used on the consent screen. */
export default function PrivacyFacts({ compact = false }: { compact?: boolean }) {
  const f = PRIVACY_FACTS
  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
      <Fact icon={Eye} title={f.watches.title} compact={compact}>
        <p>{f.watches.body}</p>
      </Fact>
      <Fact icon={HardDrive} title={f.saved.title} compact={compact}>
        <List items={f.saved.items} />
      </Fact>
      <Fact icon={ShieldOff} title={f.neverSaved.title} compact={compact} tone="never">
        <List items={f.neverSaved.items} />
      </Fact>
      <Fact icon={Send} title={f.circle.title} compact={compact}>
        <p>{f.circle.body}</p>
      </Fact>
      <div className={compact ? '' : 'col-span-2'}>
        <Fact icon={PencilLine} title="Online labelling" compact={compact} pending={!ONLINE_LABELLING.confirmed}>
          <p>{ONLINE_LABELLING.text}</p>
        </Fact>
      </div>
    </div>
  )
}

function Fact({
  icon: Icon,
  title,
  children,
  compact,
  tone,
  pending
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
  compact: boolean
  tone?: 'never'
  pending?: boolean
}) {
  return (
    <section
      className={`flex h-full gap-4 rounded-[var(--radius-md)] border bg-surface ${compact ? 'px-4 py-3' : 'px-5 py-5'} ${
        pending ? 'border-dashed border-hairline-strong' : 'border-hairline'
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 ${
          tone === 'never' ? 'text-positive-ink' : 'text-ink-2'
        }`}
      >
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 text-[13px] leading-relaxed text-ink-2">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-[14px] font-medium text-ink">{title}</h3>
          {pending && (
            <span className="rounded-full border border-hairline-strong px-2 py-px font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted">
              To be confirmed
            </span>
          )}
        </div>
        {children}
      </div>
    </section>
  )
}

function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-faint" />
          {i}
        </li>
      ))}
    </ul>
  )
}

import type { CSSProperties, Ref } from 'react'
import type { ContextLabel, MoodSwitch } from '../../types/contracts'
import { capitalize } from '../../lib/format'
import { toneVar } from '../../lib/mood'
import PlatformIcon from '../PlatformIcon'

interface Props {
  ref?: Ref<HTMLButtonElement>
  sw: MoodSwitch
  label: ContextLabel | undefined
  active: boolean
  style: CSSProperties
  onHighlight: (id: string | null) => void
  onSelect: (id: string) => void
}

/** Compact chip in the moments lane: platform, "from → to", category. */
export default function MomentChip({ ref, sw, label, active, style, onHighlight, onSelect }: Props) {
  const tone = toneVar(label?.tone)
  return (
    <button
      ref={ref}
      type="button"
      onPointerEnter={() => onHighlight(sw.id)}
      onPointerLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(sw.id)}
      onBlur={() => onHighlight(null)}
      onClick={() => onSelect(sw.id)}
      className={`absolute flex h-7 items-center gap-2 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
        label ? '' : 'border-dashed'
      } ${active ? 'bg-elevated' : 'border-hairline bg-surface-2 hover:bg-elevated'}`}
      style={{ ...style, borderColor: active ? `color-mix(in oklab, ${tone} 60%, transparent)` : undefined }}
    >
      <PlatformIcon platform={sw.platform} size={12} />
      <span className="font-mono text-ink-2">
        {sw.from} <span className="text-faint">→</span> {sw.to}
      </span>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
      <span className={label ? 'text-ink' : 'text-muted'}>{label ? capitalize(label.category) : 'Pending'}</span>
    </button>
  )
}

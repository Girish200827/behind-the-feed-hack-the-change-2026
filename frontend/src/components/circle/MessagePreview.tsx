import { Fragment } from 'react'
import type { DiscordPayload } from '../../types/bridge'

/** Renders **bold** the way Discord does; everything else is shown exactly as it will be sent. */
function renderLine(line: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  )
}

/** A Discord-style preview of exactly what will be posted. */
export default function MessagePreview({ payload, sample = false, author, meta }: { payload: Pick<DiscordPayload, 'content'> & Partial<DiscordPayload>; sample?: boolean; author?: string; meta?: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 font-mono text-[12px] text-ink-2">
        {(author ?? payload.username ?? 'S').slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-ink">{author ?? payload.username}</span>
          {meta && <span className="font-mono text-[11px] text-muted">{meta}</span>}
          {sample && (
            <span className="rounded-full border border-hairline px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted">Sample</span>
          )}
        </div>
        <div className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink-2">
          {payload.content.split('\n').map((l, i) => (
            <div key={i}>{renderLine(l)}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

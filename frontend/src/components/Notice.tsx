import type { ReactNode } from 'react'

export default function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-hairline bg-surface px-10 py-16 text-center text-[14px] text-muted">
      {children}
    </div>
  )
}

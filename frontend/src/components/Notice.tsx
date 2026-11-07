import type { ReactNode } from 'react'

export default function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-line bg-surface p-8 text-center text-muted">{children}</div>
}

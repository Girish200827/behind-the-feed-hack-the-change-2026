import { useEffect, useState } from 'react'
import { ExternalLink, Phone } from 'lucide-react'
import { getSupportResources, type SupportResource } from '../../data'

/** Community support listings (Open Referral). Shown on the Goals page when the week has been draining. */
export default function SupportNearby() {
  const [items, setItems] = useState<SupportResource[]>([])
  useEffect(() => {
    getSupportResources().then(setItems).catch(() => setItems([]))
  }, [])
  if (!items.length) return null

  return (
    <section className="card px-8 py-7">
      <div className="flex items-center gap-3">
        <span className="label">Support nearby</span>
        {items.some((i) => i.sample) && (
          <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Sample listings
          </span>
        )}
      </div>
      <h2 className="mt-2 text-[20px] font-medium tracking-[-0.01em] text-ink">Lots of draining scrolling this week. Talking to someone can help.</h2>
      <p className="mt-1 text-[13px] text-muted">Free and confidential. If you or someone else is in danger right now, call 911.</p>

      <ul className="mt-6 grid grid-cols-2 gap-3">
        {items.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-hairline bg-bg px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-medium text-ink">{s.name}</span>
              {s.area && <span className="shrink-0 font-mono text-[11px] text-muted">{s.area}</span>}
            </div>
            {s.organization !== s.name && <span className="-mt-1 text-[12px] text-muted">{s.organization}</span>}
            <p className="text-[13px] leading-snug text-ink-2">{s.description}</p>
            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[12px]">
              {s.phone && (
                <a
                  href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 font-mono text-ink transition-colors hover:text-accent"
                >
                  <Phone size={12} /> {s.phone}
                </a>
              )}
              {s.phoneNote && <span className="text-muted">{s.phoneNote}</span>}
              {s.url && (
                <a href={s.url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-muted transition-colors hover:text-ink">
                  Website <ExternalLink size={11} />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      {items.some((i) => i.sample) && (
        <p className="mt-4 text-[11px] text-faint">Sample listings in the Open Referral format. Check the details before relying on them.</p>
      )}
    </section>
  )
}

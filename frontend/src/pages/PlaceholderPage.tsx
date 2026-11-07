import type { LucideIcon } from 'lucide-react'
import EmptyState from '../components/EmptyState'

interface Props {
  icon: LucideIcon
  title: string
  text: string
}

export default function PlaceholderPage({ icon, title, text }: Props) {
  return (
    <section>
      <h1 className="text-[32px] font-semibold tracking-[-0.025em]">{title}</h1>
      <div className="mt-10">
        <EmptyState icon={icon} text={text} />
      </div>
    </section>
  )
}

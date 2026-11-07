export default function PlaceholderPage({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-muted">{text}</div>
    </section>
  )
}

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { CircleSettings } from '../../data'
import { isDiscordWebhookUrl } from '../../lib/webhookUrl'

const input =
  'h-10 w-full rounded-[var(--radius-md)] border border-hairline bg-surface-2 px-3 text-[13px] text-ink outline-none transition-colors placeholder:text-faint hover:border-hairline-strong focus:border-accent'

/** Display name + Discord webhook URL. Saved on this device only. */
export default function ConnectCard({ settings, onSave }: { settings: CircleSettings; onSave: (s: CircleSettings) => void }) {
  const [name, setName] = useState(settings.displayName)
  const [url, setUrl] = useState(settings.webhookUrl)
  const [saved, setSaved] = useState(false)
  const urlOk = !url.trim() || isDiscordWebhookUrl(url)
  const dirty = name.trim() !== settings.displayName || url.trim() !== settings.webhookUrl

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!urlOk) return
        onSave({ displayName: name, webhookUrl: url })
        setSaved(true)
        setTimeout(() => setSaved(false), 1600)
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="label">Display name</span>
        <input className={input} value={name} maxLength={32} placeholder="How friends know you" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">Discord webhook URL</span>
        <input
          className={`${input} font-mono ${urlOk ? '' : 'border-negative/60 focus:border-negative'}`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={url}
          placeholder="https://discord.com/api/webhooks/…"
          onChange={(e) => setUrl(e.target.value)}
        />
        <span className={`text-[12px] ${urlOk ? 'text-muted' : 'text-negative-ink'}`}>
          {urlOk
            ? 'In Discord: Server Settings → Integrations → Webhooks → Copy URL. Stored only on this device.'
            : "That doesn't look like a Discord webhook URL."}
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || !urlOk}
          className="h-9 rounded-[var(--radius-md)] border border-hairline-strong px-4 text-[13px] text-ink transition-colors hover:bg-surface-2 active:bg-elevated disabled:opacity-40"
        >
          Save
        </button>
        {settings.webhookUrl && (
          <button
            type="button"
            onClick={() => {
              setUrl('')
              onSave({ displayName: name, webhookUrl: '' })
            }}
            className="h-9 rounded-[var(--radius-md)] px-3 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Remove webhook
          </button>
        )}
        {saved && (
          <span className="flex items-center gap-1.5 text-[12px] text-positive-ink">
            <Check size={13} /> Saved
          </span>
        )}
      </div>
    </form>
  )
}

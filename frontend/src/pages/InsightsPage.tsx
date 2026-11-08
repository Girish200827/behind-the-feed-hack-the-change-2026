import { Lightbulb } from 'lucide-react'
import { dataSourceName } from '../data'
import { useInsights } from '../hooks/useInsights'
import InsightCards from '../components/insights/InsightCards'
import TopTriggers from '../components/insights/TopTriggers'
import PlatformMixList from '../components/insights/PlatformMixList'
import EmptyState from '../components/EmptyState'
import Notice from '../components/Notice'

/** Insights (C4): top triggers, platform mix and a few plain-language findings. */
export default function InsightsPage() {
  const state = useInsights()

  return (
    <section className="flex flex-col gap-10">
      <header>
        <h1 className="text-[40px] font-semibold leading-none tracking-[-0.03em]">Insights</h1>
        <p className="mt-4 max-w-2xl text-[14px] text-muted">Which content tends to lift or drain you, and where your scrolling time goes.</p>
      </header>

      {state.status === 'loading' && <div className="h-[480px]" />}
      {state.status === 'error' && <Notice>Insights could not be loaded. {state.message}</Notice>}
      {state.status === 'ready' && state.data.sessions === 0 && (
        <EmptyState
          icon={Lightbulb}
          title="Insights appear after a few sessions"
          text="Scroll as you normally would. Once a few mood switches have been labelled, you will see which content lifts or drains you."
        />
      )}
      {state.status === 'ready' && state.data.sessions > 0 && (
        <>
          <InsightCards insights={state.data} />

          <div>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="label">Top triggers</h2>
              <span className="font-mono text-[11px] text-muted">share of mood switches that turned negative</span>
            </div>
            {state.data.triggers.length ? (
              <div className="rounded-[var(--radius-lg)] border border-hairline bg-surface px-6 py-4">
                <TopTriggers triggers={state.data.triggers} />
              </div>
            ) : (
              <p className="text-[13px] text-muted">No labelled mood switches yet.</p>
            )}
          </div>

          <div>
            <h2 className="label mb-2">Platform mix</h2>
            <PlatformMixList mix={state.data.platformMix} />
          </div>

          <p className="text-[12px] text-muted">
            {state.data.source === 'api'
              ? `Based on all ${state.data.sessions} recorded sessions.`
              : `Based on ${state.data.sessions} sessions${dataSourceName === 'mock' ? ' of demo data' : ', computed on this device while the service is offline'}.`}{' '}
            Mood signals, not a diagnosis.
          </p>
        </>
      )}
    </section>
  )
}

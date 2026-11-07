import type { Session } from '../types/contracts'
import type { Timeline } from './join'

/** Every data source (mock files, Allen's API) implements this. Components never see which one is used. */
export interface DataSource {
  getSessions(): Promise<Session[]>
  getTimeline(sessionId: string): Promise<Timeline | null>
}

// The one entry point for data. Components import from here and nowhere else.
import { ApiSource } from './apiSource'
import { DATA_SOURCE } from './constants'
import { MockSource } from './mockSource'
import type { DataSource } from './source'

const source: DataSource = DATA_SOURCE === 'api' ? ApiSource : MockSource

export const getSessions = () => source.getSessions()
export const getTimeline = (sessionId: string) => source.getTimeline(sessionId)
export const dataSourceName = DATA_SOURCE

export { labelFor, type Timeline } from './join'

import { useEffect, useState } from 'react'
import { backendOnline, dataSourceName, onBackendChange } from '../data'

/** 'demo' (mock mode), 'live' (API answering), 'offline' (API down, showing demo data) or 'connecting'. */
export type BackendState = 'demo' | 'live' | 'offline' | 'connecting'

const current = (): BackendState => {
  if (dataSourceName === 'mock') return 'demo'
  const online = backendOnline()
  return online === null ? 'connecting' : online ? 'live' : 'offline'
}

export function useBackendStatus(): BackendState {
  const [state, setState] = useState<BackendState>(current)
  useEffect(() => onBackendChange(() => setState(current())), [])
  return state
}

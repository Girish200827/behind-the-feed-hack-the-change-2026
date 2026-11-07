import { useEffect, useState } from 'react'
import { getSessions, getTimeline, type Timeline } from '../data'
import type { Session } from '../types/contracts'

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

export function useSessions(): Load<Session[]> {
  const [state, setState] = useState<Load<Session[]>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    getSessions()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e: Error) => alive && setState({ status: 'error', message: e.message }))
    return () => {
      alive = false
    }
  }, [])
  return state
}

export function useTimeline(sessionId: string | undefined): Load<Timeline | null> {
  const [state, setState] = useState<Load<Timeline | null>>({ status: 'loading' })
  useEffect(() => {
    if (!sessionId) return
    let alive = true
    setState({ status: 'loading' })
    getTimeline(sessionId)
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e: Error) => alive && setState({ status: 'error', message: e.message }))
    return () => {
      alive = false
    }
  }, [sessionId])
  return state
}

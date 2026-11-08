import { useEffect, useRef, useState } from 'react'

export type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

interface Options<T> {
  /** Milliseconds until the next refresh for this data, or null to stop polling. */
  interval: (data: T) => number | null
  /** Cheap fingerprint of the data; the state only updates when it changes, so charts don't redraw for nothing. */
  signature: (data: T) => string
}

/**
 * Loads data once per `key`, then keeps it fresh by polling (Phase 3: session list every 5 s, a live timeline every
 * 2 s). A failed refresh keeps the last good data on screen.
 */
export function usePolled<T>(key: string | undefined, fetcher: () => Promise<T>, opts: Options<T>): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: 'loading' })
  const fetchRef = useRef(fetcher)
  const optsRef = useRef(opts)
  fetchRef.current = fetcher
  optsRef.current = opts

  useEffect(() => {
    if (key === undefined) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastSig: string | null = null
    setState({ status: 'loading' })

    const tick = async () => {
      let next: number | null = null
      try {
        const data = await fetchRef.current()
        if (!alive) return
        const sig = optsRef.current.signature(data)
        if (sig !== lastSig) {
          lastSig = sig
          setState({ status: 'ready', data })
        }
        next = optsRef.current.interval(data)
      } catch (e) {
        if (!alive) return
        if (lastSig === null) setState({ status: 'error', message: (e as Error).message })
        next = 5000 // try again later
      }
      if (alive && next !== null) timer = setTimeout(tick, next)
    }
    tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [key])

  return state
}

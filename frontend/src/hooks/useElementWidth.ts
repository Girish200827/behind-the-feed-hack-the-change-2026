import { useLayoutEffect, useRef, useState } from 'react'

/** Tracks an element's content width with a ResizeObserver. */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

/** Bumps once web fonts have loaded, so text measurements can be redone. */
export function useFontsReady() {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    let alive = true
    document.fonts.ready.then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])
  return ready
}

import { useEffect, useState } from 'react'

/** Current Unix time in seconds, ticking every `everyMs` while `active` (e.g. for a live session). */
export function useNow(active: boolean, everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now() / 1000)
  useEffect(() => {
    if (!active) return
    setNow(Date.now() / 1000)
    const t = setInterval(() => setNow(Date.now() / 1000), everyMs)
    return () => clearInterval(t)
  }, [active, everyMs])
  return now
}

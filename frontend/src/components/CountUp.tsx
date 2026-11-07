import { useEffect, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'

/** Counts up to a number on mount or when it changes. Shows the final value under reduced motion. */
export default function CountUp({ value, format = (n) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) {
      setShown(value)
      return
    }
    const controls = animate(0, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1], onUpdate: setShown })
    return () => controls.stop()
  }, [value, reduce])
  return <>{format(shown)}</>
}

import { useCallback, useEffect, useState } from 'react'
import { getStatus, onCameraStatusChange, pause, resume, type CameraStatus } from '../data'

/** Camera status (Watching / Paused / Off), refreshed every few seconds and on pause/resume anywhere in the app. */
export function useCameraStatus(pollMs = 5000) {
  const [status, setStatus] = useState<CameraStatus | null>(null)

  useEffect(() => {
    let alive = true
    const refresh = () => getStatus().then((s) => alive && setStatus(s))
    refresh()
    const timer = setInterval(refresh, pollMs)
    const off = onCameraStatusChange((s) => alive && setStatus(s))
    return () => {
      alive = false
      clearInterval(timer)
      off()
    }
  }, [pollMs])

  const toggle = useCallback(() => (status === 'paused' ? resume() : pause()), [status])
  return { status, toggle }
}

export const STATUS_LABEL: Record<CameraStatus, string> = { watching: 'Watching', paused: 'Paused', off: 'Off' }

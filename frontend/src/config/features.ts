// Feature flags. One place to switch optional features on or off.
// Vite reads VITE_* variables from frontend/.env (or the shell) when the app starts; restart after changing them.

/**
 * Scroll Circle: share progress with friends through a Discord webhook.
 * Hidden by default (VITE_ENABLE_CIRCLE=false): no sidebar entry, /circle redirects to Today, the Circle line is gone
 * from the Privacy page and consent screen, and nothing can be sent. The code stays in place.
 * Turn it back on with VITE_ENABLE_CIRCLE=true.
 */
const CIRCLE = String(import.meta.env.VITE_ENABLE_CIRCLE ?? 'false').trim().toLowerCase() === 'true'

export const FEATURES = {
  circle: CIRCLE
} as const

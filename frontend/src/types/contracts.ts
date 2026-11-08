// Types for the four event formats in the team's contracts.md.
// Field names must match contracts.md exactly. Times are Unix seconds.

export const EMOTIONS = ['happy', 'sad', 'angry', 'fear', 'surprise', 'disgust', 'neutral'] as const
// 'other' = another social site (Reddit, Threads, ...): used on labels when the screen shows one.
export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'x', 'facebook', 'other'] as const
export const CATEGORIES = ['news', 'politics', 'comedy', 'friends', 'fitness', 'food', 'drama', 'ads', 'other'] as const
export const TONES = ['positive', 'neutral', 'negative'] as const

export type Emotion = (typeof EMOTIONS)[number]
export type Platform = (typeof PLATFORMS)[number]
export type Category = (typeof CATEGORIES)[number]
export type Tone = (typeof TONES)[number]

/** Raad → Allen, once a second. valence: -1 (negative) to 1 (positive). */
export interface EmotionSample {
  ts: number
  emotion: Emotion
  valence: number
  confidence: number
}

/** Raad → Girish, Allen; when a new mood holds 2 s. */
export interface MoodSwitch {
  id: string
  ts: number
  from: Emotion
  to: Emotion
  platform: Platform
}

/** Girish → Allen; one per switch, never the image. */
export interface ContextLabel {
  switch_id: string
  ts: number
  platform: Platform
  category: Category
  tone: Tone
  topic: string
}

/** Allen → frontend; one per scroll session. */
export interface Session {
  id: string
  platform: Platform
  start: number
  /** null while the session is still in progress (planned for Phase 3; confirm in contracts.md with Allen). */
  end: number | null
}

export type ContractEvent =
  | { kind: 'emotion_sample'; event: EmotionSample }
  | { kind: 'mood_switch'; event: MoodSwitch }
  | { kind: 'context_label'; event: ContextLabel }
  | { kind: 'session'; event: Session }

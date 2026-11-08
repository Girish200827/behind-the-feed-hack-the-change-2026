// Plain-language privacy wording, shared by the Privacy page and the first-launch consent screen.
// Keep it short, honest and in sync with what Raad, Girish and Allen actually record.

export const PLATFORMS_TEXT = 'Instagram, TikTok, YouTube, X or Facebook'

export const PRIVACY_FACTS = {
  watches: {
    title: 'What the camera watches',
    body: `Your facial expression only, and only while ${PLATFORMS_TEXT} is the active window. When you switch away, the camera turns off.`
  },
  saved: {
    title: 'What is saved',
    items: ['Your emotion and the time, about once a second', 'Mood switches (for example neutral → sad)', 'What kind of content was on screen: its category, tone and a short topic']
  },
  neverSaved: {
    title: 'What is never saved',
    items: ['Camera frames', 'Face images', 'Screenshots. Screens are labelled, then deleted.']
  },
  circle: {
    title: 'Scroll Circle',
    body: 'Only sends the message you preview, and only when you press Share. Nothing is shared automatically.'
  }
} as const

/**
 * ✏️ EDIT ME — to be confirmed with Girish (screen labeller).
 * If the screen labeller uses an online vision model, say so here. If it runs fully on this computer, change the
 * text and set ONLINE_LABELLING.confirmed to true.
 */
export const ONLINE_LABELLING = {
  confirmed: true,
  text: "When your mood shifts, a screenshot of the app you're scrolling is sent to Google's Gemini service to name the content, then deleted on this computer. Your camera image is never sent. On Gemini's free tier, Google may use what is sent to improve its products."
}

export const NOT_A_DIAGNOSIS = 'These are mood signals, not a diagnosis.'

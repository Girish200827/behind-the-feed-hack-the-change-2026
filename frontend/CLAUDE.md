# Scroll Mood — Frontend (Cheema)

Hack the Change 2026 (Calgary, 24 hours). 4-person team. This folder is the frontend only.
My job from the team build map: **"Show people what scrolling did to their mood, and let them pause the camera."**

## Project
"Scroll Mood": a desktop app that turns the camera on only while you scroll social media, notices when your
expression shifts, labels what was on screen at that moment, and shows which content lifts or drains you.
It's for doomscrollers who want healthier habits.

## Team (only Cheema's part is built here)
- **Raad** (Computer Vision, face): webcam → `emotion_sample` and `mood_switch` events
- **Giresh** (Computer Vision, screen): in-memory screen grab → `context_label`; also goal wording (G4) and the main README
- **Allen** (Backend): fake session file (A1), SQLite + FastAPI event intake (A2), social media window detector (A3),
  local API for the dashboard (A4), insights and goal (A5)
- **Cheema** (Frontend): C1, C2, C3, L4, C4

Do **NOT** build window detection, webcam access or screenshots in the frontend.

## Git
- Work on the `frontend` branch. Commit only to this branch, never to `main`.
- Only change files in `/frontend`. Never edit other team members' folders or `contracts.md`.
- Commit after each working step with a clear message.

## Stack
Electron + React + TypeScript (electron-vite), Tailwind CSS, Chart.js with react-chartjs-2 and
chartjs-plugin-annotation (kept for Phase 4 charts), React Router.
Design layer: Geist Sans/Mono (`geist`), `motion`, `lucide-react`, `simple-icons` (platform marks),
`d3-shape` + `d3-scale` (custom SVG "mood ribbon" on the Session Report).

## Design system
- Calm, dark-first, minimal (light mode via prefers-color-scheme). Frameless window with a custom draggable title strip.
- All colors, radii and fonts are tokens in `src/index.css` (`:root` CSS variables + Tailwind `@theme`). Don't hard-code colors.
- Mood colors: teal = uplifting (`--positive`), coral = draining (`--negative`), cool gray = neutral. Validated for
  contrast and colorblind separation against both backgrounds. Color only where it carries meaning; `--accent` for UI focus/active.
- Geist Mono for numbers, times and the small uppercase `.label`; Geist Sans for everything else.
- Motion is 150–300 ms ease-out (line draw ~800 ms); everything respects prefers-reduced-motion.
- Platform marks: `<PlatformIcon platform=... />`, monochrome by default, `tint` for a subtle brand tint.

## Event formats (copied from the team's contracts.md; never rename fields; times are Unix seconds)
- **emotion_sample** (Raad → Allen, once a second):
  `{"ts": 1794083400.5, "emotion": "sad", "valence": -0.6, "confidence": 0.81}`
  - emotion: `happy | sad | angry | fear | surprise | disgust | neutral`
  - valence: -1 (negative) to 1 (positive)
- **mood_switch** (Raad → Giresh, Allen; when a new mood holds 2 s):
  `{"id": "sw_0142", "ts": 1794083412.0, "from": "neutral", "to": "sad", "platform": "instagram"}`
  - platform: `instagram | tiktok | youtube | x | facebook`
- **context_label** (Giresh → Allen; one per switch, never the image):
  `{"switch_id": "sw_0142", "ts": 1794083412.4, "platform": "instagram", "category": "news", "tone": "negative", "topic": "layoff headlines"}`
  - category: `news | politics | comedy | friends | fitness | food | drama | ads | other`
  - tone: `positive | neutral | negative`
- **session** (Allen → Cheema; one per scroll session):
  `{"id": "s_031", "platform": "instagram", "start": 1794083100, "end": 1794084900}`

The dashboard reads sessions and joins the other three formats **BY TIME**: a sample or switch belongs to a session
if its `ts` is between `start` and `end`. A `context_label` attaches to its `mood_switch` by `switch_id`.

## Rules
- If a new field or endpoint is needed, it must be added to the team's contracts.md first. Never invent backend fields silently.
- All data access goes through one data layer in `src/data/`. Components never call `fetch` directly.
- Never store or display images.
- Keep components small and readable.
- Calm wellness design: soft neutral background, gentle colors, readable type, light and dark mode. Muted red only for negative tone.
- Wrap any `localStorage` use in try/catch.
- These are mood signals, not a diagnosis. UI wording must reflect that.

## Phases (mapped to tasks on the build map). Build one phase at a time; wait for "Do Phase N".

### Phase 1 — C1 Desktop window + C3 Session report (build alone, by 7 PM)
1. C1: Scaffold the Electron app in /frontend so the dashboard opens as an app window on the laptop.
2. `src/types/contracts.ts`: TypeScript types exactly matching the four formats.
3. Fake data: Allen is writing a fake session file (A1), a realistic 20-minute scroll session in the four formats.
   Until it arrives, `src/mock/events.json` holds ~10 hand-written events (one Instagram session, a few
   emotion_samples, 3–4 mood_switches each with a context_label). The loader accepts a JSON array or JSONL of mixed
   events, detects each event's type by its fields, and validates against the types. Dropping Allen's file into
   `src/mock/` must be the only change needed.
4. Data layer: `getSessions()` and `getTimeline(sessionId)` returning `{session, samples, switches, labels}`, joined by
   time. MockSource now; ApiSource stub with base URL (http://localhost:8000) and paths in one constants file, to be
   confirmed with Allen. Select with `VITE_DATA_SOURCE=mock|api`.
5. C3 Session Report page: valence line chart (x clock time, y -1..1) with soft bands above/below zero; a marker at
   each mood_switch colored by its label's tone, labelled "neutral → sad" with category/topic; a switch list under the
   chart (time, from → to, category chip, topic); header (platform, start/end, duration); session picker; graceful
   handling of a switch with no label yet.
6. Sidebar layout: Session Report, Privacy, Insights (placeholder), Goals (placeholder).
Done when: the fake session shows as a mood timeline with switches and labels that could be shown to a judge.

### Phase 2 — C2 Privacy and pause screen (build alone, by 7 PM)
- Privacy page, plain language:
  - What the camera watches: facial expression only, and only while Instagram, TikTok, YouTube, X or Facebook is the active window
  - What is saved: emotion and time, mood switches, content category/tone/topic
  - What is never saved: camera frames, face images, screenshots (screens are labelled, then deleted)
  - A note: if the screen labeller uses an online vision model, the image is sent to that service for labelling
    (a clearly marked editable line, pending Giresh's decision)
  - "These are mood signals, not a diagnosis"
- Pause / Resume button on the Privacy page and a camera-status pill in the sidebar (Watching / Paused / Off).
- `pause()`, `resume()`, `getStatus()` in the data layer; in-memory state for now.
- First-launch consent screen with a required checkbox, remembered in localStorage.

### Phase 3 — L4 Dashboard on live data (with Allen, 7–11 PM)
- Cheema pastes Allen's real endpoints (A4: list of sessions, one session's timeline) and a sample response. Finish
  ApiSource. If the shape differs from our types, add an adapter in the data layer; components stay unchanged.
- Poll the session list every 5 s; refresh the open timeline every 2 s while a session has `end = null`.
- If the API is unreachable, show a small "Backend offline – showing demo data" banner and fall back to MockSource.
- Wire pause/resume/status to Allen's endpoints once they're in contracts.md.
- 11 PM team checkpoint: Allen opens Instagram, scrolls 3 minutes, closes it; the session must appear with mood switches and content labels.

### Phase 4 — C4 Insights and goals pages (after 11 PM; needs Allen's A5 and L4)
- `getInsights()` in the data layer reading Allen's A5 output: trigger score per content category (share of switches
  that turned negative), mood before/after a session, longest streak, goal picked from the top trigger. Goal wording
  from Giresh (G4); template text if missing.
- Fallback: if A5 isn't available, compute the same numbers in `src/data/insights.ts` from sessions and timelines.
- Insights page: top triggers (horizontal bar chart, top one highlighted), platform mix (time and avg valence per
  platform), 2–3 plain-language insight cards.
- Goals page: this week's goal with a progress bar and the pattern it came from.
- Friendly empty states.
- If time runs short, cut Insights down to just the top-triggers chart (team cut rule).

### Phase 5 — Ready for the 5 AM feature freeze
- Production build with no errors; test every page in mock and api mode, including with the backend off.
- Make the Session Report readable on a projector for the demo.
- Provide a short "How to run the frontend" section for the team README (Giresh owns the README).

## Screens
- **Today** (`/today?date=YYYY-MM-DD`, default page): one local day across all platforms. Header with day arrows
  (←/→ keys too), 24 h day strip, day summary, day mood ribbon (sessions side by side on a compressed axis with
  "2h 10m later" gaps), platform breakdown, sessions list.
- **Session detail** (`/session/:id`): the single-session report, opened from the day view, with a back link.
- Data for the day comes from `getDay(date)` in `src/data/day.ts` (groups `getSessions()` by local start day and
  loads each `getTimeline()`). No new backend fields.
- `MoodRibbon` takes `segments` + `mode: 'session' | 'day'`; one chart implementation for both screens.
  Samples are bucketed to ~1.5 px and dot/scrubber y comes from `lib/monotone.ts` (exact d3 monotone maths), so a
  day of 6 sessions at 1 Hz stays smooth.

## Live data (Phase 3 / L4)
- `npm run dev:api` reads Allen's local API at `http://127.0.0.1:8000` (`VITE_API_URL` to override; CSP in index.html
  must allow it). Endpoints per backend/README.md: `GET /sessions`, `GET /sessions/{id}/timeline`, `GET /status`.
- Adapter in `src/data/apiSource.ts`: his timeline key `emotions` → our `samples`; every event validated with the
  contract checks. `end: null` = live session (matches his Session model).
- `ResilientSource`: if the API can't be reached, falls back to MockSource and the title strip shows
  "Backend offline – showing demo data" (sidebar Data pill: Live / Offline). It retries on every poll and recovers.
- Polling (`hooks/usePolled.ts`): session list / today every 5 s; a live timeline every 2 s; state only updates when
  a fingerprint changes.
- Camera pill in API mode uses `GET /status` (`scrolling` → Watching, else Off; unreachable → Off). Pause is still
  local only (no pause endpoint yet).
- The loader also accepts a single timeline object ({session, emotions, switches, labels}), so Allen's
  `fake_session.json` can be dropped into `src/mock/` as-is.

## Well-being features (frontend-only; no contracts.md changes)
- **Daily social goal** (`src/data/dailyGoal.ts`, pure + tested): picked from yesterday's sessions. Connection
  ("Swap one scroll session for a call or text" / "Message a friend before opening <platform>"), Timing ("No scrolling
  after 11 PM") or Limit ("Keep draining content under 15 min today"). Progress is automatic except connection goals
  (one-tap check-in). Check-ins and per-day results live in localStorage (`goals.ts`); mock mode seeds a 4-day streak.
  Shown as a compact card on Today and in full on Goals, above the weekly goal (A5/G4; computed locally until connected).
- **Scroll Circle** (`/circle`): Discord webhook + display name in localStorage (never in the repo). Messages come from
  `lib/circleMessage.ts` and contain only name, goal, outcome, streak, drained-time change, encouragement. Sending runs
  in the main process (`electron/discord.ts`) via the preload bridge `window.scrollMood` (`src/types/bridge.ts`).
  No webhook → demo mode with labelled sample messages.
- **Connect-instead nudges**: `lib/nudges.ts` finds 5+ min below neutral (smoothed); `NudgeProvider` shows a toast and a
  native notification (main sets the AppUserModelID), watches the live session every 30 s. Toggle + "Simulate a
  draining stretch" on Privacy.
- **Support nearby**: `src/mock/openreferral.json` (HSDS 3.0, sample listings of real Calgary/Alberta services; verify
  before demo) via `getSupportResources()`; shown on Goals when the week is > 30% drained.
- Tests: `npm test` (vitest). Manual checks (real Discord, Windows notification): `TESTING.md`.

## Mock data
- `src/mock/realistic.json`: two weeks (14 days x 3-6 sessions) across all five platforms at 1 Hz, with patterns:
  X news/politics drains, YouTube comedy/food lifts, Instagram friends lift / comparison dips, Facebook family lifts /
  politics drains, late-night TikTok slowly drains. `live.json`: a session in progress (`end: null`).
- `src/mock/extra/events.json`: the original hand-written 10-min session. `src/mock/edge/no-samples.json`: edge case.
- Regenerate with `node scripts/generate-mock.mjs` (seeded). Wall-clock times use a fixed UTC offset
  (default -6, Calgary as Electron resolves it); override with `MOCK_UTC_OFFSET`.
- `VITE_MOCK_FILE` picks files: `all` (default, top-level files only) | `none` | comma list of names without extension,
  e.g. `realistic`, `extra/events,live`, `edge/no-samples`. Shortcuts: `npm run dev:realistic | dev:live | dev:empty | dev:no-samples`.
- Mock only, so the demo always shows "today": finished files are shifted by whole days so their newest day is today
  and anything after now is cut; a live file is shifted to end now. Real API data is never shifted.
- Chart pipeline (UI only, raw data untouched): drop samples with confidence < 0.4, then a centred rolling mean
  (`src/lib/smooth.ts`): 18 s in the day view, 5 s in the single-session report. Summaries use the same samples.
- Day ribbon: 240 px panels (fits a 1080p screen at 150% scaling), live panel sized by the time its readings cover,
  chips laid out per session under each panel (`layoutSessionLanes`), clicking a panel opens the session.

## TODO
- Pause endpoint must be agreed with Allen and added to contracts.md before wiring (Phase 3). Until then
  `pause()` / `resume()` / `getStatus()` in `src/data/camera.ts` only hold state in memory (the camera is not
  actually paused).
- Online-labelling line on Privacy / consent (`src/content/privacy.ts`, `ONLINE_LABELLING`) must be confirmed with Giresh.
- `session.end` is `number | null` in our types (null = still in progress, needed for Phase 3 live refresh).
  Confirm with Allen and get it written into contracts.md.
- ApiSource paths in `src/data/constants.ts` are placeholders until confirmed with Allen (A4).

## Project layout
- `electron/` — Electron main + preload (window only; no camera, no screen capture)
- `src/types/contracts.ts` — the four event formats
- `src/mock/` — fake events (drop Allen's A1 file here; JSON array or JSONL)
- `src/data/` — the only place that touches data (loader, MockSource, ApiSource, join logic)
- `src/pages/`, `src/components/` — UI

## Commands
- `npm run dev` — open the app window (mock data by default)
- `npm run dev:api` — same, reading from Allen's API
- `npm run build` — typecheck + production build
- `npm test` — unit tests (vitest)

Gotcha: if the app crashes with `Cannot read properties of undefined (reading 'whenReady')`, the shell has
`ELECTRON_RUN_AS_NODE=1` set (VS Code exports it to processes it spawns). Unset it first
(bash: `env -u ELECTRON_RUN_AS_NODE npm run dev`; PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE`).

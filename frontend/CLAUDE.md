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

## Mock data
- `src/mock/events.json` hand-written 10-min Instagram session; `realistic.json` 20-min TikTok session at 1 Hz with
  jitter, low-confidence dips, 12 switches (one unlabelled); `live.json` a session in progress (`end: null`).
- Regenerate realistic/live with `node scripts/generate-mock.mjs` (seeded).
- `VITE_MOCK_FILE` picks files: `all` (default, top-level files only) | `none` | comma list of names without extension,
  e.g. `realistic`, `events,live`, `edge/no-samples`. Shortcuts: `npm run dev:realistic | dev:live | dev:empty | dev:no-samples`.
- Mock only: a file containing a live session is time-shifted at load so it ends "now". Real data is never shifted.
- Chart pipeline (UI only, raw data untouched): drop samples with confidence < 0.4, then a centred 5 s rolling mean
  (`src/lib/smooth.ts`). The summary strip uses the same chart-ready samples.

## TODO
- Pause endpoint must be agreed with Allen and added to contracts.md before wiring (Phase 3).
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

Gotcha: if the app crashes with `Cannot read properties of undefined (reading 'whenReady')`, the shell has
`ELECTRON_RUN_AS_NODE=1` set (VS Code exports it to processes it spawns). Unset it first
(bash: `env -u ELECTRON_RUN_AS_NODE npm run dev`; PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE`).

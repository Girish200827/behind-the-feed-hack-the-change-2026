# Testing the frontend

## Automated (run before every push)

```bash
cd frontend
npm test          # vitest: goal selection, streaks, draining-stretch detection, Circle messages, Discord send path
npm run build     # typecheck + production build
```

`npm test` covers:

- **Daily goal**: each goal type is picked in the right situation (friends lift, late-night drain, high drain, ordinary day, no data), progress for each type, streak counting.
- **Nudges**: 5+ minutes below neutral is detected; shorter dips, recoveries and long gaps are not.
- **Circle message**: contains only name, goal, outcome, streak, drained-time change and an encouraging line; never emotions, topics or raw numbers, even when built from real session data.
- **Discord send path**: a local HTTP server stands in for Discord and checks the exact JSON received; also the error paths (server off → "offline", 404 → "rejected", non-Discord URL refused without a request).

## Manual checklist (can't be automated)

Run the app with `npm run dev`. If it crashes with `reading 'whenReady'`, unset `ELECTRON_RUN_AS_NODE` first (see CLAUDE.md).

### 1. Real Discord message

Scroll Circle is hidden by default. Set `VITE_ENABLE_CIRCLE=true` in `frontend/.env` and restart the app first.

1. In a Discord server you own: **Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL**.
2. In BehindFeed, open **Circle**, enter a display name and paste the URL, then **Save**. The "Demo mode" banner disappears.
3. Check the preview, then click **Share my progress**.
   - [ ] "Shared with your circle" appears.
   - [ ] The Discord channel shows the message from "BehindFeed", identical to the preview (name in bold, goal, streak, drained-time change, encouraging line).
   - [ ] Nothing else is in the message: no emotions, topics or numbers from your sessions.
4. Pick a challenge and click **Post invite**. [ ] The invite appears in Discord.
5. Error paths:
   - [ ] Turn Wi-Fi off, click Share → "Couldn't reach Discord. Check your internet connection…"
   - [ ] Delete the webhook in Discord, click Share → "Discord did not accept this webhook…"
   - [ ] Type a non-Discord URL → the field shows "That doesn't look like a Discord webhook URL" and Save is disabled.
6. **Remove webhook** → demo mode with the three sample messages returns.

The webhook URL is stored only in this computer's app storage (localStorage). It is never written to the repo.

### 2. Windows notification

1. Open **Privacy** and make sure **Connect-instead nudges** is on.
2. Click **Simulate a draining stretch**.
   - [ ] An in-app card appears at the bottom right with one suggestion ("Message a friend?", "Step outside for 5 minutes?" or "Call someone you miss?").
   - [ ] A Windows notification "Time for a little break?" appears (bottom right / Action Center).
   - [ ] Clicking again rotates to the next suggestion.
3. If no Windows notification shows: check **Windows Settings → System → Notifications** (notifications on, Focus / Do not disturb off) and that "Electron" / "BehindFeed" is allowed.
4. Turn nudges off and click Simulate → [ ] the button is disabled and nothing appears.

### 3. Live data from the backend (L4)

1. Start the backend: see `backend/README.md` (`uvicorn app.main:app --port 8000`).
2. `npm run dev:api`. [ ] Sidebar shows **Data: Live**, no "Backend offline" banner.
3. Start a session: open Instagram (or `POST /sessions {"platform":"instagram"}`) and let Raad's loop post events.
   - [ ] Within ~5 s the session appears on Today with a **Live** badge; its ribbon grows every ~2 s.
   - [ ] Camera pill shows **Watching** while `GET /status` says `scrolling: true`.
4. Close the app/session. [ ] The Live badge goes away and the session shows its end time.
5. Stop the backend. [ ] Within ~5 s: "Backend offline – showing demo data" banner, Data: **Offline**, demo sessions.
6. Start it again. [ ] The banner disappears by itself and live data returns.

### 4. Quick visual pass (each page)

- [ ] **Today**: daily goal card at the top (ring, why line, check-in, streak), day strip, ribbon fits on screen at 1920×1080.
- [ ] **Session detail**: click a session panel → single-session report with "Back to …".
- [ ] **Privacy**: nudge switch and Simulate button.
- [ ] **Insights**: three finding cards, top triggers (top one in coral), platform mix; footnote says where the numbers came from.
- [ ] **Goals**: daily goal (full), weekly goal (from `/goal` in live mode), Support nearby (shown when this week is more than 30% drained, labelled "Sample listings").
- [ ] **Circle**: demo mode banner and sample messages without a webhook; preview and privacy note.

### Demo reset

The demo streak (4 days) and check-ins are stored locally. To reset them, open DevTools (Ctrl+Shift+I) → Application → Local Storage → delete keys starting with `behindfeed.`, then reload.

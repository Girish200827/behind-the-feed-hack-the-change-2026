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

1. In a Discord server you own: **Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL**.
2. In Scroll Mood, open **Circle**, enter a display name and paste the URL, then **Save**. The "Demo mode" banner disappears.
3. Check the preview, then click **Share my progress**.
   - [ ] "Shared with your circle" appears.
   - [ ] The Discord channel shows the message from "Scroll Mood", identical to the preview (name in bold, goal, streak, drained-time change, encouraging line).
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
3. If no Windows notification shows: check **Windows Settings → System → Notifications** (notifications on, Focus / Do not disturb off) and that "Electron" / "Scroll Mood" is allowed.
4. Turn nudges off and click Simulate → [ ] the button is disabled and nothing appears.

### 3. Quick visual pass (each page)

- [ ] **Today**: daily goal card at the top (ring, why line, check-in, streak), day strip, ribbon fits on screen at 1920×1080.
- [ ] **Session detail**: click a session panel → single-session report with "Back to …".
- [ ] **Privacy**: nudge switch and Simulate button.
- [ ] **Goals**: daily goal (full), weekly goal, Support nearby (shown when this week is more than 30% drained, labelled "Sample listings").
- [ ] **Circle**: demo mode banner and sample messages without a webhook; preview and privacy note.

### Demo reset

The demo streak (4 days) and check-ins are stored locally. To reset them, open DevTools (Ctrl+Shift+I) → Application → Local Storage → delete keys starting with `scrollmood.`, then reload.

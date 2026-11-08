# Backend (Allen)

This is a local FastAPI and SQLite service that runs on the laptop. It does three jobs:

- It detects when social media is in front.
- It stores every event.
- It serves the dashboard.

**It stores only text and numbers. No image or video ever reaches it.**

## Run

Windows: `run.bat` (backend only), or `..\start_app.bat` for the whole app. Tests: `python -m pytest -q tests`.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open http://127.0.0.1:8000/docs to try every endpoint from the browser.

**macOS:** no Accessibility permission is needed. The detector finds the front app with `lsappinfo`. If that app is Safari, Chrome, Brave, Arc or Edge, it reads the current tab's URL and title. The first time, macOS asks "<your terminal> wants to control Safari": click **Allow**. If you clicked Don't Allow, re-enable it under System Settings → Privacy & Security → **Automation**. Firefox can't be read this way. You can always start sessions by hand with `POST /sessions`.

Environment variables:
- `BEHINDFEED_DB`: path to the SQLite file. The default is `backend/behindfeed.db`.
- `BEHINDFEED_DETECTOR=0`: turns the window detector off, for example on a server or in tests.

## Fake data (A1)

```bash
python3 scripts/fake_session.py            # writes fake_session.json (20 min Instagram session)
python3 scripts/fake_session.py --post     # also sends it to the running API
```

`fake_session.json` has the same shape as `GET /sessions/{id}/timeline`, so the dashboard can switch from the file to the API without code changes.

## Endpoints

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/status` | Raad (L3) | `{"scrolling", "session_id", "platform", "paused", "camera"}`. The camera runs only while `camera` is true (scrolling and not paused). |
| POST | `/pause` | Cheema (C2) | The dashboard's Pause button. The camera turns off within a second; the session keeps counting time. |
| POST | `/resume` | Cheema (C2) | The Resume button. |
| POST | `/events` | Raad, Girish (L2) | Takes any `emotion_sample`, `mood_switch` or `context_label` exactly as written in contracts.md. Returns 422 for anything else. |
| GET | `/sessions` | Cheema (L4) | All sessions, newest first. |
| GET | `/sessions/{id}/timeline` | Cheema (L4) | `{session, emotions, switches, labels}`, ordered by time. |
| POST | `/sessions` | testing / demo fallback | Starts a session by hand: `{"platform": "instagram"}`. |
| PATCH | `/sessions/{id}` | testing / demo fallback | Ends it, with an optional `{"end": ts}`. |
| GET | `/insights` | Cheema (C4) | Trigger score per category, mood at session start vs. end, platform mix, longest session. |
| GET | `/goal` | Cheema, Girish (G4) | One weekly goal built from the top trigger. |

Sending an event from Python:

```python
import httpx
httpx.post("http://127.0.0.1:8000/events", json={"ts": 1794083400.5, "emotion": "sad", "valence": -0.6, "confidence": 0.81})
```

## How it works

- **Detector:** polls the active window once a second and matches the title against Instagram, TikTok, YouTube, X and Facebook. A session ends 5 s after the platform leaves the screen, so a quick alt-tab doesn't split it. A manual session is never ended by the detector.
- **Assigning events to sessions:** each event goes to the session whose time window contains its `ts`.
- **Trigger score:** for each content category, the share of mood switches whose `to` emotion is sad, angry, fear or disgust.

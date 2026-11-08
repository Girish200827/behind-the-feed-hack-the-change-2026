# Behind the Feed (Hack the Change 2026)

Deploy computer vision system to analyze facial expressions while the user scrolls on social media, and reflect back on the emotion and create for the user.

A desktop app for doomscrollers. While you scroll Instagram, TikTok, YouTube, X or Facebook, the camera reads your facial expression. When your mood shifts, it notes what was on screen at that moment. The dashboard then shows, live, which content lifts or drains you, and suggests one goal.

## Run it (Windows)

1. **Once:** double-click `setup_app.bat`. It installs the Python libraries (into `%USERPROFILE%\venvs\face`), the models and the dashboard (`npm install`; needs [Node.js](https://nodejs.org) 20+ and Python 3.11–3.13), and asks for a free [Gemini key](https://aistudio.google.com/apikey) for screen labels.
2. **Every time:** double-click `start_app.bat`. One window starts the backend, the camera and the dashboard, and shows their output.
3. Open Instagram (or TikTok, YouTube, X, Facebook) in your browser and scroll. The camera turns on by itself; the dashboard updates every 2 seconds.
4. **Stop:** close the dashboard window, or press Ctrl+C in the launcher window.

`start_demo.bat` runs the same app without a webcam (scripted moods and canned labels), for a demo on any laptop.

## Run it (macOS)

Same steps with the `.command` files: double-click `setup_app.command` once, then `start_app.command` (or `start_demo.command` without a webcam). If Finder says it cannot open them, run `chmod +x *.command` in Terminal in this folder once, or start them with `bash setup_app.command`. Needs Python 3.10–3.13 (python.org or `brew install python@3.12`) and Node.js (nodejs.org or `brew install node`).

- **Stop:** quit the dashboard with Cmd+Q (closing its window does not quit a Mac app), or Ctrl+C in Terminal.
- **Permissions, first start:** macOS asks to let Terminal use the camera, record the screen (screen labels) and control Chrome or Safari (to see which site is open). Allow all three. After allowing screen recording, quit Terminal and start again. Use Chrome, Safari, Edge, Brave or Arc; other browsers only show the app name, so sessions are not detected.
- **Privacy is the same as on Windows:** only the window in front is captured, and every window of the camera program (the preview) is blacked out, found by its process id. If the window list (Quartz, installed by setup) is missing, nothing is captured at all.

**If something goes wrong**

- Run only one `setup_app.bat` at a time, and wait for "Setup finished" before `start_app.bat`. Two npm installs in the same folder break each other; setup now refuses to start twice, and the launcher refuses to start while setup runs.
- "The dashboard's libraries are only half installed": close every other window using the folder (setup, the launcher, VS Code), then run `setup_app.bat` again. It removes the broken `frontend\node_modules` and reinstalls from `package-lock.json` (`npm ci`), then checks that Electron itself downloaded.
- The launcher starts the dashboard with Node.js directly (the same as `npm run dev:api`), so it does not need npm's helper commands.

| Option (`start_app.bat ...`) | What it does |
|---|---|
| `--no-preview` | Hide the camera window |
| `--no-screen` | No Gemini screen labels |
| `--demo` | No webcam: scripted moods into a demo Instagram session |
| `--check` | Only check that everything is installed |

## How the parts fit

```
backend/           FastAPI on 127.0.0.1:8000 + SQLite (backend/behindfeed.db)        Allen
   detects which app is in front -> scroll sessions; stores every event; insights + goal
   ^ GET /status (camera allowed?)        ^ POST /events (emotion, switches, labels)
computer_vision/face/    webcam -> face -> emotion -> mood switches                  Raad
computer_vision/screen/  at each switch: screen grab in memory -> Gemini -> label     Giresh
   v GET /sessions, /sessions/{id}/timeline, /insights, /goal   (every 2-15 s)
frontend/          Electron + React dashboard: Today, Session, Insights, Goals, Privacy   Cheema
   Pause/Resume -> POST /pause, /resume (the camera turns off within a second)
```

`launch.py` starts them in that order and stops them together.

## What is stored

Only text and numbers, in `backend/behindfeed.db` (and a copy of the events in `computer_vision/face/events.jsonl`): your emotion and the time about once a second, mood switches, and for each switch the content's category, tone and topic. **Never stored:** camera frames, face images or screenshots. Screenshots are sent to Gemini for labelling and dropped; on Gemini's free tier Google may use them to improve its products. These are mood signals, not a diagnosis.

## Changes made while connecting the parts

- Backend: `POST /pause`, `POST /resume`; `GET /status` also returns `paused` and `camera`; platform `other` accepted for labels; the window title is read directly on Windows; when a title names two sites, the last one wins.
- Camera: `--api URL` follows `/status` and posts every event.
- Dashboard: Pause calls the backend in API mode; Insights and the weekly goal refresh live; platform `other`; the online-labelling notice is confirmed.

## Team

Raad (computer vision, face) · Giresh (computer vision, screen) · Allen (backend) · Ahmad Cheema (frontend)

# face: webcam to mood switches (Raad)

Reads the webcam a few times a second, finds the face, runs an emotion model on it, and turns that into two of the events in `contracts.md`:

- `emotion_sample` once a second: `{"ts", "emotion", "valence", "confidence"}`
- `mood_switch` when the mood group changes and holds for 0.8 seconds (0.4 s for a strong expression; at least 2 seconds between switches): `{"id", "ts", "from", "to", "platform"}`

Mood groups: positive (happy), negative (sad, angry, fear, disgust), surprise, neutral. Flicker inside a group (sad to angry) is not a switch; the label shown is the strongest emotion in the group.

Each event is printed and appended as one JSON line to `events.jsonl`.

**Privacy:** frames are held in memory, analysed and dropped. Nothing from the camera is written to disk. The preview window is on screen only. `baseline.json` holds seven numbers (how your relaxed face scores), not an image.

## Easiest way (Windows): double-click

1. `setup.bat`: makes the Python environment in `%USERPROFILE%\venvs\face`, installs the libraries, downloads the emotion model and runs the tests. Once only.
2. `run.bat`: starts the camera with the preview window. Relaxed face until "Calibrated", then smile.
3. `scroll_test.bat`: runs without a window while you scroll Instagram; Ctrl+C (then N) shows a summary.

`summary.py` prints how many events are in `events.jsonl` and the last mood switches.

## Set up once by hand (Windows)

```
cd "G:\Hack The Change\face"
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

The face detector model is already in `models/`. Setup downloads the emotion model (about 16 MB) into `models/` too. If the download is blocked, the error prints a link: open it in your browser and save the file into `models/`.

## Run

| Command | What it is for |
|---|---|
| `python face_monitor.py --preview` | Normal run with a camera window. Keep a relaxed face for the first 8 seconds (calibration), then make faces. |
| `python face_monitor.py --preview --reuse-baseline` | Skip calibration and reuse the last one (good for the demo). |
| `python face_monitor.py --fake --fake-speed 5` | No camera: plays 89 seconds of scripted moods through the same logic. Giresh and Allen can test against this. |
| `python -m pytest -q` | Runs the tests (18). |

**Stage 2 "done when" test:** run with `--preview`, wait for "Calibrated", then smile widely and hold it. A `mood_switch ... "to": "happy"` line should appear in about 1 second. The bottom bar of the preview shows camera speed, faces analysed per second and model time.

### Options

| Flag | Default | Meaning |
|---|---|---|
| `--platform` | auto | `auto` reads it from the window in front (YouTube, Instagram, Facebook, TikTok, X, or `other` for Reddit, Threads...); or fix one |
| `--fps` | 15 | Most faces analysed per second (the preview always runs at camera speed) |
| `--no-mirror` | off | Score each face once instead of also mirrored: faster, a little less steady |
| `--no-landmarks` | off | Do not use the MediaPipe face landmarker |
| `--smile-gain` | 1.4 | How strongly the measured smile counts as happy (raise to 1.8 if small smiles still miss) |
| `--happy-boost` | 1.3 | Extra weight on happy when deciding the mood |
| `--calibrate` | 8 | Seconds of relaxed face to learn first; `0` turns calibration off |
| `--hold` / `--fast-hold` | 0.8 / 0.4 | Seconds a new mood must hold / a strong new mood must hold |
| `--smooth` | 0.25 | Smoothing time constant in seconds (lower reacts faster, jitters more) |
| `--cooldown` | 2 | Minimum seconds between switches (stops ping-pong). The screen labeller is never called again while its previous label is still being made |
| `--model` | enet_b0_8_va_mtl | HSEmotion model; `enet_b2_8` is a little more accurate and about 3 times slower |
| `--backend` | hsemotion | `deepface` is the fallback if HSEmotion will not install (`pip install deepface`) |
| `--camera` | 0 | Try `1` if the wrong camera opens |
| `--out`, `--no-file`, `--quiet` | events.jsonl | Where events go |

## Files

| File | Task | What it does |
|---|---|---|
| `detector.py` | R1 | Finds the largest face with OpenCV's YuNet detector, crops it |
| `emotion_model.py` | R2 | Face crop to probabilities over the 7 contract emotions, plus valence |
| `mood.py` | R3 | Smoothing, calibration, 2-second hold, 10-second cooldown, builds the events |
| `events.py` | L1, L2 | Prints, writes `events.jsonl`, posts to Allen, calls Giresh's function |
| `face_monitor.py` | | The program: camera loop, fake mode, command-line flags |
| `landmarks.py` | R2 | MediaPipe face landmarker: measures the smile and brow raise directly, fused into the emotion scores |
| `platforms.py` | | Which platform is in front, from the window title (read locally, never sent) |
| `download.py` | | Downloads model files, trusting the Windows certificate store like pip does |
| `test_mood.py` | | Tests with made-up emotion streams |

## Two signals

1. **Emotion model** (HSEmotion): names the emotion. It learned "happy" from photos of big smiles, so it misses small ones.
2. **Face landmarker** (MediaPipe, optional): measures single movements from 0 to 1, such as how far the mouth corners lift (`mouthSmileLeft/Right`) and whether the brows rise (`browInnerUp`). "Happy" becomes at least as strong as the measured smile, and "surprise" without raised brows or wide eyes (usually talking) is moved to neutral. The preview's bottom bar shows `smile 0.00`–`1.00`.

`setup.bat` installs MediaPipe with `--no-deps` so it does not add a second copy of OpenCV, and downloads `face_landmarker.task` (about 4 MB) into `models/`. If that download is blocked, get it in a browser from
https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
and save it in the face folder.

## With screen labels (Giresh's part)

`run_with_screen.bat` (or `--screen`) also grabs the window in front at each mood switch and labels it with Gemini; see `../screen/README.md`. `--screen-backend fake` tests the wiring without an API key.

## Connecting at 7 PM

- **L1 (to Giresh):** Giresh puts a function `grab_and_label(switch: dict) -> dict` in `screen/label.py` that returns a `context_label`. Run with `--on-switch screen.label:grab_and_label`. It runs in a background thread for each switch; the returned label is printed and saved too.
- **L2 (to Allen):** add `--post http://127.0.0.1:8000/events` (use Allen's real address). Same JSON, new destination. If Allen wants a `"type"` key to tell formats apart, agree it with the team and set `ADD_TYPE_FIELD = True` in `events.py`.
- **L3 (from Allen):** add `--gate-file ..\session.flag`. The camera (and its light) is on only while that file exists. Allen's detector writes the platform name (for example `instagram`) into it when a session starts and deletes it when the session ends.

## Tuning

- Too many switches: raise `--hold` to 1.5, or recalibrate with a relaxed face in your demo lighting.
- Slow laptop (analysed under 8/s in the bottom bar): add `--no-mirror`.
- Too few switches: lower `shift_needed` in `MoodSettings` (`mood.py`) from 0.15 to 0.10.
- Light from the front, camera at eye level. Strong backlight and side angles hurt every model.

## Troubleshooting

- **Camera will not open:** close Zoom, Teams or the Camera app; try `--camera 1`; in Windows Settings > Privacy & security > Camera, allow desktop apps.
- **`cv2.imshow` "function is not implemented":** a headless OpenCV is installed. Run `pip uninstall -y opencv-python-headless opencv-python` then `pip install "opencv-python<5"`.
- **Emotion model download fails:** switch to a phone hotspot for the first run, or use `--backend deepface`.

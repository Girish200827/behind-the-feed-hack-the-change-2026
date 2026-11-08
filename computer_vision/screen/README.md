# screen: what was on screen at each mood switch (Giresh's part)

At every `mood_switch` from the face part, this grabs the window in front, in memory, and asks Gemini what the content is. It returns one `context_label` per switch, in the `contracts.md` format:

```json
{"switch_id": "sw_1794100931979", "ts": 1794100932.0, "platform": "instagram", "category": "news", "tone": "negative", "topic": "layoff headlines"}
```

## How it runs in real time

```
camera on   ──> keep the last ~2.5 s of the window in front in memory (a small frame every 0.75 s)
mood_switch ──> a sharp grab now (1920 px, readable captions) + 2 frames from just before the switch
            ──> queue: at most 2 waiting; if Gemini is slow the oldest is dropped
            ──> one worker sends the 3 frames to Gemini ──> context_label about 1 to 4 s later
```

The face loop never waits. The earlier frames matter: the post that caused the reaction is usually on screen a second or two before the face changes. At most 12 Gemini calls a minute; a model that says "too many requests" rests for 60 s while the next model is used.

## Which platform

Each screenshot notes the platform from its window title (read on the laptop, never sent), for example "... - YouTube - Google Chrome". Gemini also says which app the screenshot looks like. The label uses the window title first, then what Gemini saw, then the mood switch. Platforms: instagram, tiktok, youtube, x, facebook, and `other` (Reddit, Threads, Snapchat, Pinterest, LinkedIn...). `other` is new: add it to `contracts.md`.

## Naming the subject

Gemini reads all visible text (video text and subtitles, caption, hashtags, page name, song title, top comments) and names the subject when it can: a public figure, film, show, game, character, brand or public page. It may name a famous person from their appearance only when confident. It never names or describes private people, and leaves out ordinary users' account names.

The subject goes into `topic` (for example `"<actor>: heartbreak film edit"`), so the contract does not change. The console also shows what Gemini used (`subject ...; from caption hashtags, song title`). To send `subject` as its own field, agree it with the team and set `ADD_SUBJECT_FIELD = True` in `label.py`.

## Privacy

- Only the **window in front** is captured, not the whole desktop.
- The **camera preview is never sent**: if it is in front the grab is skipped; if it overlaps the window it is blacked out.
- Screenshots are JPEG-encoded **in memory**, sent, and dropped. The short buffer only holds the last ~2.5 s, only while the camera is on, and is cleared when it turns off. Nothing is written to disk.
- The window title is never sent, and Gemini is never told how the user reacted. It may name public figures, films, shows and brands, but never private people or ordinary users' accounts.
- Say this to judges: on Gemini's **free tier, Google may use what is sent to improve its products**. For real users, a paid key (not used for training) or on-device text reading would be the next step.

## Files

| File | Task | What it does |
|---|---|---|
| `capture.py` | G1 | Grab the window in front with `mss`, black out the preview, shrink and encode in memory |
| `gemini_labeler.py` | G2 | Gemini call: JSON forced to the contract values, minimal thinking, model fallbacks, retries |
| `label.py` | L1, G3 | Real-time queue (`ScreenLabeler`), `grab_and_label(switch)`, and the test tools |
| `test_screen.py` | | 20 tests with stand-ins for Gemini and the screen |

Models tried in order: `gemini-3.5-flash` (best at reading and recognising), `gemini-3.1-flash-lite` (fastest), then the 2.5 models. The first that works is remembered. Force one with `--model` (here) or `--screen-model` (face monitor).

## Set up (once)

1. Get a free key: https://aistudio.google.com/apikey → "Create API key".
2. Double-click `setup_screen.bat`. It installs `mss` and `google-genai` into the face environment, asks for the key (saved to `gemini_key.txt`, which Git ignores) and runs the tests.

## Test (G3)

| Command | What it does |
|---|---|
| `test_screen.bat` | Press a key, click Instagram within 3 s; 3 frames over 1.5 s are labelled, with subject, evidence and time taken |
| `python label.py --loop 10` | A label every 10 s while you scroll; Ctrl+C to stop |
| `python label.py --folder C:\shots` | Label every screenshot in a folder (the "20 real posts" check) |
| `python label.py --test --backend fake` | Same, without an API key |

## Run with the face part

From the face folder: double-click `run_with_screen.bat`, or `python face_monitor.py --preview --screen`.
Both kinds of event go to the same `events.jsonl`; `summary.py` counts them.

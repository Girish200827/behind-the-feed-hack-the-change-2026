"""Raad's part: webcam -> face -> emotion -> mood switches.

Run (camera):  python face_monitor.py --preview
Run (no camera, scripted moods for teammates):  python face_monitor.py --fake --fake-speed 5

Prints one line per event and appends the JSON to events.jsonl in the
contracts.md formats. Frames are read into memory, analysed and dropped:
nothing from the camera is ever written to disk.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import threading
import time
from collections import deque
from typing import Optional, Tuple

from events import EventSink, SwitchHook
from mood import EMOTIONS, PLATFORMS, MoodSettings, MoodTracker, normalise

HERE = os.path.dirname(os.path.abspath(__file__))


def log(msg: str) -> None:
    print(f"[face] {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------- pipeline
class Pipeline:
    """Feeds the tracker, sends its events, saves the baseline once calibrated."""

    def __init__(self, tracker: MoodTracker, sink: EventSink, hook: Optional[SwitchHook], baseline_path: Optional[str]):
        self.tracker, self.sink, self.hook, self.baseline_path = tracker, sink, hook, baseline_path

    def feed(self, t: float, probs: dict, valence: Optional[float]) -> None:
        was_calibrating = self.tracker.calibrating
        for kind, event in self.tracker.feed(t, probs, valence):
            self.sink.emit(kind, event)
            if kind == "mood_switch" and self.hook:
                self.hook.submit(event)
        if was_calibrating and not self.tracker.calibrating and self.baseline_path:
            self.tracker.save_baseline(self.baseline_path)
            log(f"Saved resting-face baseline to {self.baseline_path} (reuse it with --reuse-baseline)")


class Gate:
    """L3: camera on only while social media is open.

    With --gate-file, the camera runs only while that file exists. Allen's
    detector creates it when a session starts (content: the platform name, for
    example "instagram") and deletes it when the session ends. Without
    --gate-file the camera is always on.

    Platform: with --platform auto (the default) it is read from the title of
    the window in front (platforms.py); otherwise the fixed --platform is used.
    """

    def __init__(self, path: Optional[str], default_platform: str):
        from platforms import PlatformWatcher
        self.path = path
        self.watcher = PlatformWatcher() if default_platform == "auto" else None
        self.default = "other" if default_platform == "auto" else default_platform
        self._checked, self._state = 0.0, (True, self.default)

    def platform(self) -> str:
        return self.watcher.get() if self.watcher else self.default

    def check(self) -> Tuple[bool, str]:
        if not self.path:
            return True, self.platform()
        now = time.time()
        if now - self._checked >= 0.25:
            self._checked = now
            try:
                with open(self.path, encoding="utf-8") as f:
                    name = f.read().strip().lower()
                self._state = (True, name if name in PLATFORMS else self.platform())
            except OSError:
                self._state = (False, self.default)
        return self._state


# ---------------------------------------------------------------- camera mode
def open_camera(index: int):
    import cv2
    backend = cv2.CAP_DSHOW if os.name == "nt" else cv2.CAP_ANY  # DirectShow opens fast on Windows
    cap = cv2.VideoCapture(index, backend)
    if not cap.isOpened():
        cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open camera {index}. Close other apps using it or try --camera 1.")
    # MJPG lets most USB and laptop webcams deliver 30 frames a second at 640x480.
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # always hand us the newest frame
    return cap


class Rate:
    """Events per second over the last ~2 seconds."""

    def __init__(self):
        self.times = deque(maxlen=60)

    def tick(self, t: float) -> None:
        self.times.append(t)

    def value(self) -> float:
        if len(self.times) < 2:
            return 0.0
        span = self.times[-1] - self.times[0]
        return (len(self.times) - 1) / span if span > 0 else 0.0


class Analyzer(threading.Thread):
    """Background thread: takes the newest camera frame, finds the face, runs the model.

    The camera loop never waits for the model, so the preview stays at camera
    speed. Frames that arrive while the model is busy are simply skipped.
    """

    def __init__(self, pipe: Pipeline, detector, model, max_fps: float, meter=None, smile_gain: float = 1.4):
        super().__init__(daemon=True)
        self.pipe, self.detector, self.model = pipe, detector, model
        self.meter, self.smile_gain = meter, smile_gain
        self.min_gap = 1.0 / max_fps if max_fps > 0 else 0.0
        self.lock = threading.Lock()          # guards the tracker and the results below
        self.box = None
        self.smile: Optional[float] = None
        self.rate = Rate()
        self.model_ms = 0.0
        self.error: Optional[BaseException] = None
        self._slot = threading.Condition()
        self._frame, self._t, self._seq, self._done = None, 0.0, 0, 0
        self._stop = False

    def submit(self, frame, t: float) -> None:
        with self._slot:
            self._frame, self._t = frame, t
            self._seq += 1
            self._slot.notify()

    def stop(self) -> None:
        with self._slot:
            self._stop = True
            self._slot.notify()

    def run(self) -> None:
        from detector import aligned_crop
        last = 0.0
        try:
            while True:
                wait = self.min_gap - (time.time() - last)
                if wait > 0:
                    time.sleep(wait)
                with self._slot:
                    while self._seq == self._done and not self._stop:
                        self._slot.wait(0.5)
                    if self._stop:
                        return
                    frame, t, self._done = self._frame, self._t, self._seq
                last = time.time()
                face = self.detector.detect(frame)
                if face is None:
                    with self.lock:
                        self.box = None
                    continue
                crop = aligned_crop(frame, face)
                if crop is None:
                    continue
                t0 = time.perf_counter()
                probs, valence = self.model.predict(crop)
                smile = None
                if self.meter is not None:
                    try:
                        bs = self.meter.measure(frame, t)
                    except Exception as err:  # noqa: BLE001 - keep going with the emotion model alone
                        log(f"Face landmarker stopped ({err!r}); continuing with the emotion model only.")
                        self.meter, bs = None, None
                    if bs:
                        from landmarks import fuse, smile_score
                        probs = fuse(probs, bs, self.smile_gain)
                        smile = smile_score(bs)
                ms = (time.perf_counter() - t0) * 1000
                with self.lock:
                    self.pipe.feed(t, probs, valence)
                    self.box = face.box
                    self.smile = smile
                    self.model_ms = ms if not self.model_ms else 0.8 * self.model_ms + 0.2 * ms
                    self.rate.tick(time.time())
                del frame, crop  # dropped here; nothing is written to disk
        except BaseException as err:  # noqa: BLE001 - reported by the camera loop
            self.error = err


def status_lines(tracker: MoodTracker, analyzer: Analyzer, cam_fps: float):
    if tracker.calibrating:
        top = "calibrating: relaxed face please"
    elif tracker.smoothed is None:
        top = "looking for a face"
    else:
        label, conf, val = tracker.read()
        top = f"now {label} {conf:.2f}  valence {val:+.2f}  mood {tracker.mood}{tracker.pending()}"
    smile = f" | smile {analyzer.smile:.2f}" if analyzer.smile is not None else ""
    speed = (f"camera {cam_fps:.0f} fps | analysed {analyzer.rate.value():.0f}/s | "
             f"models {analyzer.model_ms:.0f} ms{smile}")
    return top, speed


def draw_preview(frame, box, lines) -> bool:
    """Show the frame on screen only (never saved). Returns True when the user quits."""
    import cv2
    h, w = frame.shape[:2]
    disp = cv2.flip(frame, 1)  # mirror, like a selfie camera
    if box:
        x, y, bw, bh = box
        cv2.rectangle(disp, (w - x - bw, y), (w - x, y + bh), (80, 220, 80), 2)
    cv2.rectangle(disp, (0, 0), (w, 30), (0, 0, 0), -1)
    cv2.putText(disp, lines[0], (8, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.rectangle(disp, (0, h - 24), (w, h), (0, 0, 0), -1)
    cv2.putText(disp, lines[1], (8, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1, cv2.LINE_AA)
    title = "Face preview (nothing is saved) - press q to quit"
    cv2.imshow(title, disp)
    key = cv2.waitKey(1) & 0xFF
    return key in (ord("q"), 27) or cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1


def run_camera(args, pipe: Pipeline) -> None:
    import cv2
    from detector import FaceDetector
    from emotion_model import load_model

    detector = FaceDetector()
    model = load_model(args.backend, args.model, mirror=not args.no_mirror)
    log(f"Face detector: {detector.kind}. Emotion model: {model.name}"
        + (f" ({args.model})" if model.name == "hsemotion" else "") + ". Ctrl+C to stop.")
    meter = None
    if not args.no_landmarks:
        try:
            from landmarks import ExpressionMeter
            meter = ExpressionMeter()
            log("Face landmarker: on (measures smiles and raised brows directly).")
        except Exception as err:  # noqa: BLE001 - optional
            log(f"Face landmarker: off ({str(err).splitlines()[0]}). Run setup.bat to add it.")

    analyzer = Analyzer(pipe, detector, model, args.fps, meter=meter, smile_gain=args.smile_gain)
    analyzer.start()
    gate = Gate(args.gate_file, args.platform)
    tracker = pipe.tracker
    cap, platform, fails = None, args.platform, 0
    cam_rate, last_log = Rate(), time.time()
    try:
        while True:
            if analyzer.error:
                raise RuntimeError(f"Analysis stopped: {analyzer.error!r}") from analyzer.error
            active, now_platform = gate.check()
            if not active:
                if cap is not None:
                    cap.release()
                    cap = None
                    if args.preview:
                        cv2.destroyAllWindows()
                    if hasattr(pipe.hook, "set_active"):
                        pipe.hook.set_active(False)   # stop buffering the screen too
                    log("Camera off: no social media open.")
                time.sleep(0.25)
                continue
            if cap is None:
                cap = open_camera(args.camera)
                if hasattr(pipe.hook, "set_active"):
                    pipe.hook.set_active(True)
                platform = now_platform
                with analyzer.lock:
                    tracker.new_session(platform)
                log(f"Camera on ({platform}).")
            elif now_platform != platform:
                platform = now_platform          # switched app or tab: keep the mood, change the label
                with analyzer.lock:
                    tracker.platform = platform
                log(f"Now on {platform}.")

            ok, frame = cap.read()
            if not ok:
                fails += 1
                if fails > 100:
                    raise RuntimeError("The camera stopped sending frames.")
                time.sleep(0.02)
                continue
            fails = 0
            now = time.time()
            cam_rate.tick(now)
            analyzer.submit(frame, now)

            if args.preview:
                with analyzer.lock:
                    box = analyzer.box
                    lines = status_lines(tracker, analyzer, cam_rate.value())
                if draw_preview(frame, box, lines):
                    break
            elif now - last_log > 30:
                last_log = now
                log(status_lines(tracker, analyzer, cam_rate.value())[1])
            del frame  # the frame is dropped here; nothing is written to disk
    except KeyboardInterrupt:
        pass
    finally:
        analyzer.stop()
        analyzer.join(timeout=2)
        if meter is not None:
            try:
                meter.close()  # close MediaPipe before Python shuts down, or it prints a harmless error
            except Exception:  # noqa: BLE001
                pass
        if cap is not None:
            cap.release()
        if args.preview:
            cv2.destroyAllWindows()


# ---------------------------------------------------------------- fake mode
FAKE_SCRIPT = [("neutral", 12), ("happy", 6), ("neutral", 13), ("sad", 7), ("neutral", 12),
               ("angry", 5), ("neutral", 12), ("surprise", 4), ("fear", 6), ("neutral", 12)]


def fake_probs(target: str, rng: random.Random) -> dict:
    p = {e: rng.random() * 0.1 for e in EMOTIONS}
    p["sad"] += 0.15     # like many real resting faces, the fake one reads a little sad
    p[target] += 0.65
    return normalise(p)


def run_fake(args, pipe: Pipeline) -> None:
    """Scripted moods through the real tracker, so Giresh and Allen can test without a camera."""
    rng = random.Random(7)
    step = 1.0 / args.fps
    t = time.time()
    total = sum(s for _, s in FAKE_SCRIPT)
    log(f"Fake mode: {total} s of scripted moods x {args.fake_loops}, at {args.fake_speed:g}x speed.")
    try:
        for _ in range(args.fake_loops):
            for target, seconds in FAKE_SCRIPT:
                for _ in range(int(seconds * args.fps)):
                    pipe.feed(t, fake_probs(target, rng), None)
                    t += step
                    time.sleep(step / args.fake_speed)
    except KeyboardInterrupt:
        pass


# ---------------------------------------------------------------- main
def parse_args(argv=None):
    ap = argparse.ArgumentParser(description="Webcam -> emotion_sample and mood_switch events.")
    ap.add_argument("--platform", default="auto", choices=["auto"] + PLATFORMS,
                    help="auto = read it from the window in front; or fix one platform")
    ap.add_argument("--backend", default="hsemotion", choices=["hsemotion", "deepface"])
    ap.add_argument("--model", default="enet_b0_8_va_mtl",
                    help="HSEmotion model: enet_b0_8_va_mtl, enet_b0_8_best_vgaf, enet_b0_8_best_afew, enet_b2_8, enet_b2_7")
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    ap.add_argument("--fps", type=float, default=15.0, help="most frames analysed per second (the preview always runs at camera speed)")
    ap.add_argument("--no-mirror", action="store_true", help="score each face once instead of also mirrored (faster, a little less steady)")
    ap.add_argument("--no-landmarks", action="store_true", help="do not use the MediaPipe face landmarker (smile and brow measurements)")
    ap.add_argument("--smile-gain", type=float, default=1.4, help="how strongly the measured smile counts as happy")
    ap.add_argument("--happy-boost", type=float, default=1.3, help="extra weight on happy when deciding the mood")
    ap.add_argument("--preview", action="store_true", help="show the camera with the live reading (on screen only)")
    ap.add_argument("--calibrate", type=float, default=8.0, help="seconds of relaxed face to learn first; 0 = off")
    ap.add_argument("--reuse-baseline", action="store_true", help="load baseline.json instead of calibrating")
    ap.add_argument("--hold", type=float, default=0.8, help="seconds a new mood must hold")
    ap.add_argument("--fast-hold", type=float, default=0.4, help="seconds a strong new mood must hold")
    ap.add_argument("--smooth", type=float, default=0.25, help="smoothing time constant in seconds")
    ap.add_argument("--cooldown", type=float, default=2.0, help="minimum seconds between switches")
    ap.add_argument("--out", default="events.jsonl", help="file to append events to")
    ap.add_argument("--no-file", action="store_true", help="print only, do not write events.jsonl")
    ap.add_argument("--quiet", action="store_true", help="do not print events")
    ap.add_argument("--post", metavar="URL", help="L2: also POST each event to Allen's endpoint")
    ap.add_argument("--on-switch", metavar="MODULE:FUNC", help="L1: call Giresh's labeller, e.g. screen.label:grab_and_label")
    ap.add_argument("--gate-file", metavar="PATH", help="L3: camera on only while this file exists")
    ap.add_argument("--screen", action="store_true", help="L1: grab the screen at each mood switch and label it with Gemini (../screen)")
    ap.add_argument("--screen-backend", default="gemini", choices=["gemini", "fake"], help="fake = canned labels, no API key")
    ap.add_argument("--screen-model", help="force one Gemini model, e.g. gemini-3.5-flash")
    ap.add_argument("--fake", action="store_true", help="no camera: play scripted moods")
    ap.add_argument("--fake-speed", type=float, default=1.0, help="fake mode speed-up")
    ap.add_argument("--fake-loops", type=int, default=1)
    return ap.parse_args(argv)


def main(argv=None) -> None:
    args = parse_args(argv)
    settings = MoodSettings(hold_s=args.hold, fast_hold_s=min(args.fast_hold, args.hold), smooth_s=args.smooth,
                            cooldown_s=args.cooldown, calibrate_s=args.calibrate, happy_boost=args.happy_boost)
    baseline_path = os.path.join(HERE, "baseline.json")
    baseline = None
    if args.reuse_baseline and os.path.exists(baseline_path) and not args.fake:
        with open(baseline_path, encoding="utf-8") as f:
            baseline = json.load(f)
        log("Loaded saved resting-face baseline.")
    start_platform = args.platform if args.platform != "auto" else ("instagram" if args.fake else "other")
    tracker = MoodTracker(start_platform, settings, baseline=baseline, log=log)
    sink = EventSink(None if args.no_file else args.out, post_url=args.post, echo=not args.quiet)
    if args.screen:
        hook = make_screen_hook(args, sink)
    else:
        hook = SwitchHook(args.on_switch, sink) if args.on_switch else None
    pipe = Pipeline(tracker, sink, hook, None if args.fake else baseline_path)
    try:
        (run_fake if args.fake else run_camera)(args, pipe)
    finally:
        if hook is not None and hasattr(hook, "close"):
            hook.close()      # waits a few seconds for labels still in progress
        else:
            time.sleep(0.2)   # let a pending labeller thread finish its line
        sink.close()
        log("Stopped.")


def make_screen_hook(args, sink: EventSink):
    """L1: Giresh's ScreenLabeler from ../screen, feeding context_label events into the same sink."""
    repo_root = os.path.dirname(HERE)
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)
    from screen.label import ScreenLabeler, capture
    grab = None
    if args.fake and args.screen_backend == "fake":
        grab = capture.fake_shot  # no real screen needed for a fully fake run
    labeler = ScreenLabeler(lambda ev: sink.emit("context_label", ev), backend=args.screen_backend,
                            model=args.screen_model, grab=grab,
                            log=lambda m: print(f"[screen] {m}", file=sys.stderr, flush=True))
    log(f"Screen labels: on ({args.screen_backend}). Screenshots stay in memory; the camera preview is never sent.")
    return labeler


if __name__ == "__main__":
    main()

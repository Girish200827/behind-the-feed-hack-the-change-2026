"""Girish's part: screen grab in memory -> context_label (G1, G2, G3, L1).

Real-time design (runs next to the face monitor):
  while the camera is on: keep the last ~2.5 s of the window in front in memory
                          (a small frame every 0.75 s, older frames overwritten)
  mood_switch --> a sharp grab NOW + up to 2 frames from just before the switch
              --> queue (at most 2 waiting; oldest dropped if Gemini is slow)
              --> one worker sends them to Gemini --> context_label, ~1-4 s later
The face loop never waits. Screenshots live only in memory and are dropped
after labelling or when they age out of the buffer.

Use from the face monitor:   python face_monitor.py --preview --screen
Test on its own (G3):
  python label.py --test                3 frames over 1.5 s after a 3 s countdown
  python label.py --loop 10             the same every 10 s while you scroll
  python label.py --folder C:\\shots    label every image in a folder
Add  --backend fake  to test without an API key.
"""
from __future__ import annotations

import argparse
import json
import os
import queue
import sys
import threading
import time
from collections import deque
from typing import Callable, List, Optional

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import capture  # noqa: E402
from gemini_labeler import RateLimited, make_labeler  # noqa: E402

PLATFORMS = ["instagram", "tiktok", "youtube", "x", "facebook", "other"]


def pick_platform(title_says: Optional[str], gemini_saw: Optional[str], switch_says: Optional[str]) -> str:
    """Window title first (exact, read locally), then what Gemini saw, then the mood_switch."""
    for p in (title_says, gemini_saw, switch_says):
        if p in PLATFORMS and p != "other":
            return p
    return "other"
CONTRACT_KEYS = ("category", "tone", "topic")
ADD_SUBJECT_FIELD = False   # contracts.md has no "subject"; set True once the team agrees to add it
SHARP_SIDE = 1920           # the grab at the switch: big enough to read captions and handles
BUFFER_SIDE = 1024          # frames from just before the switch


def _err(msg: str) -> None:
    print(f"[screen] {msg}", file=sys.stderr, flush=True)


def _call_grab(grab, max_side: int):
    try:
        return grab(max_side=max_side)
    except TypeError:            # a grab function without the max_side option
        return grab()


class ScreenLabeler:
    """submit(mood_switch) returns at once; on_label(context_label) is called later."""

    def __init__(self, on_label: Callable[[dict], None], backend: str = "gemini", model: Optional[str] = None,
                 per_minute: int = 12, max_waiting: int = 2, log: Callable[[str], None] = _err,
                 grab: Optional[Callable] = None, labeler=None,
                 buffer_every_s: float = 0.75, lookback_s: float = 2.5, earlier_frames: int = 2):
        self.on_label, self.log = on_label, log
        self.labeler = labeler or make_labeler(backend, model)
        self.grab = grab or capture.grab
        self.per_minute, self.max_waiting = per_minute, max_waiting
        self.buffer_every_s, self.lookback_s, self.earlier_frames = buffer_every_s, lookback_s, earlier_frames
        self.q: "queue.Queue" = queue.Queue()
        self._qlock = threading.Lock()
        self._calls: deque = deque()
        self._backoff_until = 0.0
        self._frames: deque = deque(maxlen=max(2, int(lookback_s / max(buffer_every_s, 0.1)) + 1))
        self._flock = threading.Lock()
        self._active = threading.Event()
        self._stop = threading.Event()
        self.stats = {"grabbed": 0, "labelled": 0, "skipped": 0, "dropped": 0, "failed": 0}
        self.last_seconds: Optional[float] = None
        self._worker = threading.Thread(target=self._work, daemon=True)
        self._worker.start()
        self._buffer = None
        if buffer_every_s > 0 and earlier_frames > 0:
            self._buffer = threading.Thread(target=self._buffer_loop, daemon=True)
            self._buffer.start()
        self.set_active(True)

    # ---------- the short memory of what was on screen ----------
    def set_active(self, on: bool) -> None:
        """Buffer the screen only while the camera is on (the face monitor calls this)."""
        with self._flock:
            if on:
                self._active.set()
            else:
                self._active.clear()
                self._frames.clear()

    def _buffer_loop(self) -> None:
        while not self._stop.is_set():
            if not self._active.wait(0.5):
                continue
            try:
                shot = _call_grab(self.grab, BUFFER_SIDE)
                with self._flock:
                    if self._active.is_set():   # the camera may have turned off during the grab
                        self._frames.append(shot)
            except Exception:  # noqa: BLE001 - preview in front, minimised window...: just skip this frame
                pass
            self._stop.wait(self.buffer_every_s)

    def _earlier(self, before: float) -> List["capture.Shot"]:
        with self._flock:
            recent = [s for s in self._frames if before - self.lookback_s <= s.t < before - 0.2]
        if len(recent) <= self.earlier_frames:
            return recent
        step = (len(recent) - 1) / float(self.earlier_frames - 1) if self.earlier_frames > 1 else 0
        return [recent[round(i * step)] for i in range(self.earlier_frames)]

    # ---------- called from the face analysis thread: must be quick ----------
    def submit(self, switch: dict) -> None:
        threading.Thread(target=self._grab, args=(dict(switch), time.time()), daemon=True).start()

    def _grab(self, switch: dict, received: float) -> None:
        try:
            shot = _call_grab(self.grab, SHARP_SIDE)
            # label time on the switch's own clock: switch time + how long the grab took
            switch["_label_ts"] = switch.get("ts", shot.t) + max(0.0, shot.t - received)
        except capture.SkipGrab as why:
            self.stats["skipped"] += 1
            self.log(f"No screenshot for {switch.get('id')}: {why}.")
            return
        except Exception as err:  # noqa: BLE001
            self.stats["failed"] += 1
            self.log(f"Screen grab failed: {err!r}")
            return
        shots = self._earlier(received) + [shot]
        self.stats["grabbed"] += 1
        with self._qlock:
            while self.q.qsize() >= self.max_waiting:
                try:
                    self.q.get_nowait()
                    self.stats["dropped"] += 1
                except queue.Empty:
                    break
            self.q.put((switch, shots))

    def _allowed(self, now: float) -> bool:
        while self._calls and now - self._calls[0] > 60:
            self._calls.popleft()
        return now >= self._backoff_until and len(self._calls) < self.per_minute

    def _work(self) -> None:
        while True:
            item = self.q.get()
            if item is None:
                return
            switch, shots = item
            del item
            now = time.time()
            if not self._allowed(now):
                self.stats["dropped"] += 1
                continue
            self._calls.append(now)
            span = shots[-1].t - shots[0].t
            title_says = next((s.platform for s in reversed(shots) if s.platform), None)
            try:
                fields = self.labeler.label([s.jpeg for s in shots], title_says, span)
            except RateLimited:
                self._backoff_until = time.time() + 30
                self.stats["failed"] += 1
                self.log("Gemini says too many requests on every model; pausing labels for 30 s.")
                continue
            except Exception as err:  # noqa: BLE001
                self.stats["failed"] += 1
                self.log(f"Labelling failed for {switch.get('id')}: {err}")
                continue
            self.last_seconds = time.time() - shots[-1].t
            n = len(shots)
            del shots  # the screenshots are dropped here; they were never written to disk
            self.stats["labelled"] += 1
            event = {"switch_id": switch["id"], "ts": round(switch["_label_ts"], 1),
                     "platform": pick_platform(title_says, fields.get("platform_seen"), switch.get("platform")),
                     **{k: fields[k] for k in CONTRACT_KEYS}}
            if ADD_SUBJECT_FIELD:
                event["subject"] = fields.get("subject", "")
            if fields.get("subject") or fields.get("evidence"):
                self.log(f"{switch['id']}: subject {fields.get('subject') or '-'}; from {fields.get('evidence') or '-'} "
                         f"({n} frame{'s' if n > 1 else ''}, {self.last_seconds:.1f} s)")
            try:
                self.on_label(event)
            except Exception as err:  # noqa: BLE001
                self.log(f"Could not pass on the label: {err!r}")

    def close(self, wait_s: float = 8.0) -> None:
        """Let waiting screenshots finish labelling (up to wait_s), then stop."""
        time.sleep(0.1)  # let a grab thread started a moment ago queue its shots
        self._stop.set()
        self._active.set()          # wake the buffer thread so it can exit
        self.q.put(None)
        self._worker.join(timeout=wait_s)
        with self._flock:
            self._frames.clear()
        s = self.stats
        self.log(f"Screen labels: {s['labelled']} made, {s['skipped']} skipped, {s['dropped']} dropped, "
                 f"{s['failed']} failed" + (f" (model {self.labeler.model_used})" if getattr(self.labeler, 'model_used', None) else ""))


# ---------- L1 contract: one call, returns a context_label ----------
_default = None


def grab_and_label(switch: dict) -> Optional[dict]:
    """Grab the screen now and label it (blocks for the Gemini call, about 1-3 s). One frame only."""
    global _default
    if _default is None:
        _default = make_labeler("gemini")
    try:
        shot = capture.grab(max_side=SHARP_SIDE)
    except capture.SkipGrab:
        return None
    fields = _default.label([shot.jpeg], shot.platform)
    return {"switch_id": switch["id"], "ts": round(shot.t, 1),
            "platform": pick_platform(shot.platform, fields.get("platform_seen"), switch.get("platform")),
            **{k: fields[k] for k in CONTRACT_KEYS}}


# ---------- G3 test tools ----------
def _label_shots(labeler, platform: str, shots) -> None:
    t0 = time.time()
    title_says = platform if platform != "auto" else next((s.platform for s in reversed(shots) if s.platform), None)
    fields = labeler.label([s.jpeg for s in shots], title_says, shots[-1].t - shots[0].t)
    last = shots[-1]
    chosen = pick_platform(title_says, fields.get("platform_seen"), None)
    print(json.dumps({"platform": chosen, **fields}), f"\n  (window title said {title_says or 'nothing'}; "
          f"Gemini saw {fields.get('platform_seen') or '?'}; {time.time() - t0:.1f} s, {len(shots)} frame(s), "
          f"last {last.width}x{last.height} {len(last.jpeg) // 1024} KB, model {getattr(labeler, 'model_used', '?')})",
          flush=True)


def _burst(frames: int = 3, every_s: float = 0.75) -> list:
    """Like the live buffer: small frames first, a sharp one last."""
    shots = []
    for i in range(frames):
        shots.append(capture.grab(max_side=SHARP_SIDE if i == frames - 1 else BUFFER_SIDE))
        if i < frames - 1:
            time.sleep(every_s)
    return shots


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Screen grab in memory -> context_label")
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--test", action="store_true", help="3 frames over 1.5 s after a 3 second countdown")
    mode.add_argument("--loop", type=float, metavar="SECONDS", help="the same every SECONDS until Ctrl+C")
    mode.add_argument("--folder", metavar="PATH", help="label every .png/.jpg in a folder")
    ap.add_argument("--platform", default="auto", choices=["auto"] + PLATFORMS,
                    help="auto = from the window title, then from what Gemini sees")
    ap.add_argument("--backend", default="gemini", choices=["gemini", "fake"])
    ap.add_argument("--model", help="force one Gemini model, e.g. gemini-3.1-flash-lite")
    ap.add_argument("--frames", type=int, default=3, help="frames per label in --test/--loop (1 = old behaviour)")
    args = ap.parse_args(argv)
    labeler = make_labeler(args.backend, args.model)

    if args.folder:
        import cv2
        names = sorted(n for n in os.listdir(args.folder) if n.lower().endswith((".png", ".jpg", ".jpeg")))
        for n in names:
            img = cv2.imread(os.path.join(args.folder, n))
            if img is None:
                continue
            jpeg, w, h = capture.encode(img, SHARP_SIDE)
            print(f"{n}: ", end="")
            _label_shots(labeler, args.platform, [capture.Shot(jpeg, w, h, time.time(), "file")])
        return

    try:
        while True:
            if args.test:
                for i in (3, 2, 1):
                    where = "your social media window" if args.platform == "auto" else args.platform
                    print(f"Click on {where} now... {i}", flush=True)
                    time.sleep(1)
            try:
                _label_shots(labeler, args.platform, _burst(max(1, args.frames)))
            except capture.SkipGrab as why:
                print(f"Skipped: {why}")
            if args.test:
                return
            time.sleep(args.loop)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

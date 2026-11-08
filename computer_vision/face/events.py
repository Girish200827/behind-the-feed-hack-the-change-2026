"""Where events go: the screen, events.jsonl, and later Allen's endpoint (L2)
and Girish's grab-and-label function (L1).

Each line in events.jsonl is exactly one contracts.md object. contracts.md has
no "type" key, so a reader tells formats apart by their keys (emotion_sample has
"emotion", mood_switch has "from"/"to", context_label has "switch_id").
If the team agrees to add "type", set ADD_TYPE_FIELD = True.
"""
from __future__ import annotations

import importlib
import json
import os
import queue
import sys
import threading
import urllib.error
import urllib.request
from typing import Callable, Optional

ADD_TYPE_FIELD = False


def _err(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


class EventSink:
    def __init__(self, path: Optional[str] = "events.jsonl", post_url: Optional[str] = None, echo: bool = True):
        self.echo = echo
        self.post_url = post_url
        self._lock = threading.Lock()
        self._file = open(path, "a", encoding="utf-8") if path else None
        self._q: "queue.Queue[Optional[str]]" = queue.Queue(maxsize=1000)
        self._post_errors = 0
        self.posted = 0
        self.rejected = 0
        self._worker = None
        if post_url:
            self._worker = threading.Thread(target=self._post_loop, daemon=True)
            self._worker.start()

    def emit(self, kind: str, event: dict) -> None:
        record = {"type": kind, **event} if ADD_TYPE_FIELD else dict(event)
        line = json.dumps(record, separators=(", ", ": "))
        with self._lock:
            if self.echo:
                print(f"{kind:<15} {line}", flush=True)
            if self._file:
                self._file.write(line + "\n")
                self._file.flush()
        if self.post_url:
            try:
                self._q.put_nowait(line)
            except queue.Full:
                pass

    def _post_loop(self) -> None:
        while True:
            line = self._q.get()
            if line is None:
                return
            req = urllib.request.Request(self.post_url, data=line.encode("utf-8"),
                                         headers={"Content-Type": "application/json"}, method="POST")
            try:
                urllib.request.urlopen(req, timeout=3).read()
                self._post_errors = 0
                self.posted += 1
            except urllib.error.HTTPError as err:   # the backend answered but refused the event
                self.rejected += 1
                if self.rejected in (1, 10, 100):
                    body = err.read().decode("utf-8", "replace")[:300]
                    _err(f"Backend refused an event ({err.code}): {body}\n  event: {line[:200]}")
            except Exception as err:  # noqa: BLE001 - never stop the camera loop over a network error
                self._post_errors += 1
                if self._post_errors in (1, 10, 100):
                    _err(f"Could not send event to {self.post_url}: {err}")

    def close(self) -> None:
        if self._worker:
            self._q.put(None)
            self._worker.join(timeout=3)
        if self._file:
            self._file.close()


class SwitchHook:
    """L1: call Girish's function, e.g. "screen.label:grab_and_label", for every mood_switch.

    The function gets the mood_switch dict and should return a context_label dict
    (or None). It runs in a background thread so the camera never waits for it.
    While one label is still being made, new switches are not labelled (they are
    still sent as mood_switch events), so a slow vision model is never flooded.
    """

    def __init__(self, spec: str, sink: EventSink):
        module_name, _, func_name = spec.partition(":")
        if not func_name:
            raise ValueError("--on-switch needs MODULE:FUNCTION, for example screen.label:grab_and_label")
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if repo_root not in sys.path:
            sys.path.insert(0, repo_root)
        self.func: Callable[[dict], Optional[dict]] = getattr(importlib.import_module(module_name), func_name)
        self.sink = sink
        self._busy = threading.Lock()
        self.skipped = 0

    def submit(self, switch: dict) -> None:
        if not self._busy.acquire(blocking=False):
            self.skipped += 1          # previous label still in progress
            return
        threading.Thread(target=self._run, args=(dict(switch),), daemon=True).start()

    def _run(self, switch: dict) -> None:
        try:
            label = self.func(switch)
            if label:
                self.sink.emit("context_label", label)
        except Exception as err:  # noqa: BLE001
            _err(f"Screen labeller failed for {switch.get('id')}: {err}")
        finally:
            self._busy.release()

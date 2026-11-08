"""A3 - social media detector.

Polls the active window title once a second. When it shows a social platform a session starts;
when the platform has been gone for GRACE_SECONDS the session ends. Raad's camera loop reads
`state.snapshot()` through GET /status (link L3): no social media open, no camera.
"""

from __future__ import annotations

import logging
import re
import subprocess
import sys
import threading
import time
from typing import Any

from . import db

log = logging.getLogger("behindfeed.detector")

POLL_SECONDS = 1.0
GRACE_SECONDS = 5.0  # a quick alt-tab should not split a session

# Order matters only if a title somehow matches two platforms.
PLATFORM_PATTERNS = [
    ("instagram", re.compile(r"instagram", re.I)),
    ("tiktok", re.compile(r"tiktok", re.I)),
    ("youtube", re.compile(r"youtube", re.I)),
    ("facebook", re.compile(r"facebook", re.I)),
    # X titles look like "Home / X", "Name on X: \"...\"", or contain x.com / Twitter.
    ("x", re.compile(r"(/ x(\s|$)|\bon x:|\bx\.com\b|\btwitter\b)", re.I)),
]


def match_platform(title: str | None) -> str | None:
    """The platform named in a window title. If several are named ("Instagram tips - YouTube - Chrome"),
    the one nearest the end wins, because that is where browsers put the site name."""
    if not title:
        return None
    best, best_end = None, -1
    for name, pat in PLATFORM_PATTERNS:
        for m in pat.finditer(title):
            if m.end() > best_end:
                best, best_end = name, m.end()
    return best


class State:
    """Current scroll session, shared by the detector thread and the manual endpoints."""

    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.session_id: str | None = None
        self.platform: str | None = None
        self.manual = False  # started through POST /sessions; the detector leaves it alone
        self.last_seen = 0.0
        self.detector_running = False
        self.last_title: str | None = None
        self.paused = False  # set from the dashboard's Pause button (POST /pause); the camera must stay off

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            scrolling = self.session_id is not None
            return {
                "scrolling": scrolling,
                "session_id": self.session_id,
                "platform": self.platform,
                "manual": self.manual,
                "detector_running": self.detector_running,
                "paused": self.paused,
                # what the camera loop obeys: on only while scrolling and not paused
                "camera": scrolling and not self.paused,
            }

    def set_paused(self, paused: bool) -> dict[str, Any]:
        with self.lock:
            self.paused = paused
            log.info("camera %s from the dashboard", "paused" if paused else "resumed")
        return self.snapshot()

    def start(self, platform: str, manual: bool = False, start: float | None = None) -> dict[str, Any]:
        with self.lock:
            if self.session_id:
                self.end()
            s = db.start_session(platform, start)
            self.session_id, self.platform, self.manual = s["id"], platform, manual
            self.last_seen = time.time()
            log.info("session %s started on %s%s", s["id"], platform, " (manual)" if manual else "")
            return s

    def end(self, session_id: str | None = None, end: float | None = None) -> dict[str, Any] | None:
        with self.lock:
            sid = session_id or self.session_id
            if not sid:
                return None
            s = db.end_session(sid, end)
            if sid == self.session_id:
                log.info("session %s ended", sid)
                self.session_id, self.platform, self.manual = None, None, False
            return s


state = State()


# ---------- macOS: no Accessibility permission needed ----------
# The front app comes from `lsappinfo` (no permission). If it is a browser, its current tab's URL and
# title come from AppleScript; macOS asks once "<terminal> wants to control <browser>" -> Allow.

SAFARI_IDS = {"com.apple.Safari", "com.apple.SafariTechnologyPreview"}
CHROMIUM_IDS = {
    "com.google.Chrome",
    "com.brave.Browser",
    "company.thebrowser.Browser",  # Arc
    "com.microsoft.edgemac",
    "com.vivaldi.Vivaldi",
    "com.operasoftware.Opera",
}
_TAB_SCRIPT = (
    'tell application id "{bundle}" to if (count of windows) > 0 then '
    'return (URL of {tab} of front window) & " | " & (name of {tab} of front window)'
)
_warned_automation: set[str] = set()


def _run(cmd: list[str], timeout: float = 2.0) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def _front_app_macos() -> tuple[str, str]:
    """(display name, bundle id) of the frontmost app."""
    asn = _run(["lsappinfo", "front"]).stdout.strip()
    out = _run(["lsappinfo", "info", "-only", "bundleid", asn]).stdout
    bundle = re.search(r'bundleID="([^"]+)"', out)
    name_out = _run(["lsappinfo", "info", "-only", "name", asn]).stdout
    # Output is either `"LSDisplayName"="Zed"` or `"Zed" ASN:...` depending on the macOS version.
    name = re.search(r'"LSDisplayName"="([^"]*)"', name_out) or re.match(r'\s*"([^"]*)"', name_out)
    return (name.group(1) if name else ""), (bundle.group(1) if bundle else "")


def _active_title_macos() -> str:
    name, bundle = _front_app_macos()
    tab = "current tab" if bundle in SAFARI_IDS else "active tab" if bundle in CHROMIUM_IDS else None
    if tab is None:
        # Native apps: the app name is enough (e.g. "TikTok"). The X app is just called "X".
        return "x.com" if name == "X" else name
    res = _run(["osascript", "-e", _TAB_SCRIPT.format(bundle=bundle, tab=tab)])
    if res.returncode != 0 and bundle not in _warned_automation:
        _warned_automation.add(bundle)
        log.warning(
            "could not read the %s tab (%s). Allow your terminal to control %s under System Settings > "
            "Privacy & Security > Automation, then restart the server.",
            name,
            res.stderr.strip(),
            name,
        )
    return f"{name} | {res.stdout.strip()}"


def _active_title_windows() -> str:
    """Title of the window in front, straight from the Windows API (no extra library needed)."""
    import ctypes

    user32 = ctypes.windll.user32
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return ""
    n = user32.GetWindowTextLengthW(hwnd)
    buf = ctypes.create_unicode_buffer(n + 1)
    user32.GetWindowTextW(hwnd, buf, n + 1)
    return buf.value


def _get_title_fn() -> Any:
    if sys.platform == "darwin":
        return _active_title_macos
    if sys.platform == "win32":
        return _active_title_windows
    try:
        import pywinctl
    except Exception as exc:  # pragma: no cover - depends on the OS
        log.warning("pywinctl unavailable (%s); use POST /sessions to start sessions by hand", exc)
        return None
    return pywinctl.getActiveWindowTitle


def tick(title: str | None, now: float | None = None) -> None:
    """One detector step. Split out so it can be tested without a real window."""
    now = now if now is not None else time.time()
    platform = match_platform(title)
    with state.lock:
        state.last_title = title
        if state.manual:
            return
        if platform:
            if state.session_id and state.platform != platform:
                state.end(end=now)
            if not state.session_id:
                state.start(platform, start=now)
            state.last_seen = now
        elif state.session_id and now - state.last_seen >= GRACE_SECONDS:
            # end at the moment the platform was last on screen, not after the grace period
            state.end(end=state.last_seen)


def _loop(stop: threading.Event) -> None:
    get_title = _get_title_fn()
    if get_title is None:
        return
    state.detector_running = True
    warned_empty = False
    while not stop.is_set():
        try:
            title = get_title()
        except Exception as exc:  # never let the detector take the API down
            log.debug("active window read failed: %s", exc)
            title = None
        if not title and not warned_empty:
            log.warning(
                "active window title is empty. On Windows/Linux check pywinctl; on macOS check "
                "System Settings > Privacy & Security > Automation for your terminal."
            )
            warned_empty = True
        try:
            tick(title)
        except Exception:
            log.exception("detector tick failed")
        stop.wait(POLL_SECONDS)
    state.detector_running = False


_stop = threading.Event()
_thread: threading.Thread | None = None


def start_detector() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, args=(_stop,), name="social-detector", daemon=True)
    _thread.start()


def stop_detector() -> None:
    _stop.set()
    with state.lock:
        if state.session_id:
            state.end()

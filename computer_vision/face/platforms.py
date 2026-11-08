"""Which social media platform is on screen, from the title of the window in front.

Browser tabs and the Windows apps put the site name in the window title, for
example "Ryan Gosling edit - YouTube - Google Chrome", "(3) Facebook",
"TikTok - Make Your Day", "someone on X: ... / X". When several names appear
("Instagram tips - YouTube"), the one nearest the end wins, because that is
where browsers put the site name. Read locally; the title is never sent anywhere.

Platforms: instagram, tiktok, youtube, x, facebook, and "other" for other
social sites (Reddit, Threads, Snapchat, Pinterest, LinkedIn, Tumblr, Twitch).
"""
from __future__ import annotations

import ctypes
import re
import sys
import time
from typing import Optional

PLATFORMS = ["instagram", "tiktok", "youtube", "x", "facebook", "other"]

_PATTERNS = [
    ("youtube", r"\byoutube\b"),
    ("instagram", r"\binstagram\b"),
    ("facebook", r"\bfacebook\b|\bfb\.watch\b"),
    ("tiktok", r"\btik\s?tok\b"),
    ("x", r"\btwitter\b|\bx\.com\b|\bon x:|(?:^|\s)/ x(?=\s|$)|^x$"),
    ("other", r"\breddit\b|\bthreads\b|\bsnapchat\b|\bpinterest\b|\blinkedin\b|\btumblr\b|\btwitch\b"),
]
_REGEX = [(name, re.compile(p, re.I)) for name, p in _PATTERNS]

# Our own windows: never change the platform because of them.
_OWN = re.compile(r"face preview|face_monitor|label\.py|command prompt|cmd\.exe|powershell|windows terminal", re.I)


def detect_platform(title: Optional[str]) -> Optional[str]:
    """The platform named in a window title, or None if it names none."""
    if not title or _OWN.search(title):
        return None
    best, best_end = None, -1
    for name, rx in _REGEX:
        for m in rx.finditer(title):
            if m.end() > best_end:
                best, best_end = name, m.end()
    return best


def foreground_title() -> Optional[str]:
    if sys.platform != "win32":
        return None
    user32 = ctypes.windll.user32
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None
    n = user32.GetWindowTextLengthW(hwnd)
    buf = ctypes.create_unicode_buffer(n + 1)
    user32.GetWindowTextW(hwnd, buf, n + 1)
    return buf.value


class PlatformWatcher:
    """Remembers the last social platform seen in front (checks at most every 0.5 s)."""

    def __init__(self, start: str = "other", every_s: float = 0.5, title_source=None):
        self.current, self.every_s, self.title_source = start, every_s, title_source
        self._checked = 0.0

    def get(self) -> str:
        now = time.time()
        if now - self._checked >= self.every_s:
            self._checked = now
            try:
                found = detect_platform((self.title_source or foreground_title)())
            except Exception:  # noqa: BLE001
                found = None
            if found:
                self.current = found      # unknown windows keep the last platform seen
        return self.current

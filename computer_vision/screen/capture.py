"""G1: grab what is on screen, in memory only.

grab() captures the window in front (the browser or app the user is scrolling
in), not the whole desktop, so other windows and the taskbar never leave the
laptop. Our own camera preview is never sent: if it is the window in front the
grab is skipped, and if it overlaps the captured area it is blacked out.
The image is shrunk and JPEG-encoded in memory; nothing is written to disk.

Windows: the window list comes from the Windows API. macOS: from Quartz
(pip install pyobjc-framework-Quartz). On a Mac without Quartz nothing is
grabbed, because the camera preview could not be kept out of the picture.
"""
from __future__ import annotations

import ctypes
import math
import os
import sys
import time
from typing import List, NamedTuple, Optional, Tuple

import cv2
import numpy as np

PREVIEW_TITLE = "Face preview (nothing is saved) - press q to quit"  # face/face_monitor.py window

try:                       # shared with the face part (face/platforms.py)
    from platforms import detect_platform, is_own_window
except ImportError:
    import os as _os
    sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), "face"))
    from platforms import detect_platform, is_own_window

Rect = Tuple[int, int, int, int]  # left, top, right, bottom


class Shot(NamedTuple):
    jpeg: bytes          # what is sent for labelling
    width: int
    height: int
    t: float             # unix time of the grab
    source: str          # "window" or "screen" (never the window title)
    platform: Optional[str] = None   # from the window title, read locally; None if it names none


class SkipGrab(Exception):
    """Nothing should be captured right now (for example our own preview is in front)."""


_dpi_done = False


def _dpi_aware() -> None:
    """Make window coordinates match real pixels on scaled (125 %, 150 %) Windows displays."""
    global _dpi_done
    if _dpi_done or sys.platform != "win32":
        return
    _dpi_done = True
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:  # noqa: BLE001
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:  # noqa: BLE001
            pass


class _RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long), ("right", ctypes.c_long), ("bottom", ctypes.c_long)]


def _window_rect(hwnd) -> Optional[Rect]:
    r = _RECT()
    try:
        # Exact visible bounds (without the invisible resize border), Windows 10+
        if ctypes.windll.dwmapi.DwmGetWindowAttribute(hwnd, 9, ctypes.byref(r), ctypes.sizeof(r)) != 0:
            raise OSError
    except Exception:  # noqa: BLE001
        if not ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(r)):
            return None
    return r.left, r.top, r.right, r.bottom


def _mac_windows() -> List[Tuple[str, str, int, Rect]]:
    """macOS: ordinary app windows on screen, front to back, as (app, window name, process id, rect).

    Rects are in screen points, the same coordinates mss uses. Window names are empty until the
    terminal has Screen Recording permission (which mss needs anyway)."""
    import Quartz  # pip install pyobjc-framework-Quartz
    opts = Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements
    out = []
    for w in Quartz.CGWindowListCopyWindowInfo(opts, Quartz.kCGNullWindowID) or []:
        if int(w.get("kCGWindowLayer", 1)) != 0:   # 0 = app windows; the menu bar, Dock and pop-ups are above
            continue
        b = w.get("kCGWindowBounds") or {}
        x, y = int(b.get("X", 0)), int(b.get("Y", 0))
        rect = (x, y, x + int(b.get("Width", 0)), y + int(b.get("Height", 0)))
        if rect[2] - rect[0] >= 50 and rect[3] - rect[1] >= 50:
            out.append((str(w.get("kCGWindowOwnerName") or ""), str(w.get("kCGWindowName") or ""),
                        int(w.get("kCGWindowOwnerPID", -1)), rect))
    return out


def _mac_foreground(preview_title: str) -> Optional[Tuple[str, Rect]]:
    wins = _mac_windows()
    if not wins:
        return None
    app, name, pid, rect = wins[0]
    if pid == os.getpid():          # a window of this program: the camera preview
        return preview_title, rect
    return (f"{name} - {app}" if name else app), rect


def own_windows(preview_title: str = PREVIEW_TITLE) -> List[Rect]:
    """Where our camera preview is on screen, to black it out of every grab."""
    if sys.platform == "darwin":    # every window of this program, found by process id, even without names
        return [w[3] for w in _mac_windows() if w[2] == os.getpid()]
    rect = find_window(preview_title)
    return [rect] if rect else []


def foreground_window(preview_title: str = PREVIEW_TITLE) -> Optional[Tuple[str, Rect]]:
    """(title, rect) of the window in front, or None when it cannot be found."""
    if sys.platform == "darwin":
        return _mac_foreground(preview_title)
    if sys.platform != "win32":
        return None
    _dpi_aware()
    user32 = ctypes.windll.user32
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None
    n = user32.GetWindowTextLengthW(hwnd)
    buf = ctypes.create_unicode_buffer(n + 1)
    user32.GetWindowTextW(hwnd, buf, n + 1)
    rect = _window_rect(hwnd)
    return (buf.value, rect) if rect else None


def find_window(title: str) -> Optional[Rect]:
    if sys.platform != "win32":
        return None
    _dpi_aware()
    hwnd = ctypes.windll.user32.FindWindowW(None, title)
    if not hwnd or ctypes.windll.user32.IsIconic(hwnd):
        return None
    return _window_rect(hwnd)


def _clip(rect: Rect, bounds: Rect) -> Optional[Rect]:
    l, t, r, b = max(rect[0], bounds[0]), max(rect[1], bounds[1]), min(rect[2], bounds[2]), min(rect[3], bounds[3])
    return (l, t, r, b) if r - l >= 50 and b - t >= 50 else None


def black_out(img: np.ndarray, region: Rect, cover: Optional[Rect]) -> None:
    """Paint `cover` (screen coordinates) black inside `img`, which shows `region`."""
    if not cover:
        return
    l, t = max(cover[0], region[0]), max(cover[1], region[1])
    r, b = min(cover[2], region[2]), min(cover[3], region[3])
    if r > l and b > t:
        # 1 on Windows; 2 on a Retina Mac, where mss returns pixels but windows are measured in points
        sx = img.shape[1] / float(region[2] - region[0])
        sy = img.shape[0] / float(region[3] - region[1])
        img[int((t - region[1]) * sy):int(math.ceil((b - region[1]) * sy)),
            int((l - region[0]) * sx):int(math.ceil((r - region[0]) * sx))] = 0


def encode(img_bgr: np.ndarray, max_side: int = 1920, quality: int = 80) -> Tuple[bytes, int, int]:
    h, w = img_bgr.shape[:2]
    scale = min(1.0, max_side / float(max(h, w)))
    if scale < 1.0:
        img_bgr = cv2.resize(img_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise RuntimeError("could not encode the screenshot")
    return buf.tobytes(), img_bgr.shape[1], img_bgr.shape[0]


def grab(max_side: int = 1920, preview_title: str = PREVIEW_TITLE) -> Shot:
    """Capture the window in front (or the main screen), in memory."""
    import mss  # pip install mss
    t = time.time()
    try:
        fg = foreground_window(preview_title)
        covers = own_windows(preview_title)
    except ImportError:   # macOS without Quartz: we could not keep the camera preview out, so do not grab
        raise SkipGrab("on macOS, run setup_app.command (it installs pyobjc-framework-Quartz) "
                       "so the camera preview can be kept out of screenshots") from None
    if fg and fg[0] == preview_title:
        raise SkipGrab("the camera preview window is in front")
    if fg and is_own_window(fg[0]):
        raise SkipGrab("this app's own window is in front, not the social media one")
    with mss.mss() as sct:   # one mss object per call: they cannot be shared between threads
        desk = sct.monitors[0]
        bounds = (desk["left"], desk["top"], desk["left"] + desk["width"], desk["top"] + desk["height"])
        region, source = (_clip(fg[1], bounds), "window") if fg else (None, "screen")
        if region is None:   # not Windows, minimised, or tiny: use the main screen
            m = sct.monitors[1]
            region, source = (m["left"], m["top"], m["left"] + m["width"], m["top"] + m["height"]), "screen"
        raw = sct.grab({"left": region[0], "top": region[1],
                        "width": region[2] - region[0], "height": region[3] - region[1]})
        img = np.ascontiguousarray(np.asarray(raw)[:, :, :3])   # BGRA -> BGR
    for cover in covers:
        black_out(img, region, cover)
    jpeg, w, h = encode(img, max_side)
    del img, raw
    return Shot(jpeg, w, h, t, source, detect_platform(fg[0]) if fg else None)


def fake_shot(max_side: int = 1920) -> Shot:
    """A blank grey screenshot, for tests and fully fake runs."""
    jpeg, w, h = encode(np.full((360, 640, 3), 128, np.uint8))
    return Shot(jpeg, w, h, time.time(), "fake")

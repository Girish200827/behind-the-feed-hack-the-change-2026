"""BehindFeed engine: the Python half of the installed desktop app, as one executable.

    behindfeed-engine                 backend + camera/screen (what the installed app runs)
    behindfeed-engine --no-face       backend only (used by the CI smoke test)
    behindfeed-engine face [args...]  camera/screen only (started by the engine itself)

The Electron app starts it with BEHINDFEED_HOME set to its user-data folder, waits for
http://127.0.0.1:8000/status, and stops it on quit. From source it runs the same way:
    python engine/engine.py --home /tmp/bf

It does what launch.py does for the backend and the face monitor, without the dashboard.
"""

from __future__ import annotations

import argparse
import contextlib
import os
import signal
import subprocess
import sys
import threading
import time
import urllib.request

FROZEN = getattr(sys, "frozen", False)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Bundled files (models, key) live in sys._MEIPASS when frozen; next to the sources otherwise.
BUNDLE = getattr(sys, "_MEIPASS", ROOT)
HOST, PORT = "127.0.0.1", 8000

if (
    not FROZEN
):  # from source: make the three parts importable the same way PyInstaller does
    for sub in (
        "backend",
        os.path.join("computer_vision", "face"),
        os.path.join("computer_vision", "screen"),
        "computer_vision",
    ):
        path = os.path.join(ROOT, sub)
        if path not in sys.path:
            sys.path.insert(0, path)


def say(msg: str) -> None:
    print(f"[engine] {msg}", flush=True)


def default_home() -> str:
    if sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/BehindFeed")
    if os.name == "nt":
        return os.path.join(
            os.environ.get("APPDATA", os.path.expanduser("~")), "BehindFeed"
        )
    return os.path.expanduser("~/.behindfeed")


def load_gemini_key(home: str) -> bool:
    """Put the Gemini key into GEMINI_API_KEY. A key in the user's data folder wins over the bundled one."""
    if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        return True
    for path in (
        os.path.join(home, "gemini_key.txt"),
        os.path.join(BUNDLE, "gemini_key.txt"),
        os.path.join(BUNDLE, "screen", "gemini_key.txt"),
        os.path.join(ROOT, "computer_vision", "screen", "gemini_key.txt"),
    ):
        try:
            with open(path, encoding="utf-8") as f:
                key = f.read().strip()
        except OSError:
            continue
        if len(key) > 10:
            os.environ["GEMINI_API_KEY"] = key
            return True
    return False


def parent_alive(pid: int) -> bool:
    if os.name == "nt":
        import ctypes

        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        handle = kernel32.OpenProcess(0x00100000, False, pid)  # SYNCHRONIZE
        if not handle:
            return False
        try:
            return (
                kernel32.WaitForSingleObject(handle, 0) == 0x102
            )  # WAIT_TIMEOUT: still running
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def backend_up(timeout: float = 0.8) -> bool:
    try:
        with urllib.request.urlopen(f"http://{HOST}:{PORT}/status", timeout=timeout):
            return True
    except Exception:  # noqa: BLE001
        return False


def face_command(args: argparse.Namespace, screen: bool) -> list[str]:
    base = (
        [sys.executable, "face"]
        if FROZEN
        else [sys.executable, os.path.abspath(__file__), "face"]
    )
    cmd = base + ["--api", f"http://{HOST}:{PORT}", "--reuse-baseline", "--quiet"]
    if args.preview:
        cmd.append("--preview")
    if screen:
        cmd.append("--screen")
    return cmd


def stop_child(p: subprocess.Popen) -> None:
    """Ask the face monitor to stop like Ctrl+C (it then sends its last events), then force it."""
    if p.poll() is not None:
        return
    try:
        if os.name == "nt":
            p.send_signal(signal.CTRL_BREAK_EVENT)  # type: ignore[attr-defined]
        else:
            p.send_signal(signal.SIGINT)
        p.wait(6)
    except Exception:  # noqa: BLE001
        p.kill()


def run_all(args: argparse.Namespace) -> int:
    home = os.path.abspath(
        args.home or os.environ.get("BEHINDFEED_HOME") or default_home()
    )
    os.makedirs(home, exist_ok=True)
    os.environ["BEHINDFEED_HOME"] = home
    os.environ.setdefault("BEHINDFEED_DB", os.path.join(home, "behindfeed.db"))
    # mediapipe imports matplotlib; give it a writable cache so it doesn't rebuild fonts on every start
    os.environ.setdefault("MPLCONFIGDIR", os.path.join(home, "matplotlib"))
    say(f"data folder: {home}")

    if backend_up():
        say(f"a backend is already running on {HOST}:{PORT}; not starting another")
        return 0

    import uvicorn
    from app.main import app  # backend/app

    class Server(uvicorn.Server):
        # uvicorn re-raises SIGTERM/SIGINT after shutting down, which would kill us before the
        # camera child is stopped. Handle the signals here instead and just ask the server to exit.
        @contextlib.contextmanager
        def capture_signals(self):  # type: ignore[override]
            yield

    server = Server(
        uvicorn.Config(app, host=HOST, port=PORT, log_level="warning", access_log=False)
    )

    def request_exit(*_: object) -> None:
        server.should_exit = True

    for sig in ("SIGINT", "SIGTERM", "SIGBREAK"):
        if hasattr(signal, sig):
            signal.signal(getattr(signal, sig), request_exit)
    face: list[subprocess.Popen] = []

    def supervise() -> None:
        while not server.started and not server.should_exit:
            time.sleep(0.1)
        say(f"backend ready on http://{HOST}:{PORT}")
        if not args.no_face:
            screen = load_gemini_key(home)
            if not screen:
                say("no Gemini key found: running without screen labels")
            flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0  # type: ignore[attr-defined]
            face.append(
                subprocess.Popen(
                    face_command(args, screen), cwd=home, creationflags=flags
                )
            )
            say("camera: on only while a social media site is in front and not paused")
        while not server.should_exit:
            if args.parent_pid and not parent_alive(args.parent_pid):
                say("the app closed; stopping")
                server.should_exit = True
            time.sleep(1)

    threading.Thread(target=supervise, daemon=True).start()
    try:
        server.run()
    finally:
        for p in face:
            stop_child(p)
        say("stopped")
    return 0


def selftest() -> int:
    """Load every model and library the app needs, without a camera. Used by CI after the build."""
    import numpy as np
    from detector import FaceDetector
    from emotion_model import load_model
    from landmarks import ExpressionMeter

    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    FaceDetector().detect(frame)
    say("face detector: ok")
    pred = load_model("hsemotion", "enet_b0_8_va_mtl").predict(
        np.zeros((224, 224, 3), dtype=np.uint8)
    )
    say(f"emotion model: ok ({type(pred).__name__})")
    meter = ExpressionMeter()
    meter.measure(frame, 0.0)
    meter.close()
    say("face landmarker: ok")
    import google.genai  # noqa: F401
    from screen.label import ScreenLabeler  # noqa: F401

    say(
        f"screen labeller: ok (Gemini key {'bundled' if load_gemini_key(default_home()) else 'missing'})"
    )
    from app.main import app  # noqa: F401

    say("backend: ok")
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv[:1] == ["selftest"]:
        return selftest()
    if argv[:1] == ["face"]:
        import face_monitor

        try:
            face_monitor.main(argv[1:])
        except KeyboardInterrupt:
            pass
        return 0

    ap = argparse.ArgumentParser(
        description="BehindFeed engine: backend + camera/screen."
    )
    ap.add_argument(
        "--home",
        help="writable data folder (default: BEHINDFEED_HOME or the OS app-data folder)",
    )
    ap.add_argument("--no-face", action="store_true", help="backend only")
    ap.add_argument(
        "--preview", action="store_true", help="show the camera preview window"
    )
    ap.add_argument(
        "--parent-pid",
        type=int,
        help="stop when this process (the Electron app) is gone",
    )
    return run_all(ap.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())

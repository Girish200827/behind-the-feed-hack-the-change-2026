"""Behind the Feed: start the whole desktop app with one command.

    start_app.bat                  (Windows, double-click)
    start_app.command              (macOS, double-click)   or:  python launch.py
    python launch.py --no-preview  hide the camera window
    python launch.py --no-screen   no Gemini screen labels
    python launch.py --demo        no webcam: scripted moods into a demo Instagram session
    python launch.py --check       only check that everything is installed

It starts, in order, and shows their output here with a [name] prefix:
  1. backend    FastAPI on http://127.0.0.1:8000, data stored in backend/behindfeed.db (SQLite)
  2. face       computer_vision/face/face_monitor.py: camera on only while you scroll (and not paused),
                mood switches, Gemini screen labels; every event is stored by the backend
  3. dashboard  the Electron app (frontend, live data from the backend)
Closing the dashboard (on a Mac: Cmd+Q), or Ctrl+C here, stops all three.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.request
from typing import Callable, List, Optional

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
FACE = os.path.join(ROOT, "computer_vision", "face")
SCREEN = os.path.join(ROOT, "computer_vision", "screen")
FRONTEND = os.path.join(ROOT, "frontend")
NODE_MODULES = os.path.join(FRONTEND, "node_modules")
ELECTRON_VITE = os.path.join(NODE_MODULES, "electron-vite", "bin", "electron-vite.js")
SETUP_LOCK = os.path.join(ROOT, ".setup-running")   # setup_app.bat holds this folder while it runs
HOST, PORT = "127.0.0.1", 8000
API = f"http://{HOST}:{PORT}"
WINDOWS = os.name == "nt"
MAC = sys.platform == "darwin"
# Cheema's dashboard follows the Mac habit: closing its window does not quit it, Cmd+Q does.
CLOSE_HINT = "Quit the dashboard (Cmd+Q)" if MAC else "Close its window"


def say(msg: str) -> None:
    print(f"[launch] {msg}", flush=True)


# ---------------------------------------------------------------- checks
def gemini_key_present() -> bool:
    if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        return True
    path = os.path.join(SCREEN, "gemini_key.txt")
    return os.path.exists(path) and os.path.getsize(path) > 10


def electron_installed() -> bool:
    """Electron's own program is downloaded after npm unpacks the libraries; path.txt names it."""
    path_txt = os.path.join(NODE_MODULES, "electron", "path.txt")
    try:
        with open(path_txt, encoding="utf-8") as f:
            exe = f.read().strip()
    except OSError:
        return False
    return bool(exe) and os.path.exists(os.path.join(NODE_MODULES, "electron", "dist", exe))


def dashboard_problem() -> Optional[str]:
    if not shutil.which("node"):
        return "Node.js is not installed: install the LTS version from https://nodejs.org, then run setup_app.bat."
    if not os.path.isdir(NODE_MODULES):
        return "The dashboard's libraries are not installed: run setup_app.bat."
    if not os.path.exists(ELECTRON_VITE) or not electron_installed():
        return ("The dashboard's libraries are only half installed (an install was stopped, or two ran at once). "
                "Close every other setup window, then run setup_app.bat again: it removes the broken install by itself.")
    return None


def check(args) -> List[str]:
    """Problems that stop the app from starting, in plain words."""
    problems = []
    missing = []
    for mod in ("fastapi", "uvicorn", "cv2", "onnxruntime"):
        try:
            __import__(mod)
        except Exception:  # noqa: BLE001
            missing.append(mod)
    if missing:
        problems.append(f"Python libraries missing ({', '.join(missing)}): run setup_app.bat.")
    if not args.no_dashboard:
        problem = dashboard_problem()
        if problem:
            problems.append(problem)
    if not args.demo and not args.no_screen and not gemini_key_present():
        say("No Gemini key found (computer_vision/screen/gemini_key.txt): starting without screen labels.")
        args.no_screen = True
    return problems


# ---------------------------------------------------------------- processes
class Child:
    def __init__(self, name: str, cmd: List[str], cwd: str, env: Optional[dict] = None,
                 hide: Optional[Callable[[str], bool]] = None, graceful: bool = True):
        self.name = name
        self.graceful = graceful    # False: nothing to save, stop the whole process tree at once
        self.started = time.time()
        # Each child gets its own process group, so Ctrl+C reaches only this launcher, which then stops
        # the children in order; and a child's own children (Electron under electron-vite) stop with it.
        flags = subprocess.CREATE_NEW_PROCESS_GROUP if WINDOWS else 0
        self.p = subprocess.Popen(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                  stdin=subprocess.DEVNULL, text=True, encoding="utf-8", errors="replace",
                                  bufsize=1, creationflags=flags, start_new_session=not WINDOWS)
        self.tail: List[str] = []
        threading.Thread(target=self._pump, args=(hide,), daemon=True).start()

    def _pump(self, hide) -> None:
        for line in self.p.stdout:
            line = line.rstrip()
            self.tail = (self.tail + [line])[-15:]
            if line and not (hide and hide(line)):
                print(line if line.startswith("[") else f"[{self.name}] {line}", flush=True)

    def alive(self) -> bool:
        return self.p.poll() is None

    def stop(self, grace_s: float = 6.0) -> None:
        if not self.alive():
            return
        if not WINDOWS:
            self._stop_group(grace_s)
            return
        if self.graceful:
            try:   # ask nicely first, so the face monitor can send its last events
                self.p.send_signal(signal.CTRL_BREAK_EVENT)
                self.p.wait(grace_s)
                return
            except Exception:  # noqa: BLE001
                pass
        # electron-vite starts Electron underneath: stop the whole tree
        subprocess.run(["taskkill", "/PID", str(self.p.pid), "/T", "/F"], capture_output=True)

    def _stop_group(self, grace_s: float) -> None:
        """macOS and Linux: signal the child's whole process group (Ctrl+C first if graceful)."""
        steps = [(signal.SIGINT, grace_s)] if self.graceful else []
        for sig, wait_s in steps + [(signal.SIGTERM, 3.0), (signal.SIGKILL, 2.0)]:
            try:
                os.killpg(self.p.pid, sig)
            except (ProcessLookupError, PermissionError):
                return
            try:
                self.p.wait(wait_s)
                return
            except subprocess.TimeoutExpired:
                continue


def api(method: str, path: str, body: Optional[dict] = None, timeout: float = 2.0):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "null")


def wait_for_backend(child: Child, timeout_s: float = 40.0) -> bool:
    end = time.time() + timeout_s
    while time.time() < end:
        if not child.alive():
            return False
        try:
            api("GET", "/status", timeout=1.0)
            return True
        except Exception:  # noqa: BLE001
            time.sleep(0.4)
    return False


def backend_already_running() -> bool:
    try:
        api("GET", "/status", timeout=0.8)
        return True
    except Exception:  # noqa: BLE001
        return False


# ---------------------------------------------------------------- main
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Start Behind the Feed: backend, camera + screen, dashboard.")
    ap.add_argument("--no-preview", action="store_true", help="hide the camera window")
    ap.add_argument("--no-screen", action="store_true", help="no Gemini screen labels")
    ap.add_argument("--demo", action="store_true", help="no webcam: scripted moods into a demo Instagram session")
    ap.add_argument("--no-dashboard", action="store_true", help="backend and camera only")
    ap.add_argument("--check", action="store_true", help="only check the installation")
    args = ap.parse_args(argv)

    if not args.check and os.path.isdir(SETUP_LOCK):
        say("PROBLEM: setup_app.bat is still running in another window (or was closed before it finished).")
        say("Wait until that window says \"Setup finished\", or run setup_app.bat again, then start the app.")
        return 1
    problems = check(args)
    if args.check or problems:
        for p in problems:
            say("PROBLEM: " + p)
        if not problems:
            say("Everything needed is installed.")
        return 1 if problems else 0

    py = sys.executable
    children: List[Child] = []
    demo_session = None
    try:
        # 1. backend
        if backend_already_running():
            say(f"A backend is already running at {API}; using it.")
        else:
            say(f"Starting the backend at {API} ...")
            backend = Child("backend", [py, "-m", "uvicorn", "app.main:app", "--host", HOST, "--port", str(PORT),
                                        "--no-access-log"], BACKEND)
            children.append(backend)
            if not wait_for_backend(backend):
                say("The backend did not start. Its last lines:")
                for line in backend.tail:
                    print("    " + line)
                return 1
            say("Backend ready. Data is stored in backend/behindfeed.db.")

        # 2. face + screen
        face_cmd = [py, "-u", "face_monitor.py", "--api", API, "--reuse-baseline"]
        if not args.no_preview and not args.demo:
            face_cmd.append("--preview")
        if not args.no_screen:
            face_cmd.append("--screen")
        if args.demo:
            demo_session = api("POST", "/sessions", {"platform": "instagram"})["id"]
            face_cmd += ["--fake", "--fake-loops", "50"]
            if not args.no_screen:
                face_cmd += ["--screen-backend", "fake"]
            say(f"Demo mode: scripted moods into session {demo_session} (no webcam, canned screen labels).")
        children.append(Child("face", face_cmd, FACE, hide=lambda line: line.startswith("emotion_sample")))
        say("Camera: on only while Instagram, TikTok, YouTube, X or Facebook is in front, and not paused.")

        # 3. dashboard
        app = None
        if not args.no_dashboard:
            # Same as `npm run dev:api`, without needing npm's helper commands (cross-env):
            # the data source is set here, and electron-vite is run by Node.js directly.
            env = dict(os.environ, VITE_DATA_SOURCE="api", VITE_API_URL=API)
            env.pop("ELECTRON_RUN_AS_NODE", None)   # set by VS Code terminals; it breaks Electron
            app = Child("app", [shutil.which("node") or "node", ELECTRON_VITE, "dev"], FRONTEND, env=env,
                        graceful=False)
            children.append(app)
            say("Opening the dashboard (the first start takes about 10 seconds). "
                f"{CLOSE_HINT} (or press Ctrl+C here) to stop everything.")

        while True:
            time.sleep(0.5)
            if app is not None and not app.alive():
                if app.p.returncode not in (0, None) and time.time() - app.started < 30:
                    say("The dashboard could not start. Its last lines:")
                    for line in app.tail[-10:]:
                        print("    " + line)
                    say("If they mention a missing module or Electron, close this window and run setup_app.bat again.")
                else:
                    say("Dashboard closed.")
                break
            if children and children[0].name == "backend" and not children[0].alive():
                say("The backend stopped unexpectedly.")
                break
            face = next((c for c in children if c.name == "face"), None)
            if face is not None and not face.alive() and not getattr(face, "_reported", False):
                face._reported = True
                say("The camera process stopped. Its last lines:")
                for line in face.tail[-8:]:
                    print("    " + line)
                if app is None:
                    break
    except KeyboardInterrupt:
        say("Stopping ...")
    finally:
        for c in reversed(children):          # dashboard, then camera (sends its last events), then backend
            if c.name != "backend":
                c.stop()
        if demo_session:
            try:
                api("PATCH", f"/sessions/{demo_session}", {})
            except Exception:  # noqa: BLE001
                pass
        for c in children:
            if c.name == "backend":
                c.stop()
        say("Stopped. Your data stays in backend/behindfeed.db.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

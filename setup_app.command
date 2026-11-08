#!/bin/bash
# Behind the Feed: one-time setup on macOS. Double-click it in Finder, or run:  bash setup_app.command
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"   # Homebrew and the python.org / nodejs.org installers
export PYTHONDONTWRITEBYTECODE=1
VENV="$HOME/venvs/face"
PY="$VENV/bin/python"
LOCK=".setup-running"

finish() { rmdir "$LOCK" 2>/dev/null; }
fail() {
  echo
  echo "==== Setup stopped: $1 ===="
  echo "Copy the text above and paste it to Claude."
  finish
  read -r -p "Press Enter to close. " _
  exit 1
}

echo "==== Behind the Feed: one-time setup (macOS) ===="
# Only one setup at a time: two npm installs in the same folder break each other.
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "Another setup window seems to be running already. Two at once break the install."
  read -r -p "If you closed an earlier setup before it finished, type y to continue: " ans
  case "$ans" in y|Y) ;; *) exit 1 ;; esac
fi
echo "This installs everything for the backend, the camera and the dashboard."
echo "The first time it downloads about 500 MB, so it can take 5 to 15 minutes."
echo "Keep this window open until it says \"Setup finished\"."
echo

# ---- 1. Python 3.10 to 3.13 (truststore needs 3.10+; MediaPipe has no wheels for newer ones yet)
pick_python() {
  for c in python3.12 python3.11 python3.13 python3.10 python3; do
    if command -v "$c" >/dev/null 2>&1 &&
       "$c" -c 'import sys; sys.exit(not ((3, 10) <= sys.version_info[:2] <= (3, 13)))' 2>/dev/null; then
      echo "$c"
      return 0
    fi
  done
  return 1
}
if [ ! -x "$PY" ]; then
  BASE=$(pick_python) || fail "Python 3.12 was not found. Install it from https://www.python.org/downloads/ (or: brew install python@3.12), then run this again"
  echo "[1/6] Creating the Python environment in $VENV with $BASE"
  "$BASE" -m venv "$VENV" || fail "could not create the Python environment"
fi
echo "[1/6] Python environment: $VENV"
"$PY" --version

echo
echo "[2/6] Backend libraries"
"$PY" -m pip install --upgrade pip --quiet
"$PY" -m pip install -r backend/requirements.txt || fail "backend libraries"

echo
echo "[3/6] Camera and screen libraries"
"$PY" -m pip install -r computer_vision/face/requirements.txt || fail "camera libraries"
# --no-deps keeps MediaPipe from installing a second, clashing copy of OpenCV.
"$PY" -m pip install --no-deps mediapipe
"$PY" -m pip install "absl-py>=2.3,<3" "flatbuffers>=25.9,<26" matplotlib
"$PY" -m pip install -r computer_vision/screen/requirements.txt || fail "screen libraries"

echo
echo "[4/6] Models"
( cd computer_vision/face &&
  "$PY" -c "from emotion_model import model_path; model_path('enet_b0_8_va_mtl'); print('Emotion model ready')" &&
  "$PY" -c "from landmarks import landmarker_path; landmarker_path(); print('Face landmarker ready')" ) || fail "model download"

echo
echo "[5/6] Gemini key for screen labels"
if [ -f computer_vision/screen/gemini_key.txt ] || [ -n "$GEMINI_API_KEY" ]; then
  echo "Key found."
else
  echo "No key yet. Get a free one at https://aistudio.google.com/apikey and paste it here,"
  read -r -p "or just press Enter to skip screen labels for now: " KEY
  if [ -n "$KEY" ]; then
    printf '%s\n' "$KEY" > computer_vision/screen/gemini_key.txt
    echo "Saved to computer_vision/screen/gemini_key.txt, which Git ignores."
  else
    echo "Skipped. The app runs without screen labels until you add a key."
  fi
fi

echo
echo "[6/6] Dashboard libraries: Electron and React"
command -v npm >/dev/null 2>&1 || fail "Node.js was not found. Install the LTS version from https://nodejs.org (or: brew install node), then run this again"
cd frontend || fail "the frontend folder is missing"
# npm writes node_modules/.package-lock.json only when an install finishes.
if [ -f node_modules/.package-lock.json ] && [ -f node_modules/electron/path.txt ]; then
  echo "Already installed; checking for updates..."
  npm install --no-audit --no-fund || { cd ..; fail "the dashboard install failed. Close other setup windows and the launcher, then run this again"; }
else
  [ -d node_modules ] && echo "An earlier install did not finish. Removing it and installing again..."
  # npm ci removes node_modules first and installs exactly what package-lock.json lists.
  npm ci --no-audit --no-fund || { echo "npm ci did not work. Trying npm install instead..."; npm install --no-audit --no-fund; } ||
    { cd ..; fail "the dashboard install failed. Close other setup windows and the launcher, then run this again"; }
fi
if [ ! -f node_modules/electron/path.txt ]; then
  echo "Downloading the Electron program (about 120 MB)..."
  node node_modules/electron/install.js
fi
[ -f node_modules/electron/path.txt ] || { cd ..; fail "the Electron program did not download. Check the internet connection and run this again"; }
cd ..

echo
echo "Checking the installation..."
"$PY" launch.py --check || fail "the installation check found a problem (see above)"
finish
echo
echo "==== Setup finished. Now double-click start_app.command ===="
echo "The first start, macOS asks to let Terminal use the camera, record the screen (for screen"
echo "labels) and control your browser (to see which site is open). Allow all three; after allowing"
echo "screen recording, quit Terminal (Cmd+Q) and start again."
read -r -p "Press Enter to close. " _

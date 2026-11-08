#!/bin/bash
# Behind the Feed on macOS: backend + camera + dashboard. Double-click it in Finder, or run:  bash start_app.command
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export PYTHONDONTWRITEBYTECODE=1
unset ELECTRON_RUN_AS_NODE
PY="$HOME/venvs/face/bin/python"
if [ ! -x "$PY" ]; then
  echo "Run setup_app.command first."
  read -r -p "Press Enter to close. " _
  exit 1
fi
echo "==== Behind the Feed ===="
echo "Starting the backend, the camera and the dashboard. Quit the dashboard (Cmd+Q) to stop everything."
echo
"$PY" launch.py "$@"
echo
read -r -p "Press Enter to close. " _

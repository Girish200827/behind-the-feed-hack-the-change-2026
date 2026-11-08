#!/bin/bash
# Start the Behind the Feed backend: ./run.sh   (from anywhere)
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
exec .venv/bin/uvicorn app.main:app --port 8000 "$@"

"""Print a short summary of events.jsonl: how many of each event, and the mood switches."""
import json
import os
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "events.jsonl"
if not os.path.exists(path):
    print("No events.jsonl yet.")
    sys.exit(0)

counts = {"emotion_sample": 0, "mood_switch": 0, "context_label": 0}
switches = []
with open(path, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if "from" in d:
            counts["mood_switch"] += 1
            switches.append(d)
        elif "switch_id" in d:
            counts["context_label"] += 1
        elif "emotion" in d:
            counts["emotion_sample"] += 1

print("Events in", path + ":", ", ".join(f"{v} {k}" for k, v in counts.items()))
for s in switches[-10:]:
    print(f"  {s['id']}: {s['from']} -> {s['to']} ({s['platform']})")
if len(switches) > 10:
    print(f"  ...and {len(switches) - 10} earlier switches")

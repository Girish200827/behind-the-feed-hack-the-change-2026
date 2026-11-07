"""A1 - write a realistic fake 20-minute scroll session in the contract formats.

python scripts/fake_session.py                 # writes fake_session.json (same shape as /sessions/{id}/timeline)
python scripts/fake_session.py --post          # also sends it to the running API
python scripts/fake_session.py --minutes 5 --platform tiktok --seed 7 --post
"""

from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path
from typing import Any

VALENCE = {"happy": 0.7, "surprise": 0.3, "neutral": 0.0, "sad": -0.6, "angry": -0.7, "fear": -0.5, "disgust": -0.6}

# (category, tone, topics, likely moods afterwards)
CONTENT = [
    ("news", "negative", ["layoff headlines", "wildfire update", "housing prices"], ["sad", "fear", "angry"]),
    ("politics", "negative", ["election debate clip", "policy argument thread"], ["angry", "disgust", "sad"]),
    ("comedy", "positive", ["cat skit", "stand-up clip", "meme compilation"], ["happy", "surprise"]),
    ("friends", "positive", ["friend's trip photos", "birthday post"], ["happy", "neutral"]),
    ("fitness", "neutral", ["gym transformation reel", "home workout"], ["neutral", "sad", "happy"]),
    ("food", "positive", ["ramen recipe", "street food tour"], ["happy", "neutral"]),
    ("drama", "negative", ["influencer feud", "breakup storytime"], ["surprise", "disgust", "sad"]),
    ("ads", "neutral", ["sneaker ad", "meal kit promo"], ["neutral"]),
]


def generate(
    minutes: int = 20, platform: str = "instagram", start: float | None = None, seed: int = 42
) -> dict[str, Any]:
    rng = random.Random(seed)
    start = float(int(start if start is not None else time.time() - minutes * 60 - 60))
    end = start + minutes * 60
    sid = f"s_fake_{seed}"

    emotions: list[dict[str, Any]] = []
    switches: list[dict[str, Any]] = []
    labels: list[dict[str, Any]] = []
    mood = "neutral"
    valence = 0.0
    next_switch = start + rng.uniform(40, 80)
    n = 0
    ts = start
    while ts < end:
        if ts >= next_switch and ts < end - 10:
            category, tone, topics, outcomes = rng.choice(CONTENT)
            new_mood = rng.choice([m for m in outcomes if m != mood] or ["neutral"])
            n += 1
            sw_id = f"sw_{seed}_{n:04d}"
            # Raad emits the switch once the new mood has held ~2 s.
            switches.append({"id": sw_id, "ts": round(ts, 1), "from": mood, "to": new_mood, "platform": platform})
            labels.append(
                {
                    "switch_id": sw_id,
                    "ts": round(ts + rng.uniform(0.3, 1.5), 1),
                    "platform": platform,
                    "category": category,
                    "tone": tone,
                    "topic": rng.choice(topics),
                }
            )
            mood = new_mood
            next_switch = ts + rng.uniform(55, 100)
        # valence drifts toward the current mood with noise
        valence += (VALENCE[mood] - valence) * 0.15 + rng.gauss(0, 0.05)
        valence = max(-1.0, min(1.0, valence))
        emotions.append(
            {
                "ts": round(ts + rng.uniform(0, 0.2), 1),
                "emotion": mood if rng.random() > 0.08 else "neutral",
                "valence": round(valence, 2),
                "confidence": round(rng.uniform(0.55, 0.95), 2),
            }
        )
        ts += 1.0

    return {
        "session": {"id": sid, "platform": platform, "start": start, "end": end},
        "emotions": emotions,
        "switches": switches,
        "labels": labels,
    }


def post(data: dict[str, Any], base: str) -> None:
    import httpx

    s = data["session"]
    with httpx.Client(base_url=base, timeout=10) as c:
        created = c.post("/sessions", json={"platform": s["platform"], "start": s["start"]})
        created.raise_for_status()
        real_id = created.json()["id"]
        events = sorted(data["emotions"] + data["switches"] + data["labels"], key=lambda e: e["ts"])
        for e in events:
            r = c.post("/events", json=e)
            if r.status_code != 200:
                raise SystemExit(f"event rejected ({r.status_code}): {e}\n{r.text}")
        c.patch(f"/sessions/{real_id}", json={"end": s["end"]}).raise_for_status()
    print(f"posted {len(events)} events into session {real_id} at {base}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--minutes", type=int, default=20)
    ap.add_argument("--platform", default="instagram", choices=["instagram", "tiktok", "youtube", "x", "facebook"])
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "fake_session.json"))
    ap.add_argument("--post", action="store_true", help="also send the events to the running API")
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    args = ap.parse_args()

    data = generate(args.minutes, args.platform, seed=args.seed)
    Path(args.out).write_text(json.dumps(data, indent=1))
    print(
        f"wrote {args.out}: {len(data['emotions'])} emotion_samples, "
        f"{len(data['switches'])} mood_switches, {len(data['labels'])} context_labels"
    )
    if args.post:
        post(data, args.api)


if __name__ == "__main__":
    main()

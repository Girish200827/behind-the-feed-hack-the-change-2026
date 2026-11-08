"""A5 - turn stored events into findings and one weekly goal."""

from __future__ import annotations

import time
from typing import Any

from . import db
from .models import NEGATIVE_EMOTIONS

WINDOW_SECONDS = 60  # "before" = first minute of a session, "after" = last minute
MIN_SWITCHES_FOR_GOAL = 2


def trigger_scores() -> list[dict[str, Any]]:
    """Per content category: share of mood switches that turned negative."""
    neg = ",".join(f"'{e}'" for e in sorted(NEGATIVE_EMOTIONS))
    rows = db.query(
        f"""
        SELECT l.category,
               COUNT(*) AS switches,
               SUM(CASE WHEN s.to_emotion IN ({neg}) THEN 1 ELSE 0 END) AS negative
        FROM context_labels l
        JOIN mood_switches s ON s.id = l.switch_id
        GROUP BY l.category
        """
    )
    for r in rows:
        r["trigger_score"] = round(r["negative"] / r["switches"], 3) if r["switches"] else 0.0
    rows.sort(key=lambda r: (r["trigger_score"], r["switches"]), reverse=True)
    return rows


def _mean_valence(session_id: str, lo: float, hi: float) -> float | None:
    r = db.query(
        "SELECT AVG(valence) AS v FROM emotion_samples WHERE session_id = ? AND ts >= ? AND ts <= ?",
        (session_id, lo, hi),
    )[0]
    return round(r["v"], 3) if r["v"] is not None else None


def session_moods() -> list[dict[str, Any]]:
    """Mean valence in the first and last minute of each finished session."""
    out: list[dict[str, Any]] = []
    for s in db.list_sessions():
        if s["end"] is None:
            continue
        before = _mean_valence(s["id"], s["start"], s["start"] + WINDOW_SECONDS)
        after = _mean_valence(s["id"], s["end"] - WINDOW_SECONDS, s["end"])
        out.append(
            {
                "session_id": s["id"],
                "platform": s["platform"],
                "minutes": round((s["end"] - s["start"]) / 60, 1),
                "valence_before": before,
                "valence_after": after,
                "change": round(after - before, 3) if before is not None and after is not None else None,
            }
        )
    return out


def platform_mix() -> list[dict[str, Any]]:
    now = time.time()
    rows = db.query(
        'SELECT platform, COUNT(*) AS sessions, SUM(COALESCE("end", ?) - start) AS seconds '
        "FROM sessions GROUP BY platform ORDER BY seconds DESC",
        (now,),
    )
    for r in rows:
        r["minutes"] = round((r.pop("seconds") or 0) / 60, 1)
    return rows


def longest_session() -> dict[str, Any] | None:
    now = time.time()
    rows = db.query(
        'SELECT id, platform, start, "end", (COALESCE("end", ?) - start) AS seconds '
        "FROM sessions ORDER BY seconds DESC LIMIT 1",
        (now,),
    )
    if not rows:
        return None
    r = rows[0]
    r["minutes"] = round(r.pop("seconds") / 60, 1)
    return r


def insights() -> dict[str, Any]:
    moods = session_moods()
    changes = [m["change"] for m in moods if m["change"] is not None]
    return {
        "triggers": trigger_scores(),
        "sessions": moods,
        "avg_mood_change": round(sum(changes) / len(changes), 3) if changes else None,
        "platform_mix": platform_mix(),
        "longest_session": longest_session(),
    }


def goal() -> dict[str, Any]:
    """Pick one plain weekly goal from the top trigger. Template text; Giresh (G4) may reword it."""
    triggers = [t for t in trigger_scores() if t["switches"] >= MIN_SWITCHES_FOR_GOAL and t["negative"] > 0]
    if triggers:
        top = triggers[0]
        pct = round(top["trigger_score"] * 100)
        cat = top["category"]
        return {
            "category": cat,
            "trigger_score": top["trigger_score"],
            "text": f"Your mood dipped after {pct}% of the {cat} posts you saw. "
            f"This week, try capping {cat} content to 10 minutes a day.",
        }
    longest = longest_session()
    if longest and longest["minutes"] >= 20:
        return {
            "category": None,
            "trigger_score": None,
            "text": f"Your longest scroll was {longest['minutes']:.0f} minutes on {longest['platform']}. "
            "This week, try stopping each session at 15 minutes.",
        }
    return {
        "category": None,
        "trigger_score": None,
        "text": "Not enough data yet. Scroll as you normally would and check back after a few sessions.",
    }

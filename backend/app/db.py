"""SQLite storage: one table per contract format. Only text and numbers are stored, never images."""

from __future__ import annotations

import os
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

DB_PATH = Path(os.environ.get("BEHINDFEED_DB", Path(__file__).resolve().parent.parent / "behindfeed.db"))

_lock = threading.RLock()
_conn: sqlite3.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id        TEXT PRIMARY KEY,
    platform  TEXT NOT NULL,
    start     REAL NOT NULL,
    "end"     REAL
);
CREATE TABLE IF NOT EXISTS emotion_samples (
    session_id TEXT,
    ts         REAL NOT NULL,
    emotion    TEXT NOT NULL,
    valence    REAL NOT NULL,
    confidence REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS mood_switches (
    id           TEXT PRIMARY KEY,
    session_id   TEXT,
    ts           REAL NOT NULL,
    from_emotion TEXT NOT NULL,
    to_emotion   TEXT NOT NULL,
    platform     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS context_labels (
    switch_id  TEXT PRIMARY KEY,
    session_id TEXT,
    ts         REAL NOT NULL,
    platform   TEXT NOT NULL,
    category   TEXT NOT NULL,
    tone       TEXT NOT NULL,
    topic      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_emotion_session ON emotion_samples(session_id, ts);
CREATE INDEX IF NOT EXISTS ix_switch_session ON mood_switches(session_id, ts);
CREATE INDEX IF NOT EXISTS ix_label_session ON context_labels(session_id, ts);
"""


def conn() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            _conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, isolation_level=None)
            _conn.row_factory = sqlite3.Row
            _conn.execute("PRAGMA journal_mode=WAL")
            _conn.executescript(SCHEMA)
        return _conn


def execute(sql: str, params: tuple[Any, ...] = ()) -> sqlite3.Cursor:
    with _lock:
        return conn().execute(sql, params)


def query(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with _lock:
        return [dict(r) for r in conn().execute(sql, params).fetchall()]


# ---------- sessions ----------


def _next_session_id() -> str:
    row = query("SELECT COUNT(*) AS n FROM sessions")[0]
    n = row["n"] + 1
    while query("SELECT 1 FROM sessions WHERE id = ?", (f"s_{n:03d}",)):
        n += 1
    return f"s_{n:03d}"


def start_session(platform: str, start: float | None = None, session_id: str | None = None) -> dict[str, Any]:
    with _lock:
        sid = session_id or _next_session_id()
        start = start if start is not None else time.time()
        execute('INSERT INTO sessions (id, platform, start, "end") VALUES (?, ?, ?, NULL)', (sid, platform, start))
        return {"id": sid, "platform": platform, "start": start, "end": None}


def end_session(session_id: str, end: float | None = None) -> dict[str, Any] | None:
    end = end if end is not None else time.time()
    execute('UPDATE sessions SET "end" = ? WHERE id = ? AND "end" IS NULL', (end, session_id))
    return get_session(session_id)


def end_open_sessions() -> None:
    """Close sessions left open by a previous run (e.g. the server was killed) at their last event."""
    execute(
        'UPDATE sessions SET "end" = COALESCE('
        "(SELECT MAX(ts) FROM emotion_samples WHERE session_id = sessions.id), start) "
        'WHERE "end" IS NULL'
    )


def get_session(session_id: str) -> dict[str, Any] | None:
    rows = query('SELECT id, platform, start, "end" FROM sessions WHERE id = ?', (session_id,))
    return rows[0] if rows else None


def list_sessions() -> list[dict[str, Any]]:
    return query('SELECT id, platform, start, "end" FROM sessions ORDER BY start DESC')


def session_for_ts(ts: float) -> str | None:
    """Find the session whose time window contains ts (open sessions count as running until now)."""
    rows = query(
        'SELECT id FROM sessions WHERE start <= ? AND (COALESCE("end", ?) + 5) >= ? ORDER BY start DESC LIMIT 1',
        (ts, time.time(), ts),
    )
    return rows[0]["id"] if rows else None


# ---------- events ----------


def insert_emotion(e: dict[str, Any], session_id: str | None) -> None:
    execute(
        "INSERT INTO emotion_samples (session_id, ts, emotion, valence, confidence) VALUES (?, ?, ?, ?, ?)",
        (session_id, e["ts"], e["emotion"], e["valence"], e["confidence"]),
    )


def insert_switch(e: dict[str, Any], session_id: str | None) -> None:
    execute(
        "INSERT OR REPLACE INTO mood_switches (id, session_id, ts, from_emotion, to_emotion, platform) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (e["id"], session_id, e["ts"], e["from"], e["to"], e["platform"]),
    )


def insert_label(e: dict[str, Any], session_id: str | None) -> None:
    execute(
        "INSERT OR REPLACE INTO context_labels (switch_id, session_id, ts, platform, category, tone, topic) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (e["switch_id"], session_id, e["ts"], e["platform"], e["category"], e["tone"], e["topic"]),
    )


def timeline(session_id: str) -> dict[str, Any] | None:
    s = get_session(session_id)
    if not s:
        return None
    emotions = query(
        "SELECT ts, emotion, valence, confidence FROM emotion_samples WHERE session_id = ? ORDER BY ts",
        (session_id,),
    )
    switches = query(
        'SELECT id, ts, from_emotion AS "from", to_emotion AS "to", platform FROM mood_switches '
        "WHERE session_id = ? ORDER BY ts",
        (session_id,),
    )
    labels = query(
        "SELECT switch_id, ts, platform, category, tone, topic FROM context_labels WHERE session_id = ? ORDER BY ts",
        (session_id,),
    )
    return {"session": s, "emotions": emotions, "switches": switches, "labels": labels}

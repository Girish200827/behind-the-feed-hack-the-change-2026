"""Behind the Feed - local backend.

Runs on the user's laptop. It receives text-only events (no images, no video), knows when
social media is open, and serves sessions, timelines, insights and a goal to the dashboard.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from . import db, detector, insights
from .models import EmotionSample, Event, MoodSwitch, Session, SessionEnd, SessionStart, Timeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.conn()
    db.end_open_sessions()
    if os.environ.get("BEHINDFEED_DETECTOR", "1") != "0":
        detector.start_detector()
    yield
    detector.stop_detector()


app = FastAPI(
    title="Behind the Feed - local API",
    description="Event intake, scroll-session detection and insights. Stores text only - never images.",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


# ---------- L3: is the user scrolling? (Raad polls this to switch the camera) ----------


@app.get("/status", tags=["detector"])
def status():
    """`scrolling: true` means a social platform is in front: camera may run. Otherwise it must be off."""
    return detector.state.snapshot()


# ---------- A2 / L2: event intake ----------

EVENT_EXAMPLES = [
    {"ts": 1794083400.5, "emotion": "sad", "valence": -0.6, "confidence": 0.81},
    {"id": "sw_0142", "ts": 1794083412.0, "from": "neutral", "to": "sad", "platform": "instagram"},
    {
        "switch_id": "sw_0142",
        "ts": 1794083412.4,
        "platform": "instagram",
        "category": "news",
        "tone": "negative",
        "topic": "layoff headlines",
    },
]


@app.post("/events", tags=["events"])
def post_event(event: Annotated[Event, Body(examples=EVENT_EXAMPLES)]):
    """Accepts any of emotion_sample, mood_switch or context_label (told apart by their fields)."""
    session_id: str | None = db.session_for_ts(event.ts) or detector.state.session_id
    data = event.model_dump(by_alias=True)
    if isinstance(event, EmotionSample):
        kind = "emotion_sample"
        db.insert_emotion(data, session_id)
    elif isinstance(event, MoodSwitch):
        kind = "mood_switch"
        db.insert_switch(data, session_id)
    else:
        kind = "context_label"
        if session_id is None:  # fall back to the session of the switch it labels
            rows = db.query("SELECT session_id FROM mood_switches WHERE id = ?", (event.switch_id,))
            session_id = rows[0]["session_id"] if rows else None
        db.insert_label(data, session_id)
    return {"ok": True, "kind": kind, "session_id": session_id}


# ---------- A3 manual fallback / A4 dashboard ----------


@app.post("/sessions", response_model=Session, tags=["sessions"])
def start_session(body: SessionStart):
    """Start a session by hand (testing, or demo fallback if window detection fails)."""
    return detector.state.start(body.platform, manual=True, start=body.start)


@app.patch("/sessions/{session_id}", response_model=Session, tags=["sessions"])
def end_session(session_id: str, body: SessionEnd | None = None):
    if not db.get_session(session_id):
        raise HTTPException(404, "session not found")
    return detector.state.end(session_id, body.end if body else None)


@app.get("/sessions", response_model=list[Session], tags=["sessions"])
def list_sessions():
    return db.list_sessions()


@app.get("/sessions/{session_id}/timeline", response_model=Timeline, tags=["sessions"])
def session_timeline(session_id: str):
    """One session with its emotions, mood switches and content labels, all ordered by time."""
    t = db.timeline(session_id)
    if not t:
        raise HTTPException(404, "session not found")
    return t


# ---------- A5 ----------


@app.get("/insights", tags=["insights"])
def get_insights():
    return insights.insights()


@app.get("/goal", tags=["insights"])
def get_goal():
    return insights.goal()

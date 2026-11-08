"""Backend checks: python -m pytest -q   (from the backend folder)"""
import os
import sys
import tempfile

os.environ["BEHINDFEED_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["BEHINDFEED_DETECTOR"] = "0"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from pydantic import TypeAdapter  # noqa: E402

from app import db, detector  # noqa: E402
from app.models import Event, MoodSwitch  # noqa: E402


def test_title_matching_last_site_name_wins():
    m = detector.match_platform
    assert m("Ryan Gosling edit - YouTube - Google Chrome") == "youtube"
    assert m("Instagram tips for beginners - YouTube") == "youtube"
    assert m("(3) Facebook - Microsoft Edge") == "facebook"
    assert m("Home / X") == "x"
    assert m("Inbox - Outlook") is None


def test_pause_turns_camera_off_but_keeps_the_session():
    detector.tick("Reels - Instagram", now=1000.0)
    s = detector.state.snapshot()
    assert s["scrolling"] and s["camera"] and not s["paused"]
    detector.state.set_paused(True)
    s = detector.state.snapshot()
    assert s["scrolling"] and s["paused"] and not s["camera"]
    detector.state.set_paused(False)
    assert detector.state.snapshot()["camera"]
    detector.state.end()


def test_face_part_events_validate_including_other_platform():
    ta = TypeAdapter(Event)
    sw = ta.validate_python({"id": "sw_1794103404107", "ts": 1794103404.1, "from": "neutral", "to": "sad",
                             "platform": "other"})
    assert isinstance(sw, MoodSwitch)
    ta.validate_python({"ts": 1794103404.0, "emotion": "neutral", "valence": -0.02, "confidence": 0.86})
    ta.validate_python({"switch_id": "sw_1", "ts": 1.0, "platform": "youtube", "category": "drama",
                        "tone": "negative", "topic": "Some Actor: heartbreak film edit"})


def test_events_land_in_the_session_by_time():
    s = db.start_session("youtube", start=2000.0)
    db.insert_emotion({"ts": 2001.0, "emotion": "sad", "valence": -0.5, "confidence": 0.8}, db.session_for_ts(2001.0))
    db.end_session(s["id"], 2010.0)
    t = db.timeline(s["id"])
    assert len(t["emotions"]) == 1


def test_http_endpoints_if_fastapi_is_installed():
    fastapi = pytest.importorskip("fastapi")  # noqa: F841
    from fastapi.testclient import TestClient

    from app.main import app
    with TestClient(app) as c:
        assert c.post("/pause").json()["paused"] is True
        assert c.get("/status").json()["camera"] is False
        assert c.post("/resume").json()["paused"] is False
        r = c.post("/events", json={"ts": 5.0, "emotion": "happy", "valence": 0.7, "confidence": 0.9})
        assert r.status_code == 200
        assert c.post("/events", json={"ts": 5.0, "emotion": "joy", "valence": 0.7, "confidence": 0.9}).status_code == 422

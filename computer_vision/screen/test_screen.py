"""Tests for the screen part. Run:  python -m pytest -q   (in the screen folder)"""
import json
import os
import subprocess
import sys
import tempfile
import threading
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import capture  # noqa: E402
import gemini_labeler as gl  # noqa: E402
from label import ScreenLabeler  # noqa: E402


# ---------- stand-ins for the google-genai library ----------
class FakeTypes:
    class Part:
        @staticmethod
        def from_bytes(data, mime_type):
            return ("part", len(data), mime_type)

    class ThinkingConfig:
        def __init__(self, thinking_level=None):
            self.thinking_level = thinking_level

    class GenerateContentConfig:
        def __init__(self, **kw):
            self.kw = kw


class ApiError(Exception):
    def __init__(self, code, msg):
        super().__init__(f"{code} {msg}")
        self.code = code


class FakeClient:
    """Plays back a list of replies (text or exceptions) and records the calls."""

    def __init__(self, replies):
        self.replies, self.calls = list(replies), []
        self.models = self

    def generate_content(self, model, contents, config):
        self.calls.append((model, dict(config.kw)))
        self.contents = getattr(self, "contents", []) + [contents]
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return type("Resp", (), {"text": r})()


GOOD = '{"category": "news", "tone": "negative", "subject": "", "topic": "layoff headlines", "evidence": "headline text"}'


def labeler(replies, **kw):
    c = FakeClient(replies)
    return gl.GeminiLabeler(client=c, types=FakeTypes, **kw), c


def test_request_asks_for_contract_json_and_minimal_thinking():
    lab, c = labeler([GOOD])
    out = lab.label(b"jpeg-bytes", "tiktok")
    assert (out["category"], out["tone"], out["topic"]) == ("news", "negative", "layoff headlines")
    model, kw = c.calls[0]
    assert model == "gemini-3.5-flash"
    assert kw["response_mime_type"] == "application/json"
    assert kw["response_json_schema"]["properties"]["category"]["enum"] == gl.CATEGORIES
    assert kw["thinking_config"].thinking_level == "minimal"


def test_prompt_never_includes_the_users_mood_and_protects_private_people():
    p = gl.PROMPT.format(n=3, platform="instagram", span=1.5)
    assert "Never name, guess or describe" in p and "private people" in p
    assert "account or page name" in p and "song title" in p
    for word in ("sad", "angry", "happy"):
        assert word not in p.lower().split()


def test_falls_back_to_next_model_and_remembers_it():
    lab, c = labeler([ApiError(404, "model not found"), GOOD, GOOD])
    lab.label(b"x")
    lab.label(b"x")
    assert [m for m, _ in c.calls] == ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-flash-lite"]


def test_drops_thinking_setting_if_model_rejects_it():
    lab, c = labeler([ApiError(400, "thinking_level is not supported"), GOOD])
    lab.label(b"x")
    assert "thinking_config" in c.calls[0][1] and "thinking_config" not in c.calls[1][1]


def test_too_many_requests_rests_that_model_and_uses_the_next():
    lab, c = labeler([ApiError(429, "RESOURCE_EXHAUSTED"), GOOD, GOOD])
    lab.label(b"x")
    lab.label(b"x")                       # 3.5 Flash is resting: goes straight to Flash-Lite
    assert [m for m, _ in c.calls] == ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-flash-lite"]


def test_every_model_rate_limited_raises_rate_limited():
    lab, c = labeler([ApiError(429, "RESOURCE_EXHAUSTED")] * 4)
    try:
        lab.label(b"x")
    except gl.RateLimited:
        pass
    else:
        raise AssertionError("expected RateLimited")
    assert len(c.calls) == 4
    try:
        lab.label(b"x")                   # all resting now: no call at all
    except gl.RateLimited:
        assert len(c.calls) == 4


def test_several_frames_go_in_one_request_oldest_first():
    lab, c = labeler([GOOD])
    lab.label([b"a" * 10, b"b" * 20, b"c" * 30], "instagram", 1.5)
    contents = c.contents[0]
    assert [x[1] for x in contents[:3]] == [10, 20, 30] and "3 screenshot(s)" in contents[3]


def test_named_subject_is_kept_in_the_topic():
    out = gl.normalise({"category": "drama", "tone": "negative", "subject": "Some Actor",
                        "topic": "heartbreak film edit", "evidence": "caption hashtag"})
    assert out["topic"] == "Some Actor: heartbreak film edit" and out["subject"] == "Some Actor"
    out = gl.normalise({"category": "drama", "tone": "negative", "subject": "Some Actor",
                        "topic": "Some Actor heartbreak edit"})
    assert out["topic"] == "Some Actor heartbreak edit"
    assert gl.normalise({"subject": "none", "topic": "x"})["subject" ] == ""


def test_bad_api_key_says_so():
    lab, _ = labeler([ApiError(400, "API key not valid. Please pass a valid API key.")] * 4)
    try:
        lab.label(b"x")
    except RuntimeError as err:
        assert "API key" in str(err)


def test_reply_is_forced_into_contract_values():
    out = gl.normalise({"category": "Memes", "tone": "Uplifting", "topic": " a  dog.  "})
    assert (out["category"], out["tone"], out["topic"]) == ("comedy", "positive", "a dog")
    out = gl.normalise({"category": "space", "tone": "??"})
    assert (out["category"], out["tone"], out["topic"]) == ("other", "neutral", "unclear")
    assert gl.parse_json('```json\n' + GOOD + '\n```')["topic"] == "layoff headlines"


def test_old_library_without_json_schema_falls_back_to_plain_json():
    class OldTypes(FakeTypes):
        class GenerateContentConfig:
            def __init__(self, **kw):
                if "response_json_schema" in kw or "response_schema" in kw or "thinking_config" in kw:
                    raise TypeError("unexpected keyword")
                self.kw = kw
    c = FakeClient([GOOD])
    lab = gl.GeminiLabeler(client=c, types=OldTypes)
    assert lab.label(b"x")["category"] == "news"
    assert c.calls[0][1] == {"response_mime_type": "application/json", "max_output_tokens": 1024}


# ---------- capture ----------
def test_black_out_hides_the_camera_preview_inside_the_grab():
    img = np.full((100, 200, 3), 255, np.uint8)        # grab of screen area x 100..300, y 50..150
    capture.black_out(img, (100, 50, 300, 150), (250, 100, 400, 300))
    assert img[60, 10].tolist() == [255, 255, 255]       # outside the preview: untouched
    assert img[99, 199].tolist() == [0, 0, 0] and img[50, 150].tolist() == [0, 0, 0]
    assert img[49, 150].tolist() == [255, 255, 255]


def test_encode_shrinks_to_jpeg_in_memory():
    jpeg, w, h = capture.encode(np.zeros((1440, 2560, 3), np.uint8))
    assert (w, h) == (1920, 1080) and jpeg[:2] == b"\xff\xd8"


# ---------- real-time queue ----------
def test_earlier_frames_from_just_before_the_switch_are_sent_with_the_sharp_one():
    sizes = []

    def grab(max_side=1920):
        sizes.append(max_side)
        return capture.fake_shot(max_side)

    lab = gl.FakeLabeler(delay_s=0)
    got = []
    sl = ScreenLabeler(got.append, labeler=lab, grab=grab, buffer_every_s=0.2, lookback_s=1.5, log=lambda m: None)
    time.sleep(1.3)                                      # the buffer fills while the camera is on
    sl.submit({"id": "sw_1", "platform": "instagram", "ts": time.time()})
    sl.close()
    assert lab.last_images == 3                          # 2 earlier frames + the sharp one
    assert 1024 in sizes and sizes.count(1920) == 1


def test_no_screen_buffering_while_camera_is_off():
    count = []

    def grab(max_side=1920):
        count.append(max_side)
        return capture.fake_shot(max_side)

    sl = ScreenLabeler(lambda e: None, labeler=gl.FakeLabeler(0), grab=grab, buffer_every_s=0.1, log=lambda m: None)
    sl.set_active(False)
    time.sleep(0.15)
    n = len(count)
    time.sleep(0.5)
    assert len(count) == n and not sl._frames
    sl.close()


def test_labels_arrive_in_background_with_grab_time_and_switch_id():
    got = []
    shots = iter([capture.fake_shot(), capture.fake_shot()])
    sl = ScreenLabeler(got.append, labeler=gl.FakeLabeler(delay_s=0.2), grab=lambda: next(shots), log=lambda m: None)
    t0 = time.time()
    sl.submit({"id": "sw_1", "platform": "youtube"})
    assert time.time() - t0 < 0.05                       # never blocks the face loop
    sl.close()
    assert len(got) == 1
    ev = got[0]
    assert set(ev) == {"switch_id", "ts", "platform", "category", "tone", "topic"}
    assert ev["switch_id"] == "sw_1" and ev["platform"] == "youtube" and abs(ev["ts"] - t0) < 1


def test_slow_gemini_keeps_only_the_newest_waiting_shots():
    got, gate = [], threading.Event()

    class Slow(gl.FakeLabeler):
        def label(self, images, platform="instagram", span_s=0.0):
            gate.wait(3)
            return super().label(images, platform, span_s)

    sl = ScreenLabeler(got.append, labeler=Slow(delay_s=0), grab=capture.fake_shot, max_waiting=2, log=lambda m: None)
    for i in range(6):
        sl.submit({"id": f"sw_{i}", "platform": "instagram"})
        time.sleep(0.05)
    gate.set()
    sl.close()
    ids = [e["switch_id"] for e in got]
    assert ids[0] == "sw_0" and ids[-2:] == ["sw_4", "sw_5"] and len(ids) == 3
    assert sl.stats["dropped"] == 3


def test_preview_in_front_is_skipped_not_sent():
    got, logs = [], []

    def skip():
        raise capture.SkipGrab("the camera preview window is in front")

    sl = ScreenLabeler(got.append, labeler=gl.FakeLabeler(0), grab=skip, log=logs.append)
    sl.submit({"id": "sw_9", "platform": "instagram"})
    sl.close()
    assert not got and sl.stats["skipped"] == 1 and "preview" in logs[0]


def test_rate_limit_drops_extra_requests():
    got = []
    sl = ScreenLabeler(got.append, labeler=gl.FakeLabeler(0), grab=capture.fake_shot, per_minute=2,
                       max_waiting=10, log=lambda m: None)
    for i in range(4):
        sl.submit({"id": f"sw_{i}", "platform": "instagram"})
        time.sleep(0.05)
    sl.close()
    assert len(got) == 2 and sl.stats["dropped"] == 2


def test_face_and_screen_together_fake_end_to_end():
    face = os.path.join(os.path.dirname(HERE), "face", "face_monitor.py")
    out = os.path.join(tempfile.mkdtemp(), "events.jsonl")
    subprocess.run([sys.executable, face, "--fake", "--fake-speed", "20", "--fake-loops", "1", "--quiet",
                    "--out", out, "--screen", "--screen-backend", "fake"], check=True, timeout=60)
    with open(out, encoding="utf-8") as f:
        rows = [json.loads(line) for line in f]
    switches = {r["id"] for r in rows if "from" in r}
    labels = [r for r in rows if "switch_id" in r]
    assert switches and labels
    assert all(lab["switch_id"] in switches for lab in labels)
    assert len(labels) >= len(switches) - 2               # nearly every switch got its label


# ---------- platform ----------
def test_platform_title_first_then_what_gemini_saw_then_the_switch():
    from label import pick_platform
    assert pick_platform("youtube", "instagram", "instagram") == "youtube"
    assert pick_platform(None, "facebook", "instagram") == "facebook"
    assert pick_platform(None, "", "tiktok") == "tiktok"
    assert pick_platform(None, "other", "other") == "other"


def test_unknown_platform_lets_gemini_judge_and_reads_its_answer():
    lab, c = labeler(['{"category": "comedy", "tone": "positive", "subject": "", "topic": "skit",'
                      ' "evidence": "video", "platform": "facebook"}'])
    out = lab.label(b"x", None)
    assert out["platform_seen"] == "facebook"
    assert "which one is for you to judge" in c.contents[0][-1]
    lab, c = labeler([GOOD])
    lab.label(b"x", "youtube")
    assert "screenshot(s) from YouTube" in c.contents[0][-1]


def test_label_uses_the_window_title_platform_not_the_switch():
    got = []

    def grab(max_side=1920):
        s = capture.fake_shot(max_side)
        return s._replace(platform="youtube")

    sl = ScreenLabeler(got.append, labeler=gl.FakeLabeler(0), grab=grab, buffer_every_s=0, log=lambda m: None)
    sl.submit({"id": "sw_1", "platform": "instagram"})
    sl.close()
    assert got[0]["platform"] == "youtube"

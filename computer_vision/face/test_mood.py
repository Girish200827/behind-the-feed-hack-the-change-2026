"""Tests for the face part. Run:  python -m pytest -q   (or  python test_mood.py)"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

from emotion_model import HSEmotionModel
from mood import EMOTIONS, PLATFORMS, MoodSettings, MoodTracker

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 12
T0 = 1_800_000_000.0


def face(target, strength=0.7, rest_sad=0.0):
    """A made-up model output: `strength` on target, rest spread out."""
    p = {e: (1 - strength) / 6 for e in EMOTIONS}
    p[target] = strength
    p["sad"] += rest_sad
    return p


def play(tracker, script, t0=T0):
    """script: list of (probabilities, seconds). Returns [(t, kind, event)]."""
    out, t = [], t0
    for probs, seconds in script:
        for _ in range(int(round(seconds * FPS))):
            for kind, ev in tracker.feed(t, probs):
                out.append((t, kind, ev))
            t += 1 / FPS
    return out


def switches(events):
    return [(t, ev) for t, kind, ev in events if kind == "mood_switch"]


def test_steady_face_gives_samples_but_no_switch():
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    ev = play(tr, [(face("neutral"), 40)])
    assert not switches(ev)
    samples = [e for _, k, e in ev if k == "emotion_sample"]
    assert 30 <= len(samples) <= 33          # about one a second after calibration
    assert all(s["emotion"] == "neutral" for s in samples)


def test_clear_smile_switches_within_one_second():
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    ev = play(tr, [(face("neutral"), 20), (face("happy"), 6)])
    sw = switches(ev)
    assert len(sw) == 1
    t, s = sw[0]
    assert (s["from"], s["to"]) == ("neutral", "happy")
    assert t - (T0 + 20) <= 1.0


def test_mild_expression_switches_within_one_and_a_half_seconds():
    mild = face("happy", strength=0.3)
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    ev = play(tr, [(face("neutral"), 20), (mild, 6)])
    sw = switches(ev)
    assert [s["to"] for _, s in sw] == ["happy"]
    assert sw[0][0] - (T0 + 20) <= 1.5


def test_small_smile_counts_but_equal_small_surprise_does_not():
    def bump(target, amount):
        p = face("neutral", strength=0.8)
        p[target] += amount
        p["neutral"] -= amount
        return p
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    assert [s["to"] for _, s in switches(play(tr, [(face("neutral", 0.8), 20), (bump("happy", 0.14), 4)]))] == ["happy"]
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    assert not switches(play(tr, [(face("neutral", 0.8), 20), (bump("surprise", 0.14), 4)]))


def test_landmarks_fuse_small_smile_into_happy_and_damp_talking_surprise():
    from landmarks import fuse
    model_says = {"neutral": 0.7, "happy": 0.1, "surprise": 0.1, "sad": 0.05, "angry": 0.05, "fear": 0.0, "disgust": 0.0}
    small_smile = {"mouthSmileLeft": 0.35, "mouthSmileRight": 0.3, "browInnerUp": 0.05}
    p = fuse(model_says, small_smile)
    assert abs(p["happy"] - 0.325 * 1.4) < 1e-9 and abs(sum(p.values()) - 1) < 1e-9
    assert max(p, key=p.get) in ("neutral", "happy") and p["happy"] > 0.4
    talking = {"jawOpen": 0.6, "mouthSmileLeft": 0.02, "mouthSmileRight": 0.02}   # no brow raise
    p = fuse(model_says, talking)
    assert p["surprise"] < 0.01 and abs(sum(p.values()) - 1) < 1e-9
    real_surprise = {"browInnerUp": 0.6, "eyeWideLeft": 0.5, "eyeWideRight": 0.5, "jawOpen": 0.5}
    assert fuse(model_says, real_surprise)["surprise"] == model_says["surprise"]
    big_smile_model = dict(model_says, happy=0.9, neutral=0.0)
    assert fuse(big_smile_model, {"mouthSmileLeft": 0.1, "mouthSmileRight": 0.1})["happy"] == 0.9   # never lowers happy


def test_short_blip_is_ignored():
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    ev = play(tr, [(face("neutral"), 20), (face("angry"), 0.25), (face("neutral"), 10)])
    assert not switches(ev)


def test_mood_follows_the_face_back_and_forth_without_long_waits():
    # smile 3 s, relax 3 s, smile 3 s: the old 10 s cooldown hid the second and third changes
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    ev = play(tr, [(face("neutral"), 20), (face("happy"), 3), (face("neutral"), 3), (face("happy"), 3)])
    sw = switches(ev)
    assert [s["to"] for _, s in sw] == ["happy", "neutral", "happy"]
    for (t, _), start in zip(sw, (T0 + 20, T0 + 23, T0 + 26)):
        assert t - start <= 1.0, (t - start)


def test_pending_shows_upcoming_switch():
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    play(tr, [(face("neutral"), 20), (face("happy"), 0.2)])
    assert tr.pending().startswith(" -> positive in ")


def test_slow_labeller_is_not_flooded():
    import threading
    import time
    from events import EventSink, SwitchHook
    release = threading.Event()
    calls = []

    def slow_label(switch):
        calls.append(switch["id"])
        release.wait(2)
        return {"switch_id": switch["id"]}

    hook = SwitchHook.__new__(SwitchHook)
    hook.func, hook.sink, hook._busy, hook.skipped = slow_label, EventSink(None, echo=False), threading.Lock(), 0
    for i in range(3):
        hook.submit({"id": f"sw_{i}"})
    release.set()
    time.sleep(0.2)
    hook.submit({"id": "sw_3"})
    time.sleep(0.2)
    assert calls == ["sw_0", "sw_3"] and hook.skipped == 2


def test_flicker_between_negative_emotions_is_one_switch():
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    flicker = [(face(e), 0.5) for e in ["sad", "angry", "disgust", "sad", "fear", "angry"] * 4]
    ev = play(tr, [(face("neutral"), 20)] + flicker)
    sw = switches(ev)
    assert len(sw) == 1 and sw[0][1]["from"] == "neutral" and sw[0][1]["to"] in ("sad", "angry", "disgust", "fear")


def test_frown_spread_over_negative_emotions_still_counts():
    # No single negative emotion beats neutral, but together they do.
    frown = {"neutral": 0.34, "sad": 0.2, "angry": 0.18, "disgust": 0.16, "fear": 0.04, "happy": 0.04, "surprise": 0.04}
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    ev = play(tr, [(face("neutral", strength=0.8), 20), (frown, 4)])
    assert [s["to"] for _, s in switches(ev)] == ["sad"]


def test_cooldown_stops_ping_pong():
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    ev = play(tr, [(face("neutral"), 20), (face("happy"), 1), (face("sad"), 15)])
    sw = switches(ev)
    assert [s["to"] for _, s in sw] == ["happy", "sad"]
    assert sw[1][0] - sw[0][0] >= 2.0


def test_resting_face_that_reads_sad_is_not_reported_as_sad():
    rest = face("neutral", strength=0.35, rest_sad=0.35)    # model thinks "sad" at rest
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    ev = play(tr, [(rest, 30), (face("happy"), 5)])
    sw = switches(ev)
    assert [s["to"] for _, s in sw] == ["happy"]
    samples = [e for t, k, e in ev if k == "emotion_sample" and t < T0 + 30]
    assert all(s["emotion"] == "neutral" for s in samples)


def test_without_calibration_first_mood_is_set_quietly():
    tr = MoodTracker(settings=MoodSettings(calibrate_s=0))
    ev = play(tr, [(face("sad"), 5), (face("happy"), 5)])
    sw = switches(ev)
    assert [(s["from"], s["to"]) for _, s in sw] == [("sad", "happy")]


def test_events_match_contracts():
    tr = MoodTracker(platform="tiktok", settings=MoodSettings(calibrate_s=8))
    ev = play(tr, [(face("neutral"), 20), (face("surprise"), 5)])
    for _, kind, e in ev:
        if kind == "emotion_sample":
            assert set(e) == {"ts", "emotion", "valence", "confidence"}
            assert e["emotion"] in EMOTIONS and -1 <= e["valence"] <= 1 and 0 <= e["confidence"] <= 1
        else:
            assert set(e) == {"id", "ts", "from", "to", "platform"}
            assert e["id"].startswith("sw_") and e["platform"] in PLATFORMS
        json.dumps(e)
    assert switches(ev)


def test_face_lost_restarts_smoothing_and_new_session_resets_mood():
    tr = MoodTracker(settings=MoodSettings(calibrate_s=8))
    play(tr, [(face("neutral"), 20), (face("happy"), 5)])
    assert tr.mood == "happy"
    tr.new_session("youtube")
    assert tr.mood == "neutral" and tr.baseline is not None
    ev = play(tr, [(face("sad"), 4)], t0=T0 + 1000)
    sw = switches(ev)
    assert [(s["from"], s["to"], s["platform"]) for _, s in sw] == [("neutral", "sad", "youtube")]


class FakeSession:
    """Stands in for an onnxruntime session of the _mtl model: 8 logits + valence + arousal."""

    class _Input:
        name, shape = "input", ["batch_size", 3, 224, 224]

    def __init__(self):
        self.batches = []

    def get_inputs(self):
        return [self._Input()]

    def run(self, _, feeds):
        x = feeds["input"]
        self.batches.append(x.shape)
        row = np.array([0, 1, 1, 0, 5, 1, 0, 0, 0.6, 0.3], dtype=np.float32)
        return [np.stack([row] * x.shape[0])]


def test_model_folds_contempt_reads_valence_and_scores_mirror_in_one_batch():
    sess = FakeSession()
    m = HSEmotionModel(session=sess)
    probs, val = m.predict(np.zeros((112, 100, 3), dtype=np.uint8))
    assert sess.batches == [(2, 3, 224, 224)]          # face + mirrored face, one call
    assert set(probs) == set(EMOTIONS) and abs(sum(probs.values()) - 1) < 1e-6
    assert max(probs, key=probs.get) == "happy"
    assert probs["disgust"] > probs["angry"]          # contempt + disgust both land in disgust
    assert abs(val - 0.6) < 1e-6
    m.mirror = False
    m.predict(np.zeros((50, 50, 3), dtype=np.uint8))
    assert sess.batches[-1] == (1, 3, 224, 224)


def test_model_file_found_in_face_folder_or_downloaded():
    import download
    import emotion_model
    root = tempfile.mkdtemp()
    old_dir, old_dl = emotion_model.MODELS_DIR, download.download_file
    seen = {}
    try:
        emotion_model.MODELS_DIR = os.path.join(root, "models")
        os.makedirs(emotion_model.MODELS_DIR)

        def fake_download(url, path, min_bytes, what):
            seen["url"] = url
            with open(path, "wb") as f:
                f.write(b"x" * min_bytes)

        download.download_file = fake_download
        p = emotion_model.model_path("enet_b2_8")                      # not there: downloaded into models/
        assert p == os.path.join(root, "models", "enet_b2_8.onnx") and "enet_b2_8.onnx" in seen["url"]
        with open(os.path.join(root, "enet_b0_8_va_mtl.onnx"), "wb") as f:  # saved next to the code
            f.write(b"x" * 1_100_000)
        assert emotion_model.model_path("enet_b0_8_va_mtl") == os.path.join(root, "enet_b0_8_va_mtl.onnx")
    finally:
        emotion_model.MODELS_DIR, download.download_file = old_dir, old_dl


def test_tilted_head_is_rotated_level():
    import cv2
    from detector import eye_angle
    a = eye_angle(((200.0, 120.0), (100.0, 100.0)))
    m = cv2.getRotationMatrix2D((150, 110), a, 1.0)
    pts = np.array([[100, 100, 1], [200, 120, 1]], float) @ m.T
    assert abs(pts[0, 1] - pts[1, 1]) < 1e-6


def test_download_reports_browser_fallback():
    import download
    target = os.path.join(tempfile.mkdtemp(), "m.onnx")
    try:
        download.download_file("https://invalid.invalid/m.onnx", target, 10, "a test file")
    except RuntimeError as err:
        assert "web browser" in str(err) and target in str(err)
    else:
        raise AssertionError("expected a failure")
    assert not os.path.exists(target) and not os.path.exists(target + ".part")


def test_fake_mode_end_to_end():
    out = os.path.join(tempfile.mkdtemp(), "test_events.jsonl")
    subprocess.run([sys.executable, os.path.join(HERE, "face_monitor.py"), "--fake", "--fake-speed", "200",
                    "--out", out, "--quiet"], check=True, cwd=HERE)
    with open(out, encoding="utf-8") as f:
        lines = [json.loads(line) for line in f]
    sw = [line for line in lines if "from" in line]
    assert [s["to"] for s in sw][:3] == ["happy", "neutral", "sad"]
    assert len([line for line in lines if "emotion" in line]) >= 75   # ~1 a second over 89 s, minus calibration



def test_platform_from_window_titles():
    from platforms import detect_platform
    cases = {
        "Ryan Gosling edit - YouTube - Google Chrome": "youtube",
        "(3) Facebook - Microsoft Edge": "facebook",
        "Instagram": "instagram",
        "Reels \u2022 Instagram - Google Chrome": "instagram",
        "TikTok - Make Your Day": "tiktok",
        "someone on X: \"big news\" / X - Google Chrome": "x",
        "Home / X": "x",
        "Instagram tips for beginners - YouTube": "youtube",     # the site name comes last
        "r/funny - Reddit - Google Chrome": "other",
        "Inbox - Outlook": None,
        "Face preview (nothing is saved) - press q to quit": None,
        "Xbox app": None,
        "": None,
    }
    for title, want in cases.items():
        assert detect_platform(title) == want, (title, detect_platform(title))


def test_platform_watcher_keeps_last_social_platform_for_other_windows():
    from platforms import PlatformWatcher
    titles = iter(["Cats - YouTube", "Command Prompt - face_monitor.py", "Document1 - Word", "(2) Facebook"])
    w = PlatformWatcher(every_s=0, title_source=lambda: next(titles))
    assert [w.get() for _ in range(4)] == ["youtube", "youtube", "youtube", "facebook"]



def test_backend_gate_follows_status_pause_and_outages():
    from face_monitor import BackendGate
    replies = iter([
        {"scrolling": True, "paused": False, "camera": True, "platform": "youtube", "session_id": "s_001"},
        {"scrolling": True, "paused": True, "camera": False, "platform": "youtube", "session_id": "s_001"},
        ConnectionError("backend down"),
        {"scrolling": False, "paused": False, "camera": False, "platform": None, "session_id": None},
        {"scrolling": True, "platform": "facebook", "session_id": "s_002"},   # older backend: no "camera" key
    ])

    def fetch():
        r = next(replies)
        if isinstance(r, Exception):
            raise r
        return r

    g = BackendGate("http://x/status", every_s=3600, fetch=fetch)   # first poll happens in its thread
    import time as _t
    _t.sleep(0.1)
    assert g.check() == (True, "youtube") and g.session_id == "s_001"
    g.poll_once()
    assert g.check()[0] is False and g.reason() == "paused from the dashboard"
    g.poll_once()
    assert g.check()[0] is False and g.reason() == "backend not reachable"
    g.poll_once()
    assert g.check()[0] is False and g.reason() == "no social media open"
    g.poll_once()
    assert g.check() == (True, "facebook") and g.session_id == "s_002"
    g.stop()


def test_backend_option_sets_the_event_url():
    import face_monitor as fm
    args = fm.parse_args(["--api", "http://127.0.0.1:8000/", "--fake"])
    assert args.api == "http://127.0.0.1:8000/" and args.backend == "hsemotion"



def test_own_windows_are_recognised():
    from platforms import is_own_window
    assert is_own_window("BehindFeed") and is_own_window("Face preview (nothing is saved) - press q to quit")
    assert not is_own_window("Reels - Instagram - Google Chrome") and not is_own_window(None)


if __name__ == "__main__":
    tests = [v for k, v in dict(globals()).items() if k.startswith("test_")]
    for fn in tests:
        fn()
        print("ok  ", fn.__name__)
    print(f"{len(tests)} tests passed")

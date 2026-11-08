"""R3: turn per-frame emotion probabilities into emotion_sample and mood_switch events.

Pure logic: no camera and no model, so it can be tested with made-up numbers.
Feed it (unix_time, {emotion: probability}) for every analysed frame and it
returns the events to send, already in the contracts.md formats.

How a mood switch is decided
1. Smooth: each frame's probabilities are blended into a running average
   (time constant `smooth_s`), so one odd frame cannot flip the mood.
2. Calibrate (optional, on by default): for the first `calibrate_s` seconds the
   user looks at the screen with a relaxed face. That average is their
   "resting face". Many people's resting face reads as sad or angry to these
   models; after calibration only a rise ABOVE resting counts.
3. Group: the seven emotions are pooled into four mood groups (positive,
   negative, surprise, neutral). The models often confuse angry, sad, disgust
   and fear with each other, but rarely confuse them with happy; for "does this
   content lift or drain you" only the group matters. A switch fires only when
   the group changes, and evidence from all negative emotions adds up.
4. Hold: the new group must stay on top for `hold_s` (0.8 s), or only
   `fast_hold_s` (0.4 s) when it is strong (confidence >= `fast_conf`).
5. Cooldown: at least `cooldown_s` (2 s) between two switches, so the mood
   cannot ping-pong. (It used to be 10 s, which made the mood lag the face.
   The screen labeller is protected separately: events.SwitchHook skips a
   switch while the previous label is still being made.)
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

EMOTIONS = ["happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"]
PLATFORMS = ["instagram", "tiktok", "youtube", "x", "facebook", "other"]  # "other": Reddit, Threads, ...

# Rough pleasantness of each expression on a -1..1 scale (after the circumplex
# model of affect). Only used when the emotion model gives no valence itself.
VALENCE = {
    "happy": 0.8,
    "surprise": 0.2,
    "neutral": 0.0,
    "sad": -0.6,
    "angry": -0.6,
    "fear": -0.6,
    "disgust": -0.7,
}

MOOD_GROUP = {
    "happy": "positive",
    "surprise": "surprise",
    "neutral": "neutral",
    "sad": "negative",
    "angry": "negative",
    "fear": "negative",
    "disgust": "negative",
}

Event = Tuple[str, dict]  # (event kind, event body)


@dataclass
class MoodSettings:
    smooth_s: float = 0.25        # smoothing time constant, seconds
    hold_s: float = 0.8           # a new mood group must hold this long
    fast_hold_s: float = 0.4      # ...or only this long when it is strong
    fast_conf: float = 0.7        # "strong": group confidence at or above this
    cooldown_s: float = 2.0       # minimum gap between two switches
    sample_every_s: float = 1.0   # emotion_sample rate
    calibrate_s: float = 8.0      # seconds of relaxed face to learn; 0 turns it off
    shift_needed: float = 0.15    # with calibration: rise above resting needed to count
    happy_boost: float = 1.3      # small smiles count more...
    surprise_damp: float = 0.8    # ...and stray "surprise" (talking, eyebrows) counts less
    min_prob: float = 0.40        # without calibration: smallest probability that counts
    face_lost_s: float = 1.0      # a gap longer than this restarts smoothing


def _clip(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def normalise(probs: Dict[str, float]) -> Dict[str, float]:
    """Return probabilities over exactly the seven contract emotions, summing to 1."""
    p = {e: max(0.0, float(probs.get(e, 0.0))) for e in EMOTIONS}
    total = sum(p.values())
    if total <= 0:
        return {e: (1.0 if e == "neutral" else 0.0) for e in EMOTIONS}
    return {e: v / total for e, v in p.items()}


class MoodTracker:
    def __init__(
        self,
        platform: str = "instagram",
        settings: Optional[MoodSettings] = None,
        baseline: Optional[dict] = None,
        log: Callable[[str], None] = lambda msg: None,
    ):
        self.s = settings or MoodSettings()
        self.platform = platform
        self.log = log
        self.baseline: Optional[Dict[str, float]] = None
        self.baseline_valence: Optional[float] = None
        if baseline:
            self.set_baseline(baseline)
        self.calibrating = self.baseline is None and self.s.calibrate_s > 0
        self._calib_sum = {e: 0.0 for e in EMOTIONS}
        self._calib_n = 0
        self._calib_val: List[float] = []
        self._calib_start: Optional[float] = None
        self.new_session(platform)

    # ---------- session and baseline ----------
    def new_session(self, platform: Optional[str] = None) -> None:
        """Forget the running mood (keep the baseline). Call when a scroll session starts."""
        if platform:
            self.platform = platform
        self.smoothed: Optional[Dict[str, float]] = None
        self.smoothed_valence: Optional[float] = None
        self.last_t: Optional[float] = None
        self.mood: Optional[str] = "neutral" if self.baseline else None
        self.candidate: Optional[str] = None
        self.candidate_since: Optional[float] = None
        self.last_switch_t = -math.inf
        self.last_sample_t = -math.inf

    def set_baseline(self, data: dict) -> None:
        self.baseline = normalise(data.get("probs", data))
        v = data.get("valence")
        self.baseline_valence = float(v) if v is not None else None
        self.calibrating = False
        self.mood = "neutral"

    def baseline_dict(self) -> Optional[dict]:
        if not self.baseline:
            return None
        return {"probs": self.baseline, "valence": self.baseline_valence}

    def save_baseline(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.baseline_dict(), f, indent=2)

    # ---------- main entry ----------
    def feed(self, t: float, probs: Dict[str, float], model_valence: Optional[float] = None) -> List[Event]:
        """Add one analysed frame taken at unix time t. Returns events to send."""
        p = normalise(probs)
        self._smooth(t, p, model_valence)

        if self.calibrating:
            self._calibrate(t, p, model_valence)
            return []

        events: List[Event] = []
        label, group, strength, conf, val = self.assess()

        switch = self._update_switch(t, label, group, strength)
        if switch:
            events.append(("mood_switch", switch))

        if t - self.last_sample_t >= self.s.sample_every_s - 1e-9:
            self.last_sample_t = t
            events.append(("emotion_sample", {
                "ts": round(t, 1),
                "emotion": label,
                "valence": val,
                "confidence": conf,
            }))
        return events

    def read(self) -> Tuple[str, float, float]:
        """Current (emotion, confidence, valence) from the smoothed state."""
        label, _, _, conf, val = self.assess()
        return label, conf, val

    def pending(self) -> str:
        """For the preview: which mood group is about to take over, and in how long."""
        if self.candidate is None or self.candidate_since is None or self.last_t is None or self.calibrating:
            return ""
        strength = self.assess()[2]
        need = self.s.fast_hold_s if strength >= self.s.fast_conf else self.s.hold_s
        left = max(need - (self.last_t - self.candidate_since),
                   self.s.cooldown_s - (self.last_t - self.last_switch_t), 0.0)
        return f" -> {self.candidate} in {left:.1f}s"

    def assess(self) -> Tuple[str, str, float, float, float]:
        """(emotion, mood group, group confidence, emotion confidence, valence)."""
        sp = self.smoothed or normalise({})
        weight = {"happy": self.s.happy_boost, "surprise": self.s.surprise_damp}
        if self.baseline:
            # Only rises above the resting face count; "neutral" gets a fixed pull,
            # so a group must rise more than `shift_needed` in total to win.
            q = {e: max(sp[e] - self.baseline[e], 0.0) * weight.get(e, 1.0) for e in EMOTIONS if e != "neutral"}
            q["neutral"] = self.s.shift_needed
        else:
            q = {e: sp[e] * weight.get(e, 1.0) for e in EMOTIONS}
        total = sum(q.values()) or 1.0
        q = {e: v / total for e, v in q.items()}

        groups: Dict[str, float] = {}
        for e, v in q.items():
            groups[MOOD_GROUP[e]] = groups.get(MOOD_GROUP[e], 0.0) + v
        group = max(groups, key=groups.get)
        label = max((e for e in EMOTIONS if MOOD_GROUP[e] == group), key=lambda e: q[e])
        if not self.baseline:
            raw_group = sum(sp[e] for e in EMOTIONS if MOOD_GROUP[e] == group)
            if raw_group < self.s.min_prob:  # not sure enough: stay where we are
                label = self.mood or "neutral"
                group = MOOD_GROUP[label]
        strength = groups.get(group, 0.0)

        if self.smoothed_valence is not None:
            val = self.smoothed_valence - (self.baseline_valence or 0.0)
        else:
            val = sum(q[e] * VALENCE[e] for e in EMOTIONS)
        # + 0.0 turns -0.0 into 0.0
        return label, group, strength, round(q[label], 2), round(_clip(val), 2) + 0.0

    # ---------- internals ----------
    def _smooth(self, t: float, p: Dict[str, float], v: Optional[float]) -> None:
        restart = self.last_t is None or (t - self.last_t) > self.s.face_lost_s
        if restart:
            self.smoothed = dict(p)
            self.smoothed_valence = v
            self.candidate = None
            self.candidate_since = None
        else:
            dt = max(0.0, t - self.last_t)
            a = 1.0 - math.exp(-dt / self.s.smooth_s) if self.s.smooth_s > 0 else 1.0
            for e in EMOTIONS:
                self.smoothed[e] += a * (p[e] - self.smoothed[e])
            if v is not None:
                if self.smoothed_valence is None:
                    self.smoothed_valence = v
                else:
                    self.smoothed_valence += a * (v - self.smoothed_valence)
        self.last_t = t

    def _calibrate(self, t: float, p: Dict[str, float], v: Optional[float]) -> None:
        if self._calib_start is None:
            self._calib_start = t
            self.log(f"Calibrating: look at the screen with a relaxed face for {self.s.calibrate_s:.0f} s")
        for e in EMOTIONS:
            self._calib_sum[e] += p[e]
        self._calib_n += 1
        if v is not None:
            self._calib_val.append(v)
        if t - self._calib_start >= self.s.calibrate_s and self._calib_n >= 5:
            base = {e: self._calib_sum[e] / self._calib_n for e in EMOTIONS}
            val = sum(self._calib_val) / len(self._calib_val) if self._calib_val else None
            self.set_baseline({"probs": base, "valence": val})
            top = sorted(base.items(), key=lambda kv: -kv[1])[:3]
            self.log("Calibrated. Resting face read as " + ", ".join(f"{e} {pr:.2f}" for e, pr in top)
                     + ". From now on that counts as neutral.")

    def _update_switch(self, t: float, label: str, group: str, strength: float) -> Optional[dict]:
        if self.mood is not None and group == MOOD_GROUP[self.mood]:
            self.candidate = None            # same mood group (e.g. sad -> angry): not a switch
            self.candidate_since = None
            return None
        if group != self.candidate:
            self.candidate = group
            self.candidate_since = t
            return None
        need = self.s.fast_hold_s if strength >= self.s.fast_conf else self.s.hold_s
        if t - self.candidate_since < need:
            return None
        if self.mood is None:            # first settled mood: set it quietly
            self.mood = label
            self.candidate = None
            self.candidate_since = None
            return None
        if t - self.last_switch_t < self.s.cooldown_s:
            return None                  # still cooling down; fires later if the mood holds
        event = {
            "id": f"sw_{int(round(t * 1000))}",
            "ts": round(t, 1),
            "from": self.mood,
            "to": label,
            "platform": self.platform,
        }
        self.mood = label
        self.last_switch_t = t
        self.candidate = None
        self.candidate_since = None
        return event

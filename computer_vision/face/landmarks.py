"""Second signal: MediaPipe Face Landmarker measures face movements directly.

The emotion model names emotions, but it learned "happy" from photos of big
smiles, so a small real smile barely moves it. MediaPipe's Face Landmarker
gives 52 "blendshape" scores from 0 to 1 that measure single movements, such
as mouthSmileLeft / mouthSmileRight (mouth corners lifting), browInnerUp and
eyeWideLeft. We use two of them:

- smile: the average of mouthSmileLeft and mouthSmileRight. A small smile
  already moves it, so "happy" becomes at least that strong.
- brow raise / wide eyes: real surprise raises the brows or widens the eyes;
  talking does not. Without them, most of "surprise" is moved to neutral.

It is optional: without mediapipe or its model file the app runs as before.
Runs locally; frames stay in memory.
"""
from __future__ import annotations

import os
from typing import Dict, Optional

import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(HERE, "models")
LANDMARKER_FILE = "face_landmarker.task"
LANDMARKER_URL = ("https://storage.googleapis.com/mediapipe-models/face_landmarker/"
                  "face_landmarker/float16/latest/face_landmarker.task")


def landmarker_path() -> str:
    for folder in (MODELS_DIR, HERE):
        path = os.path.join(folder, LANDMARKER_FILE)
        if os.path.exists(path) and os.path.getsize(path) > 1_000_000:
            return path
    path = os.path.join(MODELS_DIR, LANDMARKER_FILE)
    from download import download_file
    download_file(LANDMARKER_URL, path, min_bytes=1_000_000, what="the MediaPipe face landmarker (about 4 MB)")
    return path


class ExpressionMeter:
    def __init__(self):
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision
        self.mp = mp
        options = vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=landmarker_path()),
            running_mode=vision.RunningMode.VIDEO,   # tracks between frames: faster than IMAGE
            num_faces=1,
            output_face_blendshapes=True,
        )
        self.landmarker = vision.FaceLandmarker.create_from_options(options)
        self._last_ms = -1

    def measure(self, frame_bgr, t: float) -> Optional[Dict[str, float]]:
        """Blendshape scores for the face in the frame, or None if no face."""
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        ms = int(t * 1000)
        if ms <= self._last_ms:          # VIDEO mode needs increasing timestamps
            ms = self._last_ms + 1
        self._last_ms = ms
        result = self.landmarker.detect_for_video(self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=rgb), ms)
        if not result.face_blendshapes:
            return None
        return {c.category_name: float(c.score) for c in result.face_blendshapes[0]}

    def close(self) -> None:
        self.landmarker.close()


def smile_score(bs: Dict[str, float]) -> float:
    return (bs.get("mouthSmileLeft", 0.0) + bs.get("mouthSmileRight", 0.0)) / 2


def brow_raise(bs: Dict[str, float]) -> float:
    outer = (bs.get("browOuterUpLeft", 0.0) + bs.get("browOuterUpRight", 0.0)) / 2
    wide = (bs.get("eyeWideLeft", 0.0) + bs.get("eyeWideRight", 0.0)) / 2
    return max(bs.get("browInnerUp", 0.0), outer, wide)


def fuse(probs: Dict[str, float], bs: Dict[str, float], smile_gain: float = 1.4,
         surprise_needs: float = 0.25) -> Dict[str, float]:
    """Combine the emotion model's probabilities with the measured movements."""
    p = dict(probs)
    s = min(1.0, smile_score(bs) * smile_gain)
    if s > p["happy"]:                    # happy is at least as strong as the measured smile
        rest = 1.0 - p["happy"]
        scale = (1.0 - s) / rest if rest > 1e-9 else 0.0
        p = {e: (s if e == "happy" else v * scale) for e, v in p.items()}
    support = min(1.0, brow_raise(bs) / surprise_needs) if surprise_needs > 0 else 1.0
    if support < 1.0:                     # surprise without raised brows or wide eyes: mostly neutral
        moved = p["surprise"] * (1.0 - support)
        p["surprise"] -= moved
        p["neutral"] += moved
    return p

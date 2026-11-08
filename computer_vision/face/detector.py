"""R1: find the user's face in a webcam frame.

Uses OpenCV's YuNet detector (small, fast, handles glasses and some head turn).
Its 230 KB model file is downloaded once into face/models/. If that fails, it
falls back to OpenCV's older Haar cascade, when the installed OpenCV ships one
(OpenCV 4.x does; some 5.x builds do not, which is why requirements pin 4.x).

Speed: detection runs on a copy shrunk to `detect_width` pixels wide (a face
still covers plenty of pixels), then the box is scaled back up.
Accuracy: YuNet also finds the eyes, so `aligned_crop` turns a tilted head
level before the emotion model sees it.
Frames are only ever held in memory.
"""
from __future__ import annotations

import math
import os
import sys
from typing import NamedTuple, Optional, Tuple

import cv2
import numpy as np

YUNET_FILE = "face_detection_yunet_2023mar.onnx"
YUNET_URL = ("https://media.githubusercontent.com/media/opencv/opencv_zoo/"
             "47534e27c9851bb1128ccc0102f1145e27f23f98/models/face_detection_yunet/" + YUNET_FILE)
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")

Box = Tuple[int, int, int, int]  # x, y, width, height


class Face(NamedTuple):
    box: Box
    eyes: Optional[Tuple[Tuple[float, float], Tuple[float, float]]]  # two eye centres, or None
    score: float


def _download(url: str, path: str) -> None:
    from download import download_file
    # under 100 KB would be a Git LFS pointer or an error page, not the model
    download_file(url, path, min_bytes=100_000, what="the YuNet face detector (230 KB)")


class FaceDetector:
    def __init__(self, min_face: int = 60, score: float = 0.8, detect_width: int = 320):
        self.min_face = min_face
        self.detect_width = detect_width
        self.kind = None
        self._size = None
        path = os.path.join(MODELS_DIR, YUNET_FILE)
        try:
            if not os.path.exists(path):
                _download(YUNET_URL, path)
            self.yunet = cv2.FaceDetectorYN.create(path, "", (320, 320), score, 0.3, 5000)
            self.kind = "yunet"
        except Exception as err:  # noqa: BLE001 - fall back, but say why
            print(f"YuNet unavailable ({err}); trying the Haar cascade.", file=sys.stderr)
            haar_dir = getattr(getattr(cv2, "data", None), "haarcascades", "") or ""
            xml = os.path.join(haar_dir, "haarcascade_frontalface_default.xml")
            if not os.path.exists(xml):
                raise RuntimeError(
                    "No face detector available. Put face_detection_yunet_2023mar.onnx in face/models/ "
                    "(download it from the OpenCV Zoo on GitHub) or install opencv-python 4.x.") from err
            self.haar = cv2.CascadeClassifier(xml)
            self.kind = "haar"

    def detect(self, frame_bgr: np.ndarray) -> Optional[Face]:
        """The largest face in the frame, in full-frame pixel coordinates."""
        h, w = frame_bgr.shape[:2]
        scale = min(1.0, self.detect_width / float(w)) if self.detect_width else 1.0
        small = cv2.resize(frame_bgr, (int(w * scale), int(h * scale))) if scale < 1.0 else frame_bgr
        sh, sw = small.shape[:2]
        faces = []
        if self.kind == "yunet":
            if self._size != (sw, sh):
                self.yunet.setInputSize((sw, sh))
                self._size = (sw, sh)
            _, found = self.yunet.detect(small)
            for f in (found if found is not None else []):
                box = tuple(int(round(v / scale)) for v in f[:4])
                eyes = ((f[4] / scale, f[5] / scale), (f[6] / scale, f[7] / scale))
                faces.append(Face(box, eyes, float(f[14])))
        else:
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            min_side = max(10, int(self.min_face * scale))
            found = self.haar.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(min_side, min_side))
            faces = [Face(tuple(int(round(v / scale)) for v in b), None, 1.0) for b in found]
        faces = [f for f in faces if f.box[2] >= self.min_face and f.box[3] >= self.min_face]
        if not faces:
            return None
        return max(faces, key=lambda f: f.box[2] * f.box[3])

    def largest_face(self, frame_bgr: np.ndarray) -> Optional[Box]:
        face = self.detect(frame_bgr)
        return face.box if face else None


def crop_face(frame_bgr: np.ndarray, box: Box, margin: float = 0.1) -> Optional[np.ndarray]:
    """Cut out the face with a small margin, clipped to the frame."""
    h, w = frame_bgr.shape[:2]
    x, y, bw, bh = box
    mx, my = int(bw * margin), int(bh * margin)
    x0, y0 = max(0, x - mx), max(0, y - my)
    x1, y1 = min(w, x + bw + mx), min(h, y + bh + my)
    if x1 - x0 < 20 or y1 - y0 < 20:
        return None
    return frame_bgr[y0:y1, x0:x1]


def eye_angle(eyes) -> float:
    """Head tilt in degrees from the two eye centres (positive: the eye on the image's right is lower)."""
    (ax, ay), (bx, by) = sorted(eyes)  # sort by x so detector eye order does not matter
    return math.degrees(math.atan2(by - ay, bx - ax))


def aligned_crop(frame_bgr: np.ndarray, face: Face, margin: float = 0.1,
                 min_angle: float = 3.0, max_angle: float = 35.0) -> Optional[np.ndarray]:
    """Crop the face; if the head is tilted, rotate it level first (only the area around the face)."""
    if face.eyes is None:
        return crop_face(frame_bgr, face.box, margin)
    angle = eye_angle(face.eyes)
    if abs(angle) < min_angle or abs(angle) > max_angle:
        return crop_face(frame_bgr, face.box, margin)
    h, w = frame_bgr.shape[:2]
    x, y, bw, bh = face.box
    cx, cy = x + bw / 2.0, y + bh / 2.0
    pad = int(max(bw, bh) * 0.8)
    x0, y0 = max(0, int(cx - pad)), max(0, int(cy - pad))
    x1, y1 = min(w, int(cx + pad)), min(h, int(cy + pad))
    patch = frame_bgr[y0:y1, x0:x1]
    if patch.size == 0:
        return None
    m = cv2.getRotationMatrix2D((cx - x0, cy - y0), angle, 1.0)
    level = cv2.warpAffine(patch, m, (patch.shape[1], patch.shape[0]),
                           flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return crop_face(level, (x - x0, y - y0, bw, bh), margin)

"""R2: one face crop in, probabilities over the seven contract emotions out.

Two backends:
- "hsemotion" (default): HSEmotion EfficientNet-B0 models exported to ONNX
  (Open Neural Network Exchange). About 16 MB, runs on a laptop CPU (central
  processing unit) in a few tens of milliseconds, trained on AffectNet. The
  default "enet_b0_8_va_mtl" also predicts valence (pleasant vs unpleasant).
  We run the .onnx file ourselves (no hsemotion-onnx code at run time).
- "deepface": DeepFace's small emotion network trained on FER-2013. Easy, but
  needs TensorFlow (a large install) and is less accurate on real webcams.
Both return (probabilities: dict, valence: float or None).
"""
from __future__ import annotations

import os
from typing import Dict, Optional, Tuple

import cv2
import numpy as np

from mood import EMOTIONS

# HSEmotion has 8 classes; the contract has 7, so contempt is folded into disgust.
HSE_TO_CONTRACT = {
    "Anger": "angry",
    "Contempt": "disgust",
    "Disgust": "disgust",
    "Fear": "fear",
    "Happiness": "happy",
    "Neutral": "neutral",
    "Sadness": "sad",
    "Surprise": "surprise",
}
HSE_8 = ["Anger", "Contempt", "Disgust", "Fear", "Happiness", "Neutral", "Sadness", "Surprise"]
HSE_7 = ["Anger", "Disgust", "Fear", "Happiness", "Neutral", "Sadness", "Surprise"]

Prediction = Tuple[Dict[str, float], Optional[float]]

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
HSE_URL = ("https://github.com/HSE-asavchenko/face-emotion-recognition/blob/main/"
           "models/affectnet_emotions/onnx/{name}.onnx?raw=true")


def model_path(model_name: str) -> str:
    """Local path of an HSEmotion .onnx file, downloading it the first time."""
    name = model_name + ".onnx"
    for folder in (MODELS_DIR, os.path.dirname(MODELS_DIR)):  # face/models/, then face/ itself
        path = os.path.join(folder, name)
        if os.path.exists(path) and os.path.getsize(path) > 1_000_000:
            return path
    path = os.path.join(MODELS_DIR, name)
    from download import download_file
    download_file(HSE_URL.format(name=model_name), path, min_bytes=1_000_000,
                  what=f"the emotion model {model_name} (about 16 MB)")
    return path


class HSEmotionModel:
    """Runs an HSEmotion .onnx file directly with onnxruntime.

    Same preprocessing as the hsemotion-onnx package (RGB, resize to the model's
    input size, ImageNet mean and standard deviation), plus mirror averaging:
    each face is also scored flipped left-right, in the same batch, and the two
    answers are averaged. That steadies the prediction for little extra time.
    """
    name = "hsemotion"
    MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    def __init__(self, model_name: str = "enet_b0_8_va_mtl", session=None, mirror: bool = True,
                 threads: int = 0):
        if session is None:
            import onnxruntime as ort
            opts = ort.SessionOptions()
            if threads:
                opts.intra_op_num_threads = threads
            session = ort.InferenceSession(model_path(model_name), opts, providers=["CPUExecutionProvider"])
        self.session = session
        self.model_name = model_name
        inp = session.get_inputs()[0]
        self.input_name = inp.name
        size = inp.shape[-1] if inp.shape else None
        self.size = size if isinstance(size, int) else (260 if "_b2_" in model_name else 224)
        self.classes = HSE_7 if "_7" in model_name else HSE_8
        self.mirror = mirror

    def _prepare(self, face_rgb: np.ndarray) -> np.ndarray:
        x = cv2.resize(face_rgb, (self.size, self.size)).astype(np.float32) / 255.0
        return ((x - self.MEAN) / self.STD).transpose(2, 0, 1)

    def predict(self, face_bgr: np.ndarray) -> Prediction:
        # The models were trained on RGB images; OpenCV gives BGR.
        rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
        batch = [self._prepare(rgb)]
        if self.mirror:
            batch.append(self._prepare(cv2.flip(rgb, 1)))
        out = self.session.run(None, {self.input_name: np.stack(batch).astype(np.float32)})[0]
        out = np.asarray(out, dtype=np.float64).reshape(len(batch), -1)
        n = len(self.classes)
        logits = out[:, :n]
        e = np.exp(logits - logits.max(axis=1, keepdims=True))
        prob = (e / e.sum(axis=1, keepdims=True)).mean(axis=0)
        # Multi-task ("_mtl") models add valence and arousal after the class scores.
        valence = float(np.clip(out[:, n].mean(), -1.0, 1.0)) if out.shape[1] >= n + 2 else None
        result = {k: 0.0 for k in EMOTIONS}
        for cls, pr in zip(self.classes, prob):
            result[HSE_TO_CONTRACT.get(cls, "neutral")] += float(pr)
        return result, valence


class DeepFaceModel:
    name = "deepface"

    def __init__(self):
        from deepface import DeepFace  # pip install deepface (pulls in TensorFlow)
        self.df = DeepFace

    def predict(self, face_bgr: np.ndarray) -> Prediction:
        r = self.df.analyze(img_path=face_bgr, actions=["emotion"], detector_backend="skip",
                            enforce_detection=False, silent=True)
        if isinstance(r, list):
            r = r[0]
        em = r["emotion"]  # percentages keyed angry, disgust, fear, happy, sad, surprise, neutral
        total = float(sum(em.values())) or 1.0
        return {k: float(em.get(k, 0.0)) / total for k in EMOTIONS}, None


def load_model(backend: str = "hsemotion", model_name: str = "enet_b0_8_va_mtl", mirror: bool = True):
    if backend == "hsemotion":
        return HSEmotionModel(model_name, mirror=mirror)
    if backend == "deepface":
        return DeepFaceModel()
    raise ValueError(f"Unknown backend {backend!r}; use hsemotion or deepface")

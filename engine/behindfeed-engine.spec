# PyInstaller spec for the BehindFeed engine (backend + camera/screen), onedir build.
#   pyinstaller engine/behindfeed-engine.spec --noconfirm      (run from the repo root)
# Output: dist/behindfeed-engine/  -> bundled into the Electron app as resources/engine
# The Gemini key is bundled only if computer_vision/screen/gemini_key.txt exists (CI writes it from a secret).
import os
import sys

from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))
FACE = os.path.join(ROOT, "computer_vision", "face")
SCREEN = os.path.join(ROOT, "computer_vision", "screen")

datas, binaries, hiddenimports = [], [], []
for pkg in ("mediapipe", "onnxruntime", "hsemotion_onnx", "google.genai", "certifi", "truststore"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# Models: the face code looks for them in <its folder>/models, which is the bundle root when frozen.
for name in os.listdir(os.path.join(FACE, "models")):
    if name.endswith((".onnx", ".task")):
        datas.append((os.path.join(FACE, "models", name), "models"))
if not any(n.startswith("enet_") for n in os.listdir(os.path.join(FACE, "models"))):
    raise SystemExit("emotion model missing: run  python -c \"from emotion_model import model_path; "
                     "model_path('enet_b0_8_va_mtl')\"  in computer_vision/face first")

key = os.path.join(SCREEN, "gemini_key.txt")
if os.path.exists(key):
    datas.append((key, "."))

hiddenimports += collect_submodules("uvicorn") + collect_submodules("app")
hiddenimports += [
    # face (imported lazily inside functions)
    "face_monitor", "detector", "emotion_model", "landmarks", "platforms", "events", "mood", "download",
    # screen: face_monitor imports screen.label, which imports these as top-level modules
    "screen", "screen.label", "screen.capture", "screen.gemini_labeler", "capture", "label", "gemini_labeler",
    "mss",
]
if sys.platform == "darwin":
    hiddenimports += ["Quartz", "AppKit"]
elif os.name == "nt":
    d, b, h = collect_all("pywinctl")
    datas += d
    binaries += b
    hiddenimports += h

a = Analysis(
    [os.path.join(SPECPATH, "engine.py")],
    pathex=[os.path.join(ROOT, "backend"), FACE, SCREEN, os.path.join(ROOT, "computer_vision")],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["tkinter", "pytest", "deepface", "tensorflow", "torch"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="behindfeed-engine",
    console=True,  # no window of its own: Electron starts it hidden and reads its output
    upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="behindfeed-engine", upx=False)

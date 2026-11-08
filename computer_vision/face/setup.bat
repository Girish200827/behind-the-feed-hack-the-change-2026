@echo off
setlocal
cd /d "%~dp0"
set PYTHONDONTWRITEBYTECODE=1
set "VENV=%USERPROFILE%\venvs\face"
set "PY=%VENV%\Scripts\python.exe"

echo ==== Scroll Mood: face setup ====
echo This takes 2 to 5 minutes. Leave the window open.
echo.

where py >nul 2>nul
if errorlevel 1 goto nopython

if exist "%PY%" goto haveenv
echo [1/6] Creating the Python environment in %VENV%
py -3.12 -m venv "%VENV%" 2>nul
if not exist "%PY%" py -3.11 -m venv "%VENV%" 2>nul
if not exist "%PY%" py -3.13 -m venv "%VENV%" 2>nul
if not exist "%PY%" py -3 -m venv "%VENV%"
if not exist "%PY%" goto failed
:haveenv
"%PY%" --version

echo.
echo [2/6] Installing libraries
"%PY%" -m pip install --upgrade pip --quiet
"%PY%" -m pip install -r requirements.txt
if errorlevel 1 goto failed

echo.
echo [3/6] Adding the MediaPipe face landmarker, optional
rem --no-deps keeps MediaPipe from installing a second, clashing copy of OpenCV.
"%PY%" -m pip install --no-deps mediapipe
"%PY%" -m pip install "absl-py>=2.3,<3" "flatbuffers>=25.9,<26" matplotlib
"%PY%" -c "from mediapipe.tasks.python import vision; print('MediaPipe OK')"
if errorlevel 1 echo MediaPipe did not install. The app still works without it; paste the error to Claude if you want it.

echo.
echo [4/6] Checking the libraries load
"%PY%" -c "import cv2, numpy, onnxruntime; print('OpenCV', cv2.__version__, '- libraries OK')"
if errorlevel 1 goto failed

echo.
echo [5/6] Getting the models
"%PY%" -c "from emotion_model import model_path; model_path('enet_b0_8_va_mtl'); print('Emotion model ready')"
if errorlevel 1 goto failed
"%PY%" -c "from landmarks import landmarker_path; landmarker_path(); print('Face landmarker model ready')"
if errorlevel 1 echo The face landmarker model is missing. The app still works without it; see the link above.

echo.
echo [6/6] Running the tests
"%PY%" -m pytest -q -p no:cacheprovider
if errorlevel 1 goto failed

echo.
echo ==== Setup finished. Now double-click run.bat ====
pause
exit /b 0

:nopython
echo Python was not found.
echo Install Python 3.12 from https://www.python.org/downloads/
echo During install, tick "Add python.exe to PATH". Then double-click setup.bat again.
pause
exit /b 1

:failed
echo.
echo ==== Setup stopped with an error ====
echo Copy the error text above and paste it to Claude.
pause
exit /b 1

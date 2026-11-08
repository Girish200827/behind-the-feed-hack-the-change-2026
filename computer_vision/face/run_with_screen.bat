@echo off
setlocal
cd /d "%~dp0"
set PYTHONDONTWRITEBYTECODE=1
set "PY=%USERPROFILE%\venvs\face\Scripts\python.exe"
if not exist "%PY%" goto nosetup
echo ==== Face + screen labels ====
echo 1. Relaxed face until "Calibrated".
echo 2. Then click on Instagram and scroll. Each mood_switch is followed by a context_label 1 to 3 seconds later.
echo 3. Press q in the camera window to stop.
echo.
"%PY%" face_monitor.py --preview --screen %*
echo.
"%PY%" summary.py
pause
exit /b 0
:nosetup
echo Run setup.bat first.
pause
exit /b 1

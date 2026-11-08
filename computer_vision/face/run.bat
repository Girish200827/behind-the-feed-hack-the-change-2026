@echo off
setlocal
cd /d "%~dp0"
set PYTHONDONTWRITEBYTECODE=1
set "PY=%USERPROFILE%\venvs\face\Scripts\python.exe"
if not exist "%PY%" goto nosetup

if not "%~1"=="" goto withargs
echo ==== Scroll Mood: face monitor ====
echo 1. Sit in front of the camera with a relaxed face until this window says "Calibrated".
echo 2. Then smile widely and hold it. A mood_switch line should appear in 2 to 3 seconds.
echo 3. Press q in the camera window to stop.
echo.
"%PY%" face_monitor.py --preview
goto done

:withargs
"%PY%" face_monitor.py %*

:done
echo.
"%PY%" summary.py
pause
exit /b 0

:nosetup
echo Run setup.bat first.
pause
exit /b 1

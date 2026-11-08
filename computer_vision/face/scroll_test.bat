@echo off
setlocal
cd /d "%~dp0"
set PYTHONDONTWRITEBYTECODE=1
set "PY=%USERPROFILE%\venvs\face\Scripts\python.exe"
if not exist "%PY%" goto nosetup

echo ==== Scroll test: no camera window ====
echo Open Instagram and scroll normally for 5 minutes.
echo When you are done, come back here and press Ctrl+C, then answer N.
echo.
"%PY%" face_monitor.py --reuse-baseline
echo.
"%PY%" summary.py
pause
exit /b 0

:nosetup
echo Run setup.bat first.
pause
exit /b 1

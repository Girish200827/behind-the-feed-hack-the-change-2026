@echo off
setlocal
cd /d "%~dp0"
set PYTHONDONTWRITEBYTECODE=1
set ELECTRON_RUN_AS_NODE=
set "PY=%USERPROFILE%\venvs\face\Scripts\python.exe"
if not exist "%PY%" goto nosetup
echo ==== Behind the Feed ====
echo Starting the backend, the camera and the dashboard. Close the dashboard window to stop everything.
echo.
"%PY%" launch.py %*
echo.
pause
exit /b 0
:nosetup
echo Run setup_app.bat first.
pause
exit /b 1

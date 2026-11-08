@echo off
rem Start only the backend (Windows): run.bat   The full app: ..\start_app.bat
setlocal
cd /d "%~dp0"
set "PY=%USERPROFILE%\venvs\face\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 %*
pause

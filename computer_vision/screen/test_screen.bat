@echo off
setlocal
cd /d "%~dp0"
set PYTHONDONTWRITEBYTECODE=1
set "PY=%USERPROFILE%\venvs\face\Scripts\python.exe"
if not exist "%PY%" goto nosetup
echo ==== Screen label test ====
echo After you press a key you have 3 seconds to click on your Instagram window.
pause
"%PY%" label.py --test %*
echo.
pause
exit /b 0
:nosetup
echo Run face\setup.bat and then screen\setup_screen.bat first.
pause
exit /b 1

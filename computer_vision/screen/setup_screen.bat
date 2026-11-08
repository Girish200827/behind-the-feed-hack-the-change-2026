@echo off
setlocal
cd /d "%~dp0"
set PYTHONDONTWRITEBYTECODE=1
set "PY=%USERPROFILE%\venvs\face\Scripts\python.exe"
set "KEYFILE=%~dp0gemini_key.txt"
if not exist "%PY%" goto noface

echo ==== Screen labels: setup ====
echo.
echo [1/3] Installing mss and google-genai into the face environment
"%PY%" -m pip install -r requirements.txt
if errorlevel 1 goto failed

echo.
echo [2/3] Gemini API key
if defined GEMINI_API_KEY goto havekey
if exist "%KEYFILE%" goto havekey
echo Get a free key: open https://aistudio.google.com/apikey , sign in, click "Create API key".
set /p KEY=Paste the key here and press Enter: 
if not defined KEY goto nokey
>"%KEYFILE%" echo %KEY%
echo Saved to screen\gemini_key.txt. Never commit or share this file.
goto tests
:havekey
echo Key found.
goto tests
:nokey
echo No key entered. You can still test with --backend fake; run this again to add a key.

:tests
echo.
echo [3/3] Running the tests
"%PY%" -m pytest -q -p no:cacheprovider
if errorlevel 1 goto failed
echo.
echo ==== Done. Next: double-click test_screen.bat ====
pause
exit /b 0

:noface
echo Run face\setup.bat first; this uses the same Python environment.
pause
exit /b 1

:failed
echo.
echo ==== Setup stopped with an error ====
echo Copy the error text above and paste it to Claude.
pause
exit /b 1

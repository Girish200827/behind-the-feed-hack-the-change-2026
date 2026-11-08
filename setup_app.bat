@echo off
setlocal
cd /d "%~dp0"
set PYTHONDONTWRITEBYTECODE=1
set "VENV=%USERPROFILE%\venvs\face"
set "PY=%VENV%\Scripts\python.exe"
set "LOCK=%~dp0.setup-running"

echo ==== Behind the Feed: one-time setup ====
rem Only one setup at a time: two npm installs in the same folder break each other.
mkdir "%LOCK%" 2>nul
if errorlevel 1 goto locked
:begin
echo This installs everything for the backend, the camera and the dashboard.
echo The first time it downloads about 500 MB, so it can take 5 to 15 minutes.
echo Keep this window open until it says "Setup finished". Do not start a second
echo setup or start_app.bat until then.
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
echo [1/6] Python environment: %VENV%
"%PY%" --version

echo.
echo [2/6] Backend libraries
"%PY%" -m pip install --upgrade pip --quiet
"%PY%" -m pip install -r backend\requirements.txt
if errorlevel 1 goto failed

echo.
echo [3/6] Camera and screen libraries
"%PY%" -m pip install -r computer_vision\face\requirements.txt
if errorlevel 1 goto failed
rem --no-deps keeps MediaPipe from installing a second, clashing copy of OpenCV.
"%PY%" -m pip install --no-deps mediapipe
"%PY%" -m pip install "absl-py>=2.3,<3" "flatbuffers>=25.9,<26" matplotlib
"%PY%" -m pip install -r computer_vision\screen\requirements.txt
if errorlevel 1 goto failed

echo.
echo [4/6] Models
pushd computer_vision\face
"%PY%" -c "from emotion_model import model_path; model_path('enet_b0_8_va_mtl'); print('Emotion model ready')"
if errorlevel 1 goto failedpop
"%PY%" -c "from landmarks import landmarker_path; landmarker_path(); print('Face landmarker ready')"
popd

echo.
echo [5/6] Gemini key for screen labels
if exist computer_vision\screen\gemini_key.txt goto keyok
if defined GEMINI_API_KEY goto keyok
echo No key yet. Get a free one at https://aistudio.google.com/apikey and paste it here,
set /p KEY=or just press Enter to skip screen labels for now:
if not defined KEY goto keyskip
>computer_vision\screen\gemini_key.txt echo %KEY%
echo Saved to computer_vision\screen\gemini_key.txt, which Git ignores.
goto dashboard
:keyok
echo Key found.
goto dashboard
:keyskip
echo Skipped. The app runs without screen labels until you add a key.

:dashboard
echo.
echo [6/6] Dashboard libraries: Electron and React
where npm >nul 2>nul
if errorlevel 1 goto nonode
pushd frontend
rem npm writes node_modules\.package-lock.json only when an install finishes.
if not exist node_modules\.package-lock.json goto cleaninstall
if not exist node_modules\electron\path.txt goto cleaninstall
echo Already installed; checking for updates...
call npm install --no-audit --no-fund
if errorlevel 1 goto npmfailed
goto electron

:cleaninstall
if exist node_modules echo An earlier install did not finish. Removing it and installing again...
rem npm ci removes node_modules first and installs exactly what package-lock.json lists.
call npm ci --no-audit --no-fund
if errorlevel 1 goto tryinstall
goto electron
:tryinstall
echo npm ci did not work. Trying npm install instead...
call npm install --no-audit --no-fund
if errorlevel 1 goto npmfailed

:electron
if exist node_modules\electron\path.txt goto dashok
echo Downloading the Electron program (about 120 MB)...
node node_modules\electron\install.js
if not exist node_modules\electron\path.txt goto electronfailed
:dashok
popd

echo.
echo Checking the installation...
"%PY%" launch.py --check
if errorlevel 1 goto failed
rmdir "%LOCK%" 2>nul
echo.
echo ==== Setup finished. Now double-click start_app.bat ====
pause
exit /b 0

:locked
echo.
echo Another setup window seems to be running already. Two at once break the install.
echo If you closed an earlier setup window before it finished, it is safe to continue.
choice /c YN /n /m "Continue anyway? Press Y or N: "
if errorlevel 2 exit /b 1
echo.
goto begin

:nopython
echo Python was not found. Install Python 3.12 from https://www.python.org/downloads/
echo During install, tick "Add python.exe to PATH". Then run setup_app.bat again.
goto stop

:nonode
echo Node.js was not found. Install the LTS version from https://nodejs.org , then run setup_app.bat again.
goto stop

:npmfailed
popd
echo.
echo ==== The dashboard install failed ====
echo Usual causes, and what to do:
echo  - Another setup window, start_app.bat or VS Code was using the frontend folder: close them all.
echo  - The internet connection dropped: try again, or use a phone hotspot.
echo Then run setup_app.bat again. It removes the half-finished install by itself.
goto stop

:electronfailed
popd
echo.
echo ==== The Electron program did not download ====
echo Check the internet connection, then run setup_app.bat again.
goto stop

:failedpop
popd
:failed
echo.
echo ==== Setup stopped with an error ====
echo Copy the error text above and paste it to Claude.
:stop
rmdir "%LOCK%" 2>nul
pause
exit /b 1

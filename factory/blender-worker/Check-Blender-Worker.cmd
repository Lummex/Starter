@echo off
title Oreheart Blender Worker check
set "APPD=%LOCALAPPDATA%\OreheartBlenderWorker"
set /p BL=<"%APPD%\blender-path.txt"
"%BL%" --background --factory-startup --python-exit-code 1 --python "%APPD%\app\worker.py" -- --check
type "%APPD%\last-check.json"
pause

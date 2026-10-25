@echo off
title Oreheart Blender Worker check
set /p PY=<"%LOCALAPPDATA%\OreheartBlenderWorker\python-path.txt"
"%PY%" "%LOCALAPPDATA%\OreheartBlenderWorker\app\worker.py" --check
pause

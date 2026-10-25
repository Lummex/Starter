@echo off
title Oreheart Blender Worker
set /p PY=<"%LOCALAPPDATA%\OreheartBlenderWorker\python-path.txt"
if exist "%LOCALAPPDATA%\OreheartBlenderWorker\STOP" del "%LOCALAPPDATA%\OreheartBlenderWorker\STOP"
"%PY%" "%LOCALAPPDATA%\OreheartBlenderWorker\app\worker.py"
echo.
echo The worker has stopped.
timeout /t 15

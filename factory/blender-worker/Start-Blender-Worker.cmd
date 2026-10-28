@echo off
title Oreheart Blender Worker
set "APPD=%LOCALAPPDATA%\OreheartBlenderWorker"
set /p BL=<"%APPD%\blender-path.txt"
if exist "%APPD%\STOP" del "%APPD%\STOP"
echo Oreheart Blender Worker is running. Log: %APPD%\worker.log
"%BL%" --background --factory-startup --python-exit-code 1 --python "%APPD%\app\worker.py"
echo.
echo The worker has stopped.
timeout /t 15

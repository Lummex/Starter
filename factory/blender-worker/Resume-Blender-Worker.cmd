@echo off
if exist "%LOCALAPPDATA%\OreheartBlenderWorker\PAUSE" del "%LOCALAPPDATA%\OreheartBlenderWorker\PAUSE"
echo Resumed.
timeout /t 5

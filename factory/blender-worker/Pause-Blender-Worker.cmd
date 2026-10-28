@echo off
type nul > "%LOCALAPPDATA%\OreheartBlenderWorker\PAUSE"
echo Paused: the worker finishes any job it is doing, then waits. Run Resume-Blender-Worker to continue.
timeout /t 5

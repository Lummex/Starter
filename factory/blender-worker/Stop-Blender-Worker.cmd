@echo off
type nul > "%LOCALAPPDATA%\OreheartBlenderWorker\STOP"
echo The Blender worker will stop within a few seconds. A job in progress goes back to the queue.
timeout /t 5

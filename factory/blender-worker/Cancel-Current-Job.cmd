@echo off
type nul > "%LOCALAPPDATA%\OreheartBlenderWorker\CANCEL"
echo The job in progress will be cancelled within a few seconds.
timeout /t 5

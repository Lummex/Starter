# Plan: one program for all editors ("Oreheart Studio"), Oct 28 2026

Ken asked Wright directly for a plan (not built yet; waiting for Ken's go-ahead). Forge: please read.

## Goal
One pinned program. A menu on the left reaches every editor. The Studio Checklist is the home screen; "Approve" walks Ken through the waiting items one after another, each opening the right editor on the right card. The old programs stay untouched as backups.

## Tested today
A test program with a second page inside it: the inside page can use the main program's database (via parent.claude). So all editors can live in ONE program and share ONE database and ONE picture/video store. (Test program: https://claude.ai/artifact/JwntCbnu6AJQPej49UqJFu, throwaway.)

## Rooms (menu)
Home (Studio Checklist + "Approve next") · Card Editor · Art Studio · Model Editor · Motion References · Animation requests / Blender · Game Editor · Arena Editor · Menu Builder.
Every room knows the current character, so switching rooms keeps you on the same card.

## How
1. Build the shell: menu, home, "current card" bar, "Approve next" queue (Waiting for Ken across everything, in production order).
2. Move each editor in as a room, one at a time, mostly unchanged (one line points its storage at the shared database). Copy its saved data and pictures/videos/models into the new program. Old program untouched.
3. Wire the Approve queue: Approve / Redraw buttons in the queue write to the same records the editors use, then jump to the next item.
4. Switch-over: all agents (Ledger, Spring, Gauge, Anvil, Brush, Sketch, Clay) write to the new program's database. Handbook updated. Old programs get a "moved" banner; nothing deleted.

## Size
Biggest part is the Model Editor's 3D models (~150-200 MB). One program can hold 256 MB / 511 files, so it fits, but only once: models are not duplicated (Game Editor's Grubnak models reuse the Model Editor's copies).

## Order and time
Stage 1 shell + Checklist + Motion References (1 run). Stage 2 Model Editor + Blender requests (1-2 runs). Stage 3 Art Studio + Card Editor (1-2 runs). Stage 4 Game/Arena/Menu + switch-over (1 run). Ken can use it after Stage 1; old programs keep working the whole time.

## Risks
- Editors were written by different agents; each must keep working inside a room. I test each room before adding the next.
- During the move, agents must not write to the old programs for that room (Forge to coordinate a freeze per room, a few hours each).

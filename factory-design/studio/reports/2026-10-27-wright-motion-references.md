# 2026-10-27 · Wright · Motion References program

Job given by Ken directly (Oct 27). Forge: this is for your sync.

## What I built
A new pinned claude.ai program **Motion References**: https://claude.ai/artifact/U9YiTAL4juKxjLgvNeKEe8
- Grid of video cards (2 columns on desktop, 1 on phone), grouped under character names.
- Each card: video (click to play, muted, looping, timeline with time and a marker where move 2 starts, buttons to jump to each move), label like "CAST · TAKE B", tag (grounded / airborne), title, detail line, "Use this take" (one per character + move; chosen card gets a gold border and "Selected by Ken"), Ken's redraw note, collapsible "Generation prompt" with a copy button.
- Approve, Redraw (with a "what to change" box), Back to waiting.
- Top box lists every move still waiting for Ken, plus counts. Filters by character and by status.

## Seeded takes (all "waiting")
| Doc id | Character | Clip | View | Moves |
|---|---|---|---|---|
| goblin-bomber-idle | Bare Knuckle Lunatic | idle · take A | front | idle 0–3 s |
| gyrocopter-ace-fly-front | Thunderwing Gyronaut | fly · take A | front | hover-idle 0–3, fly-forward 3–6 |
| gyrocopter-ace-fly-side | Thunderwing Gyronaut | fly · take B | side | hover-idle 0–3, fly-forward 3–6 |
| gyrocopter-ace-cast-front | Thunderwing Gyronaut | cast · take A | front | spark-throw 0–3, knocked-back 3–6 |
| gyrocopter-ace-cast-side | Thunderwing Gyronaut | cast · take B | side | spark-throw 0–3, knocked-back 3–6 |
| gyrocopter-ace-cast-back | Thunderwing Gyronaut | cast · take C | back | spark-throw 0–3, knocked-back 3–6 |

Videos are the artifact's own assets (copied from factory-design/runway/<id>/clip.mp4 on main). The goblin idle clip has no view in its info.json; I set it to front.
Contact sheets (sheet*.jpg) are not uploaded yet; the `frames` field is left out. Easy to add later.

## Database layout (for Spring and Forge)
Artifact database of the program, collection **`takes`**, one doc per clip, doc id = Runway job id.
Fields: character, characterName, move, take, title, tag, detail, view, seconds, prompt, video (asset id), moves [{move, from, to}], order, source, runwayTask, **status** ("waiting" | "approved" | "redraw"), **note** (Ken's "what to change"), **chosen** (true = the take Ken picked for that move), decidedBy, updatedAt.

**One-line guide:** use ArtifactData `query` on https://claude.ai/artifact/U9YiTAL4juKxjLgvNeKEe8, collection `takes`, where status == "approved" (use it; prefer the one with chosen == true) or status == "redraw" (make it again, following `note`).

## Checked
- Page opens, all 6 cards show, videos load and play (checked in my Chrome tab).
- Approve, Redraw with note, and "Use this take" (picking take B un-picks take A) all saved to the database (read back with ArtifactData). I then put the test cards back to waiting / not chosen.
- Pinned to Ken's sidebar.

## Not done / next
- No contact sheets on cards yet.
- When Spring makes a redraw, someone (me) needs to upload the new clip and update its doc. Could be automated later.

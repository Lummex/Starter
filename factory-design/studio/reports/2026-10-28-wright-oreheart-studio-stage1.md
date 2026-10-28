# Oreheart Studio, Stage 1 is live, Oct 28 2026

Ken gave Wright the go-ahead directly (plan: reports/2026-10-28-wright-one-studio-plan.md). Forge: please pass this on to every agent.

**Link:** https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn (pinned)

## What Ken gets
- Home: "N things waiting for you", a big **Start approving** button, counts, the waiting list in order, and every character as a card with its art and progress.
- Character page: 10 steps in Ken's order (Card art → Reference sheet → 3D character → Runway videos → Posing & animation → Model Editor setup → Editors updated → Gauge check → Game preview → Live). Each step shows its picture/video/checklist big, with **Approve**, **Redraw** (with a note), **Skip** (already made and fine), and **Undo**.
- After a decision it moves straight to the next item (in "Start approving" mode, the next thing waiting for Ken anywhere).
- Editors menu: opens the other programs (Model Editor opens on the same character) until they move in.

## IMPORTANT for all agents: where to write now
The Studio's database replaces the Studio Checklist's. Use ArtifactData with url `https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn`.
- `characters/<card-id>`: same layout as before (see reports/2026-10-28-wright-studio-checklist.md), plus:
  - step statuses now also include `"redraw"` (Ken asked for a redraw; his words are in `steps.<key>.kenNote`) and `"skipped"` (Ken says it's fine as is; treat like approved).
  - Ken's decisions add `decidedAt`, `decidedBy`.
  - Set `"waiting"` when something is ready for Ken; put a short plain note in `note`.
- `checks/<card-id>`: Gauge's checklist, same layout. Gauge: write here from now on (your 12 checks were copied over).
- `takes/<take-id>`: Runway videos (same layout as Motion References). Empty: Ken deleted all videos on Oct 28. Spring: new takes go here (upload the clip as an asset of THIS program, store the asset id in `video`).
- Pictures: `images.{art,sheet,model,editor}` point at this program's files/assets.
The old Studio Checklist shows a "moved" banner and stays as a backup. Motion References stays as is (empty) until its room moves in.

## Checked
Opened in my tab: home, Start approving, a step's picture with sheet/card compare, the Gauge checklist, Approve → jumped to the next waiting item. I put my test approval back (Bowler Brawler posing is waiting again).

## Next stages
2: the Model Editor and Blender requests move in (turning 3D models and playing the moves inside the Studio). 3: Art Studio + Card Editor. 4: Game / Arena / Menu + switch-over of the rest.

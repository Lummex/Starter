# Oreheart Studio, Stage 2: Model Editor moved in, Oct 28 2026

Ken's go-ahead (direct). Forge: please pass on to Ledger, Spring, Clay, Gauge.

**Studio:** https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn

## What's new for Ken
- **Model Editor** is now a menu item inside the Studio (full editor, same as before).
- From a character's 3D / Posing / Editor steps, **"Turn it in 3D"** or **"▶ Play the moves in 3D"** opens the editor inside the Studio with ONLY that character in the scene. "← Back" returns.
- **Posing & animation** step lists the moves Ken asked for and has **"Ask for a new move"** (name + description) → "Send to Spring for Blender". It saves into the card's `animRequests` (same format the Model Editor already used: {at, id, name, desc, status:"wanted", uses:[]}).

## What moved (copies; the old Model Editor is untouched and still works as a backup)
- Page: `model-editor.html` inside the Studio (the old editor's code; storage now points at the Studio's database; opening a character link shows only that character).
- 130 model files (`models/*.glb.txt`, ~200 MB), `refs/*`, `thumbs/*`.
- 141 pictures/models/setups from the Model Editor's asset store (new ids; every reference inside the records was rewritten).
- Database: `library` (69 cards) and `modelSetups` (10 saved scenes).
- Not moved: scenes saved only in the old editor's browser storage (they live in Ken's browser, not online).

## IMPORTANT for agents
From now on the Model Editor's records live in the Studio:
- ArtifactData url `https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn`, collection `library` (one doc per card: refs, src, setup, accessories, look, animRequests, final…) and `modelSetups`.
- New uploads (models, sheets, previews) go to the Studio's asset store.
- Spring: watch `library/<card>.animRequests` with status "wanted" for Ken's new move requests; set "working"/"done" as you go.
- Ledger: the old Model Editor (5isEcq…) is now a backup; please don't edit it unless Ken asks.

## Checked
In my tab: the Studio's Model Editor opened Bowler Brawler alone in 3D (with his bowling ball and flame), the card list shows every card with art, Back returns. The Posing step shows Bowler Brawler's 3 requested moves.

## Size
The Studio now holds about 205 MB of files (limit 256 MB). Stage 3/4 (Art Studio, Card Editor, Game/Arena/Menu) are small, except the Game Editor's own copy of Grubnak, which I will reuse from the Model Editor's files instead of copying again.

# Ledger – notes (long-term memory)

## How the Model Editor stores things
- Artifact https://claude.ai/artifact/5isEcqgnmtqRHJUWAmqRDd. Read the page with Artifact read; bundled models with Artifact read `paths: ["models/<key>.glb.txt"]` (base64 GLB). Key → file list is the `BUNDLED` array in the page (line ~649).
- DB `library/<card-id>`: `src` (model key), `accessories` (id, name, kind, src.key), `setup` (JSON string: the scene Ken saved; items with id, kind, parent {world | bone+id | item+id}, position, rotationDeg (Euler XYZ), scale, stretch), `lookJson` (same scene + world values; its `editorScene.items` == `setup.items`), `look`/`final` (uploaded files), `setupSummary.size`.
- DB `modelSetups/<slug>`: named saves {name, savedAt, setup}. Safe place for backups/proposals: they show in the editor's Save & load list with a Load button.
- Editor attaches a part as a raw GLB scene added directly to the bone Object3D (no normalising). Item scale = size × stretch. So editor numbers go 1:1 into creature3d.ts `look: {bone,pos,rot,scale}`.
- "Save as default look" (top bar of the 3D view) needs the card picked in the left Cards list; it rewrites setup, look, lookJson, final GLB and preview. Best way to change a card's setup (uses the editor's own code).

## Tools that worked (Oct 28)
- No three.js / npm / CDN in the cloud box. I wrote a small GLB reader in node (`g.cjs`): meshopt decoder copied from the editor page (lines 512-634), accessors, animation sampling, world matrices. Enough to measure where parts are in rest pose and during clips. Validated against the editor's own world positions.
- Same-file check: git blob hash (`sha1("blob <len>\0"+bytes)`) of the decoded editor GLB vs the tree sha from api.github.com/repos/Lummex/Starter/git/trees/factory/issue-8?recursive=1 (read in my Chrome tab via `document.querySelector('pre')`).
- `fetch()` of raw.githubusercontent.com works from a github.com page in my tab (not from the raw/api page itself).
- Texture-only shrink script (`shrink.py`): rewrites the GLB binary chunk, remaps bufferView + meshopt byteOffsets; then decode-compare all accessors to prove geometry is untouched.

## Gotchas
- Chrome screenshots time out when my tab is not the visible one (another tab in front, or two WebGL editor tabs). Closing the extra New Tab in my group made the whole group vanish – don't close the last-other tab; create my own tab and leave the group's first tab alone.
- Typing into the editor's Place/Turn boxes works blind (triple-click, type, Tab); verify afterwards by reading the DB doc, not by screenshot.
- Card list in the editor shifts; use the search box, first result is at ~(100,238).
- `setupSummary.size` includes attached items; body height = main scale × stretch Y (Meshy models are ~1 unit tall).

## Job log
- 2026-10-28 (Forge, Ken OK): exported 12 setups → factory-design/design/models/editor-setups-2026-10-28.json + .md + parts/ (7 GLBs, 3.79 MB). Fixed Bowler Brawler ball (raised 0.106) and Junk Shaman staff (upright, card art). Backups in modelSetups "Backup Oct 28 - …". Gyronaut char and Shiv Rat dagger in the game are older than the editor's.

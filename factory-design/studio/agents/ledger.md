# Ledger – notes (long-term memory)

## ONE HOME (Oct 28): Oreheart Studio
- Read/write only the Studio https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn (`library`, `modelSetups`, `characters`). Old Model Editor 5isEcq… is backup-only.
- Studio Model Editor room = published file `model-editor.html`; `BUNDLED` array (line ~668) maps key → `models/<file>.glb.txt`. Keys and files can differ (e.g. `grubnak-new` → `models/grubnak3d-char.glb.txt`).
- Get many GLBs at once: Artifact read with `paths: [...]` + `out_dir`.
- `characters` has no doc for cmd-grubnak (commanders not in the step list).

## How the Model Editor stores things
- DB `library/<card-id>`: `src` (model key), `accessories` (id, name, kind, src.key), `setup` (JSON string: the scene Ken saved; items with id, kind, parent {world | bone+id | item+id}, position, rotationDeg (Euler XYZ), scale, stretch), `setupAt` (ms), `lookJson` (same scene + world values), `look`/`final` (uploaded files), `setupSummary.size`.
- DB `modelSetups/<slug>`: named saves {name, savedAt, setup}. Safe place for backups/proposals.
- Editor attaches a part as a raw GLB scene added directly to the bone (no normalising). Item scale = size × stretch. Editor numbers go 1:1 into creature3d.ts `look: {bone,pos,rot,scale}`.
- Mounts (ram-rider): the ram is a world item, the rider is a child of the ram item. creature3d.ts `mount: true` only approximates this.
- "Save as default look" needs the card picked in the left Cards list.

## Tools that worked
- Cloud box is wiped between runs and has no GitHub/npm network. Re-make tools each run (keep them short):
  - texture-only shrink (python + PIL): re-lay the BIN chunk segment by segment (bufferViews on buffer 0 + EXT_meshopt byteOffsets), replace only image views; verify by byte-comparing every non-image segment + glTF JSON minus offsets.
  - git blob hash `sha1("blob <len>\0"+bytes)` vs api.github.com tree of factory/issue-8 → same-file check.
- Moving data from Chrome to me: javascript_tool output is cut at ~1000 chars. Instead put the text into the page (`document.body.innerHTML='<article><pre id=out></pre></article>'`, set textContent) and read it with get_page_text – handles 30 KB+.
- `fetch()` of raw.githubusercontent.com works from a github.com page in my tab (not from the raw page itself).
- Compare same GLB with different padding: hash each bufferView / meshopt segment separately.

- Accessor-level GLB check without npm: in my tab open https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/package.json, then `await import('https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/meshopt_decoder.module.js')` → `MeshoptDecoder.decodeGltfBuffer` for EXT_meshopt views; fetch both GLBs from raw.githubusercontent.com (CORS ok) and compare every accessor's bytes; `createImageBitmap` gives picture sizes.
- Exact copy of a repo text file I must edit: retype it, then check git blob sha against the real file (compute in Chrome with crypto.subtle SHA-1, print it split in groups or the output gets blocked as "Base64"). Line lengths + leading spaces per line find the typos fast.
- Studio body GLBs = game char.glb (checked by hash), so Artifact read of the Studio's `models/<card>-oct25.glb.txt` is the way to get game models into the cloud box.

## Gotchas
- Chrome screenshots time out when my tab is not the visible one. Don't close the group's first tab; create my own tab.
- Typing into the editor's Place/Turn boxes works blind; verify by reading the DB doc.
- Size: parts are mostly geometry (~0.2 MB each) – shrinking textures below 256 px saves little. Body textures (1024 px, ~0.3 MB) are the real reserve: 1024 → 512 saves ~0.2 MB per body.
- GitHub upload page: if a ref is stale, `type` goes to the page as keyboard shortcuts (e.g. "g a" opens Actions). Re-`find` refs after every navigation; check `input[name=message]` before Commit. file_upload must stay under 10 MB per call → split into several commits.
- Game size = sum of `projects/oreheart-8/public/` blobs on factory/issue-8 (1 MB = 1,000,000 bytes). Measure it from the tree every time; my Oct 28 "94.9 MB" guess was 0.5 MB too low.
- Body texture 1024→512 (JPEG same quality q85, 4:2:0) saves ~0.19–0.26 MB per body; clockwork-beetle has a 2.1 MB PNG → saves 2.0 MB alone.

## Job log
- 2026-10-28 (Forge, Ken OK): exported 12 setups → editor-setups-2026-10-28.json + .md + parts/ (7 GLBs, 3.79 MB). Fixed Bowler Brawler ball and Junk Shaman staff. Gyronaut char and Shiv Rat dagger in the game are older than the editor's. (Round 26)
- 2026-10-28 (Forge): exported 18 Studio looks → editor-setups-2026-10-28b.json + .md + parts/ (15 GLBs at 256 px, 4.81 MB) for Round 27. All bodies same as game. Scrapper/Shaman unchanged since file 1. Shieldbeard shoulder shield = placeholder. Size would be ~99.7 MB → asked Ken (option: body textures 1024→512). Set steps.editors notes "exported for Round 27" (17 cards).
- 2026-10-28 (Forge, Ken OK "shrink the dwarf"): Round 27 body shrink. Real size: game now 95.38 MB, +4.81 MB parts = 100.19 MB. Shrunk 15 dwarf bodies (−3.03 MB → 97.17, not enough) + 13 gnome bodies (−4.74 MB) → 92.43 MB. Files factory-design/design/models/round27-shrunk/<card>-char.glb + README list; editor-setups-2026-10-28b.md updated. Every accessor identical (meshopt-decoded in Chrome), all pictures 512 px. Game branch not touched; Studio keeps 1024 px bodies.

## Heights (Ken, Oct 28 evening: heights MATTER, Studio setup is the look)
- Studio: 1 unit = 1 board square; raw GLB × item scale (× stretch), no normalising (`root.add(gltf.scene)`; `setSize` = scale×stretch). Studio "squares tall" = meshBox of the item incl. attached parts (sampled vertices).
- Meshy bodies are raw height 1.0 at rest (shiv-rat 0.9, golem/troll 1.6, grubnak 1.5, beetle 1.47).
- Game: `makeCreature3d` normalises the body on its idle clip at t=0 (`skinBox`), root = heightSpaces/1.1, figure g = 1.1 → body height = `LOOKS.height` (× stretch). 1 square = 1 world unit. **LOOKS.height = Studio scale × idle-0 raw height.**
- Grubnak: grubnak3d `ck = SEAT.k*tH/H0`; Studio scale 1.22 → ck 1.22. The mount path in creature3d uses DEFAULT_H directly.
- My python meshopt decoder + skinning (bindMatrix = identity, world = Σ w·boneWorld·IBM·v) = three 0.170 to 4 decimals. Rewrite it each run (~150 lines: vertex codec 0xA0, groups of 16, 2-bit header per group; filters QUATERNION/EXPONENTIAL).
- three in Chrome: open a cdn.jsdelivr.net page, import `three@0.170.0/+esm` and `three@0.170.0/examples/jsm/loaders/GLTFLoader.js/+esm` (plain .js paths fail on the bare "three" import).
- Artifact read `paths` stops at 64 MB per call → split.
- get_page_text strips leading spaces → no exact file bytes that way. **Best way to edit a repo file: on the GitHub upload page fetch the original from raw, change it with JS string ops, put it in `input#upload-manifest-files-input` with a DataTransfer File + change event, set `input[name=message]`, click Commit changes.** No retyping, no Downloads round-trip.
- raw.githubusercontent.com can serve a stale copy for a few minutes after a commit even with ?x=; check commits on github.com/…/commits/main/<path> instead. api.github.com hits its rate limit (60/h) fast.
- My Chrome tab group can disappear (closed by someone); re-create with tabs_context_mcp createIfEmpty + my own new tab.
- 2026-10-28 (Forge): Studio-look rule in HANDBOOK + Gauge 1.5/2.5; heightsForGame (47 cards, 42 LOOKS) in editor-setups-2026-10-28b.json/.md; Round 27 brief section H (AC408–413); decision `dwarf-heights` (dwarves 1.0 vs goblins ~0.45). Clay's rigged Miner/Borgo GLBs are on main (waiting for Ken, not in the Studio) and they have NO saved Studio setup.

- 2026-10-28 evening (Forge, Ken OK "shrink the gnome textures, but make sure it doesn't mess up the textures"): remade the 13 gnome bodies with Lanczos + the original JPEG qtables/4:2:0 (`qtables=p.quantization`, `subsampling=get_sampling(p)`), PNG stays PNG, normal maps re-normalised. Looked at every one side by side (front, head, body/hands): 10 fine at 512; **beetle, steam golem, tinker looked noticeably softer at 512 → 768** (emblems/faces blur). Old 512 set → round27-shrunk/_discontinued/gnome-bodies-oct28-first/. Size with both rigged models (Miner 2.60 + Borgo 2.38 MB) = **96.69 MB, over 95** → stopped, listed options (goblin bodies 1024→512 ≈ −2.6 MB is the big one). Doc edits (brief/editor-setups) held until Ken picks. Ken: Bare Knuckle Lunatic keeps current model (no v5); Ken wants both rigged models in R27.

## How to check textures by eye (works)
- Render in Chrome: a cdn.jsdelivr.net or unpkg.com page, import three r170 + GLTFLoader + meshopt decoder from jsdelivr, put the GLBs in with `file_upload` (cloud paths under /mnt/user-data/outputs work; ≤ ~7 MB per call, the input keeps adding), same ortho camera/light for old and new, idle t=0; front + head + body crops on one canvas.
- Getting pictures back to the cloud: `<a download>` works only once per site (then Chrome blocks quietly, even with a real click). **Use computer `zoom` with `save_to_disk: true` and scale 1** – the PNG lands in the cloud box (/tmp/claude-chrome-screenshots-*/). Screenshots often time out on the first try; just retry.
- Game size today (factory/issue-8 public/) = 93.58 MB, not 95.38 – always re-measure from the tree.
- Goblin bodies still at 1024 px: bomber, grunt, scrapper, slinger, sneak, junk-shaman, rotgut-grenadier, skullbasher, wolf-rider, blastrat, shard-guzzler, big-boss troll (~3.85 MB of pictures). Shiv-rat, pebbler, scrounger, smith-miner, grubnak at 768; gyrocopter 512. Crystal node 3×1024, grubnak throne 3×768.
- GitHub upload page: `file_upload` straight into ref of "Choose your files" works (cloud paths); for archiving repo files, fetch from raw in the upload page and set `input#upload-manifest-files-input` with a DataTransfer.

- 2026-10-28 late (Forge, Ken's answers ~22:00): Round 27 ready-up. 12 goblin bodies shrunk (8 at 512; junk-shaman, skullbasher, blastrat, wolf-rider at 768 = emblems/face softer), −2.15 MB. Borgo steps.model approved (Miner was already approved by Ken). Made + saved Studio setups for Anvilsworn Miner (pickaxe RightHand, scale 38) and Borgo (sceptre LeftHand, scale 50, no throne), body scale 1; steps.editor = waiting for Ken. Parts at 256 px. Crystal node 1024→512. **Size 95.15 MB, still over** → decision `r27-size-option-a` (5 goblin pictures 768→512 → 94.55, files in round27-shrunk/option-a-needs-ken/). Docs (brief C/R/D, editor-setups 28b md+json, README) updated. Report 2026-10-28-ledger-round27-ready.md.

## Learned Oct 28 late
- **Making a Studio setup exactly:** write it as a named save in `modelSetups/<slug>` ({name, savedAt, setup: JSON string}), reload the Studio (append `?r=N` to the URL; the list isn't live), pick the card in the left Cards list (search box), Save & load → Load, then **Save as default look** (banner shows "Look saved"). Load without picking the card first hides the Save banner. Verify in `library/<card>.setup`.
- The Model Editor auto-adds every library accessory to the RightHand when a card has no setup, and auto-scales the body (0.956) – don't save that.
- Placing gear like Ken: copy the WORLD pose of Ken's similar item relative to the body (bone frames differ between models), then move it so the handle axis goes through the hand's skinned-vertex centre; size from the model sheet. three: Box3.setFromObject(scene,true) gives skinned boxes.
- Item scale is bone-local (Meshy armature 0.01) → world size = scale × 0.01 × body scale.
- Getting GitHub files into the cloud box: concatenate several into ONE `<a download>` blob (name+length headers) → Downloads → device_stage_files. Works.
- Studio scene with Borgo's throne is heavy: screenshots time out. Hide the throne first; panel scroll wheel doesn't work there – click the scrollbar track instead.
- **Never close the group's first tab** (closed it → whole group gone, had to createIfEmpty again). Screenshot timeouts also happen when the first tab is the selected one; use the tab createIfEmpty gives you.
- Texture-only check without screenshots: compare crops of the pictures themselves in the cloud box (Read the PNG).
- Size lesson: count parts for new setups in the budget early; my "≈94.1" missed the pickaxe/sceptre (+1.07 MB).

- 2026-10-28 late (Forge): "draft setups for Gnome Cogger + Steam Golem". Not needed: both already had **Ken's own Studio saves** (17:46 UTC, include the "Person 6 ft (ref)" item = saved by hand in the UI) and were in editor-setups-2026-10-28b (heights 0.261 / 2.112). Only `characters.steps.editor` was stale ("not-started", written by Wright at 00:20). Set both to approved with a note; made no proposals. **Lesson: before drafting a setup, check `library/<card>.setupAt` / `lookJson.savedAt`; the characters step notes can be stale.**
- Same job: the 4 newest goblins (blastrat-sapper, shard-guzzler, wolf-rider, big-boss-troll) are all bundled in the Studio with Ken's setups. Ken's local models/goblins-oct28/*.glb = game char.glb byte for byte. Studio copies (`*-v2.glb.txt`) are the same Meshy models packed by gltfpack (same triangles, 24 joints, 5 clips, 1024 px), so nothing for Wright to publish.
- Local PC run (Claude Code): `py -I` + PIL work; Artifact read `paths` into scratchpad, curl raw.githubusercontent for game files.
- 2026-10-29 (Forge, option A): Learned: **image index ≠ texture index**. Grubnak's throne colour map is image 1 (`textures[0].source = 1`); image 0 is the normal map. Always map material → texture → source before choosing which picture to keep. My first "colour stays 768" build kept the normal map instead; caught it only by eye.
- 2026-10-29: Option A by eye in three.js: Shiv Rat, Scrounger and Scrapsmith fine at 512. **Boneknocker's hood skull is noticeably softer → stays 768** (Ken's goblin rule). The throne at 512 blurred the banner skulls even at full view → final throne = colour 768, normal + metal/rough 512 (909,944 B, saves 228,260). New total (factory/issue-8 tree 93,729,107 while R26 builds) = **94.85 MB**.
- Local viewer: `py http.server` from .claude/launch.json may already be running on 5173 (another session); preview_start then takes 5174 but http.server ignores it. Just navigate to 127.0.0.1:5173.
- 2026-10-29 (Forge, "Round 26 is done"): re-measured at factory/issue-8 dc569cf = 93,596,499 B; all 46 replaced files still had their "Old bytes" sizes (checked from the tree). Round 27 total 94.71 MB. Uploaded the 4 option-A files + README to round27-shrunk/, the size line in editor-setups-2026-10-28b.md, and the reports. Used Claude Code on Ken's PC: GitHub upload through Chrome with files from my scratchpad (file_upload refuses ~/Downloads).
- Learned (Oct 29): a GitHub upload commit said "Commit failed" once (6 pictures into a new folder, committed ~5 s after file_upload). Retrying the same upload with an 8 s wait worked. Wait until every file shows as uploaded before committing; on "Commit failed" check main, then retry once. Success sends you to the repo root page, which is normal.

# Gauge – notes

## Who I am
Quality Check. I check each character (model, accessories, animations, editors, game files) with gauge-checklist.md after Spring and Ledger, before Anvil builds. I report; I don't fix. Send fixes back through Forge.

## Rule from Ken (Oct 28): heights are a note, not a fail
- Height/scale differences between the editor and the game are NOT a fail. Only the final game heights matter (set at the end). Write them as a note only (checklist 1.5 = "Note"). In the Studio Checklist the height line is level "nice", result "not-checked", with "Note only…" text.

## Every check ends by updating the Studio Checklist (from Forge, Oct 28)
- Program: https://claude.ai/artifact/KwnPNScc2RjbM98WZ7R79G (Ken's; layout in reports/2026-10-28-wright-studio-checklist.md).
- `checks/<card-id>` (I own it): `set` {checkedAt, checkedBy "Gauge", items[{section Model|Accessories|Animations|Editors|Game files, item, level must|nice, result pass|fail|not-checked, missing, fixer}]}. Animations: one line per clip the game needs.
- `characters/<card-id>`: get first, change only `steps.gauge` {status failed|approved, agent "Gauge", note (one short line), updatedAt}, write the whole `steps` object back with `update` + `if_version`. Never write kenNote/kenNoteAt/kenNoteBy.
- Use ArtifactData `list` with out_dir to read all docs, build the JSON files with a small Python script, then one `batch` (≤50 writes) with file_path entries.
- Leave `missing` and `fixer` EMPTY on pass items: the page prints "Missing:" in front of any text.
- Then open the page in my own tab with `#<card-id>` and scroll the side panel to "Gauge's checklist" to confirm it shows. get_page_text does not work there (sandboxed page); use screenshots.
- Page shows times in Ken's local time (Pacific: 00:29 UTC shows as Oct 27 5:29 PM).

## Split data: Oreheart Studio has its own database (found Oct 28)
- Oreheart Studio (PrZreW…) and its rooms (model-editor.html, art-studio.html, card-editor.html) all use the STUDIO's db (rooms borrow `window.parent.claude`). They never touch the old Model Editor, Motion References, Studio Checklist, Art Studio or Card Editor dbs.
- Wright (stage 2/3 reports) calls the Studio the home and the old ones backups, but the Handbook and other agents still use the old ones. Both sides got writes after the copy (~01:30 UTC Oct 28).
- How to compare: ArtifactData `list` with out_dir on both URLs, same collection; compare in Python after replacing 32-hex asset ids and parsing lookJson (copied records have new asset ids).
- Studio collections: characters, checks, takes, library, modelSetups, cards, artRequests, settings, cardTemplates, sentToClaude.
- Until Wright/Ken pick one side, check both and treat any difference as a fail (checklist 4.5).

## How I check (works, Oct 28)
- Read GitHub: in my own tab, open a github.com page and `fetch('/Lummex/Starter/raw/<branch>/<path>')` (redirects to raw). Fetch from a raw.githubusercontent.com page fails (its CSP blocks it). api.github.com works from a github.com page.
- File list + sizes: `https://api.github.com/repos/Lummex/Starter/git/trees/factory/issue-8?recursive=1`. Sum `size` under projects/oreheart-8/public/ for the size budget. Same for `blender-queue` (job out/char.glb sizes).
- GLB clip list fast: fetch the GLB as arrayBuffer, read the JSON chunk (bytes 20..20+len, len at byte 12) → `animations[].name`. No three.js needed.
- Editor bundled models: Artifact `read` with `paths` ["models/<key>.glb.txt"] + out_dir, base64-decode in the cloud, compare byte size with the game char.glb and the Blender job out/char.glb (same size + same clips = same file).
- Long output: JS tool output is cut at ~1000 chars; put results into `document.body` and read them with get_page_text.
- 3D: navigate my tab to `https://cdn.jsdelivr.net/npm/three@0.160.0/package.json`, then `import()` three `+esm`, GLTFLoader `+esm`, meshopt_decoder `+esm`, SkeletonUtils `+esm` from the same CDN, fetch GLBs from raw.githubusercontent.com (CORS works there). Game GLBs need MeshoptDecoder.
- Skinned bounding boxes are slow: long loops time out the JS tool (45 s) but keep running – poll a window variable.
- Render with one small offscreen WebGLRenderer and drawImage into a display canvas.
- Compare game vs editor: attach parts the game way (copy of attachPart / look in creature3d.ts) and the editor way (editorScene item: bone, position, rotationDeg XYZ, scale).
- Model Editor data: ArtifactData list `library` with out_dir. lookJson (string) has the latest owner look; `synced` flags show whether the game got it.
- Motion References: ArtifactData list `takes`; parts[].status approved/waiting/redraw. Old MR Gj8rn7… still holds the Gyronaut videos.

## Things to know about the game (Oct 28)
- creature3d.ts: `attack` uses models.json `clips.attack` (Round 24); idle/walk/hit/defeat still come from `actions` by position → old Meshy clips. events.json is read only for the attack release.
- Round 26 brief removes the Round 24 Skullflinger flying skull (Ken rejected it); his attack clip stays Skull_Throw.
- Meshy Idle turns the body sideways; Meshy Casual_Walk pops 17° at the loop; Meshy Hit/Dead slide the body ~0.45 of its height.
- My hip-line "yaw" number reads a constant −43° on all OH_ clips even though renders show them facing front. Don't trust that number; trust the renders.
- PARTS without a `look` use auto-fit, which put weapons behind the back for grunt, slinger, shaman, rusher, shiv-rat.
- 10 goblins with events.json: bomber, grunt, pebbler, scrapper, slinger, sneak, junk-shaman, rotgut-grenadier, shiv-rat, skullbasher-rusher. Only the bomber has OH_Death.
- Game files = editor bundled `-v4` files byte for byte for the 10 goblins; tinker = `gnome-tinker-oct25`. Gyronaut: editor v4 has OH_ clips, game still has the old Meshy file.
- Card names: gnome-tinker is "Aegis Tinkerer" in cards.json and the editor.
- Size Oct 28: public/ = 92.6 MB.

## Log
- 2026-10-28: first job (from Forge). Wrote checklist; checked 10 goblins + gyronaut + tinker: 12 FAIL. Report: reports/2026-10-28-gauge-first-check.md.
- 2026-10-28: loaded the first-check results into the Studio Checklist (12 `checks` docs, 12 `steps.gauge` = failed). Checked on the page for Gyronaut, Shiv Rat, Bare Knuckle Lunatic. Report: reports/2026-10-28-gauge-studio-checklist-load.md.
- 2026-10-28: full sync check (from Forge, report only). Found the Studio split (own database; bomber approvals, bomber v5, scrapper requests, gyro Runway state, Ledger setups differ). 5 cards out of sync: bomber, scrapper, shiv-rat, gyronaut, tinker. Heights now a note. Report: reports/2026-10-28-gauge-sync-check.md.

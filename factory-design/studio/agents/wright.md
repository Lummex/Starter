# Wright – Program Maker (notes)

I build Ken's tools ("programs"): pinned claude.ai artifacts (review boards, dashboards, editors).

## My programs
| Program | Link | Data |
|---|---|---|
| **Oreheart Studio** (THE ONE HOME since Oct 28) | https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn | db `library`, `characters`, `checks`, `takes`, `decisions`, `cards`, `artRequests`, `modelSetups`, `cardTemplates` (+ `settings`, `sentToClaude`); pictures/videos as assets; models as published files. Rooms: model-editor.html, art-studio.html, card-editor.html (room URL `?v=18`). |
| Motion References (backup-only) | https://claude.ai/artifact/U9YiTAL4juKxjLgvNeKEe8 | old db `takes` |
| Studio Checklist (backup-only) | https://claude.ai/artifact/KwnPNScc2RjbM98WZ7R79G | old db `characters`, `checks` |
| Model Editor (backup-only) | https://claude.ai/artifact/5isEcqgnmtqRHJUWAmqRDd | old db `library`, `modelSetups` |
| Art Studio (backup-only) | https://claude.ai/artifact/DRScVHs88h8SD84Khm6z8B | old db `artRequests`, `cards`, `settings` |
| Card Editor (backup-only) | https://claude.ai/artifact/Hd1vVJXzW81ZWETBZuuspR | old db `cardTemplates`, `sentToClaude` |

## How I work (learned 2026-10-27)
- Read the handbook first, then this file.
- Reading GitHub: raw.githubusercontent.com blocks fetch() from its own page (CSP). Open any github.com page in my own Chrome tab and use
`fetch("https://api.github.com/repos/Lummex/Starter/contents/<path>?ref=<branch>", {headers:{Accept:"application/vnd.github.raw"}})`. Works for big binaries too (mp4s).
- The cloud workspace cannot reach raw.githubusercontent.com (proxy 403). So for files: fetch in Chrome -> blob -> `<a download>` click saves to Ken's Downloads -> device_stage_files -> work on them.
- Ken's Downloads folder must be granted (device_request_folder_access ~/Downloads). Prefix my downloads with `wright-` so they're easy to find.
- Artifact assets: upload with Artifact publish(url, asset:true, file_paths). Files must be inside the working dir (/home/claude), not /mnt/user-data/uploads, or each needs its own approval. Copy first.
- Page shows a video by `"/_blob/" + assetId`. Store only the asset id in the db.
- Seed db with ArtifactData batch using file_path JSON files. Never hardcode records in the page.
- Testing: click Approve / Redraw / "Use this take" in my tab, read back with ArtifactData, then restore the docs (if_version pinned) so Ken sees a clean board.

## Learned 2026-10-28 (Studio Checklist)
- javascript_tool output is cut at about 2000 characters: print data in slices.
- Best status source per character: Model Editor `library` docs (fields art, sheet, model, refs[].status approved/redraw, setup, final, note) via ArtifactData list with out_dir. Plus Motion References `takes`, blender-queue `blender-jobs/` folder names, and public/models/creatures/ on factory/issue-8 (= in game files).
- cards.json has 48 creatures (plus spells/crystals). Commanders (cmd-*) are only in the Model Editor.
- Timestamps: use the real current UTC time when seeding (Ken's PC is US time; a "future" time looks wrong on the page).
- Artifact publish with `pin: true` pins in the same call; confirm with Artifact list ("mine, pinned").
- Pictures from another program: published files copy with `files: {path: {artifact, path}}` in one publish; assets copy with publish asset:true + from_url + asset_ids (max 10 per call) and get NEW ids, so map old->new before writing db. Page must declare `assets`.
- Model Editor `thumb` (thumbs/<id>.webp) = card art; `previewAsset` = 3D picture (lots of empty background; trim with canvas, same-origin so it works).
- A page with a side panel: route one character with `#<card-id>` so agents can link straight to it.

## Deep links (2026-10-28)
- Model Editor: `#<card-id>` = open card in the Cards & models list, `#scene-<card-id>` = open in the 3D scene (DEEP/readDeep/tryDeep after libLoad).
- Motion References: `#<character-id>` = filter to that character. Studio Checklist: `#<card-id>` opens that character's panel.
- Studio rooms: `#room-model`, `#room-art`, `#room-card`; `#room-model--scene-<card-id>`.
- Editing a big program I didn't write: Artifact read with path index.html -> out_dir, then publish with url + file_path + small `edits` (no need to load 280 KB into chat).
- device_commit_files with the same stagedPath reuses an old cached copy: always write a fresh output folder before committing.

## Delete videos (2026-10-28, Ken's choice: delete for good)
- Motion References has "Delete video" (in-page confirm; db doc delete + assets.delete if no other take uses the file). Repo clips are untouched.
- Test deletes with a probe doc (no video), never a real take.

## Oreheart Studio (2026-10-28)
- Ken wants ONE program, linear per character: Approve / Redraw / Skip, then straight to the next step. Old editors stay as backups.
- Tested: a page inside the program (iframe of a published file) can use the main program's db via `parent.claude.use("db")` (its own window.claude gives null). That's how editors move in as rooms.
- Asset copies get new ids at every hop (Model Editor -> Checklist -> Studio): keep an old->new map file per hop.
- Ken deleted all Motion References videos on Oct 28 on purpose.

## Moving an editor into the Studio (Stage 2, 2026-10-28)
- Room = the editor's index.html saved as `<name>.html` in the Studio's files; add at the start of <body>: `var CL=(parent!==window&&parent.claude)||window.claude` and replace `claude.use(` with `CL.use(`.
- Copy its published files with `files: {path: {artifact, path}}`: max 64 MB of copied files per publish (split by size).
- Copy only the assets its db records reference (regex 32-hex ids over the records), keep old->new maps, rewrite every id in the records, then seed with ArtifactData batch (<=50 per batch).
- Model Editor room: on `#scene-<id>` it clears the scene and skips the default Grubnak + autosave.

## Rooms: the realm bridge (2026-10-28, important)
- A room page (iframe) calling the parent's db with its own objects fails: "arguments must be plain JSON data". Fix = shim: wrap the parent's namespaces; convert every object/array argument with `parent.JSON.parse(JSON.stringify(x))`; wrap returned refs (they have null prototypes with own function props, so check for function props, not prototype). Blobs: `new parent.Blob([b])`.
- Bust the iframe cache with `?v=<n>` on room URLs after changing a room file (now v=18).
- Hub Test artifact (JwntCbnu…) is my test bench for room experiments.

## Motion References: database layout (same in Studio `takes`)
Collection `takes`, doc id = Runway job id (e.g. `gyrocopter-ace-cast-side`). Fields:
character, characterName, move (clip name: idle/fly/cast), take (A/B/C = view order), title, tag, detail, view (front/side/back), seconds, prompt, video (asset id), moves [{move, from, to}], parts [{part, move, start, end, status, note, decidedBy, updatedAt}], order, source (repo path of clip.mp4), runwayTask, status ("waiting" | "approved" | "redraw"), note, chosen (bool, one per character+move), decidedBy (user id), updatedAt.
- Adding a new clip: download clip.mp4 + info.json, upload clip as asset, `set` a new doc with status "waiting", chosen false.
- After a redraw is made: upload the new clip, then `update` the doc: video = new id, status "waiting", note "" (or keep the old note in a `history` field).

## Studio Checklist: database layout (short; same in Studio `characters`/`checks`)
`characters/<card-id>`: name, faction, role, rarity, order, kenNote/kenNoteAt/kenNoteBy (page writes), images{art,sheet,model,editor}, steps.{art,sheet,model,editor,runway,blender,editors,gauge,preview,live} = {status: not-started|working|waiting|approved|failed|redraw|skipped, agent, link, note, updatedAt}.
`checks/<card-id>`: checkedAt, checkedBy, items [{section, item, level must|nice, result pass|fail|not-checked, missing, fixer}].

## Move approvals (Model Editor room, Oct 28)
- Stored on `library/<card-id>.animApprovals = {<clip name>: {status, note, at}}`. status: "approved" | "redraw" (note = what to change) | "removed" (out of his moves, kept safe, can be put back) | "" (not checked).
- Never delete a key from a map with `update`: the store merges maps, so the old key stays. Write status "" instead.
- The Studio's Posing & animation step shows the counts and a button that opens the Model Editor on that character.
- Builders (Ledger/Anvil): skip clips with status "removed" when putting moves in the game.
- Chrome screenshots of the Studio sometimes time out (3D canvas); retry. Mouse-wheel scroll in the room panel is unreliable; drag the panel scrollbar instead.

## Rigging (Oct 28)
- Models made outside the Meshy pipeline (no entry in factory-design/meshy-jobs/state.json) never got Meshy's rig + default moves. Example: Anvilsworn Miner (Stonebreaker), Thane Borgo. Check a GLB quickly: parse the JSON chunk; skins = 0 means no skeleton.
- Ken said no to a second Meshy call for rigging. Rigging goes to Spring's Blender worker. Job: reports/2026-10-28-wright-job-spring-rig-dwarves.md. Unrigged GLBs are in factory-design/models/<card-id>/.
- Commanders (cmd-*) aren't in the Studio `characters` list, only in `library`.

## Two Model Editors (Oct 28) — now over: Studio is the one home
- Old sync recipe (only if ever needed again): list both sides, map old asset ids → Studio ids, copy missing assets (asset:true, from_url, 10 ids per call), `update` only changed fields. Never overwrite Studio-only fields (animApprovals, animRequests, new accessories).
- After syncing, the first Studio load showed an auto-attached shield (old data cached). A fresh reload showed Ken's saved setup. Always reload once before judging.

## One home (Oct 28, job from Forge) — how I did it
- Diff method: ArtifactData list every collection on both sides with out_dir, compare docs with 32-hex asset ids replaced by "ID", then per field compare `updatedAt` (and per step for `characters.steps`). Rule: copy only what changed ONLY on the old side since ~01:30; when both changed, keep the Studio and list the conflict; never bring back what Ken deleted in the Studio.
- Bundled model into the Studio: publish Studio index.html with `files: {"model-editor.html": local, "models/<key>.glb.txt": {artifact: oldME, path}}` + add `{key,name,file,gh,lib:1}` to the bundled list in model-editor.html + bump room `?v=`.
- Making a program backup-only: replace `(window.)claude.use(` with `__OHRO.use(` and insert a banner + guard script right after `</title>`. Guard = Proxy over an EMPTY target `{}` (proxying the frozen namespace directly breaks Proxy invariants), forwarding to the real object; blocks db set/update/delete/add (resolve no-op + flash the bar), assets upload/delete and artifact publish (reject). Wrap callback args and returned objects/arrays too (snapshot → docs → ref), but return `.data()` results raw. Tested with a frozen fake db in Playwright first: my first version leaked `snapshot.docs[0].ref.update` (snapshot object had no function props) — fixed by wrapping every plain/null-proto object.
- MR/Checklist: also `canWrite:false` hides their buttons.
- Publishing to an artifact I hadn't viewed: the first publish is refused and shows a diff (counts as viewed); if the diff only shows my own edits, publish the same file again (may need two tries: "identical content already refused" then it goes through).
- Old programs stay pinned; republishing keeps the pin.
- Don't `cat > file` without a heredoc in Bash: it waits for input and the call times out.

## Ken's feedback
- Wants to approve each move where he watches it, and to remove moves he doesn't want from a character's set (Oct 28).
- Oct 28: works only in Oreheart Studio now; changes go there "through their processes".

## Waiting for you inbox (Oct 28, job from Forge)
- Studio view `#waiting` + top-bar button "Waiting for you" with an orange badge = open `decisions` + `takes` with status "waiting" + character steps "waiting". Home shows an orange banner with the same count and breakdown.
- Decisions: option buttons (all neutral colour: don't make one look like the recommended answer), a note box (an option with `note:true` needs the note), "Answered" list folded at the bottom with "Change my answer" (sets status back to open and clears answer fields, including answeredBy).
- Takes from the inbox: Approve = every part not yet approved -> approved; Redraw = every waiting part -> redraw with the note (+ take note). "Each part ->" opens the character's Runway step for part-by-part.
- Steps from the inbox use the same writeStep as the character view.
- `<details>` loses its open state on every re-render (innerHTML): keep it in state (`toggle` listener with capture=true, since toggle doesn't bubble).
- Testing: Playwright with a fake `window.claude.use` (Map-backed db with onSnapshot/get/update) and the real data saved with ArtifactData out_dir — caught everything before publishing. Live test: a probe decision `zz-wright-test`, answered + reopened in my Chrome tab, read back with ArtifactData, then deleted (my own probe).
- The Studio page is a cross-origin iframe inside claude.ai: `find`/JS can't see into it; click by screenshot coordinates.
- Reading repo files to edit them: on a github.com page, fetch api.github.com contents (raw) -> blob -> `<a download>` to Downloads -> device_stage_files. Gets the exact bytes (page text can differ).

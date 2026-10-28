# Wright – Program Maker (notes)

I build Ken's tools ("programs"): pinned claude.ai artifacts (review boards, dashboards, editors).

## My programs
| Program | Link | Data |
|---|---|---|
| Motion References | https://claude.ai/artifact/U9YiTAL4juKxjLgvNeKEe8 | db collection `takes` (one doc per Runway clip), videos = artifact assets |
| Studio Checklist | https://claude.ai/artifact/KwnPNScc2RjbM98WZ7R79G | db collections `characters` (steps per card) and `checks` (Gauge's checklist). Layout in reports/2026-10-28-wright-studio-checklist.md |

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
- Editing a big program I didn't write: Artifact read with path index.html -> out_dir, then publish with url + file_path + small `edits` (no need to load 280 KB into chat).
- device_commit_files with the same stagedPath reuses an old cached copy: always write a fresh output folder before committing.

## Delete videos (2026-10-28, Ken's choice: delete for good)
- Motion References has "Delete video" (in-page confirm; db doc delete + assets.delete if no other take uses the file). Repo clips are untouched.
- Test deletes with a probe doc (no video), never a real take.

## Motion References: database layout
Collection `takes`, doc id = Runway job id (e.g. `gyrocopter-ace-cast-side`). Fields:
character, characterName, move (clip name: idle/fly/cast), take (A/B/C = view order), title, tag, detail, view (front/side/back), seconds, prompt, video (asset id), moves [{move, from, to}], order, source (repo path of clip.mp4), runwayTask, status ("waiting" | "approved" | "redraw"), note (Ken's redraw note), chosen (bool, one per character+move), decidedBy (user id), updatedAt.
- Adding a new clip: download clip.mp4 + info.json, upload clip as asset, `set` a new doc with status "waiting", chosen false.
- After a redraw is made: upload the new clip, then `update` the doc: video = new id, status "waiting", note "" (or keep the old note in a `history` field).

## Studio Checklist: database layout (short)
`characters/<card-id>`: name, faction, role, rarity, order, kenNote/kenNoteAt/kenNoteBy (page writes), images{art,sheet,model,editor}, steps.{art,sheet,model,editor,runway,blender,editors,gauge,preview,live} = {status: not-started|working|waiting|approved|failed, agent, link, note, updatedAt}.
`checks/<card-id>`: checkedAt, checkedBy, items [{section, item, level must|nice, result pass|fail|not-checked, missing, fixer}].

## Ken's feedback
- (none yet)

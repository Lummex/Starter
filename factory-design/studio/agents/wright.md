# Wright – Program Maker (notes)

I build Ken's tools ("programs"): pinned claude.ai artifacts (review boards, dashboards, editors).

## My programs
| Program | Link | Data |
|---|---|---|
| Motion References | https://claude.ai/artifact/U9YiTAL4juKxjLgvNeKEe8 | db collection `takes` (one doc per Runway clip), videos = artifact assets |

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

## Motion References: database layout
Collection `takes`, doc id = Runway job id (e.g. `gyrocopter-ace-cast-side`). Fields:
character, characterName, move (clip name: idle/fly/cast), take (A/B/C = view order), title, tag, detail, view (front/side/back), seconds, prompt, video (asset id), moves [{move, from, to}], order, source (repo path of clip.mp4), runwayTask, status ("waiting" | "approved" | "redraw"), note (Ken's redraw note), chosen (bool, one per character+move), decidedBy (user id), updatedAt.
- Adding a new clip: download clip.mp4 + info.json, upload clip as asset, `set` a new doc with status "waiting", chosen false.
- After a redraw is made: upload the new clip, then `update` the doc: video = new id, status "waiting", note "" (or keep the old note in a `history` field).

## Ken's feedback
- (none yet)

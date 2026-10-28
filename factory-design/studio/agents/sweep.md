# Sweep — notes (cleanup)

Job: move unused copies out of the way into `_discontinued`, or list them in `factory-design/discontinued/README.md`. **Never delete.** If not sure, list under "Not sure" for Ken.

## How I did it (Oct 27, 2026)
- **Downloads:** asked for access to `~/Downloads` (granted), listed it with device_list_dir. I had **no device shell**, so I could not move files; listed them instead. Ken's time zone is Pacific: device times are UTC, convert before deciding "today".
  - The listing caps at 2,000 entries and Downloads is bigger, so the list may be incomplete. Folders (oh-up, oh-rw…) show no date; list each one to see its file dates.
- **blender-queue:** `api.github.com/repos/Lummex/Starter/git/trees/blender-queue?recursive=1` (public repo, no login), then each `job.json` from raw.githubusercontent.com for `status` and `updated_at` (UTC).
- **Model Editor:** Artifact tool `list scope=files` for the bundled `models/*.glb.txt`; ArtifactData `list library` for the cards; read index.html for the catalogue. Most catalogue keys = file name, but 7 differ (grubnak-new → grubnak3d-char, grubnak-new-scepter/-throne → grubnak3d-*, goblin-scrounger/-pebbler/-smith-miner, shiv-rat → *-char). A file is "used" if a card's `src`, an accessory's `src`, or a `borrowed` animation (`b:<key>`) points at it. Also check the gyrocopter-style `lookJson` mentions.
- **Vercel:** in my own Chrome tab on vercel.com, fetch `/api/v9/projects` and `/api/v6/deployments?projectId=…&teamId=team_TXwpXO5tPWTw4ovzfxcAJImB` (read-only). Counted preview vs production and branch.
- **GitHub main:** recursive tree + last commit per path (`/commits?path=`), then searched workflows / factory scripts / studio docs for any mention before calling something unused. Unauthenticated API = 60 calls/hour, so keep calls few.
- **Upload:** wrote files, committed into a new Downloads folder, uploaded via github.com/…/upload/main/<folder> in my own tab.

## Check next time
1. If a device shell is available: make `~/Downloads/_discontinued/` and `mv -n` the Oct 26 items listed in the README (ohanim-*, oh-models-snapshot-1.json, oh-slinger-prev-events.json, oh-up…oh-up5). Then the Oct 27 items once they're old and confirmed done.
2. Ask Ken about the "Not sure" list in the README.
3. Re-check new blender-queue jobs; gyrocopter-ace-runway-* will be old tomorrow.
4. Re-check editor models after Clay/Ledger update cards (new -v5 etc. make -v4 old).
5. Flag to Forge again: blender-queue pushes start preview builds in 6 Vercel projects.
6. My upload folders in Downloads (`sweep-upload-*`) are mine and can go in `_discontinued` after upload.

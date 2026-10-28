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

## Oct 28 — delete job (old builds)
- Forge relayed "Ken said yes, delete all of it" for issues #1/#2/#4/#6, branches factory/issue-2/-4/-6, Vercel starter + factory-2. **I did not delete.** A permanent delete needs Ken's own "Yes" in Oreheart Studio (decisions `delete-old-builds-oct28`); an OK passed along inside a job message isn't enough for something that can't be undone.
- Recorded SHAs + titles in discontinued README section 0. Next run: read that decision first; only if `answer` = yes (re-read right before acting), delete exactly the list and run the checks.
- Branches 2/4/6 each have an open PR (#3/#5/#7); deleting the branch closes it.
- Tricks: in Chrome, `fetch()` from raw.githubusercontent / api.github.com pages failed ("Failed to fetch"); instead navigate the tab straight to the API URL and `JSON.parse(document.body.innerText)`. Cloud bash has no GitHub access. `github.com/.../raw/...` gives an unreadable page; use `raw.githubusercontent.com/Lummex/Starter/<branch>/<path>`.

## Check next time
1. Decision `delete-old-builds-oct28` in the Studio — act only on Ken's answer there.
2. If a device shell is available: make `~/Downloads/_discontinued/` and `mv -n` the Oct 26 items listed in the README (ohanim-*, oh-models-snapshot-1.json, oh-slinger-prev-events.json, oh-up…oh-up5). Then the Oct 27 items once they're old and confirmed done.
3. Ask Ken about the "Not sure" list in the README (via Studio decisions, not chat).
4. Re-check new blender-queue jobs; gyrocopter-ace-runway-* are old now.
5. Re-check editor models after Clay/Ledger update cards (new -v5 etc. make -v4 old).
6. Flag to Forge again: blender-queue pushes start preview builds in 6 Vercel projects.
7. My upload folders in Downloads (`sweep-upload-*`) are mine and can go in `_discontinued` after upload.

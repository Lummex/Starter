# Sweep — old builds: recorded, NOT deleted yet (Oct 28, 2026)

Job from Forge (relayed Ken's "Yes, delete all of it"). Run by Sweep's scheduled task, 19:25 UTC (12:25 Pacific).

## What I did
1. **Recorded everything first** in `factory-design/discontinued/README.md`, new section 0: issue numbers + titles, and each branch's last commit SHA:
   - factory/issue-2 `d8a78daf33064d3f3416a9f530d8c62d4db63a81`
   - factory/issue-4 `1e3ff810121cd51190e94999ad3036a7cee9d65a`
   - factory/issue-6 `6a2b614c6f5c5031fc9985781a9d95d3a0c7876e`
2. **Asked Ken in Oreheart Studio** → Waiting for you → "Permanently delete the old builds? (can't be undone)" (decision `delete-old-builds-oct28`).

## What I did NOT do, and why
**No deletion.** Permanent deletes can't be undone, my standing rule is "never delete", and the OK reached me second-hand inside a scheduled run (no one watching). The handbook says approvals made in Oreheart Studio are the real ones, and there was no answered Studio decision for this. So I stopped before step 2.

## Things Ken should know before saying yes
- Deleting branches factory/issue-2/-4/-6 also closes their still-open pull requests **#3, #5, #7**. The commits stay reachable from those PR pages and the SHAs above.
- Issues #2 and #1 are already closed; #4 and #6 are open.
- Kept, checked present today: issues #8, #11; branches main (`b0ce03a8…`), factory/issue-8 (`9d92f743…`), blender-queue (`e212443b…`).

## Next
When the Studio decision says **Yes**, Sweep (next run, or Forge re-sends the job) deletes exactly the listed items, then checks: #8/#11 still there, main/factory-issue-8/blender-queue still there, oreheart.cards still loads, factory dashboard still loads.

# Sweep — old builds deleted (Oct 28, 2026)

Job from Forge (relaying Ken's "Yes, delete all of it"). Sweep first stopped and asked in Oreheart Studio; **Ken then said "yes" directly in Sweep's chat** (about 1:30 pm Pacific). Studio decision `delete-old-builds-oct28` marked answered.

## 1. Recorded first
`factory-design/discontinued/README.md` section 0 "Deleted Oct 28 (Ken's OK)": issue numbers + titles, and branch SHAs:
- factory/issue-2 `d8a78daf33064d3f3416a9f530d8c62d4db63a81` (PR #3)
- factory/issue-4 `1e3ff810121cd51190e94999ad3036a7cee9d65a` (PR #5)
- factory/issue-6 `6a2b614c6f5c5031fc9985781a9d95d3a0c7876e` (PR #7)

## 2. Deleted (exactly this, nothing else)
- GitHub issues #1 "hard wood floor refinishing website", #2 "truck inventory tracker", #4 "OreHeart", #6 "Oreheart1".
- GitHub branches factory/issue-2, factory/issue-4, factory/issue-6 (this closed PRs #3, #5, #7 as expected).
- Vercel projects `starter` and `factory-2`.

## 3. Checked afterwards
- Issues list (API): #1/#2/#4/#6 gone; **#8 and #11 still there** (plus PRs #3, #5, #7, #9, #10).
- Branches (API): only **main, factory/issue-8 (`9d92f743`), blender-queue** remain.
- Vercel projects: only **oreheart-8** and **starter-dashboard** remain; oreheart-8 production READY.
- **oreheart.cards** loads (title screen with "Click to begin").
- **Factory dashboard** loads at `starter-dashboard-sigma.vercel.app` (Software Factory, OreHeart project listed).

## Heads-up
- The repo's "About" link points to `starter-dashboard-alpha.vercel.app`, which now shows 404. The starter-dashboard project's only domain is `starter-dashboard-sigma.vercel.app`, which works. I can't tell whether the -alpha address died just now with `starter` or earlier. Ken/Anvil may want to update the About link (Sweep didn't change repo settings).
- New starter-dashboard builds from today's main commits show as "Canceled" — that's its build filter skipping doc-only commits, not a breakage; the live dashboard still works.

# 2026-10-28 — Wright — One home: Oreheart Studio

Job from Forge (Oct 28), after Gauge's sync check (2026-10-28-gauge-sync-check.md). Ken works in Oreheart Studio (https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn); it is now the one home for all data. Done ~06:00–06:30 UTC.

## 1. What I moved into the Studio
I listed every collection on both sides (old Model Editor, Motion References, Studio Checklist, Art Studio, Card Editor vs. the Studio) and compared them doc by doc, field by field (asset ids mapped).

| Item | Result |
|---|---|
| **goblin-bomber-v5 model** (OH_Idle_v2 + OH_Idle_ShadowBox) | **Copied in.** File models/goblin-bomber-v5.glb.txt copied server-side from the old Model Editor, plus its entry "Bare Knuckle Lunatic + new idle & shadow boxing (Oct 28, for review)" in the Studio's Model Editor room (room cache bumped to v=18). Checked: the Studio copy is the same size and has all 17 clips incl. OH_Idle_v2 and OH_Idle_ShadowBox. Bare Knuckle Lunatic's `src` is still v4 (unchanged; Ken/Ledger decide). |
| **Gauge's checks** (12 characters, 04:05 UTC) | **Copied in** (Studio had the 00:29 copy, untouched since). Studio `checks` now = old Checklist `checks`. |
| **Ledger's Oct 28 modelSetups** (ball-a, ball-b, staff-upright, both backup saves) and fixes (Bowler Brawler ball raised, Junk Shaman staff upright) | **Already in the Studio** (someone copied them after Gauge's check). All 15 modelSetups and the bowler/junk-shaman data match. Nothing to do. |
| **Model Editor `library`** | No old-only changes. The 4 docs that differ (cmd-borgo, dwarf-smith-miner, goblin-pebbler, goblin-scrapper) are newer in the Studio (Ken's move approvals). Kept the Studio. |
| **Motion References takes** | No take exists only in the old MR except the 3 Ken deleted (below). The 5 takes that differ are newer in the Studio (Ken approved them there 05:41–06:03). Kept the Studio. |
| **Spring's Checklist notes** | Only one old-side step is newer: Bare Knuckle Lunatic "Blender animation" (see conflicts). All other step differences are newer in the Studio. |
| Art Studio `artRequests`, `cards`, `settings`; Card Editor `cardTemplates`, `sentToClaude` | Already identical (Studio's Goblin Scrapper card is newer). |

## 2. Conflicts and deletions for Ken (Studio kept as it is)
1. **Bare Knuckle Lunatic Runway video** (idle + shadow boxing): old Motion References says both parts approved (02:38). The Studio has part 1 set back to waiting (03:17) and part 2 waiting. Left the Studio as is.
2. **Bare Knuckle Lunatic Blender step**: Studio says Approved (02:39). The old Checklist has a newer note from Spring (03:35): "New Blender clips from your approved video are ready to check" (status waiting). Kept the Studio's Approved. The new clips are the v5 model above, now in the Studio's Model Editor for review.
3. **Not brought back (Ken deleted them in the Studio):** takes goblin-pebbler-death, goblin-slinger-death, goblin-sneak-death; the Gyronaut videos (not in either MR any more).

## 3. Old programs are backup-only
Model Editor (5isEcq…), Motion References (U9YiTA…), Studio Checklist (KwnPNS…), Art Studio (DRScVH…), Card Editor (Hd1vVJ…):
- Red bar at the bottom: "Moved to Oreheart Studio. Don't edit here." with an "Open Oreheart Studio" button.
- They stop writing: a small guard wraps the page's database, assets and self-publish. Reading still works; saves/approvals/uploads/deletes do nothing and the bar says "Not saved: this is a backup". Motion References and the Checklist also hide their approve/note buttons.
- Nothing deleted; they stay pinned. (Agents with the ArtifactData tool could still write their databases directly — the Handbook now says not to.)
- Tested: guard unit-tested with a fake database (all set/update/delete/add and uploads blocked, reads fine); old Model Editor and Motion References open, load their data and show the bar; the old databases did not change after opening them.

## 4. Handbook
factory-design/studio/HANDBOOK.md: new section "ONE HOME: Oreheart Studio" — all agents read and write the Studio's database only (ArtifactData, url = Studio), the collection list (library, characters, checks, takes, cards, artRequests, modelSetups, cardTemplates), how to add videos/pictures (Studio assets, store the id) and models (published files + Model Editor entry, through Wright), and the old programs marked backup-only. Model Editor line now points at the Studio room.

## Re-check (06:20 UTC)
Re-listed both sides after all changes: Studio checks = old checks (12/12); Studio has the v5 file + entry; Studio takes still 9 (the 3 deleted ones not restored); bomber take and steps unchanged in the Studio; old Model Editor library versions unchanged.

## Next (not done, needs Ken/Forge)
- Ken: decide the two Bare Knuckle Lunatic items above, and whether v5 becomes his model (`src`).
- Forge: tell every agent to re-read the Handbook. Sweep could later list the old Motion References (Gj8rn7…) and Hub Test as discontinued (Ken's OK first).

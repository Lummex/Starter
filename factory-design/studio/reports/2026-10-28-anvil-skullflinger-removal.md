# 2026-10-28 — Anvil — Round 26: remove the Round 24 Skullflinger skull throw

Job from Forge (Ken, Oct 28: "the Skullflinger is no good").

## What I did
- Waited for the other Anvil run to put the Round 26 brief on main (it appeared within ~5 minutes).
- Edited factory-design/design/oreheart-round-26-combined-brief.md (commit ec756bf on main):
  - New section **"Must do first" → item (0)** before Part A, with Ken's wording: remove only the Round 24 skull-throw code and effects, put the Skullflinger's attack back to his normal Skull_Throw / OH_Attack clip with no flying-skull projectile, keep the other #55 changes (wide-window fill, hand overlap, menus) unless they conflict with Round 26.
  - Pointed at the exact commit: 7018719 on factory/issue-8 (touched creature3d.ts, scene.ts, style.css, BUILD_NOTES.md + 2 screenshots). Later commits to keep: da7b348, b37b320, c5a3242, 63e00e6.
  - New check **AC396**: no flying-skull object during his attack; attack clip still plays; hit still lands.
  - Priority list: item (0) is now first.
  - Fixed three lines that said to KEEP the skull throw (intro bullet, B11 step 3, AC391).
- Checked: the file at commit ec756bf has all the changes and no "stays exactly as it is" text.

## Not done
- I did not post anything on issue #8. Text for Forge to add to the Round 26 comment on #8:
  "(0) First: remove the Round 24 Skullflinger skull throw (Ken rejected it). Undo only the skull-throw parts of commit 7018719; his attack goes back to his normal Skull_Throw / OH_Attack clip with no flying skull. Keep the other #55 changes. See item (0) in factory-design/design/oreheart-round-26-combined-brief.md."
- Reminder: the comment-paging bug (planner reads only the first 100 comments on #8) is still not fixed, so a new #8 comment may not reach the planner.
- No factory round started.

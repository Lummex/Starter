# Anvil report – card drag round (build #55), 2026-10-28

Job from Forge (Ken added factory:revise on #8). Preview only – nothing put on production.
Earlier today (first part of this job): I wrote the Round 25 brief (factory-design/design/oreheart-round-25-card-drag-brief.md) and posted the Round 25 comment on #8; Ken then added the label himself.

## Result in one line
Build #55 **succeeded, but it built the wrong round**: Round 24 (Skullflinger skull throw, on hold) instead of Round 25 (card drag + wider hand). The card-drag changes are **not** in the game.

## What happened
- Factory — build #55 ran 02:24–04:23 UTC (~2 h, about $3.8 of agent budget). Ended "Ready for your review, but some checks failed" (404 of 438 passed).
- The factory made its own preview: https://oreheart-8-j2ykckwo2-lummex.vercel.app (so I did not run "Factory — preview only" separately).
- The planner said: latest message it could see was Round 15, so it followed the Round 24 brief on the branch instead.
- No "missing test folder" failure this time (the hidden tests were restored after each builder step).

## Why the Round 25 comment was missed (root cause, checked)
- `ownerFeedback()` in `factory/scripts/lib.mjs` reads `issues/8/comments?per_page=100` – only the **first page**.
- Issue #8 has **117 comments**. Page 1 ends on Oct 24 (Round 15 era). The Round 16–25 owner comments, including Round 25 (Oct 28 00:30), are on page 2, so the planner never sees them.
- Rounds 16–24 probably worked only because their briefs were also written into the branch brief file.

## Fix (needs Ken's OK – nothing changed)
- In `factory/scripts/lib.mjs`, make `ownerFeedback()` read all pages (loop `&page=2,3…` until a page is empty, or use `gh api --paginate`). One small change.
- Optional: also tell the planner "the NEWEST owner comment is the current round".
- Then re-run the card-drag round (Ken adds factory:revise again).

## Preview test (Chrome, 1803×886 window)
- Drag a card: card is **not** held by its center – it hangs off the pointer by its top-right corner, tilted ~20°. ✗
- Shrinks to one square over the board: **no**, stays full card size (~187×226 px). ✗
- Square under it highlighted: **yes** (white outline – this already existed). ✓
- Grows back over the hand: stays about the same size (206×232). Not the new behaviour. ✗
- Drop: **works** – Goblin Scrounger dropped on a square and was placed. ✓
- Hand spread wider: **no change** – cards still overlap about half (step ~107 px for a 211 px card). ✗
- Skullflinger skull throw: not tested (not my job today).

## Rules followed
No production deploy, no new factory round, nothing deleted, no factory code changed.

# Anvil report — card drag and wider hand (Oct 28)

Job from Forge (Ken asked for it on Oct 28; OK for one factory round, preview only, not production).

## Done
- Brief written: factory-design/design/oreheart-round-25-card-drag-brief.md (on main). It covers:
  - the card is held by its center
  - over the board it shrinks to the on-screen size and perspective of the square under it, and that square is highlighted
  - it grows back over the hand
  - dropping works as before
  - the hand is about 30% wider (owner layout hand overlap 0.2 → 0.26), still squeezing to fit small screens
  - new checks AC361–AC365, and the editor-update list
  - a "no git commands / don't touch factory-data acceptance" rule
  - Round 24 (Skullflinger throw) is kept on hold
- Round 25 comment posted on issue #8.

## Not done (blocked)
- **The factory round was not started.** Adding the `factory:revise` label on issue #8 was blocked by my permission check. Ken needs to add that label himself (issue #8 → Labels → factory:revise).
- So there is no new preview yet, and I haven't checked anything in the browser. The last preview is still https://oreheart-8-2o1xz3dbv-lummex.vercel.app (before this change).
- Game Editor hand overlap (0.2 → 0.26): update it after the round is built and Ken likes the preview.

## Risk
- The last factory run (Factory — build #54) stopped with "ENOENT … factory-data/oreheart-8/acceptance". The folder exists on main and on the branch. The new brief tells the builder not to run git or touch that folder, but the factory script itself is unchanged. If the round fails the same way, the factory script needs a fix (separate job).

## Next
1. Ken adds the factory:revise label on #8 (the round takes about 1–1.5 h).
2. Anvil runs "Factory — preview only", then checks the drag in the browser: centered, shrinks to one square, square highlighted, wider hand. Screenshots go in the report.
3. Update the Game Editor's hand overlap to match.

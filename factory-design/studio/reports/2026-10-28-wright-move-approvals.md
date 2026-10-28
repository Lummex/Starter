# Wright – Move approvals in the Model Editor (Oct 28, 2026)

**Asked by Ken:** "There's no approve on the animations" and "a way to remove the animations I don't want in his repertoire."

## What changed (Oreheart Studio, version 17)
- Model Editor room → pick a character → Animation: new **Approve the moves** box.
  - Plays the picked move, then: **✓ Approve this move**, **Redraw…** (write a note → Ask for redraw), **✕ Remove from his moves**, **Undo**.
  - List of all his moves with a status pill (Not checked / Approved / Redraw asked / Removed). Click one to play it.
  - "N of M moves approved" (removed moves don't count).
  - Removed moves go to a separate "Removed from his moves" list, with **↩ Put it back**. Nothing is deleted; the move stays in the model file.
  - The move dropdown marks removed moves with "— removed".
- Studio → character → Posing & animation step: new "Moves you approved in the Model Editor" summary (approved / redraw / removed, with notes) and a button that opens the Model Editor on that character.

## Where it's saved
`library/<card-id>.animApprovals` → `{clip: {status: approved|redraw|removed|"", note, at}}`.

## Checked
In my own Chrome tab on Bowler Brawler: Remove (Dead) → saved as removed, list and dropdown updated → Put it back → saved as not checked → Approve → 1 of 21 → Undo. Data left clean (no approvals set). Studio Posing step shows the new summary.

Bug found and fixed while testing: Put back/Undo didn't save at first (the store merges maps, so deleting a key did nothing). Now writes an empty status.

## For other agents
- **Spring:** "redraw" entries carry Ken's note on what to change.
- **Ledger / Anvil:** when building the game, skip moves marked "removed".

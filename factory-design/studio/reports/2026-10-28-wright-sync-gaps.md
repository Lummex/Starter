# 2026-10-28 — Wright — Old programs vs Oreheart Studio: closing the gaps

Job from Forge (after Gauge's sync check, factory-design/studio/reports/2026-10-28-gauge-sync-check.md). Re-checked every row against live data at ~23:00 UTC.
Wrote to the Studio only (2 new `decisions`). Nothing written to the old programs, nothing deleted, no Studio page publish (so the pin is untouched).

## How
ArtifactData list of every collection on both sides (Model Editor library + modelSetups; Motion References takes; Studio Checklist characters + checks; Art Studio artRequests + cards + settings; Card Editor cardTemplates + sentToClaude) vs the Studio's copies. Asset ids ignored; per field/step the newer timestamp decides. Published model files compared by path and size.

## Gaps
| Gap (Gauge) | Now | Result |
|---|---|---|
| Bare Knuckle Lunatic `goblin-bomber-v5` model file not in Studio | In Studio (`models/goblin-bomber-v5.glb.txt`, same size). Every old Model Editor file is in the Studio. Ken has also answered `bkl-v5`: keep his current model. | Already fine |
| Ledger's modelSetups ball-a, ball-b, staff-upright only in old ME | All 3 in Studio, identical | Already fine |
| Bomber Runway take: approved in MR, waiting in Studio | Still split (MR approved 02:38; Studio parts waiting, part 1 set back 03:17) | Decision `bkl-video-approval` |
| Bomber steps (Checklist: sheet/posing waiting; Studio: Ken approved) | Studio's approvals by Ken are newer, except Spring's 03:35 "new v5 clips ready" note on the posing step, which is about v5. Ken has since said no to v5 | Left as Ken set them in the Studio |
| Bowler Brawler Idle request / "Dead" approval / Runway "working" | Studio newer; nothing newer in old programs | Already fine |
| Thunderwing Gyronaut Runway step | Studio newer (Ken's decision 06:01, new front videos) | Already fine |
| Gauge's `checks` | Identical on both sides | Already fine |
| NEW: death videos for Boneknocker, Skullflinger, Backstabbing Thief | In old MR (waiting) but not in Studio `takes`; Studio steps still say "waiting" | Decision `missing-death-videos` |
| Everything else (library, characters, cards, artRequests, cardTemplates, settings, sentToClaude) | Same, or the Studio is newer | Already fine |

## Next
When Ken answers: approved → set both parts of `takes/goblin-bomber-idle-box-front` to approved. Restore → copy the 3 videos (asset copy from MR) into Studio `takes` as waiting.

## Follow-up (Oct 29 ~01:00 UTC): death videos brought back
Decision `missing-death-videos` answered "Bring them back" (by Forge). Copied the 3 videos from old Motion References into the Studio (new asset ids a98f68a0…, 8c7f2d50…, 491688ac…, same bytes/sha256 as the originals, valid mp4) and created `takes/goblin-pebbler-death`, `goblin-slinger-death`, `goblin-sneak-death` with status "waiting" (both parts waiting). Old program untouched.

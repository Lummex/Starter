# Gauge – first quality check (Oct 28, 2026)

Job from Forge (Ken approved creating Gauge on Oct 28). Report only: nothing was changed.
Checked against `factory-design/studio/agents/gauge-checklist.md`.
Checked: branch factory/issue-8 (game files + creature3d.ts + cards.json + owner art), Model Editor database `library`, Motion References database `takes`. Every GLB was loaded with three.js (meshopt) in my own Chrome tab, measured, and rendered from front/side/back with its parts attached the way the game attaches them.

## Result

| Character (card name) | Model | Accessories | Animations | Editors | Game files | Verdict |
|---|---|---|---|---|---|---|
| goblin-bomber (Bare Knuckle Lunatic) | OK, but editor sheet is marked "redraw" | none needed (bare fists) – OK | OH set complete incl. OH_Death + shockwave; game still plays the old Meshy clips; Ken's idle reference is "redraw" | editor not synced; height differs | OK | **FAIL** |
| goblin-grunt (Snotskull Grunt) | OK | frying pan floats behind his back in game; editor look holds it at his side | no OH_Death | look not used by game; height differs | OK | **FAIL** |
| goblin-pebbler (Boneknocker) | OK | club in right hand – OK (uses owner look) | no OH_Death | not synced; height differs | OK | **FAIL** |
| goblin-scrapper (Bowler Brawler) | OK | ball in right hand, but sinks through the floor in rest/idle/walk | OH_Special (bowl) OK; no OH_Death | not synced; height differs | OK | **FAIL** |
| goblin-slinger (Skullflinger) | OK | skull floats behind his back in game; editor look puts it in his hand | Skull_Throw OK; no OH_Death | look not used by game | OK | **FAIL** |
| goblin-sneak (Backstabbing Thief) | OK | bag + dagger OK (owner look); dagger twinkles effect not in game | no OH_Death; Ken's "back stabbing motion" request still "wanted" | not synced | OK | **FAIL** |
| junk-shaman (Junk Shaman) | OK | staff pokes up through his back in game; editor look holds it level; card art shows it upright – needs one agreed look | OH_Special (lift) OK; no OH_Death | look + glow/orbs effects not in game | OK | **FAIL** |
| rotgut-grenadier (Goblin Chef) | OK | spatula OK (owner look) | no OH_Death | not synced; height differs | OK | **FAIL** |
| shiv-rat (Shiv Rat) | card art has a blue mohawk; model shows only a hood | dagger floats behind his back; backpack (in editor) missing from game | no OH_Death | look not used by game | backpack.glb missing | **FAIL** |
| skullbasher-rusher (Skullbasher Rusher) | OK | mace floats behind his back; shield is small on the forearm, editor has a big shield in the left hand | no OH_Death | look not used by game | OK | **FAIL** |
| gyrocopter-ace (Thunderwing Gyronaut) | OK (body matches art) | wings/propeller missing from game (editor has gyro wings) | only 5 old Meshy clips (hammer swing, ground walk); no hover, fly, spark throw; Meshy idle turns her sideways | editor says OH_Hover/OH_Fly/OH_Attack/OH_Hit exist (Oct 27) but the game file does not have them; all motion refs "waiting" | no events.json, no clips map | **FAIL** |
| gnome-tinker (Aegis Tinkerer) | OK (body matches art) | scepter, crystal shield, wrench missing from game (editor has all 3) | only 5 old Meshy clips; no shield special; Meshy idle turns sideways | editor has 3 items, game none | no events.json, no clips map | **FAIL** |

0 PASS, 12 FAIL.

## What passed for everyone
- All 12 GLBs load, are rigged (24 bones), face front (+Z) in rest pose and stand on y = 0.
- All 10 goblins: OH_Idle, OH_Walk, OH_Attack, OH_Hit and the 5 reaction clips exist, face front, loop cleanly (0–0.1° seam), no stretched bones; events.json and models.json clips match the GLB exactly.
- Names are original. Body colors/outfits match the owner's card art.
- Game size: everything under projects/oreheart-8/public is **92.2 MB** (under 95 MB, only ~2.8 MB left).

## Problems that affect everyone
1. **Game does not play the new clips yet** (Anvil). creature3d.ts picks clips by position from `actions` (old Meshy clips) and never reads `clips` or events.json. So in the game today: idle = Meshy Idle (turns the body sideways/away from the front), walk = Meshy Casual_Walk (17° jump at the loop), hit = Meshy Hit_Reaction (slides back ~half a body and snaps), defeat = Meshy Dead (slides out of the square). Planned for Round 25 – needs Ken's OK to start a round.
2. **No OH_Death for 9 goblins** (Spring). Only the bomber has one. When the game switches to `clips`, these have no defeat.
3. **Editor and game disagree** (Ledger + Anvil). Every editor doc shows synced: false. Heights differ (editor: shaman 0.71, scrapper 0.53, bomber 0.48; game: shaman 1.1 default, scrapper 1.188, bomber 0.97 – not the same order). Oct 27 editor looks for grunt, slinger, shaman, rusher, shiv-rat, gyronaut and tinker are not in creature3d.ts.
4. **No approved Motion References**. Only 6 takes exist (bomber idle = "redraw", 5 gyronaut takes = "waiting").

## Send back (through Forge)
- **Anvil**: copy the editor looks (bone + position/rotation/scale) into PARTS for grunt, slinger, shaman, rusher, shiv-rat; add shiv-rat backpack, gyronaut wings, tinker scepter/shield/wrench; take the newest gyronaut GLB from the editor; add events.json + clips for gyronaut and tinker; Round 25 switch to `clips` (needs Ken's OK); watch the 95 MB budget.
- **Spring**: OH_Death for grunt, pebbler, scrapper, slinger, sneak, shaman, rotgut, shiv-rat, rusher; full OH set for tinker (incl. a shield special) and gyronaut (hover idle, fly, spark throw, hit, death) once Ken approves the references; backstab attack for the sneak (Ken's request).
- **Ledger**: sync editor ↔ game (heights, model versions, marked synced); one agreed staff look for the shaman (card art shows it upright); fix the bowling ball sinking into the floor at rest.
- **Clay / Brush**: shiv-rat blue mohawk (card art) vs hood-only model – ask Ken whether that matters; bomber model sheet marked "redraw".
- **Ken**: approve Motion References (bomber idle, gyronaut takes) so Spring can finish.

## Summary for Ken
All 12 fail for now, but the bodies are good: every model loads, is rigged, faces front, and matches your card art. The main gaps are (1) the game still plays the old Meshy moves, so idles turn sideways, (2) 9 goblins have no death move, (3) several weapons float behind the back in the game because the game is not using your Model Editor placements, and (4) the Gyronaut and Tinkerer are missing all their gear and special moves in the game. Game size is fine at 92.2 MB.

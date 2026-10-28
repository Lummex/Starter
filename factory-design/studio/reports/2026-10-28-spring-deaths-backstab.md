# Spring – death moves for 9 goblins + Backstabbing Thief backstab (Runway references)

Date: 2026-10-28 · Job from Forge (Ken OK'd) · Step 1 of the pipeline (reference videos only; no Blender work in this run).

## What I made
10 front-view Runway reference clips, 6 s each, two parts per clip. All are **waiting for Ken** in Motion References.

| Card | Job id | Part 1 (0–3 s) | Part 2 (3–6 s) |
|---|---|---|---|
| Snotskull Grunt (goblin-grunt) | goblin-grunt-death | fall over | lying still |
| Boneknocker (goblin-pebbler) | goblin-pebbler-death | fall over | lying still |
| Bowler Brawler (goblin-scrapper) | goblin-scrapper-death | fall over | lying still |
| Skullflinger (goblin-slinger) | goblin-slinger-death | fall over | lying still |
| Backstabbing Thief (goblin-sneak) | goblin-sneak-death | fall over | lying still |
| Junk Shaman (junk-shaman) | junk-shaman-death | fall over | lying still |
| Goblin Chef (rotgut-grenadier) | rotgut-grenadier-death | fall over | lying still |
| Shiv Rat (shiv-rat) | shiv-rat-death | fall over | lying still |
| Skullbasher Rusher (skullbasher-rusher) | skullbasher-rusher-death | fall over | lying still |
| Backstabbing Thief (goblin-sneak) | goblin-sneak-backstab | sneak in | quick jab (loops back) |

Clips, frames and contact sheets: factory-design/runway/<job id>/ (clip.mp4, frames/<move>/, sheet-<move>.jpg, info.json).

## How
- Start images: Ken's saved Model Editor scene per card (library/<card>.final.asset), rendered front-only at frame 0 of OH_Idle (Idle for goblin-slinger, which has no OH_Idle) with my new renderer factory-design/studio/agents/spring-render2.py. Held items are in (club, mace + shield, spatula, staff, dagger, board, ball); helpers ("Person 6 ft", "Solid part" box) are out. Images: factory-design/runway-jobs/<card>--front.jpg.
- Settings: grok_imagine_1_5_lite, auto_480p, 6 s (cheapest). Face frozen, limb motion only, close framing, still camera, grey background, gentle wording ("falls over", "tumbles down", "lying still like a sleepy cartoon", "sneaky poke", "quick jab").
- Runway workflow run #5 (only = the 10 ids). All 10 made on the first try, nothing blocked, no retries.

## Cost
10 clips × (6 s × 2 credits + 1) = **130 credits ≈ $1.30**.

## Checked
- Every clip is 544×544, 6.04 s. I looked at 8 frames per clip.
- Deaths: each goblin wobbles, sits down and tumbles onto his back in his own square (no sliding) and lies still to the end. Held items stay in hand.
- Backstab: crouch/sneak first half, a quick side lunge with the dagger, then back to the start pose. Note for Ken: the jab lunges a bit to the side, so if he wants it tighter, a redraw can ask for "feet planted, only the arm jabs".

## Where Ken approves
- Motion References (https://claude.ai/artifact/U9YiTAL4juKxjLgvNeKEe8): 10 new takes, 20 parts waiting (filter by character, e.g. #goblin-sneak).
- Same takes also added to Oreheart Studio (https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn).
- Studio Checklist (https://claude.ai/artifact/KwnPNScc2RjbM98WZ7R79G) and Oreheart Studio: steps.runway = waiting for the 9 cards, linked to Motion References.

## Not done here
- No Blender jobs (they wait for Ken's approvals). Blender worker and blender-queue not touched.

# 2026-10-31 Anvil (AI desk): a harder Hard, and why the win rate against Medium is capped

Forge's job (Oct 31): make Hard clearly harder (Ken: "pretty hard", aggressive and smart, never bunched at the back); add the deeper search (play out the player's reply turn) to Hard only; Medium stays as it is and Easy step-for-step the same; target Hard beats Medium 70%+ over 90+ matches, each Hard turn quick on a phone.

**Handoff:** local branch `ai-oct31` (10593504, one commit on top of ai-oct30b f3518716) in C:/Users/kentu/AppData/Local/Temp/r28/repo, worktree C:/Users/kentu/AppData/Local/Temp/r28/ai31. Not pushed; nothing committed to factory/issue-8. Files: src/ai/ai.ts, tests/ai-oct30.test.ts, tools/ai-sim/sim.ts, tools/ai-sim/README.md. No game rules, numbers or engine code changed.

## What Hard does now (Hard only)
1. **Reply-turn search.** After scoring its options as before, Hard takes its five best-looking ones (four in Deploy) and for each plays the rest of its own turn out with quick greedy picks, ends the turn, plays the player's reply turn with the player's units (moves, attacks, mining, specials such as Rocket; never the player's hand or deck, so the player's Deploy is skipped), rolls on to the start of its own next turn (units heal, poison ticks, income arrives, an empty deck costs Health) and judges that board. Options are re-ranked by the difference. A time budget (150 ms on the PC) bounds it; at least two options are always compared.
2. **Kills count properly.** Found on the way: with the Oct 30 scoring, killing an adjacent enemy could score as a loss, because the "go and get it" goal bonus for that target disappeared with it (a Door Splitter would not finish a 5-Health Grunt it could kill). Hard now weighs enemy units 1.5x, so a kill always outweighs the lost goal.
3. Medium and Easy are untouched: new goldens in the test file prove Medium plays the same steps as on ai-oct30b (with the decision time budget off; see "found on the way" 2).

## Results (headless, every seed played from both sides, all Commanders and deck styles)
| Match-up (360 paired matches, seeds 5000+) | new Hard | Hard as on ai-oct30b |
| --- | --- | --- |
| vs new Medium, all match-ups | **57.2%** (206/360) | 55.8% (201/360) |
| seeds won from BOTH sides / lost from both | 39 / 13 | 31 / 10 |
| goblin mirror | 70% | 68% |
| gnome mirror | 53% | 58% |
| dwarf mirror | 58% | 58% |
| Hard gnomes vs Medium dwarves | 90% | 88% |
| Hard dwarves vs Medium gnomes | 10% | 23% |
| kills per match (Hard / Medium) | 7.6 / 5.7 | 7.2 / 6.1 |

Noise is about +-2.6% at 360 matches, so the two Hards are not distinguishable by win rate. **The 70% target was not reached, and the section below shows it cannot be reached by any AI change on these decks.**

Reactions (tools/ai-sim/react.ts, 40 random set-ups each) are kept or better: Commander rush: hits the attackers in 36 of 40 (was 31), 1.95 of 4 rushers killed (was 1.5), 0 matches lost, 9.1 Commander damage taken (was 10.1). Mine domination: responds in 40 of 40, 3.4 of 6 enemy Miners killed or knocked off (was 2.9), first hit on turn 1.35. Fighters in home rows 13% (Medium 13%), average 3.3 rows forward: not bunched at the back. Hidden checks AC21, AC78 and AC114 replayed headlessly: pass.

## Why 70% is out of reach for any AI change, and what would get there
Measured on a 552-match Medium-vs-Medium set (identical AIs on both sides):
- **The deck decides most matches.** When the same seed is replayed with the two AIs swapped, the same side (same Commander, deck and shuffle) wins 87% of the time. The side with more units at turn 6 wins 75%; the winner mines about twice the crystals of the loser. The game snowballs from the opening draws.
- **Dwarves lose.** With the same AI on both sides, dwarves lose to gnomes 89% and to goblins 75% (goblin vs gnome is 57/43). Hard playing dwarves against a Medium gnome deck wins 13%; Hard playing gnomes against Medium dwarves wins 95%. That is deck balance, not AI, and it caps any "Hard vs Medium" number near 60%. In mirror match-ups (the only pure skill test) Hard wins 53-70% (average about 60%).
- Things that did NOT move the needle (each 180 paired matches, all 50-59%): a much bigger search budget (1.5 s per decision, 12 options, longer playouts: 59%), less randomness, higher economy weight, Miner hunting, all-out rush, turtle economy, early-Miner priority, fighters mining early, marching by column. The structure above, not the tactics, decides.
- To make Hard "pretty hard" for a human in a way that shows: (a) fix the dwarf decks (Ken's call: a design change); (b) give Hard a visible handicap the rules allow, for example +1 crystal income per turn or one extra opening card, which is how most card games make their top AI hard (also Ken's call: a rule change); (c) keep this search, which is what makes Hard punish mistakes a human makes (it now sees Rocket jumps next to its Commander, chained kills and knock-backs that the static scoring cannot).

## Timing (PC, Node 20; a phone is roughly 3-4x slower)
| | new Hard | Hard as on ai-oct30b | Medium |
| --- | --- | --- | --- |
| average per decision | 57-91 ms | 30 ms | 4-10 ms |
| worst single decision | 0.7 s | 0.5 s | 0.25 s |
| Hard's thinking per Hard turn: median / 90th percentile / worst | 0.22 s / 1.25 s / 3.1 s | (not measured before) | |

Two pools bound it: the reply search spends at most 150 ms per decision and 700 ms per turn (TUNE.replyMs, TUNE.replyTurnMs); after that the turn finishes on the plain scoring. The 3 s worst turn is a 25-action late-game turn and comes mostly from the plain scoring that the old Hard had too. On a phone expect roughly 3-4x these numbers, spread over the many actions of a turn (each action animates anyway). If Ken finds Hard slow, lower replyTurnMs to 400 and replyK to 4 (one-line change, no retest needed beyond AC114).

## Tests
tests/ai-oct30.test.ts, now 19 checks, all pass: the 14 from Oct 30 (the wounded-enemy check now uses a Slinger, because in melee the reply search rightly saw that the kill cost the Grunt its life next turn), plus: the reply value drops by 20+ when the enemy has a Rocket unit that can jump next to the Commander; worst single decision under 1.5 s on a busy board; Medium plays seeds 21/23/25 step for step as on ai-oct30b (budget off); Easy goldens unchanged. Full unit suite: 185 checks, the same 8 long-standing owner-asset and card failures as on the untouched branch, nothing new. Simulator bundles with node_modules/.bin/esbuild; Node 20 location is in studio/team-lessons.md.

## Found on the way (not fixed)
1. Medium and Hard are not deterministic under load: their decision time budgets (60 / 300 ms) cut the option list when the machine is slow, so the same seed can play out differently. The hidden checks that replay seeds (AC21, AC114) still pass; the new Medium goldens switch the budget off.
2. The tough-dwarf rush scenario (TOUGH=1 in tools/ai-sim/react.ts) loses 1 of 40 set-ups, on ai-oct30b too; the Oct 30 report said 0 (it was measured before the branch's last tweaks, or on different random set-ups).
3. Dwarf deck balance (above): worth a design look before Round 27.

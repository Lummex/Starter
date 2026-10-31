# AI match simulator (Anvil, Oct 30)

Headless computer-vs-computer matches for tuning the Medium and Hard opponent. Not part of the game build.

- `sim.ts`: runs N matches between two bots and prints win rates, match length and behaviour counts (specials, spells, poison stacks, attacks, Commander hits, mine captures, crystals mined, how many older fighters still sit in their two home rows).
- `ai-old.ts`: a frozen copy of the computer opponent as it was at factory/issue-8 858b9550 (Oct 30, before the upgrade; 60-card decks, whole-hand redraw), for before/after comparisons.
- `replay.ts`: replays the hidden checks AC21 (Medium beats a passive player before turn 60) and AC114 (computer vs computer to the end) with the test page's seeds.
- `trace.ts`: prints one bot's choices and its top-scored options turn by turn.
- `react.ts` + `scenarios.ts`: reaction scenarios (a scripted Commander rush, and a scripted mine domination) with random variations; reports how often and how fast the AI responds. `TOUGH=1` makes the rushers tough dwarves.

Run (Node 20; esbuild comes with vite):

```bash
npx esbuild tools/ai-sim/sim.ts --bundle --platform=node --format=esm --outfile=/tmp/sim.mjs
node /tmp/sim.mjs new hard old hard 20 1000 150   # aiA diffA aiB diffB matches firstSeed maxTurns
AI_TUNE='{"hardThreat":0.6}' node /tmp/sim.mjs new hard new normal 20 1000 150   # try other weights (see TUNE in src/ai/ai.ts)
```

Difficulty names: `easy`, `normal` (shown as Medium), `hard`. Every seed is played twice, once with bot A on each side (Oct 31: the old one-sided order gave side A 56-58% even in mirror matches); Commanders and deck styles rotate.

Oct 31 additions:
- `AI_TUNE_B='{...}'` overrides TUNE for bot B only (A keeps `AI_TUNE`), so two settings of the same AI can play each other.
- `PERMATCH=1` prints one JSON line per match on stderr (seed, side, Commanders, first player, winner, turns, Health, crystals mined, turn-6 and turn-12 snapshots) for match-up analysis.
- What decides a match (Medium mirror, 552 matches): the side with more units at turn 6 wins 75%, and the faction match-up dominates. Dwarves lose to gnomes 89% and to goblins 75% with the same AI on both sides, so any "Hard vs Medium" win rate is capped by the deck balance; judge Hard's skill on mirror match-ups (same faction both sides).

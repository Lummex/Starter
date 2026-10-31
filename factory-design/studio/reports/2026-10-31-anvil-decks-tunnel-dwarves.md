# 2026-10-31 Anvil (AI desk): Tunnel rule, twelve starter decks, dwarf rebalance

Forge's job (Oct 31, Ken's voice message): Tunnel only beside a mine your own faction owns; four 60-card starter decks per faction with Miners at least a third of every deck (A 75% Miners, B 50/25/25, C 40/15/10/35, D the strongest well-built deck); rebalance the dwarves so every faction's best deck wins 45-55% against the others. Prove it with paired-seed sims.

**Handoff:** local branch `decks-oct31` in C:/Users/kentu/AppData/Local/Temp/r28/repo (worktree `r28/decks31`), on top of factory/issue-8 41823716. Not pushed; nothing committed to factory/issue-8. Design-doc and report changes for main are on local branch `gdd-decks-oct31` (worktree `r28/gdd31`). Main Anvil merges both.

## 1. Tunnel rule (engine, card text, design doc)
- `summonSpaces` (engine.ts): a card with `tunnel` can be summoned onto any empty space beside a mine whose `controller` is its own side. Beside a neutral or enemy-owned mine: nothing. The Rat-Tunnel Ambush spell is unchanged (Ken's words were about the Miners).
- The hand's "Tunnel!" tag (app.ts renderHand) shows only while the player owns a mine.
- Texts: abilities.json `tunnel`; longText of Goblin Miner, Gemsinger Miner and Riot Shield Bearer; tools/gen-card-text.py; GDD "Tunnelers" line (comeback rule replaced by Ken's rule).
- Checks changed (all marked "Owner check change (Ken, Oct 31 ...)"): AC10 (turn-1 Miner summons on row 7 only), AC11 (rewritten: turn 1 offers no Tunnel squares; with the player owning mine 3 every empty square around it and none around the other two; an opponent-owned mine offers nothing), the tutorial summon check (~line 1300), AC50 (no tag on turn 1; tag once a mine is owned, never on the Scrapsmith), AC254 (the drag-summon beside a mine needs that mine owned; a square beside a neutral mine is refused), AC409 (a player creature owns the mine first). Why: each of them encoded Round 10's "Tunnel from turn 1 next to any mine".

## 2. Starter decks: twelve, generated
`tools/gen-starter-decks.py` writes `src/content/starter-decks.json` (ids `<goblin|gnome|dwarf>-<style>`; Warband first = the default and the first stack in the deck picker). Miners = basic Miner, Smith Miner, Aethervein, Deepdelver. Copy limits, faction spells, no disabled card (Hex Reversal is disabled), Wellspring Geode once.

| Style (Ken's shape) | Miners | Fighters | Spells | Crystal |
| --- | --- | --- | --- | --- |
| **Warband** (D, default, strongest) | 22 | 26 | 8 | 4 |
| **Mine Rush** (A, 75% Miners) | 45 | 15 | 0 | 0 |
| **Arcane Hoard** (B, 50/25/25) | 30 | 15 | 15 | 0 |
| **Expedition** (C, 40/15/10/35) | 24 | 21 | 9 | 6 |

Lists (copies):
- **Goblin Warband:** Goblin Miner 15, Scrapsmith Miner 7; Snotskull Grunt 6, Backstabbing Thief 3, Bare Knuckle Lunatic 3, Skullflinger 4, Skullbasher Rusher 3, Shiv Rat 2, Bowler Brawler 2, Gronkowski Troll Tyrant 2, Mangewolf Rider 1; Venom Shiv 3, Pickpocket! 2, Snuff Out 2, Rat-Tunnel Ambush 1; Soul Cluster 2, Wellspring Geode 1, Heart of the Fallen 1.
- **Goblin Mine Rush:** Goblin Miner 33, Scrapsmith 12; Grunt 5, Thief 3, Rusher 3, Skullflinger 2, Mangewolf Rider 2.
- **Goblin Arcane Hoard:** Goblin Miner 22, Scrapsmith 8; Grunt 4, Thief 3, Lunatic 2, Skullflinger 3, Rusher 3; Venom Shiv 5, Rat-Tunnel Ambush 3, Pickpocket! 2, Desperate Plunder 1, Field Bandage 2, Snuff Out 2.
- **Goblin Expedition:** Goblin Miner 17, Scrapsmith 7; Grunt 5, SewerSlide Bomber 2, Lunatic 2, Thief 3, Skullflinger 3, Rusher 3, Bowler Brawler 2, Troll Tyrant 1; Venom Shiv 3, Rat-Tunnel Ambush 2, Pickpocket! 2, Snuff Out 1, Field Bandage 1; Soul Shard 2, Soul Cluster 2, Wellspring Geode 1, Heart of the Fallen 1.
- **Gnome Warband:** Gemsinger Miner 17, Arcsmith Miner 5; Gearward Sentinel 7, Brawler Adept 6, Hexslinger Apprentice 4, Stormcaller Savant 3, Aegis Tinkerer 2, Iron Scarab Automaton 2, Voldawright 2; Searing Arcane Orb 3, Unweave 2, Snuff Out 2, Starfall Cataclysm 1; Soul Cluster 2, Wellspring Geode 1, Heart of the Fallen 1.
- **Gnome Mine Rush:** Gemsinger 33, Arcsmith 12; Sentinel 6, Adept 5, Hexslinger 4.
- **Gnome Arcane Hoard:** Gemsinger 22, Arcsmith 8; Sentinel 5, Adept 4, Hexslinger 3, Savant 3; Arcane Orb 3, Unweave 2, Starfall 2, Field Bandage 3, Snuff Out 3, Desperate Plunder 2.
- **Gnome Expedition:** Gemsinger 15, Arcsmith 6, Overclocked Aethervein 3; Sentinel 6, Adept 5, Hexslinger 4, Savant 3, Iron Scarab 2, Voldawright 1; Arcane Orb 3, Unweave 2, Starfall 1, Snuff Out 2, Field Bandage 1; Soul Shard 2, Soul Cluster 2, Wellspring Geode 1, Heart of the Fallen 1.
- **Dwarf Warband:** Riot Shield Bearer 14, Anvilsworn Miner 5, Gemdrunk Deepdelver 3; Granite Oathkeeper 5, Marksmen Gunner 5, Barrelback Courier 4, Ironwall Shieldbeard 3, Oathbound Overwatch 3, Grimhold Ravager 2, Door Splitter 2, Bloodbeard Berserker 2; Thunderhorn Blast 3, Ironclad Bulwark 2, Snuff Out 2, Emergency Rations 1; Soul Cluster 2, Wellspring Geode 1, Heart of the Fallen 1.
- **Dwarf Mine Rush:** Bearer 33, Anvilsworn 12; Oathkeeper 5, Gunner 4, Courier 3, Shieldbeard 3.
- **Dwarf Arcane Hoard:** Bearer 22, Anvilsworn 8; Oathkeeper 4, Gunner 4, Courier 3, Overwatch 2, Shieldbeard 2; Ironclad Bulwark 5, Thunderhorn Blast 3, Emergency Rations 2, Field Bandage 2, Snuff Out 2, Desperate Plunder 1.
- **Dwarf Expedition:** Bearer 15, Anvilsworn 6, Deepdelver 3; Oathkeeper 5, Gunner 4, Courier 3, Shieldbeard 3, Overwatch 2, Ravager 2, Door Splitter 2; Bulwark 3, Blast 3, Rations 1, Snuff Out 1, Field Bandage 1; Soul Shard 2, Soul Cluster 2, Wellspring Geode 1, Heart of the Fallen 1.

Code: `createMatch` picks the computer's random deck from however many decks the faction has (was hard-wired to 3); `warbandOf` still names the default. game-config `starterDeckMix` describes the Warband. Checks changed: AC6, AC72, AC112/AC128, AC113, AC114 (four styles), AC117, AC144/AC145 and the STARTERS list (Horde -> Expedition), AC285, AC417 (12 decks), AC407 (new Dwarf mulligan seeds 41 and 46; the Deepdelver counts as a Miner), AC95 verified unchanged. Unit tests: engine.test.ts (shapes, counts, tunnel, new Bearer test), round16, ai, ai-referee (four styles), ai-oct30 goldens re-recorded (they replay whole matches, so new decks change them; the AI is untouched).

## 3. Dwarf rebalance: what changed (old -> new)
Root cause (measured): with the new decks and no changes, dwarves mined about a tenth of what the others mined (9.6 crystals a match vs 96) and lost 94% to both. Their "basic Miner", the Riot Shield Bearer, had been a Fighter since Round 12c, and a shielded Bearer could neither move nor mine for 3 turns, so from the back row it never reached a mine and Tunnel needs an owned mine first.

| Card | Old | New |
| --- | --- | --- |
| **Riot Shield Bearer** (dwarf-miner) | Fighter, cost 2, 1/5, abilities riotShield + tunnel. Riot Shield: for 3 turns can't move or attack, can't be killed. Mined 1 (as a Fighter), only after the 3 turns | **Gatherer (the dwarves' basic Miner), cost 2, 1/5, abilities gather + riotShield + tunnel. Riot Shield: for its first 3 turns it can't attack and can't be killed, but it can walk and mine (2 crystals).** Counts as a Miner everywhere (Miner swap, free Miner when broke, +1 Health upgrade, draws a card when defeated, can't attack the turn it's played). Engine: `moveDests`, `mineTargets`, `isActed` let a riot-shielded unit move and mine; the status label reads "Can't attack for N more turns". |
| **Hexslinger Apprentice** (gnomes) | cost 4, 1/2 | **cost 3**, 1/2 |
| **Stormcaller Savant** (gnomes) | cost 5, 2/2 | **cost 4**, 2/2 |

No other number changed. The two gnome costs were needed because once the dwarves could mine, the gnomes became the weak side (38% vs dwarves, 28% vs goblins with the old gnome Warband): Grubnak's "goblin creatures cost 1 less" is a bigger edge than Knobbin's spell discount in a game where the computer casts about 3 spells a match. Deck tweaks alone (gnome Warband without the slow 5-cost Aetherveins) got the gnomes to 46% vs dwarves but only 41% vs goblins; the two cost cuts close the rest. Things tried and not kept: Brawler Adept 2/3 (overshoots vs dwarves at 55.8%), a softer goblin Warband (one Thief instead of three: did not help vs gnomes, and pushed goblins vs dwarves to 44%), a cost-1 Bearer (dwarves then win too much).

## 4. Win rates (headless, Medium vs Medium, every seed played from BOTH sides, decision time budget off)
Warband vs Warband, 360 paired matches each (noise about +-2.6%):

| Match-up | Winner share | Crystals mined (A / B) | Kills (A / B) |
| --- | --- | --- | --- |
| Goblin Warband vs Gnome Warband | goblins **55.0%** / gnomes 45.0% | 95 / 116 | 14.1 / 15.4 |
| Goblin Warband vs Dwarf Warband | goblins **49.4%** / dwarves 50.6% | 98 / 97 | 4.6 / 14.7 |
| Gnome Warband vs Dwarf Warband | gnomes **51.4%** / dwarves 48.6% | 137 / 111 | 8.5 / 11.5 |

Before this work (same sims, old decks, same AI): dwarves lost 89% to gnomes and 75% to goblins. After the decks but before the Bearer change: dwarves lost 94% to both.

The other nine decks against the other factions' Warbands (48 paired matches each, noise about +-7%; a sanity sweep, not a balance target: Ken's A/B/C shapes are deliberate experiments):

| Deck vs Warband | Winner share (deck / Warband) | Crystals mined | Turns |
| --- | --- | --- | --- |
| Goblin Mine Rush vs Gnome | 35% / 65% | 146 / 126 | 30 |
| Goblin Mine Rush vs Dwarf | 54% / 46% | 173 / 90 | 27 |
| Goblin Arcane Hoard vs Gnome | 38% / 62% | 128 / 120 | 32 |
| Goblin Arcane Hoard vs Dwarf | 40% / 60% | 161 / 103 | 31 |
| Goblin Expedition vs Gnome | 48% / 52% | 111 / 121 | 33 |
| Goblin Expedition vs Dwarf | 54% / 46% | 118 / 92 | 29 |
| Gnome Mine Rush vs Goblin | 31% / 69% | 183 / 125 | 33 |
| Gnome Mine Rush vs Dwarf | 29% / 71% | 223 / 108 | 32 |
| Gnome Arcane Hoard vs Goblin | 50% / 50% | 148 / 92 | 33 |
| Gnome Arcane Hoard vs Dwarf | 71% / 29% | 178 / 104 | 31 |
| Gnome Expedition vs Goblin | 40% / 60% | 106 / 93 | 31 |
| Gnome Expedition vs Dwarf | 40% / 60% | 136 / 116 | 32 |
| Dwarf Mine Rush vs Goblin | 60% / 40% | 240 / 121 | 34 |
| Dwarf Mine Rush vs Gnome | 29% / 71% | 224 / 156 | 34 |
| Dwarf Arcane Hoard vs Goblin | 69% / 31% | 141 / 101 | 28 |
| Dwarf Arcane Hoard vs Gnome | 73% / 27% | 161 / 145 | 30 |
| Dwarf Expedition vs Goblin | 54% / 46% | 124 / 106 | 30 |
| Dwarf Expedition vs Gnome | 50% / 50% | 126 / 164 | 32 |

Reading: the Mine Rush decks mine far more than anything else but mostly lose (too few fighters to turn crystals into damage), except the dwarf one against goblins; the Dwarf Arcane Hoard (5 Ironclad Bulwarks, 3 Thunderhorn Blasts) is the strongest non-Warband deck. Every deck plays to the end with the computer (AC114 covers all four styles).

## 5. Checks
- Hidden checks, targeted run on the final build (33 checks: AC6, AC8, AC10, AC11, AC27, AC45, AC50, AC72, AC95, AC112/128, AC113, AC114 x4, AC117, AC144, AC145, AC254, AC285, AC302, AC407, AC409, AC417, AC422, AC423): **33 passed**.
- Full run of the whole spec on the build before the two gnome cost changes (helper, PW_WORKERS=4): 435 passed, 18 failed, 6 flaky, 32 skipped. Every failure is known on the untouched branch (AC212/AC326 local line endings; AC158 12 px picker buttons; AC219, AC256, AC261, AC364, AC368, AC370/372, AC375) or a load timeout that passes alone (AC40, AC110, AC148, AC190). The two cost changes touched AC8 and AC27 only, both re-run green.
- Unit tests (vitest, 195): 184 pass; the 11 failures are the same long-standing owner-asset, art-frame, card-back, round12b-model and "R8 new cards" (Shard Guzzler weapon) failures as on the untouched branch. New tests: owned-mine Tunnel, Riot Shield Bearer as a Miner (walks, mines 2, no attack, survives, not greyed out).
- Headless replays of AC21 and AC114 (tools/ai-sim/replay.ts): Medium beats a passive player by turn 28; all four styles play to a winner.
- Deck picker at 844x390: three stacks show at a time with the arrow for the fourth (screenshot in the targeted run's test-results); AC117 passes.
- Not done: no Vercel preview (batch mode; main Anvil's checkpoint). The GDD and this report are on local branch gdd-decks-oct31 (worktree r28/gdd31) for main; the game change is local branch decks-oct31 (4079e824).

## Found on the way (not changed; Ken's calls)
- Grubnak's creature discount is the strongest Commander bonus by far; Knobbin's spell discount barely matters to the computer. If Ken ever wants the Commanders closer, that is where the lever is.
- The Deck Builder's "Remove / Copy" buttons in the deck picker are 12 px on the phone (AC158), which already failed before this work; with four stacks per faction there are more of them.
- Overclocked Aethervein (5-cost Miner) slows an opening noticeably; it is only in the Gnome Expedition now.

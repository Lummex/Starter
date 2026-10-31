# 2026-10-31 Anvil (AI desk): dwarf fix — the Riot Shield Bearer is a wall, the Anvilsworn is the Miner, Warbands at 30 Miners

Forge's job (Ken's words): "The riot shield guys are not supposed to be miners ... way too overpowered. They're supposed to be just like a blocking unit. They can mine, but they're more as like an immovable object ... protect your miners or protect your commander ... They don't even carry a weapon ... They just do a little bit of damage and a lot of blocking." Later: "there's still not enough miners in the deck ... the miners get killed so quick to get crystals."

**Handoff:** game branch `dwarves-fix-oct31` in the shared clone (worktree `C:/Users/kentu/AppData/Local/Temp/r28/dwarves`), on top of factory/issue-8 8de33985; the checks/tests branch `dwarves-checks-oct31` (worktree `r28/dwchecks`) is merged into it. Nothing committed to factory/issue-8 or main. Design doc + this report + notes on branch `gdd-dwarves-oct31` (worktree `r28/dwgdd`, from main). Main Anvil merges both.

## 1. The two cards (old -> new)

| Card | Old (Oct 31 morning) | New |
| --- | --- | --- |
| **Riot Shield Bearer** (`dwarf-miner`) | Gatherer (the dwarves' basic Miner), cost 2, 1/5, abilities gather + riotShield + tunnel. Riot Shield: first 3 turns can't attack and can't be killed, could walk and mine 2 | **Fighter, cost 4, 1/5, move 1, Riot Shield only.** Riot Shield = enemies next to it must attack it first (Guard) + every hit it takes does 1 less (Armored) + immovable: nothing can knock it back, bowl it, lift it or shove it (Enforcer, Smack, Shockwave, Door Splitter, death-knock, Plow, the Bowler, the Junk Shaman). No 3-turn lock: it attacks from its second turn like any Fighter (hits for 1), it can be killed, and as a Fighter it mines 1. Not a Miner: no Tunnel, never free, never found by the Miner swap. Card text: "Riot Shield. Enemies next to it must attack it first. Every hit does 1 less. Can't be moved." |
| **Anvilsworn Miner** (`dwarf-smith-miner`) | Smith, cost 2, 1/1, smith | **The dwarves' basic Miner** (`basicGatherers.dwarves`): Smith, **cost 1**, 1/1, smith + tunnel. Mines 2, Tunnel beside a mine you own, free when broke, found by the Miner swap and the opening-hand rescue; still playable onto your own creature for +1 Attack +1 Health. Text: "The dwarves' Miner. Mines 2. Tunnel. Or upgrade a creature: +1 Attack, +1 Health." |

Why the Anvilsworn: it is the only dwarf card whose owner art is a Miner (pickaxe and headlamp). The Ironjaw Big Back is a bare-fisted brawler, the Deepdelver a Rare at cost 7, the Bearer carries only the shield. "They can mine": as a Fighter the Bearer mines 1, slowly, which fits Ken's words without making it a cheap mass Miner. Why cost 1: at cost 2 the dwarves mined half of what the others mined (86 vs 140 crystals a match) and lost 68-78% of their matches; at cost 1 their economy matches the others. No other card number changed.

Engine: `knock()` returns at once for a riotShield unit; `hurt()` takes 1 off (like Armored) and the old lock is gone; the Guard filter in `attackTargets` includes riotShield; the bowl line and both Shaman-lift lists skip it; `lockedUntil` is 0 at spawn. AI: `effectiveDamage` and the spell-kill estimate treat Riot Shield like Armored. abilities.json has a `riotShield` entry.

## 2. Starter decks

Ken (later on Oct 31): Miners are half the Warband (30 of 60, never under 28) for all three factions; the other styles keep his ratios. `tools/gen-starter-decks.py` -> `src/content/starter-decks.json`; game-config `starterDeckMix` 50 creatures / 6 spells / 4 Crystal / 30 Miners.

| Deck | Miners | Fighters | Spells | Crystal |
| --- | --- | --- | --- | --- |
| Goblin / Dwarf Warband | 30 | 20 | 6 | 4 |
| Gnome Warband | 30 | 17 | 9 | 4 |
| Mine Rush | 45 | 15 | 0 | 0 |
| Arcane Hoard | 30 | 15 | 15 | 0 |
| Expedition | 24 | 21 | 9 | 6 |

- **Goblin Warband:** Goblin Miner 22, Scrapsmith 8; Grunt 5, Thief 2, Bomber 2, Skullflinger 3, Rusher 3, Shiv Rat 1, Bowler 1, Troll Tyrant 2, Mangewolf Rider 1; Venom Shiv 2, Pickpocket! 2, Snuff Out 1, Rat-Tunnel Ambush 1; Soul Cluster 2, Wellspring Geode 1, Heart of the Fallen 1.
- **Gnome Warband:** Gemsinger 24, Arcsmith 6; Gearward Sentinel 5, Brawler Adept 4, Hexslinger 3, Stormcaller 2, Iron Scarab 1, Voldawright 2; Searing Arcane Orb 3, Starfall 2, Unweave 2, Snuff Out 1, Field Bandage 1; Soul Cluster 2, Wellspring Geode 1, Heart of the Fallen 1. (Spell-heavier than the other two: Knobbin's spell discount is the gnomes' edge; with the plain 20/6 shape the goblins won 58%.)
- **Dwarf Warband:** Anvilsworn 27, Gemdrunk Deepdelver 3; Riot Shield Bearer 4, Granite Oathkeeper 4, Marksmen Gunner 4, Barrelback Courier 3, Ironwall Shieldbeard 1, Oathbound Overwatch 1, Grimhold Ravager 2, Door Splitter 1; Thunderhorn Blast 3, Ironclad Bulwark 2, Snuff Out 1; Soul Cluster 2, Wellspring Geode 1, Heart of the Fallen 1.
- **Dwarf Mine Rush:** Anvilsworn 42, Deepdelver 3; Bearer 3, Oathkeeper 4, Gunner 4, Courier 2, Shieldbeard 2.
- **Dwarf Arcane Hoard:** Anvilsworn 27, Deepdelver 3; Bearer 3, Oathkeeper 4, Gunner 3, Courier 2, Overwatch 2, Shieldbeard 1; Ironclad Bulwark 5, Thunderhorn Blast 3, Emergency Rations 2, Field Bandage 2, Snuff Out 2, Desperate Plunder 1.
- **Dwarf Expedition:** Anvilsworn 21, Deepdelver 3; Bearer 4, Oathkeeper 4, Gunner 4, Courier 3, Shieldbeard 2, Overwatch 1, Ravager 2, Door Splitter 1; Bulwark 3, Blast 3, Rations 1, Snuff Out 1, Field Bandage 1; Soul Shard 2, Soul Cluster 2, Wellspring Geode 1, Heart of the Fallen 1.
- The goblin and gnome Mine Rush / Arcane Hoard / Expedition decks are unchanged from the morning report.

## 3. Win rates (headless, Medium vs Medium, every seed from both sides, decision budgets off, 360 paired matches per pairing, noise about +-2.6%)

| Warband vs Warband | Morning (22 Miners, Bearer = Miner) | Bearer a wall, Anvilsworn cost 2 | **Final: Anvilsworn cost 1, 30 Miners** |
| --- | --- | --- | --- |
| Goblins vs Dwarves | 49 / 51 | 68 / 32 | **35 / 65** |
| Gnomes vs Dwarves | 51 / 49 | 78 / 22 | **59 / 41** |
| Goblins vs Gnomes | 55 / 45 | 58 / 42 | **49 / 51** |

The goblin-gnome pairing is on target. The two dwarf pairings are not, and the reason is measured: the faction triangle (`typeAdvantageBonus` 1: dwarves hit goblins for +1, gnomes hit dwarves for +1, goblins hit gnomes for +1). With Miner-heavy decks a +1 swing one-shots 1-Health Miners, so the advantaged side wins the Miner war. Nothing deck-side moved it: the Bearer at cost 5 (66%), a wall-heavy dwarf deck with 7 Bearers (64%), a thief/bomber goblin deck (65%), a plain non-Smith cost-1 dwarf Miner (58%, but then gnomes beat dwarves 58%) all left goblins-vs-dwarves at 58-66% for the dwarves.

**Same decks with the faction bonus switched off (sim only, not changed in the game):** goblins vs dwarves 46 / 54, gnomes vs dwarves 44 / 56, goblins vs gnomes 43 / 57. Everything lands inside 45-55 or a hair outside (the plain 20/6 gnome deck without the bonus gives 51 / 49 vs goblins but 30 / 70 vs dwarves, so the spell-heavier gnome Warband is the right one either way). **Ken's call:** keep the triangle (then dwarves beat goblins about 65% and lose to gnomes about 59% at 30 Miners, which is the triangle doing what it says), or lower it (0, or keep it for Fighters only) and the Warbands balance by themselves.

## 4. Miner survival (Forge/Ken: "the miners get killed so quick")

Per side per match, Medium vs Medium, Warband vs Warband. "After N turns" = after each side has played N turns.

| | Miners summoned | Miners lost | Avg life (single turns) | After 5 turns: alive / lost / crystals mined | After 8 turns: alive / lost / mined |
| --- | --- | --- | --- | --- | --- |
| Before, 22 Miners (goblins / gnomes / dwarves, averaged over their pairings) | 14 / 14 / 8.5 | 65-73% / 48-70% / 68-79% | 6.4-6.7 / 6.9-7.1 / 6.9-8.5 | 3.5-3.9 / 0.1-0.7 / 16-17 | 4.2-5.2 / 1.7-2.6 / 39-45 (gob), 4.8-5.4 / 1.5-2.1 / 44-47 (gno), 2.7-3.4 / 1.5-2.3 / 32-37 (dwf) |
| **After, 30 Miners + fix** | 17.6-17.9 / 15.5-17.1 / 16.6 | 70-74% / 51-62% / 59-78% | 5.5-6.1 / 6.6-7.0 / 6.1-6.9 | 3.6-4.6 / 0.2-1.1 / 17-20 | 4.9-6.7 / 2.3-3.7 / 42-53 (gob), 6.2-7.1 / 1.5-2.3 / 51-54 (gno), 4.8-6.5 / 2.0-3.6 / 48-57 (dwf) |

Reading: Miners almost never die in the first 5 turns (0.2-1 lost); the dying starts when the fighters arrive, and by the end about two thirds of all Miners are dead, each living about 6-7 single turns (3 of its own). The bigger count does not make a Miner live longer; it keeps more of them alive (5-7 on the board after 8 turns instead of 3-5) and banks about 15% more crystals by turn 8. The dwarves' economy is now level with the others (they used to have 3 Miners alive after 8 turns, now 5-6).

**Measured for Ken (not changed):** basic Miners at 2 Health (Goblin Miner, Gemsinger, Anvilsworn 1/2): Miners lost drops to 45-73%, average life +0.5-1 turn, crystals by turn 8 up 1-3; but the dwarves (Borgo makes theirs 1/3) then beat goblins 74%, so it needs the triangle question answered first. **Recommendation:** if Ken wants Miners to live longer, the cheapest fair lever is a rule, not a stat, because +1 Health on the basic Miners lands unevenly (Borgo's +1 stacks on it). Today the Riot Shield Bearer already does the job Ken described (enemies beside it must hit it first), so a Bearer next to a mine shields the Miners there. A rule such as "a Miner standing next to a mine takes 1 less damage" would help all three factions alike. Ken decides.

## 5. Checks and tests
A helper (Opus) rewrote the checks and tests in its own worktree from my exact rule list while I ran the sims; I merged it (812a731b) and re-ran everything on my own build (dist of the merged branch, port 4221).
- Hidden checks touched or named (53 at desktop size, 11 phone variants skipped as usual): **53 passed, 0 failed.** Changed, all marked "Owner check change (Ken, Oct 31 dwarf fix ...)" or "(Ken, Oct 31: Miners are half the Warband)": AC6 x3 (per-faction Warband table at the top of the spec: `WARBAND`, `DWARF_FIX`, `BASIC_MINER`; dwarf basic = Smith = the same card; gnome cheap-fighter floor 16 -> 14), AC13 (the plain non-Guard unit is a Big Back now, since the Bearer guards), AC27 (Bearer cost 4; summon steps 30 -> 26 -> 20 -> 14 -> 4), AC45 (Bearer role fighter [4, 1, 5, 1]; Anvilsworn [1, 1, 1, 1]), AC95 (seed 1: the new decks changed who goes first on seed 4), AC112/AC128 (Warband mix per faction: creatures 50/47/50, spells 6/9/6, 4 Crystal, 30 Miners), AC254 (the opponent Tunnels an Anvilsworn; a Bearer beside the owned mine is refused), AC302 (rewritten as the wall: Guard, 1 less per hit, not knocked, a Ram Rider leaves it at 3, it can die, attacks on its second turn, never free), AC404 (never liftable, lock 0), AC407 (new seeds 41 redraw / 37 redraw: Bearers are not Miners / 1 keep), AC411 (texts), AC422 (one free Anvilsworn, the second costs 1, a Bearer is never free). No new AC numbers.
- Helper's full suite on the same content: 472 passed, 13 failed, 4 flaky-then-passed, 31 skipped; every failure is known on the untouched branch (AC212/AC326 local layout bytes, AC364/AC370/372/AC379 hand-drag timing, AC375, AC441, AC219 deal timing 172 vs 160 ms, AC261 load timeout).
- Unit tests: engine, round16, ai-oct30 (goldens re-recorded, comment says why; the AI is untouched), ai-referee: 97 of 98 pass; the one failure is the long-standing "R8 new cards" (Shard Guzzler weapon). Helper's full vitest: 187 pass, 8 fail, all 8 pre-existing.
- Headless engine probe (16 rules: Guard, 1 less, 0 from a 1-hit, kill, Enforcer can't knock, Bowler can't bowl, Shaman can't lift, attacks on turn 2, free Anvilsworn once, Bearer never free, Tunnel for the Anvilsworn only, Miner swap): all pass.
- Not done: no Vercel preview (main Anvil's checkpoint); the Studio/editors need no change (ids, art and models are unchanged).

## Found on the way (not changed)
- Grubnak's "goblin creatures cost 1 less (minimum 1)" does nothing for cost-1 Miners, while Borgo's +1 Health lands on every one of 30 Miners. With Miner-heavy decks the Commander bonuses are no longer even; the triangle bonus hides this today.
- The sim's `CONFIG_TUNE='{"typeAdvantageBonus":0}'` and `CARD_TUNE` overrides make these experiments a one-line change; `PERMATCH=1` lines now carry Miner deaths and snapshots after 5 / 8 / 12 turns each (`tools/ai-sim/sim.ts`).

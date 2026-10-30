# Stacking effects: proposal (Anvil, design desk, 2026-10-30)

Ken, Oct 30: "I also want spells and abilities to be stackable, like the poison. I want you to be able to stack those to where they'll basically double the effect."

This is a design proposal only. No game code was changed. Everything below was read from the live game at factory/issue-8 commit 9f261fb (engine.ts, cards.json, game-config.json, app.ts) and the design doc on main (oreheart-gdd-v2.md). Line numbers are from that commit.

## 1. The rule in plain English

**When the same lasting effect lands on a unit (or a player) that already has it, the strengths add up and the clock keeps the longer of the two.** The unit shows a small gold **x2** or **x3** on the effect's icon. Nothing stacks past **x3** (one number in game-config, `stackCap: 3`), and a few effects are capped lower or don't stack at all, listed in part 3.

Exact numbers, using poison as the example:

| What happens | Today | Proposed |
| --- | --- | --- |
| Venom Shiv on a clean enemy | 1 damage at the start of each of its next 7 turns, no healing | same |
| A second Venom Shiv on the same enemy | the 7-turn clock restarts; damage stays 1 | **2 damage** a turn; clock = the longer of (turns left, 7); badge x2 |
| A third | clock restarts | **3 damage** a turn; badge x3 |
| A fourth | clock restarts | still 3 a turn (cap); clock = the longer of the two |
| "No healing" | while poisoned | while any poison is left (unchanged) |

"Longer of the two", not "added together": a poison with 3 turns left plus a fresh 7-turn one lasts 7 more turns, not 10. That keeps the maths readable on the card and stops a 20-turn poison.

Permanent things that already pile up with no cap today (Smith upgrades, Bloodbeard's Grit, Motherlode's discount) stay as they are; they are listed in part 2 so nobody "fixes" them.

## 2. Inventory: every effect that lasts or repeats, and what a second one does today

Where it lives: all in `projects/oreheart-8/src/engine/engine.ts` unless said otherwise. "Refresh" = the clock restarts, "ignored" = the second copy does nothing, "adds" = it already stacks.

### A. Effects on a unit

| # | Effect | Source card(s) | How it is stored | Applied twice today | Where |
| --- | --- | --- | --- | --- | --- |
| 1 | **Poison** | Venom Shiv (spell, 2) | `c.poison` = turns left; damage is `CONFIG.poisonDamage ?? 1` | **Refresh** to 7 turns, damage still 1 | cast: line 806; tick: 343-349; blocks healing: 336, 407 |
| 2 | **Shield X** | Aegis Tinkerer (Fix-it, adjacent allies +1), Glyphshield Warden (self +1), Madame Sprocket (locked Commander, lowest-Health ally +1) | `c.shield` (number) | **Adds** within the turn (two Tinkerers next to a unit = Shield 2), then wiped at the start of the owner's next turn | grant: 352-358; wipe: 340; block: 433 |
| 3 | **Shield bubble** ("takes no damage from the next hit") | Ironclad Bulwark (instant, 2) | `c.bubble` = true/false | **Ignored** (true stays true) | cast: 812; pop: 432 |
| 4 | **Ward** (no damage, can't attack, one round) | Glyphshield Warden ability (2 crystals, once per turn per Warden) | `c.wardUntil` = turn + 2 | **Refresh** (same end turn) | 596, 669-673; blocks attack 489, abilities 573, damage 428 |
| 5 | **Riot Shield** (3 rounds: can't act, can't be hurt) | Riot Shield Bearer, on summon only | `c.lockedUntil` = turn + 6 | can't happen twice | 56, 428, 486 |
| 6 | **Rooted** ("can't move for the rest of its next turn") | Grudge Hurler (Hobble) when it damages an enemy | `c.rootUntil` = turn + 2 | **Refresh** (a second Hurler hit the same turn changes nothing) | 550; blocks moving 705 |
| 7 | **Drunk** (2 rounds, can't be healed) + brew-save (survives one lethal hit at 1 Health) | Corpsman Brewlord (Brew) | `c.drunk` = rounds, `c.brewSave` | can't happen: Brew can't target a drunk dwarf | 890, 900-906; blocks healing 336, 407 |
| 8 | **Brawler** (Attack doubled the round after a fight) | Grimhold Ravager | `c.lastFight` | **Refresh** (x2 is x2, never x4) | 478, 541-542 |
| 9 | **Grit** (+1 Attack for good when it survives a hit, +1 per 2 kills) | Bloodbeard Berserker | `c.attack` goes up | **Adds**, no cap | 544-545 |
| 10 | **Smith upgrades** (+1 Attack +1 Health for good) | Scrapsmith / Arcsmith / Anvilsworn Miner | `c.upgrades`, `c.attack`, `c.maxHealth` | **Adds**, no limit (owner setting in the design doc) | 1214 |
| 11 | **Hearty Ale** (+1 Health until next turn) | nobody: the ability `heartyale` is still in abilities.json and the engine, but no live card has it (the Brewlord became Corpsman Brewlord with Brew) | `c.ale` | adds | 334, 354 |
| 12 | Illusion (takes 35% less damage) | Mirrorveil Illusionist's copy | `c.illusion` | n/a | 435 |

### B. Attack bonuses worked out at hit time (not stored on the unit)

| # | Effect | Source | Applied twice today | Where |
| --- | --- | --- | --- | --- |
| 13 | **Thunderhorn Blast** (+1 Attack to all your creatures this turn) | spell, 3 | **Ignored**: `s.flags.battleCry = p` is a yes/no flag; a second cast is still +1 | 807; used 480; reset 328 |
| 14 | **Rally** (+1 Attack to all your Goblins) | Gronkowski Troll Tyrant | **Ignored**: "is there any Tyrant on the board" | 476 |
| 15 | **Junk Boost** (+1 Attack to adjacent Goblins on your turn) | Bowler Brawler, Junk Shaman | **Ignored**: "is any booster adjacent" | 468-471 |
| 16 | Type advantage, Brawler, Delver (+1 Attack per banked crystal) | rules / cards | not stackable by nature | 475-481 |
| 17 | Frenzy, Rage | nobody (in config and engine, no live card) | n/a | 475, 479 |

### C. Effects on the player

| # | Effect | Source | Applied twice today | Where |
| --- | --- | --- | --- | --- |
| 18 | **Desperate Plunder** (+3 Flow a turn while the enemy has more Flow) | spell, 0; card text already says "Stackable" | **Adds** (`pl.plunder++`, +3 per copy), all copies stop together once you are ahead | 792, 294, 313 |
| 19 | **Wellspring Geode** (+1 Flow a turn for good) | crystal card, Unique | a second one **can't be played** | 946, 1109 |
| 20 | **Motherlode** (next creature costs 2 less) | crystal card | **Adds** within the turn (two = 4 less), cleared after the next creature | 1110, 1190 |
| 21 | Commander abilities (Grubnak discount, Sproingle discount, Borgo +1 Health) | fixed | n/a | 44-47 |

### D. One-shot heals (nothing to stack; health never goes over full)

Field Bandage (to full), Emergency Rations (4), Corpsman (7 per round among adjacent allies, line 393), Brew heal (3).

So: **21 lasting or repeating effects in the live game, of which 6 would change behaviour, 5 already stack, 7 are exceptions, and 3 are dead or fixed.**

## 3. Effect by effect: stack, cap, or exception

Universal cap: x3. The table says where a lower cap or an exception is better, and why.

| Effect | Proposal | Cap | Why |
| --- | --- | --- | --- |
| Poison | **Stacks**: damage per turn = number of daggers; clock = longer of the two | x3 | Ken's example. 3 a turn for 2 crystals each kills a 6-Health Collector in two of its turns; x4 would be 1 crystal per point of damage every turn, too cheap. |
| Shield X | **Already stacks** (two Tinkerers = Shield 2); no change | none needed | Shield is wiped at the start of your next turn, so it can't snowball. The badge already shows the number. |
| Shield bubble (Bulwark) | **Stacks**: two Bulwarks block the next two hits; store a count instead of yes/no | x3 | Each costs 2 crystals and blocks one hit, so stacking is fair. Not unkillable: it still runs out. Follow-up for Ken: the bubble never expires today (card says "next hit", the design doc says "this turn"); decide which, separately. |
| Ward | **Exception: no stacking**; a second Ward refreshes the clock as today | n/a | A warded unit takes no damage at all. Stacking length would make a unit unkillable for turns while it can't fight (a stall). Two Wardens already refresh it each turn if you pay; that's enough. |
| Riot Shield | **Exception**: summon-only, can't stack | n/a | Nothing re-applies it. |
| Rooted (Grudge Hurler) | **Stacks in length**: a second hit while rooted holds it one more turn (`rootUntil + 2`) | x2 (never more than its next 2 turns) | Control stacking is the stun-lock trap. x2 rewards two Hurlers aiming at one target but can't freeze a unit forever. It can still attack while rooted, so it's not a stun. |
| Drunk / brew-save | **Exception: no stacking** | n/a | Drunk is a drawback (no healing). Making it longer would punish the player for using Brew twice. Brew already refuses a drunk target. |
| Brawler | **Exception**: x2 is x2, never x4 | n/a | Doubling a doubled Attack is silly (a 3-Attack dwarf hitting for 12). |
| Grit, Smith upgrades, Motherlode, Plunder | **Already stack, unchanged** | none (owner setting) | Keep as Ken set them. Plunder stops by itself once you're ahead; Motherlode is spent on the next creature. |
| Thunderhorn Blast | **Stacks**: count casts per player this turn; +1 each | x2 (max +2 this turn) | Army-wide Attack. Five creatures next to the enemy Commander with +3 would be +15 Commander damage in one turn for 9 crystals; +2 is already a big swing. |
| Rally (Troll Tyrant) | **Stacks**: +1 per Tyrant on the board | x2 (max +2) | A permanent army-wide aura. Three Tyrants (copy limit 3) with +3 to every Goblin would be the only way to play. x2 for 14 crystals of Tyrants is fair. |
| Junk Boost (Bowler, Shaman) | **Stacks**: +1 per adjacent booster | x2 (max +2) | Needs both next to the same Goblin, so it rewards positioning. Same army-aura reasoning as Rally for the cap. |
| Geode | **Exception: stays Unique** | n/a | +1 Flow for good every turn. If Ken wants it stackable, x2 and the Unique word comes off the card; recommend keeping it. |
| Heals | nothing to stack | n/a | Health never goes over full. |

Readability and kid-friendliness: every stackable effect is "same icon, small x2/x3", never a new icon or a new word. Card text gets at most one short sentence.

## 4. What changes where

### Card texts (cards.json `text` and `shortText`; 7 cards; wording only where the rule is new)

| Card | Add to the end of the text |
| --- | --- |
| Venom Shiv | "Stacks: each extra dagger adds 1 damage a turn (up to 3)." |
| Ironclad Bulwark | "Stacks: two Bulwarks block the next two hits." |
| Thunderhorn Blast | "Stacks once: two Blasts give +2." |
| Gronkowski Troll Tyrant | "Two Tyrants: +2." |
| Bowler Brawler | "(up to +2 with the Junk Shaman)" after "Nearby Goblins get +1 Attack" |
| Junk Shaman | "(up to +2 with the Bowler Brawler)" after "+1 Attack" |
| Grudge Hurler | "A second hit holds it one turn longer." |

Desperate Plunder already says "Stackable". No other card text changes. The Warden, Brewlord, Riot Shield Bearer and Grimhold Ravager keep their texts (their behaviour doesn't change).

### Design doc (oreheart-gdd-v2.md on main)

Note: the design doc's card table is behind the live cards.json (it still has the Forgefire Brewlord with Hearty Ale, a Rune-Splitter with Armored, no Hobble on the Grudge Hurler, and old names such as Gutcrusher the Troll Tyrant). The lines below are by their current names.

1. **Combat section**, after the "Shield X" bullet: new bullet "**Stacking:** when the same lasting effect lands on a unit that already has it, the strengths add and the clock keeps the longer of the two, shown as x2 / x3 on the icon. Nothing stacks past x3; Thunderhorn Blast, Rally, Junk Boost and Rooted stop at x2; Ward, Drunk, Riot Shield and Brawler never stack."
2. **Shield X bullet**: add "Shield from several sources adds up within the turn."
3. **Venom Shiv row**: add "Stacks (up to 3 damage a turn); the clock keeps the longer of the two."
4. **Ironclad Bulwark row**: add "Stacks: each copy blocks one more hit."
5. **Thunderhorn Blast row**: add "Stacks once (+2 max)."
6. **Troll Tyrant row** and **Junk Shaman row**: add "+2 max with a second source."
7. **Grudge Hurler row** (needs adding, Hobble isn't in the doc): "Ranged 5 in lines; a damaged enemy can't move during its next turn; a second hit holds it one turn longer (max 2)."
8. **Tuning list at the end**: add "Stack cap (3) and the x2 caps for army-wide Attack and Rooted."

### Game config (game-config.json)

`"stackCap": 3`, `"auraStackCap": 2` (Blast, Rally, Junk Boost), `"rootStackCap": 2`. Poison damage per dagger stays `poisonDamage` (1).

### Engine (for the builder, when Ken says go; not done now)

- Poison: keep `c.poison` (turns) and add `c.poisonStacks` (1..stackCap). Cast: `poisonStacks = min(cap, poisonStacks + 1)`, `poison = max(poison, 7)`. Tick: damage = `poisonDamage * poisonStacks`. The `poisoned` and `poison` events carry `stacks`.
- Bulwark: `c.bubble` (boolean) becomes `c.bubbles` (count, cap 3); `hurt()` takes one per blocked hit. Keep `c.bubble` readable as `bubbles > 0` for old tests and saves.
- Thunderhorn: `s.flags.battleCry` becomes `{ player: 0, opponent: 0 }`; cast adds 1 (cap 2); `atkValue` adds the count.
- Rally: count Tyrants, `min(2, n)`. Junk Boost: count adjacent boosters, `min(2, n)`.
- Rooted: if `rootUntil > turn`, `rootUntil = min(rootUntil + 2, turn + 4)`, else `turn + 2`.
- Test setup hook (line 193): accept `poisonStacks` and `bubbles` on board entries.
- AI (ai.ts line 84): today it scores a second Venom Shiv on a poisoned target at 0. Let it re-poison while `poisonStacks < cap`, at about half the first-cast score, so the computer uses the new rule too.
- Saved matches: new fields default to 1 stack / 0 bubbles, so old saves load.

### UI (app.ts `renderStatusIcons`, line 2560, and the token badge, line 2528-2537)

- A small gold **x2 / x3** chip on the top-right of the effect's icon above the unit (poison, shield bubble, rooted) when stacks > 1. The turns-left number stays where it is.
- The poison mark next to the stat badge reads `💧7` today; with stacks it reads `💧7 x2`.
- Tooltips / aria-labels: "Poisoned x2: 2 damage a turn, 6 turns left", "Shield bubble x2: blocks the next 2 hits", "Rooted for 2 more turns".
- Thunderhorn Blast has no icon today; the attack preview box ("You deal 3") already uses `atkValue`, so it shows the stacked number by itself. Suggest a small "+1 / +2 Attack this turn" icon on every unit while the Blast is on (one new icon picture, `icon-attackup.webp`, in Ken's pop-icon style: Brush).
- The Rally and Junk Boost +2 show in the attack preview and in the card pop-out stats; no new icon needed.
- The card pop-out (line 769 area) lists lasting effects with their stack: "Poison x2 (2 a turn, 6 turns left)".
- Editors: nothing in the Model Editor or Card Editor shows stacks; no editor change.

### Checks to add (hidden tests; next free numbers were AC397+ at 9f261fb, the main Anvil session may have used some since)

1. Poison x2: cast Venom Shiv twice on the same enemy; `poisonStacks` 2, `poison` 7; at the start of its turn it takes 2 and can't heal. Third cast: 3 a turn. Fourth: still 3.
2. Poison clock: a target with 3 turns left poisoned again has 7 left, not 10.
3. Poison badge: the icon shows "x2" and the aria-label says "2 damage a turn".
4. Bulwark x2: two casts block the next two hits (both `shieldBlock` events), the third hit lands; the icon shows x2.
5. Thunderhorn x2: two casts this turn give +2 Attack (attack preview and real damage); a third cast still +2; back to +0 next turn.
6. Rally: two Tyrants give Goblins +2, three give +2.
7. Junk Boost: a Goblin next to both the Bowler Brawler and the Junk Shaman hits for +2 on its owner's turn, +0 on the enemy's turn.
8. Rooted x2: two Grudge Hurler hits in one turn root the target for its next two turns; a third hit doesn't make it three.
9. Exceptions: a second Ward on the same unit only refreshes the clock; Brew still can't target a drunk dwarf; a second Geode is still unplayable; Grimhold Ravager never exceeds x2.
10. AI: with two Venom Shivs in hand and one enemy, the computer casts the second one.
11. Card text: the 7 cards above show the new sentence in the card view (and the text still fits the box: `textScale`).
12. Existing checks to re-run, since they touch these fields: AC15 (Shield 1 blocks 1), AC18/AC306 (Bulwark), AC131/AC288 (poison 7 turns), AC299 (Ward), AC302 (Riot Shield), AC304 (Hobble), AC308 (Plunder), AC331/AC332 (Brew/Drunk).

## 5. Size of the change

- Cards whose behaviour changes: 7 (Venom Shiv, Ironclad Bulwark, Thunderhorn Blast, Troll Tyrant, Bowler Brawler, Junk Shaman, Grudge Hurler).
- Effects that change: 6 (poison, shield bubble, Thunderhorn, Rally, Junk Boost, Rooted).
- Effects that already stack and stay: 5 (Shield X, Grit, Smith upgrades, Motherlode, Plunder).
- Exceptions (never stack): 7 (Ward, Riot Shield, Drunk, Brawler, Geode, heals, Commander abilities).
- Files: engine.ts, ai.ts, cards.json, game-config.json, app.ts (+ CSS for the chip), one new icon picture, the design doc, 10-12 new hidden checks.
- Batch score suggestion: 10 points (a rules and combat change), so a full check runs right after it.

## 6. Follow-ups noticed on the way (not part of this job)

- Riot Shield Bearer: the Junk Shaman's "can't lift a shielded unit" check reads `o.riotShield`, a field no creature has (the ability lives in the card's `abilities` list). So the Shaman can lift a Riot Shield Bearer today (engine.ts 593, 1450, 1456).
- Ironclad Bulwark's bubble never expires (card says "next hit", design doc says "this turn"). Ken's call.
- Dead abilities still in abilities.json and the engine with no card: Hearty Ale, Frenzy, Rage, Ka-boom 2, the three Crystal Eater drawbacks (unused since Round 10 removed the one-crystal-card-per-turn rule), Medic. The design doc's card table is behind cards.json (names, Hobble, Grit, Brawler, Corpsman).

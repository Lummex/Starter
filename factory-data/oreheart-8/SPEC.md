# OreHeart — Phase 1a Build Spec (Revision 5)

## Summary

Oreheart is a comic-style fantasy card battle in the browser. Goblins, Gnomes and Dwarves fight over three randomly placed crystal mines on a hidden 13×7 grid, and you win by bringing the enemy Commander from 20 Health to 0. Phase 1a delivers **one complete, playable match against a computer opponent (Easy or Normal) plus a guided tutorial match**. It is built on a pure, data-driven rules engine that could later run on a server, and uses simple placeholder 3D visuals on a **landscape** screen. Rules, numbers and cards come from `factory-design/design/oreheart-gdd-v2.md` (the GDD). Scope comes from `factory-design/design/oreheart-phase-1a-brief.md` (the brief, including its "Revision 5", "Revision 4", "Revision 3" and "Revision 2" sections). Where this spec and the GDD disagree, **this spec wins**, because it settles GDD gaps for testing.

Tech: Vite + TypeScript (vanilla or React), Three.js for the 3D scene, static `dist/` output, no backend.

### Revision 5 changes (summary for builders who saw revision 4) — READ FIRST

Revision 5 comes from the owner's third playtest. **Where any older line in this spec disagrees, Revision 5 (this section) wins.** Rev 4's "flow from standing at a mine" is replaced by a **mining action**.
- **R5.1 Board 13 wide × 7 deep.** `row` 1–7 (top to bottom), `col` 1–13. Strongholds at **(1,7)** (opponent) and **(7,7)** (player). Back rows are rows 1 and 7 (12 free spaces each), front home rows 2 and 6. Config: `boardWidth: 13`, `boardHeight: 7`, `mineCount: 3`. The camera fits the whole board edge to edge in landscape.
- **R5.2 Random mirrored mines.** At match creation 3 mines are placed with the match's seeded RNG (same seed + options → same layout), only in rows 3–5, mirrored (a mine at (3,c) always has a twin at (5,c); row-4 mines mirror themselves): either 1 mine on row 4 + a pair on rows 3/5 (same column), or all 3 on row 4. Any two mines are at Chebyshev distance ≥ 2 (never adjacent) and no mine is adjacent to a Stronghold. Mines can't be stood on. `state.sites` lists them in reading order (row, then column). `newMatch({ mines: [{row,col},{row,col},{row,col}] })` overrides the layout (must be a legal layout, else `newMatch` rejects). The tutorial always uses the same fixed layout from `tutorial.json` regardless of seed. (Rows 3–5 are always ≥ 2 from rows 1/7, so the Stronghold rule holds automatically.)
- **R5.3 Mining is an action.** New action `{ type: "mine", creatureUid, row, col }` (row/col = the mine). Legal in the owner's Action phase for a creature on one of the 8 spaces around that mine that has **not moved, attacked or mined this turn** and is not summoning-sick (Gatherers are never sick for mining). A creature touching two mines may mine either (one per turn). It is the creature's one action: afterwards it can't move or attack (Charge does not allow move+mine or mine+attack). Sets `hasMined: true` and `minedMine: { row, col }`, emits a `mine` event. Yield per mining action: **Gatherer role 2** (`gathererFlow`), **Fighter 1** (`fighterFlow`). Creatures standing next to a mine without mining make nothing. The rule "a creature touching two mines counts at only one" is **removed**.
- **R5.4 Pay-out and mine color.** `minedMine` stays set until the owner's next Draw phase. In every Draw phase (either player's), first each mine's color is recomputed: count, per side, creatures with `minedMine` = that mine that are still adjacent to it; strictly more → that side's `controller` and faction color; tie or 0–0 → `null`/`white`. Then the active player's pool is **set** to: for each of their creatures with `minedMine` still adjacent, its yield in that mine's (just recomputed) color, + Glowing Geodes, + underdog bonus (+2 faction color if no mine is in their color and ≥ 1 mine is in the enemy's color), capped at 16. Then the active player's creatures' `minedMine` is cleared (`null`) and their `hasMined` reset. Defeated miners yield nothing. `sites[i].controller/color` change only at Draw phases and at match creation (from `setup`), never mid-turn. `players.X.minedLastTurn` = the mining yield (crystal count, before Geodes/underdog) at X's most recent Draw phase (0 before X's first Draw and in setup matches).
- **R5.5 `flow` fields become previews:** `players.X.flow` = the crystals X's creatures with `minedMine` set would pay out if X's Draw phase happened now (colors recomputed from current miners), plus Geodes; no underdog, uncapped. `sites[i].flow.{player,opponent}` = each side's mining yield at that mine on the same basis; `sites[i].miners.{player,opponent}` = counts. Income preview "+N next turn" = that preview + underdog, capped at 16.
- **R5.6 Setup additions:** board entries accept `minedMine: { row, col }` (the creature mined that adjacent mine on its owner's last turn; it counts for color at setup and pays out at its owner's next Draw) and `summonedThisTurn: true` (summoning sick as if summoned this turn).
- **R5.7 Summoning sickness:** creatures placed this turn can't move, attack or mine unless their ability says so (Wolf Rider). **Gatherer-role creatures have no summoning sickness for moving and mining** (still can't attack that turn).
- **R5.8 Free Gatherer when broke:** condition "flow 0" becomes **`minedLastTurn` is 0**, plus no mine in your color and no Gatherer-role creature on the battlefield.
- **R5.9 Moves left:** a legal `mine` action counts as a move left (auto-skip, `movesLeft()`, pop-up). When creatures have a legal `mine` action, the "Moves still available" pop-up also shows the line **"1 miner hasn't mined"** or **"K miners haven't mined"** (K ≥ 2).
- **R5.10 Creature ring:** each figure stands on a ring: **yellow** = can still act; **dark grey** + darker, duller figure = has moved/attacked/mined or can't act yet. The HTML label's `data-acted` mirrors this (`"false"` = yellow). A Gatherer summoned this turn has `data-acted="false"` (bright, yellow) until it acts. Labels also get `data-mining="true"` while `minedMine` is set (pickaxe icon shown), else `"false"`.
- **R5.11 Mining glow:** while dragging a creature that can mine, its mine(s) glow with a pickaxe in a third color (amber `#ffb347`), distinct from move (cyan), swap (gold) and attack (red) highlights. Dropping on the mine performs `mine`.
- **R5.12 Ranged markers:** Ranged cards (hand buttons and card view) show **🏹** next to Attack and the word "Ranged" in the ability text; Ranged board labels include 🏹; Ranged 3D figures carry a visible ranged weapon. Non-Ranged cards never show 🏹.
- **R5.13 Hand pop-out:** the hand is a container with `aria-label="Your hand"`. Hovering a hand card with the mouse slides it up ≥ 30 px (about 60 px at 844×390), slightly larger and in front; touch-and-hold does the same before a drag. Hand buttons keep the card name as accessible name (use `aria-label` so icons don't change it).
- **R5.14 Deck piles:** full hand-card size, showing the count: **"Your deck"** at the bottom-right (Done and phase name move up above it), **"Enemy deck"** at the top-left (enemy card backs shift right).
- **R5.15 Commander hearts:** a big glowing heart with the Health number right by each Commander (above yours; beside the enemy's so it never leaves the screen) that shakes and pops red damage numbers when hit. The HTML readouts `"Your Commander health"` / `"Enemy Commander health"` stay (may be small, may be the heart itself).
- **R5.16 Site overlays** are named **"Crystal site, row R, column C"** and **"Mine flow, row R, column C"** (mirrored mines share a column). The info dialog's "Your flow: +N"/"Enemy flow: +M" use R5.5.
- **R5.17 Tutorial steps** (in order): `summon` (a Miner on your back row; tip contains "back row"), `move` (march it next to a mine), `mine` (drag it onto the mine; watch the color change), `spend` (spend the crystals next turn), `swap`, `fight`, `spell`, `commander`, `complete`. The AI also mines.
- **R5.18 Engine unit tests (exact numbers):** mining yields (Gatherer 2, Fighter 1, 0 without the mine action); pool set to last turn's mining (not added); mine color from miners only; a Gatherer can move/mine but not attack on its summon turn while a Fighter can do nothing; mirrored mine layout for at least 20 seeds (3 mines, rows 3–5, mirrored, spacing); 13×7 bounds.

### Revision 4 changes (summary for builders who saw revision 3)

Revision 4 replaces the crystal economy with **Crystal Flow** and adds **swapping**. Where an older line below disagrees, the Revision 4 rule wins.
- No more site income. Each of your creatures standing on the 8 spaces around a mine makes **flow**: Gatherer 2, Fighter 1. At the start of your turn your pool is **set** to your flow (not added). Unspent crystals stay usable through the enemy's turn.
- Pool cap **16** from any source.
- Mine color: the side with more creatures around a mine sets its color; a tie (including 0–0) makes it neutral **white**.
- All creatures at a mine produce crystals in **that mine's color**. The pool has four colors: green, blue, purple, white.
- Paying: creatures and upgrades get full value from their own color and **half** from other colors and white (sum the halves, round down). Spells take any color at full value. Auto-pay the cheapest way.
- A creature touching two mines counts at only one (3.2).
- Starting crystals **0**. Free Gatherer, underdog bonus, Tunnel and Prospector's Prayer are reworded for mine colors.
- New spell and upgrade costs (2.1, 3.7). Fizzle now cancels spells costing 3 or less.
- Swapping places with your own creature in the Action phase (3.8).
- Mine rings and per-side flow numbers on the battlefield; a white crystal counter; the preview shows next turn's pool.

### Revision 3 changes (summary for builders who saw revision 2)

These come from the owner's second playtest. Where an older line below disagrees, the Revision 3 rule wins.
- The battlefield fills the whole landscape screen (no black bars). Everything else (hand, card backs, counters, phase, Done, Commander Health) floats over it. Your Stronghold sits just behind your hand; the enemy's is at the top edge.
- Hand cards are bigger, and the hand slides down out of the way while you drag.
- There is no faction picker: the Commander decides the faction and deck.
- Thane Borgo's +1 Health must really work in the engine (a summoned Dwarf Miner is 1/2).
- Big center banners: "YOUR TURN", "DEPLOY", "ACTION", "ENEMY TURN". Auto-skipped phases get no banner.
- Auto-skip: when no moves are left, the phase ends by itself after about 1 second. Instants, upgrades and the Gatherer swap don't count as moves.
- No Stronghold income. (Starting crystals are now 0, see Revision 4.)
- Creatures show Attack, Health and Movement. Creatures that acted, or can't act yet, turn darker (not grey).
- New creature costs (exact table in 2.1). Basic Gatherers are 1/1 for 1. The starter decks are rebuilt.
- Ranged reaches any space within 2 (Chebyshev distance ≤ 2), over creatures, including the Commander.
- Pressing Done while moves are left shows a "Moves still available!" pop-up.
- Phase timer: 50 seconds per timed phase. It is hidden for 40 seconds, then a 10-second center countdown runs, and at 0 the phase ends.
- Gatherer swap and free Gatherer when broke. Gatherers can move (not attack) the turn they're summoned.
- Income preview "+N next turn". Tapping a site shows its owner and what it pays (now flow per side, see 5.6).
- Overlay order: confirm pop-up, then countdown, then banners.

### Revision 2 changes (summary for builders who saw revision 1)

The menu is now Play / Tutorial / Rules / Settings ("How to Play" is gone, and the graphics toggle moved to Settings). Commander damage equals the attacker's Attack. The screen is landscape, with a "please rotate" overlay when the phone is upright. Movement and Attack phases are merged into one **Action** phase, where each creature moves OR attacks. Other changes:
- New guided tutorial match.
- Starter decks are 40 creatures / 6 spells / 4 Crystal cards.
- Starting crystals are 0, so turn 1 gives exactly 1.
- The underdog bonus applies only when the enemy holds a site, and Tunnel only works while the enemy holds more sites than you.
- Summoning is on the back row only.
- Melee is simultaneous.
- Creatures heal fully at the start of their owner's turn.
- New Shield keyword.
- Damaged Health shows in red.
- Timers are Deploy 30 s and Action 45 s.
- Printed creature Health is at most 6.

---

## Pages & features

### 1. Architecture (not directly visible, but required)

1.1 **Rules engine** in `src/engine/`, pure TypeScript: no DOM, no `window`, no timers, no rendering, no `Math.random`. All randomness (shuffles, coin flip) comes from a seeded RNG passed in. State is plain JSON-serializable data. The engine exposes `createMatch(options)`, `legalActions(state)` and `applyAction(state, action)`. `applyAction` returns the new state plus events, which drive the animations: summon, move, attack, damage, shieldBlock, defeat, heal, spell, counter, siteControl, income, draw, deckOut, retreat, and so on.

1.2 **Content as data** in `src/content/` as JSON: `factions.json`, `crystal-colors.json`, `commanders.json`, `cards.json`, `abilities.json`, `starter-decks.json`, `tutorial.json`, `game-config.json`. `game-config.json` holds every tunable number, at least:
- `phaseTimerSeconds: 50`, `timerHiddenSeconds: 40`, `countdownSeconds: 10`, `respondWindowSeconds: 5`, `autoSkipDelaySeconds: 1`
- `boardWidth: 13`, `boardHeight: 7`, `mineCount: 3`, `startingCrystals: 0`, `poolCap: 16`, `gathererFlow: 2`, `fighterFlow: 1`, `underdogBonus: 2`, `prospectorsPrayerGain: 3` (there is **no** Stronghold income and no site income: no `strongholdIncome`/`siteIncome` keys, or they are 0)
- `deckSize: 50`, `openingHandSize: 5`, `copyLimits` (Common/Uncommon unlimited; Rare/Ultra Rare/Collector 3), `crystalCardLimit: 10`
- `starterDeckMix: { creatures: 40, spells: 6, crystals: 4, basicGatherers: 8 }`
- `commanderHealth: 20`, `upgradeCosts: { "sharpened-weapons": 3, "heavy-armor": 3, "veteran": 5, "champions-crown": 8 }`, `deckOutDamage: 1`

Nothing balance-related is hard-coded in the engine.

1.3 **Unit tests** for the engine (Vitest; `npm test` runs them) must cover, with exact numbers:
- mine color and Crystal Flow, including the turn-1 opening: exactly 0 crystals, and no Stronghold or site income ever
- the underdog bonus, the Tunnel condition and Prospector's Prayer (all based on mine colors)
- back-row summoning
- simultaneous combat
- start-of-turn healing
- Shield
- Commander damage equal to Attack
- Instants/counterspells
- Crystal card limits
- win/retreat
- Revision 4, with exact numbers (the brief's item 8): (a) 1 Gnome Miner vs 2 Goblin Miners at a mine → mine green, Goblins get 4 green, Gnomes get 2 green worth 1 toward a Gnome creature; (b) 2 vs 2 → neutral, each side gets 4 white, worth 2 toward creatures and 4 toward spells; (c) 3 own Miners at an own-color mine → pool 6, one dies → next turn 4; (d) unspent crystals still available on the enemy's turn, then reset to flow (not added); (e) the pool never exceeds 16. Also: half-value rounding (9 off-color = 4), a creature touching two mines counting once, swapping places, and the new spell/upgrade costs
- Revision 3, with exact numbers: Thane Borgo's +1 Health (summoned Dwarf Miner = 1/2, Shieldbeard = 2/5), auto-skip / "moves left" detection, no Stronghold income, sample costs (Scrounger 1, Scrapper 6, Shieldbeard 7, Ram Rider 11, Big Boss Troll 13), Ranged at Chebyshev distance 2 over creatures and onto the Commander, the Gatherer swap, the free Gatherer when broke, and Gatherers moving (not attacking) on their summon turn

### 2. Cards and Commanders

2.1 All **41 starter cards** from the GDD, with exactly the GDD's (revision 3) stats, rarity, cost and abilities. **Printed creature Health is at most 6.** Big Boss Troll, Steam Golem and Queen Brunhilda have Health 6. Card ids are fixed because the tests use them:

- Goblins: `goblin-scrounger`, `goblin-scrapper`, `goblin-slinger`, `goblin-bomber`, `goblin-sneak`, `wolf-rider`, `grubnaks-big-boss-troll`
- Gnomes: `gnome-prospector`, `gnome-tinker`, `spark-gnome`, `clockwork-beetle`, `gnome-illusionist`, `gyrocopter-ace`, `the-great-steam-golem`
- Dwarves: `dwarf-miner`, `shieldbeard`, `axe-thrower`, `ironhammer-berserker`, `brewmaster`, `ram-rider`, `queen-brunhilda-stonebeard`
- Crystal Eaters: `shard-guzzler`, `overclocked-conduit`, `crystal-drunk-delver`
- Spells: `prospectors-prayer`, `tunnel-rush`, `fireball`, `battle-cry`, `meteor-strike`, `healing-light`, `shield-bubble`, `second-wind`, `fizzle`, `hold-it`, `spell-snap`, `mirror-hex`
- Crystal cards: `soul-shard`, `crystal-cluster`, `glowing-geode`, `heart-of-the-fallen`, `motherlode`

**Creature costs (revision 3, exact):** Goblin Scrounger 1, Goblin Scrapper 6, Goblin Slinger 4, Goblin Bomber 5, Goblin Sneak 6, Wolf Rider 9, Grubnak's Big Boss Troll 13; Gnome Prospector 1, Gnome Tinker 5, Spark Gnome 5, Clockwork Beetle 8, Gnome Illusionist 6, Gyrocopter Ace 8, The Great Steam Golem 13; Dwarf Miner 1, Shieldbeard 7, Axe Thrower 6, Ironhammer Berserker 8, Brewmaster 7, Ram Rider 11, Queen Brunhilda Stonebeard 13; Shard Guzzler 5, Overclocked Conduit 5, Crystal-Drunk Delver 7. The three **basic Gatherers** (Goblin Scrounger, Gnome Prospector, Dwarf Miner) are **⚔1 ❤1, cost 1**. Extra Commons follow the GDD formula: Attack + Health, +1 for a small ability, +2 for a big one.

**Spell costs (revision 4, exact, printed):** Prospector's Prayer 1, Tunnel Rush 2, Healing Light 2, Shield Bubble 2, Fireball 3, Fizzle 3, Battle Cry 4, Hold It! 4, Second Wind 5, Spell Snap 5, Meteor Strike 7, Mirror Hex 7. Effects as in the GDD; in particular:
- **Prospector's Prayer:** can only be cast if fewer mines are in your color than in the enemy's color; you gain 3 crystals of your own color.
- **Fizzle:** cancels an enemy spell with printed cost ≤ **3**.

**Crystal cards (revision 4):** Soul Shard +1 crystal of your faction color; Crystal Cluster +2 of your faction color; Glowing Geode +1 flow of your faction color every turn for the rest of the match (Unique); Heart of the Fallen +4 crystals in colors you choose (`colors`); Motherlode +3 of your faction color now, and your next creature this turn costs 2 less (minimum 0). All gains respect the 16 cap (excess is lost).

Reworked cards (revision 2):
- **Gnome Tinker** (Fix-it): at the start of your turn, each adjacent ally gets Shield 1.
- **Brewmaster** (Hearty Ale): at the start of your turn, each adjacent ally gets +1 Health (max and current) until your next turn.
- **Heavy Armor** upgrade: +3 Health (max and current). It no longer heals separately.
- **Madame Sprocket** (not playable in 1a): her ability gives Shield 1 to your lowest-Health creature at the start of your turn. Put it in `commanders.json` only.

2.2 **Commanders** (ids fixed). All have 20 Health.
- `grubnak` (Grubnak the Goblin Boss, goblins): Goblin creatures cost 1 less, minimum 1.
- `sproingle` (Professor Sproingle, gnomes): your spells cost 1 less, minimum 1.
- `borgo` (Thane Borgo Anvilbottom, dwarves): your creatures get +1 Health, applied to max and current Health on entering the battlefield (summoned or placed by `setup`). Example: a summoned Dwarf Miner is ⚔1 ❤2 and a Shieldbeard is ⚔2 ❤5. This must be implemented in the engine, not faked in the UI.

2.3 **Starter decks**: one 50-card deck per faction in `starter-decks.json`. Each deck has:
- exactly **40 creatures** of that faction (including each of its 7 starter creatures and its Crystal Eater at least once; the rest are Commons)
- exactly **6 spells** from the spell list, including **at least 1 Fizzle**
- exactly **4 Crystal cards**
- exactly **8 copies of the faction's basic Gatherer** (Goblin Scrounger / Gnome Prospector / Dwarf Miner)
- plenty of cheap creatures: at least **16 of the 40 creatures cost 4 or less**
- at most 3 copies of any Rare/Ultra Rare/Collector card

Extra original Common **creatures** may be added. Use original names only, never names from Warcraft, Warhammer, Magic, Hearthstone, Pokémon or any other game. Their printed Health must also be ≤ 6. A player's deck is their Commander's faction deck.

### 3. Rules (engine): clarifications on top of the GDD

3.1 **Coordinates** (Revision 5: see R5.1/R5.2, which replace the column numbers below): `row` runs 1–7 top to bottom, `col` 1–13 left to right.
- The **opponent** (computer) is at the top: home rows 1–2, **back row = row 1**, Stronghold at row 1 col 4.
- The **player** (human) is at the bottom: home rows 6–7, **back row = row 7**, Stronghold at row 7 col 4.
- Strongholds occupy their space, so nothing can stand there.
- Crystal sites are at (4,2), (4,4), (4,6). They can't be stood on.

3.2 **Mine color** ("site control") — *superseded by R5.3–R5.5 (miners only; no shared-creature rule). Kept for history:* The three crystal sites are the **mines**. Mine colors are recomputed at the start of every turn (Draw phase), once when a match is created from `setup` (4.4), and whenever the board changes for display/preview purposes (`flow` in the state is always computed from the current board).
- **At a mine** = on one of the 8 spaces around it. Spaces (3,3), (4,3), (5,3) touch mines 1 and 2; (3,5), (4,5), (5,5) touch mines 2 and 3.
- **Assigning shared creatures** (a creature touching two mines counts at only one): first count each side's creatures on spaces touching only one mine. Then process the shared-space creatures in reading order (row ascending, then column ascending). Each one joins the neighbouring mine where **its side currently has more creatures** (counting creatures already assigned). If equal, it joins the mine where the **enemy has more creatures**; if still equal, the **left** mine (lower column).
- **Color:** the side with strictly more assigned creatures at a mine is its `controller`, and the mine takes that side's faction color (`green` goblins, `blue` gnomes, `purple` dwarves). A tie (including 0–0) → `controller: null`, `color: "white"`.

3.3 **Crystal Flow** — *Revision 5: flow comes only from mining actions (R5.3–R5.5); "creatures at a mine" below means creatures with `minedMine` set:*
- **Flow** of a side, per color: for each of its creatures assigned to a mine, **2** if its role is Gatherer (basic Gatherers and Crystal Eaters) and **1** if Fighter, in **that mine's color** (so both sides' creatures at a green mine produce green). Plus **+1 of the faction color per own Glowing Geode**.
- **Draw phase of the active player:** their pool is **set** to their flow (all four colors replaced, not added), then the **underdog bonus** is added: **+2 of their faction color** if no mine is in their color **and** at least one mine is in the enemy's color. Then the cap applies.
- **Pool cap 16** (total of all colors) after every gain (flow, Crystal cards, Prospector's Prayer, underdog). When over the cap, remove the excess from white first, then other off-colors (in the order green, blue, purple, skipping your own), then your own color. Exception: `setup` crystals are applied exactly as given (not capped), for testing.
- The non-active player's pool is never changed by the other player's Draw phase: unspent crystals stay usable during the enemy turn (Instants, counterspells) until the owner's next Draw phase.
- **No Stronghold income and no site income.** `startingCrystals` is **0**, so on turn 1 the first player has 0 crystals and on turn 2 the second player has 0 (unless a Crystal card is played). Turn 1 is "send out a Miner" with the free Gatherer (3.7).
- **Income preview** ("+N next turn"): N = the total pool the player would get if their next turn started with the board as it is now (flow from current positions + Geodes + underdog bonus, capped at 16).

Example numbers (must hold exactly): 1 Gnome Miner vs 2 Goblin Miners at a mine → mine green, Goblins' flow 4 green, Gnomes' flow 2 green. 2 vs 2 → white, each side 4 white. 3 own Miners at an own-color mine → pool 6; if one dies, the next pool is 4.

3.4 **Setup**:
1. Each deck is shuffled with the seeded RNG, and each player draws 5.
2. Mulligan: each player once chooses any cards to shuffle back and redraws the same number. The player decides first, then the opponent.
3. A seeded coin flip picks the first player.
4. After mulligans, the second player draws 1 extra card.

Turn 1 is the first player's first turn, and on it they skip their draw.

3.5 **Turn phases**: Draw → Deploy → Action → End → the other player's turn.
- **Draw** (automatic): all the active player's creatures heal to full and lose leftover Shield from last turn. Then start-of-turn abilities happen (Fix-it, Hearty Ale), the player draws 1 card, mine colors are recomputed and the pool is set to the player's Crystal Flow plus any underdog bonus, capped at 16 (3.3).
- **Deploy** (timed, 50 s).
- **Action** (timed, 50 s).
- **End** (automatic: end-of-turn effects).

The `done` action ends the current timed phase.

**Moves left / auto-skip:** a player has *moves left* in a phase if `legalActions()` contains at least one action other than `done`, `surrender`, `upgrade`, `gathererSwap` and casting an Instant. In Deploy that means an affordable, placeable summon, a playable Crystal card, a castable Regular spell or a usable activated ability. In Action it means any move, attack, ability or Regular spell. The engine exposes this as `hasMovesLeft(state)`. When the active player has no moves left (and no Respond window is open), the app ends the phase by itself after `autoSkipDelaySeconds` (about 1 s). This applies to the human and the AI alike. `turn` counts every turn of either player (turn 1 = first player, turn 2 = second player, …).

3.6 **Costs & payment** (all automatic, the cheapest way):
- **Creatures and upgrades:** the cost (after Commander discounts) is paid with crystals of the **creature's faction color** at 1 each, and **any other color or white at ½ each** (halves add up, round down). Affordable when `own + floor(others / 2) ≥ cost`. Pay own color first; for the remainder r, spend exactly 2r other crystals, white first, then off-colors in the order green, blue, purple. Example: 2 green are worth 1 toward a Gnome creature; 9 green are worth 4; 1 blue + 8 green pays a 5-cost Gnome, leaving 1 green.
- **Spells:** any color at full value. Spend white first, then off-colors (green, blue, purple order, skipping your own), then your faction color.
- Cards you can afford glow in your hand.
- Crystal cards are free.
- A countered spell or creature still costs its owner the crystals.

3.7 **Deploy phase**:
- **Summoning:** creatures are summoned onto empty spaces of **your back row only** (row 7 for the player, row 1 for the opponent).
  - Only when every space of the back row is filled (by anyone) may you summon onto the row in front of it (row 6 / row 2).
  - If both rows are full, you can't summon.
- **Tunnel**: a Tunnel creature may instead be summoned onto any empty space adjacent (8-way) to a crystal site, but **only while more mines are in the enemy's color than in yours** (using the current `sites` colors).
- **Crystal cards:** play up to 1 per turn (Deploy phase only). Crystal Eaters allow extra plays, with the GDD's drawback for each extra card.
- **Upgrades:** Deploy phase only, max 1 per creature, paid like a creature (own color full, others half):
  - Sharpened Weapons 3: +1 Attack
  - Heavy Armor 3: +3 Health, max and current
  - Veteran 5: move 2
  - Champion's Crown 8: +2 Attack and +3 Health
- **Gatherer swap** (action `gathererSwap`): once per turn, in your Deploy phase, if your hand holds **no Gatherer-role card**, you may discard one hand card (`discardUid`; none if the hand is empty) to move your **cheapest basic Gatherer** (Scrounger/Prospector/Miner of your faction; Crystal Eaters don't count) from your deck into your hand. It is free. Not legal if the deck has no basic Gatherer, if you already swapped this turn, or with an empty hand unless `discardUid` is omitted. The deck is not reshuffled.
- **Free Gatherer when broke:** if at the moment of summoning your **flow is 0** (computed from the current board), **no mine is in your color** and you have **no Gatherer-role creature on the battlefield**, you may summon one **basic Gatherer** for free (it costs 0, whatever is in your pool). Normal placement rules apply. After that, you have a Gatherer on the battlefield, so a second free one isn't possible.
- **Unique cards:** only one copy of that card on your battlefield at a time.
- **Regular spells** may be cast in the Deploy or Action phase of your turn.

3.8 **Action phase: each creature either moves OR attacks, never both**, except creatures with **Charge** (Ram Rider), which may move and then attack in the same turn. Once a creature has attacked, it can't move.
- **Move:** 1 space in 8 directions onto an empty space. Ultra Rare, Collector and Veteran creatures move up to 2; the path can't pass through creatures, Strongholds or sites unless the creature has Flying.
- Creatures summoned this turn can't act unless their ability says so (Wolf Rider can). **Gatherer-role creatures may move (but not attack) on the turn they are summoned.**
- **Swapping places:** instead of an empty space, a creature that may move can move onto a space occupied by **one of your own creatures** within its move range (for move 2: the step in between must be empty unless it has Flying). The two trade places. Only the dragged creature uses its action (`hasMoved: true`); the other creature's flags are unchanged, so it can still act if it could before. Never with enemies. Uses the normal `move` action and emits a `swap` event. Charge creatures may still attack after swapping. (Gnome Illusionist's Blink stays its own ability.)

3.9 **Combat** (Action phase):
- **Melee** reaches the 8 surrounding spaces. **Ranged** creatures can hit any enemy creature at **Chebyshev distance ≤ 2** (max(|Δrow|, |Δcol|) ≤ 2, so all 24 spaces of the surrounding 5×5 square, including knight-move angles), **even over other creatures**. Every Ranged attack, adjacent or not, gets no strike back.
- Attacking the enemy Commander requires being adjacent to the enemy Stronghold, or a Ranged creature within Chebyshev distance 2 of the enemy Stronghold space (e.g. a player Ranged creature on row 3, columns 2–6).
- Guard only affects melee attacks.
- **Melee hits are simultaneous:** the defender strikes back with its own Attack at the same moment, **even if the hit defeats it**. Both damages are applied, then defeats are checked.
  - Example: ⚔1 ❤2 vs ⚔1 ❤1 → the 1/1 dies and the 1/2 survives at 1. Two 1/1s defeat each other.
  - No strike back against Ranged attacks or Sneaky attackers.
- **Type advantage** +1 (Dwarves→Goblins, Goblins→Gnomes, Gnomes→Dwarves), including on strike backs. It never applies to Commanders.
- **Guard:** if an attacker is adjacent to an enemy Guard creature, its melee attacks must target a Guard creature.
- **Shield X** blocks the next X points of damage to that creature. It is used up as it blocks, and stacks with other Shield. Leftover Shield disappears at the start of the shielded creature's owner's next turn.
- **Healing:** a creature's damage lasts until the start of its owner's next turn (Draw phase), when it heals to full. Healing never exceeds max Health.
- **Defeated** creatures go to the discard pile and lose upgrades.
- **Commander damage:** a creature attacking the Commander removes **exactly its current Attack** (base Attack plus upgrades plus active bonuses such as Battle Cry, Rally and Frenzy, minus penalties). No type advantage. The Commander never strikes back. **Commander damage never resets.** Only cards that say so (Second Wind) restore it, never above 20.

3.10 **Spells and the Respond window**:
- Regular spells can be cast in any timed phase of your own turn. Instants can be cast any time you have priority.
- When a player casts a spell, summons a creature or attacks a creature, and the other player holds an Instant they can afford and legally use, a Respond window opens for that other player (`pendingResponse`).
- The responder may cast one Instant (`respond`) or `pass`. The response resolves first, then the original action (unless it was cancelled).
- There is only one level of response.

Counterspells:
- Fizzle cancels a spell with **printed** cost ≤3.
- Hold It! cancels a creature summon and returns the card to its owner's hand.
- Spell Snap cancels any spell.
- Mirror Hex cancels a spell and casts a free copy for the responder.

Other Instants:
- Shield Bubble: the target takes no damage from the next hit this turn.
- Healing Light: heal 3.

3.11 **Deck-out**: drawing from an empty deck deals `deckOutDamage` (1) to that Commander instead, every time it happens.

3.12 **Winning**: a Commander at 0 Health retreats and the other player wins (`winner`). `phase` becomes `"over"`. Surrender ends the match immediately as a loss for the surrendering side.

### 4. Test mode and `window.oreheart` (required exactly as written)

4.1 The URL `?test=1` turns on test mode:
- Phase timers are paused at their full length (they only change through `setPhaseTimeLeft`).
- **Auto-skip is off** unless the match was started with `newMatch({ autoSkip: true })`.
- The AI acts immediately, with no animation waits.
- The shuffle seed is fixed: `?seed=N` sets it, and the default seed is `1`.
- The first-time tutorial offer is **not** shown.

Without `?test=1`, `window.oreheart` is **undefined**.

4.2 `window.oreheart` (test mode only) has these functions. Each may return a value or a Promise of it.

- `getState()` → a deep copy of the engine state as plain data.
- `legalActions()` → array of action objects legal for the player who currently has priority.
- `act(action)` → `{ ok: true, events: [...] }` if the action is legal and applied; `{ ok: false, error: "<message>" }` if it is illegal (state unchanged, never throws). The screen updates to match.
- `newMatch(options)` → starts a new match, shows the match screen and returns the state.
- `startTutorial()` → starts the tutorial match (section 5.9), shows it and returns the state.
- `movesLeft()` → `true`/`false`: whether the priority player has moves left in the current phase (the rule in 3.5).
- `getCard(cardId)` → the card's data: `{ id, name, type: "creature"|"spell"|"crystal", faction, rarity, role: "gatherer"|"fighter"|null, cost, attack, health, move }` (creature fields are `null` for non-creatures). These are printed values, without Commander effects.
- `getConfig()` → a copy of `game-config.json`.
- `setPhaseTimeLeft(seconds)` → sets the remaining seconds of the current timed phase, and the screen updates at once (the countdown shows if `seconds ≤ countdownSeconds`). In test mode the clock then stays frozen at that value. `setPhaseTimeLeft(0)` makes the phase time out right away, exactly as a real timeout: the current phase ends (Deploy → Action, Action → End/next turn), and no "Moves still available" pop-up is shown.

4.3 **`newMatch` options** (all optional):

| Option | Values | Default |
| --- | --- | --- |
| `playerCommander` | `"grubnak"`, `"sproingle"`, `"borgo"` | `"grubnak"` |
| `opponentCommander` | same | `"sproingle"` |
| `difficulty` | `"easy"`, `"normal"` | `"normal"` |
| `seed` | integer | URL seed, else 1 |
| `ai` | `true` = computer plays the opponent; `false` = the opponent is also driven through `act()` | `true` |
| `firstPlayer` | `"player"`, `"opponent"` | seeded coin flip |
| `skipMulligan` | `true` = both keep their opening hands | `false` |
| `autoSkip` | `true` = auto-skip phases with no moves left (as in normal play) | `false` in test mode |
| `mines` | array of 3 `{ row, col }`, a legal layout (R5.2) | seeded random |
| `setup` | object, see 4.4 | none |

The same seed and options always produce the same starting state.

4.4 **`setup`** (for tests): when given, the mulligan is skipped and the match begins directly in the **Deploy phase of turn 1** of `setup.firstPlayer` (default `"player"`). There is **no** draw, income or start-of-turn healing for that turn, but site control **is** computed from the setup board. Fields (all optional):
- `playerHand`, `opponentHand`: arrays of card ids (default `[]`).
- `playerDeck`, `opponentDeck`: arrays of card ids, top first (default: that faction's starter deck, shuffled by seed).
- `playerCrystals`, `opponentCrystals`: `{ green, blue, purple, white }` (missing colors = 0; default all 0). Applied exactly as given, not capped and not replaced by flow for the setup turn. They are replaced by flow at that player's next Draw phase.
- `playerHealth`, `opponentHealth`: Commander Health (default 20).
- `board`: array of `{ cardId, owner: "player"|"opponent", row, col, damage?, shield? }`. These creatures are not "summoned this turn" (unless `summonedThisTurn: true`), so they can act. Optional `minedMine: { row, col }` per R5.6. Commander abilities apply (e.g. Borgo's +1 Health), and `damage` is subtracted after that.

4.5 **State shape** (these fields are required; more are allowed):

```
{
  turn: number,
  activePlayer: "player" | "opponent",
  priority: "player" | "opponent" | null,       // who must act now (legalActions are for them)
  phase: "mulligan" | "draw" | "deploy" | "action" | "end" | "over",
  winner: null | "player" | "opponent",
  players: {
    player:   { commanderId, faction: "goblins"|"gnomes"|"dwarves", health, maxHealth,
                crystals: { green, blue, purple, white },   // the pool
                flow: { green, blue, purple, white },       // flow from the current board + Geodes (no underdog, uncapped)
                hand: [{ uid, cardId }], deck: [{ uid, cardId }] /* top first */, discard: [{ uid, cardId }] },
    opponent: { ...same }
  },
  board: { creatures: [{ uid, cardId, owner, row, col, attack, health, maxHealth, shield,
                         upgrade: null | "sharpened-weapons" | "heavy-armor" | "veteran" | "champions-crown",
                         summonedThisTurn: boolean, hasMoved: boolean, hasAttacked: boolean,
                         hasMined: boolean, minedMine: null | { row, col } }] },
  sites: [ { row, col, controller, color, flow: { player, opponent }, miners: { player, opponent } } x3 ],  // reading order (R5.2); controller "player"|"opponent"|null; color "green"|"blue"|"purple"|"white"; flow = each side's total flow at this mine
  pendingResponse: null | { responder: "player" | "opponent", ... },
  tutorial: null | { step: "summon"|"move"|"mine"|"spend"|"swap"|"fight"|"spell"|"commander"|"complete" }
}
```

- `attack` = base Attack plus permanent modifiers (upgrades, Crystal-Drunk Delver penalty). Situational bonuses (Frenzy, Rally, type advantage, Battle Cry) are applied in combat.
- `health` is current Health. `maxHealth` includes Borgo, upgrades and Hearty Ale.
- `shield` is the remaining Shield points (0 if none).

4.6 **Action formats** (exact). Targets are `{ row, col }` (a creature or space) or `{ commander: "player"|"opponent" }`.

- `{ type: "mulligan", uids: [...] }`: `uids` = the hand cards to redraw (`[]` keeps).
- `{ type: "summon", uid, row, col }`
- `{ type: "cast", uid, target? }`: a Regular spell or Instant on your own turn.
- `{ type: "playCrystal", uid, colors? }`: `colors` only for Heart of the Fallen.
- `{ type: "upgrade", creatureUid, upgrade }`
- `{ type: "move", creatureUid, row, col }`: onto an empty space, or onto your own creature's space to swap (3.8)
- `{ type: "attack", creatureUid, target }`
- `{ type: "mine", creatureUid, row, col }`: mine the adjacent mine at (row, col) (R5.3)
- `{ type: "ability", creatureUid, ability, target? }`: activated abilities, e.g. Blink.
- `{ type: "respond", uid, target? }` and `{ type: "pass" }`: during a Respond window.
- `{ type: "gathererSwap", discardUid? }`: the Gatherer swap (3.7). `legalActions()` lists one entry per hand card that could be discarded, or a single entry without `discardUid` if the hand is empty.
- `{ type: "done" }`: end the current timed phase (Deploy → Action → End/next turn).
- `{ type: "surrender" }`

`legalActions()` lists every legal action in these formats, with one entry per legal target or space. `done` is legal in the Deploy and Action phases for the priority player.

### 5. Screens and text

5.1 **Main menu** (`/`): heading (h1) **"Oreheart"** and exactly four buttons, in this order: **"Play"**, **"Tutorial"**, **"Rules"**, **"Settings"**. No other button or link on the menu may contain the word "Play" (in any letter case).

5.2 **First-time tutorial offer**: the first time the main menu is shown (outside test mode), a dialog appears (`role="dialog"`, name **"Welcome to Oreheart!"**) with the buttons **"Start Tutorial"** and **"Skip"**. Either choice is saved in localStorage, so the offer never appears again after a reload. "Start Tutorial" starts the tutorial match.

5.3 **Settings screen**: heading **"Settings"**, a graphics toggle button labelled **"Graphics: High"** / **"Graphics: Low"**, a moves-reminder toggle button labelled **"Moves reminder: On"** / **"Moves reminder: Off"** (default On; Off disables the pop-up in 5.6) and a **"Back"** button to the main menu.
- Clicking a toggle switches it.  Graphics defaults to High.
- Both choices are saved in localStorage and restored on reload (also in test mode).
- Low cuts particles, shadows and pixel ratio.

5.4 **Play setup screen**: heading **"Choose Your Commander"**.
- One button per Commander with its full name: **"Grubnak the Goblin Boss"**, **"Professor Sproingle"**, **"Thane Borgo Anvilbottom"**. The selected one has `aria-pressed="true"`. A short faction description sits under each.
- Difficulty buttons **"Easy"** and **"Normal"**. The selected one has `aria-pressed="true"`, and the default is Normal.
- Buttons **"Start Match"** and **"Back"**.
- The computer picks a different Commander at random.
- There is **no faction picker** anywhere: no "Choose Your Faction" step and no buttons named "Goblins", "Gnomes" or "Dwarves". The faction (and starter deck) come from the Commander.

5.5 **Mulligan**: when a match starts from the UI, a dialog (`role="dialog"`, name **"Mulligan"**) shows the 5-card hand. Tapping cards marks them. Buttons: **"Keep Hand"** and **"Redraw Selected"**.

5.6 **Match screen: landscape, full screen** (designed at 844×390; must also work at 740×360 and 667×375, and scales up to desktop).
- **Battlefield = the whole screen.** The 3D battlefield is an element with `aria-label="Battlefield"` that covers the entire viewport, edge to edge: no black bars, no letterboxing, no page margins. The camera views the board at a tabletop angle and is zoomed as large as possible while keeping the whole 13×7 board visible. The enemy Stronghold sits right at the top edge. Your Stronghold and Commander sit as low as possible, just behind your hand cards but still visible.
  - Three.js scene with painted ground and no grid lines.
  - Three glowing crystal formations (mines) in their current color (green/blue/purple, or pale white when neutral), showing the faction symbol when colored (Goblin skull, Gnome gear, Dwarf hammer). Each mine has a **ring** on the ground in its current color around its 8 spaces, and floating per-side flow numbers: a real HTML overlay (`aria-label="Mine flow, row R, column C"`) with text like **"+3 / +1"** (yours first, then the enemy's).
  - Two Strongholds, each with a simple Commander figure (top half) that emotes: cheer, groan, flinch.
  - Creatures are simple placeholder 3D figures in faction color, with the faction symbol.
  - Valid spaces glow while dragging (for summons: the back row; for Ranged attacks: every enemy within range). In the Action phase, empty move spaces glow soft cyan and **ally swap targets glow gold** (`#e3b54a`), a different color.
  - If WebGL is unavailable, the match still works with a simple 2D board (still full screen) and no uncaught errors.
- **Everything else floats over the battlefield** (absolutely positioned HTML on top of it, never beside it):
  - **Top edge:** enemy card backs fanned in an arc (`aria-label="Enemy hand"`; its text or label includes the count).
  - **Left side:** crystal counters (`aria-label="Your green crystals"`, `"Your blue crystals"`, `"Your purple crystals"`, `"Your white crystals"`; text = number in the pool; each also shows next turn's flow of that color in small text), the **income preview** (`aria-label="Your income next turn"`, text exactly **"+N next turn"**, e.g. "+3 next turn" or "+0 next turn", computed as in 3.3), your deck pile (`aria-label="Your deck"`; text = cards left) and the enemy deck pile (`aria-label="Enemy deck"`).
  - **Right side:** current phase (`aria-label="Current phase"`; text contains **"Deploy"** or **"Action"**, prefixed with **"Your turn"** or **"Enemy turn"**; it stays visible small), the **"Done"** button, your Commander Health (`aria-label="Your Commander health"`) and Enemy Commander Health (`aria-label="Enemy Commander health"`; text contains the number), and a **"Menu"** button.
  - **Bottom edge:** your hand.
- **Hand:** real HTML buttons fanned in a rainbow arc; each button's accessible name is the card's name (e.g. "Fireball"). Cards are big enough to read on a phone: at 844×390 every hand card button is **at least 60 px wide and 90 px tall**, showing cost, name, and Attack/Health for creatures. Swipe or mouse wheel scrolls the fan; hand size is unlimited. **While you drag a card or a creature, the hand slides down off-screen** so the back row can be reached, and slides back when you let go.
- **Creature labels:** each creature on the board has a real HTML overlay element.
  - Its accessible name is **"<Card Name>, row R, column C"** (e.g. "Shieldbeard, row 5, column 4").
  - Its text shows **Attack, Health and Movement, in that order**, as "⚔️A ❤️H 👟M" (e.g. a Wolf Rider shows "⚔️3 ❤️4 👟2"). Health is the current Health.
  - When `health < maxHealth`, the element has `data-damaged="true"` and the Health number is shown in **red** (`#ff4040`) until it heals. Otherwise `data-damaged="false"`.
  - **Acted / can't act:** when the creature has moved or attacked this turn, or can't act yet (summoned this turn without an ability allowing it), the element has `data-acted="true"` and the 3D figure and label turn **darker and duller (lower brightness, a bit less saturation), not grey**. It returns to full color (`data-acted="false"`) at the start of its owner's turn. Creatures of the player whose turn it isn't show `data-acted="false"` unless they are still marked from their own turn.
  - Shield shows as a small shield icon with its number.
- **Crystal sites:** each site has a real HTML overlay button with the accessible name **"Crystal site, row R, column C"**. Tapping it opens a small info dialog (`role="dialog"`, name **"Crystal site"**) showing **"Controlled by: You"**, **"Controlled by: Enemy"** or **"Controlled by: Nobody"**, the color as **"Color: Green"**, **"Color: Blue"**, **"Color: Purple"** or **"Color: White"**, and each side's flow at this mine as **"Your flow: +N"** and **"Enemy flow: +M"** (3.3). It has a **"Close"** button and also closes on tapping elsewhere.
- **Phase banners:** a big, center-screen, comic-style banner (`aria-label="Phase banner"`) with the text **"YOUR TURN"** at the start of your turn, **"DEPLOY"** and **"ACTION"** when those phases of your turn begin, and **"ENEMY TURN"** when the enemy's turn begins. It shows for about 1.5 seconds and then fades and is removed or hidden. A phase that is auto-skipped (no moves left when it begins) shows **no** banner. Banners also show in test mode.
- **Phase timer (countdown):** each timed phase lasts `phaseTimerSeconds` (50). For the first `timerHiddenSeconds` (40) nothing is shown. When `countdownSeconds` (10) or fewer remain, a big center-screen countdown (`aria-label="Phase timer"`, text = whole seconds left, 10 → 0) appears. At 0 the current phase ends (not the whole turn), without any pop-up. The old burning rope is removed. No timer runs in the tutorial or in test mode (except through `setPhaseTimeLeft`). The Respond window pauses the phase timer.
- **"Moves still available" pop-up:** when you press Done while you still have moves left (3.5), a center pop-up (`role="dialog"`, name **"Moves still available! Continue to the next phase?"**) appears with the buttons **"Continue"** (ends the phase) and **"Go back"** (closes it, phase unchanged). It never appears when the timer runs out, when no moves are left, or when "Moves reminder: Off" is set. The `done` action through `window.oreheart.act` never shows it.
- **Overlay order:** the pop-up is on top of the countdown, and the countdown is on top of phase banners, so the pop-up's buttons can always be clicked. A banner waits until no pop-up or countdown is showing.
- **Card view:** clicking or tapping a hand card (without dragging) opens a dialog named with the card's name. It shows cost, Attack/Health (creatures), movement, role, rarity and ability text, and has a **"Close"** button. Double-tapping a creature on the board opens the same view.
- **Interactions:**
  - Drag a card onto the battlefield to summon or cast. Valid spaces glow.
  - Press and drag a creature to move it, drag it onto your own creature to swap places, or drag it onto an enemy or the enemy Stronghold to attack.
  - Tap your creature in the Deploy phase to get an **"Upgrade"** option listing the affordable upgrades.
  - In Deploy, if the Gatherer swap is legal, a button **"Swap for a Gatherer"** is shown; pressing it asks you to tap the card to discard (or does the swap at once if your hand is empty).
- **Animations:** summon rise, walk, attack lunge (both creatures hit together), ranged projectile, floating damage numbers, shield-block flash, defeat poof, and a retreat scene at match end. The Done button and all key elements stay usable during animations.

5.7 **Rotate overlay**: whenever the window is portrait (height > width) **and** narrower than 900 px, a full-screen overlay shows the text **"Please rotate your phone"**, on every screen. It disappears when the window is landscape.

5.8 **Respond dialog**: when the human player has a Respond window, a dialog (`role="dialog"`, name **"Respond?"**) shows one button per usable Instant (name = card name) and a **"Let it happen"** button.
- Choosing an Instant casts it. If the triggering action targets one of your creatures, the Instant automatically targets that creature. Counterspells target the triggering spell or summon. Otherwise you are asked to tap a target.
- In normal mode the dialog closes by itself after `respondWindowSeconds` (which counts as a pass). In test mode it stays until answered.

5.9 **Tutorial match**: started from the **"Tutorial"** menu button, from "Start Tutorial", or from `window.oreheart.startTutorial()`. It always uses the same fixed setup from `tutorial.json`: the player is Grubnak, against a harmless scripted opponent with the same cards every time. There are **no timers**: the timer is hidden or paused.
- The match begins on the player's turn 1 Deploy phase with **0 crystals** and no creatures of the player on the board; the hand includes a Goblin Scrounger, which the player summons with the **free Gatherer** rule.
- A tip box (`aria-label="Tutorial tip"`, real HTML) walks through these steps **in order**. Each step waits until it is done, and `state.tutorial.step` shows the current one:
  1. `summon`: summon a troop on your back row (the tip text contains "back row")
  2. `move`: march it forward
  3. `mine`: drag it onto the mine to mine (Gatherer 2, Fighter 1) and watch the mine change color
  4. `spend`: spend the mined crystals next turn (your pool is set to last turn's mining; off-color crystals are worth half toward creatures)
  5. `swap`: swap places with another of your creatures
  6. `fight`: fight an enemy (simultaneous hits, healing next turn)
  7. `spell`: cast a spell
  8. `commander`: attack the enemy Commander until they retreat
  9. `complete`
- The normal rules apply, including back-row summoning.
- A **"Skip Tutorial"** button returns to the main menu. Winning shows the normal "Victory!" screen. The tutorial can be replayed any time.

5.10 **Match menu**: "Menu" opens a dialog with **"Resume"** and **"Surrender"**. Surrender asks **"Surrender this match?"** with **"Yes, surrender"** and **"Cancel"**.

5.11 **End screen**: after the retreat scene, heading **"Victory!"** (you won) or **"Defeat"** (you lost or surrendered), a one-line flavor message and a **"Back to Menu"** button, which returns to the main menu.

5.12 **Rules screen**: heading **"Rules"**, short sections (Goal, The Board, Crystals, Your Turn, Combat, Spells & Instants) and at least 3 simple pictures (`<img>` with alt text, or inline SVG with `role="img"` and an aria-label). A **"Back"** button returns to the main menu. The text must reflect the revision 2–4 rules: Crystal Flow (Gatherer 2, Fighter 1 per turn at a mine; the pool resets to flow each turn; cap 16), mine colors and white ties, off-color crystals worth half toward creatures but full toward spells, starting with 0 crystals, swapping places, back-row summoning, move OR attack, Gatherers moving on their first turn, simultaneous hits, healing each turn, Shield, Ranged reaching 2 spaces in any direction, the Gatherer swap and the free Gatherer.

### 6. Computer opponent

6.1 The AI uses only `legalActions()` + `applyAction()`.
- **Easy**: mostly random legal moves, with a light preference for summoning and attacking.
- **Normal**:
  - plays Crystal Flow: marches Gatherers to mines, tries to outnumber the enemy at a mine (or tie it to make it white), and uses Tunnel when allowed
  - swaps places to bring a creature forward or pull a hurt one back
  - keeps Gatherers out of reach of enemy attacks where possible
  - attacks the enemy Commander whenever a creature can
  - makes favourable trades, considering simultaneous strike back
  - casts damage spells on good targets
  - uses Instants and counterspells when the Respond window offers a good one
  - uses the Gatherer swap and the free Gatherer when they are available
- Both levels end a phase when they have nothing left to do (auto-skip), and the AI's turns follow the same rules as the player's.

Each AI turn completes within 3 seconds of computation on a mid-range phone: instantly in test mode, plus animations otherwise. The AI handles its own mulligan.

---

## Look & feel

- Comic-book fantasy with a dark painted battlefield as in the mockup: dirt, grass and rock ground, no grid lines.
- Glossy neon gems: green `#3ee06a` (Goblins), blue `#3fa9ff` (Gnomes), purple `#b45cff` (Dwarves). Neutral (tied) mines and white crystals are a pale glowing white `#f2f6ff`.
- UI frames in dark slate `#1b1a22` with gold trim `#e3b54a` and parchment text `#f4e9d0`. Damaged Health is red `#ff4040`.
- Fonts (Google Fonts): **"Cinzel Decorative"/"Cinzel"** for headings and card names, **"Nunito"** for body text and numbers. Big, bold comic text bursts ("KA-BOOM!", "CRUNCH!") for hits and defeats.
- **Landscape, phone-first** (designed at 844×390), scaling to desktop:
  - no horizontal scrolling
  - touch targets ≥ 44 px
  - the "Please rotate your phone" overlay in portrait on narrow screens
  - works with mouse (drag, wheel) and touch (drag, swipe)
- Each faction has a symbol, so color is never the only cue. There is a simple Low/High graphics toggle in Settings. It must run smoothly on mid-range Android Chrome.

---

## Acceptance criteria

1. The main menu loads with heading "Oreheart" and exactly the buttons "Play", "Tutorial", "Rules", "Settings". No other button or link contains "Play". There are no uncaught page errors on load, or when starting a test-mode match.
2. Play → "Choose Your Commander" shows all three Commanders and Easy/Normal. Choosing Professor Sproingle + Normal and clicking "Start Match" opens the Mulligan dialog. "Keep Hand" reaches the match screen with the Done button, and the player's Commander is Sproingle (faction gnomes). No faction picker appears at any point.
3. Rules shows its heading and at least one picture, and "Back" returns to the main menu.
4. Settings has the graphics toggle, which switches between "Graphics: High" and "Graphics: Low" and remembers the choice after reload. "Back" returns to the menu.
5. `window.oreheart` exists only with `?test=1`, and the same seed gives the same starting hands.
6. Each starter deck has 50 cards: exactly 40 creatures (including exactly 8 of the faction's basic Gatherer and at least 16 creatures costing 4 or less), 6 spells (including at least 1 Fizzle) and 4 Crystal cards, with ≤3 copies of each Rare/Ultra Rare/Collector card. Both Commanders start with 20 Health and an opening hand of 5.
7. Opening: both players start with 0 crystals and there is no Stronghold or site income. The first player has 0 crystals and 5 cards on turn 1. The second player has 6 cards after mulligans, then 7 cards and 0 crystals on turn 2. With no creatures at mines the first player still has 0 on turn 3. The config has `startingCrystals` 0, `poolCap` 16, `gathererFlow` 2, `fighterFlow` 1, `underdogBonus` 2, `phaseTimerSeconds` 50, `timerHiddenSeconds` 40 and `countdownSeconds` 10.
8. The match screen shows the phase name, Done button, the four crystal counters (including white) and both Commander Healths with the specified labels, and no phase timer while more than 10 seconds remain. Done advances Deploy → Action → Enemy turn.
9. Crystal Flow, with the brief's exact examples: (a) 1 Gnome Miner vs 2 Goblin Miners → mine green, Goblins 4 green, Gnomes 2 green (+2 blue underdog), and 2 green pay a 1-cost Gnome; (b) 2 vs 2 → white, 4 white each, enough for a 4-cost spell but only two 1-cost creatures; (c) 3 Miners at an own-color mine → pool 6, one dies → 4; (d) unspent crystals still there on the enemy's turn, then reset (not added); (e) pool never above 16 (Crystal card or flow 20). Off-color halves round down (9 green = 4).
10. Summoning happens on the back row only, and on the row in front only when the back row is full; with both full, there are no summons. Faction crystals are spent (Grubnak's discount applies). Summoned creatures can't act that turn (except Wolf Rider). Unique cards are limited to one. Thane Borgo gives +1 Health in the engine (a summoned Dwarf Miner is 1/2, a Shieldbeard 2/5).
11. Tunnel creatures can be summoned next to a site only while more mines are in the enemy's color than in yours.
12. Movement goes 1 space in 8 directions onto empty spaces, and move-2 creatures can go 2. In the Action phase a creature either moves or attacks, never both, except Ram Rider (Charge).
13. Combat is simultaneous: a defender strikes back even when defeated (exact numbers: 1/2 vs 1/1, two 1/1s, Shieldbeard vs Scrapper). Type advantage and Guard work, and defeated creatures go to the discard pile. Ranged hits any enemy within Chebyshev distance 2, even over creatures and at knight-move angles, and the enemy Commander from 2 away, with no strike back (an Axe Thrower 2 spaces from an enemy can attack it).
14. Creatures heal to full at the start of their owner's turn (not the opponent's turn). A damaged creature's label is marked damaged (red Health) until it heals.
15. Shield: Gnome Tinker gives adjacent allies Shield 1 at the start of its owner's turn, and it blocks exactly 1 damage.
16. A creature attacking the Commander removes exactly its Attack (Queen Brunhilda deals 5, a Scrapper deals 2, and Battle Cry adds 1). Commander damage never resets.
17. Fireball costs 3, deals 3 and can be paid with any color. Only one Crystal card can be played per turn. Prospector's Prayer (cost 1) gives 3 own-color crystals only when fewer mines are in your color. Upgrades cost 3/3/5/8, are paid like creatures (6 white = 3), are limited to one per creature, and Heavy Armor adds +3 Health.
18. Instants and counterspells: Fizzle cancels Fireball (crystals still spent) but not Battle Cry (cost 4), and Hold It! returns a summoned creature to hand. The Respond dialog appears for the human with "Let it happen" and buttons for usable Instants.
19. Deck-out: drawing from an empty deck costs the Commander 1 Health each time.
20. Winning: bringing the enemy Commander to 0 shows "Victory!", and "Back to Menu" returns to the menu. Surrendering shows "Defeat".
21. Computer opponent: Easy and Normal each complete their turn and hand it back. A Normal AI beats a player who never acts before turn 60.
22. Hand cards are buttons named after their cards, and tapping one opens a readable card view with a Close button.
23. Illegal actions are rejected without changing the state.
24. Landscape: at 844×390, 740×360 and 667×375, the menu and match screen fit without scrolling. The battlefield covers the whole viewport (no black bars), Done, the phase and both Commander Healths are visible on top of it, and hand cards are at least 60×90 px. At 390×844 (portrait), "Please rotate your phone" is shown.
25. Tutorial: the first visit offers "Welcome to Oreheart!" (Skip is remembered). The Tutorial button opens the guided match with a tip and "Skip Tutorial". The tutorial starts at step `summon` with 0 crystals, only allows back-row summons, and advances to `move` after a summon.
26. Every starter creature has printed Health ≤ 6, and Big Boss Troll, Steam Golem and Queen Brunhilda have exactly 6.
27. Creature costs match the table in 2.1 exactly, both in `getCard` and when summoning (e.g. under Borgo: Miner 1, Shieldbeard 7, Axe Thrower 6, Ram Rider 11). Basic Gatherers are 1/1. Under Grubnak, Scrounger costs 1 and Scrapper 5.
28. Phase banners: pressing Done in Deploy shows the "ACTION" banner. In an auto-skipped turn, no "DEPLOY" or "ACTION" banner appears, while "ENEMY TURN" does.
29. Auto-skip: `movesLeft()` ignores Instants, upgrades and the Gatherer swap. With `autoSkip: true`, a turn with no moves left passes to the enemy by itself, and a phase with moves left does not end by itself.
30. Creature labels show Attack, Health and Movement in order (Wolf Rider "3 … 4 … 2"). A creature that moved, attacked or was just summoned is marked `data-acted="true"` until its owner's next turn starts.
31. "Moves still available! Continue to the next phase?" appears when pressing Done with moves left. "Go back" keeps the phase, and "Continue" ends it. It does not appear with no moves left, on timeout, or after "Moves reminder: Off" is set in Settings (remembered after reload).
32. Phase timer: hidden while more than 10 seconds remain. `setPhaseTimeLeft(10)` and `setPhaseTimeLeft(3)` show the countdown "10" and "3". `setPhaseTimeLeft(0)` ends only the current phase (Deploy → Action of the same turn), with no pop-up.
33. Gatherer swap: with no Gatherer in hand, discarding a card moves exactly one basic Gatherer from the deck to the hand (hand size unchanged, discarded card in the discard pile, deck one smaller). It works with an empty hand, only once per turn, only in Deploy, and not while a Gatherer is in hand.
34. Free Gatherer: having mined nothing last turn (`minedLastTurn` 0), no mine in your color and no Gatherer on the battlefield, a basic Gatherer can be summoned for 0 (the pool is unchanged, even if it holds crystals), and only one. With a mine in your color it is not free.
35. A Gatherer summoned this turn can move but not attack in the Action phase. A summoned Fighter can do neither.
36. Income preview shows "+3 next turn" with a Gatherer and a Fighter that mined (a creature standing nearby without mining adds nothing), "+0 next turn" with nothing, and "+2 next turn" when only the underdog bonus applies. Tapping "Crystal site, row 4, column 2" shows "Controlled by: You", "Color: Green", "Your flow: +3" and "Enemy flow: +0"; an empty mine shows "Color: White". The "Mine flow, row 4, column 2" overlay shows "+3".
37. Overlay order: with the countdown showing, the "Moves still available" pop-up can still be clicked (Continue works).
38. Swapping: in the Action phase a creature can move onto its own ally's space to swap places; only the dragged creature is marked as moved, the other can still move. Moving onto an enemy is never allowed.

39. Mining (R5.3–R5.5): in the Action phase a creature next to a mine can mine it as its one action (then it can't move or attack; a creature that moved can't mine). Gatherer yields 2, Fighter 1, a creature standing nearby 0; a creature between two mines may mine either. Mine colors are set by miners only. Example: a Scrounger and a Scrapper mine → preview 3 green; on the next player turn the pool is exactly 3 green; if nobody mines that turn, the following pool is 0 and the mines return to white. Mined creatures show `data-mining="true"` and `data-acted="true"`.
40. The board is 13×7 (summon at row 7 column 13 is legal, column 14 is not; the Stronghold is at column 7). For 10 seeds there are always 3 mines in rows 3–5, mirrored, at least 2 apart, in reading order; the same seed gives the same layout; not all seeds give the same layout; the tutorial layout is always the same.
41. Pressing Done with unmined miners shows the pop-up with "2 miners haven't mined" (then "1 miner hasn't mined" after one mines).
42. Ranged creatures show 🏹 on their board label and hand card; non-Ranged don't.
43. At 844×390, hovering a hand card slides it up by at least 30 px.
44. At 844×390, "Your deck" is in the bottom-right quarter and "Enemy deck" in the top-left quarter, both showing the card count; both Commander Health readouts are visible.

Revision 5 notes on older criteria: AC9 and the other mine examples use creatures that mined (setup `minedMine`), and the tests fix the layout to mines at (4,2), (4,4), (4,6) via `mines`. AC12: moving onto your own creature is a legal swap. AC14: the opponent's Shieldbeard is at Health 2 after a 2-damage hit. AC16: Battle Cry is cast in the player's next Deploy phase. AC35: a fresh Gatherer has `data-acted="false"` and may mine; a fresh Fighter may not. AC36 uses the R5.16 names.

---

## Out of scope / limitations

- Not included: booster packs, collection, deck builder, gold, shards, shop, the full 120-card Core Set, polished art, poke reactions, sound and music, online play, accounts, Owner Console, cosmetics, daily quests, taunts, rankings, notifications, Hard AI, hint/undo buttons, time bank, sudden death (unresolved in the GDD), colorblind color picker, haptics settings, and PWA install/offline. The brief excludes them, or they need a backend.
- Settings only has the graphics toggle, because sound, music and progress don't exist yet in 1a.
- Unlockable Commanders (Queen Skreeka, Madame Sprocket, Old Grumblebeard) are not playable. Only the 3 starter Commanders are.
- There are no response chains (only one Respond level).
- Mixed-faction decks are not offered (each player uses their faction's starter deck), so a mine's color is always simply its controller's faction color.
- Mine-change effects (burst, regrow, light beams) are simple placeholder particles.
- The page can't force the phone to rotate. It only shows the rotate message.

---

## Assumptions

- (Rev 5) Mined crystals take the mine's color as recomputed at the receiving player's Draw phase, and only miners still on the battlefield and adjacent pay out; this makes the GDD example (1 Gnome vs 2 Goblin miners → green) exact for both sides.
- (Rev 5) "At least 2 spaces apart" means Chebyshev distance ≥ 2. Mirroring is by row (3 ↔ 5, same column), as the brief says.
- (Rev 5) Mining needs an unused action: Charge creatures can't combine mining with moving or attacking.
- (Rev 5) The hover pop-out is checked as "moves up ≥ 30 px"; the exact 1-inch size is a visual target.

- The player is at the bottom (rows 6–7) and the computer at the top (rows 1–2), with coordinates as in 3.1.
- "The second player draws 1 extra card" means one extra card right after the mulligan (opening hand of 6), plus their normal turn draw.
- Healing, losing old Shield and start-of-turn abilities happen in the Draw phase, before income. Setup matches skip the turn-1 Draw phase entirely.
- Mine colors are recomputed for all mines at the start of every turn; only the active player's pool is reset there.
- For a creature touching two mines, the brief and GDD give slightly different tie-breaks; the spec uses one fixed rule (3.2: more own creatures, then more enemy creatures, then the left mine) so tests are exact.
- Crystal Eaters count as Gatherers for flow (2), but not as basic Gatherers for the swap or free Gatherer.
- When the pool is over the cap, white and off-color crystals are dropped first.
- `setup` crystals are not capped, so tests can give large amounts.
- The starter deck mix stays 40/6/4 with 8 basic Gatherers: with the free Gatherer on turn 1 and the Gatherer swap, a player usually has flow and can afford something by their third turn.
- Deck-out damage is a flat 1 per failed draw (not escalating), and it is configurable.
- Spells are paid with white and non-faction colors first. Fizzle checks the printed cost (≤3).
- Guard forces melee attackers adjacent to a Guard creature to target a Guard creature. It does not block Ranged attacks.
- Ranged creatures may attack the enemy Commander when within Chebyshev distance 2 of the enemy Stronghold space. All Ranged attacks (even adjacent ones) get no strike back.
- "Moves left" (for auto-skip and the pop-up) also ignores surrender. Casting a Regular spell counts as a move; casting an Instant doesn't.
- The free Gatherer applies only to the three basic Gatherers (not Crystal Eaters), so it can't be used to get an expensive Gatherer for free. "0 crystals" means 0 of every color.
- The Gatherer swap takes the first basic Gatherer found from the top of the deck. All three factions have only one basic Gatherer, so "cheapest" is always that card.
- Phase banners are shown only for the human's own phases plus "ENEMY TURN"; the enemy's individual phases get no banner.
- The income preview uses the current board positions, because creatures may still move before the next turn.
- Auto-skip is off by default in test mode so that tests can set up a position and inspect it. It is on in normal play and in the tutorial.
- "Back row full" counts all 6 non-Stronghold spaces of the row, occupied by either side.
- Charge creatures may move and then attack. A creature that attacked can't move afterwards.
- Shield points stack and leftover Shield ends at the start of the owner's next turn. Shield Bubble remains its own effect (it stops the next hit this turn).
- Starter decks may include Rares/Ultra Rares/Collectors within the copy limits, so all 41 cards are playable in 1a.
- The first-time tutorial offer, the graphics preference and the "seen tutorial" flag are stored in localStorage under keys the builder chooses.

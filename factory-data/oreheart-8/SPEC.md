# OreHeart — Phase 1a Build Spec (Revision 2)

## Summary

Oreheart is a comic-style fantasy card battle in the browser. Goblins, Gnomes and Dwarves fight over three crystal sites on a hidden 7×7 grid, and you win by bringing the enemy Commander from 20 Health to 0. Phase 1a delivers **one complete, playable match against a computer opponent (Easy or Normal) plus a guided tutorial match**. It is built on a pure, data-driven rules engine that could later run on a server, and uses simple placeholder 3D visuals on a **landscape** screen. Rules, numbers and cards come from `factory-design/design/oreheart-gdd-v2.md` (the GDD). Scope comes from `factory-design/design/oreheart-phase-1a-brief.md` (the brief, including its "Revision 2" section). Where this spec and the GDD disagree, **this spec wins**, because it settles GDD gaps for testing.

Tech: Vite + TypeScript (vanilla or React), Three.js for the 3D scene, static `dist/` output, no backend.

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
- `deployTimerSeconds: 30`, `actionTimerSeconds: 45`, `ropeWarningSeconds: 10`, `respondWindowSeconds: 5`
- `startingCrystals: 0`, `strongholdIncome: 1`, `siteIncome: 1`, `gathererBonus: 2`, `underdogBonus: 2`
- `deckSize: 50`, `openingHandSize: 5`, `copyLimits` (Common/Uncommon unlimited; Rare/Ultra Rare/Collector 3), `crystalCardLimit: 10`
- `starterDeckMix: { creatures: 40, spells: 6, crystals: 4 }`
- `commanderHealth: 20`, upgrade costs (6/6/10/15), `deckOutDamage: 1`

Nothing balance-related is hard-coded in the engine.

1.3 **Unit tests** for the engine (Vitest; `npm test` runs them) must cover, with exact numbers:
- site control
- income, including the turn-1 opening: exactly 1 crystal
- the underdog bonus and the Tunnel condition
- back-row summoning
- simultaneous combat
- start-of-turn healing
- Shield
- Commander damage equal to Attack
- Instants/counterspells
- Crystal card limits
- win/retreat

### 2. Cards and Commanders

2.1 All **41 starter cards** from the GDD, with exactly the GDD's (revision 2) stats, rarity, cost and abilities. **Printed creature Health is at most 6.** Big Boss Troll, Steam Golem and Queen Brunhilda have Health 6. Card ids are fixed because the tests use them:

- Goblins: `goblin-scrounger`, `goblin-scrapper`, `goblin-slinger`, `goblin-bomber`, `goblin-sneak`, `wolf-rider`, `grubnaks-big-boss-troll`
- Gnomes: `gnome-prospector`, `gnome-tinker`, `spark-gnome`, `clockwork-beetle`, `gnome-illusionist`, `gyrocopter-ace`, `the-great-steam-golem`
- Dwarves: `dwarf-miner`, `shieldbeard`, `axe-thrower`, `ironhammer-berserker`, `brewmaster`, `ram-rider`, `queen-brunhilda-stonebeard`
- Crystal Eaters: `shard-guzzler`, `overclocked-conduit`, `crystal-drunk-delver`
- Spells: `prospectors-prayer`, `tunnel-rush`, `fireball`, `battle-cry`, `meteor-strike`, `healing-light`, `shield-bubble`, `second-wind`, `fizzle`, `hold-it`, `spell-snap`, `mirror-hex`
- Crystal cards: `soul-shard`, `crystal-cluster`, `glowing-geode`, `heart-of-the-fallen`, `motherlode`

Reworked cards (revision 2):
- **Gnome Tinker** (Fix-it): at the start of your turn, each adjacent ally gets Shield 1.
- **Brewmaster** (Hearty Ale): at the start of your turn, each adjacent ally gets +1 Health (max and current) until your next turn.
- **Heavy Armor** upgrade: +3 Health (max and current). It no longer heals separately.
- **Madame Sprocket** (not playable in 1a): her ability gives Shield 1 to your lowest-Health creature at the start of your turn. Put it in `commanders.json` only.

2.2 **Commanders** (ids fixed). All have 20 Health.
- `grubnak` (Grubnak the Goblin Boss, goblins): Goblin creatures cost 1 less, minimum 1.
- `sproingle` (Professor Sproingle, gnomes): your spells cost 1 less, minimum 1.
- `borgo` (Thane Borgo Anvilbottom, dwarves): your creatures get +1 Health, applied to max and current Health on entering the battlefield.

2.3 **Starter decks**: one 50-card deck per faction in `starter-decks.json`. Each deck has:
- exactly **40 creatures** of that faction (including each of its 7 starter creatures and its Crystal Eater at least once; the rest are Commons)
- exactly **6 spells** from the spell list, including **at least 1 Fizzle**
- exactly **4 Crystal cards**
- at most 3 copies of any Rare/Ultra Rare/Collector card

Extra original Common **creatures** may be added. Use original names only, never names from Warcraft, Warhammer, Magic, Hearthstone, Pokémon or any other game. Their printed Health must also be ≤ 6. A player's deck is their Commander's faction deck.

### 3. Rules (engine): clarifications on top of the GDD

3.1 **Coordinates**: `row` runs 1–7 top to bottom, `col` 1–7 left to right.
- The **opponent** (computer) is at the top: home rows 1–2, **back row = row 1**, Stronghold at row 1 col 4.
- The **player** (human) is at the bottom: home rows 6–7, **back row = row 7**, Stronghold at row 7 col 4.
- Strongholds occupy their space, so nothing can stand there.
- Crystal sites are at (4,2), (4,4), (4,6). They can't be stood on.

3.2 **Site control** is recomputed for all three sites at the start of every turn (Draw phase), and also once when a match is created from `setup` (4.4).
- A side controls a site if it has strictly more creatures on the 8 surrounding spaces.
- Ties (including 0–0) mean nobody controls it (`null`).
- Spaces in columns 3 and 5 of rows 3–5 count for both neighbouring sites.
- A newly controlled site switches to the controller's faction color.

3.3 **Income** (Draw phase, active player only), all in the player's faction color:
- +1 Stronghold trickle
- +1 per controlled site
- +2 per own Gatherer on a surrounding space of each controlled site (a Gatherer touching two controlled sites gives +2 for each)
- +1 per own Glowing Geode
- **+2 underdog bonus only if the player controls no sites AND the enemy controls at least one site**

**Starting crystals are 0**, and income also applies on turn 1. So the first player starts turn 1 with exactly **1** crystal, and the second player has exactly 1 on turn 2 (if nobody holds a site).

3.4 **Setup**:
1. Each deck is shuffled with the seeded RNG, and each player draws 5.
2. Mulligan: each player once chooses any cards to shuffle back and redraws the same number. The player decides first, then the opponent.
3. A seeded coin flip picks the first player.
4. After mulligans, the second player draws 1 extra card.

Turn 1 is the first player's first turn, and on it they skip their draw.

3.5 **Turn phases**: Draw → Deploy → Action → End → the other player's turn.
- **Draw** (automatic): all the active player's creatures heal to full and lose leftover Shield from last turn. Then start-of-turn abilities happen (Fix-it, Hearty Ale), the player draws 1 card, site control is recomputed and income is collected.
- **Deploy** (timed, 30 s).
- **Action** (timed, 45 s).
- **End** (automatic: end-of-turn effects).

The `done` action ends the current timed phase. `turn` counts every turn of either player (turn 1 = first player, turn 2 = second player, …).

3.6 **Costs & payment**:
- Creatures cost crystals of their faction color only.
- Spells cost crystals of any color. The engine spends non-faction colors first, then the faction color.
- Crystal cards are free.
- A countered spell or creature still costs its owner the crystals.

3.7 **Deploy phase**:
- **Summoning:** creatures are summoned onto empty spaces of **your back row only** (row 7 for the player, row 1 for the opponent).
  - Only when every space of the back row is filled (by anyone) may you summon onto the row in front of it (row 6 / row 2).
  - If both rows are full, you can't summon.
- **Tunnel**: a Tunnel creature may instead be summoned onto any empty space adjacent (8-way) to a crystal site, but **only while the enemy controls more sites than you** (using the current `sites` controllers).
- **Crystal cards:** play up to 1 per turn (Deploy phase only). Crystal Eaters allow extra plays, with the GDD's drawback for each extra card.
- **Upgrades:** Deploy phase only, max 1 per creature, paid in faction color:
  - Sharpened Weapons 6: +1 Attack
  - Heavy Armor 6: +3 Health, max and current
  - Veteran 10: move 2
  - Champion's Crown 15: +2 Attack and +3 Health
- **Unique cards:** only one copy of that card on your battlefield at a time.
- **Regular spells** may be cast in the Deploy or Action phase of your turn.

3.8 **Action phase: each creature either moves OR attacks, never both**, except creatures with **Charge** (Ram Rider), which may move and then attack in the same turn. Once a creature has attacked, it can't move.
- **Move:** 1 space in 8 directions onto an empty space. Ultra Rare, Collector and Veteran creatures move up to 2; the path can't pass through creatures, Strongholds or sites unless the creature has Flying.
- Creatures summoned this turn can't act unless their ability says so (Wolf Rider can).

3.9 **Combat** (Action phase):
- **Melee** reaches the 8 surrounding spaces. **Ranged** creatures can also hit exactly 2 spaces away in a straight or diagonal line, with an empty space in between.
- Attacking the enemy Commander requires being adjacent to the enemy Stronghold, or a Ranged creature at distance 2 in line with a clear middle space.
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
- Fizzle cancels a spell with **printed** cost ≤5.
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
- Phase timers are paused: no auto-advance, and the timer shows the full phase length.
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
| `setup` | object, see 4.4 | none |

The same seed and options always produce the same starting state.

4.4 **`setup`** (for tests): when given, the mulligan is skipped and the match begins directly in the **Deploy phase of turn 1** of `setup.firstPlayer` (default `"player"`). There is **no** draw, income or start-of-turn healing for that turn, but site control **is** computed from the setup board. Fields (all optional):
- `playerHand`, `opponentHand`: arrays of card ids (default `[]`).
- `playerDeck`, `opponentDeck`: arrays of card ids, top first (default: that faction's starter deck, shuffled by seed).
- `playerCrystals`, `opponentCrystals`: `{ green, blue, purple }` (missing colors = 0; default all 0).
- `playerHealth`, `opponentHealth`: Commander Health (default 20).
- `board`: array of `{ cardId, owner: "player"|"opponent", row, col, damage?, shield? }`. These creatures are not "summoned this turn", so they can act. Commander abilities apply (e.g. Borgo's +1 Health), and `damage` is subtracted after that.

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
                crystals: { green, blue, purple },
                hand: [{ uid, cardId }], deck: [{ uid, cardId }] /* top first */, discard: [{ uid, cardId }] },
    opponent: { ...same }
  },
  board: { creatures: [{ uid, cardId, owner, row, col, attack, health, maxHealth, shield,
                         upgrade: null | "sharpened-weapons" | "heavy-armor" | "veteran" | "champions-crown",
                         summonedThisTurn: boolean, hasMoved: boolean, hasAttacked: boolean }] },
  sites: [ { row: 4, col: 2, controller, color }, { row: 4, col: 4, ... }, { row: 4, col: 6, ... } ],  // in this order
  pendingResponse: null | { responder: "player" | "opponent", ... },
  tutorial: null | { step: "summon"|"move"|"capture"|"spend"|"fight"|"spell"|"commander"|"complete" }
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
- `{ type: "move", creatureUid, row, col }`
- `{ type: "attack", creatureUid, target }`
- `{ type: "ability", creatureUid, ability, target? }`: activated abilities, e.g. Blink.
- `{ type: "respond", uid, target? }` and `{ type: "pass" }`: during a Respond window.
- `{ type: "done" }`: end the current timed phase (Deploy → Action → End/next turn).
- `{ type: "surrender" }`

`legalActions()` lists every legal action in these formats, with one entry per legal target or space. `done` is legal in the Deploy and Action phases for the priority player.

### 5. Screens and text

5.1 **Main menu** (`/`): heading (h1) **"Oreheart"** and exactly four buttons, in this order: **"Play"**, **"Tutorial"**, **"Rules"**, **"Settings"**. No other button or link on the menu may contain the word "Play" (in any letter case).

5.2 **First-time tutorial offer**: the first time the main menu is shown (outside test mode), a dialog appears (`role="dialog"`, name **"Welcome to Oreheart!"**) with the buttons **"Start Tutorial"** and **"Skip"**. Either choice is saved in localStorage, so the offer never appears again after a reload. "Start Tutorial" starts the tutorial match.

5.3 **Settings screen**: heading **"Settings"**, a graphics toggle button labelled **"Graphics: High"** / **"Graphics: Low"** and a **"Back"** button to the main menu.
- Clicking the toggle switches it. The default is High.
- The choice is saved in localStorage and restored on reload.
- Low cuts particles, shadows and pixel ratio.

5.4 **Play setup screen**: heading **"Choose Your Commander"**.
- One button per Commander with its full name: **"Grubnak the Goblin Boss"**, **"Professor Sproingle"**, **"Thane Borgo Anvilbottom"**. The selected one has `aria-pressed="true"`. A short faction description sits under each.
- Difficulty buttons **"Easy"** and **"Normal"**. The selected one has `aria-pressed="true"`, and the default is Normal.
- Buttons **"Start Match"** and **"Back"**.
- The computer picks a different Commander at random.

5.5 **Mulligan**: when a match starts from the UI, a dialog (`role="dialog"`, name **"Mulligan"**) shows the 5-card hand. Tapping cards marks them. Buttons: **"Keep Hand"** and **"Redraw Selected"**.

5.6 **Match screen: landscape** (designed at 844×390, scales up to desktop). It is laid out like the mockup but for a wide screen:
- **Center:** the battlefield, viewed at an angle like a tabletop. The enemy Stronghold is at the far side and yours at the near side.
  - Three.js scene with painted ground and no grid lines.
  - Three glowing crystal formations, recolored by controller and showing the faction symbol (Goblin skull, Gnome gear, Dwarf hammer).
  - Two Strongholds, each with a simple Commander figure (top half) that emotes: cheer, groan, flinch.
  - Creatures are simple placeholder 3D figures in faction color, with the faction symbol.
  - Valid spaces glow while dragging.
  - If WebGL is unavailable, the match still works with a simple 2D board and no uncaught errors.
- **Creature labels:** each creature on the board has a real HTML overlay element.
  - Its accessible name is **"<Card Name>, row R, column C"** (e.g. "Shieldbeard, row 5, column 4"), and its text shows its Attack and current Health numbers.
  - When `health < maxHealth`, the element has the attribute `data-damaged="true"` and the Health number is shown in **red** (`#ff4040`) until it heals. Otherwise it has `data-damaged="false"`.
  - Shield shows as a small shield icon with its number.
- **Top edge:** enemy card backs fanned in an arc (element with `aria-label="Enemy hand"`; its text or label includes the count).
- **Left side:** crystal counters (`aria-label="Your green crystals"`, `"Your blue crystals"`, `"Your purple crystals"`; text = number), your deck pile (`aria-label="Your deck"`; text = cards left) and the enemy deck pile (`aria-label="Enemy deck"`).
- **Right side:**
  - Current phase (`aria-label="Current phase"`): text contains **"Deploy"** or **"Action"**, prefixed with **"Your turn"** or **"Enemy turn"**.
  - Phase timer (`aria-label="Phase timer"`): text = seconds remaining, starting at **30** in Deploy and **45** in Action. A burning-rope bar shows in the last 10 seconds. At 0 the phase ends automatically, except in test mode.
  - The **"Done"** button.
  - Your Commander Health (`aria-label="Your Commander health"`) and Enemy Commander Health (`aria-label="Enemy Commander health"`); text contains the number.
  - A **"Menu"** button.
- **Bottom edge:** your hand, as real HTML buttons fanned in a rainbow arc. Each button's accessible name is the card's name (e.g. "Fireball"). Swipe or mouse wheel scrolls the fan. Hand size is unlimited.
- **Card view:** clicking or tapping a hand card (without dragging) opens a dialog named with the card's name. It shows cost, Attack/Health (creatures), movement, role, rarity and ability text, and has a **"Close"** button. Double-tapping a creature on the board opens the same view.
- **Interactions:**
  - Drag a card onto the battlefield to summon or cast. Valid spaces glow; for summons that is the back row.
  - Press and drag a creature to move it, or drag it onto an enemy or the enemy Stronghold to attack.
  - Tap your creature in the Deploy phase to get an **"Upgrade"** option listing the affordable upgrades.
- **Animations:** summon rise, walk, attack lunge (both creatures hit together), floating damage numbers, shield-block flash, defeat poof, and a retreat scene at match end. The Done button and all key elements stay usable during animations.

5.7 **Rotate overlay**: whenever the window is portrait (height > width) **and** narrower than 900 px, a full-screen overlay shows the text **"Please rotate your phone"**, on every screen. It disappears when the window is landscape.

5.8 **Respond dialog**: when the human player has a Respond window, a dialog (`role="dialog"`, name **"Respond?"**) shows one button per usable Instant (name = card name) and a **"Let it happen"** button.
- Choosing an Instant casts it. If the triggering action targets one of your creatures, the Instant automatically targets that creature. Counterspells target the triggering spell or summon. Otherwise you are asked to tap a target.
- In normal mode the dialog closes by itself after `respondWindowSeconds` (which counts as a pass). In test mode it stays until answered.

5.9 **Tutorial match**: started from the **"Tutorial"** menu button, from "Start Tutorial", or from `window.oreheart.startTutorial()`. It always uses the same fixed setup from `tutorial.json`: the player is Grubnak, against a harmless scripted opponent with the same cards every time. There are **no timers**: the timer is hidden or paused.
- The match begins on the player's turn 1 Deploy phase. The hand includes at least one creature the player can afford with the 1 starting crystal.
- A tip box (`aria-label="Tutorial tip"`, real HTML) walks through these steps **in order**. Each step waits until it is done, and `state.tutorial.step` shows the current one:
  1. `summon`: summon a troop on your back row (the tip text contains "back row")
  2. `move`: march it forward
  3. `capture`: take a crystal site and watch it change color
  4. `spend`: spend crystals
  5. `fight`: fight an enemy (simultaneous hits, healing next turn)
  6. `spell`: cast a spell
  7. `commander`: attack the enemy Commander until they retreat
  8. `complete`
- The normal rules apply, including back-row summoning.
- A **"Skip Tutorial"** button returns to the main menu. Winning shows the normal "Victory!" screen. The tutorial can be replayed any time.

5.10 **Match menu**: "Menu" opens a dialog with **"Resume"** and **"Surrender"**. Surrender asks **"Surrender this match?"** with **"Yes, surrender"** and **"Cancel"**.

5.11 **End screen**: after the retreat scene, heading **"Victory!"** (you won) or **"Defeat"** (you lost or surrendered), a one-line flavor message and a **"Back to Menu"** button, which returns to the main menu.

5.12 **Rules screen**: heading **"Rules"**, short sections (Goal, The Board, Crystals, Your Turn, Combat, Spells & Instants) and at least 3 simple pictures (`<img>` with alt text, or inline SVG with `role="img"` and an aria-label). A **"Back"** button returns to the main menu. The text must reflect revision 2 rules: back-row summoning, move OR attack, simultaneous hits, healing each turn, and Shield.

### 6. Computer opponent

6.1 The AI uses only `legalActions()` + `applyAction()`.
- **Easy**: mostly random legal moves, with a light preference for summoning and attacking.
- **Normal**:
  - contests crystal sites (marches Gatherers toward sites and uses Tunnel when allowed)
  - keeps Gatherers out of reach of enemy attacks where possible
  - attacks the enemy Commander whenever a creature can
  - makes favourable trades, considering simultaneous strike back
  - casts damage spells on good targets
  - uses Instants and counterspells when the Respond window offers a good one

Each AI turn completes within 3 seconds of computation on a mid-range phone: instantly in test mode, plus animations otherwise. The AI handles its own mulligan.

---

## Look & feel

- Comic-book fantasy with a dark painted battlefield as in the mockup: dirt, grass and rock ground, no grid lines.
- Glossy neon gems: green `#3ee06a` (Goblins), blue `#3fa9ff` (Gnomes), purple `#b45cff` (Dwarves). Uncontrolled crystals are a neutral pale gray-white.
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
2. Play → "Choose Your Commander" shows all three Commanders and Easy/Normal. Choosing Professor Sproingle + Normal and clicking "Start Match" opens the Mulligan dialog. "Keep Hand" reaches the match screen with the Done button, and the player's Commander is Sproingle.
3. Rules shows its heading and at least one picture, and "Back" returns to the main menu.
4. Settings has the graphics toggle, which switches between "Graphics: High" and "Graphics: Low" and remembers the choice after reload. "Back" returns to the menu.
5. `window.oreheart` exists only with `?test=1`, and the same seed gives the same starting hands.
6. Each starter deck has 50 cards: exactly 40 creatures, 6 spells (including at least 1 Fizzle) and 4 Crystal cards, with ≤3 copies of each Rare/Ultra Rare/Collector card. Both Commanders start with 20 Health and an opening hand of 5.
7. Opening: the first player starts turn 1 with exactly 1 crystal of their color and 5 cards. The second player has 6 cards after mulligans, then 7 cards and exactly 1 crystal on turn 2.
8. The match screen shows the phase name, phase timer (30 in Deploy, 45 in Action), Done button, crystal counters and both Commander Healths with the specified labels. Done advances Deploy → Action → Enemy turn.
9. Site control and income: majority control, ties = nobody, and shared columns count for both sites. The Gatherer bonus gives exact totals. The underdog bonus (+2) applies only when the enemy controls a site; with no sites held it gives exactly 1.
10. Summoning happens on the back row only, and on the row in front only when the back row is full; with both full, there are no summons. Faction crystals are spent (Grubnak's discount applies). Summoned creatures can't act that turn (except Wolf Rider). Unique cards are limited to one, and Borgo gives +1 Health.
11. Tunnel creatures can be summoned next to a site only while the enemy controls more sites than you.
12. Movement goes 1 space in 8 directions onto empty spaces, and move-2 creatures can go 2. In the Action phase a creature either moves or attacks, never both, except Ram Rider (Charge).
13. Combat is simultaneous: a defender strikes back even when defeated (exact numbers: 1/2 vs 1/1, two 1/1s, Shieldbeard vs Scrapper). Type advantage, Guard and Ranged (no strike back) work, and defeated creatures go to the discard pile.
14. Creatures heal to full at the start of their owner's turn (not the opponent's turn). A damaged creature's label is marked damaged (red Health) until it heals.
15. Shield: Gnome Tinker gives adjacent allies Shield 1 at the start of its owner's turn, and it blocks exactly 1 damage.
16. A creature attacking the Commander removes exactly its Attack (Queen Brunhilda deals 5, a Scrapper deals 2, and Battle Cry adds 1). Commander damage never resets.
17. Fireball deals 3 and can be paid with any color. Only one Crystal card can be played per turn. Upgrades cost the specified amount and are limited to one per creature, and Heavy Armor adds +3 Health.
18. Instants and counterspells: Fizzle cancels Fireball (crystals still spent), and Hold It! returns a summoned creature to hand. The Respond dialog appears for the human with "Let it happen" and buttons for usable Instants.
19. Deck-out: drawing from an empty deck costs the Commander 1 Health each time.
20. Winning: bringing the enemy Commander to 0 shows "Victory!", and "Back to Menu" returns to the menu. Surrendering shows "Defeat".
21. Computer opponent: Easy and Normal each complete their turn and hand it back. A Normal AI beats a player who never acts before turn 60.
22. Hand cards are buttons named after their cards, and tapping one opens a readable card view with a Close button.
23. Illegal actions are rejected without changing the state.
24. Landscape: at 844×390, the menu and match screen fit without horizontal scrolling, and Done, the phase and both Commander Healths are visible. At 390×844 (portrait), "Please rotate your phone" is shown.
25. Tutorial: the first visit offers "Welcome to Oreheart!" (Skip is remembered). The Tutorial button opens the guided match with a tip and "Skip Tutorial". The tutorial starts at step `summon`, only allows back-row summons, and advances to `move` after a summon.
26. Every starter creature has printed Health ≤ 6, and Big Boss Troll, Steam Golem and Queen Brunhilda have exactly 6.

---

## Out of scope / limitations

- Not included: booster packs, collection, deck builder, gold, shards, shop, the full 120-card Core Set, polished art, poke reactions, sound and music, online play, accounts, Owner Console, cosmetics, daily quests, taunts, rankings, notifications, Hard AI, hint/undo buttons, time bank, sudden death (unresolved in the GDD), colorblind color picker, haptics settings, and PWA install/offline. The brief excludes them, or they need a backend.
- Settings only has the graphics toggle, because sound, music and progress don't exist yet in 1a.
- Unlockable Commanders (Queen Skreeka, Madame Sprocket, Old Grumblebeard) are not playable. Only the 3 starter Commanders are.
- There are no response chains (only one Respond level).
- Mixed-faction decks are not offered (each player uses their faction's starter deck), so "pick the site color" never comes up.
- The page can't force the phone to rotate. It only shows the rotate message.

---

## Assumptions

- The player is at the bottom (rows 6–7) and the computer at the top (rows 1–2), with coordinates as in 3.1.
- "The second player draws 1 extra card" means one extra card right after the mulligan (opening hand of 6), plus their normal turn draw.
- Healing, losing old Shield and start-of-turn abilities happen in the Draw phase, before income. Setup matches skip the turn-1 Draw phase entirely.
- Site control is recomputed for all sites at the start of every turn, and income goes to the active player.
- A Gatherer touching two controlled sites gives its +2 for each site.
- Deck-out damage is a flat 1 per failed draw (not escalating), and it is configurable.
- Spells are paid with non-faction colors first. Fizzle checks the printed cost.
- Guard forces melee attackers adjacent to a Guard creature to target a Guard creature. It does not block Ranged attacks.
- Ranged creatures may attack the enemy Commander from 2 spaces away in a clear straight or diagonal line.
- "Back row full" counts all 6 non-Stronghold spaces of the row, occupied by either side.
- Charge creatures may move and then attack. A creature that attacked can't move afterwards.
- Shield points stack and leftover Shield ends at the start of the owner's next turn. Shield Bubble remains its own effect (it stops the next hit this turn).
- Starter decks may include Rares/Ultra Rares/Collectors within the copy limits, so all 41 cards are playable in 1a.
- The first-time tutorial offer, the graphics preference and the "seen tutorial" flag are stored in localStorage under keys the builder chooses.

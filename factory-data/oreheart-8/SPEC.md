# OreHeart — Phase 1a Build Spec

## Summary

Oreheart is a comic-style fantasy card battle in the browser: Goblins, Gnomes and Dwarves fight over three crystal sites on a hidden 7×7 grid, and you win by bringing the enemy Commander from 20 Health to 0. Phase 1a delivers **one complete, playable match against a computer opponent (Easy or Normal)**, built on a pure, data-driven, server-ready rules engine, with simple placeholder 3D visuals laid out like the mockup. Rules, numbers and cards come from `factory-design/design/oreheart-gdd-v2.md` (the GDD); scope comes from `factory-design/design/oreheart-phase-1a-brief.md` (the brief). Where this spec and the GDD disagree, **this spec wins** (it resolves GDD ambiguities for testing).

Tech: Vite + TypeScript (vanilla or React), Three.js for the 3D scene, static `dist/` output, no backend.

---

## Pages & features

### 1. Architecture (not directly visible, but required)

1.1 **Rules engine** in `src/engine/`, pure TypeScript: no DOM, no `window`, no timers, no rendering, no `Math.random`. All randomness (shuffles, coin flip) comes from a seeded RNG passed in. State is plain JSON-serializable data (`JSON.parse(JSON.stringify(state))` must lose nothing). The engine exposes: `createMatch(options)`, `legalActions(state)`, `applyAction(state, action)` → new state + events (events are for animations: summon, move, attack, damage, defeat, heal, spell, counter, siteControl, income, draw, deckOut, retreat…).

1.2 **Content as data** in `src/content/` as JSON: `factions.json`, `crystal-colors.json`, `commanders.json`, `cards.json`, `abilities.json`, `starter-decks.json`, `game-config.json`. `game-config.json` holds every tunable number, at least: `phaseTimerSeconds: 30`, `ropeWarningSeconds: 10`, `respondWindowSeconds: 5`, `startingCrystals: 3`, `strongholdIncome: 1`, `siteIncome: 1`, `gathererBonus: 2`, `underdogBonus: 2`, `deckSize: 50`, `openingHandSize: 5`, `copyLimits` (Common/Uncommon unlimited, Rare/Ultra Rare/Collector 3), `crystalCardLimit: 10`, `commanderHealth: 20`, upgrade costs (6/6/10/15), `deckOutDamage: 1`. Nothing balance-related is hard-coded in the engine.

1.3 **Unit tests** for the engine (Vitest) covering site control, income, combat, Instants/counterspells, Crystal card limits, and win/retreat. `npm test` runs them.

### 2. Cards and Commanders

2.1 All **41 starter cards** from the GDD with exactly the GDD's stats, rarity, cost and abilities. Card ids are fixed (tests use them):

- Goblins: `goblin-scrounger`, `goblin-scrapper`, `goblin-slinger`, `goblin-bomber`, `goblin-sneak`, `wolf-rider`, `grubnaks-big-boss-troll`
- Gnomes: `gnome-prospector`, `gnome-tinker`, `spark-gnome`, `clockwork-beetle`, `gnome-illusionist`, `gyrocopter-ace`, `the-great-steam-golem`
- Dwarves: `dwarf-miner`, `shieldbeard`, `axe-thrower`, `ironhammer-berserker`, `brewmaster`, `ram-rider`, `queen-brunhilda-stonebeard`
- Crystal Eaters: `shard-guzzler`, `overclocked-conduit`, `crystal-drunk-delver`
- Spells: `prospectors-prayer`, `tunnel-rush`, `fireball`, `battle-cry`, `meteor-strike`, `healing-light`, `shield-bubble`, `second-wind`, `fizzle`, `hold-it`, `spell-snap`, `mirror-hex`
- Crystal cards: `soul-shard`, `crystal-cluster`, `glowing-geode`, `heart-of-the-fallen`, `motherlode`

2.2 **Commanders** (ids fixed): `grubnak` (Grubnak the Goblin Boss, goblins, Goblin creatures cost 1 less, min 1), `sproingle` (Professor Sproingle, gnomes, your spells cost 1 less, min 1), `borgo` (Thane Borgo Anvilbottom, dwarves, your creatures get +1 Health — applied to max and current Health on entering the battlefield). All have 20 Health.

2.3 **Starter decks**: one 50-card deck per faction in `starter-decks.json`. Each: exactly 50 cards; only that faction's creatures plus spells and Crystal cards; at most 10 Crystal cards; at most 3 copies of any Rare/Ultra Rare/Collector card; contains each of its faction's 7 starter creatures and its Crystal Eater at least once, and at least 4 spells. Extra original Commons may be added (original names only — never names from Warcraft, Warhammer, Magic, Hearthstone, Pokémon or any other game). A player's deck is their Commander's faction deck.

### 3. Rules (engine) — clarifications on top of the GDD

3.1 **Coordinates**: `row` 1–7 top to bottom, `col` 1–7 left to right. The **opponent** (computer) is at the top: home rows 1–2, Stronghold at row 1 col 4. The **player** (human) is at the bottom: home rows 6–7, Stronghold at row 7 col 4. Strongholds occupy their space (nothing can stand there). Crystal sites at (4,2), (4,4), (4,6); they can't be stood on.

3.2 **Site control** is recomputed for all three sites at the start of every turn (Draw phase): a side controls a site if it has strictly more creatures on the 8 surrounding spaces; ties (including 0–0) = nobody (`null`). Spaces in columns 3 and 5 of rows 3–5 count for both neighbouring sites. A newly controlled site switches to the controller's faction color.

3.3 **Income** (Draw phase, active player only): +1 Stronghold, +1 per controlled site, +2 per own Gatherer on a surrounding space of each controlled site (a Gatherer touching two controlled sites gives +2 for each), +1 per own Glowing Geode, and +2 underdog bonus if the player controls no sites. All income is in the player's faction color. Income also applies on turn 1.

3.4 **Setup**: each deck is shuffled with the seeded RNG; each player draws 5. Mulligan: each player once chooses any cards to shuffle back and redraw the same number (player decides first, then opponent). Seeded coin flip picks the first player. After mulligans, the second player draws 1 extra card. Turn 1 = first player's first turn; on it they skip their draw. Starting crystals: 3 of the faction color.

3.5 **Turn phases**: Draw (automatic: draw 1, collect income, start-of-turn abilities) → Deploy (timed) → Movement (timed) → Attack (timed) → End (automatic: end-of-turn effects) → other player's turn. The `done` action ends the current timed phase. `turn` counts every turn of either player (turn 1 = first player, turn 2 = second player, …).

3.6 **Costs & payment**: creatures cost crystals of their faction color only. Spells cost crystals of any color; the engine automatically spends non-faction colors first, then faction color. Crystal cards are free. A countered spell or creature still costs its owner the crystals.

3.7 **Deploy phase**: summon creatures onto empty spaces in your home rows; Tunnel creatures may instead go on any empty space adjacent (8-way) to a site. If every space in your home rows is filled (by anyone) and contains at least one enemy, you may summon onto any empty space within 2 spaces (Chebyshev distance) of your Stronghold; if none, you can't summon. Play up to 1 Crystal card per turn (Deploy phase only); Crystal Eaters allow extra plays with the GDD's drawback per extra card. Upgrades: Deploy phase only, max 1 per creature, cost in faction color (Sharpened Weapons 6: +1 Attack; Heavy Armor 6: +3 max Health and heal 3; Veteran 10: move 2; Champion's Crown 15: +2 Attack and +3 max Health). Unique cards: only one copy of that card on your battlefield at a time.

3.8 **Movement**: 1 space in 8 directions onto an empty space; Ultra Rare, Collector and Veteran creatures move up to 2 (path can't pass through creatures, Strongholds or sites unless Flying). Each creature moves once per turn. Creatures summoned this turn can't move or attack unless their ability says so (Wolf Rider can).

3.9 **Combat** (Attack phase, each creature attacks once): melee on the 8 surrounding spaces; Ranged also hits exactly 2 spaces away in a straight or diagonal line with an empty space in between. Attacking the enemy Commander requires being adjacent to the enemy Stronghold (or Ranged at distance 2 in line with a clear middle space). Strike back in melee if the defender survives (not against Ranged attacks, not against Sneaky). Type advantage +1 (Dwarves→Goblins, Goblins→Gnomes, Gnomes→Dwarves), including strike backs. Guard: if an attacker is adjacent to an enemy Guard creature, its melee attacks must target a Guard creature. Damage stays; healing never exceeds max Health. Defeated creatures go to the discard pile and lose upgrades. Commander never strikes back.

3.10 **Spells and Respond window**: Regular spells in any phase of your own turn (Deploy, Movement or Attack). Instants any time you have priority. When a player casts a spell, summons a creature, or attacks a creature, and the other player holds an Instant they can afford and legally use, a Respond window opens for that other player (`pendingResponse`). They may cast one Instant (`respond`) or `pass`. The response resolves first, then the original action (unless cancelled). Only one level of response (no responding to a response). Counterspells: Fizzle cancels a spell with **printed** cost ≤5; Hold It! cancels a creature summon and returns the card to its owner's hand; Spell Snap cancels any spell; Mirror Hex cancels a spell and casts a free copy for the responder (targets chosen automatically by the engine where needed).

3.11 **Deck-out**: drawing from an empty deck deals `deckOutDamage` (1) to that Commander instead, every time it happens.

3.12 **Winning**: a Commander at 0 Health retreats; the other player wins (`winner`), `phase` becomes `"over"`. Surrender ends the match immediately as a loss for the surrendering side.

### 4. Test mode and `window.oreheart` (required exactly as written)

4.1 URL `?test=1` turns on test mode: phase timers paused (no auto-advance), the AI takes its actions immediately (no animation waits), shuffle seed fixed (`?seed=N` sets it; default seed `1`). Without `?test=1`, `window.oreheart` is **undefined**.

4.2 `window.oreheart` (in test mode) has these functions. Each may return a value or a Promise of it.

- `getState()` → a deep copy of the engine state as plain data.
- `legalActions()` → array of action objects legal for the player who currently has priority.
- `act(action)` → `{ ok: true, events: [...] }` if legal and applied; `{ ok: false, error: "<message>" }` if illegal (state unchanged, never throws). The screen updates to match.
- `newMatch(options)` → starts a new match, shows the match screen, returns the state.

4.3 **`newMatch` options** (all optional):

| Option | Values | Default |
| --- | --- | --- |
| `playerCommander` | `"grubnak"`, `"sproingle"`, `"borgo"` | `"grubnak"` |
| `opponentCommander` | same | `"sproingle"` |
| `difficulty` | `"easy"`, `"normal"` | `"normal"` |
| `seed` | integer | URL seed, else 1 |
| `ai` | `true` = computer plays the opponent; `false` = the opponent is driven through `act()` too | `true` |
| `firstPlayer` | `"player"`, `"opponent"` | seeded coin flip |
| `skipMulligan` | `true` = both keep their opening hands | `false` |
| `setup` | object, see 4.4 | none |

The same seed and options always produce the same starting state.

4.4 **`setup`** (for tests): when given, the mulligan is skipped and the match begins directly in the **Deploy phase of turn 1** of `setup.firstPlayer` (default `"player"`), **without** a draw or income for that turn. Fields (all optional):
- `playerHand`, `opponentHand`: arrays of card ids (default `[]`).
- `playerDeck`, `opponentDeck`: arrays of card ids, top first (default: that faction's starter deck, shuffled by seed).
- `playerCrystals`, `opponentCrystals`: `{ green, blue, purple }` (missing colors = 0; default all 0).
- `playerHealth`, `opponentHealth`: Commander Health (default 20).
- `board`: array of `{ cardId, owner: "player"|"opponent", row, col, damage? }`. These creatures are not "summoned this turn" (they can move and attack), and Commander abilities apply (e.g. Borgo's +1 Health).

4.5 **State shape** (fields required; more fields allowed):

```
{
  turn: number,
  activePlayer: "player" | "opponent",          // whose turn it is
  priority: "player" | "opponent" | null,       // who must act now (legalActions are for them)
  phase: "mulligan" | "draw" | "deploy" | "movement" | "attack" | "end" | "over",
  winner: null | "player" | "opponent",
  players: {
    player:   { commanderId, faction: "goblins"|"gnomes"|"dwarves", health, maxHealth,
                crystals: { green, blue, purple },
                hand: [{ uid, cardId }], deck: [{ uid, cardId }] /* top first */, discard: [{ uid, cardId }] },
    opponent: { ...same }
  },
  board: { creatures: [{ uid, cardId, owner, row, col, attack, health, maxHealth,
                         upgrade: null | "sharpened-weapons" | "heavy-armor" | "veteran" | "champions-crown",
                         summonedThisTurn: boolean }] },
  sites: [ { row: 4, col: 2, controller, color }, { row: 4, col: 4, ... }, { row: 4, col: 6, ... } ],  // in this order
  pendingResponse: null | { responder: "player" | "opponent", ... }
}
```
`attack` = base Attack plus permanent modifiers (upgrades, Crystal-Drunk Delver penalty); situational bonuses (Frenzy, Rally, type advantage, Battle Cry) are applied in combat. `health` is current Health; `maxHealth` includes Borgo and upgrades.

4.6 **Action formats** (exact). Targets are `{ row, col }` (a creature or space) or `{ commander: "player"|"opponent" }`.

- `{ type: "mulligan", uids: [...] }` — `uids` = hand cards to redraw (`[]` keeps).
- `{ type: "summon", uid, row, col }`
- `{ type: "cast", uid, target? }` — Regular spell or Instant on your own turn.
- `{ type: "playCrystal", uid, colors? }` — `colors` only for Heart of the Fallen.
- `{ type: "upgrade", creatureUid, upgrade }`
- `{ type: "move", creatureUid, row, col }`
- `{ type: "attack", creatureUid, target }` — target a creature `{row,col}` or `{ commander: "opponent"/"player" }` for the enemy Stronghold.
- `{ type: "ability", creatureUid, ability, target? }` — activated abilities, e.g. Blink.
- `{ type: "respond", uid, target? }` and `{ type: "pass" }` — during a Respond window.
- `{ type: "done" }` — end the current timed phase.
- `{ type: "surrender" }`

`legalActions()` lists every legal action in these formats (one entry per legal target/space). `done` is legal in Deploy, Movement and Attack phases for the priority player.

### 5. Screens and text

5.1 **Main menu** (`/`): heading (h1) **"Oreheart"**, buttons **"Play"**, **"How to Play"**, and a graphics toggle button labelled **"Graphics: High"** / **"Graphics: Low"** (click toggles; default High; saved in localStorage and restored on reload; Low cuts particles, shadows and pixel ratio).

5.2 **Play setup screen**: heading **"Choose Your Commander"**; one button per Commander with its full name: **"Grubnak the Goblin Boss"**, **"Professor Sproingle"**, **"Thane Borgo Anvilbottom"** (selected one has `aria-pressed="true"`), short faction description under each; difficulty buttons **"Easy"** and **"Normal"** (selected has `aria-pressed="true"`; default Normal); button **"Start Match"**; button **"Back"**. The computer picks a different Commander at random.

5.3 **Mulligan**: when a match starts from the UI, a dialog (`role="dialog"`, name **"Mulligan"**) shows the 5-card hand; tapping cards marks them; buttons **"Keep Hand"** and **"Redraw Selected"**.

5.4 **Match screen** (portrait, laid out like the mockup):
- Top: enemy card backs fanned in an arc (element with `aria-label="Enemy hand"` whose text/label includes the count), enemy deck pile (`aria-label="Enemy deck"`, text = cards left), Enemy Commander Health (`aria-label="Enemy Commander health"`, text contains the number).
- Top bar: current phase (`aria-label="Current phase"`, text contains **"Deploy"**, **"Movement"** or **"Attack"**, prefixed with **"Your turn"** or **"Enemy turn"**), phase timer (`aria-label="Phase timer"`, seconds remaining; shows a burning-rope bar in the last 10 seconds; when it reaches 0 the phase ends automatically, except in test mode).
- Middle: Three.js scene — painted ground with no grid lines, three glowing crystal formations recolored by controller (with faction symbol: Goblin skull, Gnome gear, Dwarf hammer), two Strongholds each with a simple Commander figure that emotes (cheer, groan, flinch). Creatures are simple placeholder 3D figures in faction color with faction symbol and visible Attack/Health. Valid spaces glow while dragging. If WebGL is unavailable, the match still works with a simple 2D board and no uncaught errors.
- Bottom: Your Commander Health (`aria-label="Your Commander health"`), crystal counters (`aria-label="Your green crystals"`, `"Your blue crystals"`, `"Your purple crystals"`, text = number), your deck pile (`aria-label="Your deck"`), the **"Done"** button, a **"Menu"** button.
- Your hand: real HTML buttons fanned in a rainbow arc along the bottom, each with accessible name = the card's name (e.g. "Fireball"); swipe or mouse wheel scrolls the fan; unlimited size.
- **Card view**: clicking/tapping a hand card (without dragging) opens a dialog named with the card's name, showing cost, Attack/Health (creatures), movement, role, rarity and ability text, with a **"Close"** button. Double-tapping a creature on the board opens the same view.
- Interactions: drag a card onto the battlefield to summon/cast (valid spaces glow); press-and-drag a creature to move; drag onto an enemy or the enemy Stronghold to attack. Tap your creature in Deploy phase → **"Upgrade"** option listing affordable upgrades.
- Animations: summon rise, walk, attack lunge, floating damage numbers, defeat poof, retreat scene at match end. Done button and all key elements remain usable during animations.

5.5 **Respond dialog**: when the human player has a Respond window, a dialog (`role="dialog"`, name **"Respond?"**) shows one button per usable Instant (name = card name) and a **"Let it happen"** button. Choosing an Instant casts it; if it needs a target and the triggering action targets one of your creatures, it automatically targets that creature; otherwise it targets the triggering spell/summon (counterspells) or asks you to tap a target. In normal mode the dialog closes by itself after `respondWindowSeconds` (= pass); in test mode it stays until answered.

5.6 **Match menu**: "Menu" opens a dialog with **"Resume"**, the graphics toggle, and **"Surrender"**; Surrender asks **"Surrender this match?"** with **"Yes, surrender"** and **"Cancel"**.

5.7 **End screen**: after the retreat scene, heading **"Victory!"** (you won) or **"Defeat"** (you lost or surrendered), a one-line flavor message, and button **"Back to Menu"** (returns to the main menu).

5.8 **How to Play**: heading **"How to Play"**, short sections (Goal, The Board, Crystals, Your Turn, Combat, Spells & Instants) with at least 3 simple pictures (`<img>` or inline SVG with `role="img"` and alt/aria-label), and a **"Back"** button to the main menu.

### 6. Computer opponent

6.1 Uses only `legalActions()` + `applyAction()`. **Easy**: mostly random legal moves with a light preference for summoning and attacking. **Normal**: contests crystal sites (moves/summons Gatherers and Tunnelers next to sites, aims for majority), keeps Gatherers out of reach of enemy attacks where possible, attacks the enemy Commander whenever a creature can, makes favourable trades, casts damage spells on good targets, and uses Instants/counterspells when the Respond window offers a good one. Each AI turn completes within 3 seconds of computation on a mid-range phone (instantly in test mode, plus animations otherwise). The AI handles its own mulligan.

---

## Look & feel

- Comic-book fantasy, dark painted battlefield as in the mockup: dirt/grass/rock ground, no grid lines; glossy neon gems: green `#3ee06a` (Goblins), blue `#3fa9ff` (Gnomes), purple `#b45cff` (Dwarves), neutral uncontrolled crystals pale gray-white. UI frames dark slate `#1b1a22` with gold trim `#e3b54a`, parchment text `#f4e9d0`.
- Fonts (Google Fonts): **"Cinzel Decorative"/"Cinzel"** for headings and card names, **"Nunito"** for body/numbers. Big, bold comic text bursts ("KA-BOOM!", "CRUNCH!") for hits and defeats.
- Portrait, phone-first (designed at 390×844), scales to desktop by centering a portrait play area; no horizontal scrolling at 390 px wide; touch targets ≥ 44 px. Works with mouse (drag, wheel) and touch (drag, swipe).
- Each faction has a symbol so color is never the only cue. Simple Low/High graphics toggle. Smooth on mid-range Android Chrome.

---

## Acceptance criteria

1. The main menu loads with heading "Oreheart", buttons "Play" and "How to Play", and no uncaught page errors; starting a match in test mode also produces no uncaught page errors.
2. Play → "Choose Your Commander" shows all three Commanders and Easy/Normal; choosing Professor Sproingle + Normal and "Start Match" opens the Mulligan dialog; "Keep Hand" reaches the match screen with the Done button, and the player's Commander is Sproingle.
3. How to Play shows its heading, at least one picture, and "Back" returns to the main menu.
4. The graphics toggle switches between "Graphics: High" and "Graphics: Low" and remembers the choice after reload.
5. `window.oreheart` exists only with `?test=1`, and the same seed gives the same starting hands.
6. A new match gives each player a 50-card starter deck (deck + hand) following the deck rules (≤10 Crystal cards, ≤3 copies of each Rare/Ultra Rare/Collector card); both start with 20 Health and an opening hand of 5.
7. Opening sequence: after mulligans the second player has 6 cards; the first player skips their turn-1 draw, gets turn-1 income (3 + 1 Stronghold + 2 underdog = 6), and on turn 2 the second player has 7 cards.
8. The match screen shows the phase name, phase timer, Done button, crystal counters and both Commander Healths with the specified labels; clicking Done advances Deploy → Movement → Attack → Enemy turn.
9. Site control and income: majority control, ties = nobody, shared columns count for both sites, Gatherer bonus and underdog bonus produce the exact crystal totals specified.
10. Summoning: home rows only, Tunnel creatures next to sites, crystals of the faction color are spent (Grubnak's discount applies), summoned creatures can't move or attack that turn (except Wolf Rider), and Unique cards are limited to one on the battlefield.
11. Movement: 1 space in 8 directions onto empty spaces; move-2 creatures can go 2; can't move onto occupied spaces.
12. Combat: type advantage, strike back, damage stays, Guard, Ranged, and defeated creatures go to the discard pile.
13. Spells: Fireball deals 3 damage and can be paid with any color; Crystal cards are limited to one per turn; upgrades apply once per creature at the specified cost.
14. Instants and counterspells: Fizzle cancels Fireball (crystals still spent), Hold It! returns a summoned creature to its owner's hand, and the Respond dialog appears for the human with "Let it happen" and usable Instant buttons.
15. Deck-out: drawing from an empty deck costs the Commander 1 Health each time.
16. Winning: reducing the enemy Commander to 0 ends the match with "Victory!"; "Back to Menu" returns to the menu. Surrendering shows "Defeat".
17. Computer opponent: Easy and Normal each complete their turn and hand it back; a Normal AI beats a player who never acts before turn 40.
18. Hand cards are buttons named after their cards, and tapping one opens a readable card view with a Close button.
19. Illegal actions are rejected without changing the state.
20. Phone layout (390×844): menu and match screen fit without horizontal scrolling, and the Done button and Commander Healths are visible.

---

## Out of scope / limitations

- Booster packs, collection, deck builder, gold, shards, shop, the full 120-card Core Set, polished art, poke reactions, sound and music, online play, accounts, Owner Console, cosmetics, daily quests, taunts, rankings, notifications, Hard AI, hint/undo buttons, time bank, sudden death (unresolved in GDD), colorblind color picker, haptics settings, PWA install/offline. (Brief excludes them, or they need a backend.)
- Unlockable Commanders (Queen Skreeka, Madame Sprocket, Old Grumblebeard) are not playable; only the 3 starter Commanders.
- No response chains (one Respond level only).
- Mixed-faction decks are not offered (each player uses their faction's starter deck), so "pick the site color" never comes up.

---

## Assumptions

- Player = bottom (rows 6–7), computer = top (rows 1–2); coordinates as in 3.1.
- "The second player draws 1 extra card" = one extra card right after the mulligan (opening hand 6), plus their normal turn draw.
- Income is applied on turn 1 too (so the first player starts turn 1 with 6 crystals).
- Site control is recomputed for all sites at the start of every turn; income goes to the active player.
- A Gatherer touching two controlled sites gives its +2 for each site.
- Deck-out damage is a flat 1 per failed draw (not escalating), configurable.
- Spells are paid with non-faction colors first; Fizzle checks the printed cost.
- Guard forces melee attackers adjacent to a Guard creature to target a Guard creature; it does not block Ranged attacks or Commander attacks by non-adjacent creatures.
- Ranged creatures may attack the enemy Commander from 2 spaces away in a clear straight/diagonal line.
- The "blocked home rows" rule triggers only when all 14 home spaces are occupied and at least one is an enemy.
- Starter decks may include Rares/Ultra Rares/Collectors within copy limits, so all 41 cards are playable in phase 1a.
- Graphics preference is stored in localStorage under any key the builder chooses.

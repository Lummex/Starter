# Oreheart — Phase 1a build brief

Read this brief first, then the full design document: `factory-design/design/oreheart-gdd-v2.md` (the source of truth for every rule, number and card). The screen layout reference is `factory-design/design/oreheart-mockup.jpg`.

## Revision 2 (owner playtest changes) — read this first

The owner played the first build. The design document has been updated with every change below; where this brief and the design doc disagree, the design doc wins.

1. **Menu buttons:** the main menu buttons are exactly **Play**, **Tutorial**, **Rules** and **Settings**. No other button or link on the menu may contain the word "Play" (the first build's "How to Play" made the automated checks unable to find the Play button).
2. **Bug: Commander damage.** A creature attacking the Commander removes exactly its Attack from the Commander's Health (a ⚔️5 creature deals 5, plus any Attack bonuses it has, such as Battle Cry). Type advantage doesn't apply to Commanders. The first build got this wrong.
3. **Landscape screen** (phone held sideways), laid out as described in "Match screen" below.
4. **Move OR attack:** in the Action phase each creature either moves or attacks, never both, unless it has Charge.
5. **Guided tutorial match** (see "Tutorial match" in the design doc).
6. **Starter decks:** 50 cards = 40 creatures, 6 spells (including 1 Fizzle) and 4 Crystal cards. The mix lives in the content data so the owner can change it.
7. **Slow, small start:** starting crystals 0; the first turn's Stronghold trickle gives 1 crystal, enough for one cost-1 troop. The underdog bonus only applies when the enemy controls at least one site (the first build gave everyone +2 on turn 1). Tunnel only works while the enemy controls more sites than you.
8. **Back-row summoning:** creatures are summoned on your back row only (row 7 for you, row 1 for the enemy); only if it's full, on the row in front of it.
9. **Simultaneous fights:** in melee both creatures hit each other at the same moment; the defender strikes back even if the hit defeats it. ⚔️1 ❤️2 vs ⚔️1 ❤️1: the 1/1 dies, the 1/2 survives. Two 1/1s defeat each other. Ranged attacks still get no strike back; Sneaky still prevents it.
10. **Creatures heal every turn:** at the start of its owner's turn (Draw phase), every creature heals back to full Health. Damage lasts until then, so creatures can team up within a turn. **Commander damage never resets.**
11. **Healing cards reworked:** new keyword **Shield X** (blocks the next X damage; lasts until the start of your next turn). Gnome Tinker, Brewmaster, Madame Sprocket and Heavy Armor are changed as in the design doc.
12. **Damaged creatures** show their current Health in red until they heal.
13. **Phase timers:** Deploy 30 seconds, Action 45 seconds (separate settings in `game-config.json`).
14. **Printed creature Health is at most 6** (Big Boss Troll, Steam Golem and Queen Brunhilda now have 6).

Unit tests must cover each of rules 2 and 7–11 with exact numbers.

**Goal of phase 1a:** one complete, playable match against a computer opponent, built on a clean, server-ready rules engine. The question this build answers is "is the battle fun?" Visuals are simple placeholders; art, collection and online come in later phases. Do a smaller scope *well* rather than everything shallowly.

## In scope

1. **Rules engine** (the most important part)
   - Pure TypeScript in its own folder (for example `src/engine/`), with no DOM, rendering, timers or browser APIs inside it, so it can later run unchanged on a server.
   - Game state is plain serializable data. The engine exposes: create a match, list the legal actions for the current player, apply an action, and read events (for animations).
   - All randomness (deck shuffles, coin flip) uses a seeded random number generator passed into the engine.
   - Implements every match rule in the design doc: the 7×7 grid, home rows, Strongholds, the 3 crystal sites and control (majority on the 8 surrounding spaces, ties = nobody, shared columns 3 and 5), site color switching, income (+1 Stronghold trickle, +1 per controlled site, +2 per Gatherer next to it), the underdog bonus, endless sites, Tunnel, card costs (creatures in faction color, spells in any color), Crystal cards (1 per turn, Crystal Eaters as specified, max 10 per deck), turn phases (Draw, Deploy, Action, End; in the Action phase each creature either moves OR attacks, never both, unless it has Charge), first player skips their first draw and the second player draws 1 extra card, mulligan, movement in 8 directions (move 2 for Ultra Rare/Collector/Veteran), melee/ranged/strike back/type advantage/Guard/Flying, simultaneous melee hits, full creature healing at the start of the owner's turn, Shield, Commander damage that stays, Unique cards, upgrades (Deploy phase, 1 per creature, costs as specified), Regular spells, Instants, counterspells and the Respond window, back-row summoning (front home row only when the back row is full), deck-out damage, Commander abilities, Commander at 0 Health retreats (match over), surrender.
2. **Content as data files** (JSON, not hard-coded): factions, crystal colors, Commanders, cards, abilities, and a `game-config.json` with every tunable number (phase timer seconds, rope warning seconds, respond window seconds, starting crystals, income values, underdog bonus, deck size, copy limits, Crystal card limit, upgrade costs, deck-out damage). The engine reads these; nothing balance-related is hard-coded.
3. **Cards:** all 41 starter cards from the design doc (creatures, spells, counterspells, Crystal cards, Crystal Eaters), the 3 starter Commanders (Grubnak the Goblin Boss, Professor Sproingle, Thane Borgo Anvilbottom). Add Commons as needed so each faction has a ready-made **50-card starter deck** that follows the deck rules: 40 creatures, 6 spells (including 1 Fizzle) and 4 Crystal cards. Keep every card and name original; never use names from other games (Warcraft, Warhammer, Magic: The Gathering, Hearthstone, Pokémon, etc.).
4. **Computer opponent:** Easy and Normal, built on the engine's legal-action list. Normal should contest crystal sites, protect its Gatherers, attack the Commander when it can, and use spells and counterspells sensibly. It must take its turn within a few seconds.
5. **Match screen** (LANDSCAPE: phone held sideways; also works with a mouse; show a "please rotate your phone" message if held upright), in the style of the mockup but laid out for a wide screen: battlefield in the center viewed at an angle like a tabletop, enemy Stronghold at the far side, yours at the near side, your hand along the bottom edge, enemy card backs along the top edge, crystal counters and deck pile on the left, phase/timer/Done/Commander Health on the right:
   - A 3D scene (Three.js is fine) with a simple painted-looking ground, no visible grid lines; three glowing crystal formations that change color with control; two Strongholds with a simple Commander figure (top half) showing basic emote reactions.
   - Creatures as simple, readable placeholder 3D figures (colored by faction with the faction symbol), each showing Attack and Health.
   - Your hand fanned in a rainbow arc along the bottom; swipe or mouse-wheel scrolls through it; unlimited hand size. Opponent's card backs fanned at the top. Visible deck piles that shrink.
   - Drag a card onto the battlefield to summon (valid spaces glow); press, lift and drag a creature to move; drag onto an enemy to attack; spaces it can reach glow.
   - Crystal counters per color, current phase, phase timer with a burning-rope warning, a Done button, the Respond window for Instants, Commander Health for both sides.
   - Readable full-size card view on tap. Simple attack, damage-number and defeat animations, and a retreat scene at the end.
6. **Screens:** main menu (buttons Play, Tutorial, Rules, Settings) → pick Commander and difficulty → match → win/lose screen → back to menu. The **Tutorial** is the guided tutorial match from the design doc, offered automatically the first time the game is opened. **Rules** is a short page with text and pictures.

## Out of scope for phase 1a (later phases)

Booster packs, collection, deck builder, gold and shards, the full 120-card Core Set, polished art, poke reactions, sound and music, online play, accounts, the Owner Console, cosmetics, daily quests, taunts, rankings, notifications.

## Testing requirements (so the factory's inspectors can check it)

- Add a **test mode** turned on by the URL `?test=1`: phase timers paused, the AI makes moves instantly, and the shuffle seed fixed (`?seed=123` sets it).
- In test mode, expose `window.oreheart` with: `getState()` (the engine state as plain data), `legalActions()`, `act(action)` and `newMatch(options)`, so tests can drive a match without dragging in 3D.
- Key on-screen elements must be real HTML with accessible names: the phase name, timer, Done button, crystal counters, Commander Health for both sides, the Respond dialog and the win/lose screen.
- Write unit tests for the rules engine covering site control, income (including the turn-1 opening: exactly 1 crystal), back-row summoning, simultaneous combat, start-of-turn healing, Shield, Commander damage equal to Attack, Instants/counterspells, Crystal card limits and win/retreat. Also add a test-mode hook `window.oreheart.startTutorial()`.

## Performance

Smooth on a mid-range Android phone in Chrome; looks best on high-end phones. Include a simple Low/High graphics toggle.

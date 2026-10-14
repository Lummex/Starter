# OreHeart — Build Spec

## Summary
OreHeart is an original dark-fantasy strategy card game for phones, played in the browser against a computer opponent. Players gather Ore from three Mines, build walls, and battle with creatures to destroy the enemy Stronghold or dominate all three Mines. It is an installable, offline-capable PWA (portrait, full screen) with a card collection, booster-pack shop and deck builder, all saved on the device.

## Technical frame
- Vite static app (vanilla TS or React — builder's choice). Output `dist/`. No backend.
- All progress saved in `localStorage` (single save object). A battle in progress is NOT saved; leaving/reloading mid-battle simply abandons it (no gold, no loss penalty).
- PWA:
  - `index.html` contains `<link rel="manifest" href="...">` pointing to a web manifest with: `name` "OreHeart", `short_name` "OreHeart", `display` "fullscreen", `orientation` "portrait", `start_url`, `background_color`, `theme_color`, and PNG icons of size `192x192` and `512x512` (original artwork, e.g. a gold heart-shaped ore gem).
  - A service worker served at **`/sw.js`** (e.g. vite-plugin-pwa default) precaches all built assets so the game works fully offline after first load. Fonts must be self-hosted or bundled (no network needed offline).
- The document `<title>` is "OreHeart".
- Navigation between screens happens without page reloads (in-app state or hash routing). Reloading on any screen may return to the Main Menu.

## Pages & features

### 1. Main Menu
1.1 An `h1` heading with the text **OreHeart** and a decorative gem/heart emblem.
1.2 Gold display with exact text format **`Gold: N`** (e.g. `Gold: 300`).
1.3 Buttons (in this order): **Play**, **Collection**, **Deck Builder**, **Shop**, **How to Play**, **Settings**.
1.4 Every other screen has a heading (h1 or h2) with the screen's name (`Play`, `Collection`, `Deck Builder`, `Shop`, `How to Play`, `Settings`) and a **Back** button that returns to the Main Menu.

### 2. Play screen (heading "Play")
2.1 A `<select>` labelled **Deck** listing all saved decks that have exactly 30 cards (all saved decks are always 30 cards; see 6). Defaults to the first deck ("Starter Deck" for new players).
2.2 Difficulty as three radio buttons labelled **Easy**, **Normal**, **Hard** (Normal selected by default). Each shows its gold reward: Easy 50, Normal 100, Hard 150 (e.g. text "Win: 50 Gold").
2.3 A **Start Battle** button opens the Battle screen.

### 3. Battle screen
#### 3.1 Layout (portrait, top to bottom)
- Enemy bar: enemy Stronghold health, enemy Ore, enemy hand size (card backs).
- Enemy slot row: for each Mine, 3 enemy slots.
- Mine row: **Left Mine**, **Center Mine**, **Right Mine** (visible text), with the passes between them labelled **Left–Center Pass** and **Center–Right Pass** (visible text, en dash). Each Pass shows two structure positions (one per player, enemy's on top).
- Player slot row: for each Mine, 3 player slots.
- Player bar: your Stronghold health, your Ore, next-turn income, turn indicator, **End Turn** button, and a **Menu** button.
- Your hand at the bottom: large cards (min 64px wide tap targets; tapping a card shows an enlarged readable preview with full text).

#### 3.2 Required test hooks (must exist exactly)
- `data-testid="player-health"` and `data-testid="enemy-health"`: text content is just the number (starts at `25`).
- `data-testid="player-ore"`: text is just the current Ore number.
- `data-testid="player-income"`: text in the form `+N` (projected Ore you'd gain if your turn started with the current board).
- `data-testid="turn-indicator"`: text is exactly `Your Turn` or `Enemy Turn`.
- `data-testid="turn-number"`: text `Turn N` (N counts full rounds, starts at 1).
- Your hand is a `<section aria-label="Your hand">`; each card in it is a `<button>` whose accessible name starts with `<Card Name>, <cost> Ore, <Type>` (e.g. "Ember Imp, 1 Ore, Creature"). The cost shown is the current cost to play it. Selecting a card may show an enlarged preview, but the preview must not cover or block the board slots.
- Each Mine is an element with `aria-label` `Left Mine` / `Center Mine` / `Right Mine` and attribute `data-control` equal to `player`, `enemy`, or `none`.
- Each of your Mine slots is a `<button>` with accessible name `Your <Mine> slot <1-3>` when empty (e.g. "Your Center Mine slot 1") and `Your <Mine> slot <n>: <Card Name>` when occupied. Enemy slots use `Enemy <Mine> slot <n>` similarly. Pass positions: `Your Left–Center Pass wall` / `Enemy Left–Center Pass wall` (with `: <Card Name>` when occupied).

#### 3.3 Turn structure
- The player always goes first. Each player starts with a shuffled 30-card deck and draws 4 cards. **Opening-hand guarantee:** the player's opening hand always contains at least one creature costing 1 or 2 Ore (if the deck has one; swap one in from the deck if needed). Same for the AI.
- Start of a turn, in order: (a) Mine control is recalculated for all three Mines; (b) Domination check; (c) start-of-turn effects (Watchtower, Repair, Poison ticks none — see abilities); (d) draw 1 card (hand max 10; overflow card is discarded; if the deck is empty, the Stronghold takes 2 damage instead); (e) collect Ore.
- Ore income = 2 + 1 per Mine you control + 1 per your Miner (Prospector) creature standing at a Mine you control. Unspent Ore carries over; Ore can never exceed 15. On Turn 1 the player has 2 Ore.
- During your turn you may, in any order: play cards (paying Ore) and use each creature's single action. Then tap **End Turn**.
- A creature cannot act on the turn it is played unless it has Charge.

#### 3.4 Mine control
- A Mine is controlled by the player with more total creature Attack at that Mine (structures don't count). Tie (including 0–0) = no one. Recalculated at the start of every turn (either player's).
- Visual: player-controlled Mine glows **blue**, enemy-controlled glows **red**, uncontrolled is neutral grey; animated transition when control changes. `data-control` reflects this.
- Below each Mine show the current attack totals (e.g. "3 vs 2").

#### 3.5 Playing cards
- Tap a hand card you can afford → valid destinations highlight; tap one to play. Tap the card again (or elsewhere) to cancel. Unaffordable cards are dimmed and cannot be selected.
- **Creature:** placed in an empty slot on your side of any Mine.
- **Structure (wall):** placed in an empty slot on your side of any Mine, OR in your empty position on a Pass. Structures have Health and no Attack.
- **Spell:** select a valid target (or none for global spells); resolves immediately, then goes to discard.
- If you have at least one Builder creature in play, your structures cost 1 less (minimum 1).

#### 3.6 Creature actions (one per creature per turn)
Tap one of your ready creatures, then tap a highlighted target:
- **Attack an enemy at the same Mine.** Targeting priority: if the enemy has any structures in its slots at that Mine, you must target a structure; otherwise if it has a Guardian there, you must target a Guardian; otherwise any enemy creature. A creature at a Mine may also attack an enemy structure on a Pass adjacent to its Mine.
- **Attack the enemy Stronghold** (button "Attack Stronghold" appears / Stronghold highlights) — only if the enemy has no creatures and no structures at that Mine.
- **Move** to an empty slot on your side of a neighboring Mine through a connecting Pass. A Pass is blocked for you if the enemy has a structure on it (any enemy structure) or if you have a non-Gate structure on it. Iron Gate blocks enemies only. Flying creatures ignore all Pass walls.
- **Shove** (creatures with Shove only, instead of attacking): pick an enemy creature at the same Mine (Guardian priority does not apply; walls do not stop Shove), then choose: move it to an empty enemy slot at a neighboring Mine (only through a Pass not blocked by your structure), or return it to its owner's hand.
- Combat: attacker deals its Attack to the target. If the target is a creature, it simultaneously deals its Attack back to the attacker. Structures and Strongholds don't strike back (except Spiked Wall). Damage persists. Units at 0 health are destroyed (crumble animation for structures).
- Floating damage numbers appear on every damage/heal event.

#### 3.7 Abilities (keywords; each card's text explains its own)
- **Shield:** prevents the first instance of damage, then is lost.
- **Poison:** any creature damaged by this creature is destroyed (no effect on structures/Strongholds).
- **Flying:** moves over Pass walls.
- **Charge:** can act the turn it is played.
- **Lifesteal:** damage this deals heals your Stronghold (max 25).
- **Shove:** see 3.6.
- **Fortify:** when played, gives +2 Health (permanent, raises max) to your other creatures and structures at the same Mine.
- **Siege:** deals double damage to structures.
- **Repair:** at the start of your turn, restore 2 Health to each of your damaged structures at this creature's Mine.
- **Prospector:** this creature gives +1 Ore income while at a Mine you control (all Miners have Prospector).
- **Guardian** (role-keyword): enemies at its Mine must attack Guardians before other creatures (after walls).
- Structure specials: **Spiked Wall** deals 2 damage to any creature that attacks it; **Watchtower** deals 1 damage to a random enemy creature at its Mine at the start of its owner's turn; **Iron Gate** (Pass) blocks enemies, lets your creatures through.

#### 3.8 Winning
- A Stronghold reaching 0 → its owner loses.
- **Domination:** if at the start of your turn you control all 3 Mines, and you also controlled all 3 at the start of your previous turn, you win. Show a banner "Domination 1/2" when the first condition is met.
- Result overlay with heading **Victory** or **Defeat**, gold earned text (e.g. "+100 Gold"; Defeat earns 0), and a **Back to Menu** button. Victory gold is added and saved immediately.
- **Menu** button in battle opens a dialog with **Resume** and **Concede**. Concede asks "Concede this game?" with **Concede** / **Cancel** buttons; confirming shows the **Defeat** overlay.

#### 3.9 Computer opponent
- The AI turn plays automatically after End Turn with visible animations and short pauses; total AI turn must finish within 10 seconds (with animations at normal speed) and the indicator returns to `Your Turn`.
- Heuristics (all difficulties use them; quality scales): send Miners to Mines it controls with no enemy creatures; build walls at Mines where enemy attack exceeds its own and on Passes the player is using to push; play/move Siege creatures to Mines with player walls; reinforce Mines it is losing or tied on; when its Stronghold ≤ 10 or an exposed Mine lets the player hit it, prioritize defence; attack the player Stronghold when possible.
- **Easy:** uses heuristics only 50% of the time (otherwise random legal plays), no lookahead, wastes Ore sometimes. **Normal:** always uses heuristics, greedy best move per action. **Hard:** scores candidate plays by simulated board value (one-ply lookahead including combat trades), starts with +1 Ore on its first turn, and focuses on Domination when it controls 2 Mines.
- AI must only make legal moves and never hang/crash.

### 4. Cards
4.1 Exactly **80** original cards: **20 per faction** (Fire, Frost, Forest, Shadow). Per faction: **10 Common, 5 Rare, 3 Epic, 2 Legendary** (totals: 40 Common, 20 Rare, 12 Epic, 8 Legendary).
4.2 Types: Creature, Spell, Structure. Across the set: at least 12 Structures (including Wooden Palisade, Stone Wall, Spiked Wall, Watchtower, Iron Gate) and at least 12 Spells. Roles for creatures: Miner, Builder, Warrior, Guardian, Raider, Siege, Champion (Legendary creatures are Champions or Dragons; "Dragon" counts as Champion role with Flying).
4.3 Faction themes: Fire — dragons, raiders, Siege, direct damage spells. Frost — walls, Guardians, Fortify, freeze/control spells. Forest — Miners, Builders, Repair, Prospector, growth/heal spells. Shadow — Poison, Shove, tricks.
4.4 Every card has: name, Ore cost (0–10), type, faction, rarity, role (creatures), Attack/Health (creatures) or Health (structures), ability text, and an italic flavor line. All names/text are original (no existing IP).
4.5 Card frame: faction-colored border/background (Fire crimson/orange, Frost icy blue, Forest green, Shadow purple), a faction symbol (flame, snowflake, leaf, crescent/eye — CSS/SVG/emoji), a rarity gem in the frame — Common grey/silver, Rare blue, Epic purple, Legendary gold/orange — and rarity-colored border accent. Art is generated with CSS/SVG/emoji, no copyrighted images.
4.6 Balance guideline: Commons cost 1–4, Legendaries 6–9; Attack+Health roughly 2×cost+1 for vanilla creatures, less for ones with abilities.

### 5. Collection (heading "Collection")
5.1 Shows all 80 cards in a grid; owned cards show "×N" owned count; unowned cards are greyed out with the label "Not owned".
5.2 Summary text: **`Unique cards: U / 80`** and **`Total cards: T`**.
5.3 Filters — five `<select>` elements labelled **Faction** (All, Fire, Frost, Forest, Shadow), **Rarity** (All, Common, Rare, Epic, Legendary), **Role** (All, Miner, Builder, Warrior, Guardian, Raider, Siege, Champion), **Type** (All, Creature, Spell, Structure), **Cost** (All, 0–1, 2, 3, 4, 5, 6+). Filters combine (AND). Plus a checkbox **Owned only** (unchecked by default).
5.4 Result count text: **`Showing X of 80 cards`**. Example: Faction=Fire → "Showing 20 of 80 cards"; Rarity=Legendary → "Showing 8 of 80 cards"; Fire + Legendary → "Showing 2 of 80 cards".
5.5 Tapping a card opens an enlarged view with all details and a close button **Close**.

### 6. Deck Builder (heading "Deck Builder")
6.1 Lists saved decks with heading text **`Decks (N/5)`**. Each deck shows name, card count, and **Edit** and **Delete** buttons (Delete asks for confirmation with **Delete** / **Cancel**; the last remaining deck cannot be deleted).
6.2 **New Deck** button (disabled when 5 decks exist) opens the editor.
6.3 Editor: text input labelled **Deck name** (default "New Deck"), count text **`Cards: N/30`**, the deck's card list (tap to remove one copy), and the owned card pool where each card has a button with accessible name **`Add <Card Name>`**. Pool supports the same Faction/Type/Cost filters as Collection (optional for tests).
6.4 Rules, checked in this order when adding: deck already has 30 → message **"Deck is full"**; Legendary already in deck → **"Only 1 copy of a Legendary"**; already 2 copies → **"Max 2 copies"**; no more owned copies → **"You don't own more copies"**. Messages appear as visible text (e.g. a toast, role="status").
6.5 **Auto-Fill** button fills remaining slots with random legal owned cards (respecting all rules).
6.6 **Save Deck** button is disabled unless the deck has exactly 30 cards; saving returns to the deck list. **Cancel** discards changes.
6.7 New players start with one deck named **Starter Deck**.

### 7. Shop (heading "Shop")
7.1 Shows `Gold: N` and a **Buy Booster Pack** button with price text **100 Gold**. Disabled (and a note "Not enough gold") if gold < 100.
7.2 Buying deducts 100 gold (saved immediately) and adds the 5 cards to the collection immediately (so closing the app mid-reveal never loses them).
7.3 Pack opening: 5 face-down cards appear. Tap a card (buttons named **`Reveal card 1`** … **`Reveal card 5`**) to flip it with a 3D flip animation; **Reveal All** flips all. Rarer cards get a glow/burst effect. When all are revealed a **Done** button appears returning to the shop.
7.4 Odds per card: Common 70%, Rare 20%, Epic 8%, Legendary 2%. Each pack guarantees at least one Rare-or-better (the 5th card re-rolls among Rare/Epic/Legendary if needed). Duplicates are allowed. Show odds text in the shop.

### 8. How to Play (heading "How to Play")
Sections with headings **Mines**, **Ore**, **Walls**, **Passes**, **Creatures**, **Winning**, each with plain-English explanation and an illustrative inline SVG diagram (`role="img"` with a descriptive `aria-label`), at least one picture for each of Mines, Ore, Walls and Passes. Mentions the Domination rule and the 25-health Stronghold.

### 9. Settings (heading "Settings")
9.1 Checkbox **Sound effects** (default on) — synthesized Web Audio sound effects (no audio files required); off = silent.
9.2 Checkbox **Animations** (default on) — off makes animations instant (respect `prefers-reduced-motion` as default off).
9.3 Settings persist across reloads.
9.4 **Reset Progress** button → confirmation dialog with text "Reset all progress? This cannot be undone." and buttons **Reset** / **Cancel**. Reset restores: 300 gold, starter collection, only the Starter Deck, default settings.

### 10. New player state
- **Gold: 300**.
- Starter collection: 2 copies each of 20 Common cards (5 per faction) = **Total cards: 40**, **Unique cards: 20 / 80**.
- Starter Deck: 30 cards = 2 copies of 15 of those commons (Fire, Frost, Forest — 5 each), including at least 8 creatures costing 1–2 Ore, at least 2 Miners, 1 Builder, and 2 Structures.

## Look & feel
- Dark fantasy: near-black/charcoal backgrounds (#14110f–#1f1a17) with stone textures via CSS gradients, gold accents (#d4a84b) for headings, borders and buttons; parchment-colored text (#f1e6cc).
- Fonts: a fantasy display font for headings (e.g. "Cinzel" self-hosted/bundled) and a readable sans-serif for body/card text (e.g. system UI stack).
- Player = blue (#3b82f6 glow), enemy = red (#ef4444 glow).
- Animations: attack lunge, floating damage numbers, wall build (rise up) and crumble, Mine glow transitions, Ore coins flying to the Ore counter at income, card flip in packs.
- Portrait-first, designed for ~360–430px wide phones; no horizontal scrolling at 390px width. On desktop the app is centered in a portrait column (max ~520px). All tap targets ≥ 44px. Full-screen PWA; respects safe-area insets.

## Acceptance criteria
1. The app loads at `/` with no uncaught page errors or console errors, title "OreHeart", and shows the OreHeart heading and `Gold: 300` for a new player.
2. Main Menu has buttons Play, Collection, Deck Builder, Shop, How to Play, Settings; each opens a screen with its heading, and Back returns to the Main Menu.
3. The app is an installable PWA: manifest linked with name OreHeart, display fullscreen, orientation portrait, 192 and 512 icons; `/sw.js` service worker exists.
4. Play screen has a Deck select containing "Starter Deck", Easy/Normal/Hard radios (Normal default), and a Start Battle button.
5. Starting a battle shows three Mines and two Passes, both Strongholds at 25, `Your Turn`, `Turn 1`, 2 Ore, `+2` income, all Mines uncontrolled, and a hand of at least 4 cards.
6. Playing an affordable creature from hand onto an empty slot puts it on the board, reduces Ore by its cost, and removes it from hand.
7. Tapping End Turn passes to the Enemy Turn; the AI acts and the game returns to `Your Turn` on `Turn 2` with Ore collected.
8. The battle Menu allows conceding; conceding shows Defeat, awards no gold, and Back to Menu returns to the Main Menu.
9. Collection shows Unique cards 20 / 80 and Total cards 40 for a new player and the filters produce correct counts (Fire = 20, Legendary = 8, Fire+Legendary = 2).
10. Deck Builder lists the Starter Deck (`Decks (1/5)`), enforces the copy limit with "Max 2 copies", disables Save until 30 cards, and saving a 30-card deck (Auto-Fill) adds it to the list; it persists after reload.
11. Shop: buying a booster pack costs 100 gold, reveals 5 cards via Reveal All, adds 5 cards to the collection, and the new gold persists after reload.
12. How to Play explains Mines, Ore, Walls and Passes with headed sections and pictures.
13. Settings: Sound effects toggle persists after reload; Reset Progress (after confirmation) restores 300 gold and the starter collection.
14. The game works at a phone viewport (390×844): menu and battle board are visible with no horizontal scrolling.

## Out of scope / limitations
- No online multiplayer, accounts, cloud saves or leaderboards (no backend allowed). Progress lives only on this phone/browser; clearing browser data erases it.
- No real-money purchases; gold is earned only by winning.
- No native Android app/Play Store listing — installation is via "Add to Home screen" (PWA). True full-screen depends on the browser honoring `display: fullscreen`.
- No commissioned illustrations or recorded music; card art is CSS/SVG/emoji symbols and sounds are synthesized.
- Portrait lock is a manifest hint; browsers outside installed mode may still rotate.
- Battles in progress are not saved/resumed.
- No card crafting/disenchanting, no daily quests.

## Assumptions
- Player always goes first; AI on Hard gets +1 Ore on its first turn to compensate.
- Creatures strike back when attacked; damage persists; Strongholds can't be healed above 25.
- Interleaving playing cards and acting is allowed (simpler on a phone than strict phases).
- Normal walls on a Pass block both sides' movement; Iron Gate blocks only enemies. Creatures at adjacent Mines can attack enemy Pass walls.
- Mine control is recalculated at the start of every turn (either player's); the income preview uses the current board.
- Starting gold 300, pack price 100, win rewards 50/100/150 for Easy/Normal/Hard, defeat 0.
- "Prospector" is the keyword that gives Miners their extra Ore.
- Card names, stats and texts beyond the named structures are authored by the builder within the constraints of section 4.

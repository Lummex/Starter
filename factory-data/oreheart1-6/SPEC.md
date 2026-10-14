# Oreheart — Build Spec (project Oreheart1, issue #6)

## Summary

Oreheart is a bright, cute, cartoony fantasy strategy card game played in portrait on an Android phone as an installable, offline Progressive Web App. You play cards to summon creatures onto a 7 × 7 chess-like board, gather Wood, Crystal and Iron from three resource sites, build palisades and ballistas, and fight a computer opponent (Easy / Normal / Hard). You win by knocking the enemy Stronghold down to 0 hearts or by being first to bank the target amount of every resource. Wins earn gold for booster packs, and you can build your own decks from your collection.

**Source of truth for rules and numbers:** the design document in this repository at `oreheart-upload/design/oreheart-game-design.md` (the owner calls it `design/oreheart-game-design.md`). The layout reference image is `oreheart-upload/design/oreheart-mockup.jpg` (also at `factory-design/design/oreheart-mockup.jpg`). Read the design document in full. Every rule, number and starter card in it MUST be implemented exactly. This spec repeats the key rules and adds the exact UI text, test hooks and decisions the document leaves open. If this spec and the document disagree on a rule or number, the document wins. If they disagree on UI text, test hooks or anything in "Assumptions", this spec wins. Ignore the document's "Open questions" section.

Tech: Vite static app (vanilla TS or React), no backend. All progress is stored in `localStorage`.

---

## Pages & features

The app is a single page with in-app screens (no server routes are needed). Every screen except the match screen has a **"Back"** button that returns to the Main menu.

### 1. Main menu
- Large title heading (h1) with the exact text **"Oreheart"**.
- Gold display: element with `data-testid="gold"` whose text contains the current gold number, for example "🪙 50".
- Buttons with these exact names, in this order: **"Play"**, **"Collection"**, **"Deck Builder"**, **"Shop"**, **"How to Play"**, **"Settings"**.
- If an unfinished match is saved, a **"Continue"** button also appears above "Play" and resumes it exactly where it was left.

### 2. Play screen (heading "Play")
- A `<select>` labelled **"Deck"**. It always lists the three starter decks **"Wildwood Starter"**, **"Shimmerfolk Starter"** and **"Ironclad Starter"**, then every saved custom deck, shown by its name.
- A radio group labelled **"Mode"** with options **"Quick Battle"** (selected by default), **"Standard"** and **"Epic War"**. Each option shows a short description (hearts / site size / Kingdom target / typical length).
- A radio group labelled **"Difficulty"** with options **"Easy"** (selected by default), **"Normal"** and **"Hard"**.
- Button **"Start Match"**.
- The enemy uses a random starter deck (chosen with the seeded random generator).

### 3. Match start: coin flip and mulligan
- A coin flip decides who goes first. Show a message with the text **"You go first!"** or **"Enemy goes first!"**. It must not need a tap to dismiss (it can show inside the mulligan dialog or as a toast). The second player gets +1 Crystal at setup.
- Each player shuffles their 30-card deck and draws 4 cards. Each player starts with 2 Wood, 2 Crystal and 2 Iron.
- Mulligan dialog (role `dialog`) with the heading **"Your Starting Hand"** that shows your 4 cards as buttons with `data-testid="mulligan-card"`. Tapping a card toggles it for redraw (`aria-pressed="true"` when selected). Buttons: **"Redraw Selected"** (shuffles the selected cards back and draws the same number again, then starts the game) and **"Keep Hand"** (starts the game unchanged). The mulligan happens only once. The AI makes its own mulligan silently.

### 4. Match screen (the layout follows the mockup, top to bottom)
- **Top bar:**
  - Resources panel in the top-left with three counters: `data-testid="res-wood"`, `data-testid="res-crystal"` and `data-testid="res-iron"`. Each shows its icon (🌲 / 💎 / ⛏️) and the current number as text.
  - Turn banner in the top-center with `data-testid="turn-banner"` and the text **"Your Turn"** or **"Enemy Turn"**.
  - A **"Menu"** button in the top-right.
- **Enemy Stronghold** at row 1, column 4. Its hearts show in `data-testid="hearts-enemy"` (number as text).
- **Board:** a 7 × 7 grid with `role="grid"` and aria-label "Board". Each tile is a clickable element with `data-testid="tile-R-C"`, where R is the row (1 = top) and C is the column (1 = left), for example `tile-6-1`. Tiles are about 50 px on a 390 px-wide phone.
  - Row 4 holds the sites: `tile-4-2` = 🌲 **Forest**, `tile-4-4` = 💎 **Crystal Mine**, `tile-4-6` = ⛏️ **Iron Mine**. Each site tile shows its name (or the name as its aria-label) and its remaining amount, in `data-testid="site-forest"`, `data-testid="site-crystal"` and `data-testid="site-iron"` (number as text). The design document's "Board" ASCII diagram is authoritative: which tiles gather from which site, and the shared columns 3 and 5. Shared tiles are visibly striped.
  - Strongholds: `tile-1-4` (enemy) and `tile-7-4` (yours). You can't stand on Stronghold or site tiles.
  - Home rows: rows 6–7 are yours and rows 1–2 are the enemy's, each visibly tinted.
- **Your Stronghold** at row 7, column 4, with hearts in `data-testid="hearts-you"`.
- **Pieces on the board:** every creature, palisade and ballista is an element with `data-testid="unit"` inside its tile. It has these attributes:
  - `data-owner="you"` or `"enemy"`
  - `data-card="<card id>"` (palisades: `wooden-palisade` / `iron-palisade` / `crystal-palisade` / `golden-palisade`; ballista: `ballista`)
  - `data-acted="true"` once it has used its action this turn (otherwise `"false"`)
  - an aria-label such as "Acorn Sprout (yours)" or "Tin Knight (enemy)"
  
  Each creature shows its ⚔️ and 🛡️ numbers, small arrow marks around it for each attack arrow (ranged arrows doubled), and its facing. Your creatures face up (toward the enemy) and enemy creatures face down.
- **Action bar** (beneath the board, like the mockup): buttons **"Move"**, **"Attack"**, **"Gather"**, **"Build"**, **"Turn"** and **"Upgrade"**. A button is enabled only when the selected piece can do that action now. On the right is a large **"End Turn"** button. Smaller **"Undo"** and **"Hint"** buttons sit nearby.
- **Hand** along the bottom: each card in your hand is a `<button>` with `data-testid="hand-card"`, `data-card="<card id>"` and an accessible name that starts with the card's name. A card you can't afford right now has `aria-disabled="true"` and is dimmed. The hand scrolls sideways if it doesn't fit. A deck counter `data-testid="deck-count"` shows the number of cards left in your deck.
- **Card face design** (hand, collection, shop, deck builder):
  - Cost in the top-left with resource icons (e.g. "⛏️2" or "🌲4 ⛏️1")
  - Name
  - A big cute symbol or emoji/SVG character in the center, with attack arrows drawn around it
  - ⚔️ Attack in the bottom-left and 🛡️ Defense in the bottom-right
  - Optional one-line ability
  - Rarity gem: Common gray, Rare blue, Epic purple, Legendary gold
  - Frame in the faction color
- **Interaction:**
  - **Playing cards:** tapping a hand card selects it (`aria-pressed="true"`). For a creature, every legal empty tile in your home rows (6–7) gets `data-highlight="summon"`, and tapping one summons the creature there and pays its cost. For a spell, legal targets get `data-highlight="target"`, and tapping one casts the spell. Tapping the card again cancels. Illegal taps do nothing (or show a short message) and never spend resources.
  - **Selecting a piece:** tapping your piece selects it. Tiles it can move to get `data-highlight="move"` (shown in blue) and pieces it can attack get `data-highlight="attack"` (shown in red). Tapping a blue tile moves it and tapping a red tile attacks.
  - **Action buttons:**
    - "Move" and "Attack" limit the highlights to that one action.
    - "Gather" collects from the site the piece is on. On a shared tile it first asks with buttons such as **"Gather Wood"** and **"Gather Crystal"**.
    - "Build" offers **"Wooden Palisade (2 Wood)"** and **"Ballista (3 Wood)"**, then highlights the legal tiles with `data-highlight="build"`. When a palisade is selected, "Upgrade" offers the next tier.
    - "Turn" offers **"Turn Left"** and **"Turn Right"**.
    - "Upgrade" on a creature opens the Forge with **"Iron Armor"**, **"Iron Weapon"**, **"Crystal Charm"** and **"Wooden Boots"** (each shows its cost and is disabled if unaffordable or if the creature already holds 2 upgrades). Crystal Charm then asks for a direction.
  - **Undo:** reverts your last action this turn (summon, spell, move, attack, gather, build, turn or upgrade), including resources and cards. You can press it repeatedly back to the start of your turn. It is disabled during the enemy turn and when nothing can be undone.
  - **Hint:** shows a short suggestion such as "Move Acorn Sprout to the Forest to gather Wood." in an element with `role="status"`.
- **Menu** (dialog) buttons: **"Resume"**, **"Surrender"** (asks "Are you sure?" with **"Yes, surrender"** / **"Cancel"**) and **"Quit to Main Menu"** (keeps the match saved for "Continue").
- **Enemy turn:** the AI plays visibly, with short animations. Its whole turn takes no more than about 5 seconds in total. Then the banner goes back to "Your Turn".
- **Animations:** attacks (a lunge or shake), knock-outs (a poof), walls being built and crumbling, gathering (a floating "+1 🌲"). Keep them short (≤ 600 ms each) and don't block input longer than that. Respect `prefers-reduced-motion`.
- **The match is auto-saved** to localStorage after every action, so "Continue" works after a reload or after the app is closed.

### 5. Game rules (summary; the design document has full detail)
- **Each turn:** draw 1 card (skipped if the hand already has 8 cards; the card stays in the deck), collect +1 Wood, +1 Crystal, +1 Iron, then play cards and act. Each creature or ballista gets one action: Move, Attack, Gather, Build or Turn. New creatures can't act on the turn they're summoned unless they have Charge. Upgrading doesn't use an action. Then End Turn.
- **Move:** 1 tile orthogonally onto an empty tile. Swift: 2 tiles. Wooden Boots: +1 tile.
  - Leap: jumps over one creature or palisade.
  - Swap: trades places with an adjacent creature.
  - Teleport: moves to any empty gathering tile.
  - Flying: moves over palisades, except Crystal and Golden ones.
- **Gather:** 1 resource from the site, 2 for Workers. The amount can't exceed what's left in the site, and an empty site gives nothing.
- **Combat:**
  - The defender is knocked out if the attacker's Attack (with all bonuses) is ≥ the defender's Defense.
  - If the defender has an arrow pointing back at the attacker, it strikes back at the same time (its Attack against the attacker's Defense, with type advantage applied too). Both can be knocked out.
  - Flanking from a side the defender has no arrow on gets no strike-back.
  - Type advantage: +1 when Iron attacks Wood, Wood attacks Crystal, or Crystal attacks Iron.
  - Gang up: +1 for each other friendly creature or ballista whose arrow also points at the target.
  - Ranged (double) arrows hit the first enemy up to 3 tiles away. They are blocked by palisades.
  - An attack on a Stronghold always lands and removes hearts equal to the attacker's Attack.
  - Knocked-out creatures go to the discard pile and lose their upgrades.
- **Structures:**
  - Build on an empty tile next to one of your creatures, using that creature's action. Builders pay 1 Wood less.
  - Palisade tiers and costs, the Golden Palisade rule ("only ballistas can damage it") and the Ballista (3 Wood, ⚔️3, 🛡️2, structure-only double arrow, can Turn, can't Move) are exactly as in the document.
  - Old Oakheart, Sir Rivetbeard and Dwarf Smith work as written.
- **Winning:**
  - Conquest: the enemy Stronghold reaches 0 hearts.
  - Kingdom: checked at the start of a player's turn, after income, when they hold at least the target of each resource.
  - No stalemates: when all three sites are empty, the player with more hearts wins, then the player with more total resources. If both are still tied, it's a draw that pays loss gold.
  - Surrender.
  - When a deck runs out, play continues with no draws.

| Mode | Stronghold hearts | Each site holds | Kingdom target |
| --- | --- | --- | --- |
| Quick Battle | 5 | 15 | 10 of each |
| Standard | 10 | 30 | 15 of each |
| Epic War | 15 | 50 | 20 of each |

### 6. Computer opponent
- **All difficulties:** the AI plays legal moves only, and plays at least one card on its turn whenever it can afford one.
- **Easy:** mostly obvious moves (summon, walk toward sites or the Stronghold, attack when it can win), and about 25% of the time picks a random legal action instead.
- **Normal:** scores moves. It sends workers to safe gathering tiles, contests sites where it holds fewer tiles, avoids attacks that lose its creature for nothing, and attacks the Stronghold when it can.
- **Hard:** like Normal, but it also values flanking, ganging up, shared tiles, palisades to block sites, ballistas against your palisades, and keeping defenders near its Stronghold. It looks one move of yours ahead.

### 7. Result screen
- Heading **"Victory!"**, **"Defeat"** or **"Draw"**, a line saying why (e.g. "Kingdom victory", "Stronghold destroyed", "You surrendered", "All sites empty"), and the gold earned shown as text in the form **"+N gold"**.
- Gold per win: Easy 10, Normal 20, Hard 35. A loss or draw earns half, rounded down (5 / 10 / 17).
- Button **"Main Menu"**. The finished match is cleared, so "Continue" disappears.

### 8. Collection screen (heading "Collection")
- Shows every one of the 80 cards in the game as an element with `data-testid="collection-card"`, `data-card="<id>"` and `data-faction="wildwood|shimmerfolk|ironclad|spell"`. Each shows the card face and the owned count as "×N". Unowned cards are grayed out with "×0".
- Filters: `<select>` elements labelled **"Faction"** (All, Wildwood, Shimmerfolk, Ironclad, Spells), **"Rarity"** (All, Common, Rare, Epic, Legendary), **"Type"** (All, Creature, Spell) and **"Cost"** (All, 1, 2, 3, 4, 5, where cost = total resources). Filtering hides non-matching cards; hidden cards are removed from the DOM or not visible.
- The total number of owned cards is shown in `data-testid="owned-total"` (number as text). The starting collection is the three starter decks, so 90 cards.

### 9. Deck Builder screen (heading "Deck Builder")
- Lists your saved custom decks (up to 5). Each has its name and the buttons **"Edit"** and **"Delete"**.
- **"New Deck"** button. When 5 decks are saved it is disabled, with the text "You can save up to 5 decks."
- **Editor:**
  - Text input labelled **"Deck name"**.
  - The same four filters as the Collection.
  - A card pool of your owned cards, each with an **"Add <Card name>"** button (the exact accessible name, e.g. "Add Tin Knight"). The button is disabled when the deck already has 30 cards, already has 2 copies (1 for a Legendary), or already uses all your owned copies.
  - The deck list, each entry with a **"Remove <Card name>"** button.
  - A size counter `data-testid="deck-size"` with the text "N/30".
  - **"Save Deck"** is enabled only when the deck has exactly 30 cards, follows the copy rules and has a non-empty name.
  - **"Cancel"** button.
- Saved decks persist and appear in the Play screen's "Deck" select.

### 10. Shop screen (heading "Shop")
- Shows current gold in `data-testid="gold"`.
- Button **"Buy Booster Pack (50 gold)"**, disabled when gold < 50.
- Buying takes 50 gold and gives 5 random cards with these odds per card: Common 70%, Rare 22%, Epic 7%, Legendary 1%. At least one card is Rare or better: if all 5 rolled Common, the last one is rerolled as Rare.
- The cards appear face-down in a reveal area. Each flips with a card-flip animation when tapped, and there is also a **"Reveal All"** button. Revealed cards have `data-testid="pack-card"`.
- Cards are added to the collection and saved immediately on purchase.

### 11. How to Play screen (heading "How to Play")
- An illustrated step-by-step tutorial with at least 7 steps, each with a heading:
  1. "The Board"
  2. "Resources"
  3. "Playing Cards"
  4. "Actions"
  5. "Combat"
  6. "Building"
  7. "Winning"
  
  Each step has small cartoon illustrations made with HTML/SVG/emoji.
- **"Next"** and **"Previous"** buttons, plus a step indicator "Step N of M".
- On the last step, a **"Start Tutorial Match"** button starts a Quick Battle on Easy with the Wildwood Starter, with tip bubbles on the first turn.

### 12. Settings screen (heading "Settings")
- Checkboxes labelled **"Sound"** and **"Music"**, both on by default and saved to localStorage. Sound effects and a soft looping tune are generated with the Web Audio API (no audio files needed). Audio starts only after a user tap.
- **"Reset Progress"** button. It asks for confirmation with **"Yes, reset"** / **"Cancel"**, then restores the starting state: gold 50, starter collection, no custom decks, no saved match. Settings stay as they are.

### 13. Card set (80 cards)
- **Exactly 80 cards:**
  - 24 Wildwood creatures
  - 24 Shimmerfolk creatures
  - 24 Ironclad creatures
  - 8 Spells
- **Starter cards:** all 27 cards from the document's starter list are included with exactly the listed name, rarity, cost, ⚔️, 🛡️, arrows and ability.
- **New cards:** the 53 new cards are original and cute, with themes from the document's faction table:
  - **Wildwood:** forest critters, treants, elves, owls
  - **Shimmerfolk:** wizards, wisps, gem foxes, little dragons
  - **Ironclad:** knights, orcs, dwarves, goblins, steam robots
  - **Spells:** 3 more Crystal-cost spells with simple effects
- **Number rules for every creature:**
  - Total cost 1–5, mostly in its own faction's resource.
  - ⚔️ and 🛡️ are 1–4 for Common, Rare and Epic cards, and 1–6 for Legendary cards.
  - At most one short ability line. Abilities come from Swift, Leap, Swap, Teleport, Flying, Charge, Worker and Builder, or another simple one-line effect.
- **Rarity mix per faction (24 creatures):** about 12 Common, 6 Rare, 4 Epic and 2 Legendary.
- **Spells:** Common, Rare or Epic. Each costs at least 1 Crystal.
- **Card ids:** lowercase kebab-case of the name with punctuation removed, e.g. `tin-knight`, `prismatica-rainbow-dragon`, `old-oakheart`.

### 14. Starter decks
- Three valid 30-card decks: "Wildwood Starter", "Shimmerfolk Starter" and "Ironclad Starter".
- Each contains 2 copies of every Common from the document's starter list for its faction, and 1 copy of each Rare and Epic from that list. It is filled up with other Common and Rare cards of its own faction (max 2 copies each) and has no Legendaries.
- The Shimmerfolk Starter also includes 2 Zap, 1 Frost Snap and 1 Blink.
- At least 16 of the 30 cards in each starter deck have a total cost of 2 or less.

### 15. Rules API for automated testing (required)
On load the app sets `window.oreheart` to an object with:
- `cards`: an array of all 80 cards. Each is `{ id, name, faction, type, rarity, cost, attack, defense, arrows, ability }`:
  - `faction`: `"wildwood" | "shimmerfolk" | "ironclad" | "spell"`
  - `type`: `"creature" | "spell"`
  - `rarity`: `"common" | "rare" | "epic" | "legendary"`
  - `cost`: `{ wood, crystal, iron }` (numbers, 0 when unused)
  - `attack`, `defense`: numbers (spells use `null`)
  - `arrows`: an array of `"F","B","L","R","FL","FR","BL","BR"`, with ranged written doubled, e.g. `"FF"` (spells use `[]`)
  - `ability`: a string or `""`
- `starterDecks`: `{ wildwood: string[], shimmerfolk: string[], ironclad: string[] }`. Each is 30 card ids, with repeated ids for copies.
- `validateDeck(ids: string[])` → `{ valid: boolean, errors: string[] }`. It checks exactly 30 cards, at most 2 copies of a card, at most 1 of each Legendary, and that every id exists. It does not check ownership.
- `resolveAttack({ attacker, defender, defenderStrikesBack, gangUp })`. `attacker` and `defender` are each `{ attack, defense, faction }`, `gangUp` is a number ≥ 0 and `defenderStrikesBack` is a boolean. It returns `{ attackValue, defenderKnockedOut, attackerKnockedOut }`, applying type advantage (for both sides) and gang-up (attacker only) as in the Combat rules.
- `modes`: `{ quick: { hearts: 5, siteAmount: 15, kingdomTarget: 10 }, standard: {…}, epic: {…} }`.
- `goldReward(difficulty: "easy"|"normal"|"hard", won: boolean)` → a number.

The same functions must be the ones the game itself uses.

### 16. Debug / test URL parameters (required)
The app reads these query parameters once at page load. They apply to every match started in that page session; without them, normal random play applies.
- `seed=<integer>`: seeds every random choice (shuffles, coin flip, enemy deck, AI randomness, booster packs) so runs repeat exactly.
- `first=you|enemy`: forces who goes first. The +1 Crystal for the second player still applies.
- `hand=<id>,<id>,…`: sets your opening hand to these cards, taken out of your deck when present, otherwise added. The deck is still shuffled for later draws.
- `res=<wood>,<crystal>,<iron>`: replaces BOTH players' starting resources (before income and before the second-player Crystal bonus).
- `ai=off`: the enemy does nothing on its turns except end them.

### 17. Installable offline PWA
- A `manifest.webmanifest` (linked with `<link rel="manifest">`) with:
  - `name` "Oreheart" and `short_name` "Oreheart"
  - `display` "fullscreen"
  - `orientation` "portrait"
  - `start_url` "." or "/"
  - a bright `theme_color` and `background_color`
  - PNG icons of 192×192 and 512×512 (one of them also `"purpose": "maskable"`), which must exist in `dist/`
- A service worker (e.g. vite-plugin-pwa / Workbox) registered on load. It precaches all built assets, so the app loads and is fully playable offline after the first visit.
- Fonts are bundled locally (e.g. `@fontsource`), with no runtime CDN requests, so the app looks right offline.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, and the app title "Oreheart".

---

## Look & feel

- **Mood:** bright, cute, cartoony and kid-friendly. It is the mockup's layout but NOT its dark gritty look. Chunky rounded shapes, thick dark outlines (3 px, #3b2a4a-ish), soft drop shadows, big friendly buttons with a slight 3D "pressable" bottom edge, and big expressive eyes on creature symbols where possible.
- **Background:** a sunny sky-to-meadow gradient (light sky blue #8fd3ff to grass green #9be27a). Board tiles are light grass with a checker tint, and the home rows are lightly tinted (yours blue-ish, the enemy's red-ish).
- **Faction colors:**
  - Wildwood: green #4caf50 / #a5d66f
  - Shimmerfolk: purple-blue #7a5cff / #b9a6ff
  - Ironclad: steel #8a9bb0 with red #e0473c
  - Spells: crystal pink-violet
- **Rarity gems:** gray #9e9e9e, blue #3d8bfd, purple #a050e0, gold #f6c343.
- **Highlights:** move = blue glow, attack = red glow, summon/build = yellow/green glow.
- **Fonts:** "Fredoka" for headings, buttons and numbers, and "Nunito" for body text, both bundled locally.
- **Layout:**
  - Portrait-first: on a 390 × 844 phone the whole match screen (top bar, board, action bar, hand) fits without page scrolling, the board is about 7 × 50 px wide, and there is no horizontal page scroll.
  - On desktop the game is centered in a phone-shaped column (max-width about 480 px) on a decorative background.
  - Touch targets are at least 44 px. Full-screen PWA with safe-area padding.
- **Card art (v1):** designed frames, faction colors, cute emoji or simple SVG characters and faction symbols. No painted art and nothing copied from other games.

---

## Acceptance criteria

1. The app loads at `/` with no uncaught page errors and shows the Main menu: heading "Oreheart", a gold display showing 50 for a new player, and the buttons Play, Collection, Deck Builder, Shop, How to Play and Settings.
2. Each menu button opens its screen (headings "Play", "Collection", "Deck Builder", "Shop", "How to Play", "Settings"), and "Back" returns to the Main menu.
3. The app is an installable PWA: the manifest is linked and has name "Oreheart", display "fullscreen", orientation "portrait" and 192 and 512 icons. A service worker registers, and after one visit the app's Main menu loads while offline.
4. `window.oreheart.cards` holds exactly 80 cards (24 per faction plus 8 spells) with unique ids, and every number follows the card rules (cost 1–5, ⚔️/🛡️ 1–4 for non-Legendary creatures, up to 6 for Legendary).
5. All 27 starter cards exist with the exact stats from the design document (e.g. Tin Knight ⛏️2, 3/2, F L R; Old Oakheart 🌲4 + ⛏️1, 4/5).
6. Deck rules: the three starter decks are valid 30-card decks. A deck of 29 or 31 cards, 3 copies of a card, or 2 copies of a Legendary is rejected by `validateDeck`.
7. Combat rules: `resolveAttack` applies "Attack ≥ Defense knocks out", type advantage, gang-up and strike-back (the document's Tin Knight vs Mossy Turtle example knocks out the turtle with attack 4).
8. The mode numbers and gold rewards match the document (Quick 5/15/10, Standard 10/30/15, Epic 15/50/20; win 10/20/35, loss half rounded down).
9. The Play screen offers the three starter decks, the three modes and the three difficulties. "Start Match" shows the mulligan dialog "Your Starting Hand" with 4 cards, and "Keep Hand" starts the game.
10. "Redraw Selected" in the mulligan replaces the selected cards (the hand still has 4 cards) and starts the game. The mulligan does not appear again.
11. The board has 49 tiles. Forest, Crystal Mine and Iron Mine are at row 4, columns 2/4/6, and the Strongholds are at row 1 and row 7, column 4. In a Quick Battle each site shows 15 and each Stronghold shows 5 hearts.
12. In a Standard match the sites show 30 and the Strongholds 10 hearts.
13. Going first, your first turn starts with 3 Wood, 3 Crystal and 3 Iron (2 + income), "Your Turn" in the banner, and 5 cards in hand (4 + draw). The deck counter shows 25.
14. Going second, after the enemy's turn you have 3 Wood, 4 Crystal and 3 Iron.
15. Selecting an affordable creature card highlights the tiles in your home rows. Tapping one summons the creature there (shown as your piece) and pays its cost. Tiles outside rows 6–7 are not summon targets.
16. Cards you can't afford are shown as disabled (`aria-disabled="true"`) and can't be played.
17. Undo after summoning returns the card to your hand and refunds the cost.
18. A newly summoned creature can't act that turn. On your next turn it can move one tile forward onto a highlighted tile, and on a later turn it can Gather on a Forest tile, which adds Wood and lowers the Forest's remaining amount by 1.
19. "End Turn" passes to the enemy ("Enemy Turn"), and play returns to "Your Turn" with +1 card and +1 of each resource. With the normal AI the enemy summons creatures onto its home rows.
20. The hand never goes above 8 cards.
21. Kingdom victory: reaching the target amount of every resource at the start of your turn shows "Victory!", "+10 gold" on Easy, and the gold total goes up by 10.
22. Surrender from the Menu (with confirmation) shows "Defeat" and "+5 gold" on Easy.
23. An unfinished match survives a reload: "Continue" appears on the Main menu and restores the board.
24. Collection shows all 80 cards with an owned total of 90 for a new player. The Faction and Type filters show only matching cards.
25. Shop: buying a booster pack costs 50 gold, reveals 5 cards and adds 5 cards to the collection. The new gold and collection survive a reload, and the buy button is disabled when gold < 50.
26. Deck Builder: you can't add more than 2 copies of a card. A 30-card deck can be named and saved, survives a reload, and appears in the Play screen's Deck list.
27. Settings: the Sound and Music toggles persist after reload. "Reset Progress" (confirmed) restores gold to 50 and the owned total to 90.
28. How to Play shows a step-by-step tutorial with Next/Previous, including a "Combat" step.
29. On a 390 × 844 phone the Main menu and the match screen fit the width with no horizontal scroll, and the board, End Turn button and hand are all visible without scrolling.
30. During a match, tapping your own piece that can still act highlights its move tiles, and "Hint" shows a suggestion in a status message.

---

## Out of scope / limitations

- **Online play against people:** needs a server. Version 1 is single-player against the computer only.
- **Google Play store release:** v1 is an installable PWA only.
- **Painted creature art:** needs an image-generator upgrade. Cards use designed frames, emoji/SVG symbols and faction colors.
- **Story campaign, daily rewards and quests:** listed as open questions, which the owner said to ignore for v1.
- **Real recorded music or sound files:** simple synthesized Web Audio sounds and a soft tune are used instead.
- **Accounts and cloud saves:** progress lives only on this phone or browser, and clearing browser data erases it.
- **Real-money purchases:** gold is earned by playing only.

## Assumptions

- **Design document location:** the owner's path `design/…` actually lives at `oreheart-upload/design/` in this repository.
- **New player state:** a new player starts with **50 gold** (enough for one booster pack) and owns the three starter decks (90 cards). The document doesn't say what starting gold is.
- **Turn 1:** the first player does draw and collect income on turn 1, as the document says "each turn", so their first turn starts with 3/3/3 and 5 cards.
- **Kingdom check timing:** the Kingdom check happens after income at the start of a turn.
- **Full hand:** with 8 cards in hand you skip the draw, and the card stays in the deck.
- **Strike-back and bonuses:** strike-back uses type advantage. Gang-up applies only to the attacker.
- **Draw result:** a draw under the "no stalemates" rule only happens if hearts and total resources are both tied, and it pays loss gold.
- **Starter decks and deck limits:** the starter decks are built in, can't be edited and don't count toward the 5 custom deck slots.
- **Enemy deck:** the enemy uses a random starter deck.
- **Booster guarantee:** a booster's "Rare or better" guarantee is applied by rerolling the 5th card as Rare when all 5 rolled Common.
- **Card set size:** "about 80 cards" is fixed at exactly 80 (24 + 24 + 24 + 8).
- **Gold rounding:** a loss pays half the win gold, rounded down (Hard: 17).
- **Test support:** a test/debug API (`window.oreheart`) and URL parameters (`seed`, `first`, `hand`, `res`, `ai`) are required so that automated checks are reliable. They are harmless to players.
- **Tutorial match:** "illustrated tutorial match" is a picture-based step-by-step guide plus a tutorial Quick Battle with tips on the first turn.

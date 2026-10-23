# Oreheart — Phase 1B build brief (art and sound)

Read this brief first, then the full design document: `factory-design/design/oreheart-gdd-v2.md` (the source of truth for every rule, number and card). Phase 1A (`oreheart-phase-1a-brief.md`, all revisions) is finished, approved and live; everything in it stays exactly as it works now.

**Goal of Phase 1B:** replace every placeholder with finished, original art and add sound effects, **without changing any game rule, number, layout position or test hook**. When it ships, Oreheart should look like a real, polished game on a phone held sideways. All 129 existing automated checks must keep passing.

## Round 12c — make every card do what its card text says (owner Art Studio update, Oct 23) — read this first

Round 12b-1 is done (Goblin 3D models; the run hit the time limit before reporting, but all 5 models are on the branch). Keep everything from 8a–12b-1. The owner's card changes and pictures are already committed on `factory/issue-8` (`src/content/cards.json`, `src/ui/app.ts` OWNER_ART, `public/art/owner/{goblin,gnome,dwarf,neutral}/`). **The `text` of each card in `cards.json` is now the source of truth**: names, numbers, rarities, roles and text there are the owner's and must not be changed. This round builds the game logic so each card really does what its text says, plus a few display fixes. NO 3D models and NO Meshy this round (the owner now makes models himself in the Model Editor).

Time rule (the last two runs hit the 3-hour limit): work in the order below, **commit + push after each numbered step**, keep tests short (one focused test per new ability, plus the existing suite). If time runs short, stop after the last finished step and report exactly which cards are done and which are not.

1. **Display fixes (quick).**
   - `artPos` framing: cards in `cards.json` / `commanders.json` may carry `artPos: {s, x, y}` (s = scale, x/y = offset in % of the art window). Every card face (hand, close-up, deck builder, menus, played-card pop-ups) shows the picture scaled by s and shifted by x%, y% inside the art window, clipped. Default {s:1, x:0, y:0}.
   - Crystal cards show their picture full size like spells (no small window; the frame overlays sit on top of the full picture).
   - Every card listed in `OWNER_ART` uses that picture everywhere (already wired through `pictureOf`; check the deck builder and close-ups). Borgo's portrait = `/art/owner/dwarf/borgo-portrait.webp` (already in `commanderPortrait`).
   - Archived by the owner: Commander **Betty Fizzlebottom** (`sprocket`). Remove her from Choose Your Commander, AI picks, starter decks and tests; keep her data in `data/archived-cards.json` so she can come back.
2. **Numbers and ranges.** Per-card range in the engine (Ranged cards use the range in their text): Skullflinger 6, Stormcaller Savant 5, Thunderwing Gyronaut 2 (Flying), Marksmen Gunner 7, Grudge Hurler 5 (straight lines/diagonals only), Hexslinger Apprentice any distance (straight/diagonal, blocked by allies), all others 7. Starfall Cataclysm 4 damage in a 3×3 area. Venom Shiv 1 damage for 7 turns, no healing.
3. **Goblins:** SewerSlide Bomber (pay 1: runs straight/diagonal until it hits something, then Ka-boom), Bare Knuckle Lunatic (when defeated, knocks all adjacent units back 1), Bowler Brawler (Strike 2 crystals: bowling ball in a straight line, knocks every creature in its path back 1–2 at random), Backstabbing Thief (steals 1 crystal per enemy it defeats), Junk Shaman (pay 2: pick up any character within 5 and put it within 5 of the Shaman), Goblin Chef (Smack: target knocked back 2; not Ranged), Goblin Rocket Rider (Rocket Ride: to any space, 3×3 explosion = its Attack, then one attack; it keeps its Gatherer role until the owner decides), Pickpocket! (counter a creature being summoned: back to hand), Rat-Tunnel Ambush.
4. **Gnomes:** Gearward Sentinel (Guard + teleport-assist after an enemy attacks), Glyphshield Warden (Shield 1 each turn; pay 2 once per turn: an ally gets Ward for one round), Voldawright (Shockwave: pay 1, knock back adjacent enemies + 1 damage each), Mirrorveil Illusionist (Blink costs 1 + illusion decoy), Brawler Adept (can't cast spells), Gnome Plow (Plow, 2 crystals), Overclocked Aethervein, Soul Stone Siphoner, Unweave.
5. **Dwarves** (all changed by the owner; abilities must follow the new text, e.g. Riot Shield Bearer is now a Fighter, not a Miner): Riot Shield Bearer, Ironwall Shieldbeard (Corpsman heal 7 split among adjacent allies), Grudge Hurler (target can't move next turn), Bloodbeard Berserker (Grit), Corpsman Brewlord (Medic), Thunderhorn Ram Rider (Charge; pay 2: move any distance), Queen Brunhilda (max 3 damage per hit), Gemdrunk Deepdelver (+1 Attack per banked crystal), Ironjaw Big Back, Granite Oathkeeper (Enforcer knockback 1–2), Oathbound Overwatch (attack any enemy at any distance), Barrelback Courier (Haste), Door Splitter (Charge any direction, knockback 1–3 random), Grimhold Ravager (Brawler double Attack), Thunderhorn Blast, Ironclad Bulwark (next hit does 0), Emergency Rations (heal your Commander or a unit 4).
6. **Neutral spells and Crystal cards:** Snuff Out (counter a spell costing 3 or less), Field Bandage (heal a creature to full), Desperate Plunder (+3 Flow each turn while the opponent has more Flow; stackable; stops once you have more), Soul Shard (+1 Bank), Soul Cluster (+2 Bank), Heart of the Fallen (+4 Bank), Motherlode (+3 Bank, next creature costs 2 less), Wellspring Geode (+1 Flow every turn for the rest of the game). Crystal cards: free, any time during your turn.

For every ability: the AI can use it, the close-up / How to Play wording matches the card text, and `longText` stays in the existing format. If a card's text is unclear, choose the simplest reading, list it in the report under "Owner questions", and keep going.

Report: which steps and cards are done, owner questions, screenshots 1920×1080 of a few new abilities in action (one per faction) and of the deck builder showing the new card art.

## Round 12b-1 (done) — Goblin 3D models from the owner's sheets (Round 12 items 3–7, models only)

Round 12a is done (drag-to-play, hand fan, owner card paintings); keep everything from 8a–12a. This round builds ONLY the Goblin 3D models from Round 12 items 3–7 below. Owner sheets in `factory-design/goblin-art/` are BINDING: match them exactly (shapes, colors, gear). Meshy runs ONCE per model from the owner sheet (front view as the main image, other views as extra images if supported); never regenerate unless the owner asks.

Because the last full round hit the 3-hour job limit and lost everything: build ONE model at a time and COMMIT + PUSH after each model works (order: 1 Grubgrabber Miner, 2 Boneknocker, 3 Shiv Rat, 4 Scrapsmith Miner, 5 Grubnak seated + junk throne). If time runs short, stop after the last finished model and report which are done. Keep tests short: one load/placement test per model plus the existing suite.

1. **Grubgrabber Miner** (goblin-scrounger): `goblin-miner-tpose-sheet.png` + assembled like `goblin-miner-assembled-reference.png` (crystal backpack with lantern on the back, helmet lamp lit, pickaxe in both hands; `goblin-miner-wide-art.png` = look reference). Rig; idle, walk, pickaxe attack, mine.
2. **Boneknocker** (goblin-pebbler): `boneknocker-model-sheet.png` (hooded goblin, spiked club); attack animation from the sheet's swing poses; idle, walk.
3. **Shiv Rat** (shiv-rat): `shiv-rat-model-sheet.png` (hooded goblin, rusty dagger); idle, walk, stab.
4. **Scrapsmith Miner** (goblin-smith-miner): `apron-goblin-model-sheet-UNASSIGNED.png` (leather apron, red scarf, helmet lamp, backpack, pick + hammer); walk cycle and smash/mine poses from the sheet.
5. **Grubnak Rotgut**: `grubnak-model-sheet.png` (much bigger than a normal goblin) SEATED on his junk throne `grubnak-throne-model-sheet.png`, which REPLACES the castle/stand in the Goblin stronghold spot; seated idle holding the staff, facing the board (owner 146° rule); keep his existing reactions where they still fit.

Each model replaces the old one on the board, in the 3D viewer and in the deck builder. Screenshots 1920×1080: each new model on the board and in the 3D viewer, Grubnak on his throne.

NEXT (Round 12b-2, not this round): Gnome and Dwarf models from `factory-design/gnome-dwarf-art/` — Gemsinger Miner = `Crystal Miner Character Reference Sheet.png` (card art `Gnome Miner’s Crystal Strike.png`); Stonebreaker Miner card art = `Dwarf Miner’s Crystal Strike.png` (model sheet still to be uploaded by the owner); Archmagister Sproingle = `Purple Archmage Wizard Turnaround Sheet.png`, portrait `Archmage of the Crystal Cathedral.png`, seated on `Fantasy Crystal Throne Concept Sheet.png`; Thane Borgo Gravelgrim = `Gear-Crowned Dwarf Commander Turnaround.png`, seated on `Dwarven Police-King Throne Turnaround Sheet.png`.

## Round 12a (done) — QUICK round: drag-to-play fix, hand layout, owner Goblin card paintings ONLY

The first round 12 run hit the 3-hour job limit and saved nothing (it tried to build 5 new 3D models). The owner split it. Build ONLY these items from the Round 12 list below, and COMMIT/PUSH working progress early (after item 1 works) so a timeout never loses everything:
- Round 12 item 1 (BLOCKER: drag a hand card onto the board to play it; real pointer-event tests).
- Round 12 item 2 (hand layout: even fan, never covers the board).
- Card paintings only from items 3–7: `goblin-miner-card-art.png` → Grubgrabber Miner, `boneknocker-card-art.png` → Boneknocker, `shiv-rat-card-art.png` → Shiv Rat, `scrapsmith-miner-card-art.png` → Scrapsmith Miner, `grubnak-on-throne-art.png` → Grubnak's commander portrait (Choose Your Commander, HUD portrait). Use exactly, in cards, close-ups, deck builder and menus.
NOT this round: NO 3D models, NO Meshy, NO throne. All model work in items 3–7 is ROUND 12b (next run). Target well under 90 minutes.

## Round 12 (full list; split into 12a now + 12b models next) — owner playtest of round 11: card drag-to-play is broken (BLOCKER), hand layout, owner Goblin art + 3D models (Grubgrabber Miner, Boneknocker, Shiv Rat, Scrapsmith Miner, Grubnak + throne)

Round 11 is done; keep everything from 8a–11 unless an item below replaces it. Build ONLY the 7 items below (queued Menu Builder / deck builder / halls / card template work stays queued). Faction color rule: Goblins green #3ee06a + purple #b45cff; Gnomes purple #9b4dff + blue #3fa9ff; Dwarves navy #2f5fd8 + gold #FFD700. Owner art in `factory-design/goblin-art/` is BINDING: use it exactly. Meshy runs ONCE per model from the owner sheet; never regenerate unless the owner asks.

### 1. BLOCKER — cards cannot be played by dragging
Verified on the round 11 preview (Chrome, 1568×782 viewport, turn 1, 60 legal summons available): every drag of a hand card onto a legal home-row square only REORDERS the hand (round 11 item 7 swallows the drag) and nothing is summoned; a drag started from the tucked hand also summons nothing. Fix: a drag that leaves the hand band upward (or moves more vertically than sideways) is a PLAY drag: the hand tucks fully off the board, the real card follows the pointer (round 11 item 8 float), legal squares highlight, releasing on a legal square summons / casts / plays exactly as `legalActions()` allows; releasing elsewhere returns the card. Reordering happens ONLY while the pointer stays inside the hand band and moves sideways. Same for spells, crystals, upgrades and Tunnel targets. Touch works the same.

### 2. Hand layout
When the hand is raised it must never cover the board rows (especially the player's home/deploy row). The cards are laid out as an even fan, every card fully on screen, none squeezed, clipped or hidden behind the hovered card; the hovered card enlarges upward without covering board squares or pushing neighbours off. Must work at 1920×1080 and smaller windows (1568×782, 1366×768).

### 3. OWNER ART — Grubgrabber Miner (goblin-scrounger)
- `goblin-miner-card-art.png` = the card painting (replaces current art; card, close-up, deck builder, menus).
- `goblin-miner-tpose-sheet.png` = 3D model source: T-pose front/side/back, head views, pickaxe, helmet with lamp, backpack front/side/back.
- `goblin-miner-assembled-reference.png` = how the model must be assembled: crystal backpack with lantern worn on the back, helmet lamp lit and glowing, pickaxe held in both hands.
- `goblin-miner-wide-art.png` = extra look reference only (not shown in game).
Rig + idle, move, attack (pickaxe swing) and mine animations. Replaces the current model on the board and in the 3D viewer.

### 4. OWNER ART — Boneknocker (goblin-pebbler)
`boneknocker-card-art.png` = card painting. `boneknocker-model-sheet.png` = 3D model (hooded goblin, spiked wooden club); the bottom row of the sheet is the attack swing: use those poses for the attack animation. Idle + move too.

### 5. OWNER ART — Shiv Rat (shiv-rat)
`shiv-rat-card-art.png` = card painting. `shiv-rat-model-sheet.png` = 3D model (hooded goblin with a rusty dagger in hand; sheet includes palette and detail views). Idle, move, stab attack.

### 6. OWNER ART — Scrapsmith Miner (goblin-smith-miner)
`scrapsmith-miner-card-art.png` = card painting. `apron-goblin-model-sheet-UNASSIGNED.png` = the Scrapsmith Miner 3D model (leather apron, red scarf, helmet lamp, backpack, carries pick + hammer); its walk cycle row and smash/mine poses drive the move, attack and mine animations.

### 7. OWNER ART — Grubnak Rotgut + his junk throne
- `grubnak-model-sheet.png` = new Grubnak 3D model (spiked crown with purple gems, fur-collar purple robe with the crowned-skull emblem, crystal-tipped staff). The small miner on the sheet shows scale: Grubnak is much bigger than a normal goblin.
- `grubnak-on-throne-art.png` = his commander portrait / Choose Your Commander art.
- NEW: Grubnak no longer stands on the castle/stand. He SITS on his junk throne (`grubnak-throne-model-sheet.png`: front, side, back views + wireframe) which replaces the castle/stand model in the Goblin stronghold spot. Seated pose holding the staff, facing the board (keep the owner 146° facing rule). Throne sits flat on the ground, sized to the stronghold footprint.

**Tests:** keep all checks passing (update outdated ones); add tests for every item. Item 1 MUST be tested with REAL pointer events (pointerdown, several pointermoves, pointerup on the square's screen position) at 1920×1080 and 1568×782: dragging a Miner from the hand onto a legal home-row square summons it; a sideways drag inside the hand reorders; the raised hand never overlaps board squares. Art tests: the 4 card paintings equal the owner files; the new models load (Grubnak seated on the throne; Miner wears the backpack, lamp on). Screenshots 1920×1080: a drag onto the board with highlights, the raised hand, each new model on the board and in the 3D viewer, Grubnak on his throne, the 4 new cards.

## Round 11 (done) — owner playtest of round 10: intro sound & music, main menu, highlights + settings, mines, pop-ups, hand drag & reorder, unit rings, fixes, Ranged 7

Round 10 is done; keep everything from 8a–10 unless an item below replaces it. Build ONLY the 17 items below (queued Menu Builder / deck builder / halls / card template work stays queued). Faction color rule: Goblins green #3ee06a + purple #b45cff; Gnomes purple #9b4dff + blue #3fa9ff; Dwarves navy #2f5fd8 + gold #FFD700.

### 1. Intro sound and music
Intro has no sound: the logo crash sound (owner ElevenLabs snd-qoqhrj, at the crash animation start, vol 2) and the thunder (at 470 ms) do not play. Music (Tense Cycle) must start on the intro and play continuously through every menu until a match starts (no restart between menus). Browsers block audio until the first click/tap: add a short "Click to begin" gate (title + logo, owner style) before the intro so the intro sounds and music can play, OR start everything on the first interaction — must work on a fresh page load.

### 2. Main menu matches the owner file
Main menu text does not match the owner's Menu Builder file: button words must be WHITE (#ffffff) with the owner's font/size/glow/hover as in factory-design/round9c/menus.json (all text pieces: exact color, font, size, bold/italic, shadow, glow, halo). Still gold/yellow in the build.

### 3. Square highlights look
Placement / move highlight: not a flat solid color fill. Make it look like light emanating from the ground — glowing edges/rim light with a soft inner falloff (mostly transparent center), in the faction color; attack squares red glow the same way.

### 4. Settings: Square highlights panel
Settings → "Square highlights" panel (fully customizable, live preview square, saved per player, "Reset to default"): edge/rim color and inner glow color (two color pickers; default = player's faction main + highlight colors), attack color (default red), opacity/strength, glow size/softness, edge thickness, inner fill amount (0 = edges only), pulse on/off + speed. Applies to placement, move and attack highlights.

### 5. Mine click area
Mine click area = exactly the mine's own board square (its screen quad on the ground), nothing outside it: the tall crystal/banner drawn over the square above must NOT capture clicks there, so creatures standing behind/above a mine are selectable. Clicking anywhere in the mine's own square (or its pick icon) still auto-mines with all miners.

### 6. Played-card pop-ups: opponent only
Played-card pop-ups: show ONLY the opponent's played cards (left edge, stacking). Remove the pop-up for the player's own cards.

### 7. Rearrange the hand
Rearrange hand: click-drag a card sideways within the hand and release to reorder it (order kept for the match).

### 8. Dragging a card
Dragging a card to play: the drag shows the ACTUAL card (full face), not the grey skull placeholder. While held it floats/bobs gently and tilts subtly in the direction of movement (springy, "fidget" feel).

### 9. Hand while dragging
While dragging a card out onto the board, the hand tucks down so it never blocks squares; while dragging within the hand (reordering, P7) the hand stays up.

### 10. Unit rings
Unit ring: the ring under each creature uses the side's faction color by default (owner color rule) and greys out once that unit has moved/acted this turn. In Settings, next to Square highlights, a "Unit rings" panel: ring color for my units (default my faction color), enemy ring color (default their faction color), "already moved" color/grey amount, thickness, glow, opacity, Reset to default; saved per player, live preview.

### 11. RULE FIX — Miner death draws a card
Round 10 item 5 is not working (test AC247): when a basic Miner (role Gatherer) dies, its owner draws 1 card; not when used up as an upgrade. Update the rules texts with the dies/draw wording (AC255).

### 12. Commander facing
Grubnak is ~79° off (AC230): use the owner's turn 146° exactly as defined in round 9c item 2 (facing direction = (cx: sin t, cy: cos t), +cy toward the player).

### 13. Change Commander button
"Change Commander" on Choose Your Commander is covered by the deck pictures (AC206): it must be visible and clickable.

### 14. Close-ups without 3D viewer
Spell and crystal card close-ups must not show the 3D viewer (AC209).

### 15. Deck Builder text colors
Deck list card lines, the counts summary and the "0 of 50–100 cards" line are WHITE; + / − unchanged; "Back" bold (AC210).

### 16. Outdated checks
Update the 8 old checks that contradict the round 10 rules (mines may touch, Tunnel off the back row, lower hand rest, etc.) and investigate the mine test timeout (AC245) and mine-glow report (AC252).

### 17. RULE CHANGE — Ranged range 7
RULE CHANGE: Ranged range 5 → 7 squares, still only the 8 straight directions, and the shot still stops at the FIRST unit in the line (yours or the enemy's; cannot shoot past/over any unit). Update card text, longText, rules, AI, tests.

**Tests:** keep all checks passing; add tests for every item (intro audio plays after the begin click and music continues across menus without restarting; main menu colors equal menus.json; highlight + ring settings persist and apply; mine hit area limited to its own square; only opponent pop-ups; hand reorder; drag shows the real card; hand tucks while dragging onto the board but stays up while reordering; ring faction colors and grey after moving; Miner draw; Commander yaw 146°; Ranged 7 with blocking). Screenshots 1920 × 1080: the begin screen, intro, main menu, a drag with highlights, the Settings highlight and ring panels, a unit behind a mine selected, an opponent pop-up stack.

## Round 10 (done) — owner playtest of 9c: highlights, played-card pop-ups, mines, rule changes (Miner draw, Ranged lines, Crystal cards, Tunnel), Crystal Flow, card close-up, hand

Round 9c is done; keep everything from 8a–9c unless an item below replaces it. Build ONLY the 13 items below this round (the queued Menu Builder / deck builder / halls work stays queued). Faction color rule (owner, binding): Goblins = green #3ee06a with purple highlights #b45cff; Gnomes = purple #9b4dff with blue highlights #3fa9ff; Dwarves = navy blue #2f5fd8 with gold highlights #FFD700.

### 1. Drag highlights
When dragging a card to play it or moving a creature, the squares you can use are clearly brighter (strong fill + glowing outline, readable on the arena art) in the player's faction color. Squares where the move/drop would ATTACK are RED instead. Test: highlight alpha/brightness measurably higher than 9c; colors per faction; attack squares red.

### 2. Played-card pop-ups
When a card is played it still pops up and holds a few seconds, but: cards the ENEMY plays hover at the LEFT edge of the screen, cards the PLAYER plays at the RIGHT edge, each with a small margin, vertically centered above the hand, and they STACK (up to 3 visible, newest on top, slightly offset) instead of appearing in the center. They never cover the board center or the HUD crystals.

### 3. Random mines can be close together
Random mine placement may put mines next to each other / touching (adjacent squares allowed, never the same square, never overlapping models), so mining spots are fewer and contested. Keep all other placement rules (not on stronghold/home rows).

### 4. Mine click area
The whole mine site is clickable: crystal, banner, pedestal, rubble and the mining-pick icon — not only the low base (hit area = the mine model's screen bounding box, padded slightly). Clicking the mine or its pick icon = auto-mine with every miner of yours that can mine it this turn (existing auto-mine behavior).

### 5. RULE CHANGE — Miner death draws a card
When a basic Miner (role Gatherer, e.g. Grubgrabber Miner, Gemsinger Miner, Stonebreaker Miner) dies, its owner draws 1 card. If the Miner is used up as an upgrade (drag-played onto a creature), it does NOT draw. Smith Miners unchanged. Update the card text, longText, How to Play / tutorial text, AI evaluation, and engine tests.

### 6. RULE CHANGE — Ranged attacks in straight lines, range 5
Ranged creatures attack up to 5 squares away, but only along the 8 straight directions (up, down, left, right and the 4 diagonals) — not any square within range. The shot stops at the FIRST unit in the line (it can hit that unit; it cannot shoot past it). Highlights (item 1) show only legal lines. Update card text, longText, rules, AI and engine tests.

### 7. Crystal Flow shards
The shard streams use the new faction colors (stronger, clearly that faction's main color with highlight sparkles) and flow from each mine into that side's Flow CRYSTAL COUNTER on the HUD (screen position of the player-flow-crystal / enemy-flow-crystal piece), not into the castle.

### 8. Card close-up
Clicking a card opens the close-up at TWICE the current size (fit to the screen height if needed), with NO scroll bar (text sized to fit) and NO "Close" text/button. Clicking anywhere outside the card (or Esc) closes it.

### 9. Hand at rest / hover
At rest the hand tucks down so only about a QUARTER of each card shows above the bottom edge. Hovering the hand slides the cards up fully; while up, hovering a card enlarges it (current enlarge size is fine). Touch: tap the hand to raise it.

### 10. Mine marker
Remove the white ring/ellipse drawn around each mine. Replace it with a subtle ground decal lying flat on the board: a soft glow pool in the mine's crystal color under the mine plus a faint rubble/cracked-stone shadow; tinted in the owner's faction color once a side holds the mine. The small income tag stays.

### 11. Mines sit flat
Every mine model sits flat and level on the board: upright, base flush with the board surface, no lean or tilt, same size for all mines.

### 12. RULE CHANGE (for now) — Crystal cards any time
Crystal cards can be played at any time, with NO once-per-round limit (still free and Instant speed). Update card text, longText, rules, AI and engine tests.

### 13. RULE CHANGE — Tunnel any time
Tunnel (Grubgrabber Miner and every Tunnel card) works at ANY time from the start of the match: the creature can be summoned onto any empty space next to any mine; it no longer requires being behind on mines. Find and fix the cases where Tunnel placement fails. Update card text, longText, rules, AI and engine tests. (Desperate Plunder stays as it is: castable only while the enemy owns more mines.)

**Tests:** keep all checks passing; add tests for every item (highlight colors, pop-up side/stack, adjacent mines allowed, mine hit area, Miner-death draw vs upgrade, ranged lines + blocking, flow target = HUD crystal, close-up size/no scroll/outside-click, hand tuck 25 %, no mine rings, mines level, unlimited crystal cards, Tunnel from turn 1). Screenshots 1920 × 1080: a drag with highlights (move + attack squares), played-card stacks on both sides, the close-up, the hand at rest and raised, a Crystal Flow stream into the counter.

## Round 9c (done; unfinished parts queued) — fix the broken arena, Commander pose and stronghold, owner menus (Menu Builder), deck builder items

Round 9a is done but the owner's playtest found the match **broken**: no arena picture, no arena effects, no foreground cut-outs. Build only **9c** now (9b, the in-game editor, stays queued). Keep everything from 8a/8b/9a unless an item below replaces it. Rules and numbers are unchanged.

### 1. MUST FIX FIRST — the arena never draws (owner playtest, Chrome on Windows)
Cause (found by the owner's helper in the live preview `oreheart-8-qa3fodimj`): the arena builder (`$1` in the bundle; the effect factory `At(k)` with the builder table `it={fireflies,shimmer,plant,testunit,banner,flame,waterfall,glow,lantern,eyes,pool}`) runs `D[k.type].forEach(...)` for **every** effect in `{...arenaLayout, effects: ownerLayout.effects}`. The owner layout has **3 effects of type `flow`** (the Crystal Flow streams). `D.flow` is undefined → TypeError → the whole arena build throws → `Promise.all(...).then(...).catch(()=>{})` swallows it → `Be` stays null, the arena canvas is never drawn (0 draw calls on `.arena-canvas`), `arenaDetails().foregroundCutouts` = 0.
Fix:
- `flow` effects are drawn by the Crystal Flow system (round 9a item 8), not the arena effect builder: route them there; the arena builder must **skip types it does not build** and wrap each effect build in try/catch so one bad effect can never take down the arena.
- Never swallow arena errors silently: `console.error` them, and if the arena picture fails, still draw the background + arena picture without effects.
- After the fix all **57** owner effects show (54 arena effects + 3 Crystal Flow streams), with the owner's per-type brightness/size/speed, and the foreground cut-outs work.
- **New test that would have caught this:** in a real browser match, the arena canvas has draw calls every frame (count `drawElements/drawArrays` on the arena canvas's WebGL context, must be > 0) and a pixel sample of the screen center during the match is **not** the plain board background color `rgb(42,29,56)`. Also assert `arenaDetails().foregroundCutouts` equals the owner layout's cut-out count and the arena effects count is 54 + the flow count 3.
- Report a screenshot of the match at rest (1920 × 1080) showing the arena picture and effects.

### 2. Commander and stronghold pose — match the owner's Game Editor exactly
Owner: "He's still facing backwards. He's standing on top of the stand and not inside of the stand. I want him to stand on the ground and the castle to stand on the ground, the castle to stay put, not move, and him to do his emotes."
The owner posed them in the Game Editor (`factory-design/owner-tools/game-editor-source.html`, function that places pieces: `outer → yaw → sc → model`; the model is first moved so its bounding-box **bottom-center sits at the origin**: `obj.position.set(-(min.x+max.x)/2, -min.y, -(min.z+max.z)/2)`). Values from `factory-design/owner-layouts/final-draft/layout.json` → `pieces`:
- `pFort` (your stronghold): cx 1.5, cy 6.5, scale 1.27, stretch sx 1.03 / sy 0.88 / sz 1.15, turn 137.
- `pCmd` (Grubnak): cx 1.5, cy 6.5, scale 1.48, turn 146, heart on.
- `eFort`: cx 11.5, cy 0.5, scale 1.29, sx 1.19, sz 1.56, turn −19, flip. `eCmd`: cx 11.5, cy 0.5, scale 1.65, turn −15, flip, heart on.
Rules:
- **Both stand on the ground.** Each model's lowest point (after scale and stretch) touches the board surface at its own board point. Grubnak and his stronghold share the same point, so **Grubnak stands on the ground inside his stronghold, not stacked on top of it.** Same for the enemy pair. No vertical offset for Commanders.
- **Upright.** The editor's `characterSizes.tilt` (25°) is only a picture-view preview trick; the game has a real 3D camera, so do **not** tilt or lean the models (lean 0). Grubnak was drawn lying diagonally in 9a — fix.
- **Facing (`turn`, degrees, about the vertical axis).** Board axes: +cx = to the right along the player's near edge, +cy = toward the player (the camera). The glTF models face their own +Z. Facing direction for `turn` t = (cx: sin t, cy: cos t). So turn 0 faces the camera / player's edge, 90 faces right, 180 faces the far (enemy) edge. Grubnak at 146 faces up-board and to the right, toward the enemy's corner (his back three-quarters to the camera, exactly as the owner posed him). The enemy Commander at −15 faces the player's side. Apply `turn` **instead of** any automatic "face the enemy / face the camera" rule from round 8; automatic looks (look back, impatient, point) may turn him temporarily but he always returns to the owner's turn.
- Size = Model Editor scale (Grubnak 1.54, stronghold 0.67; 1 unit = 1 board square) × `scale` × `characterSizes` group sliders (all 1); stretch sx/sy/sz in the model's own axes before turning.
- **The stronghold stays put**: no movement, bobbing, turning, retreating or idle animation, ever. Only its health heart may change.
- **Grubnak plays his Idle loop and his emotes in place** (laugh = Chest_Pound_Taunt, point = Call_Gesture, celebrate = Victory_Fist_Pump, surprised/hit = Hit_Reaction(_1), cast = mage_soell_cast, defeat = Dead) with the scepter in his right hand (9a item 6 values). Emotes never move his board position.
- Tests: commander base y == board surface y (± 1 % of a square) at the same cx/cy as the stronghold; commander world yaw == 146° in the board frame above (± 3°); stronghold transform identical across 10 s of play including emotes; no tilt/lean on any piece. Report a close-up screenshot of each Commander with stronghold at rest and mid-emote.

### 3. Owner menus from the Menu Builder (binding)
The owner laid out and animated every menu screen in the new **Oreheart Menu Builder** and sent the result: `factory-design/round9c/menus.json` (+ the owner pictures/sounds next to it, named in its `images` map). Reference implementation: `factory-design/round9c/menu-builder-source.html` (port the behavior and numbers; do not ship the builder).
- **Format** (also in the file's `units` field): `screens[]` each with `id`, `kind` (`intro` / `main` / `deck` / `commander` / `custom`), `bg {src, color, dim, vignette}`, `music` (`tense-cycle`, `first-fight`, `none`, or `snd:<id>`), `transition {type: fade|none, ms}`, `intro {length, next, skip}`, `sounds[]` (played when the screen opens) and `pieces[]`. `first` = the screen the game opens on.
- Pieces: `x, y, w, h` % of the 16:9 screen; `rot`, `mirror`, `flipV`, `opacity`, `z`, `hidden`. Kinds: `text` / `button` (`text {content, size (% of screen height), color, font, bold, italic, align, spacing (em), shadow, glow, glowColor, halo, haloColor, haloSize}`; buttons have `button {goto (screen id or action:start-match / action:continue / action:quit / action:settings-sound), hoverColor, hoverGlow, hoverGlowColor}`), `pic` (`pic {src, mode picture|frame, fit, slice, border, fill}`), `panel`, and `zone` (= where the game draws its own live content).
- **Zones** (`zone.show`): `cards` (collection grid; `cols` cards per row, `gap`), `rowslider` (the cards-per-row slider, linked to the grid), `deckpick` (your decks as card-back tiles with ◀ ▶ and "+ New deck"), `decklist`, `counts`, `filters`, `actions`, `commanders`, `decks`, `label`. Each zone has its own text look in `zone.st` (same fields as text, plus `accent` color and `faction` = names in faction colors), owner words in `zone.words` (e.g. `counts.line1` "Cards {n} (50–100) · Creatures {c} · Spells {s} · Crystal cards {y}"; `{deck}` in the deck list title), renamed deck/Commander names in `zone.names` / `zone.abil`, and per-word overrides in `zone.ws[key] {color, size (em), font, bold, italic, glow, glowColor}`. Build the real screens so every zone sits exactly in its box with the owner's words, fonts, colors, glows and halos. The live behavior is the game's (it is what the Menu Builder's "Try it like a player" imitates).
- **Animations** (`anim`): entrance `in` = none / fade / slide (`from`, `dist`) / grow / shrink / drop / spin / flash / wipe / **crash** (falls straight down from above the screen, squashes on impact at 60 % of `dur`, rebounds, dirt chunks and dust fly from the piece's bottom edge, screen shakes; `crash {dirt, color, shake}`), with `delay`, `dur`, `ease`; loops `loop` = float / pulse / glow / sway / blink / spin with `loopAmt`, `loopSpeed`, `loopColor`. Port the exact keyframes from the builder.
- **Sound effects** (`sounds[]` on pieces and screens): `{src, when (start | impact | end | open), at (extra ms), vol, pitch}`. Built-in names (`crash`, `boom`, `bang`, `thud`, `whoosh`, `whistle`, `rumble`, `clang`, `shatter`, `pebbles`, `thunder`, `zap`, `sparkle`, `stomp`, `swordhit`) are synthesized with Web Audio in the builder (`SFX` table in the source): port that code exactly. `snd:<id>` = an owner sound file shipped with the menus file (the owner's ElevenLabs sounds): copy it into the game (`public/audio/menu/`) and play it as is.
- **Fonts:** Alegreya SC, Alegreya Sans, Cinzel, Cinzel Decorative, MedievalSharp, Pirata One, Metamorphous (Google Fonts, SIL OFL) — bundle the ones the menus use locally like the existing Alegreya files.
- Music per screen from the file (Tense Cycle on menus by default), crossfades as in 9a. Sound effects respect the Sound Effects volume and Mute.
- The Intro screen is new: it plays first (`first`), shows the owner's animated logo pieces, skips on click if `intro.skip`, then goes to `intro.next` after `intro.length` ms.
- Tests: each screen's pieces within 1 % of their boxes at 1920 × 1080; entrance animations play (crash: piece ends at its box, dust/dirt elements appear at impact time); owner sounds fire at their times (spy on Web Audio / HTMLAudio); intro → main after its length and on click. Screenshots of every screen at 1920 × 1080 and 844 × 390.

### 4. Main menu background (owner art, binding)
`factory-design/round9c/main-menu-background.png` = the owner's new main menu picture (1774 × 887); make the game's WebP from it. It replaces `public/art/menu-cavern.webp` (the Menu Builder's built-in picture `menubg` is this picture). Cover-fit, no stretching, no black bars. Keep it in all later rounds.

### 5–10. Deck builder (owner playtest of 9a, queued)
5. Deck name entries tinted in their faction color (Goblin green, Gnome blue, Dwarf purple), readable.
6. Close-up 3D viewer for **every creature card** (card left, 3D model right: drag to spin, zoom, buttons for every animation it has), using the board placeholder models; spells/crystal cards centered alone as now.
7. Double-click a saved deck = start a match with it (single click selects).
8. New plain-text action **Play** next to Auto-fill / Save / Rename / New deck; disabled with a short reason while the deck is not legal.
9. Outer glow of each deck entry in its faction color.
10. Text colors (owner exception): deck list card lines WHITE; the summary "Cards 50–100 / Creatures / Spells / Crystal cards" WHITE; the "0 of 50–100 cards" count WHITE; + / − unchanged; "Back" BOLD. Where the owner's menus file (item 3) sets a color for these, the menus file wins.

**Tests:** keep all checks passing; update the old checks that 9a's report listed as outdated (turn display position, corner ornaments on the Goblin match screen, mine height, 54 vs 57 effects, hand pop-out sizes) to the owner's layout; investigate the "second card didn't pop" failure and fix it if real. Screenshots at 1920 × 1080 and 844 × 390 of: the match at rest (arena visible!), each Commander close-up, every menu screen, the deck builder with a creature close-up.

## Round 9a (done) — the owner's match-screen layout (Goblin theme), faction banks, 3D mines, Crystal Flow, hand motion, menu, music

Round 8b is done; keep everything from rounds 8a and 8b unless an item below replaces it. Rules and numbers are unchanged; layout positions change only as the owner's layout file says (owner request). Round 9 is split: build only **9a** now; **9b** (the Owner Game Editor inside the game) is queued in `factory-design/round-9b-queued.md` and is not part of this round.

**Owner files (binding, use exactly, no redraw):**
- `factory-design/owner-layouts/final-draft/layout.json` + its pictures `img-*.webp` (same folder): the owner's finished match screen, made in the owner's Game Editor. The format is explained at the top of the file (`screen.units`) and below.
- `factory-design/owner-layouts/themes/goblin/goblin-theme.json` + pictures: the same look grouped as the **Goblin theme** (corner frames, Flow crystals, bank, colors).
- `factory-design/design/references/goblin-bank.png` (Goblin bank), `opponent-bank-placeholder.png` (opponent bank, placeholder), `first-fight.mp3` (match music), `tense-cycle.mp3` (intro/menu music).
- `factory-design/owner-tools/game-editor-source.html`: the owner's Game Editor page. It is the **reference implementation** for everything below (how the layout is drawn, the 3D crystal mine model `buildMineModel`, the Crystal Flow effect `makeFlow`, the hand motion, the drop-down menu, the banks). Port the behavior and numbers from it; do not ship the editor page itself.

**Layout format (from the editor):** HUD pieces (`hud`): `x, y, w, h` are % of their parent (the 16:9 screen, or the piece named in `parent`); text `size` is % of screen height (times `textScale`); `rot` degrees; `mirror` / `flipV` flip the picture only (numbers stay readable); `z` layer; `hidden`. Kinds: `text`, `pic`, `gem` (Flow crystal: picture `src` + number), `bank`, `fan` (enemy card backs), `hand`, `menu`. `role` names the game element each piece is (e.g. `player-flow-crystal`, `enemy-deck`, `done-button`). Pictures: `img:<id>` → `img-<id>.webp` in the layout folder; plain names are built-in game art. Board pieces (`pieces`): `cx` 0–13 columns, `cy` 0–7 rows from the far-left board corner; 3D size = Model Editor scale (1 unit = 1 board square: Grubnak 1.54, stronghold 0.67, mine fitted to 1.7 squares tall) × `scale` × `characterSizes` group sliders; `sx/sy/sz` stretch width/height/length; `turn` facing in degrees; `lean`. Effects (`effects`) and `effectMasters`, `arena`, `arenaLook`, `boardCorners`, `foregroundCutouts` use the Arena Editor format from round 8.

### 1. The match screen matches the owner's layout exactly
Place every HUD piece where `layout.json` puts it, at that size, rotation and layer, with its text, font, color, shadow and glow, at 1920 × 1080 and scaled for any 16:9 screen (other shapes: keep pieces anchored to their nearest screen edge). Highlights: your Flow crystal (green crystal-shard picture) large at the bottom-left with Flow / Next beside it; your name top-left; enemy name, Flow, Next, crystal (white shard picture, placeholder) top-right; enemy deck and card fan at the top, **upside down** (facing the opponent; the deck count stays readable); turn, phases, timer and Done grouped bottom-right; your deck bottom-right; the 3 **goblin corner frames** (top-left, bottom-left, bottom-right) exactly as placed. The HUD stays fixed while the board zooms and pans (round 8).

### 2. Faction themes (new rule)
The match screen's look follows each side's **Commander faction**, for the player and for the opponent: corner frames/borders, Flow crystal picture, bank picture and the color scheme (text, glows, menu, card glow/halo, Crystal Flow colors). The owner's layout is the **Goblin theme** (`goblin-theme.json`). Gnome and Dwarf themes will be supplied later; until then non-Goblin sides use the layout's placeholder pieces. Store themes as data (one theme file per faction) so new ones drop in without code changes. The goblin corner frames replace the old "no corner ornaments" rule **on the match screen for the Goblin theme**; update that check accordingly (other screens unchanged).

### 3. Banks are their own pieces
The Crystal Bank is no longer drawn on the Flow crystal. Each side has its own **bank** piece (`role: player-bank` / `enemy-bank`): the faction's bank picture with the **banked number on it** (owner number style in the layout). Goblins use `goblin-bank.png`; the opponent uses `opponent-bank-placeholder.png` until its faction's bank exists. The "+1 banked" animation flies into the bank piece.

### 4. Drop-down Menu
The Menu button (top-left) opens a drop-down with the owner's items in order: **Resume, Settings, How to play, Sound Effects, Background music, Give up match!**. Opens on click, downward, lined up with the button's left edge, words left-justified; animation "grow" with a springy ease (~260 ms), items appearing 50 ms apart; item look and hover (gold glow, slight grow, slide) and the dark panel exactly as in the layout's `menu` settings. Plain text items that glow on hover, no boxes. Click outside or Esc closes it. Sound Effects and Background music open their volume controls (item 8); Give up match! asks to confirm, then ends the match as a loss.

### 5. Your hand
Use the layout's `hand` settings (port the editor's behavior):
- Fan of up to 10 cards: spacing (`overlap`), fan angle per card, curve (outer cards lower).
- **Hover:** the card under the pointer **slides fully up out of the hand** (its whole card clears the bottom of the screen), straightens and grows to the pop-out size, smooth eased motion (~450 ms); **neighbor cards move aside**; moving the pointer across the hand **shuffles through the cards** one by one (hover is decided by pointer position over the hand, so a big popped card never blocks its neighbors). This replaces round 8's separate pop-out copy.
- Glow and halo: playable glow on every card (green `#9dff3a`, owner strength/size), gold halo on the hovered card, from the layout (faction theme colors).
- **Deal-in:** drawn cards slide up from below the screen into the hand one after another (owner timing: 700 ms per card, 130 ms apart).
- Keep the tight hover zone from round 8 and all touch behavior.

### 6. Board pieces
Place and size the 3D pieces as in `pieces` and `characterSizes` (Grubnak and his stronghold, the enemy Commander and stronghold, mine sizes; turn, stretch). Keep round 8's camera and Commander facing rules; the owner's `turn` values are the resting facing. **Grubnak holds his scepter** exactly as the owner set it in the Model Editor (scepter GLB attached to the `RightHand` bone with position −4.404, 8.752, −3.774, rotation −109.365°, 5.199°, 154.757° (XYZ), scale 61.35) and plays his Idle animation. Health hearts as in the layout.

### 7. New 3D crystal mines
Replace the plain placeholder mine with the owner-approved mine from the editor (`buildMineModel` in `game-editor-source.html`: stone rubble ring, iron-and-gold pedestal with corner posts and gold caps, blue banner with gold diamond emblem, a tall glowing blue crystal with six smaller shards and a few on the rubble, a soft glow). Same size and colors (`mineColor` #3d8bff, `mineGlow` 1), crystals gently pulsing. Built in code, so no Meshy run.

### 8. Arena effects and Crystal Flow
All arena effects as in the layout (57, including per-type brightness/size/speed). **Crystal Flow** (new effect, port `makeFlow`): a stream of tumbling **crystal shards** (faceted, not round dots) that snakes in moving **S-curves** from a mine to a target, using the owner's numbers (count, speed, arc height, S-bends, S-bend size, slither speed, spread, trail, end glow, colors). In play: when Crystal Flow is gained at the start of a turn, a stream flows from each owned mine to that side's **bank piece**, in that side's faction colors; the layout's three flows show the owner's look. Drawn above the board, below the HUD.

### 9. Music
- **Intro and menus:** `tense-cycle.mp3` loops on the title/intro screen and every menu screen (main menu, deck builder, Choose Your Commander, settings, collection).
- **Matches:** `first-fight.mp3` loops during matches; crossfade (~1.5 s) between the two when a match starts and ends.
- Both start after the first click/tap (browser rules), sit under the sound effects, respect Mute, and share one **Music volume** slider (Menu → Background music, also in Settings). Sound Effects volume slider next to it.

### 10. Fix the outdated check
Update the round 8b "Miner Rush under Sproingle" deck-memory test to use a deck that belongs to the chosen Commander.

**Tests:** keep all checks passing (update only those this round intentionally changes). Add: every HUD piece within 1% of its layout position/size at 1920 × 1080 (and anchored correctly at 844 × 390); enemy deck/fan upside down with readable count; no bank badge on the crystals and both bank pieces show their numbers; theme data loads per faction (a non-Goblin Commander gets the placeholder pieces); menu opens/closes, has the six items in order, and Give up asks first; hand: hovering a card raises the whole card above the screen bottom, neighbors move aside, moving across the hand changes the raised card, deal-in plays one card at a time; Grubnak has the scepter in his right hand; mines use the new model; a Crystal Flow stream appears from an owned mine to the bank when Flow is gained; menu music plays on menus, match music in matches, crossfade on start/end, Mute silences both. Report screenshots at 1920 × 1080 and 844 × 390: the match at rest, a raised card with neighbors aside, the open menu, and a Crystal Flow stream.

## Round 8b (done) — owner playtest of round 7 (Commander, cards, hand, deck builder, Choose Your Commander, text palette)

Round 8a is done; keep everything from it (painted arena board, view controls, crystal mine) and from round 7 unless an item below replaces it. Rules are unchanged. If Meshy fails (item 3), keep the current model, finish the round and explain in the report.

### 3. Commander facing and look-back emotes
- **Bug:** the player's Commander (Grubnak) faces the player (toward the camera). He must face the **opponent** (up the board) by default. The enemy Commander faces our side as now.
- **Turning:** smooth whole-body turns of about 0.4–0.6 s, never snapping; he always returns to facing the opponent.
- **Looks back at the player** when he is "talking to" them: at the start of the player's turn, when the player has nothing playable and should press Done, and briefly at random every 20–40 s while idle.
- **Impatience:** on the player's turn, after about 20 s with no player action, he turns to the player and acts frustrated (crossed arms, foot or scepter tapping, shrug), repeating more annoyed about every 15 s until the player acts; any action ends it and he turns back.
- **Faces forward** when acting against the opponent: casting spells, his creatures attacking, laughing or pointing when an enemy creature falls, taking hits.
- **Animations:** use the saved set. Add one or two impatience/look-around clips **once** from Meshy's animation library on the already-rigged Grubnak (owner approves this small Meshy use); update the saved GLB and `models.json`; never regenerate the model. If nothing fits, build it from existing clips (surprised + point at the player + head shake). Make the behavior data-driven so every future Commander uses it.

### 4. Card glow direction
The glow is inverted: today the hard, bright edge is on the outside and it fades inward toward the card. Flip it: the brightest, crisp edge sits right at the card's border and fades **outward** to nothing. Applies to the playable-card halo in the hand and the popped-out card's rim. Keep round 7's thickness, opacity and colors.

### 5. Hand hover zone
Bug: grabbing a creature on the board raises the hand, because the hover trigger is a wide strip reaching far up the screen. Replace it with a box drawn tightly around the hand cards (only their visible tucked part at rest) that grows and shrinks with the number of cards and the fan width; while the hand is raised it covers the raised cards, and leaving it tucks the hand back. The hand never rises while dragging a creature or board piece or while panning the view, including when the pointer passes over the hand.

### 6. Popped-out card
(a) Smoother: eased scale and fade of about 150–200 ms, no jump or flicker when moving between neighboring cards; the pop-out glides from card to card. (b) **20% smaller** than round 7 (about 68–72% of the screen height instead of 85–90%). Still on the very top layer, never off-screen.

### 7. Creature stat badges
The bars under each creature are too big and dominating. Replace them with a compact row of small **painted icons** (sword = Attack, heart = Health, and the same style for Movement and any other stat shown today) with the **number drawn on top of each icon** (bold white, thin black outline, centered). Paint the icons with the image API in the same rich style as the round 6a ruby hearts, transparent background, original designs. About half the current footprint, still clearly readable at 844 × 390 and when zoomed out (never smaller than readable; they scale with the view zoom otherwise). Damaged Health red-orange, buffed values green. Hovering or tapping a creature may show a slightly larger version. Keep them on top of everything on the battlefield.

### 8. Deck builder: drag cards into the deck list (regression)
Dragging a card from the collection onto the deck list no longer works. Restore it: press and drag a card (shown at the 3-per-row size while dragging) and drop it on the list to add one copy, with the same limits as "+". A click without moving (under about 6 px) still opens the close-up (item 14); moving starts a drag. Mouse and touch.

### 9. Deck builder: no layout shift when adding cards
Double-clicking a card to add it makes the deck list panel "pop out" like the old 6a "+" bug: the frame shifts, the panel widens and pushes the card grid over, making the cards smaller. Adding a card by any method (double-click, drag, "+") must never change the size or position of the panel, the grid or the cards. Fix the root cause for every path: fixed panel width, scrollbar space reserved or overlay scrollbars (e.g. `scrollbar-gutter: stable`) so a list that grows past its height doesn't change widths, fixed-width count and name columns, no width animation on new rows.

### 10. Choose Your Commander: uniform deck entries and colors
- Deck entries (e.g. Goblin Warband, Goblin Arcane Horde, Goblin Horde) come out different sizes with different borders and shift around. Make every entry identical in size, border thickness and layout; all names the same font size; long names shrink to fit or wrap the same way and never resize the box. Selecting one glows; nothing changes size or moves.
- Colors (item 13 palette): deck names and titles bright gold #FFD700 bold; "100 cards" and other secondary info brown-gold; actions ("Remove", "Copy to my decks", etc.) brown-gold that glows bright gold on hover (Remove turns warning orange-red on hover). Commander name and section headings bright gold; the Commander's description text brown-gold #D4A94F, not yellow.

### 11. Choose Your Commander: picking a Commander
- The three Commander cards (Grubnak, the Archmage, Thane Borgo) sit closer together, but their glows and faded edges must not overlap or blend.
- Hover: the hovered card smoothly grows and the other two shrink slightly (about 200 ms, eased); nothing else moves.
- Click: the other two fade out and disappear; the chosen card **enlarges and drops back to become a big backdrop** (dimmed, soft glow) in the center of the screen, and his **3D model pops up in front of it** (quick rise and scale-up with a small bounce, then idle with an occasional laugh or point). The card stays behind him while he is selected. Then only his decks populate underneath, laid out as today and uniform per item 10. Commanders without a 3D model yet (the Archmage, Thane Borgo) keep the enlarged card centered alone.
- A **Change Commander** action under him, Esc, or clicking him again brings all three back to the row.

### 12. Choose Your Commander: layout
- **Fight!** moves to the bottom-right corner, the same spot as Done on the match screen (bright gold, bold, glows on hover).
- Rearrange the other actions into a clean, balanced layout around the centered Commander (for example Back in a corner, Change Commander under him, deck actions with the deck list), all plain text actions in the palette colors.
- **Remove** the "View Grubnak in 3D" button and viewer from this screen and from the deck builder's menu (item 14 replaces it).

### 13. Text palette change, everywhere
Body, description and list text on every menu and screen changes from white to **brown-gold** (#D4A94F on dark backgrounds; #B8862B for small or secondary text). Titles, headings, names and main actions stay bright gold #FFD700. White stays only for numbers on icons (crystals, hearts, the new stat badges) and for text printed on card faces. Change the shared palette variables once (the round 6a theme file), not per screen. Check contrast at 844 × 390. This replaces the round 6a "white body text" rule.

### 14. Deck builder close-up with 3D viewer
Clicking a card in the deck builder opens the full-height close-up (round 6a) with the **card on the left** and a **3D model viewer on the right**, side by side and centered as a pair on a dim overlay. The viewer works like round 7's: drag to rotate, scroll or pinch to zoom, plain-text buttons to play each animation, soft lighting. It appears for any card that has a 3D model (today Grubnak's Commander card; creatures later); cards without one show the close-up centered alone as now. Dismiss by clicking the card, clicking outside both, or Esc; dragging or clicking inside the viewer never closes it. No scrollbars; both fit the screen with small margins. No viewer anywhere else in the deck builder.


**Tests:** keep all checks passing (update those this round intentionally changes). Add: player Commander faces the opponent by default and turns back after a look-back; impatience starts after about 20 s idle and stops on an action; glow brightest at the card edge and fading outward; hand does not rise while dragging a creature over it or while panning the view, and its hover box fits the cards for 1, 4 and 8 cards; pop-out about 70% of screen height; stat badges smaller than before and readable at 844 × 390; dragging a card into the deck list adds one copy and a plain click opens the close-up; panel, grid and first card bounding boxes unchanged after adding cards by double-click, drag and "+" until the list scrolls; Commander deck entries all the same size; choosing a Commander hides the other two and shows only his decks; Fight! in the bottom-right; no 3D viewer button on the Commander screen or deck builder menu; close-up shows the viewer for Grubnak and dismisses correctly; body text uses the brown-gold variable. Report screenshots at 1920 × 1080 and 844 × 390: the Commander screen before and after choosing Grubnak, the deck builder close-up with the viewer, and a creature with its new stat badges. Include Meshy credits spent.

## Round 8a (done) — painted arena board with view controls, crystal mine in 3D

Round 7 is done; keep everything from it unless an item below replaces it. Rules are unchanged. **Round 8 is split in two runs.** This run builds **only items 1 and 2** (the painted arena board with view controls, and the crystal mine). The owner's other twelve round 8 changes (Commander facing and emotes, card glow, hand hover box, pop-out card size, creature stat badges, deck builder fixes, Choose Your Commander, brown-gold body text, deck builder close-up with 3D viewer) come in **round 8b, the next run**: do **not** build or test them now, even where the design doc already describes them, and keep round 7's behavior for those parts. An earlier attempt at the full round 8 ran out of time and saved nothing, so start from round 7's code. If Meshy fails (item 2), keep the current mine, finish the round and explain in the report.

**Owner arena files (binding, use exactly, no redraw):** `factory-design/design/references/` → `skullfang-swamp-background.jpg` (1672 × 941, background), `skullfang-arena.png` (the Skullfang Arena painting, transparent outside the arena), `skullfang-arena-layout.json` (the owner's finished layout, "skull arena final draft") and `arena-editor-source.html` (the owner's Arena Editor; port every effect from its code so it looks the same). Read the `note` field in the layout file for the coordinate rules.

### 1. The match board is the owner's painted arena, with 3D pieces on top
- **Look:** the match board looks exactly like the owner's Arena Editor: the swamp background, the arena painting on top (placed by `arena.centerX/centerY/scale`), the arena look (`arenaLook`: brightness, contrast, saturation, hue, applied to both pictures), and every effect in `effects` (54: flames incl. two green ones, glows, a lantern, waterfalls with splash, acid pools with bubbles and smoke, waving banners, swaying plants, a water shimmer on the background lake, five firefly swarms), each with its own sliders and colors. Port the shaders and particle code from the editor; keep each effect's randomness (e.g. glows flicker independently). The two `foregroundCutouts` (the front fence row and the bottom-right post) are drawn over creatures standing behind them. This replaces the procedural battlefield surroundings and the on-hold arena GLB plan.
- **2D board, 3D pieces:** the board and background are 2D paintings; creatures, Commanders, mines and their effects are 3D and move over them. Fit the 3D camera angle once so pieces stand correctly on the painted floor; never re-angle or orbit it. Round 5b's tilt/lens/zoom numbers no longer apply. The HUD layout stays exactly as it is.
- **Squares:** draw **no grid lines**; the squares are painted into the arena. The 13 × 7 board maps onto the owner's four floor corners `boardCorners` (top-left, top-right, bottom-right, bottom-left, in arena-picture pixels) with a perspective (homography) mapping, the same math as the editor's `drawGrid`. Every square's center, click/tap area and highlight (playable squares, move and attack targets, hover) uses this mapping, so highlights sit exactly on the painted squares and appear only when needed. Pieces stand on their square centers.
- **View controls (new):**
  - Zoom: mouse scroll wheel (toward the cursor) and pinch on touch.
  - Pan: drag empty board or background (left mouse, or one finger), right or middle drag, two-finger drag on touch, trackpad two-finger scroll, arrow keys and WASD.
  - The painting, effects, 3D pieces and highlights move and zoom together as one picture (a 2D view transform of the whole match view, e.g. `camera.setViewOffset` / projection crop matched to the backdrop). The HUD stays fixed and does not zoom.
  - **No black bars, ever.** Fully zoomed out, the painting fills the whole window at its true proportions, never stretched (cover-fit); if the window isn't 16:9, the extra strip on two sides is simply off-screen and reachable by panning. The view can never show anything beyond the painting's edges at any zoom; effects are clipped to the painting (two acid pools sit past the right edge: clip them).
  - Zoom in down to about **2.5 screen pixels per painting pixel** (slightly soft is fine, blocky is not); smooth/mipmapped filtering, never nearest-neighbor.
  - Smooth, eased motion at 60 fps on a phone. A **Recenter** text action (palette colors) and double-click / double-tap on empty board return to the full view. Dragging a card or creature never pans; dragging near a screen edge may nudge the view that way.

### 2. Crystal mine in 3D (Meshy)
Image to 3D from `factory-design/design/references/crystal-mine/crystal-mine-front.png` (tall glowing crystal over a stone shrine with a blue banner on a rocky base). About 10–15k polygons, PBR, textures 2048 or smaller. Generate **once** with a script in `tools/` (like the Grubnak one) and save the GLB plus its entry in `models.json`; never regenerate unless the owner asks. It replaces the placeholder mine everywhere: about 1.5 spaces tall, 1 × 1 footprint, tinted by owner as now (player blue, enemy red, unowned pale; swap the crystal and banner colors and emissive glow), keeping the glow and flow particles.

**Tests:** keep all checks passing (update those this round intentionally changes, e.g. the old procedural battlefield and camera checks). Add: arena pictures and layout loaded from the owner files; no grid lines drawn; square centers and highlights match the homography of the owner corners (check several squares); zoom limits (fully out fills the window with no bars at 16:9, 4:3 and 21:9; max zoom about 2.5 px per painting pixel); pan clamped to the painting edges; HUD unchanged while zoomed; Recenter works; dragging a card or creature never pans; mine model loaded with owner tints. Report screenshots at 1920 × 1080 and 844 × 390 of the match fully zoomed out and zoomed in. Include Meshy credits spent.

## Round 7 (done) — fixes from the 6a playtest + Build B begins: Grubnak in 3D (Meshy)

Round 6a is done; keep everything from it unless an item below replaces it. Rules are unchanged. **Part A (fixes) must ship even if Part B (Meshy) fails:** do Part A first, then B. If Meshy errors or runs out of credits, keep the current Grubnak figure, finish the round and explain what failed in the report.

### Part A — fixes
1. **Hand bug, top priority:** hovering makes cards pop up and stay up; they don't retract, and the raise/shuffle/in-out motion is broken (it worked well in 5b). When the pointer leaves a card, it returns to its place in the fan immediately. When the pointer leaves the hand area, the whole hand tucks back to halfway. Only one card can be popped at a time, and no card may get stuck raised: after a drag or cancel, after playing a card, on touch, when the pointer leaves the window, or when the hand contents change. Make the animation smooth and quick, like 5b. Add tests that hover in and out of several cards and then leave the hand, checking that every card returns.
2. **Hand cards about 10% smaller than 6a** (about 41% of the screen height at 16:9), with the same tucked-halfway rest state.
3. **Owner art, used exactly** (no redraw, no image API). There are **two different files:**
   - **Single card back:** `factory-design/design/references/card backs.jpg`. This is ONE card: the Oreheart logo over the green/blue crystal heart in a gold frame, 1184 × 1664. Use it on every individual face-down card: each card in the enemy's hand, and any face-down or flipping card. Remove the 6a generated card back.
   - **Deck (the pile you draw from):** `factory-design/design/references/deck-pile.png`. This is a STACK of those cards: the owner's Deck_image.jpg with its painted checkerboard background removed, as a transparent PNG, 1155 × 1313. Use it for BOTH players' deck piles (player bottom-right; enemy at the top just left of his hand, smaller), with the cards-left number on top, and for the deck pictures in the deck builder and deck picker. Do NOT use Deck_image.jpg itself; it has a fake checkerboard baked in.
4. **Popped-out card glow bug:** the glow on cards resting in the hand is fine; keep it exactly. When a card pops out enlarged, its glow is blown out and far too wide, because the glow scales up with the card. The popped card's glow must have the **same thickness in screen pixels and the same opacity** as the glow at rest; do not scale the glow with the card. Its color contrasts with the faction frame: Goblins (green frame) **purple**, Gnomes (gold/blue frame) **blue**, Dwarves (purple frame) **yellow-gold**, shared cards **warm white-gold**. A subtle, slow swirl or shimmer moving along that thin rim is welcome, but not wider and not brighter. Keep it smooth at 60 fps on a phone.
5. **AC172:** the mine measured 1.607 against a 1.6 maximum. Scale the mine to exactly 1.5.

### Part B — Grubnak, Goblin Commander, as a real 3D model (Meshy)
Meshy API key: env `MESHY_API_KEY` (from the repo secret MESHYKEY). Read the current Meshy API docs at https://docs.meshy.ai for the endpoints and fields. Reference images are public on GitHub at `https://raw.githubusercontent.com/Lummex/Starter/main/factory-design/design/references/commanders/grubnak/<file>` (URL-encode spaces).
1. **Character:** Meshy **multi-image to 3D** from `grubnak-front.png`, `grubnak-left.png`, `grubnak-back.png`, `grubnak-right.png` (A-pose, one view each). Request PBR textures, a target of about 30k polygons, triangles. Then **auto-rig** it (humanoid) and add **animations** from Meshy's animation library, choosing the closest matches: idle (breathing), laugh, point, celebrate, surprised/react, cast (spell), hit (take damage), defeat. Download the rigged, animated GLB.
2. **Fortress base:** image to 3D from `fortress-front.png` (static, no rig), about 10k polygons.
3. **Scepter:** image to 3D from `scepter-front.png` (static, about 3k polygons), attached to Grubnak's right-hand bone so it moves with his animations.
4. **Do not regenerate every round:** write a script `tools/gen-grubnak-3d.mjs` that runs the Meshy jobs **once** and saves the results into the game's assets (e.g. `public/models/commanders/grubnak.glb`, `grubnak-fortress.glb`, `grubnak-scepter.glb`) along with a small `models.json` (Meshy task ids, polycounts, file sizes, animation names). Later builds load those saved files and must not call Meshy again unless the owner asks. Downscale textures to 2048 or smaller and keep each file under about 10 MB (character) / 5 MB (others).
5. **In the game:** wherever Grubnak is a Commander (player or enemy), replace the current Grubnak figure with the 3D model standing on his fortress. Total height is about 2.4 board spaces and the footprint is 1 × 1, facing the opponent. Play **idle** all the time; **cast** when he casts a spell; **hit** when his Stronghold takes damage; **laugh** or **point** when one of his creatures defeats an enemy (randomly, sometimes); **celebrate** on victory; **defeat** when he loses. Keep the owner camera and HUD layout; nothing may cover him.
6. **See it:** on the Choose Your Commander screen and in the deck builder, add a **3D viewer** for Grubnak: drag to spin, scroll or pinch to zoom, and plain-text buttons that play each animation. Use the same text style as the other menus.
7. **Report:** include screenshots of Grubnak in a match at 1920 × 1080, in the 3D viewer, and the Meshy credits spent.

Tests: keep all checks passing. Add the hand-retract tests, card back and deck images loaded from the owner files, popped glow thickness equal to the at-rest glow, mine height 1.5, and (if Part B succeeded) the Grubnak model loaded, scaled about 2.4, with animations present, and the 3D viewer opening with working animation buttons.

## Round 6a (done) — owner playtest of 5b: match fixes, card back, text palette, deck builder

Round 5b is done; keep everything from it except where an item below replaces it. Build B (Meshy 3D models, starting with Grubnak) is round 6b, next; do not start it here. Rules are unchanged.

1. **"Done" moves to the bottom-right corner, directly under the player's deck pile** (nudge the deck up slightly so it fits; don't shrink Done). It still appears only when needed. It must never sit in the middle of the screen; today it blocks clicking and dragging creatures there. Make sure nothing invisible (a hit area, an empty overlay) blocks board clicks anywhere.
2. **Remove the hand card counts** for both players (the "N cards" text by the player's hand and the enemy's count). Deck cards-left numbers stay.
3. **Player's hand twice as big** (cards about 46% of the screen height at 16:9), **tucked halfway** below the bottom edge at rest (top half of each card visible; replaces the 5b "nearly fully visible" rest state). The cards fan with roughly half-card overlap so about 7 fit in about two-thirds of the screen width. Hover or tap the hand: it slides up fully. Move away: it tucks back. While dragging a card or creature, the hand drops out of the way.
4. **Hovered card pop-out twice as big:** a big readable close-up about 85–90% of the screen height (never off-screen, never covering the whole screen), drawn on the very top layer above every other card, the HUD and the board. Bug today: neighboring cards cover the popped card.
5. **Original Oreheart card back** for the enemy hand, both deck piles and any face-down card, replacing the generic purple back. The OREHEART logo (from `factory-design/design/references/main logo.jpg`) sits in the middle of a dark, rich back with a gold filigree border and a glowing crystal motif; generate the artwork with the image API, with no other text. It must not resemble any other game's card back.
6. **Enemy hand centered at the top**, mirrored opposite the center of the player's hand. The **enemy deck pile** (with its cards-left number) sits **just to the left** of the enemy hand. This replaces the 5b enemy hand and deck positions. Nothing may ever cover either Commander: the 5b report said the enemy crystal can cover the enemy Commander on some window shapes, and the phase tracker overlaps the enemy crystal text on a phone. Nudge the enemy crystal or phase tracker sideways as needed.
7. **Shared text palette and weights** for every menu and the match screen, defined once (CSS variables / theme file). **This replaces the round 5a "all text plain golden yellow" rule.**
   - Bright gold **#FFD700**: titles, screen headings, main actions (Menu, Done, Fight!), important numbers.
   - Natural brown-gold **#B8862B** (lighter **#D4A94F** where it needs more contrast on dark): secondary labels, section headings, captions, inactive tabs, flavor lines.
   - White **#FFFFFF** (soft **#F4ECDC** for long text): body text, card rules text, list entries, numbers on crystals and hearts.
   - Black **#000000** / near-black **#1A1208**: outlines and shadows behind light text; text on gold or light surfaces.
   - Keep the meaning colors: player blue, enemy red, warning orange-red, success green.
   - Weights (Alegreya SC Italic): **Bold 700–800** for titles, screen headings, card names, Commander names, big numbers and main actions; **Medium 500** for labels and buttons; **Regular 400** for body and rules text. Check contrast at 844 × 390.
8. **Deck builder card close-up** (single click on a card): the card fills the screen from top to bottom with tiny margins (about 4–5× the current close-up), proportions kept, **no scrollbar of any kind**, **no Close button**. Clicking the card again, clicking anywhere, or pressing Esc dismisses it.
9. **Deck list "+" bug:** "+" is slow and makes the row or list shift left with a strange movement, while "−" is instant. Make "+" behave exactly like "−": instant count change, no animation, no layout shift or re-sort jump under the pointer (fixed-width counts and buttons), and rapid repeated clicks all register.
10. **Remove the "All cards" label** on the left side of the deck builder.
11. **Remove the rings / corner ornaments** in the four corners of the deck builder and every other screen. This cancels the round 3b "gold filigree ornaments framing every screen" rule.
12. **Placeholder crystal mine model (owner-supplied):** use `factory-design/design/models/crystal-mine-placeholder.gltf` (embedded glTF; load with three.js GLTFLoader; copy it into the game's assets) for every crystal mine instead of the procedural crystals. Scale it to about 1.5 spaces tall (the file is about 1.32 tall, origin at base center, Y-up, faces +Z). Tint by owner: blue for the player, red for the enemy, pale/neutral when unowned (swap the crystal materials' color and emissive). Keep the glow and flow particles. Keep the model swap a one-line change so a final Meshy model can replace it.
13. **5b report leftovers:** update old check AC36 ("+0 next turn" → "Next +0"). Repaint the ruby hearts with the image API (the owner asked for painted art; 5b drew them in code). The Menu's "Surrender" item stays.

Tests: keep all checks passing (update those this round intentionally changes). Add: Done not in the screen center and board clicks unblocked there; no hand counts; hand tucked halfway at rest and fully up on hover; pop-out card on the top layer and about 85–90% of the screen height; enemy hand centered with the deck to its left; card backs use the new art; palette variables used (no stray text colors); deck builder close-up has no scrollbar and dismisses on click; "+" and "−" change counts instantly without layout shift; no "All cards" text; no corner ornaments; mines use the glTF placeholder. Include screenshots of a match at 1920 × 1080 and 844 × 390 (hand at rest, hand hovered with a pop-out), the deck builder with a card close-up, and a card back.

## Round 5b (done) — match screen: owner camera and layout

Round 5a (menus, deck builder, lettering) is done; keep everything from it. Build B (Meshy 3D models) comes later; do not start it here. Rules are unchanged this round. The owner designed this screen himself in an interactive camera tester; the numbers and positions below come from it. **Match them.**

1. **Camera (owner's exact numbers, 16:9):** the camera looks at the board center from **51° above the ground** with a **48° vertical field of view**. Fit it as the tester does: find the distance at which the full board width and both Commanders (head to feet) fit, then zoom to **107%**; leave **16% of the screen height** for painted sky / distant mountains above the far side; shift the board image **up 12% of the screen height and right 1%** of the width; bottom margin 2%. Re-fit with the same rules for every window shape (16:10, 21:9, 4:3, phone) so both Commanders stay whole. Polished 3D animated-film look: rich warm light, soft shadows, haze in the distance, glowing crystals. The match always fills the whole window, no black bars, live re-fit on resize. Zoom and pan stay available; "Recenter" returns to these numbers.
   Camera fit used by the owner's tester (three.js; board spaces 1 unit, 13 × 7 board centered at the origin, rows along z, row 1 = far side; keyPts = the 4 board corners at y 0 plus both Commanders' head tops):
   ```js
   // S = {tilt:51, fov:48, zoom:107, sky:16, hand:2, panX:0.02, panY:0.24}  (panX/panY in NDC: 1% of width = 0.02, 12% of height = 0.24)
   function place(d){const t=S.tilt*Math.PI/180;camera.clearViewOffset();camera.fov=S.fov;camera.aspect=W/H;camera.updateProjectionMatrix();
     camera.position.set(0,Math.sin(t)*d,Math.cos(t)*d);camera.lookAt(0,0,0);camera.updateMatrixWorld();}
   function ext(d){place(d);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const p of keyPts){const q=p.clone().project(camera);
     x0=Math.min(x0,q.x);x1=Math.max(x1,q.x);y0=Math.min(y0,q.y);y1=Math.max(y1,q.y);}return{x0,x1,y0,y1};}
   const avail=2-2*S.sky/100-2*S.hand/100; let lo=4,hi=300;
   for(let i=0;i<40;i++){const m=(lo+hi)/2,e=ext(m);(e.x1-e.x0<=1.96&&e.y1-e.y0<=avail)?hi=m:lo=m;}
   const d=hi/(S.zoom/100), e=ext(d), dy=(-1+2*S.hand/100)-e.y0, dx=-(e.x0+e.x1)/2;
   camera.setViewOffset(W,H,-(dx+S.panX)*W/2,(dy+S.panY)*H/2,W,H); camera.updateProjectionMatrix();
   ```
2. **Figure sizes (1 board space = 1):** creatures about **1.1 spaces tall**; each Commander standing on his Stronghold about **2.4 spaces tall** in total; crystal mines about **1.5 spaces tall** with a strong glow. Commanders still occupy one space each.
3. **Soul crystal flow particles:** a mine you own streams glowing particles from the top of its crystals in a smooth curving ribbon into your Stronghold (your color); enemy mines stream into the enemy's Stronghold (his color); neutral mines have particles gently swirling above the crystals. Streams redirect when a mine changes owner and pulse brighter when crystals are collected at the start of a turn. Light on performance (GPU particles, capped), passing under units and HUD; Settings toggle on / reduced / off (reduced automatically on slow devices).
4. **HUD layout (owner's positions, % of the screen from each piece's top-left; scale everything with the window):**
   - **Your crystal, top-left (0%, 1%):** a large glowing faceted crystal; your **Flow number big, white with a dark outline, ON the crystal**; just below it on the crystal a **bank badge**: a small gold bank-building icon with the **banked number on top of it** (number larger than the icon). Beside the crystal: your Commander's name, the word **"Flow" in golden yellow**, and **"Next +N"** (crystals coming next turn). Name and Next lines in a warm pale rose (#f0cdbf). No separate Bank or Mines lines.
   - **Enemy crystal, (70%, 0%)**, slightly smaller, same design in red (Flow on the crystal, bank badge, name / Flow / Next beside it).
   - **Phase tracker, top-right (80%, 0%):** "Your turn · Turn N" (red "Enemy turn" on his turn), then **Draw › Deploy › Action › End** with the current phase lit, finished ones dimmed, and the time left below; all text right-aligned with a soft dark fade behind it on the right. The big center phase banners stay as in the design doc.
   - **Enemy hand:** card backs peeking down from the top edge at (29%, 3%), about 1.3× the current size; a small card count to its lower-left.
   - **Enemy deck:** a card pile peeking from the top edge at (34%, −3%), with the cards-left number on the pile (no label).
   - **Menu, right side (89%, 15%):** only the word "Menu" shows; on hover (tap on a phone) **Last turn, Mute, Pop-ups On/Off, Recenter** slide out, and hide again when the pointer leaves. Plain text with hover glow, no boxes.
   - **Your deck, bottom-right (93%, 83%):** a card pile (your deck picture) with the cards-left number on it, no label.
   - **Your hand, along the bottom starting 14% from the left:** cards about **23% of the screen height**, resting **nearly fully visible** at the bottom edge (this replaces the earlier "tucked, top third" idea). Hovering or tapping still pops it out: the hand rises fully and the hovered card enlarges to read it, always on-screen. The "N cards" count sits to the right of the hand, small. About 7 cards shown, swipe for more.
   - Nothing may cover either Commander or a board space a creature can stand on; nudge the camera fit if needed, never the owner's HUD positions.
5. **Playable cards glow:** every card you can play right now has a glowing golden halo; others none; updates instantly.
6. **Health hearts:** replace the current hearts (HUD and on-board markers) with a glossy painted ruby heart (image API, no text) with the number in white with a thin dark outline. The hearts painted in the owner's card frames stay.
7. **In-match controls as text:** Done, Respond, Pass, mulligan choices, pause and **match-end menus** (5a missed these) become plain gold text with a hover glow that changes color, no boxes. **"Done" appears only when needed**, floating in the center of the screen.
8. **Played-card reveals stay up 3× longer** (about 5–6 s, owner setting `revealSeconds`; Fast option about half); the game keeps going underneath; tap to pin or dismiss.
9. **Readable sizes (5a leftover):** no text in the game below about 14 px at 844 × 390; where space is short (deck builder list/chart on a phone) show fewer rows and scroll instead of shrinking text.

Tests: keep all checks passing; add: camera numbers match (51°, 48°, both Commanders fully on-screen at 16:9, 16:10, 21:9, 4:3 and 844 × 390), no black bars at any shape, HUD pieces at the owner positions (within a few %), Flow and bank numbers on both crystals, menu items hidden until hover, playable-card halo, Done hidden when not needed, no text under 14 px at phone size. Include screenshots of a match at 1920 × 1080, 2560 × 1080 (21:9) and 844 × 390, plus the menu popped out and the hand popped out.

## Round 5a (done) — menus, deck builder and lettering

The design doc was updated (deck builder layout, "cards are never stretched" rule, lettering) and is the source of truth. Keep everything from earlier rounds unless an item below replaces it. Round 5b (match screen: perspective camera, corner layout, crystal display, hearts, hand size, flow particles, longer card reveals) comes next; do not start it here. Build B (Meshy 3D models) comes later.

1. **Lettering everywhere (replaces round 4 item 5):** NO metal or texture on any letters or numbers; remove the generated metal text textures. All text is plain solid golden yellow **#FFD700** with only a thin dark outline / soft shadow for readability. One font for ALL text (names, titles, buttons, numbers, card text, menus, rules, battle pop-up words like KA-BOOM!): **Alegreya SC, Regular 400 Italic** (Google Fonts, SIL Open Font License: free, no royalties). Bundle the font files in the game (self-hosted, not loaded from Google at runtime) and list it in CREDITS.md. Only where small numbers or text fail readability on a phone, use the same font at Italic 700. Secondary text (flavor) may be a paler gold.
2. **Cards are never stretched (permanent rule):** every card everywhere keeps its exact frame proportions; art and frame are never distorted. Extra space (e.g. 8 per row on a wide window) goes between or around cards. Add a check that every displayed card keeps the card's aspect ratio.
3. **Menu buttons become text (replaces the round 3b "ornate buttons" rule for buttons on all menu screens: title, Choose Your Commander / deck picker, deck builder, settings, rules, pause and match-end menus):** no borders, frames, boxes or button shapes. Each is plain gold text over the screen's ambiance with a hover overlay: soft gold glow behind the word, text brightens and grows slightly, pointer cursor; quick press flash on click/tap. Sliders, toggles, dropdowns and scrollbars keep their ornate gold style. (In-match controls change in round 5b.)
4. **Every menu screen fills the window and scales live:** deck builder, Choose Your Commander / deck picker, title, settings, rules always fill the entire browser window edge to edge (no empty margins, no fixed-size box) and re-scale live while the window is dragged bigger or smaller. Nothing stretched (item 2). The page itself never scrolls (lists scroll inside their panels). Test at 844 × 390, 1280 × 720, 1920 × 1080 and while resizing.
5. **Deck builder layout:**
   a. The "Deck Builder" title about 3× its current size, at the top of the right-side panel.
   b. Left side: search bar, cards-per-row slider, Commander/faction pickers and other controls all left-aligned. The **cards-per-row slider goes from 2 to 8** (never 1).
   c. OREHEART logo (top middle) about 3× its current size, the dominant element at the top center, not covering controls or the right panel.
   d. Right-side panel starts at the very top edge (no gap above) and everything in it is left-aligned.
   e. **Deck carousel:** the player's decks as deck pictures (Deck_image.jpg stacks, 2× their current size) with name plates; grab with the mouse (or swipe) and drag left/right to rotate through them, snapping so the centered deck is the one being edited; small arrows and arrow keys also work. ONLY the player's own decks, NO starter decks. Always a "New deck" slot so it's never empty.
   f. The selected deck's **name** much larger (about 2–3×, bright gold, the most prominent text after the title); the count line ("62 cards (50–100)") at HALF its current size, under the name.
   g. **Auto-fill, Save, Rename, New deck** as plain clickable gold text (item 3 style), in one row; directly under them **Back** (large, clearly visible text, same style), above the deck list. Remove the old Back button; update tests that looked for it (e.g. AC123).
   h. **Deck list:** "Deck list" heading 4× its current size; list entries (card names, counts, costs) 3× their current size; each row visibly taller with comfortable padding; the cost bar chart bars taller; all numbers in the list and chart 4× their current size. The list scrolls inside its panel (gold scrollbar).
   i. **Drag and drop:** a card dragged from the grid onto the deck is shown at the size a card has at 3-per-row, whatever the slider says, for the whole drag.
   j. **Space priority:** if everything doesn't fit (smaller windows, phones), the deck list gets first claim on the height and always shows at least about 8 rows; the title, logo, carousel and name shrink together in proportion to make room.
6. **Starter decks:** in the pre-match deck picker each starter deck gets two text actions (item 3 style): **Remove** (in-game floating confirm, no browser dialog; hidden for that player; "Restore starter decks" in Settings and the deck picker brings them back; at least one deck must always remain) and **Copy to my decks** (makes an editable copy named e.g. "Goblin Warband (copy)", renameable, opens it in the deck builder centered in the carousel; the starter deck stays unchanged). Player-made decks can be removed the same way.
7. **Choose Your Commander screen:** Commander cards 2× their current size and they must STAND OUT from the background wall (today they blend in): bright rim glow / backlight behind each card, slightly dimmed and blurred background behind the card row, selected Commander glows strongest. Deck pictures 2× their current size. All text 2×. The layout itself (Commander row, deck row, text) spreads out and scales to use the full width and height (item 4), no small centered box.
8. **Spell frames (owner art, real files now):** in `factory-design/design/references/card-frames./` (the folder name ends with a dot): `spell-frame-goblin.jpg` (green) = Goblin spells, `spell-frame-gnome.jpg` (gold + blue) = Gnome spells, `spell-frame-dwarf.jpg` (purple) = Dwarf spells, `spell-frame-shared.jpg` = shared spells. Copy them into the game, replace the round 4 stand-ins, and line the cost orb (top-left) and spell-type orb (bottom-right) up exactly with the painted orbs.
9. **Round 4 report fixes:** update the outdated checks AC72 (deck picker "50 cards" → 100), AC74 (match summary 50 → 100) and AC130 (double-clicks a locked spell).

Tests: keep all checks passing (update those this round intentionally changes); add: font is Alegreya SC everywhere with no textured text, cards keep their aspect ratio, cards-per-row 2–8, starter decks absent from the deck builder carousel, Copy to my decks and Remove/Restore work, menu buttons have no borders/boxes, menu screens fill the window at several sizes. Include screenshots at 1920 × 1080 and phone size (844 × 390) of the deck builder, Choose Your Commander and one spell card per faction.

## Round 4 (done) — spells, starter decks, legible lettering

The design doc was updated (faction spells with new names, 100-card starter decks, faction personalities) and is the source of truth for rules. Keep everything from rounds 3a and 3b. Build B (Meshy 3D models) comes later; do not start it here.

1. **Mulligan screen:** cards at **double their current size**, still one straight row with no overlap and fully on-screen (on a phone shrink the gaps first, then scale to fit).
2. **Nine 100-card starter decks:** each has 50 Miners (30 of the faction's basic Miner + 20 of its Smith Miner: Scrapsmith / Arcsmith / Anvilsworn) plus 50 by style: Warband 38 Fighters / 7 spells / 5 Crystal cards; Arcane Hoard 18 Fighters / 24 spells / 8 Crystal cards; The Horde 46 Fighters / 0 spells / 4 Crystal cards. Spells are the faction's own plus the shared ones. All must be legal (deck max 100).
3. **Faction spells** (engine + content + AI + deck builder + tests): each faction has 3 spells only usable with a Commander of that faction; 3 shared spells for everyone (exact list, names and effects in the design doc's spell table). New spell **Venom Shiv** (poison: 1 damage at the start of each of the target owner's next 3 turns, can't heal meanwhile; show a green poison marker and turn counter on the creature). Renamed spells keep their internal ids. The deck builder hides or locks other factions' spells for a deck whose Commander can't use them; validation rejects them. Hex Reversal is removed from play (kept in data, disabled). Each spell gets its effect visual as described in the design doc.
4. **Spell card frames** (owner art): files in `factory-design/design/references/card-frames/` named `spell-frame-*` (green filigree with purple glow = Goblin spells; gold with blue = Gnome spells; lavender silver with purple = Dwarf spells; silver with rainbow = shared spells). If they are not there yet when you start, build the layout with close temporary copies and make swapping in the real files a one-line change. Layout: full-art spell painting inside the frame; **casting cost** as a 3D gold number in the round orb painted in the **top-left corner**; **spell type** in the round orb painted in the **bottom-right corner**: a **wand** + "SPELL" for Regular spells (own turn only) or a **lightning bolt** + "INSTANT" for Instants and counterspells; name and short text at the bottom over a soft dark fade. No Attack/Health/Movement.
5. **Legible metal lettering everywhere** (the current font is too hard to read): letter shapes from two highly legible free commercial-use fonts (record in CREDITS.md): a bold classic carved-serif for stat numbers, card names, titles and buttons, and a Times New Roman-style serif for card text, menus, rules and settings. Generate two photorealistic seamless metal textures with the image API (polished **gold** and polished **silver**, no text) and fill the letters with them, with bevel, highlight, thin dark outline and soft shadow so they read on any background. That gives four sets (gold/silver × stat/text), used for all text in the game. Small text uses a cleaner, brighter version of the metal (subtle gradient, little texture) and generous size and line spacing; full photoreal texture only on large numbers and titles. Gold is the default; silver for secondary text (flavor lines) and wherever gold would blend into a gold frame. Check contrast and minimum sizes on a phone.
6. **Fix the flawed check AC123** (its "Back" button lookup also matched card names) and confirm the welcome message and ornaments on the Deck Builder, Rules and Settings screens.

Tests: keep all checks passing; add: faction spell restriction (deck validation and casting), Venom Shiv poison over 3 turns, nine legal 100-card starter decks with 30+20 Miners, mulligan card size doubled, spell frame per faction, metal text applied (no plain fonts left). Include phone-size (844 × 390) screenshots of the mulligan screen, a spell card per faction, a creature card close-up and a menu screen.

## Round 3b (done) — visual polish

Round 3a (board and rules) is done; keep everything from it. Build B (Meshy 3D models) comes later; do not start it here. Rules are unchanged this round.

1. **Card numbers** (cost, Attack, Health, Movement): smaller so each sits fully inside its frame slot, precisely centered in the circle, shield, heart and the notch under the boot; **3D metallic gold** matching the frame gold (bevel, highlight, thin dark outline).
2. **Rarity crystal** (bottom center): a fancy faceted art crystal like the mine crystal nodes, **smaller** than now, glowing in the rarity color (Common white, Uncommon blue, Rare purple, Ultra Rare red, Collector rainbow metallic gold); the rarity word smaller and centered just below the crystal.
3. **Card names:** 3D gold in the OREHEART logo lettering style, **one uniform size** on every card (shrink only for very long names), thin dark outline.
4. **Text box:** one universal size on every card, **thinner (not bold)**, stylized gold with a thin dark outline. This replaces the earlier "card text in the frame's faction color" rule: all card text is gold now.
5. **Deck builder polish:** the deck artwork (`Deck_image.jpg`) has **no border, box or frame**, floating with only a soft glow; the background becomes a rich painted scene in the game's style (generate with the image API, no text; e.g. a dark war-room or forge cavern lit by glowing crystals).
6. **One consistent ornate control style everywhere:** every button, slider (cards per row, volume…: gold filigree track with a gem/crest handle), toggle, tab, dropdown (opens as a floating list, no box), search bar, checkbox, +/− stepper and **scrollbar** (ornate gold filigree thumb on a thin dark-gold track, never the white/grey browser scrollbar) uses the same intricate gold filigree, gem accents, glow and press animation. No default browser controls anywhere; add a check that every input is styled.
7. **Build A leftovers:** finish the gold filigree ornaments framing every screen and the title layout; fix the "Welcome to Oreheart!" text overlapping the logo and the Tutorial button; give every spell its own step-by-step visual (card pops up, turns into the effect, result lands) instead of the reused old effects; rewrite the tutorial text for all features added since Phase 1A.

8. **Update the two outdated tests from round 3a** (AC9 example (b) and AC27 summoning costs): they summon onto row 7 column 2, which is now the player's Stronghold. Move them to a free back-row space; the rule that nothing can be placed on a Stronghold space stays.

Tests: keep all checks passing. Include phone-size (844 × 390) screenshots of several cards up close (one per faction and one per rarity), the deck builder, the title screen and a spell being cast in the report.

## Round 3a (done) — board and rules

The design doc was updated (corner Strongholds, 50–100 card decks, 20 Crystal cards, nine starter decks) and is the source of truth for rules. Everything else from Build A stays. Round 3b (visual polish of cards and controls, Build A leftovers) and Build B (Meshy 3D models) come later; do not start them here.

1. **Camera: straight-on with road perspective.** Undo Build A's strong diagonal rotation. The board faces the player straight on and **fills the whole phone screen**; the grid is top-down with even squares, but with depth like looking down a road (near rows wider, far rows narrower). Keep zoom and pan.
2. **Strongholds in the corners** (rule change, engine + AI + tutorial + tests): the player's Stronghold/Commander on row 7 **column 2** (column 1 empty), the enemy's on row 1 **column 12** (column 13 empty). Mines mirror **corner-to-corner** (row 3 col c ↔ row 5 col 14 − c; row 4 col c ↔ col 14 − c; a single center-row mine is always at col 7), never next to a Stronghold. Update the computer opponent's movement and attack planning, the tutorial's fixed layout, and every test that assumed column 7.
3. **Oversized Commanders and Strongholds:** drawn noticeably larger (exaggerated) but still occupying only their one space; creatures can still stand in all spaces around them; spread spaces slightly if needed.
4. **Hands placed around the Commanders:** player's hand fan shifted **right** along the bottom, clear of the player's Commander at the bottom-left; player's deck pile at the bottom-right. Enemy card backs shifted **left** along the top, clear of the enemy Commander at the top-right; enemy deck pile at the top-left. **The enemy card backs are not visible in Build A: they must always be clearly visible** (including the lift when the AI browses). Add a check that the enemy hand is on-screen.
5. **Hand width cap:** the player's fan shows at most about 7 cards in a fixed comfortable width (never stretched across the screen); with more (e.g. 15) the player swipes / scrolls / drags through the fan, with small arrows or a fade at the ends and a card count. The enemy fan follows the same cap, smaller.
6. **Creature card pop-up size:** hovering or tapping a creature shows its card at the **same size as a hovered hand card** (about double size), fully on-screen.
7. **HUD around the corners:** the player's counters (Flow, Bank, heart, Last turn) beside/above the player's Commander without covering him; the enemy's beside theirs. Far-row tap targets slightly larger than they look.
8. **Deck size 50–100 and up to 20 Crystal cards** (owner settings `deckMin` 50, `deckMax` 100, `crystalCardLimit` 20): deck builder shows e.g. "62 cards (50–100)", validation and Auto-fill (to 50) updated.
9. **Nine starter decks** (three per faction, 50 cards, legal): Warband (40 creatures with ~8 Miners, 6 spells incl. 1 counterspell, 4 Crystal cards), Arcane Hoard (26 creatures with ~12 Miners, 16 spells incl. counterspells, 8 Crystal cards), The Horde (46 creatures with ~14 Miners, no spells, 4 Crystal cards). Named per faction ("Goblin Warband"...), shown in the deck picker as deck-image stacks with name plates; the AI picks among them. Test the AI plays all three styles to the end of a match.
10. **Fix the failing "spells play step by step" check** from Build A (Infernal Orb vs a creature with a +1 Health bonus): make the test match the real rules.

Tests: all existing checks pass (update those this round intentionally changes); add checks for Stronghold columns 2/12, corner-mirrored mines, deck size 50 and 100 legal and 49/101 illegal, 20 Crystal card limit, nine legal starter decks, enemy hand visible, hand cap. Include phone-size (844 × 390) screenshots of a match in progress (both hands visible) and the deck picker in the report.

## Round 2 (Build A, done) — owner playtest of round 1

Round 1 is built. This round reworks the cards, screens, layout and effects. **Not in this round:** new 3D creature models (the owner rated the current 3D units poor; they will be replaced in Build B with AI-made models from Meshy, including Run animations) and the deck-builder 3D viewer (Build B). Keep the current figures working; do not spend effort polishing them. The design doc (updated: short card text, 3 mulligans, Respond only when playable) is the source of truth for rules; everything else stays as in Phase 1A and round 1.

**Owner art in `factory-design/design/references/` (binding, study every file):**
- `card-frames/card-frame-goblin.jpg` (green), `card-frame-gnome.jpg` (blue, gears), `card-frame-dwarf.jpg` (purple, runes): THE creature/spell card frames. Use the images themselves (scaled, compressed), with all card content drawn on top by the game.
- `Deck_image.jpg`: THE deck image (gold OREHEART card stack). Its grey-and-white checkerboard is fake transparency painted into the JPG: cut the stack out cleanly (alpha), no checkerboard may ever show.

1. **Card layout on the owner's frames** (every non-Commander card, everywhere cards appear: hand, reveals, deck builder, mulligan, pop-ups):
   - Top-left circle: **casting cost**. Top-right shield: **Attack**. Heart under the shield: **Health**. Bottom-left boot: **Movement**, the number in the small notch under the boot. Bottom-right circle: **card type icon**, swapped per card (pickaxe Miner, sword melee Fighter, bow Ranged, bomb exploding creature, wand spell, crystal Crystal card, shield Guard, etc.; replace the pickaxe painted in the frame). Big window: the card picture. Middle bar: name. Lower box: short ability text and flavor line. Bottom-center gem: **rarity**, glowing in the rarity color with the rarity word beside it.
   - Spells and Crystal cards: hide or dim the Attack, Health and Movement slots.
   - **One uniform font on every card**; all card text colored in its frame's faction color (green, blue, purple), with a dark outline/glow for readability.
   - **Rarity colors** (gem and word): Common white, Uncommon blue, Rare purple, Ultra Rare red, Collector **rainbow metallic gold** (gold like the logo lettering with a slow moving rainbow shimmer).
2. **Short card text + tap for more:** every card gets `shortText` (short, plain, still understandable) and `longText` (full rules, keywords explained, when it can be played, what it counts as, limits, an example) in the content files. Cards show `shortText`; tapping the text on an enlarged/popped-up card shows `longText` floating over the screen. Update the old full-text acceptance check accordingly.
3. **Deck image everywhere:** every deck pile in the game uses `Deck_image.jpg`: both players' deck piles in a match (shrinking stack feel kept, e.g. by scale or a count badge), the deck builder pile, the select-screen deck stacks and any other deck icon. A deck's own name sits on a small ornate gold plate under the stack.
4. **Commander select:** the three Commanders as **borderless full-art cards** (painted portrait edge to edge, generated with the image API in the style references; Grubnak as in `menu ref image.jpg`), with a text window at the bottom showing name, title, faction and special ability. No cost, Attack, Movement or Health on Commander cards. Decks below as the deck-image stacks with name plates; difficulty and Fight! as ornate buttons.
5. **Mulligan screen:** real card images in **one straight row** (no stacking or overlap), large, no box; tap cards to mark them; up to 3 mulligans: first free, each later one 1 card fewer (5 → 5 → 4 → 3). Engine rule + tests.
6. **No boxes anywhere:** every menu, pop-up, prompt, banner and message floats over the board or scene with no panel, box or background; large enough for phones. Text uses fancy gold display lettering in the style of the OREHEART logo (with soft dark glow behind the letters for readability, never a panel). Turn and phase words ("YOUR TURN", "DEPLOY", "ACTION", "ENEMY TURN") are just these fancy words. Respond options, "Are you sure?", settings, rules, win/lose summary: all floating.
7. **Ornate polish everywhere:** gold filigree corner pieces and edge flourishes framing the screen, gem accents, glowing dividers, crests by titles, on every screen. They frame the screen edges and headings only, never as boxes behind content. **All buttons** (Play, Tutorial, Decks, Rules, Settings, Done, Fight!, Play again, Save, Auto-fill, etc.) become ornate gold filigree buttons like the PLAY button and plaques in `menu screen.jpg`: engraved gold rims, gem caps, icon plus fancy lettering, glow on hover/press, press-down animation.
8. **Title screen redo** (the current one looks poor): much closer to `menu screen.jpg` and richer: crisp full-quality logo (no blur, no box, no visible cut-out edges), the crystal heart glowing and pulsing, embers and crystal sparkles, a painted cavern background (generate it without any text) with the Goblin, Gnome and Dwarf heroes and their crystals, gentle parallax and light shimmer, filigree screen ornaments.
9. **Display mode** (title screen and Settings, remembered): Auto (default, fills the screen) / PC (wide 16:9) / Phone (locks a phone landscape ratio about 19.5:9 so a PC shows exactly what a phone shows; decorative art fills the sides, never plain black bars).
10. **Diagonal battlefield camera** (like `arena-ref1.jpg`): the board turned and tilted so the player's Stronghold and Commander are at the **bottom-left** and the enemy's in the **top-right third**, both Commanders clearly visible and large. Same grid, rules and spaces; creatures can still stand next to and surround each Stronghold. The tucked hand must not hide the player's Commander.
11. **Grouped, easy-to-read HUD:** related information together, nothing scattered: player cluster at bottom-left by the player's Commander (Flow and Bank crystals, Commander heart, Last turn button); enemy cluster at top-right by the enemy Commander (their heart, crystals, hand count); turn and phase words at top center; Done, the card pop-ups switch and re-center grouped on the right edge at mid height; each player's deck pile next to their own hand. All ornate, no boxes.
12. **Enemy hand:** the enemy's card backs fanned at the top, smaller than the player's hand and placed so they don't crowd the enemy Commander (it need not mirror exactly); their deck pile clearly visible beside it. When the computer is deciding, its card backs lift one at a time like a hovered card so the player sees it browsing.
13. **Card reveals that never slow the game:** a played card (either side) shows in the center briefly (tune it, about 1.5–2 s); the game keeps going. **Tap it to pin it** so it stays readable while play continues; tap again to dismiss.
14. **Tap a creature:** it plays its poke reaction and sound, and its full card floats up out of it to the center to read; tap the card to dismiss. With a mouse, hovering a creature (about 0.4 s, not while dragging) shows its card just above it.
15. **Card pop-ups switch:** a small ornate toggle on the match screen and in Settings, **on by default**. Off skips the big card pop-ups (played cards, ability cards, creature cards) but still plays every spell and ability animation.
16. **Visible spells and abilities, step by step** (both players): (a) the card pops up with its short text readable (unless pop-ups are off), (b) it turns into the effect: e.g. the card bursts into a fireball that arcs down onto the target, a meteor falls, a shield bubble forms, (c) the result lands with hit flash, damage numbers and a defeat poof. Counterspells and "Not Today!"-style cards: show the counter card, then the targeted card shattering or being stopped. **Nothing ever vanishes from the board without a visible cause.** Comic sound-word starbursts (style of `menu ref image.jpg`) on big hits. Keep each step short so the pace stays good; a tap skips.
17. **Exploding creatures** (Blastrat Sapper, Boomfist Lunatic and any creature whose ability explodes): visibly carry a big bomb (prop added to the current figure); on death the bomb drops, the fuse sparks briefly, then KA-BOOM with the starburst, and the damage visibly hits the adjacent creatures.
18. **Respond only when playable:** the Respond pop-up appears only if the player can actually play something right now (affordable including a Crystal card in hand, and legal). Otherwise no pop-up and no wait. Review every prompt and wait in the game: never stop or ask when there are no real options. Tests.
19. **Battlefield zoom and pan:** pinch (phone) and mouse wheel (PC) zoom between the full-board view and a close-up; two-finger drag (phone), right-/middle-button drag or drag on empty ground (PC) pans. One-finger drag on a creature or card still moves/plays as now. Double-tap empty ground or the re-center button resets. Hand, counters and buttons stay fixed while the board moves.
20. **Deck builder makeover:** a rich 3D-feeling scene instead of flat panels: cards laid out on a dark stone war table lit by glowing crystals, with depth and soft shadows, tilting slightly toward the pointer; adding a card makes it fly into the deck pile; the Oreheart logo at the top; ornate, no boxes. **Cards per row** adjustable by pinch (phone) or Ctrl+wheel / a slider (PC): 1, 2, 3, 4, 5, 6 or more, remembered. **Smart search bar** (ornate, floating) matching plain words against name, ability, keywords, faction, role, rarity and cost ("cheap goblin miners", "ranged under 4", "bombs"), plus a **microphone button** for voice search with the browser's speech recognition (hide it where unsupported). Filters as floating gold icon chips (faction, type, rarity, cost).

Tests: keep all existing checks passing (update the ones these changes intentionally replace). Add: mulligan counts (5 → 5 → 4 → 3); Respond pop-up absent when nothing is playable and present when a Crystal-card combo makes it playable; every card id has shortText and longText; card frame per faction and rarity color per rarity; deck image used for both match deck piles; pop-ups switch skips reveals but not effects; zoom/pan does not break drag-to-move. Include phone-size (844 × 390) screenshots of the title screen, select screen, mulligan, match (diagonal board) and deck builder in the report.

## Style reference (binding): `factory-design/design/oreheart-mockup.jpg`

The owner's mockup image is THE look to match. Open it and study it before building anything. Match its **style**, not its layout or rules (the layout stays landscape and exactly as built in Phase 1A; its numbers, buttons, labels, "ORE" counter, health bars, "END TURN" button and three-colored mines are illustration only, not features).

- **Rendering:** rich, detailed dark-fantasy painted look, like high-end mobile card-battle games: chunky stylized characters with heavy armor, spikes and horns, detailed sculpted surfaces, strong rim light, glowing eyes and gems. Not flat toon shading and no thick cartoon ink outlines.
- **Mood and light:** dark, moody battlefield (charred dark earth and rock) lit by the **glowing crystal mines**, which cast colored light and fog on everything around them; light beams rising from the mines; floating sparkles and embers.
- **Mines:** big clusters of glowing faceted crystals inside spiked wooden palisade fences, as in the mockup, glowing in the owner's color (white when neutral).
- **Strongholds:** dark spiked fortresses with banners, crenellations and a big glowing gem in the center, colored by faction, like the castles at the top and bottom of the mockup.
- **UI frames:** dark iron/black panels with **ornate gold trim and corner filigree**, gold serif display lettering with a soft glow (like "ENEMY TURN", "LEFT MINE", "END TURN" in the mockup). Apply this to the turn text, Done button, Flow/Bank counters, banners, pop-ups, menus and the deck builder.
- **Cards:** like the mockup's hand cards: dark ornate frame tinted with the card's faction color, a gem-shaped cost badge in the top-left corner, a full painted character picture, a gold-trimmed name plate, a dark rules-text box, and stat badges at the bottom corners. Rarity shown by trim (Common plain iron, Uncommon silver, Rare gold, Ultra Rare gold shimmer, Collector animated foil).
- **Humor stays:** the game is still witty; characters keep their funny personalities in poses, faces, reactions and animations, but rendered in this rich dark-fantasy look.
- **Originality:** match the quality and mood, but every character, castle, frame and font must be original; never copy another game's characters, logos or UI.

## More owner references: `factory-design/design/references/` (binding)

Open and study every image in this folder too. What each one decides:

- **`menu ref image.jpg`** (goblin king on a rocket barrel, KA-BOOM): this IS **Grubnak's look**: green goblin, big pointed ears, furious shouting face, gold crown with purple gems, fur-trimmed tattered purple cape, gold chain with a purple gem, purple-and-gold armor. It IS his **retreat scene** (rocket barrel with a gold skull emblem and flame trail, Stronghold crumbling). It also sets the **comic sound-word style** for all effects: big chunky yellow/white lettering with thick dark outline inside a red/orange starburst with halftone dots and speed lines (KA-BOOM!, WHAM!, KRAK!, ZZAP!).
- **`arena-ref1.jpg`** (landscape battle scene): sets the **look of the creatures** (chunky, detailed stylized minis standing on glowing colored rings, Goblins, Gnomes and Dwarves as shown), the **Commander leaning out of a stone-and-gold Stronghold** (waist-up, pointing, with banners) and the big **heart Health badge**, the **stat badges above creatures** (small dark badges with sword, heart and boot icons), **crystals on glowing rings**, and the hand-card and deck-pile look. Ignore its sunny grass (the board is **dark and moody**), its layout (ours stays as built), its numbers and labels, and do **not** copy its card-back swirl emblem (design an original Oreheart card back).
- **`card-ref2.jpg`** (Goblin card): this IS **the card design** for every card: hexagon cost gem top-left in the faction color; name in white serif capitals with a short gold tagline under it; rarity diamond with the rarity word top-right; large painted picture in a rounded frame; a keyword bar with the role/ability icon in a circle; dark rules-text box; an italic flavor line in faction color under a gold divider; Attack in a red gem with a sword at the bottom-left; Health in a blue shield with a heart at the bottom-right (add a small boot badge for Movement where it fits); ornate silver filigree frame with faction-color vines and gem accents. Its name and text are illustration only; every card shows its own real data from the content files. Add short taglines and flavor lines in the game's witty tone for every card in the content files.
- **`main logo.jpg`:** this IS **the Oreheart logo** (gold OREHEART lettering under a glowing crystal heart, Goblin, Gnome and Dwarf silhouettes, ornate gold frame). Use it on the main menu, the loading screen and as the app icon source; cut it cleanly from its dark background (or rebuild it as layered art that looks the same).
- **`menu screen.jpg`:** this IS **the main menu**: logo at the top, the tagline "Goblins, Gnomes and Dwarves fight over the Soul Crystals.", a big glowing gold **PLAY** button, then **Tutorial, Decks, Rules, Settings** as dark plaques with gold trim and small icons, over a dark cavern scene with a Goblin and green crystals on the left, a Gnome and blue crystals in the middle, and a Dwarf and white crystals on the right. Build it in landscape like the picture; the background may be a painted image (generate it with the image API, no text in it) with the buttons as real HTML on top, keeping their accessible names.

## Round 1 (done): style test — Goblins, board, mines, Strongholds

Build ONLY the following to finished quality so the owner can approve the look before the rest is made. Gnome and Dwarf creatures keep their current placeholders in this round (do not break them).

1. **Art pipeline in code** (reused by every later round):
   - Materials and lighting that match the style reference: stylized PBR or hand-painted textures, strong rim light, colored light and soft fog from the glowing mines, glowing eyes and gems, bloom on glows (turned off on Low graphics), soft contact shadows. No thick cartoon outlines.
   - A shared **Goblin body rig** (skinny, hunched, long arms, huge ears, big grin with pointy teeth, big hands, small legs) with swappable heads, armor, weapons and colors, so each Goblin card gets a distinct figure. Models may start from free, commercial-use **CC0** packs (record every source and license in `projects/oreheart-8/CREDITS.md`) and be reshaped, recolored and accessorized in code, or be built procedurally. No model, texture or font may copy another game's characters, logos or style.
   - Animations for every creature: idle, walk, melee or ranged attack, hit (flinch + red flash), defeat (comic poof with stars, helmet bounce, no blood), mining (pick swing + gem sparks), summon (rise out of the card with a dust puff), and 3 Goblin poke reactions (cackle, rude dance, angry stomp).
2. **All Goblin cards as 3D figures** (every Goblin creature in the design-doc tables, including Miners, Smith Miners, the Crystal Eater and the Collector), each with its own look and the weapon rules from the design doc ("Weapons show the type"). Materials: scrap metal, rusty nails, patched leather, bottle caps, bones; toxic-green accents. Rare and better are slightly bigger; Ultra Rare and Collector noticeably bigger with a soft glow. Upgrades add gold pips and shinier armor.
3. **Grubnak Rotgut, King of the Junkpile** (waist-up in his Stronghold), exactly as in the Grubnak reference picture. Reactions: belly-laugh and throne pound on a hit, sulk and kick a crate when a creature dies, fastball spell throws, flinch and fist-shake when hit. Retreat: the rocket-barrel scene from the reference, with the KA-BOOM starburst.
4. **All three Strongholds**, built like the Strongholds in `arena-ref1.jpg` and the mockup (dark stacked stone with gold trim, spikes, faction banners, a glowing gem), each with its own faction flavor (Goblin: spiked, crooked, patched with scrap, green banners; Gnome: brass gears, telescopes and blue-crackling coils on top; Dwarf: carved runes, heavy iron doors, purple braziers). The Health heart stays mounted on the wall facing the player and shows more cracks as Health drops. Sproingle and Borgo keep simple placeholder figures this round.
5. **Battlefield:** dark, moody charred earth and rock like the style reference, with cracks glowing faintly with ore, scattered stones, spiked palisade fences, mine carts and broken rails around the border (never over a playable space). The glowing mines are the main light sources. Creatures must still stand out clearly (rim light). Grid stays invisible.
6. **Mines:** big glowing faceted crystal clusters inside spiked wooden palisade fences (as in the style reference), owner-colored (white when neutral), light rays, slow sparkles, burst-and-regrow on owner change; mined crystals stream as motes to the Flow counter. The revision 9 swinging pickaxe becomes a proper metal-and-wood model with a spark per strike.
7. **Main menu and logo** exactly as in `menu screen.jpg` and `main logo.jpg` (see references), including the restyled menu buttons; the other screens (select, deck builder, rules, settings) get the same dark-iron-and-gold frames.
8. **Card pictures for the Goblin cards** via the AI image pipeline below, plus the **card design from the Goblin card reference** (used for every card in the game, with each faction's colors; Gnome and Dwarf cards keep their old pictures this round but get the new frame), rarity trims, and the shared **card back** (dark iron with gold filigree and a glowing ore-heart). Also restyle the turn text, Done button, Flow/Bank counters and pop-ups with the dark-iron-and-gold UI frames. Text, cost and stats are always drawn by the game on top of the picture, never baked into it.
9. **Sound effects (whole game, all factions):** card draw, card play, summon whoosh, footsteps per faction, melee hits, ranged shots, pick strikes and gem chimes, counter ticks, each spell, shield bubble, glass shatter, Stronghold hit, KA-BOOM, button clicks, countdown ticks, victory and defeat stings (short sound stings, not music). Gibberish voice grunts/cackles for Goblins and Grubnak. Sources: CC0 libraries (record in CREDITS.md) and/or sounds synthesized in code. Settings: separate volume sliders for Sound effects and Voices, plus a mute button on the match screen; audio starts after the first tap. **No music this phase.**
10. **Performance:** total download under about 40 MB; 60 fps on a mid-range Android phone in Chrome, 30 fps on old phones. The Low graphics setting turns off particles, shadows and outlines on distant objects. Keep textures compressed and models low-poly.

## AI image pipeline (card pictures)

- The build environment has the secret `OPENAI_API_KEY` (owner's ChatGPT / OpenAI key; Grok/xAI is no longer used). Use OpenAI's current image-generation model through OpenAI's official Images API (`https://api.openai.com/v1/images/generations`; as of Oct 2026 the model is `gpt-image-2` — check OpenAI's docs for the current model name and supported sizes, and crop/resize to the card picture shape if needed). Owner-supplied art in `factory-design/` ALWAYS wins: only generate pictures for cards that have no owner art. Never print, log or commit the key.
- Add `projects/oreheart-8/tools/gen-card-art.mjs` and a data file `src/content/card-art.json` with one entry per card: `{ cardId, prompt, file, seed? }`. The script generates only entries whose image file is missing (or whose prompt changed, tracked by a hash), saves compressed WebP images (about 512 × 512) into `public/art/cards/`, and the images are **committed** so later builds don't regenerate them. If the key is missing or the API fails, fall back to a dramatic render of the card's 3D figure, and say so in the report.
- Prompt style for every picture: "dark fantasy trading card game character art, richly painted, stylized chunky proportions, dramatic rim lighting, glowing eyes and gems, moody [faction color] glow, [faction look], [the creature in action, holding its weapon, with a hint of humor in its pose or expression], dark atmospheric background, no text, no letters, no logos, no watermark, original character". If the image API accepts a reference image, pass the style reference mockup to guide the style. The picture must match the 3D figure (same colors, weapon, silhouette).
- Never ask for, or name, characters, artists or styles from other games or companies.
- Budget: generate each picture once; at most 2 retries per card if the result has text, extra limbs or the wrong faction look.

## Later rounds (not now; listed so the code is built ready for them)

Build B (next): AI-made 3D models via Meshy (`MESHY_API_KEY`): image-to-3D, auto-rig, animations (idle, walk, run, mine, attack, hit, defeat, special ability, emotes) for every creature and Commander, replacing the current figures; plus the deck-builder 3D viewer (spin, zoom, buttons to play every animation). The older round plan below is superseded where it conflicts.


Round 2: Gnome and Dwarf figures, Sproingle and Borgo finished, their card frames and pictures. Round 3: spell effects, hit "WHAM!/KRAK!/ZZAP!" starbursts in the Grubnak-reference style (the KA-BOOM for Grubnak's retreat is in round 1), banners, menus as a living scene, 3D Flow/Bank crystals, iron Done button. Music comes in a later phase.

## Tests

Keep all existing checks passing (test mode, `window.oreheart` hooks and accessible HTML elements unchanged). Add: every Goblin card id has a 3D figure and a card picture file; `CREDITS.md` exists and lists every outside asset; the game loads with sound muted until the first tap; the Low graphics setting reduces draw calls; total `dist` size stays under 40 MB. Include match-screen screenshots at phone size (844 × 390) in the report so the owner's reviewer can see the new look.

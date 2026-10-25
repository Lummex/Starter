# Round 22: failing checks, Bowler Brawler special moves, Crystal Node effects

Read "Round 22" at the top of SPEC.md. Keep everything from 8a–21 and the owner's "Owner: …" commits. **Do not touch** the Crystal Node tint/colors, the unit stat badge (incl. type-icon slot), ability icons above units, or status icons (owner is editing them). dist < 95 MB; never re-mesh/decimate models or touch UVs. Commit + push after each step.

Checks changed by the planner (newer owner decisions / owner cards.json win): AC98, AC116, AC250 (right-click opens a unit's card), AC218 (card returns to its rest spot, hand lowers on leaving the fan), AC272 (only the enlarged card may pass the home row; closer fan), AC13 (ranges from cards.json: Grudge Hurler 5, Skullflinger 6), AC155 (Grubnak discount), AC89 (unit was on row 0). Builders: fix the game for the rest; if you must change a check, write which and why here.

## Rules & cards
- Card Comp vs Card Comp must finish a match with no input; watch bar + Rematch (AC344). `src/engine/`, AI files.
- Mine Control stance: Miner attacks an adjacent enemy Miner only if it survives, else mines when low (AC341).
- `mineAt` / mine tap mines with every ready Miner next to the mine (AC58).
- Smith Miner dropped on own creature upgrades at once (AC46); opponent summon squares around the corner Stronghold (1,12): (1,13) legal, (1,12) not (AC109).
- Test hooks: `getDragCard()`, `setGraphics()`, Bowler `ball` fields, `mineModels[i].effects` (AC358, AC359–AC362). `src/main`/test-mode API.

## 3D & visuals
- Bowler Brawler: `bowl` (attack + Strike), `spinBall` (idle, triggered by `advanceIdle(20)`), `basketShot` (on summon, lands dead); ball never clips body/ground, returns to hand; owner green Flame on the ball; existing rig, Meshy anim library or hand-keyed bones (AC359–AC361). `src/ui/creature3d.ts`, `public/models/creatures/goblin-scrapper/`.
- Crystal Node: 9 effects from `factory-design/looks/crystal-node.json` (copy to `public/models/mines/crystal-node-look.json`), colored by owner faction (green/purple/blue/white), Low = main Glow only, light enough for 3 mines (AC362). `src/ui/scene.ts`.
- Goblin models: own walk/attack/hit/defeat clips in `creatureAnimLog`; char.glb fetched once for 4 copies (AC353, AC355).
- Low graphics: bloom/shadows/particles off, fewer draw calls (AC89); cover-fit no black bars (AC190); Commander look-back + impatience (AC196, AC197); Square highlight settings applied in match (AC260).
- Keep dist < 95 MB (AC90): only shrink small prop textures; never touch geometry/UVs.

## Interface
- Controls: left-click own unit selects + lights squares, click lit square acts; right-click opens card + ability menu (no browser menu); enemy right-click/tap shows card (AC98, AC116, AC250, AC357).
- Hand: closer overlap; click card → close-up with "Play this card"/"Cast this spell" → pick-up mode; hand lowers when pointer leaves fan (even onto the enlarged card); drag card hangs below-left, tilted (AC218, AC250, AC272, AC358).
- `data-playable`/halo correct with Grubnak discount (AC155); owner card back + `deck-menu`/`deck-pile` images (AC176); cards never stretched (AC136).
- Menus in owner boxes (Deck Builder Back, AC233); owner text styles: bold/italic per layout, enemy-deck-count italic, Play weight (AC168, AC326); Change Commander/hover grow (AC206).

## Other
- AC134 phone screenshots time out on page load (15 s): check the initial load size/blocking assets.
- Report: pass count, 1920×1080 screenshot of three differently colored mines with effects, Bowler Brawler move sequence.

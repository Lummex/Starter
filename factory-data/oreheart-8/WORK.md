# Round 15 work items

First run the full checks once to see which Round 14 items really fail (Round 14's run was stopped; last full result is Round 13: 328/409). Fix those before the new items. Commit + push after each step.

## Rules & cards
- Test hooks: `/?test=1` must always define `window.oreheart` with every hook (main.ts already gates on `test=1`; find why ~100 checks still could not reach the hooks — e.g. a hook throwing, `newMatch` rejecting, or the app not booting). AC5 and most engine checks. `src/main.ts`, `src/game.ts`.
- Facing (R15.1): `facing` per creature (`N`…`NW`, N = toward row 1), set on summon (player N / opponent S), move (last step), attack/ability (toward target), mine (toward mine); never reset; not changed by pushes; saved with the state; AI units too. AC333, AC334. `src/engine/engine.ts`.
- Bowler Brawler Strike (R15.2): ball along the chosen orthogonal line until board edge / mine / Stronghold; every creature on the path knocked 1–2 squares sideways (seeded RNG side and distance), other side if blocked, stop after 1 if the 2nd is blocked, stay if both blocked; cost 2; AI uses it. Update `goblin-scrapper` text/shortText/longText to the owner text. AC293, AC320. `src/engine/engine.ts`, `src/content/cards.json`, `src/ai/*`.
- Round 14 carry-over (verify, fix if failing): Corpsman Brewlord `brew` + Drunk (AC331, AC332); Rocket Rider is a Fighter (AC296); `flowShardCount` / `getFlowStreams` (AC329, AC330, AC222); Dwarf starter decks (AC6, AC112/AC128); `getCard` `range`/`artPos`, `getAbilityStatus`, `cardFormat` (AC284, AC286, AC309, AC310, AC313).
- Round 12c/13 leftovers if still failing: abilities AC289–AC307; Ranged lines AC13, AC248, AC266; Venom Shiv AC131; AC10, AC15, AC16, AC18, AC109, AC155, AC254.

## 3D & visuals
- Facing on the 3D figures: rotate each figure to its stored `facing` (smooth ~200 ms) and hold it; no snapping back to the player's side; miners turn to the node while mining (R15.1). AC333, AC334, AC337. `src/ui/creature3d.ts`, `src/ui/scene.ts`.
- Bowling ball effect: big stone/wood/rusty ball rolling and spinning with dust along the path; hit creatures tumble sideways like pins (R15.2). AC337. `src/ui/scene.ts`, `src/ui/arena-fx.ts`.
- Round 14 carry-over: shards end at the HUD Flow crystals, crystal pulse, shard count from Flow (AC329, AC330, AC222); Drunk 🍺 icon (AC331); unit ring faction colors (AC261).

## Interface
- All text outside cards white `rgb(255,255,255)` everywhere (title, menus, Settings panels, Deck Builder, Choose Your Commander, match HUD incl. layout text, tooltips, dialogs, ability labels); override layout/theme text colors, keep shadows/glows; card faces untouched (R15.3). AC167, AC135, AC137, AC326. `src/style.css`, `src/ui/owner-hud.ts`, `src/ui/menus.ts`, `src/ui/decks.ts`, `src/ui/app.ts`.
- Unit stat badge (R15.4): copy `factory-design/unit-badges/` to `public/art/ui/badges/`; `[data-unit-badge]` inside each creature label with `data-metal`, `data-type`, frame + type icon `<img>`s, live `[data-stat=attack|health|movement]` numbers (Russo One, white, outline) placed per `badges.json`; under the feet, readable at every zoom; replaces the old stat icons. AC335, AC336, AC30. `src/ui/app.ts` (creature labels), `src/style.css`.
- Round 14 carry-over: owner layout boxes/sizes (AC212, AC326); fanned player and enemy hands (AC327, AC328, AC164, AC174, AC175, AC218); Brewlord button and ability buttons (AC318–AC320, AC325, AC332); spell faces/artPos (AC311, AC316, AC317); Deck Builder portraits and top bar (AC321, AC322, AC60, AC209, AC239); title card stack (AC323); Choose Your Commander Fight! (AC324, AC258); Square highlights panel path (AC260).

## Other
- `dist/` must stay under 40 MB (was 60 MB): compress/convert large PNGs, drop unused assets; badge WebPs are small. AC90.
- Report: 1920×1080 screenshot sequences from the brief (AC337 attaches them) and the checks pass count.

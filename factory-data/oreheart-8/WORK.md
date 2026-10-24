# Round 16 work items — finish Round 15, fix the 70 failing checks (no new features)

Start from `test-results.md` (error messages per check). Fix the game, not the check. Commit + push after each step (R16.1 → R16.5). Checks already changed by the planner (they contradicted newer rounds or were broken): **AC238** (deck name white + Goblin-green glow, Round 15), **AC310** (accepts `layouts` as list or object), **AC326** (14 px phone minimum from AC158 wins). If another check really contradicts a newer round, update it and add a line here saying which and why.

## Rules & cards
- Test hooks: make sure every hook exists in `/?test=1` on every page, incl. `getHighlightSettings` (AC260 hit `undefined`) and `getFlowStreams()` always returning `{ active: [], log: [] }` arrays (AC222, AC249, AC329). `src/main.ts`, `src/game.ts`.
- Facing kept after move/attack/mine, one turn later too; exposed as `facing` + `data-facing` (AC333, AC334). `src/engine/engine.ts`.
- Bowler Brawler `strike`: ball along the orthogonal line, every creature on the path knocked 1–2 sideways (seeded), other side if blocked; cost 2 (AC293, AC320). `src/engine/engine.ts`, `src/content/cards.json`.
- Ranged 7 in 8 straight lines, stops at first unit (AC13 `can(axe,5,1)` false, AC266 `can(7,5→7,12)` false).
- Rules leftovers, per error message: AC15 (Shield attack rejected), AC18 (Respond window opened when nothing usable), AC58 (`mineAt` must mine every ready Miner next to the mine), AC109 (opponent Fighter summon squares must include (1,13)), AC254 (AI Tunnel summon at (3,4)), AC324 (Knobbin/Borgo pickable).
- Card abilities failing their checks: AC289 SewerSlide `run`, AC290 Scrapsmith death draw, AC292 Backstabbing Thief steal, AC294 Junk Shaman `pickUp`, AC295 Goblin Chef knock 2, AC296 Rocket Rider `rocketRide`, AC299 Glyphshield `ward`, AC300 Gnome `plow`, AC304 Gemdrunk +1 Attack per bank, AC305 Ram Rider `gallop`, AC307 Motherlode discount, AC309 `getAbilityStatus` all `done`, AC331/AC332 Brewlord `brew` + lethal save. `src/engine/engine.ts`, `src/content/cards.json`, `src/ai/*`.

## 3D & visuals
- Figures rotate to stored `facing` and hold it; miners face the node (AC333, AC334).
- Bowling ball roll + sideways pin tumble effect (AC293 screenshots).
- Crystal Flow shards from mines to `player-flow-crystal` / `enemy-flow-crystal`, count from `flowShardCount` (AC222, AC249, AC329, AC330).
- Unit rings: enemy Dwarf ring `#2f5fd8`, greyed after acting (AC261).
- Cover-fit with no black bars at 16:9, 4:3, 21:9, phone; pan keys/WASD/drag clamped and fast enough to finish in time; drags of hand cards/units never pan (AC150, AC190, AC191, AC194). `src/ui/scene.ts`.

## Interface
- All non-card text `rgb(255,255,255)`; HUD bold/italic/size per owner layout (`player-next-flow` bold mismatch) (AC167, AC168, AC326).
- Unit badge `data-type` = `sword` / `pickaxe` / `bow` (currently `fighter`), frame/icon imgs, live numbers (AC335).
- Hand: even fan fully on screen at 1920×1080, 1568×782, 1366×768; hover → `data-fan-angle` 0, 1.6× pop, neighbors move aside ≥ 2 px, one card at a time, no stuck cards; playable glow updates at once; drag up plays, sideways reorders, drop in hand/illegal plays nothing (AC155, AC174, AC218, AC264, AC269, AC270, AC272, AC327). `src/ui/hand.ts`, `src/ui/app.ts`.
- Ability buttons `[data-ability][data-creature-uid]` above units, greyed states, hover tooltip with cost (AC318, AC319, AC320, AC325, AC332).
- Deck Builder: deck list ~8 rows scrolling inside its panel (AC143); `All cards` grid reachable by label for double-click (AC204); close-up 3D viewer (AC209); deck entry green glow (AC238); top bar no overlap at 844×390 (AC322).
- Card faces drawn by the card format in hand and builder, no dark boxes on spells (AC311, AC316).
- Title gate: no `Oreheart` logo image, fanned card-back deck under "Click to begin" (AC323).
- Choose Your Commander: "Commander card" buttons and Fight! reachable; Tense Cycle → First Fight on match start (AC258, AC324).
- Settings Square highlights / Unit rings panels (AC260, AC261).
- Phone screenshot flows render without errors (AC134).

## Other
- Ship owner files byte-identical (e.g. `goblin-miner-card-art.png`) and the owner menus/pictures/sound (AC232, AC273); keep `dist/` under 40 MB (AC90).
- Report: pass count + the 1920×1080 screenshots listed in the brief.

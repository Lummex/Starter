# Round 21: goblin 3D models in matches

Read "Round 21" at the top of SPEC.md. ONLY the 3D goblins this round: no rule, menu, pop-up, mine, badge or old-check changes. Never revert the owner's direct "Owner: …" commits. **Do NOT run Meshy.** New checks: AC350–AC356. Old failing checks are not part of this round (owner's instruction).

## 3D & visuals
- Copy the 12 folders from `factory-design/models/<id>/` to `public/models/creatures/<id>/` (char.glb, item GLBs, models.json); meshopt-compress (gltfpack / gltf-transform, textures ≤ 1024) so each file ≤ 4 MB, folder ≤ 6 MB; keep `shiv-rat` and `goblin-smith-miner` as they are; add to CREDITS.md (AC350).
- Add all 12 to the `PARTS` list in `src/ui/creature3d.ts` (all 16 goblins in 3D, player and enemy) (AC351).
- Apply the owner looks `factory-design/looks/{goblin-scrapper,goblin-bomber,goblin-pebbler,goblin-sneak,rotgut-grenadier}.json` exactly (bone, local position/rotation/scale, height + stretch; skip "Solid part"); update `goblin-pebbler`'s club; other goblins: weapon right hand, packs/bombs on back, wolf as mount, shield left arm (AC352).
- Clips from each `models.json` `actions` (idle, walk, attack, hit, defeat, mine); play defeat before removal (AC353). `src/ui/creature3d.ts`, `src/ui/scene.ts`.
- Token fallback when a model/item fails to load, no page errors (AC354); load + parse each GLB once, clone per unit (AC355).
- Test hooks in `getRenderStats()` (`src/ui/scene.ts` ~line 1143): every figure gets `row`, `col`, `source`, `height`, `animations`, `currentAnimation`, `animationLog`, `items [{name, bone, matchesLook}]`, `screenBox`; add `creatureAnimLog [{uid, cardId, anim}]` that keeps defeated units (AC351–AC356). Keep the fields AC276/AC277 already read.

## Other
- Report: 1920×1080 screenshots from AC356 (goblins on the board; close views of Bowler Brawler, Backstabbing Thief, Goblin Chef) and the pass count.

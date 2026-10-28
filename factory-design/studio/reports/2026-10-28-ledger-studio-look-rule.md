# Ledger – "Ken's Studio setup is the look" + heights for Round 27 (Oct 28, 2026)

Job from Forge (Ken, Oct 28): the game must match Ken's Oreheart Studio setups for accessories, positions, scale **and height**. Heights now matter (replaces the earlier "heights are only a note" rule).

## Done
1. **Standing rule** added to `factory-design/studio/HANDBOOK.md` → section "Ken's Studio setup is the look". **Gauge's checklist** (`agents/gauge-checklist.md`) row 1.5 is now "Height matches Ken's Studio setup" (**Must**), replacing "heights are only a note"; row 2.5 now says "same placement as Ken's Studio setup"; the verdict line no longer says heights never block.
2. **Heights for Round 27**: every character with a saved Studio setup (47; read from Studio `library/<card>.setup` at 18:10 UTC) measured and added to the Round 27 export:
   - `factory-design/design/models/editor-setups-2026-10-28b.json` → new `heightsForGame` (per card: Studio body scale, stretch, Studio standing height, game height today, idle clip, **`LOOKS` {height, stretch}**, mount data, hover, notes). Each of the 18 cards' old `height.note` now says heights are binding.
   - `editor-setups-2026-10-28b.md` → new section "Heights from Ken's Studio setups": table, **paste-ready `LOOKS` (42 entries)**, special cases.
   - `factory-design/design/oreheart-round-27-brief.md` → new **section H** (steps + AC408–AC413); order line now includes H; A step 6 and B step 2 changed to use the Studio heights.
3. **Clay's rigged remakes** (Anvilsworn Miner `dwarf-smith-miner`, Thane Borgo `cmd-borgo`): the GLBs are on main (`factory-design/design/models/anvilsworn-miner-rig-oct28.glb`, `borgo-rig-oct28.glb`, Clay's note `rigged-remakes-oct28.md`, commit c5d507d) but **waiting for Ken's approval** and **not in the Studio yet** (Wright bundles them after Ken's OK). Also **neither card has a saved Studio setup** (`library/<card>.setup` empty, nothing in `modelSetups`) — so there are no Ken placements/height to move. Nothing done on them; see "What's left".

## How the height numbers were made (checked)
- Studio: 1 unit = 1 board square; body item scale × stretch multiplies the raw GLB. Game: 1 square = 1 world unit; `makeCreature3d` normalises the body on its **idle clip at t=0** and scales it to `LOOKS.height`. So **`LOOKS.height = Studio body scale × idle-0 height of the model`** → identical body size to the Studio.
- Downloaded all 50 Studio body/mount GLBs (Artifact files) and compared git hashes with factory/issue-8: 39 bodies identical, Gyronaut = same geometry (shrunk textures), 4 older game bodies (SewerSlide Bomber, Scrapsmith Miner, Troll, Rocket Rider) measured on the game file.
- Measured with my own meshopt + skinning code in the cloud box and again in Chrome with **three.js 0.170** (the game's version) using the game's own `skinBox` → same numbers to 4 decimals (dwarf-miner 1.0576, steam golem 1.7745, grunt 1.0041, shiv-rat 0.9094, beetle 1.4712, gunner 1.0453). Studio sizes also match the Studio's own "squares tall" note (e.g. Grudge Hurler 1.00 tall / 1.06 wide).
- Accessories: re-checked every placement in both export files (Round 26 and 27) against tonight's Studio data: **all identical**. Ken's 17:36–17:46 UTC re-saves changed body sizes only.

## Things Ken should know
- Studio sizes are much smaller than today's game for goblins (0.41–0.53 vs ~1.1) and gnomes (0.25–0.45 vs 0.85). Dwarves are all 1.0 (saved this morning, before the evening resizing) → dwarves would be ~2× goblin height. **Asked Ken: `decisions/dwarf-heights`** (Studio "Waiting for you"). The brief says: if he answers "resize", dwarves stay as they are in Round 27.
- Gemsinger/Arcsmith Miner (`gnome-smith-miner`): the saved setup uses a different model (static Gemsinger held in the hand of the animated one) → no usable height; Ken should re-save it.
- Gnome Plow (`phase-stalker`) rides a plow in the Studio; the plow isn't in the game (needs its own job). Mangewolf Rider: game files differ from the Studio's → not in Round 27.
- Floating in the Studio: Gearward Sentinel feet 0.38 above the floor, Rocket Rider 0.62; Gyronaut hover is off in the Studio but on in the game. Not changed – Ken's call.
- The Studio library name for `grubnaks-big-boss-troll` uses a real person's surname — may break the "original names only" rule (I wrote "Troll Tyrant" in my export). Not changed in the Studio.

## What's left (Clay's remakes)
1. Ken approves the two rigged models (Studio "Waiting for you"), then Wright bundles them in the Studio Model Editor.
2. There is **no saved Studio setup** for `dwarf-smith-miner` or `cmd-borgo`. Ledger then attaches their existing accessories on the new rigs (Miner: `stonebreaker-pickaxe`, `stonebreaker-hammer`; Borgo: `borgo-sceptre`, `borgo-throne`) to match the card art, checks each by eye, saves it only as a **proposal** in `modelSetups` and asks Ken to place/approve it and set the height (his Studio setup is the look; nothing guessed).
3. After Ken saves the look: add both to the Round 27 export (`heightsForGame` + accessories). Size: Clay notes +5.0 MB for both → about 97.4 MB, over 95 MB; Ken must decide first.

## Files changed (main)
- factory-design/studio/HANDBOOK.md
- factory-design/studio/agents/gauge-checklist.md
- factory-design/studio/agents/ledger.md (notes)
- factory-design/design/models/editor-setups-2026-10-28b.json, .md
- factory-design/design/oreheart-round-27-brief.md
- this report

Studio: new decision `decisions/dwarf-heights` (open). Nothing put live, no round started, nothing deleted.

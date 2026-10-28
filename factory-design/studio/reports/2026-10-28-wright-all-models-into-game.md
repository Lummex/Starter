# All 3D models into the game: job for Ledger + Anvil (from Ken, via Wright, Oct 28)

Ken told Wright directly (Oct 28, ~17:50 UTC): "I've made the changes to the sizes. I want to get all the 3D models into the game."
Ken's answers when Wright asked:
- **Preview first.** Build a preview with everything; Ken checks it and then OKs it for the real game (oreheart.cards). Nothing goes live without his OK.
- **"All" = every model in the Studio**, using his saved size and setup from the Model Editor room.

Wright doesn't build the game. This is Ledger's work (export) and then Anvil's (Round 27). Below is what Wright found in the Studio `library` (read 17:50 UTC).

## Where things stand
- The Round 27 draft (Anvil) already covers 22 cards from Ledger's two exports (`editor-setups-2026-10-28.json` + `-28b.json`). Those 22 are **unchanged** since export: axe-thrower, barrelback-courier, brewmaster, cmd-grubnak, crystal-drunk-delver, deepforge-crossbowman, dwarf-miner, dwarf-pickman, dwarf-stoneback, gnome-tinker, goblin-bomber, goblin-scrapper, goblin-slinger, goblin-sneak, grimhold-ravager, ironhammer-berserker, oathbound-pikeman, queen-brunhilda-stonebeard, ram-rider, rotgut-grenadier, rune-splitter, shieldbeard.
- **Ken changed these 6 after Ledger exported them** (setups saved 17:36–17:45 UTC today), so the export is stale for them: goblin-grunt, goblin-pebbler, gyrocopter-ace, junk-shaman, shiv-rat, skullbasher-rusher.
- **20 setups were never exported:** blastrat-sapper, clockwork-beetle, crystal-node (board piece), gearward-sentinel, glyphshield-warden, gnome-cogger, gnome-illusionist, gnome-prospector, gnome-smith-miner, gnome-widget, goblin-scrounger, goblin-smith-miner, grubnaks-big-boss-troll, hexwright-apprentice, phase-stalker, runic-siphoner, shard-guzzler, spark-gnome, the-great-steam-golem, wolf-rider.
- No Studio setup yet: dwarf-smith-miner (Stonebreaker, not rigged; waiting on Spring), cmd-borgo, cmd-sproingle. They stay as they are now.

## Steps
1. **Ledger:** export the 26 cards above (6 changed + 20 new) the same way as `-28b` → `editor-setups-2026-10-28c.json` + `.md` + any new part GLBs (textures only shrunk, 256 px). Measure the new game size (tree of factory/issue-8 + new parts − shrunk bodies). Mark steps.editors "exported for Round 27".
2. **Anvil:** add section A2 "the other 26 looks" to `oreheart-round-27-brief.md` (pointing at the `-28c` files); keep C first. Preview only.
3. **Size:** the game is 93.6 MB now (public/ on factory/issue-8, measured 17:55 UTC). Round 27 only fits under 95 MB if the gnome bodies shrink too (Anvil/Ledger: ~92.4 MB before the new 26). If the new parts push it over 95 MB, shrink textures only, and ask Ken before going over 100 MB.
4. **Ken starts the round himself** (adding the `factory:revise` label is blocked for agents). After the preview: Ken checks the models on the board; Gauge checks; then live only with Ken's OK.
5. Every editor must match what goes in the game (Studio Model Editor room gets the same shrunk bodies: Wright).

## Asked Ken in the Studio (Waiting for you)
- `decisions/gnome-shrink`: OK to shrink the gnome body pictures (1024 → 512 px, shape unchanged) so all models fit under 95 MB?

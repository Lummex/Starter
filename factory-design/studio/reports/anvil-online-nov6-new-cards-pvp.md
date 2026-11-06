# Anvil-online report, Nov 6 (late): the 33 new cards into PvP, and Commander copies to fight as

Ken: "bring the cards into the PvP. Also, make sure that I can upgrade the commanders. With the cards."

**Preview (pvp-nov2 9f54fcd2):** https://oreheart-8-2aauvbfbk-lummex.vercel.app
**Branch:** pvp-nov2 head 2f9e7429 (9f54fcd2 = the merge + the work; 2f9e7429 = one SQL-check fix). Nothing live. TEST database only.
**TEST deploy:** run #36 (42294167908) failed on one SQL check (the cheap-Miner pool expected five Miners; Stonebreaker Miner makes six); run #37 (42309695122) is the re-run after the fix (result in the hand-off / Forge's chat).

## What was done
1. **Merge of factory/issue-8 (92df3590) into pvp-nov2.** Four files conflicted (acceptance spec, engine.ts, app.ts, scene.ts); every conflict was "both sides added a field", so both were kept: per-copy card tiers (pvp) + tokens/spawnToken/Poison/Jinx flags (issue-8); the test hooks + setCommanderTier (scene); the ruby mirror look + the Commander aura. The merge brings the 33 new cards, 3 tokens, the engine features, Brush's art, Clay's models, props and Tripo mounts, the spell effects and sounds, and the Commander tier models and auras. The match function bundle is rebuilt from the same engine at deploy, so the server enforces the same rules.
2. **TEST catalog (20261106000006_new_cards_nov6.sql):** the 33 new cards join `public.cards` at their rarities and in the pack pool (generated from cards.json by `supabase/scripts/make-cards-sql.mjs`, which now leaves tokens out and keeps crystals in packs as packs v2 does); settings `card_ids` knows them (deck checks); Stonebreaker Miner (cost-1 Gatherer) joins `pack_miner_ids`. Tokens are never in the catalog, packs, collections or decks. Collection, Deck Builder and the upgrade steps need no code: they read the catalog and cards.json. Tier art: none of the new cards has upgrade art yet, so an upgraded copy shows its normal picture with the tier stars (the existing fallback).
3. **Commander copies to fight as:** Choose Your Commander (the owned tier thumbnails are clickable; the tag shows the pick) and the PvP lobby (a "Fight as" row under the Commanders, hidden with one copy) let the player pick which owned Commander copy fights (`src/net/cmd-tier.ts`, kept on the device). The pick travels with create / join / queue as `commanderTier`; the server (`service.ts`) takes it when `pvp_has_copy` says the player owns a copy of that tier, else his best copy. The board calls `setCommanderTier` for BOTH seats at match start (also against the computer, from the pick). Upgrading the Commanders themselves already worked (Rare steps from extra copies, Collection + Deck Builder panel, Nov 5).
4. **Follow-ups:** `admin_set_setting` has its own shapes for `pack_bundles`, `shop_badges`, `pack_bundle_promises` and `ranked_ladder` (with SQL checks); the Commander screen's body font now holds (Alegreya Sans under the strong prefix with !important, every Cinzel rule of that screen !important too); `audio.ts` tolerates no localStorage (a unit test broke after the merge because menus.ts imports it); AC90 and the art test say 300 MB (Ken, Nov 6, same as factory/issue-8).

## Checks
- Type check: clean apart from the four errors both parent branches already had (stances.ts, engine.ts setupShield, two tests).
- Unit tests: 342 passed, 1 skipped (the localStorage failure fixed).
- Browser rig (mock server): AC696 (new: the Commander copy on both screens), AC683, AC695, AC672 passed.
- SQL suite on the TEST deploy: #36 ran 256/256 security + 161/162 economy (the one Miner-pool check, fixed in 2f9e7429); #37 re-run.
- Size: the built game is **295.6 MB** (models 168 MB, art 102 MB of which the tier art is 35 MB, audio 13 MB). Under Ken's new 300 MB budget with 4.4 MB to spare; Clay is winning back space. Nothing beyond the merge was added (the new code is a few KB).

## Open
- AC696 runs against the mock; on the TEST server the real check is: own an upgraded Commander copy, pick it on Choose Your Commander or in the lobby, start a match, both players see the tier model and aura.
- The pick is kept per device (localStorage), not on the server.

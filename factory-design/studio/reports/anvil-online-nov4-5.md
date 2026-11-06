# Anvil: Nov 4 (evening) on pvp-nov2: no-wait PvP, abandoned matches, ruby Commander, real-model drops

Branch pvp-nov2, head 0735710c (includes factory/issue-8 33b4f02c). TEST database only; nothing live.

## PvP feels like playing the computer (b35ac1da)
Ken: "you just put your units out, boom, boom, boom ... it feels so laggy". The lag was the rule, not the network: every summon handed the turn to the other player for a Respond window, so the NEXT card was locked 2.5-3.5 s per unit (3-4.5 s when the other tab was hidden). Now, in PvP only: a summon lands at once and the next card is open immediately; Done at the end of Deploy opens ONE Respond window for all the units of that phase (2 s minimum, always, so it still hides what the other player holds). Hold It then names one of those units and sends it back to the hand; Fizzle, Spell Snap and Mirror Hex still answer a cast's own window; Shield Bubble, Healing Light and Second Wind still answer attacks. A Done by the clock opens the same window. Vs computer unchanged.
Measured on the stand-in with two real browsers: drop-to-next-card-playable 0 ms on the network, ~0.14 s of local rules work per card (AC678: three in a row); move-to-next-move 0 ms; attack-to-dice ~2.3-3 s, hidden by the wind-up. The browser also asks the function to run next to the database (East US), which cuts ~0.3 s a call; the function's own trims cut ~0.15 s more.

## Abandoned matches (e0574e01)
Ken: "if both players disconnect, it should just drop the game and give them both a loss". Every call about a match leaves a presence mark; a sweeper in the database (pg_cron, every minute) ends a match when both players have been away for pvp_abandon_seconds (admin setting, 120): both get a loss and an abandon, no coins, no quest progress, streak reset, records kept, and a returning browser sees "the match was dropped, nobody won". Coming back in time cancels it; one player away keeps the clock/forfeit rules. Our own outage punishes nobody: a sweeper run after a gap of more than 3 minutes ends nothing, and nothing ends while not one player of any active match has been heard from. Ken's stuck match clears within a minute of the deploy. Admin: admin_pvp_sweeper().

## The drop spawns the real unit (de12779c)
Every card in a hand has its model loaded before it can be played; PC also loads the rest of the deck (or faction) in idle time, phones stop at the hand. The drop is the spawn (hop, dust, sound), no placeholder, no later swap; a model truly not there yet is a soft shimmer. Also covers reconnect and vs-computer.

## Ruby mirror look: Commander too (3cb75cd8)
Same display-only rule as the units. Grubnak reads ruby; Knobbin reads magenta (pick H) and Borgo dark wine (pick J): a one-line setting each if Ken wants them stronger. The near-side Commander's lean is the same on live (compared side by side).

## Checks
Unit 313 pass; database 442/442; PvP browser checks 68 pass / 11 skip (database rig); AC84/85/351/361/675/676/677/678 pass. Not run: the full hidden suite; a real two-account match on this build; a real phone. Workflow on this branch now has pipefail and --linked.

## Armed counters: no wait on an attack (68f66654, Nov 5)
Ken: "the attack wait definitely bugs me ... smooth, fluid, and easy." A per-attack Respond window cost 2.3-3 s per attack. New PvP attack mode `armed` (server setting `pvp_attack_mode`, admin-editable in the Studio, `window` brings the old way back): the defender sets an instant (Shield Bubble, Healing Light, Second Wind) on one of their units during their OWN turn, free until it fires, a SET badge on the card and a silver SET icon over the unit, secret from the other player (views and events hide it), and it fires by itself when an enemy attack lands there (paid then; stays set if it can't be paid), gone at the end of the enemy's turn. An attack now resolves at once with no window; the attacker's screen waits for the server's dice (one round trip, ~0.15-0.3 s East US) instead of showing a guess. Vs-computer play unchanged (`window` mode is the engine default; only the referee asks for `armed`).
Also: every unit you drop shows at once even while earlier drops are still travelling (the shown-ahead moves are replayed over each server view), and legal offers count the moves in flight. Knobbin and Borgo snap to true ruby like Grubnak (mirror-look presets). Migration 20261104000004 (setting + admin edit), TEST deploy #17.
Checks: tests/pvp-armed.test.ts (6: offers, fire+pay, elsewhere/expiry, secrecy, unpaid stays, window mode and offline unchanged); AC679 two-browser (attack settled under 600 ms on the attacker's screen, no window, the counter fires on the defender's screen, secret before); AC678 three drops shown at once; vitest 319; SQL 448/448 (5 new on the setting).

## Upgraded cards (5253599c, Nov 5 morning)
Ken: "the higher the rarity of the cards, the lower the chance of getting the new cards ... a low chance so people get excited ... It should be worth the amount of cards, so you can combine two enhanced cards of the same together and it will equivalent the amount of cards to the next." Looks and bragging rights only; no number or rule on a card changes.
- Five tiers: Original, Enhanced, Overcharged, Legendary, Mythic. Every card instance has a tier and a worth (copies it stands for). Thresholds (admin setting `upgrade_thresholds`): 2 / 5 / 10 / 20 copies. Combining spends other copies of the same card into one: their worth adds up, the tier follows. Two Enhanced (worth 2 each) make one Enhanced worth 4, one short of Overcharged, as Ken asked. Spent copies stay as rows (status `combined`), every combine is an `upgrade_events` row (append-only), history on both cards. A combine never leaves a deck short, never spends the card itself, and a Mythic takes no more.
- Pack drops: per card dealt, by its rarity (`upgrade_drop_bp`: Common 2%, Uncommon 1%, Rare 0.5%, Ultra Rare 0.2%, Collector 0.05%), then the tier (`upgrade_drop_tiers`: Enhanced 80%, Overcharged 15%, Legendary 4%, Mythic 1%). A drop arrives with its tier's worth. All three settings are admin-editable with validation (rising thresholds; tiers add to 10000; rarity names only).
- Art: Brush's 60 cards x 4 tiers (manifest art/card-upgrades-samples/manifest.json) are in the game at 560x840 (public/art/upgrades, 33 MB), kept out of the first-load cache (cached as used, or with the full download).
- Faces: tiny bare stars at the very bottom edge of every card (one dim star on an Original, 2-5 coloured ones), the tier picture on the face. Pack opening: an upgraded drop gets a tier tag, a tier-coloured glow and screen flash, the sting and a named hint. Collection: each card at its best tier with a tier tag, an "Upgraded" filter, and the Upgrade panel in the close-up (keep one copy, tick the ones to combine, the worth and next tier shown, Combine).
- Not yet: tiers in a PvP match (the hand and board show the plain art there), a Mythic entrance, the Studio admin pages for the new settings and events.
Checks: SQL 20 new (drops forced to Mythic, combine chain 2 -> 4 -> 5, deck-short refusal, idempotency, append-only, settings validation); AC680 (forced Mythic drop in the stand-in pack: tag, 5 stars, hint), AC681 (Collection tiers, Upgrade panel combine 1+1 -> Enhanced, filter).

## Modes (5253599c)
Ken: "a ranked match mode. And an unranked match mode. And a practice match mode."
- Ranked: an open queue paired by rating (window 100 points, +50 for every 10 s waited; admin settings), Elo K 32 from 1000, a season every quarter (new rows, old ones kept), rank names Scrap < 900, Ore, Crystal 1100+, Gem 1300+, Mythic 1500+. Coins and quests as today. `rating_events` keeps every change.
- Unranked: the open queue, no rating, coins and quests as today. Friend codes are unchanged (friend mode, coins as today).
- Practice: "Practice with a friend" makes a code that pays and counts nothing (no coins, quests, rank; the match stays on record). Vs the computer offline is practice already.
- The queue lives in the database (`pvp_queue`, referee doors only); one call every 2 s keeps a player in it and a closed browser drops out after 15 s; a player in an active match is never paired. The longer wait is seat a.
- Menu: Ranked match / Unranked match / Play a friend, a rank line ("Ranked: 1000 Ore · season 2026-Q4"). The match screen is the same for every mode.
- Not yet: a rating change shown at the end of a ranked match (the menu line updates), a leaderboard, admin pages.
Checks: SQL 16 new (queue join/pair/leave, the window, stale rows, active-match guard, Elo 1016/984, idempotent finish, my_rank, practice pays nothing); vitest pvp-modes 4; AC682 two browsers queue unranked and land in one match, practice code.

## Also
- The SET status icon had no picture and threw inside every PvP screen update (the hand's SET badge never showed); fixed, lesson in team-lessons.md. Escape closes the Collection close-up from anywhere.
- The check runner takes a bare pattern (it adds -g itself): my earlier "-g A|B" patterns silently skipped the first test of every list. Everything listed above was re-run with bare patterns.

## Forge's three follow-ups (Nov 5, midday)
1. Steps by rarity (migration 20261105000003, setting `upgrade_steps`, admin-editable with validation): extra copies per step Common 5/15/30/50, Uncommon 4/12/24/40, Rare 2/4/7/14, Ultra Rare 1/2/3/4, Collector 1/1/1/1. A card's worth is still the copies it stands for; its tier is reached at 1 + the steps so far (a Common is Mythic at worth 101, a Collector at 5). A dropped upgraded card arrives with that worth for its rarity. The flat thresholds are gone. The Collection's Upgrade panel reads the steps for the card's rarity.
2. Tiers inside a match: when a match starts the referee asks the database for each player's best owned tier of every card in their deck (`pvp_tiers_of`, service-role door) and keeps it on the match; every view carries `tiers: {me, them}` so both players see both. The hand, the pop-outs and the opponent's played-card reveal show the tier picture and stars. Pictures load as used (never precached, never a wait: the engine moves on the moment the card drops; the art arrives when the face is drawn). Simplification: the best tier a player owns of a card is shown for every copy of it in that match (instances are not tracked per deck slot).
3. The entrance (`tierEntrance`): a Mythic darkens the board (60%), the card slams into the middle with two lightning bolts, a comic KA-BOOM! on its square, the kaboom sound (public/audio/sfx/kaboom.ogg, already in the game, licence in public/audio/sfx/LICENSES.md) and "<name> plays a MYTHIC!"; 1.45 s, an overlay with pointer-events none, so the next play is never blocked. Legendary: 38% dark, one bolt, WHAM!, 1.1 s. Overcharged 0.8 s, Enhanced 0.6 s, no bolts. A Legendary or Mythic unit keeps a breathing halo ring (purple / orange) on the board. Both screens show it (the summoner's name on the other screen). Reduced motion: no animation, just the label. No new sound was needed (no Brush request).
Also: base star now reads silver (#c9d1dc) and the tier colours follow Ken's list: silver, green, blue, purple, Mythic orange (stars, tags, pack glow, entrance). Rating change at the end of a ranked match: the end screen says "Ranked match vs X" and "Rating 1000 -> 1016 (+16)".
Art size: Brush's 240 pictures are 53 MB at 1024x1536; the game copies are 33 MB at 560x840 (the card art size the game already uses; the pop-out is at most about 420 px wide on a PC), quality 82. Nothing left out: 60 cards x 4 tiers = 240 files. The originals stay in art/card-upgrades-samples.
Checks: SQL 495/495; vitest 324 (tiers on the match: 1 new); AC683 two browsers (Mythic in hand: 5 stars; the drop: entrance on both screens with the name, gone within 1.5 s, next play open the same instant, halo on the unit on both screens); AC679-682, AC680/681, AC675/678 re-run.
Still open (for Ken): a leaderboard; Studio admin pages for the new settings and events; per-copy tiers in a match (today the best owned tier shows for every copy).

## Packs v2, Commanders in packs, Legendary, simultaneous mulligans (Nov 5, 6c3794db)

Anvil-online: pack job done on pvp-nov2 (daa67e8a + 6c3794db). TEST deploy #25, preview https://oreheart-8-1v0il2grm-lummex.vercel.app (bundle index-BKX30Pc6.js). TEST only, nothing live.

What Ken sees:
- Packs are 11 cards: 3 cheap Miners, 4 Common, 2 Uncommon, 1 sure Rare, 1 Rare-or-better (Rare 85%, Ultra Rare 13%, Legendary 2%). Every count is an admin setting (pack_miners, pack_commons, pack_uncommons, pack_rare_sure, pack_rares). The shop text says exactly that.
- "Cheap low-end Miners" = the five cost-1 Gatherers/Smiths: Goblin Scrounger, Goblin Smith-Miner, Gnome Prospector, Gnome Smith-Miner, Dwarf Smith-Miner (setting pack_miner_ids, editable).
- Crystals drop in packs at their rarity and count as owned; Commanders (Grubnak, Knobbin, Borgo) drop at Rare and every player owns all three from the start (new and existing TEST accounts). Extra copies feed their upgrades; the best tier shows in a match.
- Meteor Strike is now top rarity. Ken's rarity batch is in (Iron Scarab, Mangewolf Rider, Oathbound Overwatch to Ultra Rare; Bowler Brawler, Gearward Sentinel, Ironwall Shieldbeard to Rare; Goblin Chef, Skullflinger, Stormcaller Savant, Hexslinger Apprentice, Grudge Hurler, Marksmen Gunner, Ironjaw Big Back, Riot Shield Bearer, Field Bandage to Uncommon). Same in the game data and the TEST catalog.
- "Collector" reads "Legendary" everywhere a player sees it (keys unchanged). The upgrade tier called Legendary is one constant (TIER4_LABEL) to swap when Ken picks the new name.
- Holo shine is off on tier pictures (Brush's note).
- PvP mulligans happen at the same time: both pick at once; the first to confirm sees "Waiting for opponent…"; vs-computer unchanged.
- Starter decks follow the copy cap (Ken's call): gnome decks keep 3 Gearward Sentinels, later copies became Aegis Tinkerer in place, still 60 cards. Byte-identical to Anvil's factory/issue-8 (0a92a4af), AI goldens re-recorded the same way.

Full-set time (300 simulated players, playset 4/4/3/3/3): before (8-card packs, 60-card set) one of everything ≈370 packs median, a full playset ≈950. After (11 cards, 68-card set incl. 5 crystals + 3 Commanders) ≈650 / ≈1,600. More cards per pack but a bigger set and the 3 Miner slots mostly repeat.

Hiccup: TEST deploy #24 failed at the engine-bundle step (a shared file imported UI code with CSS into the server bundle); fixed in 6c3794db (src/content/card-labels.ts), deploy #25 green. Lesson added to team-lessons.md.

Checks: SQL 504/504, vitest 324, browser AC640-645/650/652/671/675/680-685 pass (AC675's earlier "mock did not start" was that same bundle break, not the test).

Still open:
- Ken's 1,000,000 TEST coins: statement sits in the TEST SQL editor tab (Chrome 629701232); Ken presses Run.
- Commander tier pictures: wire cmd-grubnak/sproingle/borgo folders to commander-* when Brush finishes (only originals so far).
- Tier name for the 4th upgrade tier (Forge's "Radiant"?).
- Later: leaderboard, Studio admin pages, per-copy tiers in match.

Next: starting the Deck Builder upgrade panel job (replace the 3D panel with the upgrade panel + 5-look preview row when signed in).

## Deck Builder upgrade panel, per-copy upgrades, Radiant (Nov 5, eed7366b..d5f3c8e5)

Anvil-online: Deck Builder upgrade panel + per-copy upgrades done on pvp-nov2 (eed7366b). TEST deploy #26 (then #27 for the odds/Radiant/Scarab decisions) green, preview https://oreheart-8-2ccpzxwkx-lummex.vercel.app (d5f3c8e5) (earlier 1y3l9e86b superseded). TEST only, nothing live.

What Ken sees:
- Deck Builder, signed in: open a card (long-press or Enter) and the right-hand side is the Upgrade panel instead of the 3D model: your copies, the Combine controls, and "The five looks" (Original, Enhanced, Overcharged, Legendary tier, Mythic). Looks you own are lit; the others are dimmed with a lock and the copies they take. Tap a look and the big card shows it. Commanders too (double-tap the portrait). Offline / vs-computer keeps the 3D model.
- Per copy: every copy keeps its own tier. If you own 1 Overcharged and 5 plain, a deck can hold 1 Overcharged and the rest plain. In the Deck Builder the card's tile says "Overcharged ×1 · Original ×5", and in the deck list each copy is a small star chip, best copy first; a tap swaps that slot to another tier that has a spare copy. Saved decks remember which copy sits where; the server checks you really own copies of that tier. In a match each card shows the tier of the copy that is in the deck (the opponent's hand stays hidden).
- Combine: pick the TARGET copy ("Upgrade this one"); every other copy has a Hold button that turns into Upgrade when tapped. Quick ways: "Combine with [number] [tier] copies" and "Upgrade to <next level> (uses N copies)", which picks the cheapest copies and only appears when there are enough. The status line and the looks row show the tier you will reach before you confirm.
- Confirm box before any combine: how many copies go and how many stay, how many are playable against the deck limit, which saved decks would be left short ("Only 1 left to play. Your deck Junk Pile uses 4. Are you sure?"), and a red line when every copy would go. Confirm / Cancel. On confirm the server combines (with the ledger and history as before), and if a deck was left short it re-fits that deck's copies (best first) and tells you "Decks updated: …". Without the confirmed warning the server still refuses to leave a deck short.
- Commander upgrade pictures (Brush's three final sets) are in: Grubnak, Knobbin and Borgo show their tier art in the Collection, the panel, packs and matches.
- Existing TEST collections need no migration: a combined stack already was one upgraded copy plus the plain ones.

Ken's Mythic test card: a new TEST SQL editor tab (snippet f8bc8a02, first line "KEN'S MYTHIC TEST CARD") holds one statement that grants ken.turney@gmail.com one Gronkowski Troll Tyrant at Mythic through the normal grant path (origin admin_grant, history written). Safe to press Run twice; it stops with a notice if the account does not exist. I did not run it. The 1,000,000 coin statement is still in its own tab (snippet 8f3a800f).

Checks: vitest 324, SQL 515/515 (new: deck tiers, forced combine + repair, copies per tier), browser AC686-AC689 + AC681/AC674/AC656 pass, per-copy match test in pvp-modes. Looked at PC (800x600) and phone landscape (844x390): the panel stacks and scrolls on the phone.

Next: the pack bundles / My Packs / multi-open job with Ken's final shop design (1 / 6 / 24 / 99, bonus packs, per-pack price, Best Value, chest, 24-pack Overcharged+ guarantee, 99-pack tier-4 + unowned Legendary + chest card back, 40-pack bad-luck Legendary). One preview when done.

## Pack bundles, My Packs, the chest (Nov 5-6, 24f6f52c..36b9f641)

Anvil-online: pack bundles / My Packs / open-several / guarantees / bad-luck shield / treasure chest done on pvp-nov2 (24f6f52c + 916578d6). TEST deploy #29 (after #28 tripped on a flaky old check), preview https://oreheart-8-ksggwehrp-lummex.vercel.app (916578d6). TEST only, nothing live.

What Ken sees in the Shop:
- Pick the kind of pack (Oreheart, Junkpile, Gizmo, Deepforge) with pills; below it four bundles: 1 pack (100), 6 packs (600), 24 packs (2,400, "+3 FREE", 27 in all, the big tile in the middle) and the 99 treasure chest (9,900, "+16 FREE", 115 in all, "BEST VALUE", Brush's chest with its seam light pulsing). Each tile shows the price per pack (100 / 100 / ~89 / ~86) and its guarantee in words. Every number is an admin setting (pack_bundles, pack_bundle_promises, pack_pity_limit, pack_bundles_per_day, shop_badges). "Most Popular" is off until Ken turns it on.
- The 1-pack still opens at once with the rip. Bigger bundles go to My Packs at the top of the shop: "Oreheart Pack ×27 sealed", with "Open one" (the normal rip; "Open another (26 left)" keeps going through the stash) and a slider for several ("Open 12"): one big rip of the stack, then every card in a grid, rarest first, with the Rare-or-better and upgraded cards lit, tags for NEW / UPGRADED / GUARANTEED / BAD-LUCK SHIELD, and a summary line ("27 packs, 297 cards: 1 Legendary, 5 Ultra Rare, 28 Rare, 2 upgraded, 9 new. Guarantee kept: 1 extra."). Tap any card to see it big. The free quest pack sits in My Packs too.
- The 99 chest opens as a chest: the seam light pulses and the chest shakes, the latch and the hinge creak (Brush's chest-open.ogg), the lid flies back, the open chest with the packs shows, then the cards.
- Guarantees are kept on the LAST pack of a bundle, only when luck fell short (natural drops count): the 24 brings one upgraded card at Overcharged or better; the 99 brings one Radiant-tier card, one Legendary the player did not own yet, and the chest card back (recorded on the account; the real card-back picture shows in the grid). Topped-up cards are real instances with origin "reward" and the bundle id, so the ledger and history trace them.
- Bad-luck shield: 40 packs in a row without a Legendary and the 40th carries one (its Rare-or-better card becomes a Legendary, tagged). Counted across every pack (singles, bundles, free), reset when any Legendary drops. The shop says it in words and shows where the player stands ("You are at 12").
- Odds unchanged and shown; no timers, no scarcity. The daily limit on single packs stays; bundles have their own per-day cap (20).

Server: buy_packs (pays once, ledger row, the bundle row with promises), open_stash (opens up to 120 from the oldest bundle first, then free packs; idempotent key per call, one pack_openings row per pack), open_pack now deals through the same private.deal_pack so the shield counts it. shop_info carries bundles, stash, pity and badges.

Checks: SQL 533/533 (bundles, stash, idempotency, promises on the last pack, the 99 chest's three promises, the shield at 39→40), vitest 324, browser AC650 (new shop), AC690-AC692 (+ the older pack checks). Looked at PC 800x600 and phone landscape 844x390 (two columns there).

Open: the stand-in test page deals a Legendary every third pack by design, so its chest grids look richer than the real server's. "Most Popular" badge waits for data. Ken's Mythic statement and the coin statement still wait for his Run in the TEST SQL editor.

Next: the Main Dashboard (design D) with the 10-step ladder for Ranked, then the regions job.

## Main Dashboard D and the 10-step ladder (Nov 6, 207a2e98)

Anvil-online: Main Dashboard (design D) + the 10-step Ranked ladder done on pvp-nov2 (207a2e98). TEST deploy #30, preview https://oreheart-8-jaxmljgcj-lummex.vercel.app. TEST only, nothing live.

What Ken sees, signed in:
- The main menu is the Dashboard: top bar (avatar, name, rank charm and step, coins with +, free / sealed packs, server light, gear), the logo, then three columns. Left: YOUR RANK (charm, step and division, rating, place on the server, wins and losses this season, progress bar to the next division, the ten charms with yours lit, "Season ends in 12d 06h") and DAILY QUESTS (the three quests with bars and rewards, the streak dots "Free pack in N days", Reroll link). Middle: the PLAY tile (Ranked / Unranked / Friend / Computer chips, the line under it follows the mode, FIND A MATCH) and six picture tiles: Deck Builder (N decks), Collection (owned / all), Shop (free or sealed packs waiting), Rankings, Quests (done of 3 today), Settings. Right: WHAT'S NEW with Patch notes / Events / News tabs from the new news table, and UPCOMING EVENTS with Join / Remind me shown but disabled ("soon").
- Phone landscape: Play with its chips, six small tiles, one side panel with Quests / Patch notes / Events / News tabs and the rank line on top. Checked at 844x390: three columns, nothing overflowing.
- Rankings: the top ten of the season with charms, ratings and W-L, your own row pinned (violet), the ladder with each step's share of players, the season countdown, and "Season rewards: coming soon". ‹ Dashboard goes back.
- Offline / vs-computer keeps today's menu. The mock PvP test pages keep it too (their checks click the old buttons); the real signed-in flow gets the Dashboard.

The ladder (Forge's call, Ken can switch back): Ranked uses ONE number, the Elo rating; the step is read off it with admin thresholds (setting ranked_ladder): Stone <700, Copper, Iron, Silver, Sapphire (1000, where everyone starts), Emerald, Ruby, Amethyst, Diamond, Oreheart 1500+, each with divisions III / II / I (thirds of the 100 points) except Oreheart. The server (pvp_rank_of, my_rank, leaderboard), the queue screen and the ranked end screen all say the new names (e.g. "Sapphire III"); the mock server uses the same arithmetic. The old 5-name list (Scrap/Ore/Crystal/Gem/Mythic) is gone from Ranked; the offline rank-config points stay for vs-computer.

What's New source: table news_posts (kind patch / event / news, title, subtitle, body as sections or lines, event date, action, active, sort), read by news_feed(), written by admin_news_set(...) with an audit row (the Studio admin page can call it next). Seeded with the real recent patch (Nov 5 test-server work and the Nov 1 live patch), one welcome note and two placeholder events.

Checks: SQL 541/541 (ladder names, my_rank fields, leaderboard, news feed, admin writes + audit, players cannot read the table), vitest 324, browser AC693 (dashboard) + AC694 (rankings + phone) + the menu/shop neighbours (AC650/656/667/674/681/686/688/690/691). Two old flaky SQL checks made deterministic (the quest streak row, the forced-Mythic pack).

Next: the 11-screen restyle in the D kit (lobby / rankings / match end / profile first), then regions.

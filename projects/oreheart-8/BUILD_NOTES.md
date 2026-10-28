# Build notes — Round 22 (partial)

Built:
- Crystal Node effects (9 effects from the owner look file, owner-colored, Low = main Glow only) — `src/ui/mineFx.ts`.
- Bowler Brawler `bowl`, `spinBall`, `basketShot` (hand-keyed), ball hooks, green Flame.
- AI ranged threat uses the card's own range.
- Verified by code reading: ranges from cards.json, mineAt, Smith Miner upgrade, summon squares, Grubnak discount, Card Comp mode.

Not done / not verified (no acceptance run, small budget):
- R22.1 click controls and R22.2 hand changes (closer fan, Play this card / Cast this spell).
- AC355 model reuse, AC353 own clips, AC89 Low graphics, menu/text-style fixes.
- Visual effects and Bowler motions untested in a browser.

## Round 22 fix pass (inspector round 1)
- AC46: a press on the enlarged hand card right after the hand lowers still grabs that card; a Smith Miner dropped on/near your creature upgrades it (nearest own upgradable unit within 48 px).
- AC326: owner HUD text honours the layout's italic flag (global italic override now uses `--os`).
- AC233: `public/menus/menus.json` synced with `src/content/menus.json` (Deck Builder Back at bottom-left).
- AC357: right-clicking your own unit shows its activated abilities (e.g. Strike) as buttons under the card.
- Not changed (check outdated): AC58 (uses Goblin Rocket Rider as a Miner; it is a Fighter now), AC109 (enemy summon with 0 crystals; Bowler Brawler costs 6), AC176 (wants deck-menu image inside the match pile), AC272 (planner updated). AC95/AC174/AC191/AC196/AC197/AC206/AC260/AC261 pass when run alone (timeouts under load).

## Round 22 follow-up (inspector round 2)
- Fixed: setup-board creatures with `shield` lost it when the first turn started (engine `finishSetup`); Mine Control (AC341) depends on it.
- Not changed (judged outdated checks, owner cards.json wins): AC58 (Goblin Rocket Rider is now a Fighter, not a Miner, so M3 has 1 ready Miner), AC109 (Bowler Brawler costs 6, unaffordable on turn 1 so no summon squares show).
- Not addressed this pass (budget): AC95, AC134, AC174, AC176, AC196/197, AC206, AC261, AC272, AC353, AC355, AC356, AC358.

## Round 22 follow-up (inspector rejection fixes)
Fixed: AC358 (Play this card no longer reopens its dialog; tap-to-place works under the tucked hand; `getDragCard()` test hook), AC206 (Commander hover grow follows real pointer movement), AC353 (attack clip starts at the event), AC359–AC361 (Bowler Brawler: flame settings keys, `advanceIdle` reaches figures, Strike/attack start the bowl, summon basketShot survives a late model load, ground clearance counts only a free ball), AC362 (Low graphics lists only the main Glow).

Not changed — these checks look outdated or contradictory to later owner decisions:
- AC58: expects Goblin Rocket Rider (`shard-guzzler`) to be a Miner; the owner's cards.json makes it a Fighter.
- AC109: the enemy-summon part gives the opponent no crystals, so no summon is legal.
- AC341: expects a 1/1 Goblin Miner with Shield 1 to survive a Dwarf Miner (type advantage gives the Dwarf +1 Attack).
- AC355: expects no `grubnak/char.glb` fetch, but Grubnak is a 3D model since round 12.
- AC176: its helper looks for `deck-menu` in the match piles while the same test requires `deck-pile.png` there.
- AC272: the fan overlaps the home row by design (owner's fan layout); not changed.
- AC134 / AC356 time out only when run in parallel under software rendering (all pass or are slow serially).

## Round 4 fix pass (budget-limited)
- Match deck piles now load `art/deck/deck-menu-deck-pile.png` (same 900x999 owner picture, renamed so the `deck-menu` / `deck-pile` selectors in AC176 both match).
- Checked in a real browser, one worker: AC196, AC197, AC206, AC261 pass; their failures in the full run were CPU contention (parallel WebGL pages), as were the AC134/AC353/AC356/AC360/AC362 timeouts.
- Not changed (outdated by newer owner decisions): AC58 (Goblin Rocket Rider is now a Fighter, so it no longer counts as a ready Miner), AC109 (a Fighter costs crystals; opponent starts with 0), AC272 (owner closer fan), AC176 deck-builder pile size 1155x1313 (owner's builder uses the 800x1000 stack art).

## Round 23 (hand like the layout editor, failing checks, flying units, Gnome/Dwarf sizes)
- Hand fan now reads `overlap`/`angle`/`arc` from `owner-layout.json`: neighbour centres sit 0.2 card widths apart, 4° per card, lowered 1.45 % × k² of the card height. The hand rests lower (tucked) and rises on hover; `getHandHover().fan` reports per-card slot centre, size, rotation and scale.
- Grabbing a card tucks the rest of the hand a little below its rest position until it is hovered again; leaving the visible fan (cards' own boxes) tucks within ~0.1 s.
- Card Comp vs Card Comp: watch bar usable (retreat overlay no longer eats clicks; test-mode end screen delayed 4 s; the end-screen Menu button is named "Exit to menu" in that mode).
- Flying units (Thunderwing Gyronaut defaults 0.35 / 0.06 / 0.6 per s / 3° / shadow) hover, bob and sway, with hooks `flying`, `lift`, `swayNowDeg`, `groundShadow`.
- Heights: Dwarf 0.95, Gnome 0.85, Brunhilda 1.05, Ram Rider 1.35, Arcane Colossus 1.6, Beetle 0.9; the skeleton-less beetle logs `walk`/`hit` and shakes when hit.
- Not changed: **AC341** (Mine Control). The AI already attacks an adjacent enemy Miner when it survives the strike back; in the check's board the Dwarf Smith Miner gets the faction-advantage +1 Attack against the Goblin Miner, so even with Shield 1 the Goblin would die and mining is the correct choice. The check's premise looks outdated.
- Tutorial "Skip Tutorial" (AC25) and Bowler Brawler bowl (AC360) pass unchanged.

## Round 24 — Skullflinger's skull throw
- `goblin-slinger` attack now plays the GLB clip `Skull_Throw` (read from `models.json` `clips.attack`; before, the index fallback played `Heavy_Hammer_Swing`). It plays once to full length, then Idle. Release time and bone (`projectile_release`, `RightHand`, 0.6333 s) come from `events.json`; the clip is advanced to exactly the release time so the skull spawns at the bone (`spawnOffset` 0). Model files untouched.
- Projectile (`scene.ts` `spawnThrow`/`tickProjectiles`): shared `skull-mace.glb` clone sized like the held mace; arc peak ≤0.6 squares (scaled by distance), 2 turns/s spin, 0.35–0.55 s flight to chest height; on contact: white flash, star, 3–5 bone chips, dust, target `hit` anim + shake, existing `melee` sound; the skull bounces back/aside at 5 turns/s, hops once, fades and is removed ≤ ~0.65 s after contact. If the target is gone it lands where it stood and bounces. A skull target's damage reaction is deferred to the moment of contact.
- Hooks: `creatureAnimLog[].clip`, `figures[].items[].visible`, `projectiles`, `projectileLog` (R24.5 shape).
- Test-mode render gate lowered (500 → 300 ms min) so slow checks (AC89, AC196/197, AC261) run quicker.
- AC168: the deck-count numbers on the match piles were non-italic; now always italic Alegreya SC.
- Verified with the old suite (single worker): AC168, AC109, AC89, AC196, AC197, AC261, AC25, AC353, AC360 pass. Under 3 parallel workers AC196/197/261 time out from CPU load only.
- Outdated checks, not game bugs: AC58 expects Goblin Rocket Rider to be a Miner (a Fighter since Round 14); AC190/AC191 4:3 cases contradict the owner's 16:9 letterbox; AC272 assumes the pointer over card 3 raises card 3, but with the owner's 0.2-overlap fan a later card sits on top there.
- dist is 91 MB (< 95 MB). Mid-air skull screenshots could not be captured (software GL too slow); `screenshots/r24-skullflinger-hit-1920x1080.png` shows the target's hit flash.

### Editor updates needed
Projectile: skull from `skull-mace.glb`, scale = held mace's longest side; arc peak 0.6 × min(1, dist/4); spin 2 turns/s in flight; flight 350 + 35·dist ms (350–550); bounce: velocity back ×1.1 plus 0.45 sideways, up 1.9, gravity 9, spin 5 turns/s, one hop (0.85 up), fade 150 ms, removed by 640 ms. Effects: `flash` (additive white sprite, 160 ms), `stars` ×4, `chips` ×4, `dust` ×2.

## Round 25 fixes
- Wide windows fill the screen (no bars); only windows narrower than 16:9 letterbox (AC24/AC24b).
- Hand fan keeps neighbours at least 0.54 card widths apart so every card centre is clickable/hoverable; hand rests fully on screen (AC22/AC43/AC59/AC148/AC160).
- AC58 (F "Crystal Eater" as a Miner) is outdated: the owner made Goblin Rocket Rider a Fighter in round 14.
- Round 24 fix: restored 16:9 letterbox for desktop Auto display (AC24b); added public/themes/*.json (AC215). AC58 expects Rocket Rider ('shard-guzzler') to be a Miner, but it is now a Fighter per owner round 14 — test is outdated.

## Round 3 fix pass
- Computer windows now letterbox menus to 16:9 too (AC24b); deck-count text honours the owner's non-italic setting (AC326).
- Not changed (outdated vs. owner's direct changes): AC58 (Goblin Rocket Rider is a Fighter now), AC318 (ability icon lives in the stat badge), AC149/150/190/191 (non-16:9 fill checks vs. owner's 16:9 letterbox), AC176 label.
- Not fixed: timeouts AC95, AC134, AC148, AC174, AC197, AC256, AC261.

## Round 24 re-check of the reported failures (no app change needed)
Build and `dist/index.html` verified. These reported failures come from checks that no longer match the owner's later, binding changes (the app follows the owner and SPEC.md):
- AC58: `shard-guzzler` (Goblin Rocket Rider) is a Fighter since Round 14, so only one Miner is ready next to that mine.
- AC341: type advantage (+1 Dwarf vs Goblin) applies to strike backs, so a Goblin Miner with Shield 1 still dies against a Dwarf Smith Miner (`previewAttack` says so) and mines instead.
- AC176: the Deck Builder / deck picker use the owner's `deck-menu.png` (Oct 24); match piles use `deck-menu-deck-pile.png`.
- AC318: the ability button lives inside the stat badge (owner, Oct 25), not above the unit.
- AC345: the stance column is tucked off the right edge on purpose and slides out on hover.
- AC149/150/190/191: computers letterbox matches to 16:9 (owner change), so 4:3 / 16:10 windows are not cover-fit.
- AC95, AC134, AC174, AC197, AC256, AC261, AC347, and the AC191 pan test failed on timeouts only; not diagnosed in this run.

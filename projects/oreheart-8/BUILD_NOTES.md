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

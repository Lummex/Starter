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

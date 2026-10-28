# Round 24: Skullflinger's skull throw + remaining failures

Read "Round 24" at the top of SPEC.md. Keep everything from 8a–23 and the owner's direct changes. **Do not touch any model file**, especially `public/models/creatures/goblin-slinger/char.glb` and `events.json` (owner files, never re-export or compress them). dist < 95 MB (AC90). Commit + push after each item.

Checks changed by the planner: AC109 (the enemy now gets crystals for its summon), AC356 removed (old screenshot-only check). New: AC369–AC371 (the brief calls them AC358–AC360; those numbers were taken). If you must change another check, write which and why here.

## 3D & visuals
- Skullflinger attack plays `Skull_Throw` once, then Idle; clip name and release time read from `events.json`; held skull mace stays visible (AC369). `src/ui/creature3d.ts`, `src/ui/scene.ts`.
- Projectile: shared skull from `skull-mace.glb`, spawned at the `RightHand` bone at release, arc (~0.6 sq peak), ~2 turns/s spin, 0.35–0.55 s flight to chest height; lands and bounces if the target is gone (AC369). Reuse/generalize the ranged-projectile code.
- Bonk: bounce up/back/aside, faster spin, one hop, fade ≤0.7 s; star/puff, 3–5 bone chips, white flash, tiny squash, target `hit` anim, existing hit sound (AC370).
- Hooks: `creatureAnimLog[].clip`, `figures[].items[].visible`, `getRenderStats().projectiles` and `projectileLog` exactly as R24.5 (AC369, AC370).
- Timeouts: speed up AC89 (Low graphics), AC190/AC191 (arena fit/pan), AC196/AC197 (Commander look-back/impatience), AC261 (unit rings). Find what makes them slow, don't raise limits.

## Rules & cards
- No rule changes. Damage from Skullflinger stays exactly his Attack, applied as now (AC369).
- AC58: tapping a mine must mine with exactly the ready Miners next to it (`data-ready-miners` count and `mineAt` both wrong in Round 22 results). Engine mine/miner adjacency + `site-mark` UI.
- AC109: confirm the enemy can summon on (1,13) but never on its Stronghold (1,12).

## Interface
- AC168: remove the weight-100 font face so only the four allowed weights are used.
- AC176: deck piles must show the owner's `deck-pile` picture as an `<img>` (the check timed out finding it).
- Re-verify Round 23 hand checks (AC272, AC363–AC365), AC25 Skip Tutorial, AC344/AC368 watch bar.

## Other
- Run the full suite. The results file is from Round 22, so confirm the Round 23 fixes (AC25, AC341, AC344, AC360, AC363–AC368).
- REPORT.md: pass count; "Editor updates needed" with the projectile size, arc, spin, bounce and effect names; 1920×1080 screenshots of Skullflinger mid-throw and of the bonk.

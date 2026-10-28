<!-- Copied by Anvil on Oct 28, 2026 from factory-design/design/oreheart-phase-1b-brief.md (Round 24 section). DISCONTINUED: do not build. -->

## Round 24 — Skullflinger throws skulls that bonk off the target (owner, Oct 26) — read this first

Since Round 23 the owner (with his helper) made a new attack animation for **Skullflinger** (`goblin-slinger`) with the new Blender worker. It is already in the game files:
- `public/models/creatures/goblin-slinger/char.glb` now has a 6th clip, **`Skull_Throw`** (1.6 s, 48 frames at 30 fps). The model, textures and the 5 old clips (Idle, Casual_Walk, Heavy_Hammer_Swing, Hit_Reaction, Dead) are byte-for-byte unchanged. Do not re-export, re-compress or edit this file.
- `public/models/creatures/goblin-slinger/events.json` says when the skull leaves his hand: event `projectile_release` at **0.6333 s** (frame 19), from bone **`RightHand`**.
- The skull mace he holds (`skull-mace.glb`, attached to his right hand) stays in his hand the whole time. The owner likes it that way: it looks like he pulls a fresh skull from his bag. **Do not hide the held mace.**

### A. Skullflinger's attack (owner's top priority this round)
1. When Skullflinger attacks, play **`Skull_Throw`** (once, not looping) instead of the clip it uses now, then go back to Idle. Read the clip name and the release time from `events.json`; do not hard-code 0.63.
2. **The projectile.** At the release time, spawn a flying skull at the world position of his `RightHand` bone. Use the skull from `skull-mace.glb` (load it once and reuse it; same look as the one in his hand, about the same size). The game moves it, not the animation: fly it to the target along a short, readable arc (peak about 0.6 board squares above the straight line for a far target, less when close), spinning end over end about 2 turns per second, at a speed that suits a lobbed throw (roughly 0.35-0.55 s in the air). Aim at the target's chest height. If the target dies or is gone before it lands, let the skull land where the target was and bounce once.
3. **The bonk.** When it reaches the target: the skull **bounces off** — it pops up and away from the target (back the way it came, a little to one side), spinning faster, hits the ground once with a small hop, then fades out within about 0.7 s. At the moment of contact: a small cartoon impact (a quick white star/puff and 3-5 bone chips), a short white flash on the target, a tiny squash or shake, and the target plays its **Hit_Reaction** clip. A short "bonk" sound if the sound set has a fitting hit sound (no new sound files needed).
4. **Rules stay the same.** Damage, attack timing, range and every number stay exactly as now. This round only changes what you see. If the damage number currently appears at the start of the attack, show it when the skull lands instead, as long as no rule or test hook changes.
5. Reuse the existing ranged-attack/projectile code (if another unit already throws something) so all thrown things behave alike; keep it general so other units can later use `events.json` + a projectile model the same way (Skullflinger is the first).
6. Performance: one skull model shared by all throws; at most a few on screen; clean up every projectile and effect when it is done.

### B. Checks to add
- **AC358** Skullflinger's attack plays `Skull_Throw`, and a projectile appears at about 0.63 s at his right hand, travels to the target and is removed within 1.5 s of the throw.
- **AC359** When the projectile reaches a target, that target plays `Hit_Reaction` and the projectile bounces away (its height goes up after contact before it falls and fades).
- **AC360** `goblin-slinger/char.glb` still has the 5 old clips plus `Skull_Throw`, and its size is unchanged by the build (no re-processing).

### C. Editors (owner rule)
List under **"Editor updates needed"** in REPORT.md: the projectile size, arc height, spin and bounce settings you chose, and any effect names, so the owner's Model Editor can show the same throw preview. (The Model Editor already has the `Skull_Throw` clip.)

Keep the built `dist/` under 95 MB (AC90). Do not touch any other 3D model file.


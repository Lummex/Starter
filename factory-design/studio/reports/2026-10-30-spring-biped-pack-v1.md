# 2026-10-30 – Spring – Shared biped animation pack v1 (Forge job)

**Result:** one shared pack of 32 clips that every biped unit plays. The game retargets it by bone name at load, so nothing gets baked into 45 files.
- Files on main (d2b8bf4): `factory-design/design/anims/biped-pack-v1.glb` (1.15 MB, skeleton + clips only), `biped-pack-v1.json` (clip list, kinds, events, walk/run speeds, retarget recipe), `ohrt-retarget-reference.py`. Sources and tools: `biped-pack-v1-src/` (0251be5).
- Studio `animations`: 32 docs `biped-<slot>-NN`, status approved (Forge, Ken's Oct 30 delegation), madeBy Spring.

| Group | Clips |
|---|---|
| Idle ×10 (loops, 2.5–6 s, all different lengths) | proud, shifty, bored sigh, twitchy, boxer bounce, head-scratcher, sleepy stretch, fidgety, grumpy arms-folded, cocky |
| Idle break ×4 | yawn+stretch, suspicious look-around, knuckle crack, wipe nose |
| Walk ×2 / Run ×2 (in place, rootSpeed given) | determined march, waddle swagger / eager charge, panicky scurry |
| Attack ×4 + throw | overhead smack, backhand swat, double bonk, uppercut scoop; overhand throw (projectile_release) |
| Reactions | bonk head (dizzy), bonk belly (oof), knockback (flung, flip, sit, scramble up), bowled (pin spin, pop up dizzy), lifted (dangling loop) |
| Death ×2 (kid-friendly) | dramatic swoon, comic faint |
| Cheer ×2 | fist-pump hop, arms-up wiggle |

**Checks** (the game's retarget, on goblin-grunt, gnome-cogger, dwarf-miner, steam golem): floor sink ≤1.7 %, planted-foot slide ≤2.9 %, loop seams 0, no backward knees, wrist ≤57° (props stay in hand). Retarget method "align" reproduces each unit's own Meshy clips within 1.2–1.7° per bone; plain delta 14–20°.
**Known quirks** (optional game fixes, told Anvil): golem lying deaths float 4–11 %; uneven-leg units (golem, some dwarves) hover one foot 2–8 % when walking/running; walk/run loops start mid-swing (cross-fade).
**How I split it:** I built the tools (pack builder, game-identical retarget checker), then ran 3 Opus helpers in parallel (idles; locomotion/cheer/lifted; combat/reactions/deaths), then merged, re-checked all 32 clips and did a visual pass of the renders.

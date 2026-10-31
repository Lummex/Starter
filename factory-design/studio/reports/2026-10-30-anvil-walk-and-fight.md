# Anvil, 2026-10-30: walking units and comic fights (batch, no preview yet)
On factory/issue-8 283fa07 (on top of live 9f261fb).
1. Units walk square by square (run on longer moves), turning to face each step. No sliding or teleporting except real teleports.
2. Attacks are a short comic scene: turn, step in, swing; the blow lands with a bonk (or clink on armour), stars or sparks, the pop-up; the defender is launched back with a backflip, lands with a thud and squash, and hops back. Ranged units shoot in place with a recoil. Deaths, hit flashes and pop-ups wait for the blow.
3. Shared animation pack loader ready (random idle per unit with a random start, random walk/run, Ken's shared slot picks play). Waiting for Spring's pack file.
4. Anvilsworn Miner is a 3D unit; Thane Borgo stands as a 3D commander on the dwarf stronghold (no throne model exists yet). Gnomes and dwarves confirmed 3D on the board.
Checks: 97 of 125 targeted hidden checks pass; the 4 failures are old (AC364, AC370) or load flakes (AC375 passes alone). AC80 updated for the Anvilsworn model. Size: dist ~100.6 MB (limit 250).
Helper: 1 Opus worker for part 4 (own worktree), merged by Anvil.

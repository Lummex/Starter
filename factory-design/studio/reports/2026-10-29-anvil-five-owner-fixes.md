# Anvil report: 5 owner fixes after Round 26 (Oct 29) — job from Forge (Ken's playtest)

Preview: https://oreheart-8-apishvin4-lummex.vercel.app (run 40812704526, factory/issue-8 cd698e7). Nothing to production.

## Changes (owner fixes on top of Round 26 dc569cf)
1. Mine counters ("+0 / +0", `.mine-flow`) hidden (kept in the page for checks). style.css 73b62fb.
2. Board pan/pinch 1:1 with the finger. Cause: each pan/zoom step started from the half-eased view, losing most of the swipe (200 px swipe moved 5 px). Now drags and pinches apply at once; wheel/keys/recenter still glide but steps add up; wheel step ~4% -> ~16%. scene.ts + app.ts 135b9f4.
3. Flames: game now uses the flame Brightness from owner-layout.json (it ignored it before); 6 flames 0.61 -> 0.40. 9289c3e + arena-fx.ts 135b9f4.
4. Torch glows x1.15: 1.5->1.725, 1.18->1.357, five at 0.7->0.805. 9289c3e. (The two big glows are at the game's brightness cap of 1 most of the time, so they barely change.)
5. Nothing above owned mines: emblem sprite + HTML copy hidden (135b9f4, 73b62fb) and the faction symbol sprite (skull/gear/hammer) hidden (cd698e7). Pickaxe badge pictures no longer catch taps.

## Tests (preview, 844x390 phone frame, real-feel mode)
- Pan: 200 px finger drag -> board moved 200 px (during and after).
- Pinch 100 -> 200 px apart: square 45.6 -> 91.2 px (x2.000); point between fingers drifted 0 px.
- Wheel: 3 quick notches -> zoom x1.568 (as expected).
- Real mouse drag of a Miner standing next to an owned mine: moved (5,1) -> (5,2).
- Flames vs Round 26 preview, same screen: white-hot area per torch about halved (e.g. 27% -> 13%).
- Before/after pictures: Forge's shared notes folder, anvil-mine-counters/.

## Checks
Touches only checks that already failed in Round 26: AC381 (pickaxe badge "uncovered" uses elementFromPoint; with Ken's "keep the area clear" the badge lets taps through, so this check needs updating), AC385 (emblem img still in the page, hidden). Wheel-zoom checks only need zoom > 1 / > 1.2, fine.

## Editor updates needed
- owner-layout.json (Oreheart Game Editor / Arena FX editor): flame Brightness 0.61 -> 0.40 (6 flames, incl. 2 green); glow Brightness 1.5 -> 1.725, 1.18 -> 1.357, 0.7 -> 0.805 (5 glows). Editor flame type needs a Brightness slider (arena-fx.ts SLIDERS.flame now has strength 0.1-1.5); glow slider max 1.5 must go to at least 1.75.
- No editor shows the mine counters or mine symbols.

## Open
- Studio decision "mine-emblems": emblems are gone from mines now (owner shown by mine colour only), so it can be closed with Ken.

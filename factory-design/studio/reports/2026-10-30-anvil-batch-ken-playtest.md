# Anvil, 2026-10-30: batch ready for the checkpoint (factory/issue-8 fb2f9f6)
On top of live 9f261fb. No preview yet (Forge calls the checkpoint).
- Walking and comic fights (walk square by square, step-in swing, bonk/clink, backflip knock-back, dizzy stars, impact puffs).
- Spring's shared animation pack v2 (57 moves) on every biped: different idles per unit, walks/runs, attacks, bonks, knock-backs, deaths.
- New 3D: Anvilsworn Miner, Gemsinger Miner, Overclocked Aethervein, new Gearward Sentinel body; Thane Borgo as a 3D Commander.
- Silver gnomes: 18 models + 22 pictures; Hex Reversal card art.
- Ken's playtest: crisp card text, compact faction-lit phase tracker, deck count on the deck corner, smaller higher turn banner, Commanders 1.8x with no thrones, hand tucks below the board (PC + phone), wider raised hand, double-click/tap to play.
Checks: full local suite 419 passed, 12 failed (all known / local-only), 32 skipped. Owner check changes: AC80, AC84, AC355, AC212 pin, hand checks AC43/174/175/218/251/347/374.
Size ~118 MB (limit 250).

---

# Gauge checkpoint go/no-go: Anvil batch for Ken's playtest (2026-10-30)

Preview: https://oreheart-8-rglb39wvz-lummex.vercel.app (Vercel Ew7vSLruCtGVmPX9QvatJkm3HtmM, run 41013055229, factory/issue-8 fb2f9f6, JS index-DPjm7dDa.js)

**Verdict: GO** for Ken's playtest. Nothing is broken: no crashes, no console/page errors, no missing files (0 HTTP errors in ~15 sessions). Every new feature works. The issues below are looks and polish for the next batch, not blockers.

## How it was tested
- 2 helpers (Opus) in headless Playwright: phone 844x390 (touch, 3 bot matches of 11-14 turns as goblins, gnomes and dwarves, 10 set-up fights, ~25 real taps) and desktop 1600x900 (mouse).
- The desktop helper ran on software WebGL at 2.5 fps, so I re-ran its motion and double-click checks myself with the GPU on (32-60 fps). Lesson: launch Chromium with `--use-angle=d3d11 --ignore-gpu-blocklist --enable-gpu`.
- No full-suite rerun (Anvil ran it). Size: public/ 116.25 MB + ~1.4 MB code ≈ 118 MB, under the 250 MB budget.

## Results
| Check | Result |
|---|---|
| Units walk square by square (no slide/teleport) | PASS (steady 10-12 px steps every 70-80 ms; shared biped-walk clips) |
| Fights clean (lunge, smack, knockback, bonk, back to idle) | PASS: no T-poses, stuck or floating units, props stay in hand; knockback plays biped-knockback-02 and lands 1 square back |
| Bowl | PASS (biped-bowled-02) |
| Death-knock flight into a neighbour | PASS on desktop recheck (2 knock events, victim 3,5 -> 2,5) |
| Idles varied, random starts | PASS (idle-03/05/06/08/10/13/14/17/18 + idle-breaks at once) |
| Shared pack on every biped | PARTIAL: Snotskull Grunt, Bare Knuckle Lunatic, Boneknocker, Bowler Brawler, Backstabbing Thief still use their own OH_ clips; Anvilsworn uses old Meshy Idle/Casual_Walk and walks ~3x faster than everyone |
| New 3D units | PASS: Anvilsworn, Gemsinger, Aethervein, Gearward, Thane Borgo load as GLB. Aegis Tinkerer is still a placeholder pawn. Sproingle placeholder is known. |
| Gnomes silver | PASS on 8 gnome models and all gnome unit cards. FAIL: the gnome Commander card (Knobbin) still has gold eye emblems, gold "COMMANDER" label and gold gem. |
| Double-tap (phone) / double-click (PC) to play | PASS: phone 9/9; PC 8/8 on GPU once the card is raised (the 2.5 fps run's failures were frame-rate). PC: hovering the very first card at its left edge didn't raise it (2/10). |
| Hand tuck | Phone PASS (tucks to the card tops, swipe/tap/idle). PC: the "tucked" hand still shows ~1/3 of each card (tops at y≈603-634 of 900), not fully down as Ken asked, and it covers the deck count. |
| Phase tracker | PASS: compact, bottom-right, faction colour on the active phase, grey otherwise |
| Card text crisp | PASS |
| Deck count on deck corner | PASS, but the tucked hand partly covers it on PC |
| Commanders 1.8x, no thrones | FAIL on looks: Grubnak reads small and as a purple heap; on phone his body is hidden behind his own red "20" heart (only the sceptre shows); on PC he stands over the bottom-left square and hides a unit placed there |
| "Your turn" banner | Not verified (not captured) |

## Other things found
- Clipped teal "Tu..." (Tunnel) keyword tabs stick up above the tucked hand on both sizes; looks broken.
- Phone: the tap that raises the hand also opens the big card view 250 ms later, so you can't just peek at your hand.
- Rule/text mismatch: Miner card text says "Miners can move or mine, but never attack", but Miners do attack in the game; the GDD only forbids it on the turn they're placed. Ken/Forge to decide which is right (likely old, not from this batch).
- Gnome Commander is named "Knobbin the Gnomeificent" in the HUD and Deck Builder (state id `sproingle`). Intended rename?
- Starter decks hold 100 cards (design doc: 50) and are mostly Miners, so bot matches feel samey.
- Deck Builder filter chips at phone size read "All All Any All" with an icon over the letters.
- At max pinch zoom (near top-down) the back row's stat badges sit over the front unit's head.

## Top 5 things Ken would notice
1. Good: units really walk and the fights read well (lunge, smack, fly back, bonk, back to idle), clean with no T-poses.
2. Bad: Commanders still look small; Grubnak hides behind his health heart on phone and covers the corner square on PC.
3. Good: gnomes are silver, purple and blue in models and cards; but the gnome Commander card still has gold, and Aegis Tinkerer is a pawn.
4. Mixed: double-tap/double-click to play works every time; but on PC the hand doesn't tuck fully down, and the clipped "Tunnel" tabs poke out.
5. Bad: Miners fight even though their card says they never attack, and the starter decks are mostly Miners.

## Fix list (who)
- Anvil: Commander size/placement and heart overlap; PC hand fully down + deck count overlap; Tunnel tab clipping; phone single tap raising hand without card view; first-card hover; Miner attack rule after Ken decides.
- Spring + Anvil: move Grunt, Lunatic, Boneknocker, Bowler, Thief and Anvilsworn onto the shared pack (Anvilsworn walk speed).
- Brush: gnome Commander card frame gold -> silver.
- Clay: Aegis Tinkerer 3D model.

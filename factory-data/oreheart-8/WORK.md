# Round 23: the hand like the layout editor, failing checks, flying units, Gnome/Dwarf sizes

Read "Round 23" at the top of SPEC.md. Keep everything from 8a–22 and the owner's direct changes (Gnome/Dwarf models, computer letterbox, crystal colors, status icons, badge ability icon, Card Comp controls bottom-right at 0.58, `.vercelignore`). **Do not touch any model file**, the badge, icons, crystal colors or letterbox. dist < 95 MB (AC90). Commit + push after each item.

Checks changed by the planner: AC272 (no home-row / 20 %-visible limits — owner layout decides), AC355 (Grubnak's own model allowed), AC360 (60 s limit). Owner-edited checks AC24, AC24b, AC80, AC84, AC355, AC357 (Gnome/Dwarf) are binding. If you must change another check, write which and why here.

## Rules & cards
- Mine Control stance: adjacent enemy Miner → attack when it survives the strike back and crystals aren't low; mine only if it would die or crystals are low (AC341). AI stance code in `src/engine/` / AI files.
- Card Comp vs Card Comp: Play → Pause → Play, no turns while paused, Exit to menu, plays to the end at 4× (AC344, AC368). `src/game.ts` `setPaused`, `src/ui/app.ts` `refreshModeUi` (keep the owner's bar position/scale).

## 3D & visuals
- Flying units: lift/bob/sway/shadow from the saved look's `flying`, Gyronaut defaults 0.35/0.06/0.6/3°/shadow; hooks `flying`, `lift`, `swayNowDeg`, `groundShadow` on figures (AC366). `src/ui/creature3d.ts`, `src/ui/scene.ts`.
- `DEFAULT_H`: dwarves 0.95, gnomes 0.85, Brunhilda 1.05, Ram Rider 1.35, Steam Golem 1.6, Beetle 0.9; beetle slides on move (`walk`) and shakes on hit (`hit`) without a skeleton (AC367). `src/ui/creature3d.ts`.
- Bowler Brawler `bowl` must complete and return the ball to `"hand"` quickly (AC360).
- Gnome/Dwarf models: make sure owner checks AC80, AC84, AC355, AC357 pass without editing model files.

## Interface
- Hand fan from `owner-layout.json` `hand` (overlap 0.2, angle 4, arc 1.45, popScale 1.6, popY 10, speed 450); remove `cw * 0.62` in `layoutHand`; add `getHandHover().fan` hook (AC363, AC272). `src/ui/app.ts`, `src/main.ts`.
- Tuck the rest of the hand as soon as a card is grabbed; stays tucked after play/cancel (AC364).
- Auto-tuck within ~1/3 s when the pointer leaves the fan, including onto the enlarged card (AC365). Verify with test flag off (`window.__app.test = false`) and real mouse at 1920×1080 and 1366×768.
- Tutorial "Skip Tutorial" button clickable (nothing covering it) → main menu (AC25).
- Letterbox / phone checks AC24, AC24b must keep passing (owner's change).

## Other
- Report: pass count; 1920×1080 screenshots of resting fan, raised fan with hovered card, Gyronaut hovering.

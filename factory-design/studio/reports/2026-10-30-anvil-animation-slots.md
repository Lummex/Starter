# Anvil report: Ken's animation slots drive the game (Round 28b, overnight Oct 29-30)

**Job (Forge):** export Ken's Oreheart Studio animation choices into the game, let the game pick clips by slot first, wire the slots the game already triggers, report which slots now drive the game. Nothing to production.

## What was built (branch factory/issue-8, commits a9c3c69..2efb7d3 after the go-live head 3ffab4a; the go-live deployment 52tgyqvy8J56HxQLSBc8Xi1txmTg is untouched)
1. `projects/oreheart-8/tools/export-anim-slots.mjs` (new, re-runnable): `node tools/export-anim-slots.mjs <studio dump folder>` reads the Studio's `animations` library and every `library/<card>` record and writes `src/content/anim-slots.json`. Only APPROVED animations go in; a pick of `none` means "no animation for that slot"; a clip that lives in another model's GLB is written with `shared: true` and is NOT played (no retargeting, see 3). Cards with no pick get the approved clips made on their own model as `candidates`, and when a role has exactly ONE candidate that is the clip the game already plays (or a role the game had no clip for), it is used automatically (`auto: true`) so nothing changes look without Ken.
2. `src/ui/creature3d.ts`: a card's slot picks come first, today's models.json logic stays as the fallback. New roles: `knockback`, `bowled`, `idleBreak` (fall back to `hit` / `idle`). Test hook `window.__animSlotLog` says what the slot file did per card.
   `src/ui/scene.ts`: a knock-back move (Smack, Shockwave, Bomber death-knock...) plays `knockback`; a bowled-over victim plays `bowled`; a card with an `idleBreak` clip plays it every 6-18 s while standing.
3. `tests/anim-slots.test.ts`: the slot file may only name clips the card's own GLB has. Passes.
4. **Forge's two extra items (Gauge's check):**
   - `public/owner-layouts/final-draft/layout.json` is now a byte copy of the game's `src/content/owner-layout.json` (flames 0.4, glows x1.15, hand overlap 0.26). The hidden checks read it (AC212 pins its size, AC229 its cut-outs), so it could not go to _discontinued; AC212's pinned size moved 34841 -> 34849 (one line, commit 7588d37). Please tell Ledger the local copies `layouts/final-draft/layout.json`, `github-upload/final-draft/layout.json` are still the old numbers (Gauge's list).
   - Card-frame fallbacks (`ohrender.ts`): units fall back to the current `frame:bottom-<faction>`, gnome spells to the silver shared frame. The three gold gnome frames (`frame-owner-gnome`, `frame-card-frame-gnome`, `frame-spell-frame-gnome`) left the build to `_discontinued/card-format-gold-gnome/` and their builtin lines left `format.json`, so a gold gnome frame can never show. 154 KB off the build.

## Which slots now drive the game (from Ken's approved animations)
- **Goblin Pebbler:** attack = OH_Attack, lifted = OH_React_Lifted (same as today), **knockback = OH_React_Knockback and bowled = OH_React_Bowled are NEW** (the game never played them before).
- **Bowler Brawler (goblin-scrapper):** attack = OH_Attack, special = OH_Special, walk = OH_Walk (same as today).
- **Goblin Bomber:** idle = OH_Idle (same as today). **Goblin Grunt:** defeat = Dead (same as today).
- Candidates waiting for Ken's pick (more than one approved clip, so not chosen for him): Pebbler hit (OH_React_Backstab / OH_React_Bonk / OH_Hit) and walk (Casual_Walk), Bowler hit (Hit_Reaction).
- Ken has made **no `animSlots` picks in the Studio yet** (0 of 69 cards), so everything above came from the auto rule. When he picks, re-run the export and rebuild.

## Slots the game has no trigger for yet (left for later)
run, fly/hover (gyrocopter still uses the Oct 28 fly logic), ride, tunnel, teleport, ranged (uses attack), charge, block, forge, heal, cheer, poke, stunned, summon, and all commander slots (Grubnak's approved idle breaks are commander-side and not wired by this job).

## Shared-library clips
None of the approved animations is picked for a card other than the model it was made on, so nothing needed retargeting; the mechanism flags such picks as `shared` and skips them. Retargeting between the Meshy rigs is not safe without checking each skeleton, so it stays off.

## Tested
- Real play at 844x390 and 1600x900: a Grunt kills a Bomber next to a Pebbler -> Pebbler slides one square and plays `OH_React_Knockback`; Bowler bowls into a Pebbler -> `OH_React_Bowled`. No page errors.
- Unit tests: new test passes (the 9 old vitest failures are the known ones: missing owner assets in a sparse clone, starter-deck counts, round12b, AI seed 2).
- Full local hidden-check suite on the slots build: **415 passed / 11 failed / 32 skipped** of 463 (go-live build on CI: 423/463). The 11 are all known: AC108 (pins the old "cavern" menu picture by name, see below), AC390/394 (gyrocopter, pre-existing), AC212 x2 + AC326 x3 (local-only: Windows line endings make the served layout file 37394 bytes; on GitHub it is the pinned 34849), AC364/AC370/AC375 (the known hand ones), AC383/384 (Done drop-up border, Ken's open call). After the two extra items the layout/menu/card-format groups (AC212-229, AC90, AC108, AC12x/13x, AC30x-32x) ran again: 67 passed, same known failures.
- **AC108 needs an owner-approved one-line update** (not done, not mine to change): it looks for `/cavern/` in the title screen's picture name, which went away with Ken's new front menu (Oct 29). It fails on the go-live build too. Proposed: `/cavern|menu-front/`.
- Game size: dist 94,832,278 bytes (~168 KB under 95 MB; was 94,978,702 at go-live). Round 27's texture shrink is still the way to make real room.

## Preview (NOT production)
- https://oreheart-8-5f3x7zc57-lummex.vercel.app — Vercel deployment id `CZrErcNWxz1YF5VaCUDij8R1yf1k`, built from factory/issue-8 head 2efb7d3 (run 40853064641).
- Verified live at 844x390 and 1600x900: Pebbler plays `OH_React_Knockback` on a death-knock and `OH_React_Bowled` when bowled; the slot log shows the 9 auto roles; layout copy 34849 bytes; the gold gnome frame files are gone (404) and `format.json` lists only `frame:bottom-gnome` for gnomes.
- The go-live deployment 52tgyqvy8J56HxQLSBc8Xi1txmTg (head 3ffab4a) is untouched.

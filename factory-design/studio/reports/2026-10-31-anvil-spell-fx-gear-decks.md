# Anvil report, 2026-10-31: spell FX, card-matched gear, decks merge

Preview: https://oreheart-8-clpev7pcw-lummex.vercel.app (factory/issue-8 83d95703, Factory — preview only run 41186584778). Previous preview with decks + gear only: https://oreheart-8-jjfvr7t9p-lummex.vercel.app (4c18aaae).

## Spell FX (Ken: "the fireball graphic looks awful. It's so tiny ... make it like an event")
- Brush's painted FX for all 13 spells play as 3D events on the board (src/ui/spell-fx.ts, data src/content/spell-fx-spec.json): windup at the caster's Stronghold, travel/impact, aftermath; arc / sky fall / throw / burrow / drop-in / swipe paths; additive glow, a flat ring, slow-mo 0.35x on fireball / meteor / mirror-hex, shake up to 6 px (never on Graphics: Low), a tint flash and the comic sound word. The emoji glyph FX are gone.
- PC loads the full painted set, phones the -m set (Phone mode, mobile browser, or a small touch screen). Timing and sizes are identical.
- The cast never waits for the FX; textures load ahead while the spell is in hand or deck.
- Real GPU (Ken's Chrome): casting fireball or meteor causes no main-thread task of 50 ms or more during the FX; the cast itself costs the same with or without FX.
- Checks AC470-AC474 (new) pass; 130 existing spell-related checks pass.
- Not done: gem flight into the Flow counter for Prospector's Prayer; per-unit hit flashes for Meteor. Sizes are exactly Brush's spec (fireball impact about 2.6 squares).

## Gear (Ledger's card-matched placements)
- Fixed looks: Gearward Sentinel mace + gear shield, Corpsman Brewlord crystal hammer (new file), Aethervein's two pickaxes, Arcsmith Miner pickaxe. Checked in the real idle: each on its bone, visible, reads like its card.
- Knobbin's staff: a fixed look cannot stay upright on a Commander (random idle per page load, the hand points very differently). It keeps the per-load upright solve with Ledger's len 1.18 and grip tuned to 0.335; foot within about -5% .. +9% of his height of his feet, crystal above his hat.

## Decks / Tunnel / dwarf rebalance (AI desk, merged here)
- Tunnel only beside a mine your side owns; twelve 60-card starter decks (Warband, Mine Rush, Arcane Hoard, Expedition per faction); Riot Shield Bearer is the dwarves' basic Miner and walks and mines while shielded; Hexslinger 3, Stormcaller 4. Report: 2026-10-31-anvil-decks-tunnel-dwarves.md.
- Clash resolved by Ken's later word: the AI desk had the "Tunnel!" tag back while you own a mine; Ken said remove all ability overlays, so no tag (AC50 checks the rule and no tag).
- 48 hidden checks either side touched pass; unit tests = the same 8 long-standing failures; AI replay goldens pass.

## What to try (Ken)
- Cast each spell (Fireball, Starfall Cataclysm, Venom Shiv, Thunderhorn Blast, Field Bandage, Ironclad Bulwark ...) on PC, and one on the phone.
- Pick each faction and look at the four decks; play Dwarves; Tunnel before and after you own a mine.
- Look at Knobbin, Gearward, the Brewlord, Aethervein.

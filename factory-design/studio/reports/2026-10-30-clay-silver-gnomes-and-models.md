# Clay – silver gnomes + 3 new gnome models (2026-10-30)
Job from Forge (Ken's Oct 30 delegation: Forge/Gauge judge against the card art).

## 1. Silver gnome textures (0 credits)
- 14 gnome units in the game + 4 gnome props (Tinker scepter, crystal shield, wrench; Gyronaut wings): gold/brass/bronze metal -> silver with a light-blue sheen. Cloth, skin, faces, hair, leather unchanged.
- Only the base-colour picture inside each GLB changed; a byte compare proves every other byte (mesh, UVs, bones, clips, other maps, JSON) identical. +1.07 MB total.
- Checked in 3D (front and back) beside Brush's silver cards. Files: local models/gnome-silver-oct30/ (handed to Anvil; Studio update to Wright).
- Tools: 2026-10-30-clay-silver-recolour.py (mask + recolour), -glbtex.py (extract/replace the picture), -lab.py.

## 2. New models (Meshy, once each; run #8, 41004185033)
| Card | Model | Accessories | Check vs card |
|---|---|---|---|
| gnome-prospector (Gemsinger Miner) | gemsinger-miner-silver | crystal pickaxe | matches (silver, glasses, crystal lamp) |
| overclocked-conduit (Aethervein) | overclocked-conduit-silver | pickaxe (mirror for 2nd hand) | matches: robot, 2 arms, no shield; shoulder canisters + back gem painted out of the views per the card |
| gearward-sentinel | gearward-sentinel-robot | spiked mace, gear shield | matches; the OLD game mesh was the little pink-haired gnome from the card corner (wrong) |
- Rig only (24-bone Meshy skeleton, no stock clips): script change 98fc83c (`"actions": {}`). Spring's shared pack supplies moves.
- Shrunk (textures only) + lossless meshopt pack, verified byte-exact after decode: chars ~2.7–2.9 MB, parts ~0.74–0.90 MB, +10.7 MB net in the game.
- Credits: 3 characters + rigs and 4 parts. Estimate ~225 by the price list; the exact number must be read from Meshy's balance (Banker).
- Studio: characters/*.steps.model set to approved (Forge). Wright adds the models; Ledger sets placements/heights; Anvil wires the game.

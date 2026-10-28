# Model reference check, Oct 27 2026

Checked every card in the Oreheart Model Editor: card art (owner painting) vs model reference sheet vs 3D model picture.

- Cards with a model or sheet checked: **52**
- Clear mismatches: **3** (Gearward Sentinel, Gemsinger Miner, Overclocked Aethervein)
- Spells and crystals with no 3D model (not checked, nothing to compare): 17 (Thunderhorn Blast, Soul Cluster, Searing Arcane Orb, Snuff Out, Wellspring Geode, Field Bandage, Heart of the Fallen, Pickpocket!, Starfall Cataclysm, Motherlode, Desperate Plunder, Emergency Rations, Ironclad Bulwark, Soul Shard, Unweave, Rat-Tunnel Ambush, Venom Shiv)

## Blocker
The picture maker (Art machine) ran, but OpenAI said **the account is out of credits**. So the 3 new sheets were not made yet.
Everything else is ready:
- Card art references (PNG) are on main in `factory-design/art-refs/2026-10-27-model-check/`.
- The request was `factory-design/art-requests/batch-model-sheet-redo-oct27.json` (failed results are in `factory-design/art-made/model-sheet-redo-*-oct27.json`).
- A ready retry file with new ids is `factory-design/art-refs/2026-10-27-model-check/retry-request.json`. After credits are added, copy it into `factory-design/art-requests/` and the sheets will be made. Then add each one to its card in the Model Editor as "Model sheet (redo, Oct 27): matches card art", waiting for approval.

## Check list

| Card | Matches? | What was wrong / notes | New sheet |
|---|---|---|---|
| Grudge Hurler (axe-thrower) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Barrelback Courier (barrelback-courier) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| SewerSlide Bomber (blastrat-sapper) | yes | Same character, colors and gear. | - |
| Corpsman Brewlord (brewmaster) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Iron Scarab Automaton (clockwork-beetle) | yes | Same character, colors and gear. | - |
| Thane Borgo Gravelgrim (cmd-borgo) | yes | Matches (no 3D picture saved). | - |
| Grubnak Rotgut Goblin King (cmd-grubnak) | yes | Same character, colors and gear. | - |
| Knobbin the Gnomeificent (cmd-sproingle) | yes | Matches (no 3D picture saved). | - |
| Gemdrunk Deepdelver (crystal-drunk-delver) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Crystal Node (crystal-node) | yes | Game piece, no card art. Crystal picture and 3D match. | - |
| Marksmen Gunner (deepforge-crossbowman) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Riot Shield Bearer (dwarf-miner) | close | Approved sheet and card match. Two older pictures on the card show a goblin miner (not approved, from Goblin Miner). Owner may want to remove them. | - |
| Ironjaw Big Back (dwarf-pickman) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Anvilsworn Miner (dwarf-smith-miner) | yes | Matches. Sheet not approved yet. | - |
| Granite Oathkeeper (dwarf-stoneback) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Gearward Sentinel (gearward-sentinel) | NO | Card art is a giant brass robot with a gear shield and spiked mace. Old sheet (marked Redraw) shows a pink-haired gnome girl; 3D picture shows only a mace. | Requested, not made yet (OpenAI out of credits) |
| Glyphshield Warden (glyphshield-warden) | yes | Same character, colors and gear. | - |
| Voldawright (gnome-cogger) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Mirrorveil Illusionist (gnome-illusionist) | yes | Same character, colors and gear. | - |
| Gemsinger Miner (gnome-prospector) | NO | Card art is a young gnome miner with glasses, purple cape and a blue crystal pickaxe. No model sheet left on the card; 3D picture shows only a pickaxe. | Requested, not made yet (OpenAI out of credits) |
| Arcsmith Miner (gnome-smith-miner) | yes | Bearded gnome, purple hat, crystal pickaxe: sheet and 3D match. | - |
| Aegis Tinkerer (gnome-tinker) | yes | Same character, colors and gear. | - |
| Brawler Adept (gnome-widget) | yes | Same character, colors and gear. | - |
| Bare Knuckle Lunatic (goblin-bomber) | close | Same character. Owner already asked for a redraw about gear/closed fists, not about the character. | - |
| Snotskull Grunt (goblin-grunt) | yes | Same character, colors and gear. | - |
| Boneknocker (goblin-pebbler) | yes | Same character, colors and gear. | - |
| Bowler Brawler (goblin-scrapper) | yes | Same character, colors and gear. | - |
| Goblin Miner (goblin-scrounger) | yes | Same character, colors and gear. | - |
| Skullflinger (goblin-slinger) | yes | Same character, colors and gear. | - |
| Scrapsmith Miner (goblin-smith-miner) | close | Approved sheet matches. One older "apron goblin" sheet does not match the card (not approved). | - |
| Backstabbing Thief (goblin-sneak) | yes | Same character, colors and gear. | - |
| Grimhold Ravager (grimhold-ravager) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Gronkowski Troll Tyrant (grubnaks-big-boss-troll) | yes | Same character, colors and gear. | - |
| Thunderwing Gyronaut (gyrocopter-ace) | yes | Same character, colors and gear. | - |
| Hexslinger Apprentice (hexwright-apprentice) | yes | Same character, colors and gear. | - |
| Bloodbeard Berserker (ironhammer-berserker) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Junk Shaman (junk-shaman) | yes | Same character, colors and gear. | - |
| Oathbound Overwatch (oathbound-pikeman) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Overclocked Aethervein (overclocked-conduit) | NO | Card art is a brass mining robot with pickaxes and a toothy grille mouth. Sheet (marked Redraw) shows a white-haired gnome. No 3D model yet. | Requested, not made yet (OpenAI out of credits) |
| Gnome Plow (phase-stalker) | yes | Same character, colors and gear. | - |
| Queen Brunhilda (queen-brunhilda-stonebeard) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Thunderhorn Ram Rider (ram-rider) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Goblin Chef (rotgut-grenadier) | yes | Same character, colors and gear. | - |
| Door Splitter (rune-splitter) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Soul Stone Siphoner (runic-siphoner) | yes | Same character, colors and gear. | - |
| Goblin Rocket Rider (shard-guzzler) | yes | Same character, colors and gear. | - |
| Ironwall Shieldbeard (shieldbeard) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Shiv Rat (shiv-rat) | yes | Same character, colors and gear. | - |
| Skullbasher Rusher (skullbasher-rusher) | yes | Same character, colors and gear. | - |
| Stormcaller Savant (spark-gnome) | yes | Same character, colors and gear. | - |
| The Arcane Colossus (the-great-steam-golem) | yes | Same character, colors and gear. No 3D picture saved; checked sheet vs card. | - |
| Mangewolf Rider (wolf-rider) | yes | Same character, colors and gear. | - |

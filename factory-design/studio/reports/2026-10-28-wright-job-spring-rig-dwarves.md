# Job for Spring: add skeletons + default moves to 2 dwarves (Oct 28 2026)

From Ken, directly to Wright, to hand to Spring. Forge: please pass to Spring.

**Ken's choice: no Meshy. Use the Blender worker.** (Meshy runs once per model; these two were made outside the Meshy pipeline and never got its rig step.)

## The two models (checked by Wright: 1 mesh, 0 skins, 0 animations each)
| Card | Card id | Unrigged model on main | Size |
|---|---|---|---|
| Anvilsworn Miner (model: Stonebreaker Miner) | `dwarf-smith-miner` | factory-design/models/dwarf-smith-miner/anvilsworn-miner-unrigged.glb | 2.4 MB |
| Thane Borgo Gravelgrim (commander) | `cmd-borgo` | factory-design/models/cmd-borgo/borgo-unrigged.glb | 2.6 MB |

Neither is in the game folder (projects/oreheart-8/public/models/creatures/) yet. Copies also live in Oreheart Studio as models/stonebreaker-miner.glb.txt and models/borgo.glb.txt (base64). Their props (pickaxe, hammer, gear sceptre, throne) are separate models and need no skeleton.

## What Ken wants
1. A humanoid skeleton on each (same bone names the other dwarves use, so moves can be shared in the Model Editor). Don't change geometry, UVs or textures.
2. The same default moves the other dwarves got from Meshy: **idle, walk, attack, hit, defeat**. Loop idle/walk. Feet stay planted on idle.
3. Borgo is a commander who sits on his gear throne. A seated idle would be good as an extra. Ask Ken first.

## Notes for Spring
- The worker's job type today is `animate` (expects a rigged model). It needs a rig step first, e.g. Rigify/auto-weights in Blender. If the worker can't rig yet, say so in your report. Don't run anything live without Ken's OK; he gave it for this job.
- Put the result in the Model Editor the usual way (new `-vN` entry), so Ken can approve each move in the Studio: Model Editor → character → Animation → Approve the moves.
- Old unrigged files go to _discontinued when replaced, never deleted.

## Status now
The Studio shows Anvilsworn Miner's "Posing & animation" step as Working · Spring. Borgo isn't on the Studio's character list (commander), so his request is in the Model Editor library only.

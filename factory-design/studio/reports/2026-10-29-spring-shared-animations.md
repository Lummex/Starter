# 2026-10-29 – Spring – Shared animations (Forge job)

Ken's wish (Oct 29): shared animations picked per character from dropdown slots (Idle ≤10 in the library, Idle Break, Walk ~2, Run, Attack, Special Attack, Special Ability, Bonk, Death), "shareable between all the characters"; animals / multi-legged bodies get their own sets. Wright builds the slot UI; Anvil does the game side later.

## 1. Feasibility: YES for all bipeds
- All 45 rigged game models (factory/issue-8 `public/models/creatures/*/char.glb`) have the **identical Meshy 24-bone skeleton** (same names, same hierarchy, no finger bones). clockwork-beetle has no skeleton. ram-rider / wolf-rider are the normal biped rig on a separate mount model.
- Rest poses differ a lot (bones 10–100° apart), so copying raw bone rotations by name would twist limbs. Retargeting by "world-space change from rest" per bone works: `studio/agents/spring-retarget.py` (Blender 5.2 headless, worker's blender_ops helpers, ~15–20 s per clip, hips movement scaled by hip height).
- Checks: goblin→itself 0.0° error. Goblin's Meshy walk → dwarf-miner: 31.8° mean from the dwarf's own Meshy walk (an unrelated clip scores 87°), and renders show the same stride.
- Tested by render: sneak backstab → gnome-cogger + the-great-steam-golem (2× taller), bomber shadow-box idle → gnome-cogger + Grubnak, scrapper bowling attack → dwarf-miner. All carry over cleanly; feet stay on the floor (worst sink 2.4 % on the dwarf walk).
- What can break, and the fix:
  - Props ride on the hand bone, so held items follow. But moves that touch something (two-handed grip, hand to head, a ball released at a set frame) can miss on very different arm lengths → per-character check + small fix-up when Ken flags it.
  - Short legs take shorter steps (intended); moving speed in the game should follow hip height.
  - Lying/death clips: mesh thickness differs → per-character floor pass (lift hips so the lowest point stays on the floor).
  - The Studio previewing one model's clip on another by bone name will look wrong for some models (rest poses differ). For the game and for exact previews, bake a per-character copy with the retarget tool.
- Body types: biped (all 45 now). Quadruped / multileg / flyer need their own rigs and sets (none rigged yet).

## 2. Library seeded (Studio `animations`, 65 docs)
- 20 approved (from Ken's `animApprovals` in `library`, each checked): idle 1 (bomber shadow box), idleBreak 2 (Grubnak call gesture, victory fist pump), walk 2 (Meshy casual walk, scrapper walk), attack 2 (pebbler, scrapper), special 2 (scrapper bowling, Gemsinger 360 spin jump), bonk 7 (6 goblin reactions + Meshy hit reaction), death 1 (Meshy Dead).
- 45 waiting for Ken: the per-goblin idles/walks/attacks, stock Meshy moves Ken hasn't judged, the Runway-based Blender clips (grunt/grenadier deaths, slinger throw, sneak jab, bomber idle + shadow box), gyrocopter flyer set, Grubnak's throne sit / chest pound / spell cast, Gemsinger run.
- Each doc: slot, bodyType, clip, file {modelKey (Studio bundled key), repo}, fromCard, takeId, status, note (where Ken approved / removed it).
- Not yet: preview videos per entry; per-character baked copies (made on demand when Ken picks a slot).

## 3. Requests (Ken: "have an agent create a new animation")
1. Ken's slot button writes `animRequests/<id>` = {slot, bodyType, card, desc (his words), status "wanted"}. Spring (when Forge sends a job, or at the start of any Spring job) queries status == "wanted".
2. Spring sets status "working" + agent "Spring".
3. If the move is new: Runway reference video (cheapest model, 480p, 6 s, front view, gentle words) from Ken's saved Studio look → `takes` doc "waiting". Small variations of an existing move skip Runway.
4. Blender direct (headless, new file, never overwriting a model), checked with the clip checker (floor, loop seam, foot drift).
5. Upload GLB/preview as Studio assets; new `animations` doc status "waiting"; request status "waiting" + animId. Ken approves or rejects in the slot → request "done" / "rejected".

## How I split it
One helper (Opus) made the clip inventory from the Studio and blender-queue while I did the rig survey and retarget tests; I checked its approved list against Ken's records before seeding.

# Clay – notes (long-term memory)

## Oct 28, 2026 – rigged remakes (Anvilsworn Miner, Borgo)
Report: factory-design/studio/reports/2026-10-28-clay-rigged-remakes.md

### How things work
- `meshy-models.mjs` ALREADY rigs every job (Meshy rigging → animations) unless the job has `"rig": false`. Output char.glb has the standard 24-bone Meshy rig (Hips … RightToeBase) = same as all our units. Action ids: idle 0, walk 30, attack 128, hit 178, defeat 8, mine 237 (= Charged_Axe_Chop).
- A model is skipped if `factory-design/models/<id>/models.json` exists. For a remake (Ken's OK only), use a NEW job id (e.g. `<name>-rig`) and new view pictures `<id>--char-{front,side,back}.jpg` in factory-design/meshy-jobs/. Run the workflow with `only = <ids>`. Two characters took ~10 min.
- Meshy raw output is ~15 MB (three 2048 maps: base JPEG, normal PNG, metal/rough PNG). Textures to 512 JPEG → ~2.4–2.6 MB. The rest (~2.2 MB) is mesh + clips (not allowed to shrink).
- Cropping views: pad each view onto a white square with ~8% margin, 1024 px JPEG.

### Tools that work (no GitHub token)
- Cloud shell cannot reach GitHub at all (403). npm/pip registries also failed. Do everything GitHub-related in my Chrome tab.
- Read files: on a github.com page, `fetch('https://github.com/Lummex/Starter/raw/main/<path>')` works (no rate limit, binary OK). The api.github.com contents API is limited to 60 calls/hour – avoid it.
- Long text out of the browser: write it into the page (`<pre>`) and use get_page_text (javascript_tool output is cut at ~1000 chars).
- Upload to GitHub without touching Ken's disk: on the /upload/ page, file_upload works with files in /mnt/user-data/outputs; files built in the browser can be added with `new DataTransfer()` + `new File([...])` + input `change` event. Keep big browser data in IndexedDB before navigating (page JS is wiped on navigation).
- Checking a GLB in the browser: parse GLB, do linear-blend skinning myself, draw triangles on a canvas (front/side/back, test pose, a clip frame). Screenshots with save_to_disk land in the cloud (/tmp/claude-chrome-screenshots-*), so they can be uploaded as Studio assets.
- Studio: ArtifactData `update` merges top-level fields; to change one step I send the whole `steps` object. Commanders had no `characters` doc; I created `characters/cmd-borgo`.

### Watch out
- Old Stonebreaker Miner model had a RED beard; Anvilsworn card art and the approved sheet have a BLACK beard.
- Borgo's `borgo-front.webp` ref has the right glove cut off at the picture edge; the sheet's front figure overlaps the next figure, so it can't be cropped cleanly.
- Size: game ≈ 92.43 MB after Round 27; every new rigged character is ≈ 2.5 MB. Flag before adding.
- Only Wright publishes the Studio page (Model Editor model files). Leave Wright a note in the report.

## Oct 29, 2026 – lossless meshopt pack of the two rigged dwarves (Round 27 size)
Report: factory-design/studio/reports/2026-10-29-clay-r27-dwarf-pack.md (scripts next to it).
- Lossless way to pack (Ken's "never touch geometry" rule): NOT gltfpack (even -noq can reorder/dedup vertices and resample clips). Use meshoptimizer's `encodeGltfBuffer` per bufferView: ATTRIBUTES mode, no filter, byteStride = element size (must be a multiple of 4); indices in INDICES mode. Pictures copied as is. Fallback buffer 1 + EXT_meshopt_compression required. Saves ~28% (2.6 MB → 1.84 MB). Prove with a decode + byte compare using three's own decoder, plus a pixel diff render (got 0).
- Learned: TRIANGLES index mode came out BIGGER than INDICES mode on Meshy index lists (not vertex-cache ordered). Try both, keep the smaller.
- Local PC setup: conda Node env in scratchpad (~3 min), `npm install meshoptimizer@0.22.0 three@0.170.0` (the game's three). In Git Bash put the env on PATH as /c/Users/… (a "C:/…" entry breaks PATH because of the colon).
- Render check: .claude/launch.json "clay-check" serves my scratchpad r27 folder on 5191; compare.html uses an importmap to node_modules/three.

## Oct 29, 2026 – Overclocked Aethervein (robot, gnomes)
Report: factory-design/studio/reports/2026-10-29-clay-aethervein-model.md
- Whole job locally on Ken's PC: crop views with PIL (cut figures by connected shape when views touch on the sheet), upload views + jobs.json in ONE commit on /upload/main/factory-design/meshy-jobs, Run workflow with `inputs[only]` set by JS, watch the run with a background until-loop (took 5 min), download char.glb from the bot's commit sha.
- Texture shrink tool: reports/2026-10-29-clay-shrink-textures.py (`jpeg88` = all maps JPEG q88 4:2:0 = same as my Oct 28 files). Checks every non-picture byte and the JSON.
- Learned: steam puffs on a sheet must be painted out COMPLETELY. Faint wisps I left at the pipe tops became two small grey flags in the model. Next time check the cut views zoomed in at 100% before uploading.
- Learned: on robots/golems whose face is on the torso, Meshy's head bone sits in the face, and the Idle clip folds the face (the grin hides). Always check the face in rest pose AND idle; tell Spring.
- three.js check: add RoomEnvironment as the scene environment, or Meshy's metal looks almost black. skeleton.pose() for the rest pose breaks later mixer shots on the same cached scene, so do it last.

## Oct 30, 2026 – silver gnomes + Gemsinger / Aethervein / Gearward models
Report: factory-design/studio/reports/2026-10-30-clay-silver-gnomes-and-models.md (tools next to it: 2026-10-30-clay-silver-*.py).
- Silver recolour, no credits: swap ONLY the base-colour picture inside the game GLB (glbtex.py keeps every other byte; meshopt bufferViews keep their compressed data, only offsets move). Mask in Lab: hue 50–90 + chroma >28 = gold/brass; dark bronze 40–50 only when L<50; light peach (L>62, hue<62) protected; head/neck bone-weight UV map (baked in three.js) makes brown beards/brows safe. Silver = luminance ×1.3 contrast + tint (0.90,0.97,1.07).
- Learned: HSV hue can't split skin from bronze; Lab can. First pass turned a brown beard grey and a forehead pale: always check faces close-up in 3D, front AND back.
- Meshy: "actions": {} now = rig only (script 98fc83c), saves the clip cost; the GLB has the 24-bone rig and one rest clip. A 3-character + 4-part run took 5 min.
- Learned: pressing Run workflow on the Meshy workflow is blocked for agents (spends credits). Prepare everything; Ken or Forge presses it.
- Learned: when the sheet shows things the card doesn't (Aethervein canisters, back gem), paint them out of the views before Meshy; it worked cleanly (polygon fill with row background).
- Packing: shrink.py jpeg88 (char 1024, parts 512) then r27 pack.mjs (INDICES won every time); verify.mjs EXACT. ~15 MB raw -> ~2.8 MB char, ~0.75–0.9 MB part.
- Oct 30 run #9: 3 locked Commanders (Skreeka, Sprocket, Grumblebeard) rig-only + Sproingle rigged from his existing model ("model" job option, script 830751f) all worked first time. Learned: a props "batch" sheet (3 props laid apart) gave ONE prop only (the middle hammer); Meshy picks one subject. Make props one per part. Split tool kept: models/accessories-oct30/split_props.py (welded-connectivity grouping, UV crop, grip pivot).

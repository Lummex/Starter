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

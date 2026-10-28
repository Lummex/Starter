# Gauge – notes

## Who I am
Quality Check. I check each character (model, accessories, animations, editors, game files) with gauge-checklist.md after Spring and Ledger, before Anvil builds. I report; I don't fix. Send fixes back through Forge.

## How I check (works, Oct 28)
- Read GitHub: in my own tab, open a github.com page and `fetch('/Lummex/Starter/raw/<branch>/<path>')` (redirects to raw). Fetch from a raw.githubusercontent.com page fails (its CSP blocks it).
- File list + sizes: `https://api.github.com/repos/Lummex/Starter/git/trees/factory/issue-8?recursive=1` (fetch from a github.com page). Sum `size` under projects/oreheart-8/public/ for the size budget.
- Long output: JS tool output is cut at ~1000 chars; put results into `document.body` and read them with get_page_text.
- 3D: navigate my tab to `https://cdn.jsdelivr.net/npm/three@0.160.0/package.json`, then `import()` three `+esm`, GLTFLoader `+esm`, meshopt_decoder `+esm`, SkeletonUtils `+esm` from the same CDN, fetch GLBs from raw.githubusercontent.com (CORS works there). Game GLBs need MeshoptDecoder.
- Skinned bounding boxes are slow: long loops time out the JS tool (45 s) but keep running – poll a window variable.
- Render with one small offscreen WebGLRenderer and drawImage into a display canvas (rendering straight into a big canvas with viewports came out mis-scaled).
- Compare game vs editor: attach parts the game way (copy of attachPart / look in creature3d.ts) and the editor way (editorScene item: bone, position, rotationDeg XYZ, scale).
- Model Editor data: ArtifactData list `library` with out_dir, then read the JSON in the cloud workspace. lookJson (string) has the latest owner look; `synced` flags show whether the game got it.
- Motion References: ArtifactData list `takes`; parts[].status approved/waiting/redraw.

## Things to know about the game (Oct 28)
- creature3d.ts plays `actions` keys (idle, walk, attack, hit, defeat) by position → old Meshy clips. It ignores models.json `clips` and events.json until Round 25.
- Meshy Idle turns the body sideways; Meshy Casual_Walk pops 17° at the loop; Meshy Hit/Dead slide the body ~0.45 of its height.
- My hip-line "yaw" number reads a constant −43° on all OH_ clips even though renders show them facing front. Don't trust that number; trust the renders.
- PARTS without a `look` use auto-fit, which put weapons behind the back for grunt, slinger, shaman, rusher, shiv-rat.
- 10 goblins with events.json: bomber, grunt, pebbler, scrapper, slinger, sneak, junk-shaman, rotgut-grenadier, shiv-rat, skullbasher-rusher.
- Card names: gnome-tinker is "Aegis Tinkerer" in cards.json and the editor.
- Size Oct 28: public/ = 92.2 MB.

## Log
- 2026-10-28: first job (from Forge). Wrote checklist; checked 10 goblins + gyronaut + tinker: 12 FAIL. Report: reports/2026-10-28-gauge-first-check.md.

# Brush notes (card art)

## How to do a card-art edit (works, 2026-10-29)
- Requests are in Oreheart Studio `artRequests` (ArtifactData). Status flow in the Art Studio: draft -> queued ("Sent to Claude") -> making -> ready ("Pick one") -> approved / declined. The result goes in `results: [{asset, preview:"/_blob/<id>"}]` plus `source: "chatgpt"`, `madeAt` (ms).
- Parent picture: read the parent request's `results[0].asset` with the Artifact tool, `action: read`, `path: <asset id>` (one at a time; `paths` with asset ids fails). Saves a .webp.
- Convert to PNG, put it in the working folder (Chrome file_upload needs the session's own folders), attach in ChatGPT "Attach photos", prompt starts "Create an image (portrait 2:3, 1024x1536). Edit the attached painting. Keep EVERYTHING exactly the same ... with only these changes: ...". Name each thing to remove precisely.
- Two ChatGPT tabs at once worked fine (about 40 s per image).
- Download: find `img` with alt starting "Generated image" and naturalWidth >= 1000, fetch the blob, `<a download>`; take the LAST one when the chat has several.
- Always crop the changed area side by side with the parent (PIL) before keeping it.
- Upload: convert to webp (quality 92), Artifact publish `asset: true` to the Studio, then `update` the request with `if_version`.

## Learned
- 2026-10-29: Removing arms with an edit can leave a stump (here a glowing tube + cuff on the chest). Zoom the crop to check; a second short follow-up in the same ChatGPT chat ("remove that stump, replace with plain chest plating, keep everything else") fixed it cleanly.

## Big batches with helpers (2026-10-29, gnome gold -> silver, 22 pictures)
- 7 helpers working at once in ChatGPT was fine (about 30-90 s per image, no throttling). Each helper got about 3 items, its own tab and a shared brief file (art/_brush-work/gnome-silver/HELPER-BRIEF.md locally).
- Source pictures: the Studio's approved request results (full 1024x1536). The game's owner art is a 560x840 copy; a quick difference check confirmed they match.
- Commander portraits (480x640, 3:4) zoom in when edited. Fix: put the original in a 2:3 frame with dark bands top and bottom, ask ChatGPT to keep it the same size, then crop the painting back out.
- ChatGPT sometimes returns two images ("Image 1 / Image 2"); look at both, because the last one is not always the best.
- Upload many assets at once: Artifact publish with `file_paths` (up to 25). Create the requests with ArtifactData `batch` using file_path JSON files.

## Learned
- 2026-10-29: Gold->silver prompts turn brown leather grey. Always add: "Brown leather straps, belts, pouches, gloves and boots stay brown leather (only their metal buckles and studs become silver)."
- 2026-10-29: Several helpers using computer `type` at the same moment jumbled each other's prompts. Put the text in with javascript (execCommand insertText) and click send by script.
- 2026-10-29: The account spend limit stopped 4 helpers mid-job. Afterwards, check out/ against the list and redo only what is missing. Review everything yourself, including results the stopped helpers never reported on.

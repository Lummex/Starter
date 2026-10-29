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

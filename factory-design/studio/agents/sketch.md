# Sketch – notes

## How to make a sheet (works, Oct 28)
- Card paintings: `projects/oreheart-8/public/art/owner/gnome/<card>-card-art.webp` on factory/issue-8. The folder is `gnome`, not `gnomes`. Find paths with the GitHub tree API (`api.github.com/repos/Lummex/Starter/git/trees/factory/issue-8?recursive=1`) if a raw URL gives 404.
- Convert webp to png (Pillow) first. Chrome file_upload only takes files from the session's folders (scratchpad works, ~/Downloads doesn't), so copy the file there.
- ChatGPT: find "Attach photos or videos" (file input, image/*), file_upload, click the message box, type "Create an image (landscape 3:2). A 3D-modeling character reference sheet of ... from the attached card painting. Match the painting exactly: <list every detail>. Full body neutral A-pose, empty hands, FRONT / SIDE (left profile) / BACK on plain light grey, small labels. Along the bottom each accessory on its own...", Enter.
- Two tabs at once work fine; each image takes about 1–2 minutes. Don't wait 60 s in one JS call (it times out at 45 s); 20–30 s is fine.
- Download: newest `img` with naturalWidth >= 1000 -> fetch blob -> `<a download>` -> lands in ~/Downloads. Move it into the job folder, look at it next to the card art.
- Studio: Artifact publish `asset: true`, `file_paths` (from scratchpad) -> asset id. Then one ArtifactData batch: `library/<card>.refs` append {askedAt, asset, kind:"sheet", label, note, url} (no status), `characters/<card>` images.sheet + steps.sheet {status:"waiting", agent:"Sketch", link, note, updatedAt}. Send whole `steps` and `images` objects (copy of what was read, one field changed), pinned with if_version.
- Leave side characters from the card out (e.g. the gnome girl next to Gearward Sentinel).

## Log
- 2026-10-28: Redid Gearward Sentinel and Gemsinger Miner (gnome-prospector) sheets; both waiting for Ken. Ken's Oct 24 note on the old Gearward sheet: "the card is a humanoid looking robot with a shield". Gearward also needs the gear shield as an accessory (library only lists the mace).

## Learned
- 2026-10-28: Chrome file_upload refused ~/Downloads; copy files to the scratchpad first. A 60 s wait in one javascript_tool call timed out (45 s limit); wait 20–30 s per call. Raw GitHub 404 for owner art: the folder is `gnome`, not `gnomes`.

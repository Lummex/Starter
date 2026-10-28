# Anvil report – Ken's mine-all pickaxe icon (Small fix 10)

Date: 2026-10-28. Job from Forge (Ken's request, fast path, no factory round). Nothing live.

## What I did
- Ken's file C:\Users\kentu\Downloads\oh-pickaxe-1810\ken-mine-all-pickaxe.png (1263x1246, transparent) used as-is: no redraw, no recolour. Only scaled down.
- Game copy: projects/oreheart-8/public/art/ui/mine-all-pickaxe.webp – 256x256 WebP, transparent, 16.5 KB (game grows by ~0.02 MB).
- Original kept on main: factory-design/design/ui/ken-mine-all-pickaxe.png (not in public/, so it does not count toward game size).
- Code (factory/issue-8): the mine-all badge was a CSS-drawn pickaxe (three <i> pieces). It is now one <img class="pk-img"> with Ken's icon inside the same span.pickaxe badge, so the earlier fixes stay: the whole pickaxe is visible (.site-mark.ready clip-path none), it stays inside the window (fitMineBadges), and the mine-icon layering (emblem sprite in 3D) is untouched. New CSS rule at the end of style.css makes the image fill the badge box without cropping (object-fit: contain).
- Commits on factory/issue-8: 9d95c47 (image), then the style.css commit, then 9d92f74 "Owner art: Ken's mine-all pickaxe icon (Oct 28)" (app.ts). Original on main in a separate commit.

## Checks
- Branch file at 9d92f74 contains the new image tag; image file exists at the new path; style.css has the rule.
- Mock test (same CSS, headless Chromium): Ken's icon loads (256 px) and shows complete above the "x2" count, nothing cut off.
- The badge keeps its old swing animation, so the icon tilts back and forth a little. If Ken wants it still, that's a one-line change.

## Preview
- Factory — preview only run #23 started after the last commit (one preview with all 10 fixes): https://oreheart-8-gd4gac0wt-lummex.vercel.app
- Still "Deployment is building" (queued) on Vercel after ~30 minutes because of the build-queue jam, so NOT yet tested in the real game on desktop or phone width.
- Chrome could open *.vercel.app this run (the earlier permission block is gone), so the next run can test it.

## Editors
- This is a game UI icon, not a card/model, so no Studio library/model data changed. The Studio Card/Model editors don't show this badge.

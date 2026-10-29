# Anvil report: 14 stale Round 26 checks updated (Oct 29) — job from Forge
Forge decided (Ken delegated non-visual calls): bring checks in line with Ken's own owner changes.
- Updated: AC58 x2 (Rocket Rider is a Fighter; no mine hover pop-up), AC135 + AC168 (Ken's upright text exempt from all-italic), AC176 (deck-menu.png pile), AC216 (Ken's 8 Menu items), AC318 (ability button in the stat badge), AC341 (shield 2: dwarves beat goblins), AC345 (hover the slide-out stance column), AC371 (88 % card fit), AC381 x3 (×2 beside Ken's pickaxe; the board canvas and the badge's own mine button don't count as covers), AC385 (no emblem above owned mines). Each change has an "Owner change (date, commit)" comment.
- Drafted by the 3 triage helpers (Fable) as patch files; I applied them as the only writer and fixed AC381 twice after running it.
- Checked locally (factory/issue-8 @ cd698e79 built on Ken's PC, Playwright 1.56.1 + Chrome): old spec 14 fail (same as CI), new spec 14/14 pass twice; AC381 still fails with a panel over the badge.
- Not committed: the file lives on factory/issue-8 (single committer there). Handed to Forge in the shared notes folder anvil-check-updates/.

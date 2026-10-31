# Anvil report: Gauge's go-live cosmetic list (Oct 30)

Source: `factory-design/studio/reports/2026-10-29-gauge-go-live-check.md`, "Cosmetic list for Anvil". Forge-approved batch, built direct on factory/issue-8 after the animation-slots commits. Nothing to production.

| # | Gauge's item | What changed | Where |
|---|---|---|---|
| 1 | Phone: Welcome box sits on the Auto/PC/Phone switch | The Welcome box now sits 34 px above the switch (phone and desktop; it overlapped on both) | style.css `.overlay.welcome` |
| 2 | Phone: Choose Your Commander deck strip clipped | On phones the three starter decks fit the strip: deck slots 110 px (were a fixed 132), Remove / Copy buttons 12 px, smaller gaps | style.css `@media (max-width:900px)` |
| 3 | Phone: defeat screen taller than 390 px | The result screen fits 390 px with no scroll (smaller banner, tighter table) | style.css `@media (max-height:480px) .screen.end` |
| 4 | Big card view: no close button, Escape doesn't close | Escape now closes it from anywhere (before, only while the focus was inside the box). **No Close button**: hidden check AC250 (round 10 rule) says the card close-up has no Close; outside tap closes. Ken's call if he wants one — then AC250 changes with it. | app.ts card view |
| 5 | Tutorial says "Grubgrabber Miner" | Now "Goblin Miner" (the card's name) | tutorial.json |
| 6 | Computer's revealed cards drawn top-left over the arena | **Left as designed**: round 10 put enemy plays at the left edge, 42 % down (yours at the right edge); the "top-left" look is the first frames of the slide-in. Say the word and they move (e.g. beside the enemy Commander). | — |
| 7 | Desktop: Done drop-up / give-up dialog overlapped by the turn text and countdown digit | While the drop-up is open the turn text and countdown are hidden; while any dialog (give up, etc.) is open the countdown digit is hidden | style.css `:has()` rules |
| 8 | Phone: open hand fan covers rows 5–7 | **Left as is**: with a mouse the fan stays open while the pointer is inside the owner's hand hover box (Round 8 rule), and on touch it tucks 80 ms after the finger lifts. Changing when the fan tucks is a feel/visual call for Ken; one option is tucking as soon as the pointer rises above the raised cards' tops. | — |

## Commits (factory/issue-8, after the animation-slots head 2efb7d3)
89069b3 AC108 owner check change (/cavern|menu-front/; checks only, no preview) · cd9082e app.ts · f784470 style.css · 9c39810 tutorial.json.

## Checks
- Local run of the 66 checks that cover these screens (welcome/tutorial AC25, countdown AC32/37, drop-up AC41/383, result AC74, size AC90, card views AC98/116/134/239/250/309-317/325/358, Choose Your Commander AC146/205/233/338/346, layout AC212, hand AC36x/37x, AC108): **60 passed / 5 failed / 1 skipped**, all 5 known and unrelated: AC212 x2 (local line endings only), AC364, AC370/372, AC383/384 (border colour, Ken's open call). AC108 now passes with the owner change.
- Before/after screenshots: side-session-notes/anvil-cosmetic/before and /after (phone 844x390 and desktop 1600x900).
- Game size: dist 94,833,182 bytes (~167 KB under 95 MB).

## Preview (NOT production)
- https://oreheart-8-pt8tew5un-lummex.vercel.app — Vercel deployment id `4aueA598eb4WZida3oXWkdtRhUei`, built from factory/issue-8 head 9c39810 (run 40884526679). It also carries the animation-slots work (2efb7d3) and the AC108 check change.
- Verified live at 844x390 and 1600x900: welcome box clear of the display switch, three decks visible on Choose Your Commander, result screen with no scroll at 390 px, Escape closes the card view, turn text / countdown hidden behind the drop-up and dialogs, "Grubgrabber" gone from the bundle.

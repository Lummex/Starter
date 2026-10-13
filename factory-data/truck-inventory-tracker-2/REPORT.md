## What was built
A phone-friendly Chas Roberts Truck Inventory app for service techs. They can add parts by typing, talking or tapping a photo, and record parts used on jobs or bad parts. A printable Parts List grouped by category, a restock list and downloadable reports are included. Everything is saved in the browser on that device.

## Try these things
- On Inventory, add "Angle stop" (quantity 3, alert at 2), then add "angle stops" and check it merges into one row.
- Open Parts List, check the category grouping and totals, and try the Print button.
- On Quick Add, type "add 3 angle stops and 2 90 degree elbows", tap Read list, then Save to inventory.
- On Use Parts, record 2 angle stops for job 1001, then record one as a Bad part. Check Restock and tap Mark replaced.
- On Reports, filter by job number 1001 and try the CSV downloads.
- Open the preview on your phone and check the menu and Photo Count (tap a photo to count parts).

## Automated checks
23 of 23 checks passed. No page errors were recorded.

## Things to know
- **The logo is a placeholder.** The real logo wasn't in the project, so a simple "CHAS ROBERTS" banner is showing. Drop your real file over `public/chas-roberts-logo.png` and no code change is needed.
- Photo Count is tap-to-count. It does not recognize parts automatically, because that needs a paid AI service.
- Voice input works in Chrome, Edge and Safari, but not Firefox. Firefox users can type instead.
- Data lives on one phone or browser only. There is no syncing or backup except the CSV downloads.
- The Inter font isn't loaded, so a standard system font is used.
- I only had screenshots of the empty Inventory page, on desktop and phone. They look clean, correctly colored and not cramped. Other pages were checked by the automated tests only, not by eye.

## Recommendation
Ready to approve

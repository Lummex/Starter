# Oreheart Studio, Stage 3 + per-video approvals, Oct 28 2026

Ken's go-ahead (direct). Forge: please pass on (Brush, Sketch, Spring, Ledger especially).

**Studio:** https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn

## New for Ken
- **Runway videos step:** every video has its parts (e.g. "Part 1 · idle 0–3 s") with ✓ Approve / Redraw (with a note) / Undo per part, "Use this take", and Delete video (asks first; deletes for good, as Ken chose). Tap a part name to jump the video there.
- **Art Studio** and **Card Editor** are menu items inside the Studio. The Card art step has "Edit card & art in Art Studio", which opens Art Studio on that card. Card Editor (frames/layout for every card of a type) opens from the menu.
- Model Editor, Art Studio and Card Editor all save into the Studio.

## What moved (copies; old Art Studio and Card Editor untouched, still work as backups)
- Art Studio: page + format.json; database `artRequests` (132), `cards` (69 cards: name, text, stats, picture…), `settings` (cardUpdate, refs); 135 pictures (new ids, records rewritten).
- Card Editor: page; database `cardTemplates` (2), `sentToClaude` (1); 50 pictures.
- The Studio may now ask Claude for pictures (Art Studio's "Fill in the card with Claude"/image tools need it).

## Fix that matters for all rooms
Rooms first could READ but not SAVE ("arguments must be plain JSON data"): data made inside a room isn't accepted by the Studio's store. Fixed with a small bridge in each room that remakes the data on the Studio side. Tested: Art Studio edit on Bowler Brawler → "Saved", checked in the database, then put back. (This also fixes Model Editor saving inside the Studio.)

## Not carried over
- Things the old programs kept only in Ken's browser: Card Editor's own uploaded frames/sizes kept in the browser, its GitHub key (stays in Ken's browser; never copied), Art Studio's "recent" list.

## For agents
- Brush/Sketch: card art requests and card text now live in the Studio database: `artRequests`, `cards`, `settings` (ArtifactData url above).
- Spring: per-part approvals are on `takes/<id>.parts[].status` ("approved" | "redraw" + `note`), same as Motion References used.

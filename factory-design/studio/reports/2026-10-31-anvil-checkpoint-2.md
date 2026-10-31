# Checkpoint 2 for Ken (overnight batch, Oct 31)

Preview: https://oreheart-8-hsreijtd5-lummex.vercel.app (Vercel HjSiGfkYUJxmwYVkEYTKTmsUbGrd, run 41035389133, factory/issue-8 858b955). Full local suite 427 passed; failures = known old (AC158, 262, 364, 370, 375), Windows line endings (AC212, 326), or load timeouts that pass alone. New checks AC406-AC418.

## What changed
- THE BIG ONE: the T-poses and "feet not moving" are fixed. The shared animation file loaded as empty moves, so gnomes and dwarves stood frozen and goblins slid. Now every unit idles, walks and fights with real moves, checked on all 48 creatures.
- Units are your Studio sizes (small regular units, big Troll / Golem / mounts); dwarves are stocky; Commanders are 2.5x and stand on the board (no thrones).
- Move orders: the most direct route, re-planned each turn; an order given in your Action phase walks its first leg at once; the route is a chalk football-play line with an X (a circle for a chase), shown only when you hover or select the unit.
- Mulligan: Keep Hand or one full Redraw Hand (the computer too).
- Miners can mine the turn they're played and attack from the next turn; the card texts say so now.
- Stacking: a second Venom Shiv adds 1 damage a turn (up to 3), Bulwark blocks one more hit per copy, Blast / Tyrant / Junk Boost go up to +2, a second Hurler hit roots one turn longer. A white x2 / x3 shows on the icon.
- Starter decks are 60 cards (Ledger's lists).
- Hand: half-tucked at rest, 50 %+ of each card showing when raised, a focus window with many cards, a flatter fan, no flicker; double-click / double-tap plays a card; dropping a card next to a unit deploys (no accidental upgrade); dragging over a unit shows UPGRADE.
- Silver UI with gem buttons everywhere (menu, Done, dialogs, Deck Builder); silver gnome card frames.
- A ✕ Close on the big card; the computer's played card pops up big then lays down on its new discard pile on the left (tap it to fan the cards out).
- Bulwark shows a faction-coloured bubble that pops when it blocks.
- Gyronaut hovers twice as high; rings sit on the square; the Commander heart no longer hides the Commander; the pickaxe is easy to tap; enemy Commanders are 3D (Sproingle now; Skreeka, Sprocket, Grumblebeard ready).
- Accessories on 20 dwarf / gnome units at your Studio placements; Sprocket's wrench, Grumblebeard's hammer, Shieldbeard's shoulder shield; Anvilsworn's hammer at his belt.

## What to try
1. Start a match vs the computer: watch units walk (feet moving) and fight. Look for any frozen pose.
2. Give a unit a far move order in your Action phase: it walks the first leg right away, straight line. Hover it to see the chalk line.
3. Redraw Hand once at the start.
4. Play a Goblin Miner next to the Goblin Chef: it deploys (no upgrade). Drag a Smith Miner over a unit: UPGRADE badge.
5. Cast Venom Shiv twice on the same enemy: x2 on the icon, 2 damage a turn.
6. Hover and sweep across a hand of 10+ cards; park the mouse on a card edge: no jitter.
7. Phone: tap the hand to raise it, swipe down to tuck, double-tap to play.

## Not in (next batch)
- Smarter AI (never arrived), Spring's 11 special moves (pack v4), the rigged beetle, the Gnome Plow riding, the Shaman grip.
- Commanders still cover part of the next square: pCmd is your layout position (move it in the Game Editor, or pick a smaller size).
- The Done button's left gem touches the deck pile's edge on phones.

## Editor updates needed
- Game Editor: Commander size 2.5x, no thrones; hand numbers (overlap 0.26, angle 4, arc 1.45 are now overridden in code); phase tracker / deck count positions.
- Model Editor: unit heights (Ledger's table), Junk Shaman staff, Anvilsworn hammer.
- Card Frames editor: the crisper shadow rule; the silver gnome spell/instant frame.
- Menu editor: the silver theme.

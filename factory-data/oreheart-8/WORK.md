# Round 14 work items

## Rules & cards
- Corpsman Brewlord `brew` ability: heal adjacent wounded dwarf once per turn on either player's turn, Respond-window save at 1 Health, `drunk: 2` counting down on the owner's turn, Drunk blocks all healing (spells, abilities, start-of-turn refresh), setup accepts `drunk`, AI uses it (R14.5). AC331, AC332. Likely `src/engine/*` abilities/respond, `src/ai/*`.
- Goblin Rocket Rider is a Fighter: `getCard('shard-guzzler').role === 'fighter'`, mining 1, Fighter summon rules (R14.5). AC296.
- `window.oreheart.flowShardCount(flow)` (2 at Flow 1, monotone, 10–14 at 16) and `getFlowStreams()` entries with `flow`, `count`, `toPoint`, plus `pulses` (R14.3–4). AC329, AC330, AC222.
- Dwarf starter decks: 50 Dwarf Smith Miners each (no basic Miner), still 100 cards. AC6, AC112/AC128. `src/content/starter-decks.json`.
- `window.oreheart` must be undefined outside test mode. AC5.
- `getCard()` must return `range` and `artPos` from cards.json; add `getAbilityStatus()` and `cardFormat()` hooks (R12c/R12d). AC284, AC286, AC309, AC310, AC313.
- Fix Round 12c abilities that still fail (`ability` act returns not ok or wrong numbers): SewerSlide `run`, Bowler `strike`, Junk Shaman `pickUp`, Goblin Chef knockback, `rocketRide`, Glyphshield `ward`, Gnome `plow`, Ram Rider `gallop`, Gemdrunk +Attack per bank, Thief steal, Scrapsmith Miner death draw, Motherlode discount. AC289, AC290, AC292–AC296, AC299, AC300, AC304, AC305, AC307.
- Ranged straight lines and per-card ranges (Skullflinger 6, etc.) in legal actions and `previewAttack`; shot stops at first unit. AC13, AC248, AC266, AC286.
- Venom Shiv poison 7 turns, no healing while poisoned. AC131.
- Aegis Tinkerer Shield 1 / attack legality; Tunnel summon next to any mine for the opponent too; Respond window only when a playable response exists. AC15, AC254, AC18.
- Data-driven costs: Mangewolf Rider 8 (−1 Grubnak), Bowler Brawler 6, Smith Miners mine 2. AC10, AC16, AC18.
- Check AC109 (enemy Stronghold square at row 1, col 12 and its occupied neighbour list) and AC155 (Grubnak's Big Boss Troll glows only when affordable).

## 3D & visuals
- Crystal Flow shards end at the on-screen Flow crystal HUD pieces (project the HUD box into the stream end point), crystal pulse on arrival, shard count from `flowShardCount` (R14.3–4). AC222, AC329, AC330.
- Drunk 🍺 icon over drunk dwarves on the board; Brewlord heal/save effect (R14.5). AC331.
- Unit ring colors per side's faction theme (opponent Borgo = Dwarf blue `#2f5fd8`). AC261.

## Interface
- Serve the Oct 24 layout: copy `src/content/owner-layout.json` over `public/owner-layouts/final-draft/layout.json` (34 841 bytes) or import from one source; apply every hud piece's box, rot, opacity, z and text style exactly (color, size cqh×textScale, bold, italic, align, glow, caps); pName at y 70.99, Menu 3.7, Done 5.7 (R14.1). AC212, AC326. Likely `src/ui/hud*`, `src/ui/app.ts`.
- Fanned player hand from the layout `hand` settings (4°/card, arc 1.45, overlap 0.2, straighten + pop 1.6×/popY 10 on hover), `data-fan-angle` on each card; keep drag-to-play/reorder/tuck (R14.2). AC327, AC164, AC174, AC175, AC218.
- Enemy hand fan of backs (≤6, 9° apart, centred, rot −180) with `data-fan-angle` (R14.2). AC328.
- Brewlord ability button (`data-ability="brew"`, icon mug) lit on the enemy turn; Round 13 ability buttons still missing on the board (`data-ability`, `data-creature-uid`, tooltip, greyed states). AC318–AC320, AC325, AC332.
- Round 13 card faces: spell faces without dark boxes, owner renderer for every face (hand included), `artPos` applied. AC311, AC316, AC317.
- Deck Builder: remove the "Deck Commander" combobox (three portraits only), list only the Commander's faction + neutral cards, top bar never overlaps at 844×390. AC321, AC322, AC60, AC209, AC239.
- Title gate: remove the old "Oreheart" logo image; card-back stack only. AC323.
- Choose Your Commander: "Fight!" button must be reachable/visible (Knobbin and Borgo selectable, then Fight!). AC324, AC258.
- Settings: the "Welcome to Oreheart!" dialog flow used by AC260 (Square highlights panel) is missing; restore it or the panel path. AC260.

## Other
- Built `dist/` is 60 MB; must stay under 40 MB (compress/convert large PNGs, drop unused assets). AC90.
- Report screenshots 1920×1080: match next to the owner layout, fanned hand, flow arriving at the Flow crystal; checks pass count.

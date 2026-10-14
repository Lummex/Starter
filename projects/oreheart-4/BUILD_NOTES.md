# OreHeart — build notes

Vanilla JS + Vite. `npm run build` → `dist/` (includes `sw.js`, manifest, icons, bundled Cinzel font).

## Built
- Main Menu, Play (deck select, difficulty radios with rewards), Collection (5 filters + Owned only, counts, card detail), Deck Builder (max 5 decks, copy rules/messages, Auto-Fill, Save disabled until 30), Shop (booster packs, flip reveal, odds, guarantee), How to Play (6 sections with SVG diagrams), Settings (sound, animations, confirmed reset).
- 80 original cards (20 per faction; 10/5/3/2 by rarity; 12 structures, 16 spells); all keywords and spell effects are in `src/engine.js`.
- Battle: all required test ids/aria-labels, Mine control, Pass walls, attack/move/shove/Stronghold, Domination, results with gold, Menu/Concede.
- AI (Easy/Normal/Hard) via one-ply simulated board evaluation plus heuristics; its turn is capped at about 8s.
- PWA: manifest (fullscreen, portrait, 192/512 PNG icons), generated `/sw.js` precaching all built files.
- Saves in localStorage (`oreheart-save-v1`); battles are never saved.

## Notes / deviations
- Slots are about 38px wide at 390px (three per Mine); heights are ≥44px.
- Mine control is computed live from the board (identical to the start-of-turn recalculation when a turn begins).
- Frozen creatures skip their owner's next turn; global spells use a "Cast" button in the preview.
- Verified with headless Chromium at 390×844: menu, filters, battle flow, concede, deck builder, shop, reload persistence, no console errors, no horizontal scroll.

# Oreheart — build notes

Vanilla JS + Vite, `vite-plugin-pwa` (installable, offline), fonts bundled via `@fontsource` (Fredoka, Nunito).

## Built
- Main menu (Continue / Play / Collection / Deck Builder / Shop / How to Play / Settings), all with Back buttons.
- Play screen (deck select, Mode, Difficulty), coin flip + one-time mulligan dialog.
- Full match screen on a 7×7 board: summon, move (Swift, Leap, Swap, Teleport, Flying, Boots), attack (arrows, ranged, strike-back, type advantage, gang-up, Rivetbeard/Oakheart auras), gather, build (palisades, ballista), turn, forge upgrades, palisade tiers, spells, Undo (whole turn), Hint, Menu (Resume / Surrender / Quit), auto-save + Continue.
- AI (Easy/Normal/Hard) that plays visibly in under ~5 s; `ai=off` supported.
- Result screen with gold; Collection (80 cards, filters), Deck Builder (5 decks), Shop (boosters, flip reveal), How to Play (7 steps + tutorial match), Settings (Sound/Music via Web Audio, Reset Progress).
- `window.oreheart` rules API and `seed`, `first`, `hand`, `res`, `ai` URL params.
- All code in `src/`: `cards.js` (data), `engine.js` (rules), `ai.js`, `match.js`, `ui.js`, `store.js`.

## Notes / interpretations
- Build tiles and Blink/Overgrowth targets: any empty non-site tile; build is allowed on any of the 8 neighbours.
- Attacks on a Stronghold remove the attacker's Attack (with aura and gang-up, no type bonus).
- The 3 extra spells are Wisp Rush, Moonbeam and Sparkle Boost.
- Card art is emoji with designed frames; no painted art.
- Icons are generated PNGs (heart on sky/meadow gradient).

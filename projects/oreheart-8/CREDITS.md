# Oreheart credits

Everything in the game is made in code or generated for this project. There are **no third-party models, textures or audio files** in the build: `public/assets/external/` holds no files. If an outside file is ever added there, its file name must be listed in this document with its source URL and license.

## Fonts (free for commercial use, self-hosted)
- **Alegreya SC** (files `alegreya-sc-latin-400-italic.woff2` and `alegreya-sc-latin-700-italic.woff2`, `alegreya-sc-latin-500-italic.woff2` and `alegreya-sc-latin-800-italic.woff2`; Italic 400/700; the only font in the game, self-hosted from `public/assets/external/fonts/`) — https://fonts.google.com/specimen/Alegreya+SC (SIL OFL 1.1).
- Owner spell frames `public/art/frames/spell-frame-{goblin,gnome,dwarf,shared}.jpg` (supplied by the owner).

## Pictures
- **Card pictures** (`public/art/cards/*.webp`, the 16 Goblin creatures): generated with the xAI Grok image API (`grok-imagine-image`, https://docs.x.ai/) by `tools/gen-card-art.mjs` from the prompts in `src/content/card-art.json`. Generated once and committed. No fallback renders were needed.
- **Main menu background** (`public/art/menu-cavern.webp`): generated with the xAI Grok image API by `tools/gen-menu-bg.mjs` (no text in the image).
- **Logo** (`public/art/logo.webp`, `logo-wide.webp`, `icon-192.png`): cut from the owner's logo reference (`factory-design/design/references/main logo.jpg`) by `tools/cut-logo.mjs`.

## Made in code
- 3D figures, Strongholds, mines, ground and effects (`src/ui/art.ts`, `src/ui/scene.ts`) use Three.js (MIT, https://threejs.org/) with procedural geometry and canvas textures.
- All sound effects and Goblin / Grubnak voice grunts are synthesized at run time with the Web Audio API (`src/ui/audio.ts`). No audio files; no music.

## Round 2 additions
- Card frames `public/art/frames/*.webp`: the owner's `card-frame-goblin/gnome/dwarf.jpg` (neutral is a grey recolor made in code).
- Deck image `public/art/deck/deck-image.webp`: the owner's `Deck_image.jpg`, cut out to alpha in code.
- Commander portraits `public/art/commanders/*.webp`: generated with the xAI Grok image API (`tools/gen-commanders.mjs`).

## Round 4 additions
- The 12 spell pictures `public/art/cards/<spell id>.webp`: generated with the xAI Grok image API (`grok-imagine-image`) by `tools/gen-r4-art.mjs`.

## Retired fonts
- **Nunito** (https://fonts.google.com/specimen/Nunito, SIL OFL 1.1) was the interface font in rounds 1–3. It is no longer shipped; Cinzel and Tinos replaced it in round 4.

## Round 5b additions
- `public/art/ui/ruby-heart.png`: glossy ruby heart (no text). Drawn in code (SVG rendered with headless Chromium by `tools/make-ruby-heart.mjs`); original work, no outside asset and no image-API call.
- Soul-crystal HUD gems and the bank-building icon are inline SVG / emoji drawn in code. Painted sky and mountains are generated on a canvas in `src/ui/scene.ts`.

## Round 6a additions
- `public/art/ui/oreheart-card-back.webp`: dark card back with gold filigree and crystal motif generated with the xAI image API (no text); the OREHEART logo (`public/art/logo.webp`, owner's logo) is composited in the middle by `tools/gen-r6a-art.mjs`.
- `public/art/ui/ruby-heart.png`: ruby heart painted with the xAI image API (black background keyed to transparent) by `tools/gen-r6a-art.mjs`.
- `public/assets/models/crystal-mine-placeholder.gltf`: owner-supplied placeholder crystal mine model.
- Alegreya SC Italic weights 500 and 800 (SIL OFL, from @fontsource/alegreya-sc) added to the bundled fonts.

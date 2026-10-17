# Oreheart credits

Everything in the game is made in code or generated for this project. There are **no third-party models, textures or audio files** in the build: `public/assets/external/` holds no files. If an outside file is ever added there, its file name must be listed in this document with its source URL and license.

## Fonts (SIL Open Font License, loaded from Google Fonts)
- **Cinzel** — https://fonts.google.com/specimen/Cinzel (OFL 1.1)
- **Cinzel Decorative** — https://fonts.google.com/specimen/Cinzel+Decorative (OFL 1.1)
- **Nunito** — https://fonts.google.com/specimen/Nunito (OFL 1.1)

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

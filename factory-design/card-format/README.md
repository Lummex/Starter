# Owner card format ("Card format final 1.0") — BINDING

This is the card design the owner built in his Card Editor and uses in the Art Studio. Every card face in the game must look exactly like this.

- `projects/oreheart-8/public/art/card-format/format.json` — the format: one layout per card type (`unit`, `commander`, `spell`, `instant`, `crystal`, `back`). Each layout is a list of layers (frame images, card art, cost gem, rarity gem, stat icons, name, type line, rules text, stats), with positions in % of the card (420 × 624 design size), z-order, fonts, colors, shadows, glows and per-faction overrides (`fg`). `frames` picks the frame per type + faction; `images` and `builtin` map image keys to files in `public/art/card-format/images/`.
- `render.js` — the reference renderer from the Art Studio (`makeOHRenderer(format).cardHTML(card, artUrl, heightPx)` returns the card HTML; `fitText(el)` shrinks text to fit). Port it into the game (TypeScript) rather than re-inventing it, so the game matches the Studio pixel for pixel.
- `card.css` — the CSS the renderer needs (container-query units `cqh`, layer boxes).
- Fonts used by the format: **Alegreya SC** (display), **Russo One** (numbers), **IM Fell English SC** (fell). Bundle them (self-hosted, list in CREDITS.md).
- `reference/*.jpg` — how cards must look (rendered from this format with the real card pictures). The reference renders used fallback fonts, so text looks slightly different from the real fonts; frames, layout, gems, icons and positions are exact.
- Card picture: the `art` layer, honoring the card's `artPos` {s, x, y} (scale and offset in % inside the art layer, clipped).

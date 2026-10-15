# Oreheart — Phase 1B build brief (art and sound)

Read this brief first, then the full design document: `factory-design/design/oreheart-gdd-v2.md` (the source of truth for every rule, number and card). Phase 1A (`oreheart-phase-1a-brief.md`, all revisions) is finished, approved and live; everything in it stays exactly as it works now.

**Goal of Phase 1B:** replace every placeholder with finished, original art and add sound effects, **without changing any game rule, number, layout position or test hook**. When it ships, Oreheart should look like a real, polished game on a phone held sideways. All 129 existing automated checks must keep passing.

## Round 1 (this build): style test — Goblins, board, mines, Strongholds

Build ONLY the following to finished quality so the owner can approve the look before the rest is made. Gnome and Dwarf creatures keep their current placeholders in this round (do not break them).

1. **Art pipeline in code** (reused by every later round):
   - Toon (cel) shading with 3 light steps and thick dark ink outlines (inverted-hull or post-process), on all characters, Strongholds and mines. Warm late-afternoon key light from the top left, soft contact shadows.
   - A shared **Goblin body rig** (skinny, hunched, long arms, huge ears, big grin with pointy teeth, big hands, small legs) with swappable heads, armor, weapons and colors, so each Goblin card gets a distinct figure. Models may start from free, commercial-use **CC0** packs (record every source and license in `projects/oreheart-8/CREDITS.md`) and be reshaped, recolored and accessorized in code, or be built procedurally. No model, texture or font may copy another game's characters, logos or style.
   - Animations for every creature: idle, walk, melee or ranged attack, hit (flinch + red flash), defeat (comic poof with stars, helmet bounce, no blood), mining (pick swing + gem sparks), summon (rise out of the card with a dust puff), and 3 Goblin poke reactions (cackle, rude dance, angry stomp).
2. **All Goblin cards as 3D figures** (every Goblin creature in the design-doc tables, including Miners, Smith Miners, the Crystal Eater and the Collector), each with its own look and the weapon rules from the design doc ("Weapons show the type"). Materials: scrap metal, rusty nails, patched leather, bottle caps, bones; toxic-green accents. Rare and better are slightly bigger; Ultra Rare and Collector noticeably bigger with a soft glow. Upgrades add gold pips and shinier armor.
3. **Grubnak Rotgut, King of the Junkpile** (waist-up in his Stronghold): fat goblin, bent-hubcap crown, rusty spiked pauldrons, one gold tooth, a rat on his shoulder. Reactions: belly-laugh and throne pound on a hit, sulk and kick the rat when a creature dies, fastball spell throws, flinch and fist-shake when hit. Retreat: rocket-powered barrel.
4. **All three Strongholds** (Goblin: wobbly tower of scrap and stolen signs, smoking chimney, crooked green flags; Gnome: brass clockwork observatory with spinning rings, telescopes and blue-crackling coils; Dwarf: carved stone mountain gate with purple gem eyes, iron doors, purple braziers). The Health heart stays mounted on the wall facing the player and shows more cracks as Health drops. Sproingle and Borgo keep simple placeholder figures this round.
5. **Battlefield:** a painted tabletop canyon: warm dirt and flat stone, dry grass patches, pebbles, faint glowing ore cracks; cliffs, mine carts, broken rails and scaffolding around the border (never over a playable space). Low contrast so creatures stand out. Grid stays invisible.
6. **Mines:** glossy crystal clusters on rocky mounds, owner-colored (white when neutral), light rays, slow sparkles, burst-and-regrow on owner change; mined crystals stream as motes to the Flow counter. The revision 9 swinging pickaxe becomes a proper metal-and-wood model with a spark per strike.
7. **Card pictures for the Goblin cards** via the AI image pipeline below, plus the **Goblin card frame** (riveted scrap metal, green paint drips), rarity trims (Common plain, Uncommon silver, Rare gold, Ultra Rare gold shimmer, Collector animated foil) and the shared **card back** (dark iron, glowing ore-heart). Text, cost and stats are always drawn by the game on top of the picture, never baked into it.
8. **Sound effects (whole game, all factions):** card draw, card play, summon whoosh, footsteps per faction, melee hits, ranged shots, pick strikes and gem chimes, counter ticks, each spell, shield bubble, glass shatter, Stronghold hit, KA-BOOM, button clicks, countdown ticks, victory and defeat stings (short sound stings, not music). Gibberish voice grunts/cackles for Goblins and Grubnak. Sources: CC0 libraries (record in CREDITS.md) and/or sounds synthesized in code. Settings: separate volume sliders for Sound effects and Voices, plus a mute button on the match screen; audio starts after the first tap. **No music this phase.**
9. **Performance:** total download under about 40 MB; 60 fps on a mid-range Android phone in Chrome, 30 fps on old phones. The Low graphics setting turns off particles, shadows and outlines on distant objects. Keep textures compressed and models low-poly.

## AI image pipeline (card pictures)

- The build environment has the secret `OPENAI_API_KEY`. Use OpenAI's current image-generation model through its official API. Never print, log or commit the key.
- Add `projects/oreheart-8/tools/gen-card-art.mjs` and a data file `src/content/card-art.json` with one entry per card: `{ cardId, prompt, file, seed? }`. The script generates only entries whose image file is missing (or whose prompt changed, tracked by a hash), saves compressed WebP images (about 512 × 512) into `public/art/cards/`, and the images are **committed** so later builds don't regenerate them. If the key is missing or the API fails, fall back to a dramatic render of the card's 3D figure, and say so in the report.
- Prompt style for every picture: "comic-book fantasy illustration, thick black ink outlines, bold flat colors with cel shading, heavy-metal album cover drama but funny, [faction look], [the creature in action, holding its weapon], simple [faction] background, no text, no letters, no logos, no watermark, original character". The picture must match the 3D figure (same colors, weapon, silhouette).
- Never ask for, or name, characters, artists or styles from other games or companies.
- Budget: generate each picture once; at most 2 retries per card if the result has text, extra limbs or the wrong faction look.

## Later rounds (not now; listed so the code is built ready for them)

Round 2: Gnome and Dwarf figures, Sproingle and Borgo finished, their card frames and pictures. Round 3: spell effects, hit "WHAM!/KRAK!/ZZAP!" lettering, banners, menus as a living scene, 3D Flow/Bank crystals, iron Done button. Music comes in a later phase.

## Tests

Keep all existing checks passing (test mode, `window.oreheart` hooks and accessible HTML elements unchanged). Add: every Goblin card id has a 3D figure and a card picture file; `CREDITS.md` exists and lists every outside asset; the game loads with sound muted until the first tap; the Low graphics setting reduces draw calls; total `dist` size stays under 40 MB. Include match-screen screenshots at phone size (844 × 390) in the report so the owner's reviewer can see the new look.

# Oreheart — project handoff for other agents

Last updated: 2026-10-20 (UTC). Written by Claude (Cowork session with the owner) so any other agent can pick up where this conversation left off. The companion file `oreheart-conversation-log.md` has the conversation itself.

## 1. Who, what, where

- **Owner:** Ken (GitHub user **Lummex**). Not a programmer. Works in plain language, often by voice dictation (dictation sometimes picks up TV/background speech; ignore obvious stray sentences and ask if unsure). Time zone: Los Angeles. PC name "Starr" (Windows), files under `C:\Users\kentu\Downloads\Oreheart\`.
- **Game:** **Oreheart**, a 3D comic-style fantasy card battler (Goblins, Gnomes, Dwarves fight over crystal mines; win by forcing the enemy Commander to retreat). Web game: TypeScript + three.js 0.170 + Vite, hosted on Vercel, landscape phone first, also mouse.
- **Repo:** `Lummex/Starter`. The game is built by an autonomous AI "factory" on GitHub Actions working on **issue #8** ("OreHeart"), branch `factory/issue-8` (PR #10). Game code lives in `projects/oreheart-8/`.
- **Source of truth documents (on `main`):**
  - Design doc: `factory-design/design/oreheart-gdd-v2.md`
  - Current build brief: `factory-design/design/oreheart-phase-1b-brief.md` (newest round at the top; older rounds below marked "(done)")
  - Owner reference art: `factory-design/design/references/` (binding; use exactly)

## 2. How the owner wants to work (standing rules)

- Plain language, short answers, **always give an ETA**, play a **chime** when a build finishes, and the agent does the GitHub work itself.
- Ken playtests and dictates changes. The agent keeps a **numbered change list**, checks every item for **conflicts** with earlier rules and asks about them, and only sends when Ken says **"send it"** (or clearly equivalent).
- **Secrets:** API keys/tokens are never pasted into chat. They live only in GitHub secrets / Vercel env vars, and Ken types secret values himself. Secrets in use: `ANTHROPIC_API_KEY`, `VERCEL_TOKEN`, `XAI_API_KEY` (image API), `MESHYKEY` (Meshy 3D; the workflow maps `MESHY_API_KEY: ${{ secrets.MESHYKEY }}`).
- **Originality:** all card and Commander names and art must be original; nothing resembling well-known games (Warcraft, Warhammer, Magic, Hearthstone, Pokémon). Don't copy another game's card back.
- Content, rarity and economy are controlled only by the owner.
- Permanent UI rules from the owner: **no stretching** of images/UI ever; **no black bars** on the match screen; menu actions are **plain text that glows on hover**, no boxed buttons; **no corner ornaments**; font **Alegreya SC (italic)**.
- **Text palette (current, global):** titles, headings, names, main actions and big numbers bright gold `#FFD700` (bold); secondary labels brown-gold `#B8862B`; **body/description/list text brown-gold `#D4A94F`** (changed in round 8; was white); white only for numbers on icons (crystals, hearts, stat badges) and text printed on card faces; black outlines/shadows.

## 3. The "send it" procedure (how a round is launched)

1. Write the new round section at the top of the brief, and update the design doc where rules change.
2. Edit both files on GitHub (the agent used the browser: GitHub's web editor, replacing the CodeMirror document after checking a SHA-256 of the current text, then "Commit directly to main").
3. Post an **"Owner change request — Phase 1B round N"** comment on issue #8 summarizing the items (point to the brief section).
4. Change the issue label from `factory:review` to **`factory:revise`**. The factory starts within a minute and posts "The factory has started working on this."
5. Watch for the bot's result comment ("Ready for your review…", "Build failed", etc.), then give Ken the preview link and a plain summary.
- Factory workflow: `.github/workflows/factory-build.yml` (and `factory-ship.yml`). **`timeout-minutes: 120`** on the build job. Round 7 took 1 h 45 min, so big rounds risk timing out (see section 6).
- Getting binary files (images, models) into the repo: the agent's container cannot push to GitHub or download from it. Reliable path: put files in Ken's `Downloads\Oreheart\…` folder and give Ken a GitHub upload link (`https://github.com/Lummex/Starter/upload/main/<folder>`); he drags them in and commits to main.

## 4. Where the build stands

| Round | What | Status |
|---|---|---|
| 1–4, 3a/3b | Board/rules, art, spells, starter decks, lettering | done |
| 5a | Menus, deck builder, lettering | done |
| 5b | Match screen: owner camera and HUD layout | done |
| 6a | Owner playtest fixes, card back, text palette, deck builder | done (235/236 checks) |
| 7 | 6a fixes + **Grubnak in 3D via Meshy** (8 animations, fortress, scepter; 119 Meshy credits) | done, all 249 checks passed. Preview: https://oreheart-8-96fm43q6c-lummex.vercel.app |
| 8 | **Painted arena board + view controls**, crystal mine in 3D, round 7 playtest fixes (14 items) | **sent 2026-10-20 02:16 UTC, run 39357943271**; was still running at 1 h 45 min with no commits, at risk of the 120-min timeout |

### Round 8 items (full text is in the brief, section "Round 8")
1. Match board = the owner's painted arena exactly as in the Arena Editor (swamp background + Skullfang Arena painting + 54 animated effects + 2 foreground cut-outs). 2D paintings, 3D pieces on top, 3D angle fitted once to the painted floor. **No grid lines**; the 13 × 7 squares map onto the owner's 4 painted floor corners by homography. **View controls:** scroll/pinch zoom, drag/arrows/WASD/two-finger pan, Recenter; fully zoomed out the painting fills the window (cover-fit, never stretched), **never black bars**, never past the painting edges; max zoom about 2.5 screen px per painting px. HUD stays fixed.
2. Crystal mine in 3D via Meshy, generated once and saved, owner tints (player blue, enemy red, neutral pale).
3. Player Commander must face the **opponent** (bug: faced the player). Looks back at the player when "talking" to him; impatience animation after ~20 s idle on the player's turn; faces forward when acting. Add 1–2 impatience clips from Meshy's animation library once.
4. Card glow direction flipped: crisp at the card edge, fading outward.
5. Hand hover zone = tight box around the cards (grabbing a creature was raising the hand).
6. Pop-out card smoother and 20% smaller (~70% of screen height).
7. Creature stat bars → compact painted icons with numbers on top.
8. Deck builder: drag cards into the deck list again (regression).
9. Deck builder: no layout shift when adding cards (double-click, drag, "+").
10. Choose Your Commander: uniform deck entries; palette colors.
11. Choose Your Commander: hover grow/shrink; click hides the others, card drops back as a backdrop and the 3D model pops up in front; only his decks show; Change Commander.
12. Fight! moves bottom-right; other actions rearranged; "View Grubnak in 3D" buttons removed.
13. Brown-gold body text everywhere (replaces white body text).
14. Deck builder close-up: card on the left, 3D model viewer on the right.

### If round 8 times out
Agent's proposal (needs Ken's OK, not done yet): raise `timeout-minutes` (e.g. 180–240) and/or split into **8a** (items 1–2: arena board, view controls, mine) and **8b** (items 3–14).

## 5. Owner tools (Claude artifacts; private to Ken)

- **Arena Editor:** https://claude.ai/artifact/UrRDUmZnyQi3ZqVLgrhw9F — paints effects onto the 2D arena (flames, glows, lanterns, skull eyes, waterfalls, acid pools, waving banners, swaying plants, water shimmer, fireflies), board-corner fitting, foreground cut-outs, arena look, zoom/pan, save/load (named saves in the artifact's database, collection `arenaLayouts`; file save/open; paste). The owner's final layout is the save **"skull arena final draft"**, exported to `factory-design/design/references/skullfang-arena-layout.json` together with `skullfang-swamp-background.jpg`, `skullfang-arena.png` and `arena-editor-source.html` (effect code for the builders to port).
- **Model Editor:** https://claude.ai/artifact/5isEcqgnmtqRHJUWAmqRDd — loads Grubnak, his fortress and scepter (or any .glb). Move/turn/size (gizmo, sliders, numbers, exact height in board squares, stretch), attach to another model or a bone (snaps onto the part), combine/split groups, slices (up to 3 cutting planes), color controls (brightness, contrast, saturation, hue, shine), glow/shine areas (bubbles that make parts glow/shine/brighten/recolor, can follow bones), effects (glow, flame, sparks, smoke, aura ring, colored light, twinkles, magic orbs; always or during a chosen animation), animation playback/scrub, bone posing. Save/load in its database (collection `modelSetups`), file save/open, "Copy setup" JSON for the builders. **Grubnak's Meshy rig has no finger bones** (24 joints), so fingers can't be posed.
- **Camera tester:** https://claude.ai/artifact/AtuYcQGu6nRJabU3X4Hxx8 — produced the round 5b camera/HUD layout (camera numbers now superseded by the painted arena for the match board; HUD positions still apply).

## 6. Open items / next steps

- Check round 8 result (run 39357943271). If it succeeded: give Ken the preview link and compare the match board to his arena screenshot (owner's reference image of the arena with all effects). If it timed out: offer the timeout raise and/or 8a/8b split.
- Ken is now building Commander setups in the Model Editor (scepter in Grubnak's right hand, Grubnak inside his fortress, slicing, glow areas). When he says it's ready, read his saved setup from the Model Editor and turn it into a brief item.
- Meshy assets saved on `factory/issue-8`: `projects/oreheart-8/public/models/commanders/grubnak.glb` (rigged, 8 animations: Idle, Chest_Pound_Taunt, Call_Gesture, Victory_Fist_Pump, Hit_Reaction_1, mage_soell_cast, Hit_Reaction, Dead), `grubnak-fortress.glb`, `grubnak-scepter.glb`, `models.json`. Don't regenerate unless Ken asks.
- On hold: the Skullfang arena 3D GLB (replaced by the 2D painted arena plan).

## 7. Tips for agents

- Ken's reference images and uploads are binding art; use them exactly, no redraws.
- When Ken's message is ambiguous, state your assumption in one line and keep going; ask one question at most.
- Keep explanations short and non-technical; give links he can click.

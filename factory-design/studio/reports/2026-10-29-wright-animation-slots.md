# 2026-10-29 — Wright — Animation slots in the Model Editor room

Job from Forge (Ken's words, Oct 29), plus Ken's two additions via Forge. Replaces the "Animation set" box I built earlier the same day. Oreheart Studio version 26, room `model-editor.html?v=23`.

## How Ken uses it (3 lines)
1. Studio → Model Editor → a character's **Poses** → **Animations** box at the top; set the body type (Two legs / Four legs / Many legs / Flyer / Rider).
2. Each slot's dropdown: "Leave blank for now", "No animation for this character", then the shared approved animations (picking one plays it on him). Moves waiting for Ken sit under the slot with Watch / ✓ Approve / Redo….
3. Last choice "➕ Have an agent create a new animation…": describe it, press **Send to the team**; it stays greyed as "requested" until Spring makes it.

## Slots (one config list, `SLOT_CONFIG` in model-editor.html)
idle, idleBreak (up to 3, random), walk, run, attack, special, ability (shows "no animation for this character" when the card has no special ability; button to override), bonk (blank = uses the shared approved bonk), death, lift, fly + hover (only for Flyer body or card text with "fly"). Add a slot = one line: key, name, loop, optional bodies / card-text filter, multi.

## Data (schema approved by Forge: Spring's + one id per slot)
- `animations/<slug>`: id, name, slot, bodyType (biped|quadruped|multileg|flyer|rider), clip, file {modelKey, repo}, preview, frames, fps, loop, events, prop, fromCard, takeId, status (waiting|approved|rejected), note, kenNote, madeBy, madeAt, approvedAt. The page plays `clip` from bundled Studio model `file.modelKey` (also accepts `src.key` "b:<key>" / "a:<asset id>"). Approve → approved + approvedAt; Redo → rejected + kenNote.
- `library/<card>.animSlots` = {slot: [ids]}: one id per slot ("none" = no animation for this character, [] = blank); idleBreak up to 3. `library/<card>.bodyType` (default biped), optional `hasAbility` override.
- `animRequests/<random id>`: slot, bodyType, card, cardName, desc (Ken's words), status wanted|working|waiting|done|rejected, agent, animId, takeId, at, updatedAt. Spring queries status == "wanted". Each request also writes an already-answered `decisions/anim-<id>` line for Forge (not a question in Ken's inbox).
- Old per-card `library/<card>.animRequests` / `animRules`: still shown, read-only ("Older animation wishes").

## Starter library
11 existing clips loaded into `animations` as "waiting" (3 idles, 2 walks, 1 run, 3 bonks, 1 death, 1 lift: Meshy clips from Goblin Miner/Gemsinger, Blender clips from Boneknocker). The old `coreAnims` docs are kept, unused.

## Tested
Locally with the real room code, a fake database and the real models: blank / none / pick saved correctly; picking played the clip; idle break took 2 picks with ✕ to remove; request wrote `animRequests` (status wanted) + the decisions line and showed greyed; bonk showed the shared default; Flyer body added Fly and Hover; Special ability showed "no animation" for Boneknocker. Live file read back identical. Not clicked through on the live page (cross-origin frame inside claude.ai).

## Update: all 35 slots (Ken approved Ledger's full list, Oct 29) — Studio v28
- `SLOT_CONFIG` now holds all rows of studio/animation-slots-proposal.md (35; Ledger's "34" counts Ready/Done once), grouped Core / Movement / Combat / Abilities / Reactions / Commander in folding groups. Keys: idle, idleBreak, summon, ready, walk, run, fly, hover, ride, tunnel, teleport, attack, ranged, charge, special, block, mine, forge, heal, ability, bonk, knockback, bowled, lift, dropped, poke, stunned, cheer, death, cmdIdle, cmdCheer, cmdGroan, cmdCast, cmdRetreat, cmdVictory.
- Each slot shows Today ✅ / ◐ / — and loops / plays once. Slots that don't fit the card (card list / body type / commander) show "No animation for this character" automatically; Ken can still pick one. Commanders get only the Commander group.
- Spring merged: my 10 duplicate starter docs carry `duplicateOf` (hidden, not deleted); Spring moved its clips to the new keys.

#!/usr/bin/env node
// Round 28b (Oct 29): Ken's animation choices from Oreheart Studio → src/content/anim-slots.json.
//
// Input: a folder holding the Studio's data as JSON files, as the ArtifactData tool saves them:
//   <dump>/animations/<id>.json   (the shared animation library; one doc per clip)
//   <dump>/library/<card>.json    (per card; `animSlots` = Ken's pick per slot: an animation id, "none", or [] / a list for idleBreak)
// Usage: node tools/export-anim-slots.mjs <dump folder> [out file]
//
// Rules: only APPROVED animations go in. "none" means no animation for that slot. A pick whose clip lives in another model's
// GLB is written with `shared: true` (the game may retarget it later; today it only plays clips from the card's own GLB).
// Cards without picks get the approved animations made on their OWN model as `candidates` (not used by the game until picked).
import fs from 'node:fs';
import path from 'node:path';

const dump = process.argv[2];
const out = process.argv[3] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'src', 'content', 'anim-slots.json');
if (!dump) { console.error('usage: node tools/export-anim-slots.mjs <studio dump folder> [out.json]'); process.exit(2); }

const readDir = (d) => fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => { const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); return { id: f.slice(0, -5), ...(j.data || j) }; }) : [];
const anims = Object.fromEntries(readDir(path.join(dump, 'animations')).map((a) => [a.id, a]));
const cards = readDir(path.join(dump, 'library'));

// Studio slot names → the game's clip roles (creature3d.ts). Unlisted slots are kept under their Studio name for later hooks.
const ROLE = { idle: 'idle', idleBreak: 'idleBreak', walk: 'walk', run: 'run', attack: 'attack', ranged: 'attack', special: 'special', ability: 'ability', mine: 'mine', bonk: 'hit', hit: 'hit', death: 'defeat', defeat: 'defeat', lift: 'lifted', lifted: 'lifted', knockback: 'knockback', bowled: 'bowled' };
const ownGlb = (card, a) => !!(a.file && typeof a.file.repo === 'string' && a.file.repo.includes(`/public/models/creatures/${card}/char.glb`));
const entry = (card, a) => ({ clip: a.clip, animation: a.id, name: a.name || '', loop: !!a.loop, shared: !ownGlb(card, a), file: a.file ? { modelKey: a.file.modelKey || '', repo: a.file.repo || '' } : null });

const result = { generated: new Date().toISOString(), source: 'Oreheart Studio: library/<card>.animSlots + animations (approved only)', cards: {} };
const stats = { picked: 0, none: 0, notApproved: 0, missing: 0, shared: 0, candidates: 0, cardsWithPicks: 0 };
for (const c of cards) {
  const slots = c.animSlots && typeof c.animSlots === 'object' ? c.animSlots : null;
  const rec = { slots: {}, candidates: {} };
  if (slots) {
    stats.cardsWithPicks++;
    for (const [slot, pick] of Object.entries(slots)) {
      const role = ROLE[slot] || slot;
      const ids = Array.isArray(pick) ? pick : [pick];
      const uses = [];
      for (const id of ids) {
        if (!id || id === 'none') { if (id === 'none') { rec.slots[role] = { none: true }; stats.none++; } continue; }
        const a = anims[id];
        if (!a) { stats.missing++; continue; }
        if (a.status !== 'approved') { stats.notApproved++; continue; }
        const e = entry(c.id, a); if (e.shared) stats.shared++;
        uses.push(e); stats.picked++;
      }
      if (uses.length) rec.slots[role] = Array.isArray(pick) ? uses : uses[0];
    }
  }
  // approved animations made on this card's own model, for the editor and for later picks
  for (const a of Object.values(anims)) {
    if (a.status !== 'approved' || !ownGlb(c.id, a)) continue;
    const role = ROLE[a.slot] || a.slot;
    (rec.candidates[role] ||= []).push(entry(c.id, a)); stats.candidates++;
  }
  // no pick yet: an approved animation that is the ONLY candidate for a role on this card's own model is used as that role (auto)
  // ... and only when it is the clip the game already plays for that role, or the role has no clip today (knockback, bowled, ...):
  // an approved library entry must not silently change a card's current look; Ken picks those in the Studio.
  const mj = (() => { try { return JSON.parse(fs.readFileSync(path.join(path.dirname(out), '..', '..', 'public', 'models', 'creatures', c.id, 'models.json'), 'utf8')); } catch { return null; } })();
  const CUR = { idle: 'idle', walk: 'walk', attack: 'attack', hit: 'hit', defeat: 'defeat', mine: 'mine', special: 'special', lifted: 'react_lifted', knockback: 'react_knockback', bowled: 'react_bowled' };
  const curClip = (role) => { const k = CUR[role]; const v = mj && mj.clips && k ? mj.clips[k] : undefined; return typeof v === 'string' ? v : undefined; };
  const todayPlays = (role) => !!curClip(role) || (mj && mj.actions && role in mj.actions);
  for (const [role, list] of Object.entries(rec.candidates)) {
    if (rec.slots[role] || list.length !== 1) continue;
    const cand = list[0];
    const sameAsToday = curClip(role) === cand.clip || (!curClip(role) && !todayPlays(role)) || (!curClip(role) && role === 'defeat' && cand.clip === 'Dead');
    if (sameAsToday) { rec.slots[role] = { ...cand, auto: true }; stats.auto = (stats.auto || 0) + 1; }
  }
  if (Object.keys(rec.slots).length || Object.keys(rec.candidates).length) result.cards[c.id] = rec;
}
result.stats = stats;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
console.log(`anim-slots: ${Object.keys(result.cards).length} cards, ${JSON.stringify(stats)} → ${out}`);

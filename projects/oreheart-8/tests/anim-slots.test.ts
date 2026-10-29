import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import slots from '../src/content/anim-slots.json';

// Round 28b: the Studio animation slots file (made by tools/export-anim-slots.mjs) must only name clips the card's own model has
const ROOT = process.cwd(); // vitest runs from projects/oreheart-8
const modelsJson = (card: string) => { const p = join(ROOT, 'public', 'models', 'creatures', card, 'models.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };

describe('anim-slots.json (Ken\'s Studio slot choices)', () => {
  it('has the expected shape and only approved, usable entries', () => {
    expect(slots.source).toContain('animations');
    for (const [card, rec] of Object.entries((slots as any).cards) as [string, any][]) {
      for (const [role, pick] of Object.entries(rec.slots) as [string, any][]) {
        const ps = Array.isArray(pick) ? pick : [pick];
        for (const p of ps) {
          if (p.none) continue;
          expect(typeof p.clip, `${card}.${role} clip`).toBe('string');
          expect(p.animation, `${card}.${role} animation id`).toMatch(/^[a-z]+-/);
          // a clip the game can play must be one of the card's named clips (models.json) or an old Meshy clip name
          if (!p.shared) {
            const mj = modelsJson(card);
            const known = new Set([...Object.values(mj?.clips || {}), 'Idle', 'Casual_Walk', 'Heavy_Hammer_Swing', 'Hit_Reaction', 'Dead']);
            expect(known.has(p.clip), `${card}.${role}: ${p.clip} is in that model`).toBe(true);
          }
        }
      }
    }
  });
  it('knows the approved goblin-pebbler reactions (knockback, bowled, lifted)', () => {
    const peb = (slots as any).cards['goblin-pebbler'];
    expect(peb).toBeTruthy();
    expect(peb.slots.knockback.clip).toBe('OH_React_Knockback');
    expect(peb.slots.bowled.clip).toBe('OH_React_Bowled');
    expect(peb.slots.lifted.clip).toBe('OH_React_Lifted');
  });
});

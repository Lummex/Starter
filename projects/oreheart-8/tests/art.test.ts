import { describe, it, expect } from 'vitest';
// @ts-ignore
import fs from 'node:fs';
import { CARDS } from '../src/engine';
import art from '../src/content/card-art.json';

describe('Phase 1B content', () => {
  it('every card has a tagline and a flavor line', () => {
    for (const c of Object.values(CARDS)) {
      expect(c.tagline?.length, c.id).toBeGreaterThan(0);
      expect(c.flavor?.length, c.id).toBeGreaterThan(0);
    }
  });
  it('every Goblin creature has a card picture entry and an image file under 200 KB', () => {
    for (const c of Object.values(CARDS).filter((x: any) => x.type === 'creature' && x.faction === 'goblins')) {
      const e = (art as any[]).find((a) => a.cardId === c.id);
      expect(e, c.id).toBeTruthy();
      expect(e.prompt).toContain('no text');
      const f = `public/${e.file}`;
      expect(fs.existsSync(f), f).toBe(true);
      expect(fs.statSync(f).size).toBeLessThan(200_000);
    }
  });
  it('CREDITS.md names the fonts and the card pictures', () => {
    const t = fs.readFileSync('CREDITS.md', 'utf8');
    for (const w of ['Cinzel', 'Nunito', 'art/cards', 'Grok']) expect(t).toContain(w);
  });
});

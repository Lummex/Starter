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
    for (const w of ['Cinzel', 'Tinos', 'art/cards', 'Grok']) expect(t).toContain(w);
  });
});

import { SPELL_VISUALS } from '../src/content/spell-visuals';
import { CARDS as ALLCARDS } from '../src/engine';
describe('spell visuals (R3b.7)', () => {
  it('every spell has its own unique visual id', () => {
    const spells = Object.values(ALLCARDS as any).filter((c: any) => c.type === 'spell') as any[];
    const ids = spells.map((c) => SPELL_VISUALS[c.id]?.id);
    expect(ids.every((i) => typeof i === 'string' && i.length > 0 && !['generic', 'default', 'none'].includes(i))).toBe(true);
    expect(new Set(ids).size).toBe(spells.length);
  });
});

describe('Round 4 assets', () => {
  it('spell frames, metal textures and spell pictures exist', () => {
    for (const f of ['goblin', 'gnome', 'dwarf', 'shared']) expect(fs.existsSync(`public/art/frames/spell-frame-${f}.webp`), f).toBe(true);
    for (const f of ['gold', 'silver']) expect(fs.existsSync(`public/art/ui/metal-${f}.webp`), f).toBe(true);
    for (const c of Object.values(CARDS)) if (c.type === 'spell' && !c.disabled) expect(fs.existsSync(`public/art/cards/${c.id}.webp`), c.id).toBe(true);
  });
  it('metal lettering css: fonts, no Cinzel Decorative, metal rules', () => {
    const css = fs.readFileSync('src/style.css', 'utf8');
    expect(css).not.toContain('Cinzel Decorative');
    expect(css).toContain('[data-metal]');
    expect(css).toContain('metal-gold.webp');
    expect(css).toContain('metal-silver.webp');
    const credits = fs.readFileSync('CREDITS.md', 'utf8');
    expect(credits).toContain('Cinzel');
    expect(credits).toContain('Tinos');
  });
  it('mulligan cards are doubled in css', () => {
    expect(fs.readFileSync('src/style.css', 'utf8')).toContain('calc(2*min(15vw,22vh,120px))');
  });
});

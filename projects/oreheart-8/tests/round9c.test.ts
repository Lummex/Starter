import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import menus from '../src/content/menus.json';
import owner from '../src/content/owner-layout.json';

const read = (f: string) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

describe('round 9c', () => {
  it('owner layout: 57 effects = 54 arena effects + 3 Crystal Flow streams; the arena builder skips types it does not build', () => {
    const fx = (owner as any).effects as any[];
    expect(fx.length).toBe(57);
    expect(fx.filter((e) => e.type === 'flow').length).toBe(3);
    const src = read('src/ui/arena-fx.ts');
    expect(src).toMatch(/!MAKERS\[d\.type\]/);
    expect(src).toMatch(/catch \(err\)/);
  });
  it('arena failures are never swallowed', () => {
    expect(read('src/ui/scene.ts')).not.toMatch(/\}\)\.catch\(\(\) => \{\}\);\s*\n\s*\}\s*\n\s*\n\s*\/\/ view: zoom/);
    expect(read('src/ui/scene.ts')).toMatch(/console\.error\(m, err\)/);
  });
  it('menus file: intro first, owner screens and buttons', () => {
    const m: any = menus;
    expect(m.first).toBe('intro');
    expect(m.screens.map((s: any) => s.id)).toEqual(['intro', 'main', 'deck', 'commander']);
    const main = m.screens.find((s: any) => s.id === 'main');
    expect(main.pieces.filter((p: any) => p.kind === 'button').map((p: any) => p.text.content)).toEqual(['Play', 'Deck Builder', 'How to Play', 'Settings', 'Quit']);
    expect(m.screens[0].intro).toMatchObject({ length: 7000, next: 'main', skip: true });
    expect(m.screens[0].pieces.find((p: any) => p.anim?.in === 'crash')).toBeTruthy();
  });
  it('owner pieces: Commander and stronghold share one board point; owner turn values', () => {
    const P = (owner as any).pieces as any[];
    const f = P.find((p) => p.id === 'pFort'), c = P.find((p) => p.id === 'pCmd');
    expect([f.cx, f.cy]).toEqual([c.cx, c.cy]);
    expect(c.turn).toBe(146);
    expect(f.turn).toBe(137);
  });
});

import { describe, it, expect } from 'vitest';
import { CONFIG as _CFG } from '../src/engine';
(_CFG as any).combat.dice = 'sure'; // Combat v2 (Nov 1): these older tests pin exact damage, so every swing lands and nothing blocks here (the dice have their own tests)
import * as fs from 'node:fs';

const css = fs.readFileSync('src/style.css', 'utf8');

describe('round 8b', () => {
  it('body text uses the brown-gold palette variables', () => {
    expect(css).toMatch(/--text-body:#D4A94F/);
    expect(css).toMatch(/--text-body-sm:#B8862B/);
  });
  it('ships the painted stat icons', () => {
    for (const n of ['stat-sword', 'stat-boot', 'ruby-heart']) expect(fs.statSync(`public/art/ui/${n}.png`).size).toBeGreaterThan(1000);
  });
  it('glow is crisp at the card edge and fades outward', () => {
    expect(css).toMatch(/\.card-glow::before\{[^}]*box-shadow:0 0/);
  });
  it('Grubnak has a look-back/impatience controller and no "View Grubnak in 3D" button remains', () => {
    const app = fs.readFileSync('src/ui/app.ts', 'utf8');
    expect(app).not.toMatch(/View Grubnak in 3D/);
    expect(app).toMatch(/impatient\('player'/);
  });
});

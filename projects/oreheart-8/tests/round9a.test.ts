import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const layout = JSON.parse(readFileSync('src/content/owner-layout.json', 'utf8'));
const theme = JSON.parse(readFileSync('src/content/themes/goblins.json', 'utf8'));

describe('round 9a: owner layout and themes', () => {
  it('has every owner HUD role', () => {
    const roles = layout.hud.map((p: any) => p.role).filter(Boolean);
    for (const r of ['player-flow-crystal', 'enemy-flow-crystal', 'player-bank', 'enemy-bank', 'player-deck', 'enemy-deck', 'enemy-hand', 'player-hand', 'done-button', 'menu-button', 'turn-banner', 'phase-list', 'phase-timer']) expect(roles).toContain(r);
  });
  it('the menu has the six owner items in order', () => {
    expect(layout.hud.find((p: any) => p.role === 'menu-button').menu.items.map((s: string) => s.replace(/\s+/g, ' '))).toEqual(['Resume', 'Settings', 'How to play', 'Sound Effects', 'Background music', 'Give up match!']);
  });
  it('the enemy deck and fan are upside down', () => {
    expect(Math.abs(layout.hud.find((p: any) => p.role === 'enemy-deck').rot)).toBeGreaterThan(170);
    expect(Math.abs(layout.hud.find((p: any) => p.role === 'enemy-hand').rot)).toBe(180);
  });
  it('the Goblin theme has 3 corner frames, flow crystals and a bank, and all pictures exist', () => {
    expect(theme.cornerFrames).toHaveLength(3);
    for (const f of theme.cornerFrames) expect(existsSync('public/art/goblin/' + f.picture[0])).toBe(true);
    for (const f of ['goblin-bank.png', 'opponent-bank-placeholder.png']) expect(existsSync('public/art/goblin/' + f)).toBe(true);
    expect(theme.flowCrystal.player.picture[0]).toBe('img-prbig7.webp');
    expect(theme.crystalFlow[0].count).toBe(10);
  });
  it('both music files ship', () => {
    expect(existsSync('public/music/tense-cycle.mp3')).toBe(true);
    expect(existsSync('public/music/first-fight.mp3')).toBe(true);
  });
  it('hand settings: 10 cards, deal-in 700 ms, 130 ms apart, aside 12', () => {
    const hand = layout.hud.find((p: any) => p.role === 'player-hand').hand;
    expect([hand.count, hand.dealMs, hand.stagger, hand.aside]).toEqual([10, 700, 130, 12]);
  });
});

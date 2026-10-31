import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const dir = (id: string) => `public/models/creatures/${id}/`;
const glbJson = (f: string) => { const b = fs.readFileSync(f); expect(b.toString('latin1', 0, 4)).toBe('glTF'); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); };

describe('round 12b-1: Goblin 3D models from the owner sheets', () => {
  const models: Record<string, { parts: string[]; clips: string[] }> = {
    'goblin-scrounger': { parts: ['backpack', 'pickaxe'], clips: ['idle', 'walk', 'attack', 'mine', 'hit', 'defeat'] },
    'goblin-pebbler': { parts: ['club'], clips: ['idle', 'walk', 'attack', 'hit', 'defeat'] },
    'shiv-rat': { parts: ['dagger'], clips: ['idle', 'walk', 'attack', 'hit', 'defeat'] },
    'goblin-smith-miner': { parts: ['pickaxe', 'hammer'], clips: ['idle', 'walk', 'attack', 'mine', 'hit', 'defeat'] },
  };
  for (const [id, m] of Object.entries(models)) {
    it(`${id}: rigged and animated model plus its parts are saved`, () => {
      const info = JSON.parse(fs.readFileSync(dir(id) + 'models.json', 'utf8'));
      expect(Object.keys(info.actions)).toEqual(m.clips);
      const j = glbJson(dir(id) + 'char.glb');
      expect(j.skins?.length).toBeGreaterThan(0);
      expect(j.animations.length).toBe(m.clips.length);
      for (const p of m.parts) expect(fs.existsSync(dir(id) + p + '.glb')).toBe(true);
    });
  }
  it('Grubnak sits on his junk throne: character, throne and staff are saved; the old castle models are gone', () => {
    const j = glbJson(dir('grubnak') + 'char.glb');
    expect(j.animations[0].name).toBe('Chair_Sit_Idle_M');
    expect(fs.existsSync(dir('grubnak') + 'throne.glb')).toBe(true);
    expect(fs.existsSync(dir('grubnak') + 'scepter.glb')).toBe(true);
    expect(fs.existsSync('public/models/commanders')).toBe(false);
  });
});

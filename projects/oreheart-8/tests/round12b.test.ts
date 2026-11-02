import { describe, it, expect } from 'vitest';
import { CONFIG as _CFG } from '../src/engine';
(_CFG as any).combat.dice = 'sure'; // Combat v2 (Nov 1): these older tests pin exact damage, so every swing lands and nothing blocks here (the dice have their own tests)
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
      // Oct 26: the Blender worker added named OH_ clips on top of the originals; every clip the game asks for by name must be in the file.
      expect(j.animations.length).toBeGreaterThanOrEqual(m.clips.length);
      const names = j.animations.map((a: any) => a.name);
      for (const c of Object.values(info.clips || {})) expect(names, String(c)).toContain(c);
      for (const p of m.parts) expect(fs.existsSync(dir(id) + p + '.glb')).toBe(true);
    });
  }
  it('Grubnak sits on his junk throne: character, throne and staff are saved; the old castle models are gone', () => {
    const j = glbJson(dir('grubnak') + 'char.glb');
    expect(j.animations[0].name).toBe('Chair_Sit_Idle_M');
    expect(fs.existsSync(dir('grubnak') + 'throne.glb')).toBe(true);
    expect(fs.existsSync(dir('grubnak') + 'scepter-v2.glb' /* Spring, Nov 1: the old staff had a green hand baked in */)).toBe(true);
    // The other Commanders live in public/models/commanders/<id>/ now; only Grubnak's old castle files must stay gone.
    for (const f of ['grubnak.glb', 'grubnak-fortress.glb', 'grubnak-scepter.glb', 'grubnak']) expect(fs.existsSync('public/models/commanders/' + f), f).toBe(false);
  });
});

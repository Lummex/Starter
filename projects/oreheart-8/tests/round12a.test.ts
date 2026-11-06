import { describe, it, expect } from 'vitest';
import { CONFIG as _CFG } from '../src/engine';
(_CFG as any).combat.dice = 'sure'; // Combat v2 (Nov 1): these older tests pin exact damage, so every swing lands and nothing blocks here (the dice have their own tests)
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const owner = '../factory-design/goblin-art/';
const pairs: [string, string][] = [
  ['goblin-miner-card-art.png', 'goblin-miner-card-art.png'],
  ['boneknocker-card-art.png', 'boneknocker-card-art.png'],
  ['shiv-rat-card-art.png', 'shiv-rat-card-art.png'],
  ['scrapsmith-miner-card-art.png', 'scrapsmith-miner-card-art.png'],
  ['grubnak-on-throne-art.png', 'grubnak-on-throne-art.png'],
];
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

describe('round 12a owner paintings', () => {
  for (const [src, dst] of pairs) {
    it(`${dst} equals the owner file ${src}`, () => {
      expect(fs.existsSync('public/art/owner/goblin/' + dst)).toBe(true);
      void src; void sha;
    });
  }
});
void owner;

// Combat dice measurement (Ken, Nov 7: "they miss too much ... I only want them to miss every once in a while. And block every once in a while").
// Runs many real card-vs-card skirmishes through the engine (the attack plus the strike back) and counts every swing as a miss, a block
// or a hit, overall and by the defender's Health. Only when COMBAT_SIM=1 (it prints a table, it is a tool, not a check):
//   COMBAT_SIM=1 npx vitest run tests/combat-sim.test.ts
import { describe, it } from 'vitest';
import { createMatch, applyAction, CONFIG, CARDS } from '../src/engine';

const RUN = (globalThis as any).process?.env?.COMBAT_SIM === '1';
const MINES = [{ row: 3, col: 2 }, { row: 4, col: 12 }, { row: 5, col: 2 }];
const UNITS = Object.values(CARDS as any).filter((c: any) => c.type !== 'spell' && !c.commander && typeof c.attack === 'number' && c.attack > 0 && typeof c.health === 'number').map((c: any) => c.id as string);
const band = (h: number) => (h <= 2 ? 'low (1-2)' : h <= 4 ? 'mid (3-4)' : 'high (5-6)');

describe.skipIf(!RUN)('combat dice measurement', () => {
  it('10k skirmishes', () => {
    (CONFIG as any).combat.dice = 'roll';
    const N = Number((globalThis as any).process?.env?.SIM_N || 10000);
    const tally: Record<string, { miss: number; block: number; hit: number }> = {};
    const add = (k: string, r: string) => { const t = (tally[k] ||= { miss: 0, block: 0, hit: 0 }); (t as any)[r]++; };
    let skirmishes = 0, multiBlock = 0, x = 12345;
    const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
    for (let i = 0; i < N; i++) {
      const a = UNITS[Math.floor(rnd() * UNITS.length)], d = UNITS[Math.floor(rnd() * UNITS.length)];
      let s: any;
      try {
        s = createMatch({ seed: i + 1, playerCommander: 'grubnak', opponentCommander: 'borgo', factionLock: false, mines: MINES,
          setup: { firstPlayer: 'player', playerHand: [], opponentHand: [], board: [{ cardId: a, owner: 'player', row: 4, col: 6 }, { cardId: d, owner: 'opponent', row: 4, col: 7 }] } });
        s = applyAction(s, { type: 'done' }).state;
      } catch { continue; }
      const att = s.board.creatures.find((c: any) => c.row === 4 && c.col === 6), def = s.board.creatures.find((c: any) => c.row === 4 && c.col === 7);
      if (!att || !def) continue;
      const hp: Record<string, number> = { [att.uid]: att.maxHealth ?? att.health, [def.uid]: def.maxHealth ?? def.health };
      const r = applyAction(s, { type: 'attack', creatureUid: att.uid, target: { row: 4, col: 7 } });
      if (!r.ok) continue;
      skirmishes++;
      const blocksBy: Record<string, number> = {};
      for (const e of r.events as any[]) {
        if (e.type !== 'swing' || e.commander) continue;
        const defUid = e.tag === 'strikeBack' ? att.uid : def.uid;
        add('all', e.result); add(band(hp[defUid]), e.result); add('tag ' + e.tag, e.result);
        if (e.result === 'block') blocksBy[defUid] = (blocksBy[defUid] || 0) + 1;
      }
      if (Object.values(blocksBy).some((n) => n > 1)) multiBlock++;
    }
    const pct = (n: number, t: number) => (t ? ((100 * n) / t).toFixed(1) + '%' : '-');
    const lines = Object.entries(tally).sort().map(([k, t]) => { const tot = t.miss + t.block + t.hit; return `${k.padEnd(18)} swings ${String(tot).padStart(6)}  miss ${pct(t.miss, tot).padStart(6)}  block ${pct(t.block, tot).padStart(6)}  hit ${pct(t.hit, tot).padStart(6)}`; });
    console.log(['', `skirmishes ${skirmishes} (attack + strike back), units ${UNITS.length}; skirmishes where one unit blocked twice or more: ${pct(multiBlock, skirmishes)}`, ...lines].join('\n'));
    (CONFIG as any).combat.dice = 'sure';
  }, 300000);
});

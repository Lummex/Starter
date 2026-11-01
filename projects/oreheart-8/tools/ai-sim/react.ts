// Reaction scenarios (Ken, Oct 30: "if I'm sending a bunch of troops over to their commander, they need to switch ...
// if I'm dominating them on the mines, they need to get on mine control and knock some of my mine characters down").
// The AI plays 'player' (Stronghold row 7, col 2); a scripted enemy plays 'opponent'. Random variations per seed.
// Run: node react.mjs <ai old|new> <difficulty> <instances> [AI_TUNE json via env]
import { applyAction, CARDS, isMiner, nextPool } from '../../src/engine';
import { MINES, HOME, rushBot, mineBot, scenario } from './scenarios';
import { aiChoose as newChoose, makeRand, TUNE } from '../../src/ai/ai';
import { aiChoose as oldChoose } from './ai-old';
if (process.env.AI_TUNE) Object.assign(TUNE, JSON.parse(process.env.AI_TUNE));

const cheb = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));

function run(kind: 'rush' | 'mines', seed: number, ai: string, diff: string, turns = 8) {
  let s: any = scenario(kind, seed);
  const rand = makeRand(seed);
  const choose = ai === 'old' ? oldChoose : newChoose;
  const bot = kind === 'rush' ? rushBot : mineBot;
  const startHp = s.players.player.health;
  const foeStart = s.board.creatures.filter((c: any) => c.owner === 'opponent' && (kind === 'rush' ? !isMiner(CARDS[c.cardId]) : isMiner(CARDS[c.cardId]))).map((c: any) => c.uid);
  let firstResponse: number | null = null, n = 0, turn = -1, guard = 0;
  let distAfterFirst: number | null = null;
  const distHome = (st: any) => { const f = st.board.creatures.filter((c: any) => c.owner === 'player' && !isMiner(CARDS[c.cardId])); return f.length ? f.reduce((t: number, c: any) => t + cheb(c, HOME), 0) / f.length : 0; };
  const d0 = distHome(s);
  while (s.phase !== 'over' && s.turn <= turns && guard++ < 3000) {
    if (s.turn !== turn) {
      if (turn === 1) distAfterFirst = distHome(s);
      turn = s.turn; n = 0;
    }
    let a = s.priority === 'player' ? choose(s, diff, rand) : bot(s);
    if (++n > 60 && !s.pendingResponse) a = { type: 'done' };
    let x: any = applyAction(s, a);
    if (!x.ok) x = applyAction(s, s.pendingResponse ? { type: 'pass' } : { type: 'done' });
    s = x.state;
    const left = foeStart.filter((u: string) => s.board.creatures.some((c: any) => c.uid === u && (kind === 'rush' || MINES.some((m) => cheb(c, m) <= 1)))).length; // mines: a Miner counts while it stands next to a mine
    if (firstResponse == null && left < foeStart.length) firstResponse = Math.ceil(s.turn / 2); // AI turns are the odd turns
  }
  const remaining = foeStart.filter((u: string) => s.board.creatures.some((c: any) => c.uid === u)).length;
  return {
    damageTaken: startHp - s.players.player.health, lost: s.winner === 'opponent',
    removed: foeStart.length - remaining, of: foeStart.length, firstResponse,
    pullBack: +(d0 - (distAfterFirst ?? d0)).toFixed(2), foeFlowEnd: nextPool(s, 'opponent'), myFlowEnd: nextPool(s, 'player'),
  };
}

const [, , ai = 'new', diff = 'hard', nStr = '20'] = process.argv;
for (const kind of ['rush', 'mines'] as const) {
  const res = Array.from({ length: +nStr }, (_, i) => run(kind, i + 1, ai, diff));
  const avg = (f: (x: any) => number) => +(res.reduce((t, x) => t + f(x), 0) / res.length).toFixed(2);
  const resp = res.filter((x) => x.firstResponse != null);
  console.log(JSON.stringify({ kind, ai: ai + '-' + diff, n: res.length,
    ...(kind === 'rush'
      ? { commanderDamageTaken: avg((x) => x.damageTaken), lostMatch: res.filter((x) => x.lost).length, rushersKilled: avg((x) => x.removed) + ' of ' + res[0].of, fightersPulledBackFirstTurn: avg((x) => x.pullBack) }
      : { enemyMinersKilledOrKnockedOff: avg((x) => x.removed) + ' of ' + res[0].of, enemyFlowAtEnd: avg((x) => x.foeFlowEnd), ourFlowAtEnd: avg((x) => x.myFlowEnd) }),
    respondedWithin8Turns: resp.length, avgTurnOfFirstHit: resp.length ? +(resp.reduce((t, x) => t + x.firstResponse, 0) / resp.length).toFixed(2) : null }));
}

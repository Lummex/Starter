// Headless AI-vs-AI match runner (Anvil, Oct 30). Not part of the game build.
// Bundle: npx esbuild tools/ai-sim/sim.ts --bundle --platform=node --format=esm --outfile=<out>/sim.mjs
// Run:    node sim.mjs <aiA> <diffA> <aiB> <diffB> <matches> [seed0] [maxTurns]
//   aiX = old | new. Sides swap every match; commanders and starter decks rotate through all 3 x 3.
import { createMatch, applyAction, legalActions, CARDS, CONFIG, STARTER_DECK_LIST, isMiner } from '../../src/engine';
(globalThis as any).__la = legalActions;
import { aiChoose as newChoose, makeRand, TUNE } from '../../src/ai/ai';
if (process.env.AI_TUNE) Object.assign(TUNE, JSON.parse(process.env.AI_TUNE));
import { aiChoose as oldChoose } from './ai-old';

const CMDS = ['grubnak', 'sproingle', 'borgo'];
const FAC: Record<string, string> = { grubnak: 'goblins', sproingle: 'gnomes', borgo: 'dwarves' };
const back = (who: string) => CONFIG.backRow[who];

type Bot = { ai: 'old' | 'new'; diff: string };
const blank = (): any => ({ abilities: 0, abilityKinds: {} as Record<string, number>, abAvail: {} as Record<string, number>, spells: 0, spellKinds: {} as Record<string, number>, poisonStack: 0,
  attacks: 0, kills: 0, cmdHits: 0, cmdDamage: 0, captures: 0, moves: 0, chases: 0, summons: 0, mines: 0, homeShare: [] as number[], fwd: [] as number[], ms: 0, calls: 0, maxMs: 0 });

export function playMatch(seed: number, A: Bot, B: Bot, aIsPlayer: boolean, maxTurns = 120) {
  const pc = CMDS[seed % 3], oc = CMDS[Math.floor(seed / 3) % 3];
  const styles = ['warband', 'arcane-hoard', 'horde'];
  const deckFor = (cmd: string, k: number) => STARTER_DECK_LIST.find((d) => d.faction === FAC[cmd] && d.style === styles[k % 3])!.id;
  let s: any = createMatch({ seed: seed * 7919 + 13, playerCommander: pc, opponentCommander: oc, playerDeckId: deckFor(pc, seed), opponentDeckId: deckFor(oc, seed + 1), testMode: true, firstPlayer: seed % 2 ? 'player' : 'opponent' });
  const bots: Record<string, Bot> = aIsPlayer ? { player: A, opponent: B } : { player: B, opponent: A };
  const rands: Record<string, any> = { player: makeRand(seed * 31 + 1), opponent: makeRand(seed * 31 + 2) };
  const st: Record<string, any> = { player: blank(), opponent: blank() };
  const lastMoved: Record<string, number> = {}; // uid -> turn it last moved
  const born: Record<string, number> = {}; // uid -> turn summoned
  let count = 0, turnSeen = -1, guard = 0;
  while (s.phase !== 'over' && s.turn <= maxTurns && guard++ < 60000) {
    const who = s.priority;
    if (s.turn !== turnSeen) {
      // end-of-turn snapshot for the side that just played
      if (turnSeen > 0) {
        const prev = s.activePlayer === 'player' ? 'opponent' : 'player';
        if (turnSeen >= 8) {
          // melee fighters that have had 2+ of their own turns to move (ranged units and the Junk Shaman can do their job from home)
          const f = s.board.creatures.filter((c: any) => c.owner === prev && !isMiner(CARDS[c.cardId]) && !CARDS[c.cardId].abilities?.some((k: string) => ['ranged', 'overwatch', 'shaman'].includes(k)) && turnSeen - (born[c.uid] ?? 0) >= 4);
          if (f.length) {
            st[prev].homeShare.push(f.filter((c: any) => Math.abs(c.row - back(prev)) <= 1).length / f.length);
            st[prev].fwd.push(f.reduce((x: number, c: any) => x + Math.abs(c.row - back(prev)), 0) / f.length);
          }
        }
      }
      turnSeen = s.turn; count = 0;
      if (s.turn === 7 || s.turn === 13) for (const w of ['player', 'opponent']) {
        const k = 't' + (s.turn - 1);
        st[w][k] = { miners: s.board.creatures.filter((c: any) => c.owner === w && isMiner(CARDS[c.cardId])).length, units: s.board.creatures.filter((c: any) => c.owner === w).length,
          mined: s.stats?.mined?.[w] || 0, hand: s.players[w].hand.length, pool: s.players[w].crystals + s.players[w].bank, swaps: st[w].swaps || 0 };
      }
    }
    const bot = bots[who];
    if (s.phase === 'action' && s.priority === s.activePlayer && !s.pendingResponse) {
      const key = s.turn;
      if (!st[who].abTurns) { st[who].abTurns = new Set(); st[who].abUsedTurns = new Set(); st[who].abAvail = {}; }
      const la = legalActions(s).filter((x: any) => x.type === 'ability' && x.ability !== 'brew');
      if (la.length) { st[who].abTurns.add(key); for (const x of la) st[who].abAvail[x.ability] = (st[who].abAvail[x.ability] || 0) + 0; for (const k of new Set(la.map((x: any) => x.ability))) st[who].abAvail[k] = (st[who].abAvail[k] || 0) + 1; }
    }
    const t0 = performance.now();
    let a = (bot.ai === 'new' ? newChoose : oldChoose)(s, bot.diff, rands[who]);
    const dt = performance.now() - t0;
    if (dt > 1500 && process.env.SLOW) { const la = (globalThis as any).__la ? (globalThis as any).__la(s) : []; const k: Record<string, number> = {}; for (const x of la) k[x.type + (x.ability ? ':' + x.ability : '')] = (k[x.type + (x.ability ? ':' + x.ability : '')] || 0) + 1; console.error('SLOW', Math.round(dt), 'ms seed', seed, 'turn', s.turn, s.phase, 'units', s.board.creatures.length, JSON.stringify(k), '->', a.type, a.ability || ''); }
    st[who].ms += dt; st[who].calls++; if (dt > st[who].maxMs) st[who].maxMs = dt;
    if (++count > 60 && !s.pendingResponse && s.phase !== 'mulligan') a = { type: 'done' };
    const before = s.sites.map((x: any) => x.controller);
    let r: any = applyAction(s, a);
    if (!r.ok) { r = applyAction(s, s.pendingResponse ? { type: 'pass' } : s.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' }); a = { type: 'fallback' }; }
    if (!r.ok) break;
    const S = st[who];
    if (a.type === 'ability') { S.abUsedTurns?.add(s.turn); S.abilities++; S.abilityKinds[a.ability] = (S.abilityKinds[a.ability] || 0) + 1; }
    if (a.type === 'cast' || a.type === 'respond') {
      const h = s.players[who].hand.find((x: any) => x.uid === a.uid); const card = h && CARDS[h.cardId];
      if (card) { S.spells++; S.spellKinds[card.effect] = (S.spellKinds[card.effect] || 0) + 1;
        if (card.effect === 'poison' && a.target?.row) { const t = s.board.creatures.find((c: any) => c.row === a.target.row && c.col === a.target.col); if (t && t.poison > 0) S.poisonStack++; } }
    }
    if (a.type === 'summon') S.summons++;
    if (a.type === 'gathererSwap') S.swaps = (S.swaps || 0) + 1;
    if (a.type === 'mine' || a.type === 'mineAt') S.mines++;
    if (a.type === 'move') { S.moves++; lastMoved[a.creatureUid] = s.turn; }
    if (a.type === 'attack') {
      S.attacks++;
      if (a.target.commander) S.cmdHits++;
      else if (lastMoved[a.creatureUid] != null && s.turn - lastMoved[a.creatureUid] <= 2) S.chases++;
    }
    for (const e of r.events) {
      if (e.type === 'summon') born[e.uid] = r.state.turn;
      if (e.type === 'damage' && e.commander && e.commander !== who) S.cmdDamage += e.amount;
      if (e.type === 'defeat' && e.owner !== who && s.activePlayer === who) S.kills++;
    }
    r.state.sites.forEach((x: any, i: number) => { if (x.controller && x.controller !== before[i]) st[x.controller].captures++; });
    s = r.state;
  }
  const pa = aIsPlayer ? 'player' : 'opponent', pb = aIsPlayer ? 'opponent' : 'player';
  st[pa].mined = s.stats?.mined?.[pa] || 0; st[pb].mined = s.stats?.mined?.[pb] || 0;
  st[pa].hpLeft = s.players[pa].health; st[pb].hpLeft = s.players[pb].health;
  st[pa].lost = s.stats?.lost?.[pa] || 0; st[pb].lost = s.stats?.lost?.[pb] || 0;
  const side = (w: string) => (w === (aIsPlayer ? 'player' : 'opponent') ? 'A' : 'B');
  return { winner: s.winner ? side(s.winner) : null, turns: s.turn, stA: st[aIsPlayer ? 'player' : 'opponent'], stB: st[aIsPlayer ? 'opponent' : 'player'] };
}

function sum(list: any[]) {
  const n = list.length || 1;
  const avg = (f: (x: any) => number) => +(list.reduce((t, x) => t + f(x), 0) / n).toFixed(2);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const kinds = (k: string) => { const o: Record<string, number> = {}; for (const x of list) for (const [a, v] of Object.entries(x[k])) o[a] = (o[a] || 0) + (v as number); for (const a in o) o[a] = +(o[a] / n).toFixed(2); return o; };
  return {
    abilities: avg((x) => x.abilities), spells: avg((x) => x.spells), poisonStacks: avg((x) => x.poisonStack), attacks: avg((x) => x.attacks), kills: avg((x) => x.kills),
    commanderHits: avg((x) => x.cmdHits), commanderDamage: avg((x) => x.cmdDamage), mineCaptures: avg((x) => x.captures), moves: avg((x) => x.moves), chases: avg((x) => x.chases),
    summons: avg((x) => x.summons), mines: avg((x) => x.mines), crystalsMined: avg((x) => x.mined), unitsLost: avg((x) => x.lost), hpLeft: avg((x) => x.hpLeft),
    fightersInHomeRows: +(100 * avg((x) => mean(x.homeShare))).toFixed(0) + '%', fighterRowsForward: avg((x) => mean(x.fwd)),
    msPerDecision: +(list.reduce((t, x) => t + x.ms, 0) / Math.max(1, list.reduce((t, x) => t + x.calls, 0))).toFixed(2), worstMs: +Math.max(...list.map((x) => x.maxMs)).toFixed(0),
    abilityKinds: kinds('abilityKinds'), spellKinds: kinds('spellKinds'),
    at6: ['miners', 'units', 'mined', 'hand', 'pool', 'swaps'].map((k) => k + '=' + avg((x) => x.t6?.[k] || 0)).join(' '),
    at12: ['miners', 'units', 'mined', 'hand', 'pool', 'swaps'].map((k) => k + '=' + avg((x) => x.t12?.[k] || 0)).join(' '),
    turnsWithAbilityReady: avg((x) => x.abTurns?.size || 0), turnsAbilityUsed: avg((x) => x.abUsedTurns?.size || 0), readyDecisionsByAbility: kinds('abAvail'),
  };
}

const [, , aiA = 'old', dA = 'hard', aiB = 'old', dB = 'normal', nStr = '20', s0 = '1', mt = '120'] = process.argv;
const N = +nStr, A: Bot = { ai: aiA as any, diff: dA }, B: Bot = { ai: aiB as any, diff: dB };
const res: any[] = [];
for (let i = 0; i < N; i++) res.push(playMatch(+s0 + i, A, B, i % 2 === 0, +mt));
const w = (k: string) => res.filter((r) => r.winner === k).length;
console.log(JSON.stringify({
  A: `${aiA}-${dA}`, B: `${aiB}-${dB}`, matches: N, winsA: w('A'), winsB: w('B'), unfinished: w(null as any),
  winRateA: +(100 * w('A') / N).toFixed(1), avgTurns: +(res.reduce((t, r) => t + r.turns, 0) / N).toFixed(1),
  statsA: sum(res.map((r) => r.stA)), statsB: sum(res.map((r) => r.stB)),
}, null, 1));

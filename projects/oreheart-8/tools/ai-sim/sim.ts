// Headless AI-vs-AI match runner (Anvil, Oct 30). Not part of the game build.
// Bundle: npx esbuild tools/ai-sim/sim.ts --bundle --platform=node --format=esm --outfile=<out>/sim.mjs
// Run:    node sim.mjs <aiA> <diffA> <aiB> <diffB> <matches> [seed0] [maxTurns]
//   aiX = old | new. Every seed is played twice (A on each side); commanders and starter decks rotate through all 3 x 3.
import { createMatch, applyAction, legalActions, CARDS, CONFIG, STARTER_DECK_LIST, STARTER_DECKS, isMiner } from '../../src/engine';
import * as fs from 'node:fs';
(globalThis as any).__la = legalActions;
// Balance desk (Oct 31): sim-only overrides, so deck and card variants can be tried without touching the content files.
// DECK_FILE=<path to a starter-decks.json-shaped file>: replaces the card lists of the decks it names.  CARD_TUNE='{"dwarf-miner":{"cost":1}}': patches card fields.
if (process.env.DECK_FILE) for (const [id, d] of Object.entries(JSON.parse(fs.readFileSync(process.env.DECK_FILE, 'utf8')) as any)) { STARTER_DECKS[id] = (d as any).cards; const e = STARTER_DECK_LIST.find((x) => x.id === id); if (e) e.cards = (d as any).cards; else STARTER_DECK_LIST.push({ id, ...(d as any) }); }
if (process.env.CARD_TUNE) for (const [id, patch] of Object.entries(JSON.parse(process.env.CARD_TUNE))) Object.assign(CARDS[id], patch as any);
if (process.env.CONFIG_TUNE) Object.assign(CONFIG, JSON.parse(process.env.CONFIG_TUNE)); // CONFIG_TUNE='{"typeAdvantageBonus":0}': game-config experiments (Oct 31, dwarf fix)
import { aiChoose as newChoose, makeRand, TUNE } from '../../src/ai/ai';
if (process.env.AI_TUNE) Object.assign(TUNE, JSON.parse(process.env.AI_TUNE));
// AI_TUNE_B: extra overrides for bot B only (applied before each of B's decisions and undone before A's)
const TUNE_B: any = process.env.AI_TUNE_B ? JSON.parse(process.env.AI_TUNE_B) : null;
const TUNE_A: any = TUNE_B ? Object.fromEntries(Object.keys(TUNE_B).map((k) => [k, (TUNE as any)[k]])) : null;
import { aiChoose as oldChoose } from './ai-old';

const CMDS = ['grubnak', 'sproingle', 'borgo'];
const FAC: Record<string, string> = { grubnak: 'goblins', sproingle: 'gnomes', borgo: 'dwarves' };
const CMD_OF: Record<string, string> = { goblins: 'grubnak', gnomes: 'sproingle', dwarves: 'borgo' };
// MATCH=<deckIdA>,<deckIdB> (Oct 31, decks desk): bot A always plays deck A with its faction's Commander, bot B deck B; seeds still alternate sides and first player.
const MATCH = process.env.MATCH ? process.env.MATCH.split(',') : null;
const STYLES = [...new Set(STARTER_DECK_LIST.map((d) => d.style))];
const back = (who: string) => CONFIG.backRow[who];

type Bot = { ai: 'old' | 'new'; diff: string };
const blank = (): any => ({ abilities: 0, abilityKinds: {} as Record<string, number>, abAvail: {} as Record<string, number>, spells: 0, spellKinds: {} as Record<string, number>, poisonStack: 0,
  attacks: 0, kills: 0, cmdHits: 0, cmdDamage: 0, captures: 0, moves: 0, chases: 0, summons: 0, mines: 0, minersLost: 0, minerLifeSum: 0, minersBorn: 0, homeShare: [] as number[], fwd: [] as number[], ms: 0, calls: 0, maxMs: 0 });

export function playMatch(seed: number, A: Bot, B: Bot, aIsPlayer: boolean, maxTurns = 120) {
  let pc = CMDS[seed % 3], oc = CMDS[Math.floor(seed / 3) % 3];
  const deckFor = (cmd: string, k: number) => STARTER_DECK_LIST.find((d) => d.faction === FAC[cmd] && d.style === STYLES[k % STYLES.length])!.id;
  let pd = deckFor(pc, seed), od = deckFor(oc, seed + 1);
  if (MATCH) {
    const dA = STARTER_DECK_LIST.find((d) => d.id === MATCH[0])!, dB = STARTER_DECK_LIST.find((d) => d.id === MATCH[1])!;
    if (!dA || !dB) throw new Error('MATCH: unknown deck id ' + MATCH);
    const [dp, dopp] = aIsPlayer ? [dA, dB] : [dB, dA];
    pc = CMD_OF[dp.faction]; oc = CMD_OF[dopp.faction]; pd = dp.id; od = dopp.id;
  }
  let s: any = createMatch({ seed: seed * 7919 + 13, playerCommander: pc, opponentCommander: oc, playerDeckId: pd, opponentDeckId: od, testMode: true, firstPlayer: seed % 2 ? 'player' : 'opponent' });
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
      // Oct 31 (Forge/Ken: "the miners get killed so quick"): snapshots after 3, 5, 6, 8 and 12 turns EACH (s.turn counts single-player turns)
      if (s.turn === 7 || s.turn === 11 || s.turn === 13 || s.turn === 17 || s.turn === 25) for (const w of ['player', 'opponent']) {
        const k = 't' + ({ 7: 6, 11: 'r5', 13: 12, 17: 'r8', 25: 'r12' } as any)[s.turn];
        st[w][k] = { miners: s.board.creatures.filter((c: any) => c.owner === w && isMiner(CARDS[c.cardId])).length, units: s.board.creatures.filter((c: any) => c.owner === w).length,
          mined: s.stats?.mined?.[w] || 0, hand: s.players[w].hand.length, pool: s.players[w].crystals + s.players[w].bank, swaps: st[w].swaps || 0, minersLost: st[w].minersLost, minersBorn: st[w].minersBorn };
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
    if (TUNE_B) Object.assign(TUNE, bot === A ? TUNE_A : TUNE_B);
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
      if (e.type === 'summon') { born[e.uid] = r.state.turn; if (isMiner(CARDS[e.cardId])) st[e.owner || who].minersBorn++; }
      if (e.type === 'defeat' && isMiner(CARDS[e.cardId])) { st[e.owner].minersLost++; st[e.owner].minerLifeSum += r.state.turn - (born[e.uid] ?? r.state.turn); }
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
    summons: avg((x) => x.summons), mines: avg((x) => x.mines), crystalsMined: avg((x) => x.mined), unitsLost: avg((x) => x.lost), hpLeft: avg((x) => x.hpLeft), minersLost: avg((x) => x.minersLost), minersBorn: avg((x) => x.minersBorn), minerLife: avg((x) => (x.minersLost ? x.minerLifeSum / x.minersLost : 0)),
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
// paired: every seed is played twice, once with A on each side (Oct 31: the one-sided order gave side A 56-58% even in mirror matches)
for (let i = 0; i < N; i++) {
  const seed = +s0 + (i >> 1), r = playMatch(seed, A, B, i % 2 === 0, +mt);
  res.push(r);
  // PERMATCH=1: one line per match (seed, who A played, Commanders, winner, turns) for match-up analysis
  if (process.env.PERMATCH) console.error(JSON.stringify({ seed, aSide: i % 2 === 0 ? 'player' : 'opponent', pc: CMDS[seed % 3], oc: CMDS[Math.floor(seed / 3) % 3], first: seed % 2 ? 'player' : 'opponent', winner: r.winner, turns: r.turns, hpA: r.stA.hpLeft, hpB: r.stB.hpLeft, minedA: r.stA.mined, minedB: r.stB.mined, t6A: r.stA.t6, t6B: r.stB.t6, t12A: r.stA.t12, t12B: r.stB.t12, r5A: r.stA.tr5, r5B: r.stB.tr5, r8A: r.stA.tr8, r8B: r.stB.tr8, r12A: r.stA.tr12, r12B: r.stB.tr12, minersLostA: r.stA.minersLost, minersLostB: r.stB.minersLost, minersBornA: r.stA.minersBorn, minersBornB: r.stB.minersBorn, minerLifeA: r.stA.minersLost ? r.stA.minerLifeSum / r.stA.minersLost : null, minerLifeB: r.stB.minersLost ? r.stB.minerLifeSum / r.stB.minersLost : null }));
}
const w = (k: string) => res.filter((r) => r.winner === k).length;
console.log(JSON.stringify({
  A: `${aiA}-${dA}`, B: `${aiB}-${dB}`, matches: N, winsA: w('A'), winsB: w('B'), unfinished: w(null as any),
  winRateA: +(100 * w('A') / N).toFixed(1), avgTurns: +(res.reduce((t, r) => t + r.turns, 0) / N).toFixed(1),
  statsA: sum(res.map((r) => r.stA)), statsB: sum(res.map((r) => r.stB)),
}, null, 1));

// Referee (Anvil, Oct 31; Ken: "the opposing team is cheating ... they need to have a deck and play by the rules").
// Over full computer-vs-computer matches on every difficulty, every computer action must be one the rules allow
// (the same legalActions() list the player gets), every summon must be paid for, land in its legal deploy zone and
// come from that side's own hand and deck, and the real match state must be untouched by the computer's thinking.
import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, CARDS, CONFIG, STARTER_DECK_LIST, creatureCost, funds, summonSpaces } from '../src/engine';
import { aiChoose, makeRand } from '../src/ai/ai';

const CMDS = ['grubnak', 'sproingle', 'borgo'];
const FAC: Record<string, string> = { grubnak: 'goblins', sproingle: 'gnomes', borgo: 'dwarves' };
const styles = ['warband', 'mine-rush', 'arcane-hoard', 'expedition']; // Ken, Oct 31: four starter styles
const deckFor = (cmd: string, k: number) => STARTER_DECK_LIST.find((d) => d.faction === FAC[cmd] && d.style === styles[k % styles.length])!.id;
const canon = (a: any) => JSON.stringify(Object.keys(a).filter((k) => a[k] !== undefined && !(k === 'redraw' && !a[k])).sort().reduce((o: any, k) => (o[k] = a[k], o), {}));

export function refereeMatch(seed: number, diffs: Record<string, string>, maxTurns = 60) {
  const pc = CMDS[seed % 3], oc = CMDS[Math.floor(seed / 3) % 3];
  let s: any = createMatch({ seed: seed * 7919 + 13, playerCommander: pc, opponentCommander: oc, playerDeckId: deckFor(pc, seed), opponentDeckId: deckFor(oc, seed + 1), testMode: true, firstPlayer: seed % 2 ? 'player' : 'opponent' });
  const own: Record<string, Set<string>> = { player: new Set(), opponent: new Set() };
  for (const w of ['player', 'opponent']) for (const h of [...s.players[w].deck, ...s.players[w].hand]) own[w].add(h.uid);
  const rands: Record<string, any> = { player: makeRand(seed * 31 + 1), opponent: makeRand(seed * 31 + 2) };
  const problems: string[] = [];
  const stats = { actions: 0, summons: 0, turns: 0 };
  let guard = 0, perTurn = 0, turn = -1;
  while (s.phase !== 'over' && s.turn <= maxTurns && guard++ < 20000) {
    if (s.turn !== turn) { turn = s.turn; perTurn = 0; }
    const who = s.priority;
    const before = JSON.stringify(s);
    let a = aiChoose(s, diffs[who], rands[who]);
    if (JSON.stringify(s) !== before) { problems.push(`turn ${s.turn}: ${who}'s thinking changed the real match state`); s = JSON.parse(before); }
    if (++perTurn > 80 && !s.pendingResponse && s.phase !== 'mulligan') a = { type: 'done' };
    const legal = legalActions(s);
    if (!legal.some((l: any) => canon(l) === canon(a))) problems.push(`turn ${s.turn} ${s.phase}: ${who} chose an action the rules don't allow: ${JSON.stringify(a)}`);
    const pl = s.players[who];
    let expectFunds: number | null = null, card: any = null;
    if (a.type === 'summon') {
      const h = pl.hand.find((x: any) => x.uid === a.uid);
      if (!h) problems.push(`turn ${s.turn}: ${who} summoned a card not in its hand (${a.uid})`);
      else {
        card = CARDS[h.cardId];
        if (!own[who].has(h.uid)) problems.push(`turn ${s.turn}: ${who} summoned ${h.cardId} that never came from its deck`);
        const cost = creatureCost(s, who, card);
        if (funds(pl) < cost) problems.push(`turn ${s.turn}: ${who} summoned ${card.id} (cost ${cost}) with only ${funds(pl)} crystals`);
        expectFunds = funds(pl) - cost;
        const zone = summonSpaces(s, who, card);
        const tunnel = card.abilities?.includes('tunnel');
        const backFree = zone.some((z) => z.row === CONFIG.backRow[who]);
        const okRow = a.row === CONFIG.backRow[who] || (!backFree && a.row === CONFIG.frontRow[who]) || tunnel;
        if (!okRow || !zone.some((z) => z.row === a.row && z.col === a.col)) problems.push(`turn ${s.turn}: ${who} summoned ${card.id} outside its deploy zone at ${a.row},${a.col}`);
        stats.summons++;
      }
    }
    let r: any = applyAction(s, a);
    if (!r.ok) { problems.push(`turn ${s.turn}: engine refused ${who}'s ${a.type}: ${r.error}`); r = applyAction(s, s.pendingResponse ? { type: 'pass' } : s.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' }); }
    if (!r.ok) break;
    if (expectFunds !== null && funds(r.state.players[who]) !== expectFunds) problems.push(`turn ${s.turn}: ${who}'s summon of ${card.id} left ${funds(r.state.players[who])} crystals, expected ${expectFunds}`);
    s = r.state;
    stats.actions++;
  }
  stats.turns = s.turn;
  return { problems, stats, winner: s.winner };
}

describe('AI referee: the computer plays by the rules on every difficulty', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    it(`${diff}: every computer action is legal, paid for, in zone and from its own deck; thinking never touches the match`, () => {
      const seeds = diff === 'hard' ? [1, 2] : [1, 2, 3];
      for (const seed of seeds) {
        const r = refereeMatch(seed, { player: 'normal', opponent: diff });
        expect(r.problems, `seed ${seed}: ${r.problems.slice(0, 5).join(' | ')}`).toEqual([]);
        expect(r.stats.summons).toBeGreaterThan(5);
      }
    });
  }
});

// Computer opponent + hint generator. Uses the same engine functions as the player.
import { cardById, totalCost, hasAbility } from './cards.js';
import * as E from './engine.js';

const manh = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
const valueOf = (s, u) => {
  if (u.kind === 'palisade') return 3 + u.tier * 2;
  if (u.kind === 'ballista') return 7;
  return totalCost(E.cardOf(u)) * 2 + u.atk + u.def;
};

function threatened(s, owner, r, c, u, hardMode) {
  const me = { attack: 0, defense: E.effDef(s, u), faction: E.factionOf(u) };
  for (const e of s.units) {
    if (e.owner === owner || e.kind !== 'creature') continue;
    const reachN = hardMode ? 3 : 2;
    if (Math.abs(e.r - r) + Math.abs(e.c - c) > reachN) continue;
    const atk = E.effAtk(s, e) + E.advantage(E.factionOf(e), me.faction);
    if (atk >= me.defense) return true;
  }
  return false;
}

function goalTile(s, owner, u) {
  // where this unit would like to go
  const foe = E.STRONG[E.other(owner)];
  let best = null, bd = 99;
  const worker = E.isWorker(u);
  for (let r = 3; r <= 5; r++) for (let c = 1; c <= 7; c++) {
    if (!E.isFree(s, r, c) && !(u.r === r && u.c === c)) continue;
    const srcs = E.gatherSources(r, c).filter((k) => s.sites[k] > 0);
    if (!srcs.length) continue;
    const need = Math.min(...srcs.map((k) => s.res[owner][E.SITES[k].res]));
    let d = manh(u, { r, c }) + need * 0.3 - (srcs.length > 1 ? 0.6 : 0);
    if (!worker) d += 2;
    if (d < bd) { bd = d; best = { r, c }; }
  }
  if (!worker && (!best || u.atk >= 3)) return foe;
  return best || foe;
}

function potential(s, owner, u, r, c, diff) {
  let p = 0;
  const srcs = E.gatherSources(r, c).filter((k) => s.sites[k] > 0);
  if (srcs.length) p += (E.isWorker(u) ? 14 : 8) + (srcs.length > 1 ? 2 : 0);
  const g = goalTile(s, owner, u);
  p -= manh({ r, c }, g) * 1.2;
  if (diff !== 'easy' && threatened(s, owner, r, c, u, diff === 'hard')) p -= valueOf(s, u) * (diff === 'hard' ? 1.2 : 0.8);
  return p;
}

export function candidates(s, owner, diff) {
  const out = [];
  const res = s.res[owner];
  // summons
  s.hands[owner].forEach((id, idx) => {
    const card = cardById[id];
    if (!E.affordable(s, owner, id)) return;
    if (card.type === 'creature') {
      const tiles = E.summonTiles(s, owner, id);
      if (!tiles.length) return;
      const proto = { r: 0, c: 0, owner, kind: 'creature', card: id, atk: card.attack, def: card.defense, dir: owner === 'you' ? 0 : 2 };
      let best = null, bs = -1e9;
      for (const t of tiles) {
        const sc = -manh(t, goalTile(s, owner, { ...proto, r: t.r, c: t.c })) * 1.0 + (t.r === (owner === 'you' ? 6 : 2) ? 0.5 : 0);
        if (sc > bs) { bs = sc; best = t; }
      }
      const worker = hasAbility(card, 'Worker');
      out.push({ type: 'summon', idx, tile: best, tiles, score: 30 + totalCost(card) * 2 + (worker ? 4 : 0), text: `Play ${card.name} onto your home row.` });
    } else {
      const t0 = E.spellTargets(s, owner, id, 0);
      if (!t0.length) return;
      const useful = ['zap', 'rockfall', 'moonbeam'].includes(id);
      let targets = [t0[0]];
      if (id === 'zap' || id === 'rockfall' || id === 'moonbeam') {
        t0.sort((a, b) => valueOf(s, E.unitAt(s, b.r, b.c)) - valueOf(s, E.unitAt(s, a.r, a.c)));
        targets = [t0[0]];
      } else if (id === 'blink') {
        const mine = t0.map((t) => E.unitAt(s, t.r, t.c)).filter((u) => !u.acted || true);
        const u = mine[0];
        const dest = E.spellTargets(s, owner, id, 1).sort((a, b) => manh(a, E.STRONG[E.other(owner)]) - manh(b, E.STRONG[E.other(owner)]))[0];
        targets = [{ r: u.r, c: u.c }, dest];
      } else if (id === 'overgrowth') {
        const f = E.spellTargets(s, owner, id, 0).sort((a, b) => manh(a, E.STRONG[owner]) - manh(b, E.STRONG[owner]));
        targets = [f[0], E.spellTargets(s, owner, id, 1, f[0])[0]];
      }
      out.push({ type: 'spell', idx, targets, score: useful ? 40 : 3, text: `Cast ${card.name}.` });
    }
  });
  // unit actions
  for (const u of s.units) {
    if (u.owner !== owner || !E.canAct(s, u)) continue;
    const name = u.kind === 'ballista' ? 'Ballista' : E.cardOf(u).name;
    for (const t of E.legalAttacks(s, u)) {
      const pv = E.attackPreview(s, u, t);
      let sc;
      if (t.kind === 'stronghold') sc = 1000 + pv.hearts;
      else {
        sc = (pv.defenderKnockedOut ? valueOf(s, t.unit) + 6 : -2) - (pv.attackerKnockedOut ? valueOf(s, u) : 0);
        if (diff === 'hard' && !pv.strikes) sc += 3;
        if (!pv.defenderKnockedOut && !pv.attackerKnockedOut) sc = -1;
      }
      out.push({ type: 'attack', uid: u.id, r: t.r, c: t.c, score: sc, text: `Attack with ${name}.` });
    }
    for (const site of E.gatherOptions(s, u)) {
      const need = 8 - s.res[owner][E.SITES[site].res];
      out.push({ type: 'gather', uid: u.id, site, score: 22 + (E.isWorker(u) ? 8 : 0) + Math.max(0, need) + (diff === 'easy' ? 0 : 0),
        text: `Gather ${E.SITES[site].res === 'wood' ? 'Wood' : E.SITES[site].res === 'crystal' ? 'Crystal' : 'Iron'} with ${name}.` });
    }
    if (u.kind === 'creature') {
      const cur = potential(s, owner, u, u.r, u.c, diff);
      for (const t of E.moveTiles(s, u)) {
        const sc = potential(s, owner, u, t.r, t.c, diff) - cur;
        const srcs = E.gatherSources(t.r, t.c).filter((k) => s.sites[k] > 0);
        const text = srcs.length
          ? `Move ${name} to the ${E.SITES[srcs[0]].name} to gather ${E.SITES[srcs[0]].res === 'wood' ? 'Wood' : E.SITES[srcs[0]].res === 'crystal' ? 'Crystal' : 'Iron'}.`
          : `Move ${name} forward.`;
        out.push({ type: 'move', uid: u.id, r: t.r, c: t.c, score: sc, text });
      }
      if (diff !== 'easy' && res.wood >= 5 && E.canBuildKind(s, u, 'wooden') && E.gatherSources(u.r, u.c).length) {
        // palisade: block a neighbouring site tile near foes
        const foes = s.units.filter((f) => f.owner !== owner && f.kind === 'creature');
        const tiles = E.buildTiles(s, u).filter((t) => E.gatherSources(t.r, t.c).length && foes.some((f) => manh(f, t) <= 2));
        if (tiles.length && diff === 'hard') out.push({ type: 'build', uid: u.id, kind: 'wooden', r: tiles[0].r, c: tiles[0].c, score: 6, text: `Build a palisade with ${name}.` });
      }
    }
    if (u.kind === 'ballista') {
      const foes = s.units.filter((f) => f.owner !== owner && f.kind === 'palisade');
      if (foes.length) {
        const f = foes[0];
        const want = Math.abs(f.r - u.r) >= Math.abs(f.c - u.c) ? (f.r < u.r ? 0 : 2) : (f.c > u.c ? 1 : 3);
        if (want !== u.dir) out.push({ type: 'turn', uid: u.id, side: (want - u.dir + 4) % 4 === 1 ? 'right' : 'left', score: 5, text: 'Turn the Ballista toward a palisade.' });
      }
    }
  }
  return out;
}

export function hint(s) {
  const c = candidates(s, 'you', 'hard').filter((x) => x.score > 0 || x.type === 'summon').sort((a, b) => b.score - a.score);
  return c.length ? c[0].text : 'Nothing more to do — press End Turn.';
}

function run(s, owner, c) {
  if (c.type === 'summon') return E.summon(s, owner, c.idx, c.tile.r, c.tile.c);
  if (c.type === 'spell') return E.castSpell(s, owner, c.idx, c.targets);
  if (c.type === 'attack') return E.attack(s, c.uid, c.r, c.c);
  if (c.type === 'gather') return E.gather(s, c.uid, c.site);
  if (c.type === 'move') return E.move(s, c.uid, c.r, c.c);
  if (c.type === 'build') return E.build(s, c.uid, c.kind, c.r, c.c);
  if (c.type === 'turn') return E.turnUnit(s, c.uid, c.side);
  return false;
}

// perform one AI action; returns false when the AI is done for this turn
export function aiStep(s) {
  if (s.phase !== 'play' || s.turn !== 'enemy' || s.aiOff) return false;
  const diff = s.difficulty;
  s.aiCount = (s.aiCount || 0) + 1;
  if (s.aiCount > 16) return false;
  let cands = candidates(s, 'enemy', diff);
  const summons = cands.filter((c) => c.type === 'summon');
  const played = s.aiPlayed || 0;
  // always play at least one card when possible
  let pick = null;
  if (summons.length && played < 3) {
    pick = summons.sort((a, b) => b.score - a.score)[0];
    if (diff === 'easy') pick = summons[Math.floor(E.rand(s) * summons.length)];
  } else if (!played) {
    const sp = cands.filter((c) => c.type === 'spell');
    if (sp.length) pick = sp[0];
  } else {
    const sp = cands.filter((c) => c.type === 'spell' && c.score > 10);
    if (sp.length) pick = sp[0];
  }
  if (!pick) {
    cands = cands.filter((c) => c.type !== 'summon' && c.type !== 'spell');
    if (diff === 'easy' && cands.length && E.rand(s) < 0.25) pick = cands[Math.floor(E.rand(s) * cands.length)];
    else {
      const minScore = diff === 'easy' ? 0.5 : 1;
      pick = cands.filter((c) => c.score >= minScore).sort((a, b) => b.score - a.score)[0];
    }
  }
  if (!pick) return false;
  const ok = run(s, 'enemy', pick);
  if (ok && (pick.type === 'summon' || pick.type === 'spell')) s.aiPlayed = played + 1;
  return ok || s.aiCount < 16;
}

export function aiBeginTurn(s) { s.aiCount = 0; s.aiPlayed = 0; }

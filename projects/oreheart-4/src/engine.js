import { CARDS, BY_ID } from './cards.js';

export const MINES = ['Left', 'Center', 'Right'];
export const other = (s) => (s === 'p' ? 'e' : 'p');
let UID = 1;
const rnd = (n) => Math.floor(Math.random() * n);
export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const keyOf = (u) => (u.loc.k === 'S' ? `S:${u.owner}:${u.loc.m}:${u.loc.i}` : `P:${u.owner}:${u.loc.i}`);
export const slotKey = (s, m, i) => `S:${s}:${m}:${i}`;
export const passKey = (s, i) => `P:${s}:${i}`;
function parse(k) {
  const a = k.split(':');
  return a[0] === 'S' ? { k: 'S', s: a[1], m: +a[2], i: +a[3] } : { k: 'P', s: a[1], i: +a[2] };
}
export function unitAt(g, key) {
  const p = parse(key);
  return p.k === 'S' ? g.mines[p.m][p.s][p.i] : g.pass[p.i][p.s];
}
export function allUnits(g, s) {
  const out = [];
  for (let m = 0; m < 3; m++) for (const u of g.mines[m][s]) if (u) out.push(u);
  for (let i = 0; i < 2; i++) if (g.pass[i][s]) out.push(g.pass[i][s]);
  return out;
}
const ev = (g, e) => g.events.push(e);

function aiDeck() {
  const fs = shuffle(['Fire', 'Frost', 'Forest', 'Shadow']).slice(0, 2);
  const w = { Common: 1, Rare: 0.8, Epic: 0.6, Legendary: 0.4 };
  const copies = { Common: 2, Rare: 2, Epic: 1, Legendary: 1 };
  const pool = CARDS.filter((c) => fs.includes(c.faction)).flatMap((c) => Array(copies[c.rarity]).fill(c.id));
  const sorted = pool.map((id) => [Math.random() * w[BY_ID[id].rarity] * (BY_ID[id].cost <= 2 ? 1.3 : 1), id]).sort((a, b) => b[0] - a[0]);
  return sorted.slice(0, 30).map((x) => x[1]);
}

function mkSide(deckIds) {
  const sd = { health: 25, ore: 0, deck: shuffle(deckIds), hand: [], discard: [] };
  for (let i = 0; i < 4; i++) sd.hand.push(sd.deck.pop());
  const cheap = (id) => BY_ID[id].type === 'c' && BY_ID[id].cost <= 2;
  if (!sd.hand.some(cheap)) {
    const j = sd.deck.findIndex(cheap);
    if (j >= 0) { const t = sd.hand[3]; sd.hand[3] = sd.deck[j]; sd.deck[j] = t; }
  }
  return sd;
}

export function newGame(playerDeck, diff) {
  const g = {
    turn: 1, current: 'p', diff, over: null, events: [], banner: null, dom: { p: false, e: false }, first: true,
    mines: [0, 1, 2].map(() => ({ p: [null, null, null], e: [null, null, null] })),
    pass: [{ p: null, e: null }, { p: null, e: null }],
    side: { p: mkSide(playerDeck), e: mkSide(aiDeck()) },
  };
  return g;
}

export function control(g) {
  return [0, 1, 2].map((m) => {
    const sum = (s) => g.mines[m][s].reduce((a, u) => a + (u && u.type === 'c' ? u.atk : 0), 0);
    const p = sum('p'), e = sum('e');
    return { c: p > e ? 'p' : e > p ? 'e' : null, p, e };
  });
}
export function income(g, s) {
  const ctl = control(g);
  let n = 2;
  ctl.forEach((x, m) => {
    if (x.c === s) {
      n += 1;
      n += g.mines[m][s].filter((u) => u && u.type === 'c' && u.kw.includes('prospector')).length;
    }
  });
  return n;
}
const hasBuilder = (g, s) => allUnits(g, s).some((u) => u.type === 'c' && u.card.role === 'Builder');
export function cost(g, s, id) {
  const c = BY_ID[id];
  return c.type === 'w' && hasBuilder(g, s) ? Math.max(1, c.cost - 1) : c.cost;
}
export const canAct = (u) => u.type === 'c' && !u.acted && !u.fresh;

function mkUnit(c, s) {
  return { uid: UID++, id: c.id, card: c, type: c.type, owner: s, atk: c.atk, hp: c.hp, max: c.hp, kw: c.kw.slice(), shield: c.kw.includes('shield'), acted: false, fresh: c.type === 'c' && !c.kw.includes('charge'), frozen: false, loc: null };
}
function place(g, u, s, loc) {
  u.loc = loc; u.owner = s;
  if (loc.k === 'S') g.mines[loc.m][s][loc.i] = u; else g.pass[loc.i][s] = u;
}
function lift(g, u) {
  if (u.loc.k === 'S') g.mines[u.loc.m][u.owner][u.loc.i] = null; else g.pass[u.loc.i][u.owner] = null;
}

function checkWin(g) {
  if (g.over) return;
  const pd = g.side.p.health <= 0, ed = g.side.e.health <= 0;
  if (pd || ed) g.over = { winner: ed && (!pd || g.current === 'p') ? 'p' : 'e', reason: 'stronghold' };
}
function hit(g, s, n) {
  g.side[s].health -= n;
  ev(g, { t: 'dmg', key: 'H:' + s, n });
  ev(g, { t: 'sfx', n: 'hit' });
  checkWin(g);
}
function heal(g, s, n) {
  const sd = g.side[s];
  const h = Math.min(25, sd.health + n) - sd.health;
  if (h > 0) { sd.health += h; ev(g, { t: 'heal', key: 'H:' + s, n: h }); }
}
function dealDamage(g, u, n, src) {
  if (n <= 0) return 0;
  if (u.shield) { u.shield = false; ev(g, { t: 'shield', key: keyOf(u) }); return 0; }
  u.hp -= n;
  ev(g, { t: 'dmg', key: keyOf(u), n });
  ev(g, { t: 'sfx', n: 'hit' });
  if (src && src.kw.includes('poison') && u.type === 'c' && u.hp > 0) u.hp = 0;
  return n;
}
function reap(g) {
  for (const s of ['p', 'e']) {
    for (const u of allUnits(g, s)) {
      if (u.hp <= 0) {
        ev(g, { t: 'die', key: keyOf(u), structure: u.type === 'w' });
        ev(g, { t: 'sfx', n: u.type === 'w' ? 'crumble' : 'die' });
        lift(g, u);
        g.side[s].discard.push(u.id);
      }
    }
  }
}
function draw(g, s) {
  const sd = g.side[s];
  if (!sd.deck.length) { hit(g, s, 2); return; }
  const id = sd.deck.pop();
  if (sd.hand.length >= 10) sd.discard.push(id); else sd.hand.push(id);
}

export function startTurn(g, s) {
  const ctl = control(g);
  g.banner = null;
  if (ctl.every((x) => x.c === s)) {
    if (g.dom[s]) { g.over = { winner: s, reason: 'domination' }; return; }
    g.dom[s] = true;
    g.banner = (s === 'p' ? '' : 'Enemy ') + 'Domination 1/2';
  } else g.dom[s] = false;
  const o = other(s);
  for (const u of allUnits(g, s)) { u.acted = u.frozen; u.frozen = false; u.fresh = false; }
  for (const u of allUnits(g, s)) {
    if (u.type !== 'c' || u.loc.k !== 'S') continue;
    if (u.kw.includes('repair')) {
      for (const w of g.mines[u.loc.m][s]) if (w && w.type === 'w' && w.hp < w.max) {
        const h = Math.min(2, w.max - w.hp); w.hp += h; ev(g, { t: 'heal', key: keyOf(w), n: h });
      }
    }
  }
  for (const u of allUnits(g, s)) {
    if (u.type === 'w' && u.kw.includes('watchtower') && u.loc.k === 'S') {
      const t = g.mines[u.loc.m][o].filter((x) => x && x.type === 'c');
      if (t.length) dealDamage(g, t[rnd(t.length)], 1, u);
    }
  }
  reap(g);
  if (!(s === 'p' && g.first)) draw(g, s);
  g.first = false;
  checkWin(g);
  if (g.over) return;
  const sd = g.side[s];
  let inc = income(g, s);
  if (s === 'e' && g.diff === 'Hard' && !g.hardBonus) { inc += 1; g.hardBonus = true; }
  const before = sd.ore;
  sd.ore = Math.min(15, sd.ore + inc);
  ev(g, { t: 'coins', s, n: sd.ore - before });
}

/* ---------- legal action enumeration ---------- */
function spellTargets(g, s, c) {
  const o = other(s);
  const k = c.fx.k;
  const enemies = allUnits(g, o), mine = allUnits(g, s);
  if (['dmg'].includes(k)) return enemies.map(keyOf);
  if (['freeze', 'bounce', 'drain', 'destroy'].includes(k)) return enemies.filter((u) => u.type === 'c').map(keyOf);
  if (k === 'cull') return enemies.filter((u) => u.type === 'c' && u.hp < u.max).map(keyOf);
  if (k === 'buff') return mine.filter((u) => u.type === 'c').map(keyOf);
  return [null];
}
export function isGlobalSpell(c) {
  return c.type === 's' && ['face', 'dmgAll', 'heal', 'freezeAll', 'draw', 'shieldAll'].includes(c.fx.k);
}
export function playActions(g, s) {
  const out = [];
  const sd = g.side[s];
  sd.hand.forEach((id, idx) => {
    const c = BY_ID[id];
    if (cost(g, s, id) > sd.ore) return;
    if (c.type === 's') { spellTargets(g, s, c).forEach((t) => out.push({ t: 'play', idx, tgt: t })); return; }
    for (let m = 0; m < 3; m++) for (let i = 0; i < 3; i++) if (!g.mines[m][s][i]) out.push({ t: 'play', idx, tgt: slotKey(s, m, i) });
    if (c.type === 'w') for (let i = 0; i < 2; i++) if (!g.pass[i][s]) out.push({ t: 'play', idx, tgt: passKey(s, i) });
  });
  return out;
}
export function unitActions(g, s, u) {
  const acts = [];
  if (!canAct(u) || u.loc.k !== 'S') return acts;
  const m = u.loc.m, o = other(s);
  const es = g.mines[m][o].filter(Boolean);
  const structs = es.filter((x) => x.type === 'w');
  const guards = es.filter((x) => x.type === 'c' && x.kw.includes('guardian'));
  const crs = es.filter((x) => x.type === 'c');
  const targets = structs.length ? structs : guards.length ? guards : crs;
  if (u.atk > 0) {
    targets.forEach((t) => acts.push({ t: 'attack', uid: u.uid, tgt: keyOf(t) }));
    [m - 1, m].forEach((p) => { if (p >= 0 && p <= 1 && g.pass[p][o]) acts.push({ t: 'attack', uid: u.uid, tgt: keyOf(g.pass[p][o]) }); });
    if (!crs.length && !structs.length) acts.push({ t: 'stronghold', uid: u.uid, tgt: 'H:' + o });
  }
  const free = (m2) => g.mines[m2][s].map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
  [-1, 1].forEach((d) => {
    const m2 = m + d;
    if (m2 < 0 || m2 > 2) return;
    const p = Math.min(m, m2);
    if (!u.kw.includes('flying')) {
      if (g.pass[p][o]) return;
      if (g.pass[p][s] && !g.pass[p][s].kw.includes('gate')) return;
    }
    free(m2).forEach((i) => acts.push({ t: 'move', uid: u.uid, tgt: slotKey(s, m2, i) }));
  });
  if (u.kw.includes('shove')) {
    crs.forEach((t) => {
      acts.push({ t: 'shove', uid: u.uid, tgt: keyOf(t), mode: 'hand' });
      [-1, 1].forEach((d) => {
        const m2 = m + d;
        if (m2 < 0 || m2 > 2 || g.pass[Math.min(m, m2)][s]) return;
        g.mines[m2][o].forEach((x, i) => { if (!x) acts.push({ t: 'shove', uid: u.uid, tgt: keyOf(t), mode: 'move', dest: slotKey(o, m2, i) }); });
      });
    });
  }
  return acts;
}
export function allUnitActions(g, s) {
  return allUnits(g, s).flatMap((u) => unitActions(g, s, u));
}
const byUid = (g, uid) => [...allUnits(g, 'p'), ...allUnits(g, 'e')].find((u) => u.uid === uid);

/* ---------- applying ---------- */
function castSpell(g, s, c, tgt) {
  const o = other(s), fx = c.fx, t = tgt ? unitAt(g, tgt) : null;
  ev(g, { t: 'sfx', n: 'spell' });
  switch (fx.k) {
    case 'dmg': dealDamage(g, t, fx.n); break;
    case 'face': hit(g, o, fx.n); break;
    case 'dmgAll': allUnits(g, o).filter((u) => u.type === 'c').forEach((u) => dealDamage(g, u, fx.n)); break;
    case 'heal': heal(g, s, fx.n); break;
    case 'freeze': t.frozen = true; ev(g, { t: 'freeze', key: tgt }); break;
    case 'freezeAll': allUnits(g, o).filter((u) => u.type === 'c').forEach((u) => { u.frozen = true; }); break;
    case 'buff': t.atk += fx.n; t.hp += fx.n; t.max += fx.n; ev(g, { t: 'heal', key: tgt, n: fx.n }); break;
    case 'draw': for (let i = 0; i < fx.n; i++) draw(g, s); break;
    case 'bounce': lift(g, t); { const sd = g.side[o]; if (sd.hand.length < 10) sd.hand.push(t.id); else sd.discard.push(t.id); } break;
    case 'cull': case 'destroy': ev(g, { t: 'dmg', key: tgt, n: t.hp }); t.hp = 0; break;
    case 'drain': if (dealDamage(g, t, fx.n)) heal(g, s, fx.n); break;
    case 'shieldAll': allUnits(g, s).filter((u) => u.type === 'c').forEach((u) => { u.shield = true; }); break;
  }
}
export function playCard(g, s, idx, tgt) {
  const sd = g.side[s], id = sd.hand[idx], c = BY_ID[id];
  sd.ore -= cost(g, s, id);
  sd.hand.splice(idx, 1);
  if (c.type === 's') {
    castSpell(g, s, c, tgt);
    sd.discard.push(id);
  } else {
    const p = parse(tgt);
    const u = mkUnit(c, s);
    place(g, u, s, p.k === 'S' ? { k: 'S', m: p.m, i: p.i } : { k: 'P', i: p.i });
    ev(g, { t: 'build', key: tgt });
    ev(g, { t: 'sfx', n: c.type === 'w' ? 'build' : 'play' });
    if (u.kw.includes('fortify') && p.k === 'S') {
      for (const x of g.mines[p.m][s]) if (x && x !== u) { x.hp += 2; x.max += 2; ev(g, { t: 'heal', key: keyOf(x), n: 2 }); }
    }
  }
  reap(g);
  checkWin(g);
}
export function applyAction(g, s, a) {
  if (a.t === 'play') return playCard(g, s, a.idx, a.tgt);
  const u = byUid(g, a.uid);
  const o = other(s);
  u.acted = true;
  if (a.t === 'move') {
    const p = parse(a.tgt);
    lift(g, u); place(g, u, s, { k: 'S', m: p.m, i: p.i });
    ev(g, { t: 'sfx', n: 'move' });
  } else if (a.t === 'stronghold') {
    ev(g, { t: 'lunge', key: keyOf(u), toward: o });
    hit(g, o, u.atk);
    if (u.kw.includes('lifesteal')) heal(g, s, u.atk);
  } else if (a.t === 'attack') {
    const t = unitAt(g, a.tgt);
    ev(g, { t: 'lunge', key: keyOf(u), toward: o });
    let n = u.atk;
    if (t.type === 'w' && u.kw.includes('siege')) n *= 2;
    const dealt = dealDamage(g, t, n, u);
    if (dealt && u.kw.includes('lifesteal')) heal(g, s, dealt);
    if (t.type === 'c' && t.atk > 0) {
      const back = dealDamage(g, u, t.atk, t);
      if (back && t.kw.includes('lifesteal')) heal(g, o, back);
    } else if (t.type === 'w' && t.kw.includes('spiked')) dealDamage(g, u, 2, t);
  } else if (a.t === 'shove') {
    const t = unitAt(g, a.tgt);
    ev(g, { t: 'lunge', key: keyOf(u), toward: o });
    lift(g, t);
    if (a.mode === 'hand') {
      const sd = g.side[o];
      if (sd.hand.length < 10) sd.hand.push(t.id); else sd.discard.push(t.id);
    } else {
      const p = parse(a.dest);
      place(g, t, o, { k: 'S', m: p.m, i: p.i });
    }
  }
  reap(g);
  checkWin(g);
}

/* ---------- AI ---------- */
function evalBoard(g, s) {
  const o = other(s);
  const own = g.side[s].health, opp = g.side[o].health;
  let v = (own <= 10 ? 3 : 1.5) * own - 1.5 * opp;
  if (opp <= 0) v += 1000;
  if (own <= 0) v -= 1000;
  for (const u of allUnits(g, 'p').concat(allUnits(g, 'e'))) {
    let val;
    if (u.type === 'c') val = u.atk * 1.6 + u.hp + (u.shield ? 1.5 : 0) + (u.kw.includes('flying') ? 1 : 0) + (u.kw.includes('poison') ? 2 : 0) + (u.kw.includes('prospector') ? 2 : 0);
    else val = u.hp * 0.8 + (u.kw.includes('spiked') ? 1 : 0);
    v += u.owner === s ? val : -val;
  }
  const ctl = control(g);
  const mineCount = ctl.filter((x) => x.c === s).length;
  const w = g.diff === 'Hard' && mineCount >= 2 ? 9 : 4;
  ctl.forEach((x) => { if (x.c === s) v += w; else if (x.c === o) v -= 4; });
  v += income(g, s) * 1.5 - income(g, o) * 1.5;
  v += g.side[s].hand.length * 1.2 - g.side[o].hand.length * 1.2;
  v -= g.side[s].ore * 0.25;
  return v;
}
function heuristicBonus(g, s, a) {
  const o = other(s);
  let b = 0;
  if (a.t === 'play') {
    const c = BY_ID[g.side[s].hand[a.idx]];
    if (c.type === 's') return 0;
    const p = parse(a.tgt);
    const m = p.k === 'S' ? p.m : -1;
    if (m >= 0) {
      const enemyAtk = g.mines[m][o].reduce((x, u) => x + (u && u.type === 'c' ? u.atk : 0), 0);
      if (c.type === 'w') b += Math.min(4, enemyAtk);
      if (c.role === 'Miner') b += control(g)[m].c === s ? 3 : 0;
      if (c.role === 'Siege' && g.mines[m][o].some((u) => u && u.type === 'w')) b += 3;
      if (c.type === 'c' && control(g)[m].c !== s) b += 1.5;
    } else if (c.type === 'w') {
      const pushing = g.mines.some((mm, mi) => mm[o].some((u) => u && u.type === 'c' && u.atk >= 3 && Math.abs(mi - p.i) <= 1));
      b += pushing ? 2 : 0;
    }
  }
  if (a.t === 'stronghold') b += 3;
  return b;
}
export function chooseAction(g, s, diff) {
  const acts = playActions(g, s).concat(allUnitActions(g, s));
  if (!acts.length) return null;
  if (diff === 'Easy') {
    if (Math.random() < 0.2) return null;
    if (Math.random() < 0.5) return acts[rnd(acts.length)];
  }
  const base = evalBoard(g, s);
  let best = null, bs = -Infinity;
  for (const a of acts) {
    const sim = structuredClone(g);
    sim.events = [];
    applyAction(sim, s, a);
    let sc = evalBoard(sim, s) - base + heuristicBonus(g, s, a);
    if (diff === 'Normal') sc += Math.random() * 1.5;
    if (diff === 'Easy') sc += Math.random() * 3;
    if (sc > bs) { bs = sc; best = a; }
  }
  return bs > (diff === 'Hard' ? 0.2 : 0.5) ? best : null;
}

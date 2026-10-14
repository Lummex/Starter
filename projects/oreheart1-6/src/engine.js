// Oreheart rules engine. All game logic lives here (the UI and the AI both use these functions).
import { cardById, hasAbility } from './cards.js';

export const MODES = {
  quick: { hearts: 5, siteAmount: 15, kingdomTarget: 10 },
  standard: { hearts: 10, siteAmount: 30, kingdomTarget: 15 },
  epic: { hearts: 15, siteAmount: 50, kingdomTarget: 20 },
};
export const goldReward = (difficulty, won) => {
  const w = { easy: 10, normal: 20, hard: 35 }[difficulty] ?? 10;
  return won ? w : Math.floor(w / 2);
};

const BEATS = { ironclad: 'wildwood', wildwood: 'shimmerfolk', shimmerfolk: 'ironclad' };
export const advantage = (a, d) => (BEATS[a] && BEATS[a] === d ? 1 : 0);

export function resolveAttack({ attacker, defender, defenderStrikesBack, gangUp = 0 }) {
  const attackValue = attacker.attack + advantage(attacker.faction, defender.faction) + (gangUp || 0);
  const defenderKnockedOut = attackValue >= defender.defense;
  const strike = defender.attack + advantage(defender.faction, attacker.faction);
  const attackerKnockedOut = !!defenderStrikesBack && strike >= attacker.defense;
  return { attackValue, defenderKnockedOut, attackerKnockedOut };
}

export const SITES = {
  forest: { r: 4, c: 2, name: 'Forest', icon: '🌲', res: 'wood' },
  crystal: { r: 4, c: 4, name: 'Crystal Mine', icon: '💎', res: 'crystal' },
  iron: { r: 4, c: 6, name: 'Iron Mine', icon: '⛏️', res: 'iron' },
};
export const RES_ICON = { wood: '🌲', crystal: '💎', iron: '⛏️' };
export const STRONG = { you: { r: 7, c: 4 }, enemy: { r: 1, c: 4 } };
export const TIERS = ['wooden-palisade', 'iron-palisade', 'crystal-palisade', 'golden-palisade'];
export const TIER_DEF = [2, 3, 4, 5];
export const TIER_COST = [{ wood: 2 }, { iron: 2 }, { crystal: 2 }, { wood: 1, crystal: 1, iron: 1 }];
export const TIER_NAME = ['Wooden Palisade', 'Iron Palisade', 'Crystal Palisade', 'Golden Palisade'];
export const FORGE = {
  'iron-armor': { name: 'Iron Armor', cost: { iron: 2 } },
  'iron-weapon': { name: 'Iron Weapon', cost: { iron: 2 } },
  'crystal-charm': { name: 'Crystal Charm', cost: { crystal: 2 } },
  'wooden-boots': { name: 'Wooden Boots', cost: { wood: 2 } },
};
const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
export const other = (w) => (w === 'you' ? 'enemy' : 'you');
const inb = (r, c) => r >= 1 && r <= 7 && c >= 1 && c <= 7;
const key = (r, c) => `${r}-${c}`;

// ---------- fx queue (animations; consumed by the UI) ----------
export const fx = [];
const pushFx = (e) => { if (fx.length < 60) fx.push(e); };

// ---------- random ----------
export function rand(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randInt = (s, n) => Math.floor(rand(s) * n);
export function shuffle(s, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- resources ----------
export const canAfford = (res, cost) =>
  (cost.wood || 0) <= res.wood && (cost.crystal || 0) <= res.crystal && (cost.iron || 0) <= res.iron;
const pay = (res, cost) => {
  res.wood -= cost.wood || 0; res.crystal -= cost.crystal || 0; res.iron -= cost.iron || 0;
};

// ---------- match setup ----------
export function newMatch({ deck, enemyDeck, mode = 'quick', difficulty = 'easy', params = {}, seed = 1, tutorial = false }) {
  const m = MODES[mode];
  const s = {
    v: 1, mode, difficulty, tutorial, rng: seed | 0, nextId: 1,
    kingdomTarget: m.kingdomTarget,
    hearts: { you: m.hearts, enemy: m.hearts },
    maxHearts: m.hearts,
    sites: { forest: m.siteAmount, crystal: m.siteAmount, iron: m.siteAmount },
    res: { you: { wood: 2, crystal: 2, iron: 2 }, enemy: { wood: 2, crystal: 2, iron: 2 } },
    hands: { you: [], enemy: [] }, decks: { you: [], enemy: [] }, discard: { you: [], enemy: [] },
    units: [], turn: null, turnNo: 0, phase: 'mulligan', first: 'you', result: null, undo: [],
    aiOff: params.ai === 'off', msg: '', mulliganDone: false,
  };
  if (params.res) {
    for (const w of ['you', 'enemy']) s.res[w] = { wood: params.res[0], crystal: params.res[1], iron: params.res[2] };
  }
  s.first = params.first === 'you' || params.first === 'enemy' ? params.first : rand(s) < 0.5 ? 'you' : 'enemy';
  s.res[other(s.first)].crystal += 1;
  s.decks.you = shuffle(s, [...deck]);
  s.decks.enemy = shuffle(s, [...enemyDeck]);
  // opening hand for you
  if (params.hand && params.hand.length) {
    for (const id of params.hand) {
      if (!cardById[id]) continue;
      const i = s.decks.you.indexOf(id);
      if (i >= 0) s.decks.you.splice(i, 1);
      s.hands.you.push(id);
    }
  }
  while (s.hands.you.length < 4 && s.decks.you.length) s.hands.you.push(s.decks.you.shift());
  for (let i = 0; i < 4; i++) s.hands.enemy.push(s.decks.enemy.shift());
  // silent AI mulligan: swap out expensive cards
  const keep = [], back = [];
  for (const id of s.hands.enemy) {
    const c = cardById[id];
    (c.cost.wood + c.cost.crystal + c.cost.iron >= 4 ? back : keep).push(id);
  }
  if (back.length) {
    s.decks.enemy.push(...back);
    shuffle(s, s.decks.enemy);
    s.hands.enemy = keep;
    while (s.hands.enemy.length < 4) s.hands.enemy.push(s.decks.enemy.shift());
  }
  return s;
}

export function finishMulligan(s, selected = []) {
  if (s.mulliganDone) return;
  s.mulliganDone = true;
  const idx = [...new Set(selected)].filter((i) => i >= 0 && i < s.hands.you.length).sort((a, b) => b - a);
  if (idx.length) {
    const back = idx.map((i) => s.hands.you.splice(i, 1)[0]);
    s.decks.you.push(...back);
    shuffle(s, s.decks.you);
    for (let i = 0; i < back.length && s.decks.you.length; i++) s.hands.you.push(s.decks.you.shift());
  }
  s.phase = 'play';
  startTurn(s, s.first);
}

export function startTurn(s, who) {
  s.turn = who;
  s.turnNo++;
  s.undo = [];
  s.msg = '';
  if (s.hands[who].length < 8 && s.decks[who].length) s.hands[who].push(s.decks[who].shift());
  const r = s.res[who];
  r.wood++; r.crystal++; r.iron++;
  for (const u of s.units) {
    if (u.owner !== who) continue;
    if (u.frozen) { u.acted = true; u.frozen = false; } else u.acted = false;
  }
  if (r.wood >= s.kingdomTarget && r.crystal >= s.kingdomTarget && r.iron >= s.kingdomTarget) {
    finish(s, who, 'Kingdom victory');
  }
}

export function finish(s, winner, reason) {
  if (s.phase === 'over') return;
  s.phase = 'over';
  s.result = { winner, reason };
}

export function endTurn(s) {
  if (s.phase !== 'play') return false;
  startTurn(s, other(s.turn));
  return true;
}

function checkSitesEmpty(s) {
  if (s.phase !== 'play') return;
  if (s.sites.forest || s.sites.crystal || s.sites.iron) return;
  const h = s.hearts;
  if (h.you !== h.enemy) return finish(s, h.you > h.enemy ? 'you' : 'enemy', 'All sites empty');
  const tot = (w) => s.res[w].wood + s.res[w].crystal + s.res[w].iron;
  if (tot('you') !== tot('enemy')) return finish(s, tot('you') > tot('enemy') ? 'you' : 'enemy', 'All sites empty');
  finish(s, 'draw', 'All sites empty');
}

// ---------- undo ----------
function snap(s) {
  if (s.turn !== 'you') return;
  const { undo, ...rest } = s;
  s.undo.push(JSON.stringify(rest));
  if (s.undo.length > 60) s.undo.shift();
}
export const canUndo = (s) => s.phase === 'play' && s.turn === 'you' && s.undo.length > 0;
export function undo(s) {
  if (!canUndo(s)) return false;
  const prev = JSON.parse(s.undo.pop());
  const stack = s.undo;
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, prev, { undo: stack });
  return true;
}

// ---------- board helpers ----------
export const unitAt = (s, r, c) => s.units.find((u) => u.r === r && u.c === c);
export const unitById = (s, id) => s.units.find((u) => u.id === id);
export const isSiteTile = (r, c) => Object.values(SITES).some((x) => x.r === r && x.c === c);
export const strongholdAt = (r, c) => (STRONG.you.r === r && STRONG.you.c === c ? 'you' : STRONG.enemy.r === r && STRONG.enemy.c === c ? 'enemy' : null);
export const isFree = (s, r, c) => inb(r, c) && !unitAt(s, r, c) && !isSiteTile(r, c) && !strongholdAt(r, c);
export const isHome = (who, r) => (who === 'you' ? r >= 6 : r <= 2);
export function gatherSources(r, c) {
  if (r < 3 || r > 5 || isSiteTile(r, c)) return [];
  return Object.entries(SITES).filter(([, x]) => Math.abs(x.c - c) <= 1).map(([k]) => k);
}
export const isShared = (r, c) => gatherSources(r, c).length > 1;
export const cardOf = (u) => cardById[u.card];
const isCreature = (u) => u.kind === 'creature';
export const factionOf = (u) => (isCreature(u) ? cardOf(u).faction : 'none');

function neighbors8(r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) out.push([r + dr, c + dc]);
  return out;
}

export function effAtk(s, u) {
  let a = u.atk;
  if (isCreature(u)) {
    for (const [r, c] of neighbors8(u.r, u.c)) {
      const n = unitAt(s, r, c);
      if (n && n !== u && n.owner === u.owner && n.card === 'sir-rivetbeard') a += 1;
    }
  }
  return a;
}
export function effDef(s, u) {
  let d = u.def;
  if (u.kind === 'palisade') {
    for (const [r, c] of neighbors8(u.r, u.c)) {
      const n = unitAt(s, r, c);
      if (n && n.owner === u.owner && n.card === 'old-oakheart') d += 1;
    }
  }
  return d;
}

export function arrowsOf(u) {
  if (u.kind === 'ballista') return ['FF'];
  if (u.kind === 'palisade') return [];
  return [...cardOf(u).arrows, ...(u.extra || [])];
}
export function arrowVec(letter, dir) {
  const f = DIRS[dir];
  const rt = [f[1], -f[0]];
  let dr = 0, dc = 0;
  for (const ch of letter) {
    if (ch === 'F') { dr += f[0]; dc += f[1]; }
    else if (ch === 'B') { dr -= f[0]; dc -= f[1]; }
    else if (ch === 'R') { dr += rt[0]; dc += rt[1]; }
    else if (ch === 'L') { dr -= rt[0]; dc -= rt[1]; }
  }
  return [dr, dc];
}
const isRanged = (a) => a.length === 2 && a[0] === a[1];

// targets an arrow reaches from unit u (ignores whether it has acted)
function reach(s, u) {
  const out = new Map();
  const add = (r, c, t) => { out.set(key(r, c), t); };
  for (const a of arrowsOf(u)) {
    if (isRanged(a)) {
      const [dr, dc] = arrowVec(a[0], u.dir);
      for (let k = 1; k <= 3; k++) {
        const r = u.r + dr * k, c = u.c + dc * k;
        if (!inb(r, c)) break;
        const occ = unitAt(s, r, c);
        const sh = strongholdAt(r, c);
        if (occ) { if (occ.owner !== u.owner) add(r, c, { r, c, kind: 'unit', unit: occ }); break; }
        if (sh) { if (sh !== u.owner) add(r, c, { r, c, kind: 'stronghold', owner: sh }); break; }
      }
    } else {
      const [dr, dc] = arrowVec(a, u.dir);
      const r = u.r + dr, c = u.c + dc;
      if (!inb(r, c)) continue;
      const occ = unitAt(s, r, c);
      const sh = strongholdAt(r, c);
      if (occ && occ.owner !== u.owner) add(r, c, { r, c, kind: 'unit', unit: occ });
      else if (sh && sh !== u.owner) add(r, c, { r, c, kind: 'stronghold', owner: sh });
    }
  }
  return [...out.values()];
}
function validTargets(s, u) {
  return reach(s, u).filter((t) => {
    if (u.kind === 'ballista') return t.kind === 'unit' && t.unit.kind !== 'creature';
    if (t.kind === 'unit' && t.unit.kind === 'palisade' && t.unit.tier === 3) return false; // golden: ballistas only
    return true;
  });
}
export const canAct = (s, u) => s.phase === 'play' && u.owner === s.turn && !u.acted && u.kind !== 'palisade';
export const legalAttacks = (s, u) => (canAct(s, u) ? validTargets(s, u) : []);

function gangCount(s, attacker, r, c) {
  let n = 0;
  for (const v of s.units) {
    if (v === attacker || v.owner !== attacker.owner || v.kind === 'palisade') continue;
    if (validTargets(s, v).some((t) => t.r === r && t.c === c)) n++;
  }
  return n;
}

const statsOf = (s, u) => ({ attack: effAtk(s, u), defense: effDef(s, u), faction: factionOf(u) });

export function attackPreview(s, u, t) {
  if (t.kind === 'stronghold') return { hearts: effAtk(s, u) + gangCount(s, u, t.r, t.c) };
  const d = t.unit;
  const gang = gangCount(s, u, t.r, t.c);
  const strikes = d.kind !== 'palisade' && validTargets(s, d).some((x) => x.r === u.r && x.c === u.c);
  return { ...resolveAttack({ attacker: statsOf(s, u), defender: statsOf(s, d), defenderStrikesBack: strikes, gangUp: gang }), strikes };
}

function removeUnit(s, u, silent) {
  const i = s.units.indexOf(u);
  if (i >= 0) s.units.splice(i, 1);
  if (u.kind === 'creature') s.discard[u.owner].push(u.card);
  if (!silent) pushFx({ type: u.kind === 'palisade' ? 'crumble' : 'poof', r: u.r, c: u.c });
}

export function attack(s, uid, r, c) {
  const u = unitById(s, uid);
  if (!u || !canAct(s, u)) return false;
  const t = validTargets(s, u).find((x) => x.r === r && x.c === c);
  if (!t) return false;
  snap(s);
  if (t.kind === 'stronghold') {
    const dmg = effAtk(s, u) + gangCount(s, u, r, c);
    s.hearts[t.owner] = Math.max(0, s.hearts[t.owner] - dmg);
    u.acted = true;
    pushFx({ type: 'lunge', id: u.id, r: u.r, c: u.c, tr: r, tc: c });
    pushFx({ type: 'hit', r, c });
    if (s.hearts[t.owner] <= 0) finish(s, u.owner, 'Stronghold destroyed');
    return true;
  }
  const d = t.unit;
  const pv = attackPreview(s, u, t);
  u.acted = true;
  pushFx({ type: 'lunge', id: u.id, r: u.r, c: u.c, tr: r, tc: c });
  if (pv.defenderKnockedOut) removeUnit(s, d);
  else pushFx({ type: 'shake', r, c });
  if (pv.attackerKnockedOut) removeUnit(s, u);
  return true;
}

// ---------- movement ----------
export function moveTiles(s, u) {
  if (!canAct(s, u) || u.kind !== 'creature') return [];
  const card = cardOf(u);
  const swift = hasAbility(card, 'Swift'), flying = hasAbility(card, 'Flying'), leap = hasAbility(card, 'Leap');
  const swap = hasAbility(card, 'Swap'), tele = hasAbility(card, 'Teleport');
  const steps = (swift ? 2 : 1) + (u.boots || 0);
  const res = new Map();
  const seen = new Set([key(u.r, u.c)]);
  const queue = [{ r: u.r, c: u.c, d: 0 }];
  while (queue.length) {
    const { r, c, d } = queue.shift();
    if (d >= steps) continue;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!inb(nr, nc) || seen.has(key(nr, nc))) continue;
      const occ = unitAt(s, nr, nc);
      if (!occ) {
        if (isSiteTile(nr, nc) || strongholdAt(nr, nc)) continue;
        seen.add(key(nr, nc));
        res.set(key(nr, nc), { r: nr, c: nc });
        queue.push({ r: nr, c: nc, d: d + 1 });
      } else {
        if (swap && d === 0 && occ.kind === 'creature') res.set(key(nr, nc), { r: nr, c: nc, swap: occ.id });
        if (flying && occ.kind === 'palisade' && occ.tier < 2) { seen.add(key(nr, nc)); queue.push({ r: nr, c: nc, d: d + 1 }); }
        if (leap && (occ.kind === 'creature' || occ.kind === 'palisade')) {
          const lr = nr + dr, lc = nc + dc;
          if (isFree(s, lr, lc)) res.set(key(lr, lc), { r: lr, c: lc });
        }
      }
    }
  }
  if (tele) {
    for (let r = 3; r <= 5; r++) for (let c = 1; c <= 7; c++) if (isFree(s, r, c)) res.set(key(r, c), { r, c });
  }
  res.delete(key(u.r, u.c));
  return [...res.values()];
}
export function move(s, uid, r, c) {
  const u = unitById(s, uid);
  if (!u) return false;
  const t = moveTiles(s, u).find((x) => x.r === r && x.c === c);
  if (!t) return false;
  snap(s);
  if (t.swap) {
    const o = unitById(s, t.swap);
    o.r = u.r; o.c = u.c;
  }
  u.r = r; u.c = c;
  u.acted = true;
  return true;
}

// ---------- gather ----------
export const isWorker = (u) => isCreature(u) && hasAbility(cardOf(u), 'Worker');
export function gatherOptions(s, u) {
  if (!canAct(s, u) || u.kind !== 'creature') return [];
  return gatherSources(u.r, u.c).filter((k) => s.sites[k] > 0);
}
export function gather(s, uid, site) {
  const u = unitById(s, uid);
  if (!u || !gatherOptions(s, u).includes(site)) return false;
  snap(s);
  const amt = Math.min(isWorker(u) ? 2 : 1, s.sites[site]);
  s.sites[site] -= amt;
  s.res[u.owner][SITES[site].res] += amt;
  u.acted = true;
  pushFx({ type: 'gather', r: u.r, c: u.c, text: `+${amt} ${SITES[site].icon}` });
  checkSitesEmpty(s);
  return true;
}

// ---------- turn ----------
export function turnUnit(s, uid, side) {
  const u = unitById(s, uid);
  if (!u || !canAct(s, u) || (side !== 'left' && side !== 'right')) return false;
  snap(s);
  u.dir = (u.dir + (side === 'right' ? 1 : 3)) % 4;
  u.acted = true;
  return true;
}

// ---------- build ----------
export const isBuilder = (u) => isCreature(u) && hasAbility(cardOf(u), 'Builder');
export function buildCost(u, kind) {
  const base = kind === 'ballista' ? 3 : 2;
  return { wood: Math.max(0, base - (isBuilder(u) ? 1 : 0)) };
}
export function canBuildKind(s, u, kind) {
  return u.kind === 'creature' && canAct(s, u) && canAfford(s.res[u.owner], buildCost(u, kind)) && buildTiles(s, u).length > 0;
}
export function buildTiles(s, u) {
  if (u.kind !== 'creature') return [];
  return neighbors8(u.r, u.c).filter(([r, c]) => isFree(s, r, c)).map(([r, c]) => ({ r, c }));
}
export function build(s, uid, kind, r, c) {
  const u = unitById(s, uid);
  if (!u || !canBuildKind(s, u, kind) || !buildTiles(s, u).some((t) => t.r === r && t.c === c)) return false;
  snap(s);
  pay(s.res[u.owner], buildCost(u, kind));
  if (kind === 'ballista') s.units.push(makeUnit(s, u.owner, 'ballista', r, c, u.dir));
  else s.units.push(makeUnit(s, u.owner, 'wooden-palisade', r, c, 0));
  u.acted = true;
  pushFx({ type: 'build', r, c });
  return true;
}
function makeUnit(s, owner, cardId, r, c, dir) {
  const base = { id: s.nextId++, owner, card: cardId, r, c, dir, ups: [], extra: [], boots: 0, frozen: false };
  if (cardId === 'ballista') return { ...base, kind: 'ballista', atk: 3, def: 2, acted: true };
  const tier = TIERS.indexOf(cardId);
  if (tier >= 0) return { ...base, kind: 'palisade', tier, atk: 0, def: TIER_DEF[tier], acted: true };
  const card = cardById[cardId];
  return { ...base, kind: 'creature', atk: card.attack, def: card.defense, acted: !hasAbility(card, 'Charge') };
}

// ---------- upgrades ----------
export function upgradeCost(u, kind) {
  const base = { ...FORGE[kind].cost };
  if (u.card === 'dwarf-smith') for (const k of Object.keys(base)) base[k] = Math.max(0, base[k] - 1);
  return base;
}
export function forgeOptions(s, u) {
  if (!u || u.owner !== s.turn || s.phase !== 'play' || u.kind !== 'creature') return [];
  return Object.keys(FORGE).map((k) => ({
    kind: k, name: FORGE[k].name, cost: upgradeCost(u, k),
    enabled: u.ups.length < 2 && canAfford(s.res[u.owner], upgradeCost(u, k)),
  }));
}
export const charmDirections = (u) => ['F', 'B', 'L', 'R', 'FL', 'FR', 'BL', 'BR'].filter((a) => !arrowsOf(u).includes(a));
export function upgrade(s, uid, kind, dirLetter) {
  const u = unitById(s, uid);
  if (!u || !forgeOptions(s, u).find((o) => o.kind === kind && o.enabled)) return false;
  if (kind === 'crystal-charm' && !charmDirections(u).includes(dirLetter)) return false;
  snap(s);
  pay(s.res[u.owner], upgradeCost(u, kind));
  u.ups.push(kind);
  if (kind === 'iron-armor') u.def += 1;
  else if (kind === 'iron-weapon') u.atk += 1;
  else if (kind === 'wooden-boots') u.boots += 1;
  else u.extra.push(dirLetter);
  return true;
}
export function palisadeUpgrade(s, u) {
  if (!u || u.kind !== 'palisade' || u.owner !== s.turn || s.phase !== 'play' || u.tier >= 3) return null;
  const cost = { wood: 0, crystal: 0, iron: 0, ...TIER_COST[u.tier + 1] };
  return { tier: u.tier + 1, name: TIER_NAME[u.tier + 1], cost, enabled: canAfford(s.res[u.owner], cost) };
}
export function upgradePalisade(s, uid) {
  const u = unitById(s, uid);
  const o = palisadeUpgrade(s, u);
  if (!o || !o.enabled) return false;
  snap(s);
  pay(s.res[u.owner], o.cost);
  u.tier = o.tier; u.card = TIERS[o.tier]; u.def = TIER_DEF[o.tier];
  pushFx({ type: 'build', r: u.r, c: u.c });
  return true;
}
export const canUpgrade = (s, u) =>
  !!u && u.owner === s.turn && s.phase === 'play' &&
  (u.kind === 'creature' ? forgeOptions(s, u).some((o) => o.enabled) : !!(palisadeUpgrade(s, u) || {}).enabled);

// ---------- summon & spells ----------
export function summonTiles(s, who, cardId) {
  const card = cardById[cardId];
  if (!card || card.type !== 'creature') return [];
  const out = [];
  const rows = who === 'you' ? [6, 7] : [1, 2];
  for (const r of rows) for (let c = 1; c <= 7; c++) if (isFree(s, r, c)) out.push({ r, c });
  return out;
}
export const affordable = (s, who, cardId) => canAfford(s.res[who], cardById[cardId].cost);

export function summon(s, who, handIdx, r, c) {
  if (s.phase !== 'play' || s.turn !== who) return false;
  const id = s.hands[who][handIdx];
  if (!id || !affordable(s, who, id)) return false;
  if (!summonTiles(s, who, id).some((t) => t.r === r && t.c === c)) return false;
  snap(s);
  pay(s.res[who], cardById[id].cost);
  s.hands[who].splice(handIdx, 1);
  s.units.push(makeUnit(s, who, id, r, c, who === 'you' ? 0 : 2));
  pushFx({ type: 'pop', r, c });
  return true;
}

const enemyCreatures = (s, who, maxDef) => s.units.filter((u) => u.owner !== who && u.kind === 'creature' && effDef(s, u) <= maxDef);
const ownCreatures = (s, who) => s.units.filter((u) => u.owner === who && u.kind === 'creature');
const freeTiles = (s) => {
  const out = [];
  for (let r = 1; r <= 7; r++) for (let c = 1; c <= 7; c++) if (isFree(s, r, c)) out.push({ r, c });
  return out;
};
const MAXDEF = { zap: 1, rockfall: 2, moonbeam: 3, 'frost-snap': 99 };

// step: 0 = first target; for blink step 1 = destination
export function spellTargets(s, who, cardId, step = 0, first = null) {
  const pt = (u) => ({ r: u.r, c: u.c });
  if (cardId in MAXDEF) return enemyCreatures(s, who, MAXDEF[cardId]).map(pt);
  if (cardId === 'blink') return step === 0 ? ownCreatures(s, who).map(pt) : freeTiles(s);
  if (cardId === 'overgrowth') return freeTiles(s).filter((t) => !first || t.r !== first.r || t.c !== first.c);
  if (cardId === 'wisp-rush') return ownCreatures(s, who).filter((u) => u.acted).map(pt);
  if (cardId === 'sparkle-boost') return ownCreatures(s, who).map(pt);
  return [];
}
export const spellSteps = (cardId) => (cardId === 'blink' || cardId === 'overgrowth' ? 2 : 1);

export function castSpell(s, who, handIdx, targets) {
  if (s.phase !== 'play' || s.turn !== who) return false;
  const id = s.hands[who][handIdx];
  const card = cardById[id];
  if (!card || card.type !== 'spell' || !affordable(s, who, id)) return false;
  const n = spellSteps(id);
  if (!targets || targets.length !== n) return false;
  const ok = targets.every((t, i) => spellTargets(s, who, id, i, targets[0]).some((x) => x.r === t.r && x.c === t.c));
  if (!ok) return false;
  snap(s);
  pay(s.res[who], card.cost);
  s.hands[who].splice(handIdx, 1);
  s.discard[who].push(id);
  const t0 = targets[0];
  const u0 = unitAt(s, t0.r, t0.c);
  if (id in MAXDEF && id !== 'frost-snap') removeUnit(s, u0);
  else if (id === 'frost-snap') { u0.frozen = true; pushFx({ type: 'shake', r: t0.r, c: t0.c }); }
  else if (id === 'blink') { u0.r = targets[1].r; u0.c = targets[1].c; pushFx({ type: 'pop', r: u0.r, c: u0.c }); }
  else if (id === 'wisp-rush') u0.acted = false;
  else if (id === 'sparkle-boost') { u0.atk += 1; u0.def += 1; pushFx({ type: 'pop', r: u0.r, c: u0.c }); }
  else if (id === 'overgrowth') for (const t of targets) { s.units.push(makeUnit(s, who, 'wooden-palisade', t.r, t.c, 0)); pushFx({ type: 'build', r: t.r, c: t.c }); }
  return true;
}

// ---------- surrender ----------
export function surrender(s) {
  finish(s, 'enemy', 'You surrendered');
}

import { cardById, costText } from './cards.js';
import * as E from './engine.js';
import { aiStep, aiBeginTurn, hint } from './ai.js';
import { h, cardFace, arrowGrid } from './ui.js';
import { profile, saveProfile, saveMatch, clearMatch, deckOptions, params, grng, nextSeed } from './store.js';
import { starterDecks } from './cards.js';
import { sfx } from './audio.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const RES_WORD = { wood: 'Wood', crystal: 'Crystal', iron: 'Iron' };
const TIER_ICON = ['🪵', '🧱', '💎', '👑'];
const DIR_NAMES = { F: 'Front', B: 'Back', L: 'Left', R: 'Right', FL: 'Front-Left', FR: 'Front-Right', BL: 'Back-Left', BR: 'Back-Right' };
const costWords = (cost) => costText({ wood: cost.wood || 0, crystal: cost.crystal || 0, iron: cost.iron || 0 });

export function mountMatch(app, nav, arg) {
  let s;
  if (arg.resume) s = arg.resume;
  else {
    const opts = deckOptions();
    const mine = opts.find((o) => o.value === arg.deckKey) || opts[0];
    const keys = Object.keys(starterDecks);
    const ek = keys[Math.floor(E.rand(grng) * keys.length)];
    s = E.newMatch({ deck: mine.ids, enemyDeck: starterDecks[ek], mode: arg.mode, difficulty: arg.difficulty, params, seed: nextSeed(), tutorial: !!arg.tutorial });
  }
  let alive = true;
  let running = false;
  let handled = false;
  const ui = { hand: null, spell: [], unit: null, mode: null, build: null, pop: null, menu: null, mull: new Set(), msg: '' };
  const root = h('div', { class: 'match' });
  app.append(root);
  let handScroll = 0;

  const yourTurn = () => s.phase === 'play' && s.turn === 'you' && !running;
  const resetSel = () => { ui.hand = null; ui.spell = []; ui.unit = null; ui.mode = null; ui.build = null; ui.pop = null; };

  function save() { if (s.phase !== 'over') saveMatch(s); }

  function after() {
    save();
    if (s.phase === 'over') return showResult();
    render();
    applyFx();
    if (s.phase === 'play' && s.turn === 'enemy') runEnemy();
  }

  async function runEnemy() {
    if (running || !alive) return;
    running = true;
    render();
    const quick = reduced();
    await sleep(quick ? 100 : 450);
    aiBeginTurn(s);
    const t0 = Date.now();
    while (alive && s.phase === 'play' && s.turn === 'enemy' && !s.aiOff) {
      if (!aiStep(s)) break;
      save();
      render();
      applyFx();
      await sleep(quick ? 60 : 270);
      if (Date.now() - t0 > 3800) break;
    }
    if (!alive) { running = false; return; }
    if (s.phase === 'play' && s.turn === 'enemy') E.endTurn(s);
    running = false;
    if (s.turn === 'you') ui.msg = '';
    after();
  }

  function showResult() {
    if (handled) return;
    handled = true;
    clearMatch();
    const r = s.result;
    const won = r.winner === 'you';
    const gold = E.goldReward(s.difficulty, won);
    profile.gold += gold;
    saveProfile();
    sfx(won ? 'win' : 'lose');
    alive = false;
    const title = r.winner === 'you' ? 'Victory!' : r.winner === 'enemy' ? 'Defeat' : 'Draw';
    const why = r.winner === 'enemy' && r.reason === 'Kingdom victory' ? 'The enemy built the richest kingdom' : r.winner === 'enemy' && r.reason === 'Stronghold destroyed' ? 'Your Stronghold was destroyed' : r.reason;
    root.replaceChildren(h('main', { class: 'screen result' },
      h('div', { class: 'logo', 'aria-hidden': 'true' }, won ? '🏆' : r.winner === 'draw' ? '🤝' : '💤'),
      h('h1', {}, title),
      h('p', { class: 'why' }, why),
      h('p', { class: 'reward' }, `+${gold} gold`),
      h('p', { class: 'muted' }, `Total: 🪙 ${profile.gold}`),
      h('button', { class: 'btn big accent', type: 'button', onClick: () => nav.go('menu') }, 'Main Menu')));
  }

  // ----- highlights -----
  function highlights() {
    const m = new Map();
    if (!yourTurn()) return m;
    const k = (t) => `${t.r}-${t.c}`;
    if (ui.hand !== null) {
      const id = s.hands.you[ui.hand];
      const card = id && cardById[id];
      if (card && E.affordable(s, 'you', id)) {
        if (card.type === 'creature') E.summonTiles(s, 'you', id).forEach((t) => m.set(k(t), 'summon'));
        else E.spellTargets(s, 'you', id, ui.spell.length, ui.spell[0]).forEach((t) => m.set(k(t), 'target'));
      }
    } else if (ui.unit) {
      const u = E.unitById(s, ui.unit);
      if (u && u.owner === 'you') {
        if (ui.build) E.buildTiles(s, u).forEach((t) => m.set(k(t), 'build'));
        else {
          if (ui.mode !== 'attack') E.moveTiles(s, u).forEach((t) => m.set(k(t), 'move'));
          if (ui.mode !== 'move') E.legalAttacks(s, u).forEach((t) => m.set(k(t), 'attack'));
        }
      }
    }
    return m;
  }

  function say(msg) { ui.msg = msg; render(); }

  function onTile(r, c) {
    if (!yourTurn()) return;
    const hl = highlights().get(`${r}-${c}`);
    if (ui.hand !== null) {
      const id = s.hands.you[ui.hand];
      if (hl === 'summon') {
        if (E.summon(s, 'you', ui.hand, r, c)) { sfx('summon'); resetSel(); ui.msg = ''; after(); }
        return;
      }
      if (hl === 'target') {
        ui.spell.push({ r, c });
        if (ui.spell.length >= E.spellSteps(id)) {
          const ok = E.castSpell(s, 'you', ui.hand, ui.spell);
          if (ok) sfx('hit');
          resetSel(); ui.msg = ''; after();
        } else { ui.msg = id === 'blink' ? 'Now pick an empty tile to teleport to.' : 'Pick one more tile.'; render(); }
        return;
      }
      say(cardById[id].type === 'spell' ? 'Pick a glowing target.' : 'Pick a glowing tile in your home rows.');
      return;
    }
    if (ui.unit && hl) {
      const id = ui.unit;
      let ok = false;
      if (hl === 'move') ok = E.move(s, id, r, c);
      else if (hl === 'attack') { ok = E.attack(s, id, r, c); if (ok) sfx('hit'); }
      else if (hl === 'build') { ok = E.build(s, id, ui.build, r, c); ui.build = null; }
      if (ok) { ui.mode = null; ui.pop = null; ui.msg = ''; after(); }
      return;
    }
    const u = E.unitAt(s, r, c);
    if (u && u.owner === 'you') {
      sfx('tap');
      ui.pop = null; ui.mode = null; ui.build = null;
      ui.unit = ui.unit === u.id ? null : u.id;
      ui.msg = '';
      render();
    } else if (u) {
      const nm = u.kind === 'creature' ? E.cardOf(u).name : u.kind === 'ballista' ? 'Ballista' : E.TIER_NAME[u.tier];
      say(`Enemy ${nm}: ⚔️${E.effAtk(s, u)} 🛡️${E.effDef(s, u)}`);
    } else {
      ui.unit = null; ui.mode = null; ui.build = null; ui.pop = null;
      render();
    }
  }

  function onHand(idx) {
    if (!yourTurn()) return;
    const id = s.hands.you[idx];
    if (!E.affordable(s, 'you', id)) { say('Not enough resources for that card.'); return; }
    if (ui.hand === idx) { resetSel(); ui.msg = ''; render(); return; }
    resetSel();
    ui.hand = idx;
    const card = cardById[id];
    const any = card.type === 'creature' ? E.summonTiles(s, 'you', id).length : E.spellTargets(s, 'you', id, 0).length;
    ui.msg = !any ? 'No legal targets for that card.' : card.type === 'creature' ? 'Tap a glowing tile to summon.' : 'Pick a glowing target.';
    sfx('tap');
    render();
  }

  // ----- popovers -----
  function popover(u) {
    if (!ui.pop || !u) return null;
    const close = btnEl('Cancel', () => { ui.pop = null; render(); }, 'small');
    const wrap = (label, ...kids) => h('div', { class: 'popover', role: 'group', 'aria-label': label }, ...kids, close);
    const act = (fn) => () => { ui.pop = null; if (fn()) { ui.msg = ''; after(); } else render(); };
    if (ui.pop === 'gather') {
      return wrap('Gather', ...E.gatherOptions(s, u).map((k) => btnEl(`Gather ${RES_WORD[E.SITES[k].res]}`, act(() => E.gather(s, u.id, k)))));
    }
    if (ui.pop === 'build') {
      const mk = (kind, label) => {
        const b = btnEl(label, () => { ui.pop = null; ui.build = kind; ui.mode = null; ui.msg = 'Pick a glowing tile to build on.'; render(); });
        b.disabled = !E.canBuildKind(s, u, kind);
        return b;
      };
      return wrap('Build', mk('wooden', 'Wooden Palisade (2 Wood)'), mk('ballista', 'Ballista (3 Wood)'),
        h('small', {}, E.isBuilder(u) ? 'Builders pay 1 Wood less!' : ''));
    }
    if (ui.pop === 'turn') {
      return wrap('Turn', btnEl('Turn Left', act(() => E.turnUnit(s, u.id, 'left'))), btnEl('Turn Right', act(() => E.turnUnit(s, u.id, 'right'))));
    }
    if (ui.pop === 'charm') {
      return wrap('Crystal Charm direction', ...E.charmDirections(u).map((a) => btnEl(`Arrow: ${DIR_NAMES[a]}`, act(() => E.upgrade(s, u.id, 'crystal-charm', a)))));
    }
    if (ui.pop === 'upgrade') {
      if (u.kind === 'palisade') {
        const o = E.palisadeUpgrade(s, u);
        const b = btnEl(`${o.name} (${costWords(o.cost)})`, act(() => E.upgradePalisade(s, u.id)));
        b.disabled = !o.enabled;
        return wrap('Upgrade', b);
      }
      return wrap('Forge', ...E.forgeOptions(s, u).map((o) => {
        const b = btnEl(`${o.name} (${costWords(o.cost)})`, () => {
          if (o.kind === 'crystal-charm') { ui.pop = 'charm'; render(); } else act(() => E.upgrade(s, u.id, o.kind))();
        });
        b.disabled = !o.enabled;
        return b;
      }));
    }
    return null;
  }
  const btnEl = (text, fn, cls = '') => h('button', { class: `btn ${cls}`, type: 'button', onClick: fn }, text);

  // ----- render -----
  function render() {
    if (s.phase === 'over') return;
    const oldHand = root.querySelector('.hand');
    if (oldHand) handScroll = oldHand.scrollLeft;
    const hl = highlights();
    const sel = ui.unit ? E.unitById(s, ui.unit) : null;
    const mine = sel && sel.owner === 'you' && yourTurn() ? sel : null;
    if (ui.unit && !sel) ui.unit = null;

    const banner = s.phase === 'mulligan' ? (s.first === 'you' ? 'Your Turn' : 'Enemy Turn') : s.turn === 'you' ? 'Your Turn' : 'Enemy Turn';
    const rp = (k, icon) => h('span', { class: 'res', 'data-testid': `res-${k}` }, `${icon} ${s.res.you[k]}`);
    const top = h('header', { class: 'topbar' },
      h('div', { class: 'resources', 'aria-label': 'Your resources' }, rp('wood', '🌲'), rp('crystal', '💎'), rp('iron', '⛏️')),
      h('div', { class: `banner ${banner === 'Your Turn' ? 'you' : 'foe'}`, 'data-testid': 'turn-banner' }, banner),
      h('button', { class: 'btn small', type: 'button', onClick: () => { ui.menu = 'main'; render(); } }, 'Menu'));

    // board
    const board = h('div', { class: 'board', role: 'grid', 'aria-label': 'Board' });
    for (let r = 1; r <= 7; r++) {
      const row = h('div', { class: 'brow', role: 'row' });
      for (let c = 1; c <= 7; c++) row.append(tileEl(r, c, hl.get(`${r}-${c}`)));
      board.append(row);
    }

    // action bar
    const can = {
      move: !!mine && E.moveTiles(s, mine).length > 0,
      attack: !!mine && E.legalAttacks(s, mine).length > 0,
      gather: !!mine && E.gatherOptions(s, mine).length > 0,
      build: !!mine && mine.kind === 'creature' && (E.canBuildKind(s, mine, 'wooden') || E.canBuildKind(s, mine, 'ballista')),
      turn: !!mine && E.canAct(s, mine),
      upgrade: !!mine && E.canUpgrade(s, mine),
    };
    const ab = (label, key, fn) => h('button', { class: `btn act${ui.mode === key ? ' on' : ''}`, type: 'button', disabled: !can[key], 'aria-pressed': key === 'move' || key === 'attack' ? String(ui.mode === key) : null, onClick: fn }, label);
    const toggle = (m) => () => { ui.mode = ui.mode === m ? null : m; ui.pop = null; ui.build = null; render(); };
    const open = (p) => () => { ui.pop = p; render(); };
    const actions = h('div', { class: 'actions', role: 'group', 'aria-label': 'Actions' },
      ab('Move', 'move', toggle('move')), ab('Attack', 'attack', toggle('attack')),
      ab('Gather', 'gather', () => {
        const o = E.gatherOptions(s, mine);
        if (o.length === 1) { if (E.gather(s, mine.id, o[0])) { ui.msg = ''; after(); } } else open('gather')();
      }),
      ab('Build', 'build', open('build')), ab('Turn', 'turn', open('turn')), ab('Upgrade', 'upgrade', open('upgrade')));
    const right = h('div', { class: 'right-col' },
      h('button', { class: 'btn big accent end', type: 'button', disabled: !yourTurn() || s.phase !== 'play', onClick: () => { resetSel(); ui.msg = ''; E.endTurn(s); after(); } }, 'End Turn'),
      h('div', { class: 'row tight' },
        h('button', { class: 'btn small', type: 'button', disabled: !yourTurn() || !E.canUndo(s), onClick: () => { E.undo(s); resetSel(); ui.msg = ''; after(); } }, 'Undo'),
        h('button', { class: 'btn small', type: 'button', disabled: !yourTurn(), onClick: () => { ui.msg = hint(s); render(); } }, 'Hint')));

    // hand
    const hand = h('div', { class: 'hand', role: 'group', 'aria-label': 'Your hand' });
    s.hands.you.forEach((id, i) => {
      const card = cardById[id];
      const ok = E.affordable(s, 'you', id);
      const label = card.type === 'spell' ? `${card.name}, spell, cost ${costText(card.cost)}. ${card.ability}` : `${card.name}, cost ${costText(card.cost)}, attack ${card.attack}, defense ${card.defense}`;
      hand.append(h('button', { class: `hand-card${ok ? '' : ' dim'}${ui.hand === i ? ' sel' : ''}`, type: 'button', 'data-testid': 'hand-card', 'data-card': id,
        'aria-pressed': String(ui.hand === i), 'aria-disabled': ok ? null : 'true', 'aria-label': label, onClick: () => onHand(i) }, cardFace(card)));
    });
    const handWrap = h('div', { class: 'hand-wrap' }, hand,
      h('div', { class: 'deck-box', title: 'Cards left in your deck' }, h('span', { 'aria-hidden': 'true' }, '🂠'), h('b', { 'data-testid': 'deck-count' }, String(s.decks.you.length))));

    const kids = [top, board,
      h('div', { class: 'statusbar' }, h('div', { class: 'status', role: 'status', 'data-testid': 'status' }, ui.msg || (yourTurn() ? '' : s.phase === 'play' ? 'The enemy is thinking…' : ''))),
      tip(),
      h('div', { class: 'actionbar' }, actions, right), handWrap, popover(mine)];
    if (s.phase === 'mulligan') kids.push(mulliganDialog());
    else if (ui.menu) kids.push(menuDialog());
    root.replaceChildren(...kids.filter(Boolean));
    const nh = root.querySelector('.hand');
    if (nh) nh.scrollLeft = handScroll;
    const dlg = root.querySelector('[role=dialog] button');
    if (dlg && !root.contains(document.activeElement)) dlg.focus({ preventScroll: true });
  }

  function tip() {
    if (!s.tutorial || s.turnNo > 3 || s.phase !== 'play') return null;
    const mineUnits = s.units.filter((u) => u.owner === 'you');
    let t;
    if (s.turn !== 'you') t = 'The enemy is playing. Watch what they do!';
    else if (!mineUnits.length) t = '👆 Tap a card in your hand, then tap a glowing tile to summon it.';
    else if (mineUnits.some((u) => E.canAct(s, u))) t = '👟 Tap your creature to see where it can move (blue) or attack (red). Gather from the 🌲 Forest to earn Wood!';
    else t = '✅ Nice! Press End Turn when you are done.';
    return h('div', { class: 'tip', role: 'note' }, t);
  }

  function tileEl(r, c, hlType) {
    const u = E.unitAt(s, r, c);
    const site = Object.entries(E.SITES).find(([, x]) => x.r === r && x.c === c);
    const strong = E.strongholdAt(r, c);
    const cls = ['tile'];
    cls.push((r + c) % 2 ? 'alt' : 'base');
    if (r >= 6) cls.push('home-you'); else if (r <= 2) cls.push('home-enemy');
    if (E.isShared(r, c)) cls.push('shared');
    if (site) cls.push('site');
    if (strong) cls.push('stronghold', strong === 'you' ? 's-you' : 's-foe');
    let label = `Row ${r}, column ${c}`;
    const kids = [];
    if (site) {
      const [k, x] = site;
      label = `${x.name}, ${s.sites[k]} remaining`;
      kids.push(h('span', { class: 'site-icon', 'aria-hidden': 'true' }, x.icon), h('span', { class: 'site-name' }, x.name),
        h('b', { class: 'site-amt', 'data-testid': `site-${k}` }, String(s.sites[k])));
    } else if (strong) {
      label = `${strong === 'you' ? 'Your' : 'Enemy'} Stronghold, ${s.hearts[strong]} hearts`;
      kids.push(h('span', { class: 'castle', 'aria-hidden': 'true' }, '🏰'),
        h('span', { class: 'hearts' }, '❤️', h('b', { 'data-testid': `hearts-${strong === 'you' ? 'you' : 'enemy'}` }, String(s.hearts[strong]))));
    } else if (u) kids.push(unitEl(u));
    return h('button', { class: cls.join(' '), type: 'button', role: 'gridcell', 'data-testid': `tile-${r}-${c}`, 'data-highlight': hlType, 'aria-label': label, onClick: () => onTile(r, c) }, ...kids);
  }

  function unitEl(u) {
    const name = u.kind === 'ballista' ? 'Ballista' : u.kind === 'palisade' ? E.TIER_NAME[u.tier] : E.cardOf(u).name;
    const emoji = u.kind === 'ballista' ? '🏹' : u.kind === 'palisade' ? TIER_ICON[u.tier] : E.cardOf(u).emoji;
    const el = h('span', { class: `unit u-${u.owner} k-${u.kind}${u.acted ? ' acted' : ''}${ui.unit === u.id ? ' sel' : ''}${u.frozen ? ' frozen' : ''}`,
      'data-testid': 'unit', 'data-owner': u.owner, 'data-card': u.card, 'data-acted': String(!!u.acted), 'data-dir': String(u.dir), 'data-id': String(u.id),
      role: 'img', 'aria-label': `${name} (${u.owner === 'you' ? 'yours' : 'enemy'})` },
      u.kind === 'palisade' ? null : arrowGrid(E.arrowsOf(u), u.dir, 'arrows u-arrows'),
      h('span', { class: 'u-emoji', 'aria-hidden': 'true' }, emoji),
      u.kind === 'palisade' ? h('span', { class: 'u-def only' }, `🛡️${E.effDef(s, u)}`) : [
        h('span', { class: 'u-atk' }, `⚔️${E.effAtk(s, u)}`), h('span', { class: 'u-def' }, `🛡️${E.effDef(s, u)}`)],
      u.frozen ? h('span', { class: 'u-flag' }, '❄️') : null);
    return el;
  }

  function applyFx() {
    const list = E.fx.splice(0);
    const q = (r, c) => root.querySelector(`[data-testid="tile-${r}-${c}"]`);
    for (const f of list) {
      const t = q(f.r, f.c);
      if (!t) continue;
      const done = (el) => setTimeout(() => el.remove(), 650);
      if (f.type === 'lunge') {
        const un = t.querySelector('.unit');
        if (un) { un.style.setProperty('--dx', `${Math.sign(f.tc - f.c) * 16}px`); un.style.setProperty('--dy', `${Math.sign(f.tr - f.r) * 16}px`); un.classList.add('lunge'); }
      } else if (f.type === 'shake') { const un = t.querySelector('.unit'); if (un) un.classList.add('shake'); }
      else if (f.type === 'poof' || f.type === 'hit') { const p = h('span', { class: 'fx poof' }, f.type === 'hit' ? '💢' : '💥'); t.append(p); done(p); sfx('hit'); }
      else if (f.type === 'crumble') { const p = h('span', { class: 'fx poof' }, '🪵'); t.append(p); done(p); }
      else if (f.type === 'gather') { const p = h('span', { class: 'fx float' }, f.text); t.append(p); done(p); sfx('gather'); }
      else if (f.type === 'build') { t.classList.add('built'); setTimeout(() => t.classList.remove('built'), 650); }
      else if (f.type === 'pop') { const un = t.querySelector('.unit'); if (un) un.classList.add('pop'); }
    }
  }

  // ----- dialogs -----
  function mulliganDialog() {
    const msg = s.first === 'you' ? 'You go first!' : 'Enemy goes first!';
    const cardsEl = h('div', { class: 'mull-cards' }, s.hands.you.map((id, i) => {
      const card = cardById[id];
      return h('button', { class: `mull-card${ui.mull.has(i) ? ' sel' : ''}`, type: 'button', 'data-testid': 'mulligan-card', 'data-card': id,
        'aria-pressed': String(ui.mull.has(i)), 'aria-label': card.name, onClick: () => { if (ui.mull.has(i)) ui.mull.delete(i); else ui.mull.add(i); render(); } }, cardFace(card));
    }));
    const go = (sel) => () => {
      E.finishMulligan(s, sel);
      ui.msg = msg;
      ui.mull = new Set();
      after();
    };
    return h('div', { class: 'overlay' }, h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mull-h' },
      h('h2', { id: 'mull-h' }, 'Your Starting Hand'),
      h('p', { class: 'flip-msg' }, msg),
      h('p', { class: 'muted' }, 'Tap cards you want to swap. You can only do this once.'),
      cardsEl,
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onClick: go([...ui.mull]) }, 'Redraw Selected'),
        h('button', { class: 'btn accent', type: 'button', onClick: go([]) }, 'Keep Hand'))));
  }

  function menuDialog() {
    if (ui.menu === 'confirm') {
      return h('div', { class: 'overlay' }, h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'menu-h' },
        h('h2', { id: 'menu-h' }, 'Are you sure?'),
        h('p', {}, 'Surrendering ends the match as a loss.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn danger', type: 'button', onClick: () => { ui.menu = null; E.surrender(s); after(); } }, 'Yes, surrender'),
          h('button', { class: 'btn', type: 'button', onClick: () => { ui.menu = 'main'; render(); } }, 'Cancel'))));
    }
    return h('div', { class: 'overlay' }, h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'menu-h' },
      h('h2', { id: 'menu-h' }, 'Menu'),
      h('div', { class: 'stack' },
        h('button', { class: 'btn accent', type: 'button', onClick: () => { ui.menu = null; render(); } }, 'Resume'),
        h('button', { class: 'btn danger', type: 'button', onClick: () => { ui.menu = 'confirm'; render(); } }, 'Surrender'),
        h('button', { class: 'btn', type: 'button', onClick: () => { alive = false; save(); nav.go('menu'); } }, 'Quit to Main Menu'))));
  }

  // start
  save();
  render();
  if (s.phase === 'play' && s.turn === 'enemy') runEnemy();
  else if (s.phase === 'over') showResult();
}

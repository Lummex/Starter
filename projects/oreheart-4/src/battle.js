import { BY_ID, SYMBOL, TYPE_NAME } from './cards.js';
import { store, persist } from './store.js';
import { sfx } from './audio.js';
import { esc, sleep, nav, cardHTML, artOf } from './common.js';
import { MINES, newGame, control, income, cost, canAct, playActions, unitActions, applyAction, startTurn, chooseAction, isGlobalSpell, unitAt, allUnits, slotKey, passKey, other } from './engine.js';

let app, B = null;
const PASS = ['Left–Center Pass', 'Center–Right Pass'];
const anim = () => store.data.settings.anim;

export function startBattle(root, deckId, diff) {
  app = root;
  const deck = store.data.decks.find((d) => d.id === deckId) || store.data.decks[0];
  B = { g: newGame(deck.cards, diff), diff, sel: null, dialog: null, busy: false, dead: false, result: null, lastCtl: null };
  B.g.events = [];
  startTurn(B.g, 'p');
  render();
}

const g = () => B.g;
const mine = () => B.g.current === 'p' && !B.busy && !B.g.over && !B.result;

function currentActs() {
  if (!B.sel || !mine()) return [];
  if (B.sel.k === 'card') return playActions(B.g, 'p').filter((a) => a.idx === B.sel.idx);
  if (B.sel.k === 'unit') {
    const u = findUnit(B.sel.uid);
    return u ? unitActions(B.g, 'p', u) : [];
  }
  return [];
}
function findUnit(uid) {
  return allUnits(B.g, 'p').concat(allUnits(B.g, 'e')).find((u) => u.uid === uid);
}

function slotHTML(s, m, i, hl, sel) {
  const u = B.g.mines[m][s][i];
  const who = s === 'p' ? 'Your' : 'Enemy';
  const label = `${who} ${MINES[m]} Mine slot ${i + 1}${u ? ': ' + u.card.name : ''}`;
  return unitBtn(u, slotKey(s, m, i), label, s, hl, sel);
}
function unitBtn(u, key, label, s, hl, sel) {
  let inner = '<span class="plus">+</span>', cls = '';
  if (u) {
    const c = u.card;
    const ready = s === 'p' && mine() && canAct(u);
    inner = `<span class="us">${u.type === 'c' ? SYMBOL[c.faction] : artOf(c)}</span><span class="un">${esc(c.name.split(/[ ,]/)[0])}</span>` +
      (u.type === 'c' ? `<span class="ua">${u.atk}</span>` : '') + `<span class="uh">${u.hp}</span>` +
      (u.shield ? '<span class="ust">🛡</span>' : '') + (u.frozen ? '<span class="ust">❄</span>' : '') + (u.fresh && u.type === 'c' ? '<span class="ust z">z</span>' : '');
    cls = `occ ${u.type === 'w' ? 'wall' : ''} ${ready ? 'ready' : ''} f-${c.faction}`;
  }
  return `<button class="slot ${cls} ${hl.has(key) ? 'hl' : ''} ${sel === key ? 'sel' : ''} sd-${s}" data-act="tile" data-key="${key}" data-uid="${u ? u.uid : ''}" aria-label="${esc(label)}">${inner}</button>`;
}

function previewHTML() {
  if (!B.sel) return '';
  let c, st = '', extra = '', title;
  if (B.sel.k === 'card' || B.sel.k === 'peek') {
    const id = B.g.side.p.hand[B.sel.idx];
    if (!id) return '';
    c = BY_ID[id];
    extra = B.sel.k === 'peek' ? '<p class="hint">Not enough Ore to play this card.</p>' : isGlobalSpell(c) ? '<button class="btn small" data-act="cast">Cast</button>' : '<p class="hint">Choose a highlighted spot.</p>';
    if (B.sel.k === 'card') extra += '<button class="btn small ghost" data-act="bg">Cancel</button>';
  } else {
    const u = findUnit(B.sel.uid);
    if (!u) return '';
    c = u.card; st = u.type === 'c' ? `Now ${u.atk}/${u.hp}` : `Now ♥${u.hp}/${u.max}`;
    extra = `<p class="hint">${st}${u.acted ? ' · acted' : u.fresh ? ' · just arrived' : ''}${u.frozen ? ' · frozen' : ''}</p>`;
    if (B.sel.k === 'unit') extra += '<p class="hint">Choose a highlighted target.</p>';
  }
  title = `${c.name}`;
  return `<aside class="preview" aria-label="Card preview"><div class="pcard">${cardHTML(c, { cls: 'big' })}</div><div class="pinfo"><b>${esc(title)}</b><span>${TYPE_NAME[c.type]}${c.role ? ' · ' + c.role : ''} · ${c.rarity}</span><span class="ptext">${esc(c.text)}</span>${extra}</div></aside>`;
}

function dialogHTML() {
  const d = B.dialog;
  if (B.result) {
    const r = B.result;
    return `<div class="modal"><div class="dlg result ${r.win ? 'win' : 'lose'}" role="dialog" aria-modal="true" aria-label="Result"><h2>${r.win ? 'Victory' : 'Defeat'}</h2><p>${esc(r.why)}</p><p class="gold-gain">+${r.gold} Gold</p><button class="btn" data-act="b-exit">Back to Menu</button></div></div>`;
  }
  if (!d) return '';
  if (d.k === 'menu') return `<div class="modal"><div class="dlg" role="dialog" aria-modal="true" aria-label="Battle menu"><h2>Paused</h2><button class="btn" data-act="b-resume">Resume</button><button class="btn danger" data-act="b-concede">Concede</button></div></div>`;
  if (d.k === 'concede') return `<div class="modal"><div class="dlg" role="alertdialog" aria-modal="true" aria-label="Concede"><h2>Concede this game?</h2><button class="btn danger" data-act="b-concede-yes">Concede</button><button class="btn ghost" data-act="b-resume">Cancel</button></div></div>`;
  if (d.k === 'choice') {
    const btns = d.acts.map((a, i) => {
      let t = 'Attack';
      if (a.t === 'shove') t = a.mode === 'hand' ? 'Shove: return to hand' : `Shove to ${MINES[+a.dest.split(':')[2]]} Mine`;
      return { i, t };
    });
    const seen = new Set();
    return `<div class="modal"><div class="dlg" role="dialog" aria-modal="true" aria-label="Choose action"><h2>Choose</h2>${btns.filter((b) => !seen.has(b.t) && seen.add(b.t)).map((b) => `<button class="btn" data-act="b-choice" data-i="${b.i}">${esc(b.t)}</button>`).join('')}<button class="btn ghost" data-act="b-resume">Cancel</button></div></div>`;
  }
  return '';
}

function render() {
  if (!app || B.dead) return;
  const G = B.g, ctl = control(G);
  const acts = currentActs();
  const hl = new Set(acts.map((a) => a.tgt).filter(Boolean));
  const selKey = B.sel && B.sel.k === 'unit' ? (findUnit(B.sel.uid) ? `${S_KEY(findUnit(B.sel.uid))}` : '') : '';
  const strongholdHl = hl.has('H:e');
  const ctlName = (c) => (c === 'p' ? 'player' : c === 'e' ? 'enemy' : 'none');
  const prev = B.lastCtl;
  B.lastCtl = ctl.map((x) => x.c);
  const handEl = app.querySelector('.hand');
  const hs = handEl ? handEl.scrollLeft : 0;
  const me = G.side.p, en = G.side.e;
  const inc = income(G, 'p');
  const row = (s) => [0, 1, 2].map((m) => `<div class="slots">${[0, 1, 2].map((i) => slotHTML(s, m, i, hl, selKey)).join('')}</div>`).join('');
  const passBtn = (s, i) => {
    const u = G.pass[i][s];
    const label = `${s === 'p' ? 'Your' : 'Enemy'} ${PASS[i]} wall${u ? ': ' + u.card.name : ''}`;
    return unitBtn(u, passKey(s, i), label, s, hl, selKey).replace('class="slot', 'class="slot pbtn');
  };
  const hand = me.hand.map((id, idx) => {
    const c = BY_ID[id], co = cost(G, 'p', id), ok = co <= me.ore && mine();
    const sel = B.sel && (B.sel.k === 'card' || B.sel.k === 'peek') && B.sel.idx === idx;
    return `<button class="hcard ${ok ? '' : 'dim'} ${sel ? 'sel' : ''}" data-act="hand" data-idx="${idx}" aria-label="${esc(`${c.name}, ${co} Ore, ${TYPE_NAME[c.type]}${c.type === 'c' ? `, ${c.atk} attack ${c.hp} health` : c.type === 'w' ? `, ${c.hp} health` : ''}`)}" aria-pressed="${sel ? 'true' : 'false'}">${cardHTML(c, { cost: co, cls: 'sm' })}</button>`;
  }).join('');
  app.innerHTML = `<main class="battle ${anim() ? '' : 'noanim'}" aria-label="Battle">
<div class="banner" role="status" aria-live="polite">${G.banner ? esc(G.banner) : ''}</div>
<section class="bar ebar" aria-label="Enemy">
 <div class="sh e ${strongholdHl ? 'hl' : ''}" data-act="tile" data-key="H:e"><span class="lbl">Enemy Stronghold</span> ❤ <b data-testid="enemy-health">${Math.max(0, en.health)}</b></div>
 <div class="stat">⛏ Ore <b data-testid="enemy-ore">${en.ore}</b></div>
 <div class="backs" aria-label="Enemy hand: ${en.hand.length} cards">${Array(Math.min(en.hand.length, 10)).fill('<i class="back"></i>').join('')}<span>${en.hand.length}</span></div>
 ${strongholdHl ? '<button class="btn small atk" data-act="tile" data-key="H:e">Attack Stronghold</button>' : ''}
</section>
<div class="board" data-act="bg">
 <div class="slotrow e">${row('e')}</div>
 <div class="minerow">${[0, 1, 2].map((m) => `<div class="mine ${prev && prev[m] !== ctl[m].c ? 'changed' : ''}" role="group" aria-label="${MINES[m]} Mine" data-control="${ctlName(ctl[m].c)}"><span class="mname">${MINES[m]} Mine</span><span class="mtot"><b class="tp">${ctl[m].p}</b> vs <b class="te">${ctl[m].e}</b></span></div>`).join('')}</div>
 <div class="passrow">${[0, 1].map((i) => `<div class="pass"><span class="plabel">${PASS[i]}</span>${passBtn('e', i)}${passBtn('p', i)}</div>`).join('')}</div>
 <div class="slotrow p">${row('p')}</div>
</div>
<section class="bar pbar" aria-label="You">
 <div class="sh p"><span class="lbl">Your Stronghold</span> ❤ <b data-testid="player-health">${Math.max(0, me.health)}</b></div>
 <div class="stat" id="ore-wrap">⛏ Ore <b data-testid="player-ore">${me.ore}</b> <span class="inc" data-testid="player-income">+${inc}</span></div>
 <div class="stat"><span data-testid="turn-number">Turn ${G.turn}</span></div>
 <div class="ctrl"><span class="turn ${G.current}" data-testid="turn-indicator">${G.current === 'p' ? 'Your Turn' : 'Enemy Turn'}</span>
 <button class="btn small" data-act="b-end" ${mine() ? '' : 'disabled'}>End Turn</button><button class="btn small ghost" data-act="b-menu">Menu</button></div>
</section>
${previewHTML()}
<section class="hand" aria-label="Your hand">${hand}</section>
${dialogHTML()}
</main>`;
  const nh = app.querySelector('.hand');
  if (nh) nh.scrollLeft = hs;
  runFx();
}
const S_KEY = (u) => (u.loc.k === 'S' ? slotKey(u.owner, u.loc.m, u.loc.i) : passKey(u.owner, u.loc.i));

function runFx() {
  const evs = B.g.events;
  B.g.events = [];
  const seen = new Set();
  for (const e of evs) {
    if (e.t === 'sfx') { if (!seen.has(e.n)) { seen.add(e.n); sfx(e.n); } continue; }
    if (e.t === 'coins') { if (e.n > 0 && !seen.has('coins')) { seen.add('coins'); sfx('coins'); } }
    if (!anim()) continue;
    const el = e.key ? app.querySelector(`[data-key="${e.key}"]`) : null;
    const float = (txt, cls) => { if (!el) return; const f = document.createElement('span'); f.className = 'float ' + cls; f.textContent = txt; el.appendChild(f); setTimeout(() => f.remove(), 1100); };
    if (e.t === 'dmg') { float(`-${e.n}`, 'dmg'); el && el.classList.add('hurt'); }
    else if (e.t === 'heal') float(`+${e.n}`, 'heal');
    else if (e.t === 'shield') float('🛡', 'heal');
    else if (e.t === 'freeze') float('❄', 'heal');
    else if (e.t === 'lunge' && el) el.classList.add(e.toward === 'e' ? 'lunge-up' : 'lunge-down');
    else if (e.t === 'build' && el) el.classList.add('rise');
    else if (e.t === 'die' && el) { const gh = document.createElement('span'); gh.className = 'puff'; gh.textContent = e.structure ? '🧱' : '💨'; el.appendChild(gh); setTimeout(() => gh.remove(), 700); }
    else if (e.t === 'coins' && e.s === 'p') {
      const w = app.querySelector('#ore-wrap');
      for (let i = 0; i < Math.min(e.n, 6); i++) { const c = document.createElement('span'); c.className = 'coin'; c.textContent = '🪙'; c.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`); c.style.animationDelay = `${i * 80}ms`; w.appendChild(c); setTimeout(() => c.remove(), 1200); }
    }
  }
}

function finish() {
  if (B.result || !B.g.over) return;
  const o = B.g.over, win = o.winner === 'p';
  const gold = win ? { Easy: 50, Normal: 100, Hard: 150 }[B.diff] : 0;
  if (win) { store.data.gold += gold; persist(); }
  const why = o.reason === 'domination' ? 'Domination: you held all three Mines.' : o.reason === 'concede' ? 'You conceded the battle.' : win ? 'The enemy Stronghold has fallen.' : 'Your Stronghold has fallen.';
  const dom = o.reason === 'domination' && !win ? 'The enemy dominated all three Mines.' : why;
  B.result = { win, gold, why: dom };
  B.dialog = null;
  sfx(win ? 'win' : 'lose');
  render();
}

function doAct(a) {
  B.sel = null; B.dialog = null;
  applyAction(B.g, 'p', a);
  render();
  if (B.g.over) finish();
}

async function endTurn() {
  const G = B.g;
  if (!mine()) return;
  B.busy = true; B.sel = null; G.current = 'e';
  startTurn(G, 'e');
  render();
  const alive = () => B.g === G && !B.dead && !G.over;
  if (G.over) { B.busy = false; return finish(); }
  const fast = !anim();
  await sleep(fast ? 30 : 550);
  const t0 = Date.now();
  for (let n = 0; n < 24 && alive() && Date.now() - t0 < 7000; n++) {
    const a = chooseAction(G, 'e', B.diff);
    if (!a) break;
    applyAction(G, 'e', a);
    render();
    if (G.over) break;
    await sleep(fast ? 20 : 380);
  }
  if (!alive()) { B.busy = false; if (G.over && B.g === G) finish(); return; }
  await sleep(fast ? 20 : 300);
  if (!alive()) return;
  G.current = 'p'; G.turn++;
  startTurn(G, 'p');
  B.busy = false;
  render();
  if (G.over) finish();
}

export const handlers = {
  hand(el) {
    if (!mine()) return;
    const idx = +el.dataset.idx, id = B.g.side.p.hand[idx];
    const ok = cost(B.g, 'p', id) <= B.g.side.p.ore;
    if (B.sel && B.sel.idx === idx && B.sel.k !== 'unit') B.sel = null;
    else B.sel = { k: ok ? 'card' : 'peek', idx };
    render();
  },
  tile(el, ev) {
    if (ev) ev.stopPropagation();
    if (!mine()) return;
    const key = el.dataset.key;
    const acts = currentActs().filter((a) => a.tgt === key);
    if (acts.length === 1) return doAct(acts[0]);
    if (acts.length > 1) { B.dialog = { k: 'choice', acts }; return render(); }
    const u = key.startsWith('H:') ? null : unitAt(B.g, key);
    if (u) {
      if (B.sel && B.sel.k === 'unit' && B.sel.uid === u.uid) B.sel = null;
      else if (u.owner === 'p' && canAct(u) && unitActions(B.g, 'p', u).length) B.sel = { k: 'unit', uid: u.uid };
      else B.sel = { k: 'inspect', uid: u.uid };
    } else B.sel = null;
    render();
  },
  bg() { if (B.sel) { B.sel = null; render(); } },
  cast() {
    if (!B.sel || B.sel.k !== 'card') return;
    const a = currentActs().find((x) => x.tgt === null);
    if (a) doAct(a);
  },
  'b-choice'(el) { const a = B.dialog && B.dialog.acts[+el.dataset.i]; if (a) doAct(a); },
  'b-end'() { endTurn(); },
  'b-menu'() { B.dialog = { k: 'menu' }; render(); },
  'b-resume'() { B.dialog = null; render(); },
  'b-concede'() { B.dialog = { k: 'concede' }; render(); },
  'b-concede-yes'() { B.g.over = { winner: 'e', reason: 'concede' }; finish(); },
  'b-exit'() { B.dead = true; nav.go('menu'); },
};
export function abandon() { if (B) B.dead = true; }

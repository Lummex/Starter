import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
import './style.css';
import { CARDS, BY_ID, FACTIONS, RARITIES, ROLES, TYPE_NAME } from './cards.js';
import { store, persist, resetAll } from './store.js';
import { sfx } from './audio.js';
import { esc, nav, cardHTML, sleep } from './common.js';
import { shuffle } from './engine.js';
import { startBattle, handlers as bh, abandon } from './battle.js';

const app = document.getElementById('app');
let view = 'menu';
const emblem = `<svg class="emblem" viewBox="0 0 100 90" role="img" aria-label="OreHeart emblem: a golden heart-shaped ore gem" width="84" height="76"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d98a"/><stop offset="1" stop-color="#a8761f"/></linearGradient></defs><path d="M50 84 C10 56 4 34 14 20 C24 8 42 10 50 24 C58 10 76 8 86 20 C96 34 90 56 50 84Z" fill="url(#gg)" stroke="#f1e6cc" stroke-width="2"/><path d="M50 24 L50 84 M14 20 L50 44 L86 20" stroke="#7a521a" stroke-width="1.5" fill="none" opacity=".6"/><path d="M22 24 C28 16 38 16 44 26 L36 34Z" fill="#fff6d6" opacity=".7"/></svg>`;

function shell(title, body, cls = '') {
  return `<main class="screen ${cls}"><header class="top"><button class="btn small ghost" data-act="back">Back</button><h1>${esc(title)}</h1></header>${body}</main>`;
}
function go(name, p) {
  if (view === 'battle' && name !== 'battle') abandon();
  view = name;
  const keep = name === view ? 0 : 0;
  (screens[name] || screens.menu)(p);
  document.documentElement.classList.toggle('noanim', !store.data.settings.anim);
  app.scrollTop = 0; window.scrollTo(0, 0);
  return keep;
}
nav.go = go;

/* ---------- Menu ---------- */
const menu = () => {
  app.innerHTML = `<main class="screen menu"><div class="hero">${emblem}<h1>OreHeart</h1><p class="tag">Mine. Build. Conquer.</p></div>
<p class="gold" data-testid="gold">Gold: ${store.data.gold}</p>
<nav class="menu-btns" aria-label="Main menu">${['Play', 'Collection', 'Deck Builder', 'Shop', 'How to Play', 'Settings'].map((t) => `<button class="btn big" data-act="open" data-to="${t}">${t}</button>`).join('')}</nav></main>`;
};

/* ---------- Play ---------- */
const play = () => {
  const decks = store.data.decks.filter((d) => d.cards.length === 30);
  app.innerHTML = shell('Play', `<div class="panel"><label for="deck">Deck</label><select id="deck">${decks.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div>
<fieldset class="panel diff"><legend>Difficulty</legend>${[['Easy', 50], ['Normal', 100], ['Hard', 150]].map(([n, r]) => `<div class="radio"><input type="radio" name="diff" id="d-${n}" value="${n}" ${n === 'Normal' ? 'checked' : ''}><label for="d-${n}">${n}</label><span class="reward">Win: ${r} Gold</span></div>`).join('')}</fieldset>
<button class="btn big" data-act="start">Start Battle</button>`);
};

/* ---------- Collection ---------- */
const CF = { Faction: 'All', Rarity: 'All', Role: 'All', Type: 'All', Cost: 'All', owned: false };
const costOk = (c, v) => v === 'All' || (v === '0-1' ? c.cost <= 1 : v === '6+' ? c.cost >= 6 : c.cost === +v);
function sel(id, label, opts, val) {
  return `<div class="f"><label for="${id}">${label}</label><select id="${id}" data-filter="${label}">${opts.map((o) => `<option ${o === val ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
}
function filtered(f, ownedOnly) {
  return CARDS.filter((c) => (f.Faction === 'All' || c.faction === f.Faction) && (f.Rarity === 'All' || c.rarity === f.Rarity) && (f.Role === 'All' || c.role === f.Role) && (f.Type === 'All' || TYPE_NAME[c.type] === f.Type) && costOk(c, f.Cost) && (!ownedOnly || store.data.collection[c.id] > 0));
}
function colGrid() {
  const list = filtered(CF, CF.owned);
  document.getElementById('colcount').textContent = `Showing ${list.length} of 80 cards`;
  document.getElementById('colgrid').innerHTML = list.map((c) => {
    const n = store.data.collection[c.id] || 0;
    return `<button class="gcard ${n ? '' : 'unowned'}" data-act="cardview" data-id="${c.id}" aria-label="${esc(c.name)}${n ? ', owned ' + n : ', not owned'}">${cardHTML(c)}<span class="owned">${n ? '×' + n : 'Not owned'}</span></button>`;
  }).join('');
}
const collection = () => {
  const col = store.data.collection;
  const uniq = Object.keys(col).filter((k) => col[k] > 0).length, tot = Object.values(col).reduce((a, b) => a + b, 0);
  app.innerHTML = shell('Collection', `<p class="sum"><span>Unique cards: ${uniq} / 80</span> <span>Total cards: ${tot}</span></p>
<div class="filters">${sel('f-fac', 'Faction', ['All', ...FACTIONS], CF.Faction)}${sel('f-rar', 'Rarity', ['All', ...RARITIES], CF.Rarity)}${sel('f-role', 'Role', ['All', ...ROLES], CF.Role)}${sel('f-type', 'Type', ['All', 'Creature', 'Spell', 'Structure'], CF.Type)}${sel('f-cost', 'Cost', ['All', '0-1', '2', '3', '4', '5', '6+'], CF.Cost)}
<div class="f chk"><input type="checkbox" id="f-own" ${CF.owned ? 'checked' : ''}><label for="f-own">Owned only</label></div></div>
<p class="count" id="colcount" role="status"></p><div class="grid" id="colgrid"></div>`);
  colGrid();
};
function cardModal(id) {
  const c = BY_ID[id], n = store.data.collection[id] || 0;
  const m = document.createElement('div');
  m.className = 'modal'; m.id = 'cardmodal';
  m.innerHTML = `<div class="dlg cardview" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">${cardHTML(c, { cls: 'big' })}<p>${c.faction} · ${c.rarity} · ${TYPE_NAME[c.type]}${c.role ? ' · ' + c.role : ''} · Owned: ${n}</p><button class="btn" data-act="closemodal">Close</button></div>`;
  app.appendChild(m);
  m.querySelector('button').focus();
}

/* ---------- Deck Builder ---------- */
let ED = null;
const decks = () => {
  const ds = store.data.decks;
  app.innerHTML = shell('Deck Builder', `<h2 class="sub">Decks (${ds.length}/5)</h2><ul class="decks">${ds.map((d) => `<li class="panel deck"><div><b>${esc(d.name)}</b><span>${d.cards.length} cards</span></div><div class="row"><button class="btn small" data-act="deck-edit" data-id="${d.id}">Edit</button><button class="btn small danger" data-act="deck-del" data-id="${d.id}" ${ds.length < 2 ? 'disabled' : ''}>Delete</button></div></li>`).join('')}</ul>
<button class="btn big" data-act="deck-new" ${ds.length >= 5 ? 'disabled' : ''}>New Deck</button><p class="hint">${ds.length < 2 ? 'The last remaining deck cannot be deleted.' : ''}</p>`);
};
const cnt = (cards) => { const m = {}; cards.forEach((c) => { m[c] = (m[c] || 0) + 1; }); return m; };
const PF = { Faction: 'All', Type: 'All', Cost: 'All' };
function editor() {
  app.innerHTML = `<main class="screen editor"><header class="top"><button class="btn small ghost" data-act="deck-cancel">Cancel</button><h1>Deck Builder</h1></header>
<div class="panel"><label for="dname">Deck name</label><input id="dname" type="text" maxlength="24" value="${esc(ED.name)}"></div>
<div class="row between"><p class="count" id="dcount"></p><div class="row"><button class="btn small" data-act="deck-auto">Auto-Fill</button><button class="btn small" id="dsave" data-act="deck-save">Save Deck</button></div></div>
<p id="toast" class="toast" role="status"></p>
<h2 class="sub">Your deck</h2><div id="dlist" class="dlist"></div>
<h2 class="sub">Card pool</h2><div class="filters">${sel('p-fac', 'Faction', ['All', ...FACTIONS], PF.Faction).replace('data-filter', 'data-pf')}${sel('p-type', 'Type', ['All', 'Creature', 'Spell', 'Structure'], PF.Type).replace('data-filter', 'data-pf')}${sel('p-cost', 'Cost', ['All', '0-1', '2', '3', '4', '5', '6+'], PF.Cost).replace('data-filter', 'data-pf')}</div>
<div id="dpool" class="grid"></div></main>`;
  editorUpdate();
}
function editorUpdate() {
  const cs = ED.cards, m = cnt(cs);
  document.getElementById('dcount').textContent = `Cards: ${cs.length}/30`;
  document.getElementById('dsave').disabled = cs.length !== 30;
  const order = Object.keys(m).sort((a, b) => BY_ID[a].cost - BY_ID[b].cost || BY_ID[a].name.localeCompare(BY_ID[b].name));
  document.getElementById('dlist').innerHTML = order.length ? order.map((id) => { const c = BY_ID[id]; return `<button class="dl f-${c.faction}" data-act="deck-rem" data-id="${id}" aria-label="Remove ${esc(c.name)}"><span class="dc">${c.cost}</span><span class="dn">${esc(c.name)}</span><span class="dx">×${m[id]}</span></button>`; }).join('') : '<p class="hint">Empty — add cards from the pool below.</p>';
  const pool = CARDS.filter((c) => store.data.collection[c.id] > 0 && (PF.Faction === 'All' || c.faction === PF.Faction) && (PF.Type === 'All' || TYPE_NAME[c.type] === PF.Type) && costOk(c, PF.Cost));
  document.getElementById('dpool').innerHTML = pool.map((c) => `<button class="gcard" data-act="deck-add" data-id="${c.id}" aria-label="Add ${esc(c.name)}">${cardHTML(c)}<span class="owned">In deck ${m[c.id] || 0} / owned ${store.data.collection[c.id]}</span></button>`).join('');
}
let toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; clearTimeout(toastT);
  toastT = setTimeout(() => { t.textContent = ''; }, 2500);
}
function addCard(id) {
  const c = BY_ID[id], m = cnt(ED.cards)[id] || 0;
  if (ED.cards.length >= 30) return toast('Deck is full');
  if (c.rarity === 'Legendary' && m >= 1) return toast('Only 1 copy of a Legendary');
  if (m >= 2) return toast('Max 2 copies');
  if (m >= (store.data.collection[id] || 0)) return toast("You don't own more copies");
  ED.cards.push(id);
  editorUpdate();
}
function autoFill() {
  const m = cnt(ED.cards);
  for (const c of shuffle(CARDS)) {
    if (ED.cards.length >= 30) break;
    const max = Math.min(c.rarity === 'Legendary' ? 1 : 2, store.data.collection[c.id] || 0);
    while ((m[c.id] || 0) < max && ED.cards.length < 30) { ED.cards.push(c.id); m[c.id] = (m[c.id] || 0) + 1; }
  }
  editorUpdate();
}

/* ---------- Shop ---------- */
let PACK = null;
function rollPack() {
  const pick = (rar) => { const l = CARDS.filter((c) => c.rarity === rar); return l[Math.floor(Math.random() * l.length)].id; };
  const roll = () => { const r = Math.random(); return r < 0.7 ? 'Common' : r < 0.9 ? 'Rare' : r < 0.98 ? 'Epic' : 'Legendary'; };
  const rars = [roll(), roll(), roll(), roll(), roll()];
  if (!rars.some((r) => r !== 'Common')) { const r = Math.random() * 30; rars[4] = r < 20 ? 'Rare' : r < 28 ? 'Epic' : 'Legendary'; }
  return rars.map(pick);
}
const shop = () => {
  const g = store.data.gold;
  if (PACK) return packView();
  app.innerHTML = shell('Shop', `<p class="gold">Gold: ${g}</p><div class="panel pack"><div class="packart" aria-hidden="true">${emblem}</div><h2 class="sub">Booster Pack</h2><p>5 cards per pack — at least one Rare or better.</p><p class="price">100 Gold</p>
<button class="btn big" data-act="buy" ${g < 100 ? 'disabled' : ''}>Buy Booster Pack</button>${g < 100 ? '<p class="hint warn">Not enough gold</p>' : ''}
<p class="odds">Odds per card: Common 70% · Rare 20% · Epic 8% · Legendary 2%</p></div>`);
};
function packView() {
  const all = PACK.rev.every(Boolean);
  app.innerHTML = shell('Shop', `<p class="gold">Gold: ${store.data.gold}</p><p class="hint">Tap a card to reveal it.</p><div class="packrow">${PACK.ids.map((id, i) => {
    const c = BY_ID[id], r = PACK.rev[i];
    return `<button class="flip ${r ? 'on' : ''} fx-${c.rarity}" data-act="reveal" data-i="${i}" aria-label="${r ? `Card ${i + 1}: ${esc(c.name)}` : `Reveal card ${i + 1}`}" ${r ? 'disabled' : ''}><span class="face back"></span><span class="face front">${cardHTML(c)}</span></button>`;
  }).join('')}</div><div class="row center">${all ? '<button class="btn big" data-act="done">Done</button>' : '<button class="btn big" data-act="revealall">Reveal All</button>'}</div>`);
}
function flipIn(i) {
  const c = BY_ID[PACK.ids[i]];
  PACK.rev[i] = true;
  sfx(c.rarity === 'Common' ? 'flip' : 'rare');
}

/* ---------- How to play ---------- */
const svg = (label, body) => `<svg viewBox="0 0 240 90" role="img" aria-label="${esc(label)}" class="diagram">${body}</svg>`;
const howto = () => {
  const mineSvg = svg('Diagram: three Mines in a row, the left one glowing blue, the right one red, the center grey', ['#3b82f6', '#6b6560', '#ef4444'].map((c, i) => `<rect x="${12 + i * 78}" y="14" width="66" height="62" rx="8" fill="#1f1a17" stroke="${c}" stroke-width="3"/><text x="${45 + i * 78}" y="52" font-size="26" text-anchor="middle">⛏️</text>`).join(''));
  const oreSvg = svg('Diagram: a Mine producing gold Ore coins that flow to your Ore counter', `<rect x="10" y="20" width="60" height="50" rx="8" fill="#1f1a17" stroke="#3b82f6" stroke-width="3"/><text x="40" y="54" font-size="26" text-anchor="middle">⛏️</text><path d="M78 45 H150" stroke="#d4a84b" stroke-width="3" stroke-dasharray="6 5"/><text x="115" y="38" font-size="18" text-anchor="middle">🪙🪙</text><rect x="158" y="22" width="72" height="46" rx="8" fill="#1f1a17" stroke="#d4a84b" stroke-width="2"/><text x="194" y="52" fill="#d4a84b" font-size="18" text-anchor="middle">Ore +4</text>`);
  const wallSvg = svg('Diagram: a creature behind a stone wall that is being attacked by an enemy', `<text x="24" y="56" font-size="30">🛡️</text><rect x="86" y="14" width="30" height="62" rx="4" fill="#6b6560" stroke="#f1e6cc" stroke-width="2"/><text x="170" y="56" font-size="30">⚔️</text><path d="M160 45 H122" stroke="#ef4444" stroke-width="3"/>`);
  const passSvg = svg('Diagram: two Mines joined by a Pass; a wall on the Pass blocks movement between them', `<rect x="10" y="20" width="64" height="50" rx="8" fill="#1f1a17" stroke="#3b82f6" stroke-width="3"/><rect x="166" y="20" width="64" height="50" rx="8" fill="#1f1a17" stroke="#ef4444" stroke-width="3"/><path d="M74 45 H166" stroke="#d4a84b" stroke-width="6"/><rect x="108" y="26" width="24" height="38" rx="3" fill="#6b6560" stroke="#f1e6cc" stroke-width="2"/>`);
  const crSvg = svg('Diagram: a creature card showing Attack 3 and Health 4', `<rect x="80" y="8" width="80" height="74" rx="8" fill="#1f1a17" stroke="#d4a84b" stroke-width="2"/><text x="120" y="40" font-size="26" text-anchor="middle">⚔️</text><text x="96" y="74" fill="#f1e6cc" font-size="16" font-weight="700">3</text><text x="136" y="74" fill="#ef9a9a" font-size="16" font-weight="700">4</text>`);
  const winSvg = svg('Diagram: a Stronghold with 25 health, and three Mines all glowing blue for Domination', `<text x="30" y="52" font-size="32">🏰</text><text x="30" y="80" fill="#f1e6cc" font-size="13">25 ❤</text>${[0, 1, 2].map((i) => `<rect x="${110 + i * 40}" y="26" width="32" height="38" rx="6" fill="#1f1a17" stroke="#3b82f6" stroke-width="3"/>`).join('')}`);
  const S = (h, t, d) => `<section class="panel how"><h2>${h}</h2>${d}<p>${t}</p></section>`;
  app.innerHTML = shell('How to Play', `<p class="lead">Destroy the enemy Stronghold, or hold all three Mines, before they do it to you.</p>
${S('Mines', 'The battlefield has three Mines: Left, Center and Right. Each Mine gives each player 3 slots. The player with more total creature Attack at a Mine controls it (ties control nothing). Controlled Mines glow blue for you and red for the enemy.', mineSvg)}
${S('Ore', 'Ore pays for cards. Each turn you collect 2 Ore, plus 1 for every Mine you control, plus 1 for each of your Miners standing at a Mine you control. Unspent Ore carries over, up to 15.', oreSvg)}
${S('Walls', 'Structures are walls with Health but no Attack. Enemies must destroy walls at a Mine before they can hit anything else there. Builders make your structures cost 1 less.', wallSvg)}
${S('Passes', 'Between neighboring Mines runs a Pass. Creatures move through a Pass to the next Mine, unless an enemy wall stands on it or you built a normal wall there yourself. Iron Gates block only enemies. Flying creatures ignore Pass walls.', passSvg)}
${S('Creatures', 'Each creature gets one action per turn: attack an enemy at the same Mine, move, or strike the Stronghold when the Mine has no enemy creatures or walls. A creature cannot act the turn it is played unless it has Charge. Creatures strike back when attacked.', crSvg)}
${S('Winning', 'Each Stronghold starts with 25 health — reduce the enemy’s to 0 to win. Or achieve Domination: control all three Mines at the start of two of your turns in a row.', winSvg)}`);
};

/* ---------- Settings ---------- */
const settings = () => {
  const s = store.data.settings;
  app.innerHTML = shell('Settings', `<div class="panel"><div class="chk"><input type="checkbox" id="s-sound" ${s.sound ? 'checked' : ''}><label for="s-sound">Sound effects</label></div><div class="chk"><input type="checkbox" id="s-anim" ${s.anim ? 'checked' : ''}><label for="s-anim">Animations</label></div></div>
<button class="btn danger big" data-act="reset">Reset Progress</button>`);
};

const screens = { menu, Play: play, Collection: collection, 'Deck Builder': decks, Shop: () => { PACK = null; shop(); }, 'How to Play': howto, Settings: settings, editor, battle: () => {} };

/* ---------- events ---------- */
function confirmDlg(text, yesLabel, onYes) {
  const m = document.createElement('div');
  m.className = 'modal'; m.id = 'confirm';
  m.innerHTML = `<div class="dlg" role="alertdialog" aria-modal="true" aria-label="Confirm"><h2>${esc(text)}</h2><button class="btn danger" data-act="c-yes">${yesLabel}</button><button class="btn ghost" data-act="c-no">Cancel</button></div>`;
  m.querySelector('[data-act=c-yes]').addEventListener('click', (e) => { e.stopPropagation(); m.remove(); onYes(); });
  m.querySelector('[data-act=c-no]').addEventListener('click', (e) => { e.stopPropagation(); m.remove(); });
  app.appendChild(m);
}
const acts = {
  back() { go('menu'); },
  open(el) { go(el.dataset.to); },
  start() {
    const deck = document.getElementById('deck').value;
    const diff = document.querySelector('input[name=diff]:checked').value;
    view = 'battle';
    startBattle(app, deck, diff);
  },
  cardview(el) { cardModal(el.dataset.id); },
  closemodal() { const m = document.getElementById('cardmodal'); if (m) m.remove(); },
  'deck-new'() { ED = { id: null, name: 'New Deck', cards: [] }; go('editor'); },
  'deck-edit'(el) { const d = store.data.decks.find((x) => x.id === el.dataset.id); ED = { id: d.id, name: d.name, cards: d.cards.slice() }; go('editor'); },
  'deck-del'(el) {
    const id = el.dataset.id;
    confirmDlg('Delete this deck?', 'Delete', () => { if (store.data.decks.length > 1) { store.data.decks = store.data.decks.filter((d) => d.id !== id); persist(); decks(); } });
  },
  'deck-cancel'() { ED = null; go('Deck Builder'); },
  'deck-add'(el) { addCard(el.dataset.id); },
  'deck-rem'(el) { const i = ED.cards.indexOf(el.dataset.id); if (i >= 0) ED.cards.splice(i, 1); editorUpdate(); },
  'deck-auto'() { autoFill(); },
  'deck-save'() {
    if (ED.cards.length !== 30) return;
    const name = (ED.name || '').trim() || 'New Deck';
    if (ED.id) { const d = store.data.decks.find((x) => x.id === ED.id); d.name = name; d.cards = ED.cards; }
    else store.data.decks.push({ id: 'd' + Date.now().toString(36), name, cards: ED.cards });
    persist(); ED = null; go('Deck Builder');
  },
  buy() {
    if (store.data.gold < 100) return;
    const ids = rollPack();
    store.data.gold -= 100;
    ids.forEach((id) => { store.data.collection[id] = (store.data.collection[id] || 0) + 1; });
    persist();
    PACK = { ids, rev: [false, false, false, false, false] };
    packView();
  },
  reveal(el) { flipIn(+el.dataset.i); packView(); },
  async revealall() {
    for (let i = 0; i < 5; i++) if (!PACK.rev[i]) { flipIn(i); packView(); await sleep(store.data.settings.anim ? 250 : 0); }
  },
  done() { PACK = null; shop(); },
  reset() { confirmDlg('Reset all progress? This cannot be undone.', 'Reset', () => { resetAll(); document.documentElement.classList.toggle('noanim', !store.data.settings.anim); settings(); }); },
  ...bh,
};
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const f = acts[el.dataset.act];
  if (!f) return;
  if (!['tile', 'bg', 'hand'].includes(el.dataset.act)) sfx('click');
  f(el, e);
});
app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.filter) { CF[t.dataset.filter] = t.value; colGrid(); }
  else if (t.id === 'f-own') { CF.owned = t.checked; colGrid(); }
  else if (t.dataset.pf) { PF[t.dataset.pf] = t.value; editorUpdate(); }
  else if (t.id === 's-sound') { store.data.settings.sound = t.checked; persist(); }
  else if (t.id === 's-anim') { store.data.settings.anim = t.checked; persist(); document.documentElement.classList.toggle('noanim', !t.checked); }
});
app.addEventListener('input', (e) => { if (e.target.id === 'dname' && ED) ED.name = e.target.value; });

go('menu');
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

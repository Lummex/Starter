import { cards, cardById, costText, totalCost, validateDeck, STARTER_NAMES, starterDecks } from './cards.js';
import { MODES, goldReward, arrowVec } from './engine.js';
import { profile, saveProfile, ownedTotal, deckOptions, loadMatch, resetProgress, openPack, addToCollection } from './store.js';
import { sfx, syncMusic, unlockAudio } from './audio.js';

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') el.textContent = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// ---------- card face ----------
const ANGLE = { '-1,0': 0, '-1,1': 45, '0,1': 90, '1,1': 135, '1,0': 180, '1,-1': 225, '0,-1': 270, '-1,-1': 315 };
export function arrowGrid(arrows, dir = 0, cls = 'arrows') {
  const g = h('span', { class: cls, 'aria-hidden': 'true' });
  for (const a of arrows) {
    const ranged = a.length === 2 && a[0] === a[1];
    const [dr, dc] = arrowVec(ranged ? a[0] : a, dir);
    const el = h('span', { class: 'arrow' + (ranged ? ' ranged' : ''), style: `grid-row:${dr + 2};grid-column:${dc + 2};transform:rotate(${ANGLE[`${dr},${dc}`]}deg)` },
      h('i', {}, '▲'), ranged ? h('i', {}, '▲') : null);
    g.append(el);
  }
  return g;
}
const RAR_NAME = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
export function cardFace(card, opts = {}) {
  const spell = card.type === 'spell';
  const el = h('span', { class: `card f-${card.faction} r-${card.rarity}${opts.mini ? ' mini' : ''}` },
    h('span', { class: 'c-cost' }, costText(card.cost)),
    h('span', { class: 'c-gem', title: RAR_NAME[card.rarity], 'aria-hidden': 'true' }),
    h('span', { class: 'c-art' },
      spell ? null : arrowGrid(card.arrows, 0),
      h('span', { class: 'c-emoji', 'aria-hidden': 'true' }, card.emoji)),
    h('span', { class: 'c-name' }, card.name),
    card.ability ? h('span', { class: 'c-abil' }, card.ability) : null,
    spell ? null : h('span', { class: 'c-atk' }, `⚔️${card.attack}`),
    spell ? null : h('span', { class: 'c-def' }, `🛡️${card.defense}`));
  return el;
}
export const goldBadge = () => h('div', { class: 'gold', 'data-testid': 'gold' }, `🪙 ${profile.gold}`);

function screen(title, nav, ...body) {
  return h('main', { class: 'screen' },
    h('header', { class: 'screen-head' },
      h('button', { class: 'btn small', onClick: () => nav.go('menu') }, 'Back'),
      h('h1', {}, title)),
    ...body);
}
const btn = (text, fn, cls = '') => h('button', { class: `btn ${cls}`, type: 'button', onClick: fn }, text);

// ---------- screens ----------
const menu = (nav) => {
  const saved = loadMatch();
  return h('main', { class: 'screen menu' },
    h('div', { class: 'logo', 'aria-hidden': 'true' }, '💎🏰⚔️'),
    h('h1', { class: 'title' }, 'Oreheart'),
    h('p', { class: 'tag' }, 'A cute fantasy card battle'),
    goldBadge(),
    h('nav', { class: 'menu-list', 'aria-label': 'Main menu' },
      saved ? btn('Continue', () => nav.go('match', { resume: saved }), 'big accent') : null,
      btn('Play', () => nav.go('play'), 'big'),
      btn('Collection', () => nav.go('collection'), 'big'),
      btn('Deck Builder', () => nav.go('decks'), 'big'),
      btn('Shop', () => nav.go('shop'), 'big'),
      btn('How to Play', () => nav.go('howto'), 'big'),
      btn('Settings', () => nav.go('settings'), 'big')));
};

const MODE_INFO = {
  quick: ['Quick Battle', '5 hearts · sites of 15 · Kingdom 10 of each · about 10–15 min'],
  standard: ['Standard', '10 hearts · sites of 30 · Kingdom 15 of each · about 20–30 min'],
  epic: ['Epic War', '15 hearts · sites of 50 · Kingdom 20 of each · about 45–60 min'],
};
const DIFF_INFO = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const DIFF_DESC = { easy: 'Gentle opponent, makes mistakes · wins pay 10 gold', normal: 'Sensible play · wins pay 20 gold', hard: 'Clever and tough · wins pay 35 gold' };

function radioGroup(name, label, items, selected, onChange) {
  const g = h('div', { class: 'radios', role: 'radiogroup', 'aria-labelledby': `lbl-${name}` });
  const wrap = h('div', { class: 'field' }, h('span', { class: 'lbl', id: `lbl-${name}` }, label), g);
  for (const [val, text, desc] of items) {
    const id = `${name}-${val}`;
    const input = h('input', { type: 'radio', name, id, value: val, checked: val === selected, 'aria-describedby': `${id}-d`, onChange: () => onChange(val) });
    g.append(h('div', { class: 'radio' }, input, h('label', { for: id }, text), h('small', { id: `${id}-d` }, desc)));
  }
  return wrap;
}

const play = (nav) => {
  let mode = 'quick', diff = 'easy';
  const sel = h('select', { id: 'deck-select' }, deckOptions().map((o) => h('option', { value: o.value }, o.label)));
  return screen('Play', nav,
    h('div', { class: 'panel' },
      h('div', { class: 'field' }, h('label', { for: 'deck-select', class: 'lbl' }, 'Deck'), sel),
      radioGroup('mode', 'Mode', Object.entries(MODE_INFO).map(([k, v]) => [k, v[0], v[1]]), mode, (v) => (mode = v)),
      radioGroup('difficulty', 'Difficulty', Object.keys(DIFF_INFO).map((k) => [k, DIFF_INFO[k], DIFF_DESC[k]]), diff, (v) => (diff = v)),
      btn('Start Match', () => nav.go('match', { deckKey: sel.value, mode, difficulty: diff }), 'big accent')));
};

// ----- filters (collection + deck builder) -----
function filterBar(onChange) {
  const f = { faction: 'all', rarity: 'all', type: 'all', cost: 'all' };
  const mk = (key, label, opts) => {
    const id = `f-${key}-${Math.random().toString(36).slice(2, 6)}`;
    return h('div', { class: 'filter' }, h('label', { for: id }, label),
      h('select', { id, onChange: (e) => { f[key] = e.target.value; onChange(); } },
        opts.map(([v, t]) => h('option', { value: v }, t))));
  };
  const el = h('div', { class: 'filters' },
    mk('faction', 'Faction', [['all', 'All'], ['wildwood', 'Wildwood'], ['shimmerfolk', 'Shimmerfolk'], ['ironclad', 'Ironclad'], ['spell', 'Spells']]),
    mk('rarity', 'Rarity', [['all', 'All'], ['common', 'Common'], ['rare', 'Rare'], ['epic', 'Epic'], ['legendary', 'Legendary']]),
    mk('type', 'Type', [['all', 'All'], ['creature', 'Creature'], ['spell', 'Spell']]),
    mk('cost', 'Cost', [['all', 'All'], ...[1, 2, 3, 4, 5].map((n) => [String(n), String(n)])]));
  const match = (c) => (f.faction === 'all' || c.faction === f.faction) && (f.rarity === 'all' || c.rarity === f.rarity) &&
    (f.type === 'all' || c.type === f.type) && (f.cost === 'all' || totalCost(c) === +f.cost);
  return { el, match };
}

const collection = (nav) => {
  const grid = h('div', { class: 'card-grid' });
  const total = h('div', { class: 'owned' }, 'Cards owned: ', h('b', { 'data-testid': 'owned-total' }, String(ownedTotal())));
  const fb = filterBar(draw);
  function draw() {
    grid.replaceChildren(...cards.filter(fb.match).map((c) => {
      const n = profile.collection[c.id] || 0;
      return h('div', { class: `coll-card${n ? '' : ' unowned'}`, 'data-testid': 'collection-card', 'data-card': c.id, 'data-faction': c.faction },
        cardFace(c), h('span', { class: 'count' }, `×${n}`));
    }));
  }
  draw();
  return screen('Collection', nav, total, fb.el, grid);
};

const decks = (nav, editing) => {
  if (editing) return deckEditor(nav, editing);
  const list = h('ul', { class: 'deck-list' }, profile.decks.map((d) =>
    h('li', {}, h('span', { class: 'deck-name' }, d.name),
      btn('Edit', () => nav.go('decks', { id: d.id }), 'small'),
      btn('Delete', () => { profile.decks = profile.decks.filter((x) => x.id !== d.id); saveProfile(); nav.go('decks'); }, 'small danger'))));
  const full = profile.decks.length >= 5;
  return screen('Deck Builder', nav,
    profile.decks.length ? list : h('p', { class: 'muted' }, 'No custom decks yet. Build one from your collection!'),
    h('button', { class: 'btn big accent', type: 'button', disabled: full, onClick: () => nav.go('decks', { id: null }) }, 'New Deck'),
    full ? h('p', { class: 'muted' }, 'You can save up to 5 decks.') : null);
};

function deckEditor(nav, { id }) {
  const existing = profile.decks.find((d) => d.id === id);
  const work = { name: existing ? existing.name : '', cards: existing ? [...existing.cards] : [] };
  const nameInput = h('input', { id: 'deck-name', type: 'text', maxlength: 30, value: work.name, onInput: (e) => { work.name = e.target.value; refresh(); } });
  const size = h('div', { class: 'deck-size', 'data-testid': 'deck-size' });
  const pool = h('div', { class: 'card-grid' });
  const list = h('ul', { class: 'deck-cards' });
  const msg = h('p', { class: 'muted', role: 'note' });
  const save = h('button', { class: 'btn accent', type: 'button', onClick: () => {
    const v = validateDeck(work.cards);
    if (!v.valid || !work.name.trim()) return;
    if (existing) { existing.name = work.name.trim(); existing.cards = [...work.cards]; }
    else profile.decks.push({ id: 'deck-' + Date.now().toString(36), name: work.name.trim(), cards: [...work.cards] });
    saveProfile(); nav.go('decks');
  } }, 'Save Deck');
  const countOf = (cid) => work.cards.filter((x) => x === cid).length;
  const fb = filterBar(drawPool);
  function drawPool() {
    pool.replaceChildren(...cards.filter((c) => (profile.collection[c.id] || 0) > 0 && fb.match(c)).map((c) => {
      const n = countOf(c.id);
      const max = Math.min(c.rarity === 'legendary' ? 1 : 2, profile.collection[c.id] || 0);
      return h('div', { class: 'coll-card', 'data-card': c.id },
        cardFace(c), h('span', { class: 'count' }, `${n}/${max}`),
        h('button', { class: 'btn small add', type: 'button', disabled: work.cards.length >= 30 || n >= max, onClick: () => { work.cards.push(c.id); refresh(); } }, `Add ${c.name}`));
    }));
  }
  function refresh() {
    size.textContent = `${work.cards.length}/30`;
    const uniq = [...new Set(work.cards)].sort((a, b) => totalCost(cardById[a]) - totalCost(cardById[b]));
    list.replaceChildren(...uniq.map((cid) => {
      const c = cardById[cid];
      return h('li', {}, h('span', { class: `dot f-${c.faction}` }), h('span', { class: 'dl-name' }, `${c.name} ×${countOf(cid)}`),
        h('span', { class: 'dl-cost' }, costText(c.cost)),
        h('button', { class: 'btn small', type: 'button', onClick: () => { work.cards.splice(work.cards.lastIndexOf(cid), 1); refresh(); } }, `Remove ${c.name}`));
    }));
    const v = validateDeck(work.cards);
    save.disabled = !(v.valid && work.name.trim());
    msg.textContent = work.cards.length < 30 ? `Add ${30 - work.cards.length} more card${work.cards.length === 29 ? '' : 's'}.` : v.valid ? 'Ready to save!' : v.errors[0];
    drawPool();
  }
  const root = h('main', { class: 'screen' },
    h('header', { class: 'screen-head' }, h('h1', {}, 'Deck Builder')),
    h('div', { class: 'panel' },
      h('div', { class: 'field' }, h('label', { for: 'deck-name', class: 'lbl' }, 'Deck name'), nameInput),
      h('div', { class: 'row' }, size, msg),
      h('div', { class: 'row' }, save, btn('Cancel', () => nav.go('decks'), ''))),
    h('h2', {}, 'Your deck'), list,
    h('h2', {}, 'Your cards'), fb.el, pool);
  refresh();
  return root;
}

const shop = (nav) => {
  const area = h('div', { class: 'pack-area', 'aria-live': 'polite' });
  const gold = goldBadge();
  const buy = h('button', { class: 'btn big accent', type: 'button', onClick: () => {
    if (profile.gold < 50) return;
    profile.gold -= 50;
    const ids = openPack();
    addToCollection(ids);
    saveProfile();
    sfx('gather');
    gold.textContent = `🪙 ${profile.gold}`;
    buy.disabled = profile.gold < 50;
    area.replaceChildren();
    const slots = ids.map((id, i) => {
      const slot = h('button', { class: 'pack-slot', type: 'button', 'aria-label': `Reveal card ${i + 1}` }, h('span', { class: 'back' }, '❓'));
      const flip = () => {
        if (slot.dataset.testid) return;
        slot.dataset.testid = 'pack-card';
        slot.dataset.card = id;
        slot.classList.add('flipped');
        slot.setAttribute('aria-label', cardById[id].name);
        slot.replaceChildren(cardFace(cardById[id]));
        sfx('tap');
      };
      slot.addEventListener('click', flip);
      slot._flip = flip;
      return slot;
    });
    area.append(h('div', { class: 'pack-row' }, slots), btn('Reveal All', () => slots.forEach((s) => s._flip()), ''));
  } }, 'Buy Booster Pack (50 gold)');
  buy.disabled = profile.gold < 50;
  return screen('Shop', nav, gold,
    h('p', { class: 'muted' }, 'A pack holds 5 random cards, at least one Rare or better. Win matches to earn gold!'), buy, area);
};

const STEPS = [
  ['The Board', '🏰', 'The battlefield is a 7 × 7 grid. Your Stronghold is at the bottom, the enemy\'s at the top. Three resource sites sit across the middle row: 🌲 Forest, 💎 Crystal Mine and ⛏️ Iron Mine. Striped tiles touch two sites.', ['🏰', '🌲', '💎', '⛏️', '🏰']],
  ['Resources', '🪙', 'You need 🌲 Wood, 💎 Crystal and ⛏️ Iron. Your Stronghold gives +1 of each every turn. Creatures standing next to a site can Gather more. Sites run dry, so be quick!', ['🌲', '💎', '⛏️']],
  ['Playing Cards', '🃏', 'Each turn you draw a card. Tap a card in your hand, then tap a glowing tile in your two home rows to summon it. New creatures can\'t act on the turn they arrive.', ['🃏', '👆', '🐿️']],
  ['Actions', '👟', 'Each creature gets one action a turn: Move, Attack, Gather, Build or Turn. Tap a creature to see where it can go (blue) and what it can hit (red). Then press End Turn.', ['👟', '⚔️', '⛏️', '🔨', '🔄']],
  ['Combat', '⚔️', 'If the attacker\'s ⚔️ Attack is at least the defender\'s 🛡️ Defense, the defender is knocked out. Arrows show who you can hit. Hit from a side with no arrow and nobody strikes back! Iron beats Wood, Wood beats Crystal, Crystal beats Iron (+1).', ['🗡️', '➡️', '🐢']],
  ['Building', '🪵', 'Spend Wood to build Palisades (walls) and Ballistas next to your creatures. Palisades block paths and shots. Upgrade them with Iron, Crystal and Gold, and use Ballistas to break walls.', ['🪵', '⛓️', '🏹']],
  ['Winning', '🏆', 'Win by knocking the enemy Stronghold down to 0 hearts, or by being first to bank enough of every resource at the start of your turn. Win matches to earn gold for booster packs!', ['❤️', '🏆', '📦']],
];
const howto = (nav) => {
  let i = 0;
  const body = h('div', { class: 'tutorial' });
  const draw = () => {
    const [title, icon, text, art] = STEPS[i];
    body.replaceChildren(
      h('div', { class: 'step-art', 'aria-hidden': 'true' }, art.map((a) => h('span', {}, a))),
      h('h2', {}, title), h('p', {}, text),
      h('p', { class: 'step-count' }, `Step ${i + 1} of ${STEPS.length}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', disabled: i === 0, onClick: () => { i--; draw(); } }, 'Previous'),
        h('button', { class: 'btn', type: 'button', disabled: i === STEPS.length - 1, onClick: () => { i++; draw(); } }, 'Next')),
      i === STEPS.length - 1 ? btn('Start Tutorial Match', () => nav.go('match', { deckKey: 'wildwood', mode: 'quick', difficulty: 'easy', tutorial: true }), 'big accent') : null);
    void icon;
  };
  draw();
  return screen('How to Play', nav, body);
};

const settings = (nav) => {
  const mkCheck = (id, label, key) => h('div', { class: 'check' },
    h('input', { type: 'checkbox', id, checked: profile[key], onChange: (e) => { profile[key] = e.target.checked; saveProfile(); unlockAudio(); syncMusic(); } }),
    h('label', { for: id }, label));
  const confirmBox = h('div', { class: 'confirm', hidden: true, role: 'alertdialog', 'aria-label': 'Confirm reset' },
    h('p', {}, 'Reset all progress? Gold, collection, decks and the saved match will be lost.'),
    h('div', { class: 'row' },
      btn('Yes, reset', () => { resetProgress(); nav.go('settings'); }, 'danger'),
      btn('Cancel', () => { confirmBox.hidden = true; }, '')));
  return screen('Settings', nav,
    h('div', { class: 'panel' },
      mkCheck('set-sound', 'Sound', 'sound'), mkCheck('set-music', 'Music', 'music'),
      btn('Reset Progress', () => { confirmBox.hidden = false; }, 'danger'), confirmBox));
};

export const screens = { menu, play, collection, decks, shop, howto, settings };
export { goldReward, MODES, STARTER_NAMES, starterDecks };

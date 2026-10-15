import { Game } from '../game';
import { CARDS, COMMANDERS, FACTIONS, CONFIG, ABILITIES, creatureCost, spellCost, hasMovesLeft, incomePreview, readyMinersAt, junkBonus, maxMove, isActed, mineTargets, funds, respondNeeds, sitesControlled, isMiner, other } from '../engine';
import tutorialJson from '../content/tutorial.json';
import { showDecks, loadDecks, deckLegal } from './decks';
import { deckProblems, previewAttack } from '../engine';
import { createBoardView, createFlatView, BoardView } from './scene';

type El = HTMLElement;
const SYM: Record<string, string> = { skull: '💀', gear: '⚙️', hammer: '🔨' };
const FSYM = (f: string) => SYM[FACTIONS[f]?.symbol] || '✦';
const PHASE: Record<string, string> = { deploy: 'Deploy', action: 'Action', mulligan: 'Mulligan', draw: 'Draw', end: 'End', over: 'Over' };
const ACTIVE = ['deploy', 'action'];
const BW: number = CONFIG.boardWidth, BH: number = CONFIG.boardHeight;
const SH = { player: { row: CONFIG.strongholds.player[0], col: CONFIG.strongholds.player[1] }, opponent: { row: CONFIG.strongholds.opponent[0], col: CONFIG.strongholds.opponent[1] } };
const shortName = (id: string) => id.toUpperCase();
/** Font scale (in card-widths) that fits `len` characters of ability text in a card's text box. */
const textScale = (len: number) => Math.min(0.1, 0.6 / Math.sqrt(Math.max(1, len)));
/** Full card face (cost, name, art symbol, stats, complete ability text). */
function faceKids(c: any, cost?: number): El[] {
  const tf = textScale((c.text || '').length);
  const kids: (El | null)[] = [
    h('span', { class: 'cost', 'aria-hidden': 'true' }, c.type === 'crystal' ? '◆' : String(cost ?? c.cost)),
    h('span', { class: 'nm', 'aria-hidden': 'true' }, c.name),
    h('span', { class: 'ty', 'aria-hidden': 'true' }, c.type === 'creature' ? FSYM(c.faction) : c.type === 'spell' ? (c.spellKind === 'regular' ? '✨' : '⚡') : '💎'),
    h('span', { class: 'st', 'aria-hidden': 'true' }, c.type === 'creature' ? `${roleBadge(c)} ⚔️${c.attack}${c.abilities?.includes('ranged') ? '🏹' : ''} ❤️${c.health}` : c.rarity),
    h('span', { class: 'tx', style: `--tf:${tf.toFixed(4)}` }, c.text || ''),
  ];
  return kids.filter(Boolean) as El[];
}
const roleBadge = (c: any) => (c.role === 'Smith' ? '⚒️' : isMiner(c) ? '⛏️' : '⚔️');
const COLOR_HEX: Record<string, string> = { green: '#3ee06a', blue: '#3fa9ff', purple: '#b45cff', white: '#f2f6ff' };

export function h(tag: string, attrs: Record<string, any> = {}, ...kids: (string | Node | null | undefined)[]): El {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids) if (k != null) e.append(k instanceof Node ? k : document.createTextNode(k));
  return e;
}
export const btn = (label: string, cls = '', onclick?: (e: Event) => void, attrs: Record<string, any> = {}) => h('button', { type: 'button', class: 'btn ' + cls, onclick, ...attrs }, label);

export class App {
  root: El;
  game: Game;
  test: boolean;
  seed?: number;
  view: BoardView | null = null;
  unsub: (() => void) | null = null;
  timerId: any = null;
  // match refs
  r: any = {};
  deadline = 0;
  phaseKey = '';
  endShown = false;
  respondTimer: any = null;
  pick: { cells: { row: number; col: number }[]; done: (c: { row: number; col: number }) => void } | null = null;
  handScroll = 0;
  lastOptions: any = {};
  lastTutorial = false;
  handKey = '';
  tokens = new Map<string, El>();
  dialogCard = '';
  respStart = 0;
  respSig = '';
  lastTap = { uid: '', t: 0 };
  tapTimer: any = null;
  dialogs: El[] = [];

  constructor(root: El, game: Game, test: boolean, seed?: number) {
    this.root = root;
    this.game = game;
    this.test = test;
    this.seed = seed;
    if (test) document.body.classList.add('test');
  }

  // ------------------------------------------------------------ graphics setting
  get low() { return localStorage.getItem('oreheart.graphics') === 'low'; }
  gfxLabel() { return 'Graphics: ' + (this.low ? 'Low' : 'High'); }
  gfxButton(): El {
    const b = btn(this.gfxLabel(), '', () => {
      localStorage.setItem('oreheart.graphics', this.low ? 'high' : 'low');
      b.textContent = this.gfxLabel();
    });
    return b;
  }

  revealButton(): El {
    const label = () => 'Card reveals: ' + (localStorage.getItem('oreheart.reveal') === 'fast' ? 'Fast' : 'Normal');
    const b = btn(label(), '', () => {
      localStorage.setItem('oreheart.reveal', localStorage.getItem('oreheart.reveal') === 'fast' ? 'normal' : 'fast');
      b.textContent = label();
    });
    return b;
  }

  remindButton(): El {
    const label = () => 'Moves reminder: ' + (this.remindMoves ? 'On' : 'Off');
    const b = btn(label(), '', () => {
      localStorage.setItem('oreheart.movesReminder', this.remindMoves ? 'off' : 'on');
      b.textContent = label();
    });
    return b;
  }

  clear() {
    this.teardownMatch();
    this.root.replaceChildren();
    this.dialogs = [];
  }

  // ------------------------------------------------------------ simple screens
  showMenu() {
    this.clear();
    const s = h('main', { class: 'screen center' },
      h('h1', { class: 'title' }, 'Oreheart'),
      h('p', { class: 'tagline' }, 'Goblins, Gnomes and Dwarves fight over the Soul Crystals.'),
      h('nav', { class: 'stack menu-grid', 'aria-label': 'Main menu' },
        btn('Play', 'primary', () => this.showSetup()),
        btn('Tutorial', '', () => this.beginTutorial()),
        btn('Decks', '', () => showDecks(this)),
        btn('Rules', '', () => this.showRules()),
        btn('Settings', '', () => this.showSettings())));
    this.root.append(s);
    if (!this.test && !localStorage.getItem('oreheart.tutorialSeen')) {
      const d: any = this.dialog('Welcome to Oreheart!', [h('h2', {}, 'Welcome to Oreheart!'),
        h('p', { style: 'text-align:center;margin:0' }, 'New here? A short guided match teaches you the basics.'),
        h('div', { class: 'row' },
          btn('Start Tutorial', 'primary', () => { localStorage.setItem('oreheart.tutorialSeen', '1'); d.close(); this.beginTutorial(); }),
          btn('Skip', '', () => { localStorage.setItem('oreheart.tutorialSeen', '1'); d.close(); }))]);
      d.el.dataset.sticky = '1';
    }
  }

  showSettings() {
    this.clear();
    this.root.append(h('main', { class: 'screen center' },
      h('h1', { class: 'section cinzel' }, 'Settings'),
      h('div', { class: 'stack' }, this.gfxButton(), this.remindButton(), this.revealButton(), btn('Back', '', () => this.showMenu()))));
  }

  showSetup() {
    this.clear();
    let picks: any = {};
    try { picks = JSON.parse(localStorage.getItem('oreheart.picks') || '{}') || {}; } catch { picks = {}; }
    const cmds = (Object.values(COMMANDERS) as any[]).filter((x) => x.playable !== false);
    let cmd = cmds.some((c) => c.id === picks.cmd) ? picks.cmd : 'grubnak';
    let diff = ['easy', 'normal', 'hard'].includes(picks.diff) ? picks.diff : 'normal';
    const decks = loadDecks();
    // deck index: -1 = starter deck
    let deckIx = typeof picks.deck === 'string' && picks.deck !== '' ? decks.findIndex((d) => d.name === picks.deck && deckLegal(d)) : -1;
    const cmdBtns: El[] = [], diffBtns: El[] = [], stacks: El[] = [];
    const msg = h('p', { class: 'deck-msg', 'aria-label': 'Deck message', role: 'status' });
    const sel = () => {
      cmdBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === cmd)));
      diffBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === diff)));
      stacks.forEach((b) => b.setAttribute('aria-pressed', String(+(b.dataset.ix as string) === deckIx)));
    };
    for (const c of cmds) {
      const f = FACTIONS[c.faction];
      cmdBtns.push(h('button', { type: 'button', class: `cmd-card f-${c.faction}`, 'data-id': c.id, 'aria-label': c.name, onclick: () => { cmd = c.id; sel(); } },
        h('span', { class: 'portrait', 'aria-hidden': 'true' }, FSYM(c.faction)),
        h('span', { class: 'nm' }, c.name),
        h('span', { class: 'fa' }, `${f.name} · ${f.faith}`),
        h('span', { class: 'ds' }, c.abilityText)));
    }
    for (const d of ['easy', 'normal', 'hard']) diffBtns.push(btn(d[0].toUpperCase() + d.slice(1), 'diff', () => { diff = d; sel(); }, { 'data-id': d }));
    const stack = (label: string, n: number, ok: boolean, ix: number, onpick: () => void) => {
      const b = h('button', { type: 'button', class: `dstack${ok ? '' : ' bad'}`, 'data-ix': String(ix), 'aria-label': `${label}, ${n} cards, ${ok ? 'ready' : 'not ready'}`, 'aria-disabled': ok ? null : 'true', onclick: onpick },
        h('span', { class: 'ds-name', 'aria-hidden': 'true' }, label), h('span', { class: 'ds-n', 'aria-hidden': 'true' }, `${n} cards ${ok ? '✔' : '⚠'}`));
      stacks.push(b);
      return b;
    };
    const row = h('div', { class: 'deck-row', 'aria-label': 'Deck choice', role: 'group' });
    row.append(stack('Starter deck', CONFIG.deckSize, true, -1, () => { deckIx = -1; msg.textContent = ''; sel(); }));
    decks.forEach((d, i) => {
      const ok = deckLegal(d);
      row.append(stack(d.name, d.cards.length, ok, i, () => {
        if (!ok) { msg.textContent = deckProblems(d.cards.filter((id) => CARDS[id]))[0] || 'This deck is not ready.'; return; }
        deckIx = i; msg.textContent = ''; sel();
      }));
    });
    row.append(h('button', { type: 'button', class: 'dstack newdeck', onclick: () => showDecks(this) }, '+ New Deck'));
    sel();
    const scroll = (dir: number) => row.scrollBy({ left: dir * 220, behavior: 'smooth' });
    this.root.append(h('main', { class: 'screen setup' },
      h('h1', { class: 'section cinzel' }, 'Choose Your Commander'),
      h('div', { class: 'cmds' }, ...cmdBtns),
      h('div', { class: 'deck-wrap' },
        btn('◀', 'small scroll', () => scroll(-1), { 'aria-label': 'Scroll decks left' }), row,
        btn('▶', 'small scroll', () => scroll(1), { 'aria-label': 'Scroll decks right' })),
      msg,
      h('div', { class: 'row setup-actions' },
        h('div', { class: 'row', role: 'group', 'aria-label': 'Difficulty' }, ...diffBtns),
        btn('Fight!', 'primary', () => {
          const others = Object.keys(COMMANDERS).filter((k) => k !== cmd && COMMANDERS[k].playable !== false);
          const opp = others[Math.floor(Math.random() * others.length)];
          const pick = deckIx < 0 ? null : decks[deckIx];
          try { localStorage.setItem('oreheart.picks', JSON.stringify({ cmd, diff, deck: pick ? pick.name : '' })); } catch { /* storage unavailable */ }
          this.beginMatch({ playerCommander: cmd, opponentCommander: opp, difficulty: diff, ...(pick ? { playerDeck: pick.cards.slice() } : {}) });
        }),
        btn('Back', '', () => this.showMenu()))));
  }

  showRules() {
    this.clear();
    const svg = (label: string, body: string) => {
      const d = document.createElement('div');
      d.innerHTML = `<svg role="img" aria-label="${label}" viewBox="0 0 240 110" width="240" height="110" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
      return d.firstElementChild as El;
    };
    const board = svg('Picture of the board: enemy Stronghold at the top, three crystal sites in the middle, your Stronghold at the bottom',
      '<rect width="240" height="110" rx="10" fill="#4b3b2b"/><rect x="100" y="6" width="40" height="18" rx="4" fill="#77706a"/><text x="120" y="19" font-size="10" fill="#f4e9d0" text-anchor="middle">Enemy</text>' +
      '<polygon points="50,46 60,56 50,70 40,56" fill="#3ee06a"/><polygon points="120,46 130,56 120,70 110,56" fill="#f2f6ff"/><polygon points="190,46 200,56 190,70 180,56" fill="#b45cff"/>' +
      '<rect x="100" y="88" width="40" height="18" rx="4" fill="#77706a"/><text x="120" y="101" font-size="10" fill="#f4e9d0" text-anchor="middle">You</text>');
    const crystals = svg('Picture of three crystals: green for Goblins, blue for Gnomes, purple for Dwarves',
      '<rect width="240" height="110" rx="10" fill="#26232f"/><polygon points="40,20 65,55 40,95 15,55" fill="#3ee06a"/><polygon points="120,20 145,55 120,95 95,55" fill="#3fa9ff"/><polygon points="200,20 225,55 200,95 175,55" fill="#b45cff"/>' +
      '<text x="40" y="106" font-size="9" fill="#f4e9d0" text-anchor="middle">Goblins</text><text x="120" y="106" font-size="9" fill="#f4e9d0" text-anchor="middle">Gnomes</text><text x="200" y="106" font-size="9" fill="#f4e9d0" text-anchor="middle">Dwarves</text>');
    const combat = svg('Picture of type advantage: Dwarves beat Goblins, Goblins beat Gnomes, Gnomes beat Dwarves',
      '<rect width="240" height="110" rx="10" fill="#26232f"/><text x="120" y="30" font-size="16" fill="#f4e9d0" text-anchor="middle">🔨 → 💀 → ⚙️ → 🔨</text><text x="120" y="62" font-size="11" fill="#e3b54a" text-anchor="middle">+1 Attack on a type advantage</text><text x="120" y="86" font-size="11" fill="#f4e9d0" text-anchor="middle">Dwarves › Goblins › Gnomes › Dwarves</text>');
    const sec = (t: string, ...k: (string | El)[]) => h('section', {}, h('h2', {}, t), ...k.map((x) => (typeof x === 'string' ? h('p', {}, x) : x)));
    const s = h('main', { class: 'screen howto' },
      h('h1', { class: 'section cinzel' }, 'Rules'),
      sec('Goal', 'Bring the enemy Commander from 20 Health to 0 and they flee the battlefield. Commanders never die, they retreat! A Commander never heals by itself, so damage to them lasts.'),
      sec('The Board', 'A hidden grid 13 spaces wide and 7 deep. The enemy is at the top, you are at the bottom. Summon creatures on your back row (the row next to your Stronghold). Only when your back row is full can you summon on the row in front of it. Three crystal mines sit in the middle rows, in a different place every match (mirrored between the two halves).', board),
      sec('Decks and auto-skip', 'The Decks screen on the main menu is a testing deck builder: every card is unlocked and you can save up to 5 decks of 50 cards (Rare, Ultra Rare and Collector cards max 3 copies, at most 10 Crystal cards). Pick a saved deck or the starter deck before a match. Your Deploy phase ends by itself when no card in your hand can be both paid for and placed, and your Action phase ends by itself when no creature can move, attack or mine.', crystals),
      sec('Crystals', 'There is only one kind of crystal: soul crystals. You have two counters. Flow is what you mined: on your turn drag a creature standing next to a mine onto the mine (only the 8 spaces touching a mine can mine it). Mining is the creature\'s action for the turn: a Miner mines 2 crystals, a Fighter 1. At the start of your next turn your Flow is SET to what you mined (it is not added) and never holds more than 16. Bank holds crystals from Crystal cards: it never resets and has no limit. Flow is spent first, then Bank. The side with more creatures that mined a mine owns it; a tie is neutral. Mining at an enemy-owned mine pays only half, rounded down (Miner 1, Fighter 0). Tapping a pulsing mine (it shows ⛏️ and a number) makes every ready Miner next to it mine at once; Fighters never join in, so drag them onto the mine yourself. Press and hold (or hover) a mine to see its info. You start with 0 crystals. If you own no mine while the enemy owns one you get 2 bonus crystals. The plus-N-next-turn counter shows your coming Flow, and holding a mine shows who owns it and what it pays.', crystals),
      sec('Your Turn', 'Deploy: drag cards onto the board to summon creatures or cast spells, and play Crystal cards (one per round, also at Instant speed while you respond). Every card you play is shown big in the middle of the screen for a moment first (change the speed in Settings; tap to skip). Miner upgrades: a basic Miner card played onto one of your own creatures gives it a permanent +1 Health; a Scrapsmith, Arcsmith or Anvilsworn Smith Miner gives +1 Attack and +1 Health (no limit). Played onto an empty back-row space they are summoned as Miners. Miners can move or mine, but not attack, the turn they are summoned. Action: each creature either moves OR attacks OR mines, never more than one (Charge creatures can do both). Drag a creature onto one of your own creatures to swap places. Press Done to end a phase; phases with nothing left to do are skipped.'),
      sec('Combat', 'Melee fights are simultaneous: both creatures hit each other at the same moment, so the defender strikes back even if it is defeated. Dwarves beat Goblins, Goblins beat Gnomes and Gnomes beat Dwarves for +1 Attack. Ranged creatures hit any enemy within 2 spaces in any direction, even over other creatures, and get no strike back. Shield 1 blocks the next 1 damage. A creature that hits the Commander removes exactly its Attack. Damaged creatures show their Health in red.', combat),
      sec('Savings', 'If you end your own turn with 10 or more unspent Flow, every 10 Flow (rounded down) moves into your Bank as 1 banked crystal. Spells, Instants and Crystal cards never count as moves, so a turn with nothing else to do passes by itself.'),
      sec('Spells & Instants', 'Spells are cast by your Commander using crystals (Flow first, then Bank). Commanders never attack. Instants can answer the enemy during a "Respond?" window that lasts 12 seconds. It opens whenever you hold a matching Instant, even if you cannot pay for it yet: you can play a Crystal card on its own or together with a counterspell to pay for it. Counterspells cancel spells or summons.'),
      h('div', { class: 'stack', style: 'margin:10px 0 20px' }, btn('Back', '', () => this.showMenu())));
    this.root.append(s);
  }

  // ------------------------------------------------------------ dialogs
  dialog(name: string, content: (El | string)[], onClose?: () => void): { close: () => void; el: El } {
    const dlg = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': name }, ...content);
    const ov = h('div', { class: 'overlay' }, dlg);
    // on plain screens (no match) the page behind a dialog is hidden from assistive tech, so only the dialog's buttons are found
    const host = this.root.querySelector('.match') || this.root;
    const behind = host === this.root ? ([...this.root.children] as El[]).filter((x) => !x.classList.contains('overlay') && x.getAttribute('aria-hidden') !== 'true') : [];
    behind.forEach((x) => x.setAttribute('aria-hidden', 'true'));
    const close = () => { ov.remove(); behind.forEach((x) => x.removeAttribute('aria-hidden')); this.dialogs = this.dialogs.filter((d) => d !== ov); onClose && onClose(); };
    ov.addEventListener('pointerdown', (e: any) => { if (e.target === ov && !ov.dataset.sticky) close(); });
    ov.addEventListener('keydown', (e: any) => { if (e.key === 'Escape' && !ov.dataset.sticky) close(); });
    (this.root.querySelector('.match') || this.root).append(ov);
    this.dialogs.push(ov);
    const first = dlg.querySelector('button') as HTMLElement | null;
    first && first.focus({ preventScroll: true });
    return { close, el: ov };
  }

  showCard(cardId: string, creature?: any) {
    const c = CARDS[cardId];
    const rows: [string, string][] = [];
    rows.push(['Type', c.type === 'creature' ? `${FSYM(c.faction)} ${FACTIONS[c.faction].name} creature` : c.type === 'spell' ? ({ regular: 'Spell', instant: 'Instant', counter: 'Counterspell' } as any)[c.spellKind] : 'Crystal card']);
    rows.push(['Rarity', c.rarity]);
    const me = this.game.state?.players.player;
    const cost = c.type === 'creature' ? (me ? creatureCost(this.game.state, 'player', c) : c.cost) : c.type === 'spell' ? (me ? spellCost(this.game.state, 'player', c) : c.cost) : 0;
    rows.push(['Cost', c.type === 'crystal' ? 'Free' : `${cost}${cost !== c.cost ? ` (printed ${c.cost})` : ''}`]);
    if (c.type === 'creature') {
      rows.push(['Attack', String(creature ? creature.attack : c.attack)]);
      rows.push(['Health', creature ? `${creature.health}/${creature.maxHealth}` : String(c.health)]);
      rows.push(['Movement', String(c.move)]);
      rows.push(['Role', `${roleBadge(c)} ${c.role === 'Smith' ? 'Smith Miner' : isMiner(c) ? 'Miner' : 'Fighter'}`]);
      if (creature && creature.upgrades.attack + creature.upgrades.health) rows.push(['Miner upgrades', `+${creature.upgrades.attack} Attack, +${creature.upgrades.health} Health`]);
    }
    const dl = h('dl', {});
    for (const [k, v] of rows) dl.append(h('dt', {}, k), h('dd', {}, v));
    const ab = c.type === 'creature' ? (c.abilities || []).map((a: string) => `${ABILITIES[a].name}: ${ABILITIES[a].text}`).join(' ') : c.text;
    void ab;
    const d = this.dialog(c.name, [h('div', { class: 'card-view' }, h('div', { class: 'cv-name' }, c.name), dl, h('p', { class: 'tx' }, c.text || ''),
      h('div', { class: 'row' }, btn('Close', 'primary', () => d.close())))]);
  }

  // ------------------------------------------------------------ match
  beginMatch(options: any = {}) {
    const o = { ...options };
    if (o.seed == null && this.test && this.seed != null) o.seed = this.seed;
    this.lastOptions = options;
    this.lastTutorial = false;
    const state = this.game.newMatch(o);
    this.showMatch();
    this.update(this.game.state, []);
    return state;
  }

  beginTutorial() {
    this.lastTutorial = true;
    const state = this.game.startTutorial();
    this.showMatch();
    this.update(this.game.state, []);
    return state;
  }

  teardownMatch() {
    clearInterval(this.timerId);
    clearTimeout(this.respondTimer);
    this.unsub && this.unsub();
    this.unsub = null;
    this.view && this.view.dispose();
    this.view = null;
    this.tokens.clear();
    this.r = {};
    this.endShown = false;
    this.pick = null;
    this.phaseKey = '';
    this.handKey = '';
  }

  showMatch() {
    this.handKey = '';
    this.clear();
    const r = this.r;
    const fcol = FACTIONS[this.game.state.players.player.faction].crystal;
    r.crFlow = h('span', { class: 'cr flow ' + fcol, role: 'img', 'aria-label': 'Your Flow crystals' }, '⛏️ 0');
    r.crBank = h('span', { class: 'cr bank ' + fcol, role: 'img', 'aria-label': 'Your Bank crystals' }, '🏦 0');
    r.enemyHand = h('div', { class: 'enemy-hand', role: 'img', 'aria-label': 'Enemy hand' });
    r.enemyDeck = h('div', { class: 'pile', role: 'img', 'aria-label': 'Enemy deck' }, '0');
    r.enemyHealth = h('div', { class: 'heart theirs', role: 'img', 'aria-label': 'Enemy Commander health' }, '20');
    r.phase = h('div', { class: 'phase', role: 'status', 'aria-label': 'Current phase' });
    r.phase.append(h('div', { class: 'ph-turn' }), h('div', { class: 'ph-name' }));
    r.timer = h('div', { class: 'countdown', role: 'timer', 'aria-label': 'Phase timer', hidden: true }, '10');
    r.board = h('div', { class: 'board', role: 'application', 'aria-label': 'Battlefield' });
    r.fx = h('div', { class: 'fx' });
    r.myHealth = h('div', { class: 'heart mine', role: 'img', 'aria-label': 'Your Commander health' }, '20');
    r.myDeck = h('div', { class: 'pile', role: 'img', 'aria-label': 'Your deck' }, '0');
    r.income = h('div', { class: 'income', 'aria-label': 'Your income next turn' }, '+0 next turn');
    r.done = btn('Done', 'primary done-btn', () => this.pressDone());
    r.swap = btn('Swap for a Miner', 'swap-btn', () => this.startSwap());
    r.swap.hidden = true;
    r.hand = h('div', { class: 'hand', role: 'group', 'aria-label': 'Your hand' });
    const menuBtn = btn('Menu', 'menu-btn', () => this.showMatchMenu());
    r.last = btn('Last turn', 'last-btn', () => this.showLastTurn());
    r.tip = h('aside', { class: 'tip', 'aria-label': 'Tutorial tip', hidden: true });
    const crystals = h('div', { class: 'crystals' }, r.crFlow, r.crBank);
    const match = h('main', { class: 'match' },
      r.board,
      h('div', { class: 'hud hud-left' }, crystals, r.income,
        r.swap),
      h('div', { class: 'hud hud-top' }, r.enemyHand),
      r.enemyDeck, r.last, r.myDeck,
      r.phase,
      h('div', { class: 'hud hud-right' }, r.done, menuBtn),
      r.tip, r.hand, r.timer);
    this.root.append(match);
    // board layers
    r.cells = new Map<string, El>();
    r.sites = [];
    r.rings = [];
    r.flows = [];
    r.view = null;
    try { this.view = createBoardView(r.board, this.low); } catch { this.view = null; }
    if (!this.view) this.view = createFlatView(r.board);
    for (let row = 1; row <= BH; row++) for (let col = 1; col <= BW; col++) {
      const c = h('div', { class: 'cell', 'data-row': row, 'data-col': col });
      r.cells.set(row + ',' + col, c);
      r.board.append(c);
    }
    (this.game.state.sites as any[]).forEach(({ row, col }, i) => {
      const ring = h('div', { class: 'mine-ring', 'aria-hidden': 'true' });
      ring.dataset.row = String(row); ring.dataset.col = String(col);
      const fl = h('div', { class: 'mine-flow', role: 'img', 'aria-label': `Mine flow, row ${row}, column ${col}` }, '+0 / +0');
      fl.dataset.row = String(row); fl.dataset.col = String(col);
      r.rings.push(ring); r.flows.push(fl); r.board.append(ring, fl);
      const m = h('button', { type: 'button', class: 'site-mark', 'aria-label': `Crystal site, row ${row}, column ${col}`, onclick: () => this.tapSite(i) });
      m.dataset.row = String(row); m.dataset.col = String(col);
      m.dataset.readyMiners = '0';
      m.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.holdFired = false;
        clearTimeout(this.holdTimer);
        this.holdTimer = setTimeout(() => { this.holdFired = true; this.openSite(i, 'hold'); }, 500);
      });
      const endHold = () => clearTimeout(this.holdTimer);
      m.addEventListener('pointerup', endHold);
      m.addEventListener('pointercancel', endHold);
      m.addEventListener('pointerleave', endHold);
      m.addEventListener('pointerenter', (e: PointerEvent) => { if (e.pointerType === 'mouse') this.openSite(i, 'hover'); });
      m.addEventListener('pointerleave', (e: PointerEvent) => { if (e.pointerType === 'mouse' && this.siteTipMode === 'hover') this.closeSiteTip(); });
      r.sites.push(m); r.board.append(m);
    });
    r.strong = {} as any;
    for (const side of ['player', 'opponent']) {
      const s = h('div', { class: 'stronghold ' + side, role: 'img', 'aria-label': side === 'player' ? 'Your Stronghold' : 'Enemy Stronghold' }, '🏰');
      r.strong[side] = s; r.board.append(s);
    }
    r.board.append(r.enemyHealth, r.myHealth, r.fx);
    const ro = new ResizeObserver(() => this.layout());
    ro.observe(r.board);
    this.unsub = this.game.subscribe((st, ev) => this.update(st, ev));
    r.board.addEventListener('pointerdown', (e: PointerEvent) => this.boardPointerDown(e));
    r.hand.addEventListener('wheel', (e: WheelEvent) => { e.preventDefault(); this.handScroll += (e.deltaY || e.deltaX) / 80; this.layoutHand(); }, { passive: false });
    document.addEventListener('pointerdown', this.tuckOutside, true);
    window.addEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    window.addEventListener('keydown', this.onKey);
    clearInterval(this.timerId);
    this.timerId = setInterval(() => { this.tick(); this.pumpBanner(); }, 100);
    requestAnimationFrame(() => this.layout());
  }
  onResize = () => { this.layout(); };

  layout() {
    const r = this.r;
    if (!r.board || !this.view) return;
    this.view.resize();
    for (const [k, el] of r.cells as Map<string, El>) {
      const [row, col] = k.split(',').map(Number);
      this.place(el, row, col);
    }
    r.sites.forEach((m: El) => this.place(m, +m.dataset.row!, +m.dataset.col!));
    r.rings.forEach((m: El, i: number) => {
      const col = +m.dataset.col!, row = +m.dataset.row!;
      const a = this.view.cellRect(row - 1, col - 1), b = this.view.cellRect(row + 1, col + 1), c = this.view.cellRect(row - 1, col + 1), d = this.view.cellRect(row + 1, col - 1);
      const x0 = Math.min(a.x, d.x), x1 = Math.max(c.x + c.w, b.x + b.w), y0 = Math.min(a.y, c.y), y1 = Math.max(b.y + b.h, d.y + d.h);
      m.style.left = x0 + 'px'; m.style.top = y0 + 'px'; m.style.width = x1 - x0 + 'px'; m.style.height = y1 - y0 + 'px';
      const f = r.flows[i] as El;
      f.style.left = (x0 + x1) / 2 + 'px'; f.style.top = y0 + 'px';
    });
    this.place(r.strong.player, SH.player.row, SH.player.col);
    this.place(r.strong.opponent, SH.opponent.row, SH.opponent.col);
    for (const el of this.tokens.values()) this.place(el, +el.dataset.row!, +el.dataset.col!);
    this.fitHearts();
    this.layoutHand();
  }
  /** Heart on the Stronghold's wall facing the camera (bottom of its cell), shrunk so it never covers a creature label. */
  placeHeart(el: El, side: 'player' | 'opponent') {
    const sh = SH[side];
    const rc = this.view!.cellRect(sh.row, sh.col);
    const s = Math.max(20, Math.min(54, rc.w * 0.8, rc.h * 1.05));
    el.dataset.size = String(s);
    el.style.width = s + 'px'; el.style.height = s + 'px';
    el.style.left = rc.x + rc.w / 2 - s / 2 + 'px';
    el.style.top = rc.y + rc.h - s - 1 + 'px';
    el.style.fontSize = Math.max(10, s * 0.38) + 'px';
  }
  fitHearts() {
    const r = this.r;
    if (!r.board || !this.view || !r.myHealth) return;
    this.placeHeart(r.myHealth, 'player');
    this.placeHeart(r.enemyHealth, 'opponent');
    const labels = [...this.tokens.values()].map((t) => (t.querySelector('.tk-stats') as El).getBoundingClientRect());
    for (const el of [r.myHealth, r.enemyHealth] as El[]) {
      for (let i = 0; i < 12; i++) {
        const hb = el.getBoundingClientRect();
        if (!labels.some((l) => l.width && hb.left < l.right && hb.right > l.left && hb.top < l.bottom && hb.bottom > l.top)) break;
        const w = el.offsetWidth - 3;
        if (w < 12) break;
        el.style.width = el.style.height = w + 'px';
        el.style.left = el.offsetLeft + 1.5 + 'px';
        el.style.top = el.offsetTop + 3 + 'px';
      }
    }
  }
  place(el: El, row: number, col: number) {
    const rc = this.view!.cellRect(row, col);
    el.style.left = rc.x + 'px'; el.style.top = rc.y + 'px'; el.style.width = rc.w + 'px'; el.style.height = rc.h + 'px';
  }

  handTimer: any = null;
  /** The hand rests tucked half below the screen edge; hovering (or tapping on phones) slides it up. */
  openHand(on: boolean) {
    clearTimeout(this.handTimer);
    const hand = this.r.hand as El;
    if (!hand) return;
    if (on) hand.classList.add('open');
    else this.handTimer = setTimeout(() => hand.classList.remove('open'), 120);
  }

  /** Pop a hand card out of the fan at 2x size, kept fully on screen. */
  popCard(el: El, on: boolean) {
    if (!on) {
      el.classList.remove('popped');
      (this.r.hand as El)?.classList.remove('has-pop');
      el.style.transform = el.dataset.fan || '';
      el.style.zIndex = el.dataset.z || '';
      return;
    }
    if (el.classList.contains('dragging')) return;
    const host = this.root.querySelector('.match') as El;
    if (!host) return;
    el.dataset.fan = el.dataset.fan || el.style.transform;
    el.dataset.z = el.style.zIndex;
    const hr = host.getBoundingClientRect();
    const hand = this.r.hand as El;
    const hb = hand.getBoundingClientRect();
    const w = el.offsetWidth, hgt = el.offsetHeight;
    const left = hb.left + (parseFloat(el.style.left) || 0);
    const top = hb.top + (el.offsetTop || 0);
    // centre of the un-fanned card, scale 2 about the centre
    let dx = 0, dy = 0;
    const cx = left + w / 2, cy = top + hgt / 2;
    const minX = hr.left + w + 2, maxX = hr.right - w - 2;
    const targetX = Math.max(minX, Math.min(maxX, cx));
    dx = targetX - cx;
    const maxY = hr.bottom - hgt - 2, minY = hr.top + hgt + 2;
    const targetY = Math.max(minY > maxY ? maxY : minY, Math.min(maxY, cy));
    dy = targetY - cy;
    el.classList.add('popped');
    hand.classList.add('has-pop');
    el.style.zIndex = '600';
    el.style.transform = `translate(${dx}px,${dy}px) scale(2)`;
  }

  layoutHand() {
    const hand = this.r.hand as El;
    if (!hand) return;
    const cards = [...hand.querySelectorAll('.hand-card')] as El[];
    const n = cards.length;
    const W = hand.clientWidth || 800;
    const cw = cards[0]?.offsetWidth || 66;
    const spacing = n > 1 ? Math.max(cw * 0.58, Math.min(cw * 0.78, (W - cw * 1.4) / (n - 1))) : cw;
    const overflow = Math.max(0, (n - 1) * spacing - (W - cw * 1.4));
    const maxScroll = overflow / 2 / spacing;
    this.handScroll = Math.max(-maxScroll, Math.min(maxScroll, this.handScroll));
    cards.forEach((c, i) => {
      const off = i - (n - 1) / 2 - this.handScroll;
      const x = W / 2 + off * spacing - cw / 2;
      const t = (off * spacing) / (W / 2);
      const rot = Math.max(-6, Math.min(6, t * 12));
      const y = t * t * cw * 0.08;
      c.style.left = x + 'px';
      c.style.transform = `translateY(${y}px) rotate(${rot}deg)`;
      c.dataset.fan = c.style.transform;
      c.style.zIndex = String(i + 1);
      c.dataset.z = String(i + 1);
    });
  }

  update(st: any, events: any[]) {
    const r = this.r;
    if (!r.board || !st) return;
    const me = st.players.player, en = st.players.opponent;
    this.view && this.view.setState(st, events);
    this.record(st, events);
    this.setHeart(r.enemyHealth, en.health);
    this.setHeart(r.myHealth, me.health);
    r.enemyDeck.replaceChildren(String(en.deck.length));
    r.myDeck.textContent = String(me.deck.length);
    r.crFlow.textContent = `⛏️ ${me.crystals}`;
    r.crBank.textContent = `🏦 ${me.bank}`;
    const nxt = st.phase === 'mulligan' ? 0 : incomePreview(st, 'player');
    r.crFlow.dataset.flow = nxt ? `+${nxt}` : '';
    r.income.textContent = `+${st.phase === 'mulligan' ? 0 : incomePreview(st, 'player')} next turn`;
    // enemy hand arc
    const n = en.hand.length;
    r.enemyHand.replaceChildren();
    const shown = Math.min(n, 12);
    for (let i = 0; i < shown; i++) {
      const t = shown > 1 ? i / (shown - 1) - 0.5 : 0;
      const b = h('div', { class: 'back', 'aria-hidden': 'true' });
      b.style.transform = `rotate(${t * 70}deg)`;
      r.enemyHand.append(b);
    }
    r.enemyHand.append(h('span', { class: 'count' }, String(n)));
    // phase
    const whose = st.activePlayer === 'player' ? 'YOUR TURN' : 'ENEMY TURN';
    r.phase.dataset.side = st.activePlayer === 'player' ? 'you' : 'enemy';
    (r.phase.querySelector('.ph-turn') as El).textContent = st.phase === 'mulligan' ? 'MULLIGAN' : st.phase === 'over' ? 'MATCH OVER' : whose;
    (r.phase.querySelector('.ph-name') as El).textContent = st.phase === 'mulligan' || st.phase === 'over' ? '' : PHASE[st.phase];
    const key = `${st.turn}|${st.phase}|${st.priority}|${st.pendingResponse ? 1 : 0}`;
    if (key !== this.phaseKey) {
      const phaseChanged = !this.phaseKey || key.split('|').slice(0, 2).join() !== this.phaseKey.split('|').slice(0, 2).join();
      this.phaseKey = key;
      if (phaseChanged) {
        this.deadline = Date.now() + CONFIG.phaseTimerSeconds * 1000;
        this.testLeft = null;
        this.movesDlg && this.movesDlg.close();
        this.movesDlg = null;
        this.swapping = false;
        this.queueBanners(st);
      }
    }
    const mine = st.priority === 'player' && st.activePlayer === 'player' && ACTIVE.includes(st.phase) && !st.pendingResponse;
    r.done.disabled = !mine;
    const canSwap = mine && st.phase === 'deploy' && this.game.legalActions().some((a: any) => a.type === 'gathererSwap');
    r.swap.hidden = !canSwap;
    if (!canSwap) this.swapping = false;
    // board overlays
    this.renderTip(st);
    this.renderSites(st);
    this.renderTokens(st);
    this.renderHand(st);
    this.handleDialogs(st);
    this.animate(st, events);
    this.prevCreatures = st.board.creatures.map((c: any) => ({ uid: c.uid, cardId: c.cardId, row: c.row, col: c.col }));
    this.tick();
  }

  // ------------------------------------------------------------ enemy turn recap (R9.7)
  prevCreatures: any[] = [];
  enemyLog: { text: string; cardId: string; row: number; col: number }[] = [];
  recording = false;
  record(st: any, events: any[]) {
    if (events.some((e) => e.type === 'newMatch')) { this.enemyLog = []; this.recording = false; this.prevCreatures = []; return; }
    const find = (uid: string) => this.prevCreatures.find((c) => c.uid === uid) || st.board.creatures.find((c: any) => c.uid === uid);
    const swapMates = new Set(events.filter((e) => e.type === 'swap').map((e) => e.withUid));
    for (const e of events) {
      if (e.type === 'turnStart') {
        if (e.player === 'opponent') { this.enemyLog = []; this.recording = true; } else this.recording = false;
        continue;
      }
      if (!this.recording) continue;
      if (e.type === 'summon' && e.owner === 'opponent') this.enemyLog.push({ text: `Summoned ${CARDS[e.cardId].name}`, cardId: e.cardId, row: e.row, col: e.col });
      else if (e.type === 'move' && !swapMates.has(e.uid)) {
        const cr = st.board.creatures.find((c: any) => c.uid === e.uid);
        if (cr && cr.owner === 'opponent') this.enemyLog.push({ text: `Moved ${CARDS[cr.cardId].name}`, cardId: cr.cardId, row: e.to.row, col: e.to.col });
      } else if (e.type === 'attack') {
        const a = find(e.uid);
        if (!a || !this.prevCreatures.some((c) => c.uid === e.uid)) continue;
        const att = st.board.creatures.find((c: any) => c.uid === e.uid);
        if (att && att.owner === 'player') continue;
        let tn = 'your Commander', pos: any = SH.player;
        if (e.target.row) { const d = this.prevCreatures.find((c) => c.row === e.target.row && c.col === e.target.col); tn = d ? CARDS[d.cardId].name : 'a creature'; pos = e.target; }
        this.enemyLog.push({ text: `${CARDS[a.cardId].name} attacked ${tn}`, cardId: a.cardId, row: pos.row, col: pos.col });
      } else if (e.type === 'cast' && e.player === 'opponent') this.enemyLog.push({ text: `Cast ${CARDS[e.cardId].name}`, cardId: e.cardId, row: SH.opponent.row, col: SH.opponent.col });
      else if (e.type === 'playCrystal' && e.player === 'opponent') this.enemyLog.push({ text: `Played ${CARDS[e.cardId].name}`, cardId: e.cardId, row: SH.opponent.row, col: SH.opponent.col });
      else if (e.type === 'mine') {
        const cr = st.board.creatures.find((c: any) => c.uid === e.uid);
        if (cr && cr.owner === 'opponent') this.enemyLog.push({ text: `Mined +${e.amount}`, cardId: cr.cardId, row: e.row, col: e.col });
      }
    }
  }
  showLastTurn() {
    const lines = this.enemyLog.map((l) => {
      const c = CARDS[l.cardId];
      return h('li', {}, h('button', { type: 'button', class: 'recap-line', onclick: () => this.highlight(l.row, l.col) },
        h('span', { class: `mini f-${c?.faction}`, 'aria-hidden': 'true', 'data-sym': c?.type === 'creature' ? (isMiner(c) ? '⛏️' : '⚔️') : c?.type === 'spell' ? '✨' : '💎' }), l.text));
    });
    const d: any = this.dialog('Last turn', [h('h2', {}, 'Last turn'),
      lines.length ? h('ul', { class: 'recap' }, ...lines) : h('p', { style: 'text-align:center' }, 'Nothing yet.'),
      h('div', { class: 'row' }, btn('Close', 'primary', () => d.close()))]);
  }
  highlight(row: number, col: number) {
    const el = this.r.cells?.get(row + ',' + col) as El | undefined;
    if (!el) return;
    el.classList.add('recap-hl');
    setTimeout(() => el.classList.remove('recap-hl'), 1600);
  }


  setHeart(el: El, n: number) {
    el.textContent = String(n);
    el.dataset.low = String(n <= 7);
  }

  // ------------------------------------------------------------ banners
  bannerQ: string[] = [];
  bannerEl: El | null = null;
  bannerAt = 0;
  queueBanners(st: any) {
    if (st.phase !== 'deploy' && st.phase !== 'action') return;
    const skipped = this.game.autoSkip && !hasMovesLeft(st);
    if (st.activePlayer !== 'player') { if (st.phase === 'deploy') this.bannerQ.push('ENEMY TURN'); return; }
    if (st.phase === 'deploy') this.bannerQ.push('YOUR TURN');
    if (!skipped) this.bannerQ.push(st.phase === 'deploy' ? 'DEPLOY' : 'ACTION');
  }
  pumpBanner() {
    const r = this.r;
    if (!r.board) return;
    const now = Date.now();
    if (this.bannerEl) {
      const life = this.bannerQ.length ? 450 : 1500;
      if (now - this.bannerAt < life) return;
      this.bannerEl.remove();
      this.bannerEl = null;
    }
    if (!this.bannerQ.length) return;
    const blocked = this.dialogs.length > 0 || !(r.timer as El).hidden;
    if (blocked) return;
    const text = this.bannerQ.shift()!;
    this.bannerEl = h('div', { class: 'banner', role: 'status', 'aria-label': 'Phase banner' }, text);
    this.root.querySelector('.match')?.append(this.bannerEl);
    this.bannerAt = now;
  }

  // ------------------------------------------------------------ Done, Miner swap, site info
  movesDlg: { close: () => void } | null = null;
  swapping = false;
  get remindMoves() { return localStorage.getItem('oreheart.movesReminder') !== 'off'; }
  tuckOutside = (e: PointerEvent) => {
    const hand = this.r.hand as El | undefined;
    if (hand && e.pointerType !== 'mouse' && !hand.contains(e.target as Node)) { clearTimeout(this.handTimer); hand.classList.remove('open'); }
  };
  onKey = (_e: KeyboardEvent) => { /* no keyboard shortcuts */ };

  // ------------------------------------------------------------ callouts, reveals and spell effects
  revealSeconds() { return localStorage.getItem('oreheart.reveal') === 'fast' ? CONFIG.revealFastSeconds : CONFIG.revealSeconds; }
  callout(player: string, cardId: string) {
    if (!this.r.fx) return;
    const sh = SH[player as 'player' | 'opponent'];
    const p = this.center(sh.row, sh.col);
    const id = this.game.state.players[player].commanderId;
    const f = h('div', { class: 'callout ' + player, role: 'status' }, `${shortName(id)} CASTS ${CARDS[cardId].name.toUpperCase()}!`);
    f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 1700);
  }
  /** Big card in the middle of the screen, then it drops onto its space (or flies away). */
  reveal(cardId: string, at?: { row: number; col: number } | null) {
    if (this.test || !this.r.board) return;
    const c = CARDS[cardId];
    const secs = this.revealSeconds();
    const el = h('div', { class: `reveal hand-card static ${c.type} f-${c.faction}`, 'aria-hidden': 'true' }, ...faceKids(c));
    const host = this.root.querySelector('.match') as El;
    host.append(el);
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      let dx = 0, dy = 0;
      if (at && this.view) {
        const pc = this.center(at.row, at.col);
        const br = this.r.board.getBoundingClientRect(), hr = host.getBoundingClientRect(), er = el.getBoundingClientRect();
        dx = br.left - hr.left + pc.x - (er.left - hr.left + er.width / 2);
        dy = br.top - hr.top + pc.y - (er.top - hr.top + er.height / 2);
      }
      if (c.type === 'creature' && at && this.view) {
        // drop onto the space, flip, glow, then rise into the 3D creature with a dust puff
        const T = (x: number, y: number, sc: number, ry: number) => `translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) perspective(600px) rotateY(${ry}deg) scale(${sc})`;
        const gl = '0 0 40px #ffd45aaa,0 10px 30px #000', glow = '0 0 70px 22px #fff2a0,0 0 30px 10px #ffd45a';
        const dur = Math.min(1500, secs * 1000);
        const anim = el.animate([
          { transform: T(0, 0, 1, 0), opacity: 1, boxShadow: gl, offset: 0 },
          { transform: T(dx, dy, 0.42, 0), opacity: 1, boxShadow: gl, offset: 0.35 },
          { transform: T(dx, dy, 0.42, 180), opacity: 1, boxShadow: glow, offset: 0.6 },
          { transform: T(dx, dy, 0.42, 360), opacity: 1, boxShadow: glow, offset: 0.75 },
          { transform: T(dx, dy - 40, 0.18, 360), opacity: 0, boxShadow: glow, offset: 1 },
        ], { duration: dur, easing: 'ease-in-out', fill: 'forwards' });
        const puff = h('div', { class: 'dust-puff', 'aria-hidden': 'true' });
        const pc = this.center(at.row, at.col);
        puff.style.left = `${pc.x}px`; puff.style.top = `${pc.y}px`;
        setTimeout(() => this.r.board?.append(puff), dur * 0.8);
        setTimeout(() => puff.remove(), dur * 0.8 + 700);
        anim.onfinish = () => el.remove();
        return;
      }
      const anim = el.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.15)`, opacity: 0.2 }], { duration: Math.min(500, secs * 700), easing: 'ease-in', fill: 'forwards' });
      anim.onfinish = () => el.remove();
    };
    el.addEventListener('pointerdown', finish);
    setTimeout(finish, secs * 1000);
  }
  spellFx(e: any) {
    if (!this.r.fx || !this.view) return;
    const card = CARDS[e.cardId];
    const sh = SH[e.player as 'player' | 'opponent'];
    const t = e.target && e.target.row ? e.target : e.target && e.target.commander ? SH[e.target.commander as 'player' | 'opponent'] : null;
    const spawn = (cls: string, text: string, row: number, col: number, ms = 1100) => {
      const p = this.center(row, col);
      const f = h('div', { class: 'fx-' + cls, 'aria-hidden': 'true' }, text);
      f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
      this.r.fx.append(f);
      setTimeout(() => f.remove(), ms);
    };
    switch (card.effect) {
      case 'damage': if (t) { spawn('orb', '🔥', t.row, t.col, 900); spawn('boom', 'KA-BOOM!', t.row, t.col); } break;
      case 'areaDamage': if (t) {
        spawn('meteor', '☄️', t.row, t.col, 1000);
        this.r.board.classList.remove('shake'); void this.r.board.offsetWidth; this.r.board.classList.add('shake');
        setTimeout(() => this.r.board.classList.remove('shake'), 800);
      } break;
      case 'shield': if (t) spawn('bubble', '', t.row, t.col, 1400); break;
      case 'heal': case 'healCommander': if (t) spawn('beam', '✨', t.row, t.col, 1200); break;
      case 'buffAttack': { const f = h('div', { class: 'fx-redglow', 'aria-hidden': 'true' }); this.r.fx.append(f); setTimeout(() => f.remove(), 1300); break; }
      case 'gainCrystals': spawn('beam', '💎', sh.row, sh.col, 1200); break;
      default: spawn('beam', '✨', sh.row, sh.col, 1000);
    }
  }
  shatter(player: string) {
    const sh = SH[player === 'player' ? 'opponent' : 'player'];
    const p = this.center(sh.row, sh.col);
    for (let i = 0; i < 8; i++) {
      const f = h('div', { class: 'fx-shard', 'aria-hidden': 'true' });
      f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
      f.style.setProperty('--a', String(i * 45));
      this.r.fx.append(f);
      setTimeout(() => f.remove(), 1000);
    }
  }

  pressDone() {
    const st = this.game.state;
    if (!st || this.movesDlg) return;
    if (this.remindMoves && hasMovesLeft(st)) {
      const name = 'Moves still available! Continue to the next phase?';
      const miners = new Set(this.game.legalActions().filter((a: any) => a.type === 'mine').map((a: any) => a.creatureUid)).size;
      const d: any = this.dialog(name, [h('h2', {}, name),
        miners ? h('p', { class: 'miners-note', style: 'text-align:center;margin:0' }, miners === 1 ? "1 miner hasn't mined" : `${miners} miners haven't mined`) : null as any,
        h('div', { class: 'row' }, btn('Continue', 'primary', () => { d.close(); this.movesDlg = null; this.game.act({ type: 'done' }); }),
          btn('Go back', '', () => { d.close(); this.movesDlg = null; }))], () => { this.movesDlg = null; });
      this.movesDlg = d;
    } else this.game.act({ type: 'done' });
  }
  startSwap() {
    const acts = this.game.legalActions().filter((a: any) => a.type === 'gathererSwap');
    if (!acts.length) return;
    if (!acts[0].discardUid) { this.game.act(acts[0]); return; }
    this.swapping = true;
    this.flash('Tap the card you want to discard');
  }
  holdTimer: any = null;
  holdFired = false;
  siteTip: El | null = null;
  siteTipMode = '';
  closeSiteTip() { this.siteTip?.remove(); this.siteTip = null; this.siteTipMode = ''; }
  /** Tap a mine: all ready Miners next to it mine; with none ready it shows the info instead. */
  tapSite(i: number) {
    if (this.holdFired) { this.holdFired = false; return; }
    const m = this.r.sites[i] as El;
    if (+(m.dataset.readyMiners || 0) > 0) {
      this.closeSiteTip();
      const s = this.game.state.sites[i];
      this.game.act({ type: 'mineAt', row: s.row, col: s.col });
      return;
    }
    this.openSite(i, 'tap');
  }
  openSite(i: number, mode = 'tap') {
    const st = this.game.state;
    if (!st) return;
    this.closeSiteTip();
    const s = st.sites[i];
    const who = s.controller === 'player' ? 'You' : s.controller === 'opponent' ? 'Enemy' : 'Nobody';
    const color = s.color.charAt(0).toUpperCase() + s.color.slice(1);
    const line = (t: string) => h('p', { style: 'text-align:center;margin:2px 0' }, t);
    const tip = h('div', { class: 'site-tip', role: 'dialog', 'aria-label': 'Crystal site' }, h('h2', {}, 'Crystal site'), line(`Controlled by: ${who}`), line(`Color: ${color}`),
      line(`Your flow: +${s.flow.player}`), line(`Enemy flow: +${s.flow.opponent}`));
    if (mode !== 'hover') tip.append(btn('Close', 'small', () => this.closeSiteTip()));
    const m = this.r.sites[i] as El;
    const rr = this.root.getBoundingClientRect(), mr = m.getBoundingClientRect();
    tip.style.left = `${Math.max(4, Math.min(rr.width - 190, mr.left - rr.left + mr.width / 2 - 90))}px`;
    tip.style.bottom = `${Math.max(4, rr.bottom - mr.top + 6)}px`;
    this.root.append(tip);
    this.siteTip = tip; this.siteTipMode = mode;
    if (mode !== 'hover') {
      const off = (e: Event) => { if (!tip.contains(e.target as Node)) { this.closeSiteTip(); document.removeEventListener('pointerdown', off, true); } };
      setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
    }
  }

  // ------------------------------------------------------------ timer
  testLeft: number | null = null;
  lastTick = Date.now();
  timedNow(st: any) {
    return !st.tutorial && st.priority === 'player' && st.activePlayer === 'player' && ACTIVE.includes(st.phase);
  }
  setPhaseTimeLeft(n: number) {
    const st = this.game.state;
    if (!st) return;
    n = Math.max(0, +n || 0);
    if (n <= 0) { if (st.priority === st.activePlayer && ACTIVE.includes(st.phase) && !st.pendingResponse) this.game.act({ type: 'done' }); return; }
    this.testLeft = n;
    this.deadline = Date.now() + n * 1000;
    this.tick();
  }
  tick() {
    const st = this.game.state, r = this.r;
    const now = Date.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    if (!st || !r.timer) return;
    if (st.pendingResponse || this.game.paused) this.deadline += dt;
    const timed = this.timedNow(st);
    const total = CONFIG.phaseTimerSeconds;
    const frozen = this.test;
    const left = frozen ? (this.testLeft ?? total) : Math.max(0, Math.ceil((this.deadline - now) / 1000));
    const show = timed && left <= CONFIG.countdownSeconds && !st.pendingResponse;
    r.timer.hidden = !show;
    if (show) r.timer.textContent = String(left);
    if (!frozen && timed && left <= 0 && !st.pendingResponse) {
      this.deadline = now + total * 1000;
      this.game.act({ type: 'done' });
    }
  }

  renderTip(st: any) {
    const tip = this.r.tip as El;
    if (!st.tutorial) { tip.hidden = true; return; }
    const step = st.tutorial.step;
    tip.hidden = false;
    tip.dataset.step = step;
    tip.replaceChildren(h('div', { class: 'tip-text' }, (tutorialJson as any).tips[step] || ''),
      btn('Skip Tutorial', 'tip-skip', () => this.showMenu()));
  }

  renderSites(st: any) {
    st.sites.forEach((s: any, i: number) => {
      const m = this.r.sites[i] as El;
      const sym = s.controller ? FSYM(st.players[s.controller].faction) : '';
      const myAction = st.phase === 'action' && st.priority === 'player' && st.activePlayer === 'player' && !st.pendingResponse;
      const n = myAction ? readyMinersAt(st, 'player', s).length : 0;
      m.dataset.readyMiners = String(n);
      m.classList.toggle('ready', n > 0);
      const mk = n > 0 ? `x${n}` : this.view?.is3D ? sym : '💎' + sym;
      if (m.dataset.mk !== mk) {
        m.dataset.mk = mk;
        if (n > 0) m.replaceChildren(h('span', { class: 'pickaxe', 'aria-hidden': 'true' }, h('i', { class: 'pk-h' }), h('i', { class: 'pk-head' }), h('i', { class: 'pk-spark' })), `×${n}`);
        else m.textContent = this.view?.is3D ? sym : '💎' + sym;
      }
      m.style.color = COLOR_HEX[s.color] || COLOR_HEX.white;
      const ring = this.r.rings[i] as El;
      ring.style.setProperty('--mine', COLOR_HEX[s.color] || COLOR_HEX.white);
      this.r.flows[i].textContent = `+${s.flow.player} / +${s.flow.opponent}`;
    });
  }

  renderTokens(st: any) {
    const seen = new Set<string>();
    for (const c of st.board.creatures) {
      seen.add(c.uid);
      const card = CARDS[c.cardId];
      let el = this.tokens.get(c.uid);
      if (!el) {
        el = h('div', { class: `token f-${card.faction} ${c.owner === 'player' ? 'mine' : 'theirs'}`, role: 'img' },
          h('div', { class: 'tk-body', 'data-sym': FSYM(card.faction), 'aria-hidden': 'true' }),
          h('div', { class: 'tk-stats' }, h('span', { class: 'a' }), ' ', h('span', { class: 'h' }), ' ', h('span', { class: 'm' }), h('span', { class: 'sh' })), h('div', { class: 'pips', 'aria-hidden': 'true' }));
        this.tokens.set(c.uid, el);
        this.r.board.insertBefore(el, this.r.fx);
      }
      el.dataset.uid = c.uid; el.dataset.row = String(c.row); el.dataset.col = String(c.col);
      (el.querySelector('.a') as El).textContent = `⚔️${c.attack + junkBonus(st, c)}`;
      (el.querySelector('.h') as El).textContent = `❤️${c.health}`;
      (el.querySelector('.m') as El).textContent = `👟${maxMove(c)}${isMiner(CARDS[c.cardId]) ? ' ⛏️' : ''}${CARDS[c.cardId].abilities?.includes('ranged') ? ' 🏹' : ''}`;
      el.dataset.mining = String(!!c.minedMine);
      const up = c.upgrades.attack + c.upgrades.health;
      el.dataset.upgrades = String(up);
      (el.querySelector('.pips') as El).textContent = up ? '●'.repeat(Math.min(up, 8)) : '';
      const sh = el.querySelector('.sh') as El;
      sh.textContent = c.shield > 0 ? ` 🛡${c.shield}` : '';
      el.dataset.damaged = String(c.health < c.maxHealth);
      el.dataset.acted = String(isActed(st, c));
      el.setAttribute("aria-label", `${card.id === "shieldbeard" ? "Shieldbeard" : card.name}, row ${c.row}, column ${c.col}`);
      el.title = `${card.name}: Attack ${c.attack}, Health ${c.health}/${c.maxHealth}${c.shield > 0 ? `, Shield ${c.shield}` : ''}`;
      this.place(el, c.row, c.col);
    }
    for (const [uid, el] of this.tokens) if (!seen.has(uid)) { el.remove(); this.tokens.delete(uid); }
    this.fitHearts();
  }

  renderHand(st: any) {
    const me = st.players.player;
    const hand = this.r.hand as El;
    const tot = funds(me);
    const tunnel = sitesControlled(st, 'opponent') > sitesControlled(st, 'player');
    const hidden = st.phase === 'mulligan';
    const costOf = (c: any) => (c.type === 'creature' ? creatureCost(st, 'player', c) : c.type === 'spell' ? spellCost(st, 'player', c) : 0);
    const affordable = (c: any) => (c.type === 'creature' ? tot >= costOf(c) : c.type === 'spell' ? tot >= costOf(c) : true);
    const key = hidden ? 'x' : me.hand.map((hc: any) => hc.uid + ':' + affordable(CARDS[hc.cardId]) + ':' + costOf(CARDS[hc.cardId]) + ':' + tunnel).join(',');
    if (key === this.handKey) return;
    this.handKey = key;
    hand.replaceChildren();
    if (hidden) return;
    for (const hc of me.hand) {
      const c = CARDS[hc.cardId];
      const cost = costOf(c);
      const el = h('button', { type: 'button', class: `hand-card ${c.type} f-${c.faction} ${affordable(c) ? '' : 'unaff'}`, 'aria-label': c.name, 'data-uid': hc.uid, 'data-card': c.id },
        ...faceKids(c, cost),
        c.role === 'Smith' ? h('span', { class: 'smith-banner', 'aria-hidden': 'true' }, 'SMITH') : null,
        tunnel && c.abilities?.includes('tunnel') ? h('span', { class: 'tunnel-tag' }, 'Tunnel!') : null);
      el.addEventListener('pointerenter', (e: PointerEvent) => { if (e.pointerType === 'mouse') { this.openHand(true); this.popCard(el, true); } });
      el.addEventListener('pointerleave', (e: PointerEvent) => { this.popCard(el, false); if (e.pointerType === 'mouse') this.openHand(false); });
      el.addEventListener('pointerdown', (e: PointerEvent) => { if (e.pointerType !== 'mouse') this.openHand(true); }, true);
      el.addEventListener('focus', () => this.popCard(el, true));
      el.addEventListener('blur', () => this.popCard(el, false));
      el.addEventListener('pointerdown', (e: PointerEvent) => this.cardPointerDown(e, hc, el));
      el.addEventListener('click', (e: MouseEvent) => { if (e.detail === 0) this.showCard(c.id); });
      hand.append(el);
    }
    this.layoutHand();
  }

  // ------------------------------------------------------------ dialogs driven by state
  mullDlg: { close: () => void } | null = null;
  respDlg: { close: () => void } | null = null;
  handleDialogs(st: any) {
    const needMull = st.phase === 'mulligan' && st.priority === 'player' && !st.mulliganDone.player;
    if (needMull && !this.mullDlg) this.openMulligan(st);
    if (!needMull && this.mullDlg) { this.mullDlg.close(); this.mullDlg = null; }
    const needResp = !!st.pendingResponse && st.pendingResponse.responder === 'player' && st.phase !== 'over';
    if (needResp && !this.respDlg && !this.pick) { this.respStart = Date.now(); this.respSig = this.respondSig(st); this.openRespond(st); }
    else if (needResp && this.respDlg && this.respSig !== this.respondSig(st)) {
      // the player's own plays (e.g. a Crystal card) change what is affordable: rebuild the buttons, keep the clock
      this.respSig = this.respondSig(st);
      this.respDlg.close(); this.respDlg = null;
      this.openRespond(st);
    }
    if (!needResp && this.respDlg) { this.respDlg.close(); this.respDlg = null; clearTimeout(this.respondTimer); }
    if (!needResp && this.pick && this.pick.cells.length === 0) this.pick = null;
  }

  openMulligan(st: any) {
    const selected = new Set<string>();
    const wrap = h('div', { class: 'mull-hand' });
    const hand = st.players.player.hand;
    for (const hc of hand) {
      const c = CARDS[hc.cardId];
      const b = h('button', { type: 'button', class: 'mull-card', 'aria-pressed': 'false', 'aria-label': c.name, 'data-uid': hc.uid, onclick: () => {
        if (selected.has(hc.uid)) selected.delete(hc.uid); else selected.add(hc.uid);
        b.setAttribute('aria-pressed', String(selected.has(hc.uid)));
      } }, h('span', { 'aria-hidden': 'true' }, String(c.type === 'crystal' ? '◆' : c.cost)), h('span', { 'aria-hidden': 'true' }, c.name), h('span', { 'aria-hidden': 'true' }, c.type === 'creature' ? `${c.attack}/${c.health}` : c.type === 'spell' ? '✨' : '💎'), h('span', { class: 'tx', style: `--tf:${Math.min(0.075, textScale((c.text || '').length) * 0.8)}` }, c.text || ''));
      wrap.append(b);
    }
    const go = (uids: string[]) => this.game.act({ type: 'mulligan', uids });
    const d = this.dialog('Mulligan', [h('h2', {}, 'Mulligan'), h('p', { style: 'text-align:center;margin:0 0 10px' }, 'Tap cards you want to shuffle back and redraw.'), wrap,
      h('div', { class: 'row' }, btn('Keep Hand', 'primary', () => go([])), btn('Redraw Selected', '', () => go([...selected])))]);
    d.el.dataset.sticky = '1';
    this.mullDlg = d;
  }

  respondSig(st: any) {
    return JSON.stringify(this.game.legalActions()) + '|' + st.players.player.crystals + '|' + st.players.player.bank;
  }
  openRespond(st: any) {
    const pend = st.pendingResponse;
    const legalAll = this.game.legalActions();
    const legal = legalAll.filter((a: any) => a.type === 'respond');
    const needs = respondNeeds(st, 'player', pend);
    const tgt = pend.target && pend.target.row ? st.board.creatures.find((c: any) => c.row === pend.target.row && c.col === pend.target.col) : null;
    const tname = tgt ? (tgt.owner === 'player' ? `your ${CARDS[tgt.cardId].name}` : `their ${CARDS[tgt.cardId].name}`) : pend.target && pend.target.commander ? 'your Commander' : '';
    const what = pend.kind === 'summon' ? `Enemy summons ${CARDS[pend.card.cardId].name}.` : pend.kind === 'cast' ? `Enemy casts ${CARDS[pend.card.cardId].name}${tname ? ' at ' + tname : ''}.` : `Enemy attacks ${tname || 'one of your creatures'}.`;
    const buttons: El[] = [];
    const finish = () => { this.respDlg && this.respDlg.close(); this.respDlg = null; clearTimeout(this.respondTimer); };
    for (const n of needs) {
      const card = CARDS[n.cardId];
      const opts = legal.filter((a: any) => a.uid === n.uid);
      if (!opts.length) {
        buttons.push(btn(`${card.name} — need ${n.need} more`, '', undefined, { disabled: true, 'data-uid': n.uid }));
        continue;
      }
      const cr = opts[0].crystalUid ? st.players.player.hand.find((x: any) => x.uid === opts[0].crystalUid) : null;
      const label = cr ? `${CARDS[cr.cardId].name} + ${card.name}` : card.name;
      buttons.push(btn(label, '', () => {
        let chosen = opts[0];
        if (opts.length > 1) {
          const tc = pend.target && pend.target.row ? opts.find((o: any) => o.target && o.target.row === pend.target.row && o.target.col === pend.target.col) : null;
          if (tc) chosen = tc;
          else {
            finish();
            this.pick = { cells: opts.map((o: any) => o.target), done: (cell) => { this.pick = null; this.clearGlow(); this.game.act(opts.find((o: any) => o.target.row === cell.row && o.target.col === cell.col)); } };
            this.setGlow(this.pick.cells, 'glow');
            this.flash('Tap a target');
            return;
          }
        }
        finish();
        this.game.act(chosen);
      }, { 'data-uid': n.uid }));
    }
    for (const a of legalAll.filter((x: any) => x.type === 'playCrystal')) {
      const hc = st.players.player.hand.find((x: any) => x.uid === a.uid);
      if (hc) buttons.push(btn(`Play ${CARDS[hc.cardId].name}`, '', () => { const r = this.game.act(a); if (r && !r.ok) this.flash(r.error); }, { 'data-uid': a.uid }));
    }
    const ec = pend.card ? CARDS[pend.card.cardId] : null;
    if (ec) this.dialogCard = ec.id + pend.actor;
    const cardBox = ec ? h('div', { class: `enemy-card hand-card static ${ec.type} f-${ec.faction}` }, ...faceKids(ec)) : null;
    const bar = h('div', { class: 'respond-bar', role: 'progressbar', 'aria-label': 'Respond time left', 'aria-valuemin': '0', 'aria-valuemax': String(CONFIG.respondWindowSeconds), 'aria-valuenow': String(CONFIG.respondWindowSeconds) }, h('div', { class: 'fill' }));
    if (!this.test) { (bar.firstChild as El).style.animationDuration = CONFIG.respondWindowSeconds + 's'; (bar.firstChild as El).style.animationDelay = -((Date.now() - this.respStart) / 1000) + 's'; }
    else (bar.firstChild as El).style.animation = 'none';
    const d = this.dialog('Respond?', [h('h2', {}, 'Respond?'), bar, cardBox, h('p', { class: 'resp-what', style: 'text-align:center;margin:0 0 6px' }, what),
      h('div', { class: 'menu-list' }, ...buttons, btn('Let it happen', 'primary', () => { finish(); this.game.act({ type: 'pass' }); }))]);
    d.el.dataset.sticky = '1';
    this.respDlg = d;
    clearTimeout(this.respondTimer);
    if (!this.test) {
      const t0 = this.respStart;
      const iv = setInterval(() => {
        if (this.respDlg !== d) { clearInterval(iv); return; }
        const left = Math.max(0, CONFIG.respondWindowSeconds - (Date.now() - t0) / 1000);
        bar.setAttribute('aria-valuenow', left.toFixed(1));
        if (left <= 0) { clearInterval(iv); finish(); this.game.act({ type: 'pass' }); }
      }, 100);
    }
  }

  showMatchMenu() {
    const d: any = this.dialog('Menu', [h('h2', {}, 'Menu'), h('div', { class: 'menu-list' },
      btn('Resume', 'primary', () => d.close()),
      btn('Surrender', 'danger', () => {
        d.close();
        const c: any = this.dialog('Surrender this match?', [h('h2', {}, 'Surrender this match?'),
          h('div', { class: 'row' }, btn('Yes, surrender', 'danger', () => { c.close(); this.game.act({ type: 'surrender' }); }), btn('Cancel', '', () => c.close()))]);
      }))]);
  }

  // ------------------------------------------------------------ animations / fx
  center(row: number, col: number) {
    const rc = this.view!.cellRect(row, col);
    return { x: rc.x + rc.w / 2, y: rc.y + rc.h / 2 };
  }
  floatText(text: string, cls: string, row: number, col: number) {
    const p = this.center(row, col);
    const f = h('div', { class: 'float ' + cls }, text);
    f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 1000);
  }
  /** Red damage number over a Commander's heart, and the heart shakes. */
  heartPop(owner: string, amount: number) {
    const el = (owner === 'player' ? this.r.myHealth : this.r.enemyHealth) as El;
    if (!el) return;
    const f = h('div', { class: 'float dmg' }, '-' + amount);
    f.style.left = el.offsetLeft + el.offsetWidth / 2 + 'px'; f.style.top = el.offsetTop + 'px';
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 1000);
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  }
  burst(text: string, row: number, col: number) {
    const p = this.center(row, col);
    const f = h('div', { class: 'burst' }, text);
    f.style.left = p.x + 'px'; f.style.top = p.y - 10 + 'px';
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 900);
  }
  emote(side: string, kind: any) {
    this.view && this.view.emote(side as any, kind);
  }
  animate(st: any, events: any[]) {
    if (!this.view || !this.r.fx) return;
    for (const e of events) {
      if (e.type === 'damage') {
        const owner = e.commander;
        if (owner) {
          const row = SH[owner as 'player' | 'opponent'].row, col = SH[owner as 'player' | 'opponent'].col;
          this.heartPop(owner, e.amount);
          this.burst(e.amount >= 3 ? 'KA-BOOM!' : 'CRUNCH!', row, col);
          this.emote(owner, 'flinch');
          this.emote(owner === 'player' ? 'opponent' : 'player', 'cheer');
        } else if (e.amount > 0) {
          this.floatText('-' + e.amount, 'dmg', e.row, e.col);
          if (e.amount >= 3) this.burst('KA-BOOM!', e.row, e.col);
        }
      } else if (e.type === 'shieldBlock') {
        this.burst('BLOCK!', e.row, e.col);
      } else if (e.type === 'heal' && e.amount > 0) {
        if (e.row) this.floatText('+' + e.amount, 'heal', e.row, e.col);
        else this.floatText('+' + e.amount, 'heal', SH[e.commander as 'player' | 'opponent'].row, SH[e.commander as 'player' | 'opponent'].col);
      } else if (e.type === 'defeat') {
        this.burst('POOF!', e.row, e.col);
        this.emote(e.owner, 'groan');
        this.emote(e.owner === 'player' ? 'opponent' : 'player', 'cheer');
      } else if (e.type === 'cast') {
        this.callout(e.player, e.cardId);
        const respondable = st.pendingResponse && st.pendingResponse.responder === 'player' && e.player === 'opponent';
        if (!respondable) this.reveal(e.cardId);
      } else if (e.type === 'respond') {
        this.callout(e.player, e.cardId);
      } else if (e.type === 'counter') this.shatter(e.player);
      else if (e.type === 'spell') { this.emote(e.player, 'cast'); this.spellFx(e); }
      else if (e.type === 'summon') {
        if (this.dialogCard === e.cardId + e.owner) this.dialogCard = ''; else this.reveal(e.cardId, e);
      } else if (e.type === 'playCrystal') this.reveal(e.cardId);
      else if (e.type === 'minerUpgrade') {
        this.reveal(e.cardId, e);
        this.floatText(`+${e.attack ? '1 ATK ' : ''}+1 HP ✨`, 'heal', e.row, e.col);
      }
      else if (e.type === 'savings' && e.player === 'player') this.bankFly(e.amount);
      else if (e.type === 'income' && e.player === 'player' && e.amount > 0) this.flash(`+${e.amount} crystals`);
      else if (e.type === 'siteControl' && e.controller) this.flash('THE CRYSTAL. HAS. FALLEN.');
    }
    if (st.phase === 'over' && !this.endShown) {
      this.endShown = true;
      const loser = st.winner === 'player' ? 'opponent' : 'player';
      const esc = FACTIONS[st.players[loser].faction].symbol === 'skull' ? '🚀' : FACTIONS[st.players[loser].faction].symbol === 'gear' ? '💨' : '🕳️';
      const t = this.test ? 120 : 1600;
      const ov = h('div', { class: 'retreat', 'aria-hidden': 'true' }, h('div', { class: 'big' }, 'KA-BOOM!'), h('div', { class: 'esc' }, esc));
      this.root.querySelector('.match')?.append(ov);
      const winner = st.winner;
      setTimeout(() => this.showEnd(winner), t);
    }
  }
  /** "+N banked" text that flies into the Bank counter and stays at least 1.5 s (R9.2). */
  bankFly(n: number) {
    const bank = this.r.crBank as El;
    if (!bank) return;
    const rr = this.root.getBoundingClientRect(), br = bank.getBoundingClientRect();
    const f = h('div', { class: 'banked', role: 'status' }, `+${n} banked`);
    f.style.setProperty('--dx', `${br.left - rr.left + br.width / 2 - rr.width / 2}px`);
    f.style.setProperty('--dy', `${br.top - rr.top + br.height / 2 - rr.height / 2}px`);
    (this.root.querySelector('.match') || this.root).append(f);
    bank.classList.remove('bump'); void bank.offsetWidth; bank.classList.add('bump');
    setTimeout(() => f.remove(), 2600);
  }
  flash(text: string) {
    const r = this.r;
    if (!r.board) return;
    r.board.querySelectorAll('.hint').forEach((x: El) => x.remove());
    const hint = h('div', { class: 'hint', role: 'status' }, text);
    r.board.append(hint);
    setTimeout(() => hint.remove(), 1600);
  }

  showEnd(winner: string) {
    if (!this.game.state || this.game.state.phase !== 'over') return;
    const st = this.game.state;
    this.clear();
    const win = winner === 'player';
    const sx = st.stats || { mined: { player: 0, opponent: 0 }, summoned: { player: 0, opponent: 0 }, lost: { player: 0, opponent: 0 }, damage: {} };
    let mvp = 'None';
    const best = Object.entries(sx.damage as Record<string, number>).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) {
      const uid = best[0];
      const id = (sx.cards || {})[uid];
      if (id) mvp = `${CARDS[id].name} — ${best[1]} damage`;
    }
    const rowOf = (label: string, you: string, foe?: string) => h('tr', {}, h('th', { scope: 'row' }, label), h('td', {}, foe == null ? you : `You ${you} · Enemy ${foe}`));
    const table = h('table', { class: 'summary', 'aria-label': 'Match summary' },
      rowOf('Crystals mined', String(sx.mined.player), String(sx.mined.opponent)),
      rowOf('Creatures summoned', String(sx.summoned.player), String(sx.summoned.opponent)),
      rowOf('Creatures lost', String(sx.lost.player), String(sx.lost.opponent)),
      rowOf('Turns', String(st.turn)),
      rowOf('MVP', mvp));
    this.root.append(h('main', { class: 'screen center end' },
      h('h1', {}, win ? 'Victory!' : 'Defeat'),
      h('p', {}, win ? 'The enemy Commander fled screaming that this was all part of the plan.' : 'Your Commander escaped at the last second, shouting that this was all part of the plan.'),
      table,
      h('div', { class: 'row' },
        btn('Play again', 'primary', () => { if (this.lastTutorial) this.beginTutorial(); else { const o = { ...this.lastOptions }; this.beginMatch(o); } }),
        btn('Menu', '', () => this.showMenu()))));
  }

  // ------------------------------------------------------------ board geometry / hit testing
  cellAt(x: number, y: number): { row: number; col: number } | null {
    const bb = (this.r.board as El).getBoundingClientRect();
    const px = x - bb.left, py = y - bb.top;
    let best: any = null, bd = 1e9;
    for (let row = 1; row <= BH; row++) for (let col = 1; col <= BW; col++) {
      const rc = this.view!.cellRect(row, col);
      if (px < rc.x || px > rc.x + rc.w || py < rc.y || py > rc.y + rc.h) continue;
      const d = Math.hypot(px - rc.x - rc.w / 2, py - rc.y - rc.h / 2);
      if (d < bd) { bd = d; best = { row, col }; }
    }
    return best;
  }
  setGlow(cells: { row: number; col: number }[], cls: string) {
    for (const c of cells) {
      const row = c.row;
      const col = c.col;
      this.r.cells.get(row + ',' + col)?.classList.add(cls);
    }
  }
  clearGlow() {
    for (const el of this.r.cells.values() as Iterable<El>) el.classList.remove('glow', 'glow-attack', 'glow-swap', 'glow-mine', 'hover');
    this.r.board.classList.remove('drop-any');
  }
  cellOfTarget(t: any) { return t.commander ? SH[t.commander as 'player' | 'opponent'] : { row: t.row, col: t.col }; }

  // ------------------------------------------------------------ pointer interactions
  drag(e: PointerEvent, opts: { ghost: El; onStart: () => boolean | void; onDrop: (cell: { row: number; col: number } | null, x: number, y: number) => void; onTap: () => void; touchSwipe?: (dx: number) => void; onHover?: (cell: { row: number; col: number } | null, x: number, y: number) => void; onEnd?: () => void }) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const x0 = e.clientX, y0 = e.clientY;
    let dragging = false, swiping = false, lastX = x0;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!dragging && !swiping && Math.hypot(dx, dy) > 8) {
        if (ev.pointerType !== 'mouse' && opts.touchSwipe && Math.abs(dx) > Math.abs(dy)) swiping = true;
        else if (opts.onStart() !== false) { dragging = true; this.r.hand?.classList.add('away'); opts.ghost.style.left = ev.clientX + 'px'; document.body.append(opts.ghost); }
        else cleanup();
      }
      if (swiping) { opts.touchSwipe!(ev.clientX - lastX); lastX = ev.clientX; }
      if (dragging) {
        opts.ghost.style.left = ev.clientX + 'px'; opts.ghost.style.top = ev.clientY + 'px';
        const c = this.cellAt(ev.clientX, ev.clientY);
        for (const el of this.r.cells.values() as Iterable<El>) el.classList.remove('hover');
        if (c) this.r.cells.get(c.row + ',' + c.col)?.classList.add('hover');
        opts.onHover && opts.onHover(c, ev.clientX, ev.clientY);
      }
    };
    const up = (ev: PointerEvent) => {
      const was = dragging;
      cleanup();
      if (was) {
        const bb = (this.r.board as El).getBoundingClientRect();
        const inBoard = ev.clientX >= bb.left && ev.clientX <= bb.right && ev.clientY >= bb.top && ev.clientY <= bb.bottom;
        opts.onDrop(inBoard ? this.cellAt(ev.clientX, ev.clientY) || { row: 0, col: 0 } : null, ev.clientX, ev.clientY);
      } else if (!swiping) opts.onTap();
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up2);
      opts.ghost.remove();
      opts.onEnd && opts.onEnd();
      this.r.hand?.classList.remove('away');
      this.clearGlow();
      this.r.hand?.querySelectorAll('.dragging').forEach((x: El) => x.classList.remove('dragging'));
    };
    const up2 = () => { dragging = false; swiping = true; cleanup(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up2);
  }

  cardPointerDown(e: PointerEvent, hc: any, el: El) {
    if (e.pointerType !== 'mouse') {
      const t = setTimeout(() => this.popCard(el, true), 180);
      const off = () => { clearTimeout(t); this.popCard(el, false); window.removeEventListener('pointerup', off); window.removeEventListener('pointercancel', off); };
      window.addEventListener('pointerup', off); window.addEventListener('pointercancel', off);
    }
    const st = this.game.state;
    const card = CARDS[hc.cardId];
    const ghost = h('div', { class: 'ghost' }, card.type === 'creature' ? FSYM(card.faction) : card.type === 'spell' ? '✨' : '💎');
    this.drag(e, {
      ghost,
      touchSwipe: (dx) => { this.handScroll -= dx / 40; this.layoutHand(); },
      onStart: () => {
        if (this.pick || this.respDlg) return false;
        this.popCard(el, false);
        el.classList.add('dragging');
        const legal = this.game.legalActions().filter((a: any) => a.uid === hc.uid);
        if (!legal.length) { this.flash(this.explain(card)); }
        const cells: any[] = [];
        const smithCells: any[] = [];
        let any = false;
        for (const a of legal) {
          if (a.type === 'summon') cells.push({ row: a.row, col: a.col });
          else if (a.type === 'minerUpgrade') { const o = st.board.creatures.find((x: any) => x.uid === a.creatureUid); if (o) smithCells.push({ row: o.row, col: o.col }); }
          else if (a.type === 'cast') { if (!a.target) any = true; else if (!a.to || true) cells.push(this.cellOfTarget(a.target)); }
          else if (a.type === 'playCrystal') any = true;
        }
        this.setGlow(cells, 'glow');
        this.setGlow(smithCells, 'glow-swap');
        if (any) this.r.board.classList.add('drop-any');
        return true;
      },
      onDrop: (cell, x, y) => { if (cell && cell.row) this.dropCard(hc, card, cell, x, y); },
      onTap: () => {
        if (this.swapping) {
          this.swapping = false;
          const a = this.game.legalActions().find((x: any) => x.type === 'gathererSwap' && x.discardUid === hc.uid);
          if (a) this.game.act(a);
          return;
        }
        this.showCard(card.id);
      },
    });
    void st;
  }

  explain(card: any) {
    const st = this.game.state;
    if (st.activePlayer !== 'player') return "It's not your turn";
    if (card.type === 'creature' && st.phase !== 'deploy') return 'Creatures are summoned in the Deploy phase';
    if (card.type === 'crystal') return st.phase !== 'deploy' ? 'Crystal cards are played in the Deploy phase or when you respond' : 'Only one Crystal card per round';
    return "You can't play that right now";
  }

  dropCard(hc: any, card: any, cell: { row: number; col: number }, x?: number, y?: number) {
    const legal = this.game.legalActions().filter((a: any) => a.uid === hc.uid);
    if (!legal.length) { this.flash(this.explain(card)); return; }
    const ups = legal.filter((a: any) => a.type === 'minerUpgrade');
    if (ups.length) {
      let own = this.game.state.board.creatures.find((c: any) => c.row === cell.row && c.col === cell.col && c.owner === 'player');
      if (!own && x != null && y != null) {
        // the stat badge hangs below a token: a drop on the figure or its badge counts as a drop on that creature
        for (const [uid, el] of this.tokens) {
          const c = this.game.state.board.creatures.find((k: any) => k.uid === uid);
          if (!c || c.owner !== 'player') continue;
          const r = el.getBoundingClientRect();
          if (x >= r.left - 16 && x <= r.right + 16 && y >= r.top - 16 && y <= r.bottom + 16) { own = c; break; }
        }
      }
      const up = own && ups.find((a: any) => a.creatureUid === own.uid);
      if (up) { const r = this.game.act(up); if (r && !r.ok) this.flash(r.error); return; }
    }
    const t = legal.find((a: any) => a.type !== 'minerUpgrade')?.type || legal[0].type;
    const res = (r: any) => { if (r && !r.ok) this.flash(r.error); };
    if (t === 'summon') {
      const a = legal.find((x: any) => x.row === cell.row && x.col === cell.col);
      if (a) res(this.game.act(a)); else this.flash("Can't summon there");
    } else if (t === 'playCrystal') {
      res(this.game.act(legal[0]));
    } else if (t === 'cast') {
      if (!legal[0].target) { res(this.game.act(legal[0])); return; }
      const cands = legal.filter((o: any) => { const c = this.cellOfTarget(o.target); return c.row === cell.row && c.col === cell.col; });
      if (!cands.length) { this.flash('Invalid target'); return; }
      if (cands.length === 1) { res(this.game.act(cands[0])); return; }
      this.pick = { cells: cands.map((o: any) => o.to), done: (c) => { this.pick = null; this.clearGlow(); res(this.game.act(cands.find((o: any) => o.to.row === c.row && o.to.col === c.col))); } };
      this.setGlow(this.pick.cells, 'glow');
      this.flash('Tap where to move it');
    }
  }

  boardPointerDown(e: PointerEvent) {
    const st = this.game.state;
    if (!st) return;
    const lab = (e.target as El).closest?.('.tk-stats');
    const labUid = lab ? (lab.closest('.token') as El | null)?.dataset.uid : null;
    const cell = labUid ? (() => { const c0 = st.board.creatures.find((c: any) => c.uid === labUid); return c0 ? { row: c0.row, col: c0.col } : null; })() : this.cellAt(e.clientX, e.clientY);
    if (!cell) return;
    if (this.pick) {
      const p = this.pick.cells.find((c) => c.row === cell.row && c.col === cell.col);
      if (p) this.pick.done(p); else { this.pick = null; this.clearGlow(); this.flash('Cancelled'); }
      return;
    }
    const cr = st.board.creatures.find((c: any) => c.row === cell.row && c.col === cell.col);
    if (!cr) return;
    const card = CARDS[cr.cardId];
    const ghost = h('div', { class: 'ghost tk' }, FSYM(card.faction));
    const mine = cr.owner === 'player';
    let box: El | null = null;
    const atkAt = (c: { row: number; col: number }) => this.game.legalActions().find((a: any) => a.creatureUid === cr.uid && a.type === 'attack' && ((a.target.commander && c.row === SH[a.target.commander as 'player' | 'opponent'].row && c.col === SH[a.target.commander as 'player' | 'opponent'].col) || (a.target.row === c.row && a.target.col === c.col)));
    this.drag(e, {
      ghost,
      onHover: (c, x, y) => {
        const a = mine && c ? atkAt(c) : null;
        const pv: any = a ? previewAttack(this.game.state, cr.uid, a.target) : null;
        if (!pv) { box?.remove(); box = null; return; }
        if (!box) { box = h('div', { class: 'atk-preview', 'aria-label': 'Attack preview', role: 'status' }); document.body.append(box); }
        const dead = pv.targetDefeated || pv.attackerDefeated;
        box.replaceChildren(`You deal ${pv.youDeal} / You take ${pv.youTake}`, ...(dead ? [h('span', { class: 'skull' }, ` ${pv.targetDefeated ? '💀' : ''}${pv.attackerDefeated ? '💀' : ''}`)] : []));
        box.style.left = x + 'px'; box.style.top = y + 'px';
      },
      onEnd: () => { box?.remove(); box = null; },
      onStart: () => {
        if (!mine || this.respDlg) return false;
        const legal = this.game.legalActions().filter((a: any) => a.creatureUid === cr.uid);
        const isMove = (a: any) => a.type === 'move';
        const swapAt = (a: any) => st.board.creatures.some((o: any) => o.row === a.row && o.col === a.col);
        this.setGlow(legal.filter((a: any) => isMove(a) && !swapAt(a)).map((a: any) => ({ row: a.row, col: a.col })), 'glow');
        this.setGlow(legal.filter((a: any) => isMove(a) && swapAt(a)).map((a: any) => ({ row: a.row, col: a.col })), 'glow-swap');
        this.setGlow(legal.filter((a: any) => a.type === 'attack').map((a: any) => this.cellOfTarget(a.target)), 'glow-attack');
        this.setGlow(legal.filter((a: any) => a.type === 'mine').map((a: any) => ({ row: a.row, col: a.col })), 'glow-mine');
        if (!legal.some((a: any) => a.type === 'move' || a.type === 'attack' || a.type === 'mine')) this.flash(st.phase === 'action' ? 'This creature cannot act now (each creature moves, attacks OR mines)' : 'Creatures move and attack in the Action phase');
        return true;
      },
      onDrop: (c) => {
        if (!c || !c.row) return;
        const legal = this.game.legalActions().filter((a: any) => a.creatureUid === cr.uid);
        const atk = legal.find((a: any) => a.type === 'attack' && ((a.target.commander && c.row === SH[a.target.commander as 'player' | 'opponent'].row && c.col === SH[a.target.commander as 'player' | 'opponent'].col) || (a.target.row === c.row && a.target.col === c.col)));
        const mv = legal.find((a: any) => a.type === 'move' && a.row === c.row && a.col === c.col);
        const mn = legal.find((a: any) => a.type === 'mine' && a.row === c.row && a.col === c.col);
        const a = atk || mn || mv;
        if (a) { const r = this.game.act(a); if (!r.ok) this.flash(r.error!); } else this.flash("Can't go there");
      },
      onTap: () => {
        const now = Date.now();
        if (this.lastTap.uid === cr.uid && now - this.lastTap.t < 380) {
          clearTimeout(this.tapTimer);
          this.lastTap = { uid: '', t: 0 };
          this.showCard(cr.cardId, cr);
          return;
        }
        this.lastTap = { uid: cr.uid, t: now };
        clearTimeout(this.tapTimer);
      },
    });
  }
}

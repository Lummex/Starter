import { Game } from '../game';
import { CARDS, COMMANDERS, FACTIONS, CONFIG, ABILITIES, creatureCost, spellCost } from '../engine';
import { createBoardView, createFlatView, BoardView } from './scene';

type El = HTMLElement;
const SYM: Record<string, string> = { skull: '💀', gear: '⚙️', hammer: '🔨' };
const FSYM = (f: string) => SYM[FACTIONS[f]?.symbol] || '✦';
const PHASE: Record<string, string> = { deploy: 'Deploy', movement: 'Movement', attack: 'Attack', mulligan: 'Mulligan', draw: 'Draw', end: 'End', over: 'Over' };
const COLOR_NAMES = ['green', 'blue', 'purple'];

function h(tag: string, attrs: Record<string, any> = {}, ...kids: (string | Node | null | undefined)[]): El {
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
const btn = (label: string, cls = '', onclick?: (e: Event) => void, attrs: Record<string, any> = {}) => h('button', { type: 'button', class: 'btn ' + cls, onclick, ...attrs }, label);

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
  handKey = '';
  tokens = new Map<string, El>();
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
      h('div', { class: 'stack' },
        btn('Play', 'primary', () => this.showSetup()),
        btn('How to Play', '', () => this.showHowTo()),
        this.gfxButton()));
    this.root.append(s);
  }

  showSetup() {
    this.clear();
    let cmd = 'grubnak', diff = 'normal';
    const cmdBtns: El[] = [], diffBtns: El[] = [];
    const sel = () => {
      cmdBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === cmd)));
      diffBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === diff)));
    };
    for (const c of Object.values(COMMANDERS) as any[]) {
      const f = FACTIONS[c.faction];
      cmdBtns.push(h('button', { type: 'button', class: 'cmd-btn', 'data-id': c.id, onclick: () => { cmd = c.id; sel(); } },
        h('span', { class: 'nm' }, c.name),
        h('span', { class: 'ds' }, `${FSYM(c.faction)} ${f.name} (${f.crystal}). ${c.blurb} ${c.abilityText}`)));
    }
    for (const d of ['easy', 'normal']) diffBtns.push(btn(d === 'easy' ? 'Easy' : 'Normal', '', () => { diff = d; sel(); }, { 'data-id': d }));
    sel();
    const s = h('main', { class: 'screen' },
      h('h1', { class: 'section cinzel', style: 'font-size:1.6rem;color:#e3b54a;margin:8px 0 14px;text-align:center' }, 'Choose Your Commander'),
      h('div', { class: 'stack', style: 'max-width:340px' }, ...cmdBtns),
      h('div', { class: 'row', style: 'margin:16px 0' }, ...diffBtns),
      h('div', { class: 'stack' },
        btn('Start Match', 'primary', () => {
          const others = Object.keys(COMMANDERS).filter((k) => k !== cmd);
          const opp = others[Math.floor(Math.random() * others.length)];
          this.beginMatch({ playerCommander: cmd, opponentCommander: opp, difficulty: diff });
        }),
        btn('Back', '', () => this.showMenu())));
    this.root.append(s);
  }

  showHowTo() {
    this.clear();
    const svg = (label: string, body: string) => {
      const d = document.createElement('div');
      d.innerHTML = `<svg role="img" aria-label="${label}" viewBox="0 0 240 110" width="240" height="110" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
      return d.firstElementChild as El;
    };
    const board = svg('Picture of the board: enemy Stronghold at the top, three crystal sites in the middle, your Stronghold at the bottom',
      '<rect width="240" height="110" rx="10" fill="#4b3b2b"/><rect x="100" y="6" width="40" height="18" rx="4" fill="#77706a"/><text x="120" y="19" font-size="10" fill="#f4e9d0" text-anchor="middle">Enemy</text>' +
      '<polygon points="50,46 60,56 50,70 40,56" fill="#3ee06a"/><polygon points="120,46 130,56 120,70 110,56" fill="#dfe3ea"/><polygon points="190,46 200,56 190,70 180,56" fill="#b45cff"/>' +
      '<rect x="100" y="88" width="40" height="18" rx="4" fill="#77706a"/><text x="120" y="101" font-size="10" fill="#f4e9d0" text-anchor="middle">You</text>');
    const crystals = svg('Picture of three crystals: green for Goblins, blue for Gnomes, purple for Dwarves',
      '<rect width="240" height="110" rx="10" fill="#26232f"/><polygon points="40,20 65,55 40,95 15,55" fill="#3ee06a"/><polygon points="120,20 145,55 120,95 95,55" fill="#3fa9ff"/><polygon points="200,20 225,55 200,95 175,55" fill="#b45cff"/>' +
      '<text x="40" y="106" font-size="9" fill="#f4e9d0" text-anchor="middle">Goblins</text><text x="120" y="106" font-size="9" fill="#f4e9d0" text-anchor="middle">Gnomes</text><text x="200" y="106" font-size="9" fill="#f4e9d0" text-anchor="middle">Dwarves</text>');
    const combat = svg('Picture of type advantage: Dwarves beat Goblins, Goblins beat Gnomes, Gnomes beat Dwarves',
      '<rect width="240" height="110" rx="10" fill="#26232f"/><text x="120" y="30" font-size="16" fill="#f4e9d0" text-anchor="middle">🔨 → 💀 → ⚙️ → 🔨</text><text x="120" y="62" font-size="11" fill="#e3b54a" text-anchor="middle">+1 Attack on a type advantage</text><text x="120" y="86" font-size="11" fill="#f4e9d0" text-anchor="middle">Dwarves › Goblins › Gnomes › Dwarves</text>');
    const sec = (t: string, ...k: (string | El)[]) => h('section', {}, h('h3', {}, t), ...k.map((x) => (typeof x === 'string' ? h('p', {}, x) : x)));
    const s = h('main', { class: 'screen howto' },
      h('h1', { class: 'section cinzel', style: 'font-size:1.8rem;color:#e3b54a;margin:8px 0 14px' }, 'How to Play'),
      sec('Goal', 'Bring the enemy Commander from 20 Health to 0 and they flee the battlefield. Commanders never die, they retreat!'),
      sec('The Board', 'A hidden 7×7 grid. The enemy is at the top, you are at the bottom. Summon creatures in your two home rows. Three crystal sites sit in the middle.', board),
      sec('Crystals', 'Control a site by having more creatures around it than the enemy. Each site you control gives 1 crystal, and your Gatherers next to it give 2 more. Your Stronghold gives 1 more every turn, and 2 extra if you control no sites.', crystals),
      sec('Your Turn', 'Deploy: drag cards onto the board to summon creatures or cast spells, and play one Crystal card. Movement: drag creatures one space. Attack: drag creatures onto enemies, or onto the enemy Stronghold. Tap Done to finish a phase.'),
      sec('Combat', 'Creatures hit with their Attack; survivors strike back in melee. Dwarves beat Goblins, Goblins beat Gnomes and Gnomes beat Dwarves for +1 Attack. Ranged creatures hit 2 spaces away.', combat),
      sec('Spells & Instants', 'Spells are cast by your Commander using crystals of any color. Instants can answer the enemy during a "Respond?" window, and counterspells cancel spells or summons.'),
      h('div', { class: 'stack', style: 'margin:10px 0 20px' }, btn('Back', '', () => this.showMenu())));
    this.root.append(s);
  }

  // ------------------------------------------------------------ dialogs
  dialog(name: string, content: (El | string)[], onClose?: () => void): { close: () => void; el: El } {
    const dlg = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': name }, ...content);
    const ov = h('div', { class: 'overlay' }, dlg);
    const close = () => { ov.remove(); this.dialogs = this.dialogs.filter((d) => d !== ov); onClose && onClose(); };
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
      rows.push(['Movement', String(creature?.upgrade === 'veteran' ? Math.max(2, c.move) : c.move)]);
      rows.push(['Role', c.role]);
      if (creature?.upgrade) rows.push(['Upgrade', CONFIG.upgrades[creature.upgrade].name]);
    }
    const dl = h('dl', {});
    for (const [k, v] of rows) dl.append(h('dt', {}, k), h('dd', {}, v));
    const ab = c.type === 'creature' ? c.abilities.map((a: string) => `${ABILITIES[a].name}: ${ABILITIES[a].text}`).join(' ') : c.text;
    const d = this.dialog(c.name, [h('div', { class: 'card-view' }, h('div', { class: 'cv-name' }, c.name), dl, h('p', {}, ab || ''),
      h('div', { class: 'row' }, btn('Close', 'primary', () => d.close())))]);
  }

  // ------------------------------------------------------------ match
  beginMatch(options: any = {}) {
    const o = { ...options };
    if (o.seed == null && this.test && this.seed != null) o.seed = this.seed;
    const state = this.game.newMatch(o);
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
  }

  showMatch() {
    this.clear();
    const r = this.r;
    const crystalChip = (c: string) => (r['cr_' + c] = h('span', { class: 'cr ' + c, 'aria-label': `Your ${c} crystals` }, '0'));
    r.enemyHand = h('div', { class: 'enemy-hand', 'aria-label': 'Enemy hand' });
    r.enemyDeck = h('div', { class: 'pile', 'aria-label': 'Enemy deck' }, '0');
    r.enemyHealth = h('div', { class: 'health', 'aria-label': 'Enemy Commander health' }, '20');
    r.phase = h('div', { class: 'phase', 'aria-label': 'Current phase', 'aria-live': 'polite' });
    r.timer = h('div', { class: 'timer', 'aria-label': 'Phase timer' }, '30');
    r.rope = h('div', { class: 'rope hidden' }, h('i'));
    r.board = h('div', { class: 'board' });
    r.fx = h('div', { class: 'fx' });
    r.myHealth = h('div', { class: 'health mine', 'aria-label': 'Your Commander health' }, '20');
    r.myDeck = h('div', { class: 'pile', 'aria-label': 'Your deck' }, '0');
    r.done = btn('Done', 'primary', () => this.game.act({ type: 'done' }));
    r.hand = h('div', { class: 'hand', role: 'group', 'aria-label': 'Your hand' });
    const menuBtn = btn('Menu', '', () => this.showMatchMenu());
    const match = h('main', { class: 'match' },
      h('div', { class: 'hud-top' }, r.enemyDeck, r.enemyHand, r.enemyHealth),
      h('div', { class: 'topbar' }, r.phase, r.timer, menuBtn, r.rope),
      r.board,
      h('div', { class: 'hud-bottom' }, r.myHealth, crystalChip('green'), crystalChip('blue'), crystalChip('purple'), h('span', { class: 'spacer' }), r.myDeck, r.done),
      r.hand);
    this.root.append(match);
    // board layers
    r.cells = new Map<string, El>();
    r.sites = [];
    r.view = null;
    try { this.view = createBoardView(r.board, this.low); } catch { this.view = null; }
    if (!this.view) this.view = createFlatView(r.board);
    for (let row = 1; row <= 7; row++) for (let col = 1; col <= 7; col++) {
      const c = h('div', { class: 'cell', 'data-row': row, 'data-col': col });
      r.cells.set(row + ',' + col, c);
      r.board.append(c);
    }
    for (const [row, col] of CONFIG.sites as number[][]) {
      const m = h('div', { class: 'site-mark', role: 'img', 'aria-label': 'Crystal site' });
      m.dataset.row = String(row); m.dataset.col = String(col);
      r.sites.push(m); r.board.append(m);
    }
    r.strong = {} as any;
    for (const side of ['player', 'opponent']) {
      const s = h('div', { class: 'stronghold ' + side, role: 'img', 'aria-label': side === 'player' ? 'Your Stronghold' : 'Enemy Stronghold' }, '🏰');
      r.strong[side] = s; r.board.append(s);
    }
    r.board.append(r.fx);
    const ro = new ResizeObserver(() => this.layout());
    ro.observe(r.board);
    this.unsub = this.game.subscribe((st, ev) => this.update(st, ev));
    r.board.addEventListener('pointerdown', (e: PointerEvent) => this.boardPointerDown(e));
    r.hand.addEventListener('wheel', (e: WheelEvent) => { e.preventDefault(); this.handScroll += (e.deltaY || e.deltaX) / 80; this.layoutHand(); }, { passive: false });
    window.addEventListener('resize', this.onResize);
    clearInterval(this.timerId);
    this.timerId = setInterval(() => this.tick(), 250);
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
    this.place(r.strong.player, 7, 4);
    this.place(r.strong.opponent, 1, 4);
    for (const el of this.tokens.values()) this.place(el, +el.dataset.row!, +el.dataset.col!);
    this.layoutHand();
  }
  place(el: El, row: number, col: number) {
    const rc = this.view!.cellRect(row, col);
    el.style.left = rc.x + 'px'; el.style.top = rc.y + 'px'; el.style.width = rc.w + 'px'; el.style.height = rc.h + 'px';
  }

  layoutHand() {
    const hand = this.r.hand as El;
    if (!hand) return;
    const cards = [...hand.querySelectorAll('.hand-card')] as El[];
    const n = cards.length;
    const W = hand.clientWidth || 390;
    const spacing = n > 1 ? Math.max(32, Math.min(52, (W - 72) / (n - 1))) : 52;
    const overflow = Math.max(0, (n - 1) * spacing - (W - 72));
    const maxScroll = overflow / 2 / spacing;
    this.handScroll = Math.max(-maxScroll, Math.min(maxScroll, this.handScroll));
    cards.forEach((c, i) => {
      const off = i - (n - 1) / 2 - this.handScroll;
      const x = W / 2 + off * spacing - 28;
      const t = (off * spacing) / (W / 2);
      const rot = t * 16;
      const y = t * t * 26;
      c.style.left = x + 'px';
      c.style.transform = `translateY(${y}px) rotate(${rot}deg)`;
      c.style.zIndex = String(i + 1);
    });
  }

  update(st: any, events: any[]) {
    const r = this.r;
    if (!r.board || !st) return;
    const me = st.players.player, en = st.players.opponent;
    this.view && this.view.setState(st, events);
    r.enemyHealth.textContent = String(en.health);
    r.myHealth.textContent = String(me.health);
    r.enemyDeck.replaceChildren(String(en.deck.length));
    r.myDeck.textContent = String(me.deck.length);
    for (const c of COLOR_NAMES) r['cr_' + c].textContent = String(me.crystals[c]);
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
    const whose = st.activePlayer === 'player' ? 'Your turn' : 'Enemy turn';
    r.phase.textContent = st.phase === 'mulligan' ? 'Mulligan' : st.phase === 'over' ? 'Match over' : `${whose} · ${PHASE[st.phase]}`;
    const key = `${st.turn}|${st.phase}|${st.priority}|${st.pendingResponse ? 1 : 0}`;
    if (key !== this.phaseKey) { this.phaseKey = key; this.deadline = Date.now() + CONFIG.phaseTimerSeconds * 1000; }
    const mine = st.priority === 'player' && st.activePlayer === 'player' && ['deploy', 'movement', 'attack'].includes(st.phase) && !st.pendingResponse;
    r.done.disabled = !mine;
    // board overlays
    this.renderSites(st);
    this.renderTokens(st);
    this.renderHand(st);
    this.handleDialogs(st);
    this.animate(st, events);
    this.tick();
  }

  renderSites(st: any) {
    st.sites.forEach((s: any, i: number) => {
      const m = this.r.sites[i] as El;
      const who = s.controller === 'player' ? 'you' : s.controller === 'opponent' ? 'the enemy' : 'nobody';
      m.textContent = s.controller ? FSYM(st.players[s.controller].faction) : '';
      m.setAttribute('aria-label', `Crystal site, controlled by ${who}`);
      m.style.color = s.color ? ({ green: '#3ee06a', blue: '#3fa9ff', purple: '#b45cff' } as any)[s.color] : '#dfe3ea';
      if (!this.view?.is3D) m.textContent = '💎' + (s.controller ? FSYM(st.players[s.controller].faction) : '');
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
          h('div', { class: 'tk-body' }, FSYM(card.faction)), h('div', { class: 'tk-stats' }, h('b', { class: 'a' }), h('b', { class: 'h' })));
        this.tokens.set(c.uid, el);
        this.r.board.insertBefore(el, this.r.fx);
      }
      el.dataset.uid = c.uid; el.dataset.row = String(c.row); el.dataset.col = String(c.col);
      (el.querySelector('.a') as El).textContent = String(c.attack);
      (el.querySelector('.h') as El).textContent = String(c.health);
      el.setAttribute('aria-label', `${card.name}, ${c.owner === 'player' ? 'yours' : 'enemy'}, attack ${c.attack}, health ${c.health} of ${c.maxHealth}, row ${c.row} column ${c.col}`);
      this.place(el, c.row, c.col);
    }
    for (const [uid, el] of this.tokens) if (!seen.has(uid)) { el.remove(); this.tokens.delete(uid); }
  }

  renderHand(st: any) {
    const me = st.players.player;
    const hand = this.r.hand as El;
    const fcol = FACTIONS[me.faction].crystal;
    const tot = me.crystals.green + me.crystals.blue + me.crystals.purple;
    const hidden = st.phase === 'mulligan';
    const key = hidden ? 'x' : me.hand.map((c: any) => c.uid + ':' + (CARDS[c.cardId].type === 'creature' ? me.crystals[fcol] >= creatureCost(st, 'player', CARDS[c.cardId]) : tot >= spellCost(st, 'player', CARDS[c.cardId]))).join(',') + '|' + st.flags.discount.player;
    if (key === this.handKey) return;
    this.handKey = key;
    hand.replaceChildren();
    if (hidden) return;
    for (const hc of me.hand) {
      const c = CARDS[hc.cardId];
      const cost = c.type === 'creature' ? creatureCost(st, 'player', c) : c.type === 'spell' ? spellCost(st, 'player', c) : 0;
      const aff = c.type === 'creature' ? me.crystals[fcol] >= cost : c.type === 'spell' ? tot >= cost : true;
      const el = h('button', { type: 'button', class: `hand-card ${c.type} f-${c.faction} ${aff ? '' : 'unaff'}`, 'aria-label': c.name, 'data-uid': hc.uid, 'data-card': c.id },
        h('span', { class: 'cost', 'aria-hidden': 'true' }, c.type === 'crystal' ? '◆' : String(cost)),
        h('span', { class: 'nm', 'aria-hidden': 'true' }, c.name),
        h('span', { class: 'ty', 'aria-hidden': 'true' }, c.type === 'creature' ? FSYM(c.faction) : c.type === 'spell' ? (c.spellKind === 'regular' ? '✨' : '⚡') : '💎'),
        h('span', { class: 'st', 'aria-hidden': 'true' }, c.type === 'creature' ? `${c.attack}/${c.health}` : c.rarity.slice(0, 1)));
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
    if (needResp && !this.respDlg && !this.pick) this.openRespond(st);
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
      } }, h('span', { 'aria-hidden': 'true' }, String(c.type === 'crystal' ? '◆' : c.cost)), h('span', { 'aria-hidden': 'true' }, c.name), h('span', { 'aria-hidden': 'true' }, c.type === 'creature' ? `${c.attack}/${c.health}` : c.type === 'spell' ? '✨' : '💎'));
      wrap.append(b);
    }
    const go = (uids: string[]) => this.game.act({ type: 'mulligan', uids });
    const d = this.dialog('Mulligan', [h('h2', {}, 'Mulligan'), h('p', { style: 'text-align:center;margin:0 0 10px' }, 'Tap cards you want to shuffle back and redraw.'), wrap,
      h('div', { class: 'row' }, btn('Keep Hand', 'primary', () => go([])), btn('Redraw Selected', '', () => go([...selected])))]);
    d.el.dataset.sticky = '1';
    this.mullDlg = d;
  }

  openRespond(st: any) {
    const pend = st.pendingResponse;
    const legal = this.game.legalActions().filter((a: any) => a.type === 'respond');
    const byCard = new Map<string, any[]>();
    for (const a of legal) {
      const hc = st.players.player.hand.find((x: any) => x.uid === a.uid);
      if (!hc) continue;
      if (!byCard.has(a.uid)) byCard.set(a.uid, []);
      byCard.get(a.uid)!.push(a);
    }
    const what = pend.kind === 'summon' ? `Enemy summons ${CARDS[pend.card.cardId].name}.` : pend.kind === 'cast' ? `Enemy casts ${CARDS[pend.card.cardId].name}.` : 'Enemy attacks one of your creatures.';
    const buttons: El[] = [];
    const finish = () => { this.respDlg && this.respDlg.close(); this.respDlg = null; clearTimeout(this.respondTimer); };
    for (const [uid, opts] of byCard) {
      const hc = st.players.player.hand.find((x: any) => x.uid === uid);
      const card = CARDS[hc.cardId];
      buttons.push(btn(card.name, '', () => {
        let chosen = opts[0];
        if (opts.length > 1) {
          const tc = pend.target && pend.target.row ? opts.find((o) => o.target && o.target.row === pend.target.row && o.target.col === pend.target.col) : null;
          if (tc) chosen = tc;
          else {
            finish();
            this.pick = { cells: opts.map((o) => o.target), done: (cell) => { this.pick = null; this.clearGlow(); this.game.act(opts.find((o) => o.target.row === cell.row && o.target.col === cell.col)); } };
            this.setGlow(this.pick.cells, 'glow');
            this.flash('Tap a target');
            return;
          }
        }
        finish();
        this.game.act(chosen);
      }, { 'data-uid': uid }));
    }
    const d = this.dialog('Respond?', [h('h2', {}, 'Respond?'), h('p', { style: 'text-align:center;margin:0 0 6px' }, what),
      h('div', { class: 'menu-list' }, ...buttons, btn('Let it happen', 'primary', () => { finish(); this.game.act({ type: 'pass' }); }))]);
    d.el.dataset.sticky = '1';
    this.respDlg = d;
    clearTimeout(this.respondTimer);
    if (!this.test) this.respondTimer = setTimeout(() => { if (this.respDlg === d) { finish(); this.game.act({ type: 'pass' }); } }, CONFIG.respondWindowSeconds * 1000);
  }

  showMatchMenu() {
    const d: any = this.dialog('Menu', [h('h2', {}, 'Menu'), h('div', { class: 'menu-list' },
      btn('Resume', 'primary', () => d.close()), this.gfxButton(),
      btn('Surrender', 'danger', () => {
        d.close();
        const c: any = this.dialog('Surrender this match?', [h('h2', {}, 'Surrender this match?'),
          h('div', { class: 'row' }, btn('Yes, surrender', 'danger', () => { c.close(); this.game.act({ type: 'surrender' }); }), btn('Cancel', '', () => c.close()))]);
      }))]);
  }

  // ------------------------------------------------------------ timer
  tick() {
    const st = this.game.state, r = this.r;
    if (!st || !r.timer) return;
    const total = CONFIG.phaseTimerSeconds;
    const left = this.test || this.game.paused ? total : Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    r.timer.textContent = String(left);
    const warn = !this.test && left <= CONFIG.ropeWarningSeconds && st.phase !== 'over' && st.phase !== 'mulligan';
    r.rope.classList.toggle('hidden', !warn);
    if (warn) (r.rope.firstChild as El).style.transform = `scaleX(${Math.max(0, (this.deadline - Date.now()) / (CONFIG.ropeWarningSeconds * 1000))})`;
    if (!this.test && left <= 0 && st.priority === 'player' && st.activePlayer === 'player' && ['deploy', 'movement', 'attack'].includes(st.phase) && !st.pendingResponse) {
      this.deadline = Date.now() + total * 1000;
      this.game.act({ type: 'done' });
    }
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
          const row = owner === 'player' ? 7 : 1;
          this.floatText('-' + e.amount, 'dmg', row, 4);
          this.burst(e.amount >= 3 ? 'KA-BOOM!' : 'CRUNCH!', row, 4);
          this.emote(owner, 'flinch');
          this.emote(owner === 'player' ? 'opponent' : 'player', 'cheer');
        } else if (e.amount > 0) {
          this.floatText('-' + e.amount, 'dmg', e.row, e.col);
          if (e.amount >= 3) this.burst('KA-BOOM!', e.row, e.col);
        }
      } else if (e.type === 'heal' && e.amount > 0) {
        if (e.row) this.floatText('+' + e.amount, 'heal', e.row, e.col);
        else this.floatText('+' + e.amount, 'heal', e.commander === 'player' ? 7 : 1, 4);
      } else if (e.type === 'defeat') {
        this.burst('POOF!', e.row, e.col);
        this.emote(e.owner, 'groan');
        this.emote(e.owner === 'player' ? 'opponent' : 'player', 'cheer');
      } else if (e.type === 'spell') this.emote(e.player, 'cast');
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
    this.clear();
    const win = winner === 'player';
    const surrendered = this.game.state.winner === 'opponent';
    void surrendered;
    this.root.append(h('main', { class: 'screen center end' },
      h('h1', {}, win ? 'Victory!' : 'Defeat'),
      h('p', {}, win ? 'The enemy Commander fled screaming that this was all part of the plan.' : 'Your Commander escaped at the last second, shouting that this was all part of the plan.'),
      h('div', { class: 'stack' }, btn('Back to Menu', 'primary', () => this.showMenu()))));
  }

  // ------------------------------------------------------------ board geometry / hit testing
  cellAt(x: number, y: number): { row: number; col: number } | null {
    const bb = (this.r.board as El).getBoundingClientRect();
    const px = x - bb.left, py = y - bb.top;
    let best: any = null, bd = 1e9;
    for (let row = 1; row <= 7; row++) for (let col = 1; col <= 7; col++) {
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
    for (const el of this.r.cells.values() as Iterable<El>) el.classList.remove('glow', 'glow-attack', 'hover');
    this.r.board.classList.remove('drop-any');
  }
  cellOfTarget(t: any) { return t.commander ? { row: t.commander === 'player' ? 7 : 1, col: 4 } : { row: t.row, col: t.col }; }

  // ------------------------------------------------------------ pointer interactions
  drag(e: PointerEvent, opts: { ghost: El; onStart: () => boolean | void; onDrop: (cell: { row: number; col: number } | null, x: number, y: number) => void; onTap: () => void; touchSwipe?: (dx: number) => void }) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const x0 = e.clientX, y0 = e.clientY;
    let dragging = false, swiping = false, lastX = x0;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!dragging && !swiping && Math.hypot(dx, dy) > 8) {
        if (ev.pointerType !== 'mouse' && opts.touchSwipe && Math.abs(dx) > Math.abs(dy)) swiping = true;
        else if (opts.onStart() !== false) { dragging = true; opts.ghost.style.left = ev.clientX + 'px'; document.body.append(opts.ghost); }
        else cleanup();
      }
      if (swiping) { opts.touchSwipe!(ev.clientX - lastX); lastX = ev.clientX; }
      if (dragging) {
        opts.ghost.style.left = ev.clientX + 'px'; opts.ghost.style.top = ev.clientY + 'px';
        const c = this.cellAt(ev.clientX, ev.clientY);
        for (const el of this.r.cells.values() as Iterable<El>) el.classList.remove('hover');
        if (c) this.r.cells.get(c.row + ',' + c.col)?.classList.add('hover');
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
      this.clearGlow();
      this.r.hand?.querySelectorAll('.dragging').forEach((x: El) => x.classList.remove('dragging'));
    };
    const up2 = () => { dragging = false; swiping = true; cleanup(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up2);
  }

  cardPointerDown(e: PointerEvent, hc: any, el: El) {
    const st = this.game.state;
    const card = CARDS[hc.cardId];
    const ghost = h('div', { class: 'ghost' }, card.type === 'creature' ? FSYM(card.faction) : card.type === 'spell' ? '✨' : '💎');
    this.drag(e, {
      ghost,
      touchSwipe: (dx) => { this.handScroll -= dx / 40; this.layoutHand(); },
      onStart: () => {
        if (this.pick || this.respDlg) return false;
        el.classList.add('dragging');
        const legal = this.game.legalActions().filter((a: any) => a.uid === hc.uid);
        if (!legal.length) { this.flash(this.explain(card)); }
        const cells: any[] = [];
        let any = false;
        for (const a of legal) {
          if (a.type === 'summon') cells.push({ row: a.row, col: a.col });
          else if (a.type === 'cast') { if (!a.target) any = true; else if (!a.to || true) cells.push(this.cellOfTarget(a.target)); }
          else if (a.type === 'playCrystal') any = true;
        }
        this.setGlow(cells, 'glow');
        if (any) this.r.board.classList.add('drop-any');
        return true;
      },
      onDrop: (cell) => { if (cell && cell.row) this.dropCard(hc, card, cell); },
      onTap: () => this.showCard(card.id),
    });
    void st;
  }

  explain(card: any) {
    const st = this.game.state;
    if (st.activePlayer !== 'player') return "It's not your turn";
    if (card.type === 'creature' && st.phase !== 'deploy') return 'Creatures are summoned in the Deploy phase';
    if (card.type === 'crystal') return st.phase !== 'deploy' ? 'Crystal cards are played in the Deploy phase' : 'Only one Crystal card per turn';
    return "You can't play that right now";
  }

  dropCard(hc: any, card: any, cell: { row: number; col: number }) {
    const legal = this.game.legalActions().filter((a: any) => a.uid === hc.uid);
    if (!legal.length) { this.flash(this.explain(card)); return; }
    const t = legal[0].type;
    const res = (r: any) => { if (r && !r.ok) this.flash(r.error); };
    if (t === 'summon') {
      const a = legal.find((x: any) => x.row === cell.row && x.col === cell.col);
      if (a) res(this.game.act(a)); else this.flash("Can't summon there");
    } else if (t === 'playCrystal') {
      if (legal.length === 1) res(this.game.act(legal[0]));
      else this.chooseColors(legal);
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

  chooseColors(legal: any[]) {
    const d: any = this.dialog('Choose crystals', [h('h2', {}, 'Choose crystals'), h('div', { class: 'row' },
      ...legal.map((a: any) => h('button', { type: 'button', class: 'combo', onclick: () => { d.close(); this.game.act(a); } },
        COLOR_NAMES.filter((c) => a.colors[c]).map((c) => `${a.colors[c]} ${c}`).join(' + '))))]);
  }

  boardPointerDown(e: PointerEvent) {
    const st = this.game.state;
    if (!st) return;
    const cell = this.cellAt(e.clientX, e.clientY);
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
    this.drag(e, {
      ghost,
      onStart: () => {
        if (!mine || this.respDlg) return false;
        const legal = this.game.legalActions().filter((a: any) => a.creatureUid === cr.uid);
        this.setGlow(legal.filter((a: any) => a.type === 'move').map((a: any) => ({ row: a.row, col: a.col })), 'glow');
        this.setGlow(legal.filter((a: any) => a.type === 'attack').map((a: any) => this.cellOfTarget(a.target)), 'glow-attack');
        if (!legal.some((a: any) => a.type === 'move' || a.type === 'attack')) this.flash(st.phase === 'movement' || st.phase === 'attack' ? 'This creature cannot act now' : 'Move in the Movement phase, attack in the Attack phase');
        return true;
      },
      onDrop: (c) => {
        if (!c || !c.row) return;
        const legal = this.game.legalActions().filter((a: any) => a.creatureUid === cr.uid);
        const atk = legal.find((a: any) => a.type === 'attack' && ((a.target.commander && c.row === (a.target.commander === 'player' ? 7 : 1) && c.col === 4) || (a.target.row === c.row && a.target.col === c.col)));
        const mv = legal.find((a: any) => a.type === 'move' && a.row === c.row && a.col === c.col);
        const a = atk || mv;
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
        this.tapTimer = setTimeout(() => { if (mine) this.upgradeMenu(cr); }, 400);
      },
    });
  }

  upgradeMenu(cr: any) {
    const st = this.game.state;
    if (!st || st.phase !== 'deploy' || st.activePlayer !== 'player' || st.priority !== 'player' || this.dialogs.length) return;
    const card = CARDS[cr.cardId];
    const legal = this.game.legalActions().filter((a: any) => a.type === 'upgrade' && a.creatureUid === cr.uid);
    const list = h('div', { class: 'menu-list' });
    if (cr.upgrade) list.append(h('p', { style: 'text-align:center;margin:0' }, `Already upgraded: ${CONFIG.upgrades[cr.upgrade].name}`));
    else if (!legal.length) list.append(h('p', { style: 'text-align:center;margin:0' }, 'Not enough crystals for an upgrade.'));
    const d: any = this.dialog(`${card.name}`, [h('h2', {}, card.name), h('button', { type: 'button', class: 'btn primary', 'aria-expanded': 'true' }, 'Upgrade'), list,
      h('div', { class: 'row' }, btn('Cancel', '', () => d.close()))]);
    for (const a of legal) {
      const u = CONFIG.upgrades[a.upgrade];
      list.append(btn(`${u.name} (${CONFIG.upgradeCosts[a.upgrade]})`, '', () => { d.close(); const r = this.game.act(a); if (!r.ok) this.flash(r.error!); }, { 'data-upgrade': a.upgrade }));
    }
  }
}

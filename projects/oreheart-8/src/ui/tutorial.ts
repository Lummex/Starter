// Tutorial (Ken, Nov 1): graphic, not wordy: "explain it to a five-year-old", and the player physically DOES every step.
// Each lesson is its own small scripted board (the enemy only passes). A big picture card shows the idea in one line, then the
// player does it on the real board while Brush's pointing hand shows the gesture; the next lesson unlocks only when it was done.
// Pictures: public/art/tutorial/ (Brush, Nov 1; the goblin is always the player, the dwarf the enemy).
import { TUTORIAL_ORDER, markTutorialDone, maxMove } from '../engine';
import { chaseList } from '../engine/orders';
import { orderSvg, restTargetSvg, questionSvg, guardSvg } from './order-draw';

type Cell = { row: number; col: number };
type El = HTMLElement;
const PIC = (n: string) => `/art/tutorial/${n}.webp`;
const MINES = [{ row: 3, col: 5 }, { row: 4, col: 7 }, { row: 5, col: 9 }];
const ENEMY_SH: Cell = { row: 1, col: 12 };
const P = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
const many = (id: string, n: number) => Array(n).fill(id);

export interface Lesson {
  step: string; n: number; pics: string[];
  /** the one line on the picture card (and on the reminder unless `doSay` replaces it) */
  say: string; sub?: string; doSay?: string;
  /** chase: the line once the order is drawn */
  wait?: string; waitSub?: string;
  /** shown under the "Nice!" stamp */
  after?: string;
  board: any[]; hand?: string[]; crystals?: number;
  /** starts in the Action phase (and later Deploy phases pass by themselves) */
  action: boolean;
  target?: Cell;
  /** wait for the swing stickers before the stamp */
  slow?: boolean;
}
export const LESSON_COUNT = 8;
export const LESSONS: Lesson[] = [
  { step: 'card', n: 1, pics: ['card-drag'], say: 'Drag a card onto the board.', hand: ['goblin-grunt'], crystals: 3, board: [], action: false, target: { row: 7, col: 6 } },
  { step: 'move', n: 2, pics: ['walk-move-points'], say: 'Drag your goblin to walk.', sub: 'Each foot = 1 step a turn.', board: [P('goblin-grunt', 6, 4)], action: true, target: { row: 6, col: 7 } },
  { step: 'order', n: 3, pics: ['marker-move'], say: 'Drag far away.', sub: 'Green line = walk there.', board: [P('goblin-grunt', 6, 3)], action: true, target: { row: 2, col: 9 } },
  { step: 'chase', n: 3, pics: ['marker-chase'], say: 'Drag onto the dwarf.', sub: 'Red line = chase and hit!', wait: 'It keeps going every turn.', waitSub: 'Press Done.', after: 'It attacked by itself!', board: [P('goblin-grunt', 6, 2), O('dwarf-pickman', 6, 8)], action: true, slow: true },
  { step: 'chain', n: 4, pics: ['chain-targets'], say: 'Drag onto a dwarf.', sub: 'Then tap two more: 1, 2, 3!', board: [P('goblin-grunt', 6, 3), O('dwarf-pickman', 3, 8), O('dwarf-pickman', 2, 10), O('dwarf-pickman', 5, 11)], action: true },
  { step: 'ranged', n: 5, pics: ['ranged-shot'], say: 'Archers shoot along straight lines.', sub: 'One shot. Extra Attack = Bleed.', board: [P('goblin-slinger', 6, 3), O('dwarf-pickman', 6, 8), O('dwarf-pickman', 3, 7)], action: true, slow: true },
  { step: 'fight', n: 6, pics: ['swing-hit', 'swing-miss', 'block'], say: 'Every swing rolls a die.', doSay: 'Attack the dwarf. Watch each swing!', after: "Dice! A 2 doesn't always kill a 2.", board: [P('goblin-grunt', 5, 5), O('barrelback-courier', 4, 5, { damage: 1 })], action: true, slow: true },
  { step: 'commander', n: 7, pics: ['commander-retreat'], say: 'Hit the enemy Commander!', sub: 'Take him from 20 to 0 to win.', after: 'Keep hitting. At 0 he runs away!', board: [P('goblin-grunt', 2, 11)], action: true, slow: true },
  { step: 'swap', n: 8, pics: ['hand-pointing'], say: 'Swap a card for a Miner.', sub: '1 Crystal (3 with 3 Miners).', hand: ['goblin-grunt'], crystals: 1, board: [], action: false },
];
const STAMPS = ['NICE!', 'GREAT!', 'YES!', 'WOW!', 'SUPER!', 'BOOM!', 'AWESOME!', 'TA-DA!', 'YES!'];

/** The match options of one lesson (a scripted match: the enemy only passes). */
export function lessonOptions(L: Lesson) {
  return {
    playerCommander: 'grubnak', opponentCommander: 'borgo', mines: MINES, seed: 1, difficulty: 'easy', tutorial: L.step, tutorialInfo: L.target ? { target: L.target } : {},
    setup: { firstPlayer: 'player', board: L.board, playerHand: L.hand || [], playerCrystals: L.crystals || 0, opponentHand: [],
      playerDeck: L.step === 'swap' ? ['goblin-scrounger', ...many('goblin-grunt', 5)] : many('goblin-grunt', 6), opponentDeck: many('dwarf-pickman', 6) },
  };
}

/** Orders may be drawn from the order lesson on (before that the lessons keep to one thing). */
export function tutorialOrders(st: any) { return !!st?.tutorial && TUTORIAL_ORDER.indexOf(st.tutorial.step) >= TUTORIAL_ORDER.indexOf('order'); }
/** The order runner (orders-run.ts) never acts in a tutorial match; in the order lessons it gets this view of the game, which hides the tutorial flag. */
export function tutorialGame(game: any): any {
  return new Proxy(game, {
    get(t: any, k: string | symbol) {
      if (k === 'state') { const s = t.state; return s && s.tutorial ? { ...s, tutorial: null } : s; }
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

const h = (tag: string, attrs: Record<string, any> = {}, ...kids: (El | string | null | false)[]) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, String(v));
  for (const c of kids) if (c) e.append(c);
  return e as El;
};
const button = (label: string, cls: string, on: (e: Event) => void, attrs: Record<string, any> = {}) => {
  const b = h('button', { type: 'button', class: 'btn ' + cls, ...attrs }, label);
  b.addEventListener('click', (e) => { e.stopPropagation(); on(e); });
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  return b;
};
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const die = (n: number) => { const d = h('span', { class: 'tut-die', 'data-n': n, 'aria-label': String(n) }); for (let i = 0; i < 9; i++) d.append(h('i', PIPS[n].includes(i) ? { class: 'on' } : {})); return d; };
const dice = (ns: number[]) => h('span', { class: 'tut-dice' }, ...ns.map(die));
const FOOT = '<svg viewBox="0 0 24 32" aria-hidden="true"><ellipse cx="12" cy="20" rx="7" ry="10"/><circle cx="5" cy="6" r="2.4"/><circle cx="10" cy="3.6" r="2.6"/><circle cx="15.5" cy="4" r="2.3"/><circle cx="19.5" cy="7.5" r="2"/></svg>';

/** The three swing results with their dice (picture card) or as a small key (reminder). */
function swingKey(big: boolean) {
  const item = (pic: string, word: string, cls: string, ns: number[], note?: string) => h('figure', { class: 'tut-swing ' + cls },
    big ? h('img', { class: 'tut-pic', src: PIC(pic), alt: word, draggable: 'false' }) : null,
    h('figcaption', {}, h('b', {}, word), dice(ns), note ? h('small', {}, note) : null));
  return h('div', { class: 'tut-swings' + (big ? ' big' : '') },
    item('swing-hit', 'HIT', 'hit', [3, 4, 5, 6]),
    item('swing-miss', 'MISS', 'miss', [1, 2]),
    item('block', 'BLOCK', 'block', [1, 6], big ? '1 die per heart (max 3). Shields: 2 too.' : 'die per heart, max 3'));
}

/** The marker signs (drawn with the same pen as the real orders, order-draw.ts). */
function legendGrid() {
  const svg = (inner: string) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 120 90'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = inner; return s as unknown as El; };
  const line = (kind: 'move' | 'chase', ranged = false) => orderSvg({ uid: 'legend-' + kind + (ranged ? 'b' : ''), kind, pts: [{ x: 10, y: 74 }, { x: 40, y: 58 }, { x: kind === 'move' ? 70 : 78, y: kind === 'move' ? 46 : 44 }], end: kind === 'move' ? { x: 70, y: 46 } : { x: 78, y: 44 }, cw: 46, ch: 36, preview: false, blocked: false, ranged });
  const items: [string, string, string][] = [
    ['move', 'Walk here', line('move')],
    ['melee', 'Melee attack', line('chase')],
    ['ranged', 'Ranged attack', line('chase', true)],
    ['target', 'Target', restTargetSvg({ x: 60, y: 50 }, 64, 44)],
    ['guard', 'Guard', guardSvg({ x: 60, y: 50 }, 64, 44, 'legend')],
    ['none', 'No orders yet', questionSvg({ x: 60, y: 88 }, 64, 50, 'legend')],
  ];
  return h('ul', { class: 'tut-legend', 'aria-label': 'Marker signs' }, ...items.map(([k, label, inner]) => h('li', { 'data-sign': k }, svg(inner), h('span', {}, label))));
}

type Mode = 'intro' | 'do' | 'wait' | 'yay' | 'legend' | 'final';
export class Tutorial {
  app: any;
  i = 0;
  mode: Mode = 'intro';
  private loopId: any = 0;
  private timers: any[] = [];
  private tipKey = '';
  private autoKey = '';
  private gestureKey = '';
  constructor(app: any) { this.app = app; }
  get lesson() { return LESSONS[this.i]; }
  get fast() { return !!this.app.test; }

  /** Start the tutorial (at a lesson's step for checks; normally the first). */
  begin(step?: string) {
    const k = LESSONS.findIndex((l) => l.step === step);
    this.i = k >= 0 ? k : 0;
    this.app.arenaFaction = '';
    return this.startLesson();
  }
  startLesson() {
    this.stopTimers();
    const L = this.lesson;
    this.mode = 'intro'; this.tipKey = ''; this.autoKey = ''; this.gestureKey = '';
    const st = this.app.startTutorialLesson(lessonOptions(L));
    if (L.action) this.app.game.act({ type: 'done' });
    this.app.renderTip(this.app.game.state);
    this.startLoop();
    return st;
  }
  stopTimers() { for (const t of this.timers) clearTimeout(t); this.timers = []; }
  later(ms: number, f: () => void) { this.timers.push(setTimeout(f, ms)); }
  startLoop() {
    clearInterval(this.loopId);
    this.loopId = setInterval(() => this.poll(), 250);
  }
  stop() { clearInterval(this.loopId); this.loopId = 0; this.stopTimers(); }
  get match(): El | null { const tip = this.app.r?.tip as El | undefined; return tip && tip.isConnected ? (tip.parentElement as El) : null; }
  get unit() { return this.app.game.state?.board.creatures.find((c: any) => c.owner === 'player'); }
  get foes() { return (this.app.game.state?.board.creatures || []).filter((c: any) => c.owner === 'opponent'); }

  /** Every 250 ms: the drawn-order goals (UI only), and the pointer follows the camera. Stops when the tutorial screen is gone. */
  poll() {
    const st = this.app.game.state;
    if (!st || !st.tutorial || !this.match) { if (!st || !st.tutorial) this.stop(); return; }
    const L = this.lesson;
    if (st.tutorial.step === L.step && !st.tutorial.done && (this.mode === 'do' || this.mode === 'wait')) {
      const orders: any[] = [...this.app.orders.values()];
      if (L.step === 'order' && orders.some((o) => o.kind === 'move')) { markTutorialDone(st); }
      if (L.step === 'chain' && orders.some((o) => o.kind === 'chase' && chaseList(o).length >= 3)) { markTutorialDone(st); }
      if (L.step === 'chase' && this.mode === 'do' && orders.some((o) => o.kind === 'chase')) { this.mode = 'wait'; this.tipKey = ''; }
    }
    this.render(st);
  }

  /** Called by the app on every match update (renderTip) and by the poll. */
  render(st: any, tip: El = this.app.r?.tip) {
    if (!tip) return;
    if (!st || !st.tutorial) { tip.hidden = true; return; }
    const L = this.lesson;
    if (st.tutorial.step !== L.step && st.tutorial.step !== 'complete') { const k = LESSONS.findIndex((l) => l.step === st.tutorial.step); if (k >= 0 && k !== this.i) { this.i = k; this.mode = 'intro'; this.tipKey = ''; } }
    // the lessons that start in the Action phase pass their later Deploy phases by themselves
    if (L.action && st.phase === 'deploy' && st.activePlayer === 'player' && st.priority === 'player' && !st.pendingResponse && st.phase !== 'over') {
      const key = `${st.turn}`;
      if (this.autoKey !== key) { this.autoKey = key; this.later(this.fast ? 0 : 500, () => { const s = this.app.game.state; if (s && s.tutorial && s.phase === 'deploy' && s.activePlayer === 'player' && s.priority === 'player') this.app.game.act({ type: 'done' }); }); }
    }
    if (st.tutorial.done && (this.mode === 'intro' || this.mode === 'do' || this.mode === 'wait')) this.finishLesson();
    this.renderTipBox(st, tip);
    this.renderCard();
    this.renderPointer(st);
  }

  finishLesson() {
    this.mode = 'yay';
    const L = this.lesson;
    this.later(this.fast ? 150 : L.slow ? 2600 : 700, () => {
      this.stamp(STAMPS[this.i % STAMPS.length], L.after);
      this.later(this.fast ? 200 : L.after ? 2400 : 1300, () => {
        if (this.i + 1 < LESSONS.length) { this.i++; this.startLesson(); } else { this.mode = 'legend'; this.render(this.app.game.state); }
      });
    });
    this.render(this.app.game.state);
  }
  stamp(word: string, after?: string) {
    const m = this.match;
    if (!m) return;
    m.querySelector('.tut-yay')?.remove();
    const s = h('div', { class: 'tut-yay', role: 'status' }, h('span', { class: 'tut-yay-word' }, word), after ? h('span', { class: 'tut-yay-sub' }, after) : null);
    m.append(s);
  }

  /** The small reminder box (the old "Tutorial tip": it can be dragged anywhere or shrunk, so it never blocks play). */
  renderTipBox(st: any, tip: El) {
    const L = this.lesson;
    const show = this.mode === 'do' || this.mode === 'wait' || this.mode === 'yay';
    tip.hidden = !show;
    tip.classList.add('tut-tip');
    tip.classList.toggle('tip-small', !!this.app.tipMin);
    if (!show) return;
    const u = this.unit;
    const feet = L.step === 'move' && u ? `${maxMove(u)}:${u.movesLeft ?? 0}` : '';
    const key = `${L.step}|${this.mode}|${feet}|${this.app.tipMin ? 1 : 0}`;
    if (key === this.tipKey && tip.childElementCount) return;
    this.tipKey = key;
    tip.dataset.step = L.step;
    this.app.tipMovable(tip);
    const say = this.mode === 'wait' ? L.wait! : L.doSay || L.say, sub = this.mode === 'wait' ? L.waitSub : L.doSay ? '' : L.sub;
    const kids: (El | null)[] = [
      h('div', { class: 'tip-bar' }, h('span', { class: 'tip-grip', 'aria-hidden': 'true' }, `⠿ Lesson ${L.n} of ${LESSON_COUNT}`),
        button(this.app.tipMin ? '▢' : '–', 'tip-min', () => { this.app.tipMin = !this.app.tipMin; this.tipKey = ''; this.render(this.app.game.state); }, { 'aria-label': this.app.tipMin ? 'Show tip' : 'Shrink tip' })),
      L.step === 'fight' ? swingKey(false) : h('img', { class: 'tut-pic tut-tip-pic', src: PIC(L.pics[0]), alt: '', draggable: 'false' }),
      h('p', { class: 'tip-text tut-say' }, say),
      sub ? h('p', { class: 'tut-sub' }, sub) : null,
    ];
    if (feet && u) {
      const n = maxMove(u) || 0, left = u.movesLeft ?? 0;
      const meter = h('div', { class: 'tut-feet', role: 'img', 'aria-label': `${left} of ${n} steps left` });
      for (let k = 0; k < n; k++) { const f = h('span', { class: 'tut-foot' + (k < left ? ' on' : '') }); f.innerHTML = FOOT; meter.append(f); }
      kids.push(meter);
    }
    kids.push(button('Skip Tutorial', 'tip-skip', () => { this.stop(); this.app.showMenu(); }));
    tip.replaceChildren(...kids.filter(Boolean) as El[]);
    this.app.tipPlace(tip);
  }

  /** The big picture card: the lesson's picture(s) and one line, "Try it!"; also the marker legend and the last screen. */
  renderCard() {
    const m = this.match;
    if (!m) return;
    const want = this.mode === 'intro' || this.mode === 'legend' || this.mode === 'final';
    const old = m.querySelector('.tut-intro') as El | null;
    const key = `${this.i}|${this.mode}`;
    if (!want) { old?.remove(); return; }
    if (old && old.dataset.key === key) return;
    old?.remove();
    const L = this.lesson;
    const dots = h('div', { class: 'tut-dots', 'aria-label': `Lesson ${Math.min(L.n, LESSON_COUNT)} of ${LESSON_COUNT}` }, ...Array.from({ length: LESSON_COUNT }, (_, k) => h('i', { class: k + 1 < L.n || this.mode !== 'intro' ? 'done' : k + 1 === L.n ? 'now' : '' })));
    let card: El;
    if (this.mode === 'intro') {
      card = h('div', { class: 'tut-card', role: 'dialog', 'aria-label': `Lesson ${L.n}`, 'data-step': L.step }, dots,
        L.step === 'fight' ? swingKey(true) : h('img', { class: 'tut-pic tut-big-pic', src: PIC(L.pics[0]), alt: '', draggable: 'false' }),
        h('p', { class: 'tut-say' }, L.say), L.sub ? h('p', { class: 'tut-sub' }, L.sub) : null,
        h('div', { class: 'tut-row' }, button('Try it!', 'primary tut-go', () => { this.mode = 'do'; this.tipKey = ''; this.render(this.app.game.state); }),
          button('Skip Tutorial', 'tut-skip', () => { this.stop(); this.app.showMenu(); })));
    } else if (this.mode === 'legend') {
      card = h('div', { class: 'tut-card tut-legend-card', role: 'dialog', 'aria-label': 'Marker signs' }, dots,
        h('p', { class: 'tut-say' }, 'Marker signs'), legendGrid(),
        h('div', { class: 'tut-row' }, button('Finish!', 'primary tut-go', () => { this.complete(); })));
    } else {
      card = h('div', { class: 'tut-card tut-final', role: 'dialog', 'aria-label': "You're ready!" },
        h('img', { class: 'tut-pic tut-big-pic', src: PIC('commander-retreat'), alt: '', draggable: 'false' }),
        h('p', { class: 'tut-say' }, "You're ready!"),
        h('div', { class: 'tut-row' }, button('Play', 'primary tut-go', () => { this.stop(); this.app.showSetup(); }), button('Menu', 'tut-skip', () => { this.stop(); this.app.showMenu(); })));
    }
    const wrap = h('div', { class: 'tut-intro', 'data-key': key }, card);
    for (const t of ['pointerdown', 'click', 'mousedown', 'touchstart', 'wheel'] as const) wrap.addEventListener(t, (e) => e.stopPropagation());
    m.append(wrap);
    (card.querySelector('.tut-go') as El | null)?.focus?.();
  }
  complete() {
    const st = this.app.game.state;
    if (st && st.tutorial) { st.tutorial.step = 'complete'; st.tutorial.done = true; }
    this.mode = 'final';
    this.render(st);
  }

  // ---------------------------------------------------------------- the pointing hand
  /** client point -> a point in the match area (it may be scaled to fit the window) */
  local(p: { x: number; y: number } | null) {
    const m = this.match;
    if (!m || !p) return null;
    const r = m.getBoundingClientRect(), k = m.offsetWidth ? r.width / m.offsetWidth : 1;
    return { x: (p.x - r.left) / k, y: (p.y - r.top) / k };
  }
  sq(c: Cell | null | undefined) { return c ? this.local(this.app.squareToScreen(c.row, c.col)) : null; }
  elPt(el: Element | null | undefined) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    return this.local({ x: r.left + r.width / 2, y: (r.top + Math.min(r.bottom, window.innerHeight)) / 2 });
  }
  handCard() { return this.match?.querySelector('.hand .hand-card:not(.popclone)') || null; }
  /** What to show right now: a drag (from -> to) or a tap (at), plus the ring. */
  gesture(st: any): { from?: any; to: any; tap?: boolean } | null {
    const L = this.lesson, u = this.unit;
    if (st.activePlayer !== 'player' || st.phase === 'over') return null;
    const near = (a: any, b: any) => Math.max(Math.abs(a.row - u.row), Math.abs(a.col - u.col)) - Math.max(Math.abs(b.row - u.row), Math.abs(b.col - u.col));
    switch (L.step) {
      case 'card': return st.phase === 'deploy' ? { from: this.elPt(this.handCard()), to: this.sq(L.target) } : null;
      case 'move': case 'order': return u && st.phase === 'action' ? { from: this.sq(u), to: this.sq(L.target) } : null;
      case 'chase':
        if (this.mode === 'wait') return st.phase === 'action' && st.priority === 'player' ? { to: this.elPt(this.app.r?.done), tap: true } : null;
        return u && this.foes[0] ? { from: this.sq(u), to: this.sq(this.foes[0]) } : null;
      case 'chain': {
        if (!u) return null;
        const o: any = this.app.orders.get(u.uid);
        const foes = this.foes.slice().sort(near);
        if (!o || o.kind !== 'chase') return foes[0] ? { from: this.sq(u), to: this.sq(foes[0]) } : null;
        const next = foes.find((f: any) => !chaseList(o).includes(f.uid));
        return next ? { to: this.sq(next), tap: true } : null;
      }
      case 'ranged': case 'fight': return u && this.foes[0] ? { from: this.sq(u), to: this.sq(this.foes[0]) } : null;
      case 'commander': return u ? { from: this.sq(u), to: this.sq(ENEMY_SH) } : null;
      case 'swap': {
        if (st.phase !== 'deploy') return null;
        if (this.app.swapping) return { to: this.elPt(this.handCard()), tap: true };
        const b = this.app.r?.swap as El | undefined;
        return b && !b.hidden ? { to: this.elPt(b), tap: true } : null;
      }
    }
    return null;
  }
  renderPointer(st: any) {
    const m = this.match;
    if (!m) return;
    let layer = m.querySelector('.tut-layer') as El | null;
    if (!layer) { layer = h('div', { class: 'tut-layer', 'aria-hidden': 'true' }); m.append(layer); this.gestureKey = ''; }
    const on = (this.mode === 'do' || this.mode === 'wait') && !st.pendingResponse;
    const g = on ? this.gesture(st) : null;
    const L = this.lesson;
    const lines = on && L.step === 'ranged' ? this.rangedLines(st) : '';
    const key = g && g.to ? `${g.tap ? 't' : 'd'}|${g.from ? Math.round(g.from.x / 4) + ',' + Math.round(g.from.y / 4) : ''}|${Math.round(g.to.x / 4)},${Math.round(g.to.y / 4)}|${lines.length}` : 'none|' + lines.length;
    if (key === this.gestureKey) return;
    this.gestureKey = key;
    layer.replaceChildren();
    if (lines) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'tut-lines'); s.innerHTML = lines; layer.append(s as unknown as El); }
    if (!g || !g.to) return;
    const ring = h('div', { class: 'tut-ring' + (g.tap ? ' tap' : '') });
    ring.style.left = g.to.x + 'px'; ring.style.top = g.to.y + 'px';
    const hand = h('img', { class: 'tut-hand', src: PIC('hand-pointing'), alt: '', draggable: 'false' }) as HTMLImageElement;
    layer.append(ring, hand);
    const at = (p: any, s = 1) => `translate(${p.x}px, ${p.y}px) translate(-44%, -86%) scale(${s})`; // the fingertip sits at 44 % / 86 % of Brush's picture
    if (g.tap || !g.from) {
      hand.style.transform = at(g.to);
      hand.animate?.([{ transform: at({ x: g.to.x, y: g.to.y - 22 }) }, { transform: at(g.to, 0.92), offset: 0.45 }, { transform: at({ x: g.to.x, y: g.to.y - 22 }) }], { duration: 1100, iterations: Infinity, easing: 'ease-in-out' });
    } else {
      hand.style.transform = at(g.from);
      hand.animate?.([
        { transform: at(g.from), opacity: 0 }, { transform: at(g.from), opacity: 1, offset: 0.08 }, { transform: at(g.from, 0.9), offset: 0.2 },
        { transform: at(g.to, 0.9), offset: 0.72 }, { transform: at(g.to, 1), opacity: 1, offset: 0.84 }, { transform: at(g.to, 1), opacity: 0 },
      ], { duration: 2200, iterations: Infinity, easing: 'ease-in-out' });
    }
  }
  /** Lesson 5: the archer's 8 straight lines (blue), up to 7 squares, stopping at the first unit. */
  rangedLines(st: any) {
    const u = this.unit;
    if (!u) return '';
    const c0 = this.sq(u);
    if (!c0) return '';
    let out = '';
    for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
      let end: any = null, hitFoe = false;
      for (let k = 1; k <= 7; k++) {
        const r = u.row + dr * k, c = u.col + dc * k;
        if (r < 1 || r > 7 || c < 1 || c > 13) break;
        end = { row: r, col: c };
        const o = st.board.creatures.find((x: any) => x.row === r && x.col === c);
        if (o || (r === 7 && c === 2) || (r === 1 && c === 12)) { hitFoe = !!o && o.owner !== 'player'; break; }
      }
      const p = this.sq(end);
      if (!p) continue;
      out += `<line x1="${c0.x.toFixed(1)}" y1="${c0.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="${hitFoe ? 'hit' : ''}"/>`;
    }
    return out;
  }
}

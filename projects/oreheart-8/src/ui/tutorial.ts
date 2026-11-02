// Tutorial (Ken, Nov 1): graphic, not wordy: "explain it to a five-year-old", and the player physically DOES every step.
// Each lesson is its own small scripted board (the enemy only passes). A big picture card shows the idea, then the game "talks" to the
// player: one short line at a time in big lettering (no text box), while Brush's pointing hand sits on the REAL control or animates the
// real drag from start to end. Every beat waits until the player has clicked / dragged it ("Click on this to end your turn").
// Pictures: public/art/tutorial/ (Brush, Nov 1; the goblin is always the player, the dwarf the enemy).
import { TUTORIAL_ORDER, markTutorialDone, maxMove } from '../engine';
import { chaseList } from '../engine/orders';
import { orderSvg, restTargetSvg, questionSvg, guardSvg } from './order-draw';

type Cell = { row: number; col: number };
type El = HTMLElement;
type Pt = { x: number; y: number };
const PIC = (n: string) => `/art/tutorial/${n}.webp`;
const MINES = [{ row: 3, col: 5 }, { row: 4, col: 7 }, { row: 5, col: 9 }];
const ENEMY_SH: Cell = { row: 1, col: 12 };
const P = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
const many = (id: string, n: number) => Array(n).fill(id);

/** What the pointing hand shows: a drag from -> to (animated, start to end) or a tap on `to`; `at` = the board square for the ring. */
export interface Gesture { from?: Pt | null; to: Pt | null; tap?: boolean; at?: Cell; el?: Element | null }
/** One beat: one short spoken line; done when `goal` is true, or (tap beats) when the player presses the pointed control. */
export interface Beat {
  say: string; sub?: string;
  goal?: (t: Tutorial, st: any) => boolean;
  /** the real control the player must press to go on */
  tap?: (t: Tutorial, st: any) => Element | null | undefined;
  /** the drag / tap the hand shows (tap beats point at their control by themselves) */
  show?: (t: Tutorial, st: any) => Gesture | null;
}
export interface Lesson {
  step: string; n: number; pics: string[];
  /** the line on the big picture card */
  say: string; sub?: string;
  beats: Beat[];
  /** shown under the "Nice!" stamp */
  after?: string;
  board: any[]; hand?: string[]; crystals?: number;
  /** starts in the Action phase (and later Deploy phases pass by themselves) */
  action: boolean;
  target?: Cell;
  /** wait for the swing stickers before the stamp */
  slow?: boolean;
}

const done = (_t: Tutorial, st: any) => !!st.tutorial?.done;
const dragUnitTo = (c: (t: Tutorial, st: any) => Cell | null | undefined) => (t: Tutorial, st: any): Gesture | null => {
  const u = t.unit, to = c(t, st);
  return u && to && st.phase === 'action' ? { from: t.sq(u), to: t.sq(to), at: to } : null;
};
const firstFoe = (t: Tutorial) => t.foes[0];
const ctl = (k: string) => (t: Tutorial) => t.app.r?.[k] as El | undefined;
const orderOf = (t: Tutorial) => (t.unit ? t.app.orders.get(t.unit.uid) : null);
const chainLen = (t: Tutorial) => { const o: any = orderOf(t); return o && o.kind === 'chase' ? chaseList(o).length : 0; };
const nextFoe = (t: Tutorial) => { const o: any = orderOf(t), u = t.unit; if (!u) return null; const d = (a: any) => Math.max(Math.abs(a.row - u.row), Math.abs(a.col - u.col)); return t.foes.slice().sort((a: any, b: any) => d(a) - d(b)).find((f: any) => !o || o.kind !== 'chase' || !chaseList(o).includes(f.uid)) || null; };
const tapFoe = (t: Tutorial): Gesture | null => { const f = nextFoe(t); return f ? { to: t.sq(f), tap: true, at: f } : null; };

export const LESSONS: Lesson[] = [
  { step: 'card', n: 1, pics: ['card-drag'], say: 'Drag a card onto the board.', hand: ['goblin-grunt'], crystals: 3, board: [], action: false, target: { row: 7, col: 6 },
    beats: [{ say: 'Drag this card onto the board.', goal: done, show: (t, st) => (st.phase === 'deploy' ? { from: t.elPt(t.handCard()), to: t.sq(t.lesson.target), at: t.lesson.target } : null) }] },
  // a whole turn, pressing every match control once
  { step: 'controls', n: 2, pics: ['hand-pointing'], say: 'Your controls.', sub: 'Tap each one I point at.', board: [], action: false,
    beats: [
      { say: 'This is your Flow.', sub: 'It pays for your cards.', tap: (t) => t.app.root?.querySelector('[data-role=player-flow-crystal]') || t.app.r?.crFlow },
      { say: 'Your turn has phases.', sub: 'Each one has a timer.', tap: ctl('phase') },
      { say: 'Tap Menu: settings and sound.', tap: ctl('menuBtn') },
      { say: 'Tap Menu again to close it.', tap: ctl('menuBtn') },
      { say: 'Click Done to end this phase.', tap: ctl('done'), goal: (_t, st) => st.phase !== 'deploy' },
      { say: 'Click Done to end your turn.', tap: ctl('done'), goal: (_t, st) => st.activePlayer !== 'player' || st.turn > 1 },
      { say: 'Now the enemy takes a turn…', goal: (_t, st) => st.turn > 1 && st.activePlayer === 'player' },
    ] },
  { step: 'move', n: 3, pics: ['walk-move-points'], say: 'Drag your goblin to walk.', sub: 'Each foot = 1 step a turn.', board: [P('goblin-grunt', 6, 4)], action: true, target: { row: 6, col: 7 },
    beats: [{ say: 'Drag your goblin to walk.', sub: 'Each foot = 1 step a turn.', goal: done, show: dragUnitTo((t) => t.lesson.target) }] },
  { step: 'order', n: 4, pics: ['marker-move'], say: 'Drag far away.', sub: 'Green line = walk there.', board: [P('goblin-grunt', 6, 3)], action: true, target: { row: 2, col: 9 },
    beats: [
      { say: 'Tap your goblin.', goal: (t) => !!t.app.stanceBar, show: (t) => (t.unit ? { to: t.sq(t.unit), tap: true, at: t.unit } : null) },
      { say: 'Pick how it acts.', sub: 'Guard: it stays and protects.', goal: (t) => !!t.unit && t.app.stances.get(t.unit.uid) === 'guard', show: (t) => { const b = t.app.stanceBar?.querySelector('[data-stance=guard]'); return b ? { to: t.elPt(b), tap: true, el: b } : null; } },
      { say: 'Now drag it far away.', sub: 'Green line = walk there.', goal: (t) => [...t.app.orders.values()].some((o: any) => o.kind === 'move'), show: dragUnitTo((t) => t.lesson.target) },
    ] },
  { step: 'chase', n: 4, pics: ['marker-chase'], say: 'Drag onto the dwarf.', sub: 'Red line = chase and hit!', after: 'It attacked by itself!', board: [P('goblin-grunt', 6, 2), O('dwarf-pickman', 6, 8)], action: true, slow: true,
    beats: [
      { say: 'Drag onto the dwarf.', sub: 'Red line = chase and hit!', goal: (t) => (orderOf(t) as any)?.kind === 'chase' || done(t, t.app.game.state), show: dragUnitTo(firstFoe) },
      { say: 'It keeps going every turn.', sub: 'Click Done to end your turn.', goal: done, show: (t, st) => (st.activePlayer === 'player' && st.phase === 'action' && st.priority === 'player' ? { to: t.elPt(t.app.r?.done), tap: true, el: t.app.r?.done } : null) },
    ] },
  { step: 'chain', n: 5, pics: ['chain-targets'], say: 'One goblin, many targets.', sub: '1, 2, 3!', board: [P('goblin-grunt', 6, 3), O('dwarf-pickman', 3, 8), O('dwarf-pickman', 2, 10), O('dwarf-pickman', 5, 11)], action: true,
    beats: [
      { say: 'Drag onto a dwarf.', goal: (t) => chainLen(t) >= 1, show: (t, st) => dragUnitTo(() => nextFoe(t))(t, st) },
      { say: 'Tap another dwarf: number 2!', goal: (t) => chainLen(t) >= 2, show: tapFoe },
      { say: 'And one more: number 3!', goal: (t) => chainLen(t) >= 3, show: tapFoe },
    ] },
  { step: 'ranged', n: 6, pics: ['ranged-shot'], say: 'Archers shoot along straight lines.', sub: 'One shot. Extra Attack = Bleed.', board: [P('goblin-slinger', 6, 3), O('dwarf-pickman', 6, 8), O('dwarf-pickman', 3, 9)], action: true, slow: true,
    beats: [{ say: 'Shoot the dwarf on a line.', sub: 'One shot. Extra Attack = Bleed.', goal: done, show: dragUnitTo(firstFoe) }] },
  { step: 'fight', n: 7, pics: ['swing-hit', 'swing-miss', 'block'], say: 'Each swing rolls a die.', sub: "So a 2 can't always kill a 2.", after: 'See? The dice decide!', board: [P('goblin-grunt', 5, 5), O('barrelback-courier', 4, 5, { hp: 2 })], action: true, slow: true,
    beats: [{ say: 'Attack the dwarf.', sub: 'Watch each swing!', goal: done, show: dragUnitTo(firstFoe) }] },
  { step: 'commander', n: 8, pics: ['commander-retreat'], say: 'Hit the enemy Commander!', sub: 'Take him from 20 to 0 to win.', after: 'Keep hitting. At 0 he runs away!', board: [P('goblin-grunt', 2, 11)], action: true, slow: true,
    beats: [{ say: 'Hit the enemy Commander!', sub: 'Drag onto his fortress.', goal: done, show: dragUnitTo(() => ENEMY_SH) }] },
  // RESERVED for Anvil (Nov 1), once the features land: lesson "a standing mining order" (drag a Miner onto a mine) and lesson "guard arrows".
  // Add each here as a Lesson (with its step also added to TUTORIAL_ORDER in engine.ts, before 'swap'), and renumber `n`.
  { step: 'mineorder', n: 9, pics: ['hand-pointing'], say: 'Drag your Miner onto a mine.', sub: 'It walks there and mines every turn.', board: [P('goblin-scrounger', 6, 3)], action: true,
    beats: [{ say: 'Drag the Miner onto the crystal mine.', sub: 'It keeps mining by itself.', goal: (t) => [...t.app.orders.values()].some((o: any) => o.kind === 'mine'), show: dragUnitTo((t) => { const u = t.unit, s = t.app.game.state; if (!u || !s) return null; const d = (a: any) => Math.max(Math.abs(a.row - u.row), Math.abs(a.col - u.col)); return s.sites.slice().sort((a: any, b: any) => d(a) - d(b))[0]; }) }] },
  { step: 'guardarrows', n: 10, pics: ['hand-pointing'], say: 'A guard watches squares.', sub: 'Black arrows. It never chases.', board: [P('goblin-grunt', 6, 3)], action: true,
    beats: [
      { say: 'Tap your goblin.', goal: (t) => !!t.app.stanceBar, show: (t) => (t.unit ? { to: t.sq(t.unit), tap: true, at: t.unit } : null) },
      { say: 'Pick Guard.', sub: 'It stays and protects.', goal: (t) => !!t.unit && t.app.stances.get(t.unit.uid) === 'guard', show: (t) => { const b = t.app.stanceBar?.querySelector('[data-stance=guard]'); return b ? { to: t.elPt(b), tap: true, el: b } : null; } },
      { say: 'Drag to a square it should guard.', sub: 'Black arrow = it watches there.', goal: (t) => !!t.unit && (((t.app as any).guardSquares.get(t.unit.uid)?.squares.length) || 0) >= 1, show: dragUnitTo(() => ({ row: 5, col: 4 })) },
    ] },
  { step: 'swap', n: 11, pics: ['hand-pointing'], say: 'Swap a card for a Miner.', sub: '1 Crystal (3 with 3 Miners).', hand: ['goblin-grunt'], crystals: 1, board: [], action: false,
    beats: [
      { say: 'Tap Swap for a Miner.', sub: '1 Crystal (3 with 3 Miners).', goal: (t, st) => !!t.app.swapping || done(t, st), show: (t) => { const b = t.app.r?.swap as El | undefined; return b && !b.hidden ? { to: t.elPt(b), tap: true, el: b } : null; } },
      { say: 'Now tap a card to trade.', goal: done, show: (t) => ({ to: t.elPt(t.handCard()), tap: true }) },
    ] },
];
export const LESSON_COUNT = Math.max(...LESSONS.map((l) => l.n));
const STAMPS = ['NICE!', 'GREAT!', 'YES!', 'WOW!', 'SUPER!', 'BOOM!', 'AWESOME!', 'TA-DA!', 'YES!', 'WOW!'];

/** The match options of one lesson (a scripted match: the enemy only passes). */
export function lessonOptions(L: Lesson) {
  return {
    playerCommander: 'grubnak', opponentCommander: 'borgo', mines: MINES, seed: 1, difficulty: 'easy', tutorial: L.step, tutorialInfo: L.target ? { target: L.target } : {},
    setup: { firstPlayer: 'player', board: L.board.map(({ hp: _hp, ...b }) => b), playerHand: L.hand || [], playerCrystals: L.crystals || 0, opponentHand: [],
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

/** The three swing results with their dice (picture card) or as a small key (under the spoken line). */
function swingKey(big: boolean) {
  const item = (pic: string, word: string, cls: string, ns: number[], note?: string) => h('figure', { class: 'tut-swing ' + cls },
    big ? h('img', { class: 'tut-pic', src: PIC(pic), alt: word, draggable: 'false' }) : null,
    h('figcaption', {}, h('b', {}, word), dice(ns), note ? h('small', {}, note) : null));
  return h('div', { class: 'tut-swings' + (big ? ' big' : '') },
    item('swing-hit', 'HIT', 'hit', [2, 3, 4, 5, 6]),
    item('swing-miss', 'MISS', 'miss', [1]),
    item('block', 'BLOCK', 'block', [6], big ? '1 die per heart (max 2). Big units: 1, and a big attacker takes 1 die away (never below 1). Shields: +1. Commanders: 1.' : undefined));
}

/** The marker signs (drawn with the same pen as the real orders, order-draw.ts). */
function legendGrid() {
  const svg = (inner: string) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 120 90'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = inner; return s as unknown as El; };
  const line = (kind: 'move' | 'chase', ranged = false) => orderSvg({ uid: 'legend-' + kind + (ranged ? 'b' : ''), kind, pts: [{ x: 8, y: 80 }, { x: 32, y: 68 }, { x: kind === 'move' ? 60 : 62, y: kind === 'move' ? 54 : 58 }], end: kind === 'move' ? { x: 60, y: 54 } : { x: 62, y: 58 }, cw: 54, ch: 40, preview: false, blocked: false, ranged });
  const items: [string, string, string][] = [
    ['move', 'Walk here', line('move')],
    ['melee', 'Melee attack', line('chase')],
    ['ranged', 'Ranged attack', line('chase', true)],
    ['target', 'Target', restTargetSvg({ x: 60, y: 50 }, 80, 56)],
    ['guard', 'Guard', guardSvg({ x: 60, y: 50 }, 80, 56, 'legend')],
    ['none', 'No orders yet', questionSvg({ x: 60, y: 88 }, 64, 50, 'legend')],
  ];
  return h('ul', { class: 'tut-legend', 'aria-label': 'Marker signs' }, ...items.map(([k, label, inner]) => h('li', { 'data-sign': k }, svg(inner), h('span', {}, label))));
}

type Mode = 'intro' | 'do' | 'yay' | 'legend' | 'final';
export class Tutorial {
  app: any;
  i = 0;
  /** the current beat of the lesson */
  b = 0;
  mode: Mode = 'intro';
  private loopId: any = 0;
  private timers: any[] = [];
  private tipKey = '';
  private autoKey = '';
  private gestureKey = '';
  private tapped = false;
  private tapListener: ((e: PointerEvent) => void) | null = null;
  constructor(app: any) { this.app = app; }
  get lesson() { return LESSONS[this.i]; }
  get beat(): Beat | null { return this.lesson.beats[this.b] || null; }
  get fast() { return !!this.app.test; }

  /** Start the tutorial (at a lesson's step for checks; normally the first). */
  begin(step?: string) {
    const k = LESSONS.findIndex((l) => l.step === step);
    this.i = k >= 0 ? k : 0;
    this.app.arenaFaction = '';
    if (!this.tapListener) {
      // a tap beat goes on when the player presses the pointed control (the press itself still reaches the control)
      this.tapListener = (e: PointerEvent) => {
        const bt = this.beat, st = this.app.game.state;
        if (this.mode !== 'do' || !bt || !bt.tap || !st?.tutorial) return;
        const el = bt.tap(this, st);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left - 6 && e.clientX <= r.right + 6 && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6) { this.tapped = true; setTimeout(() => this.poll(), 60); }
      };
      document.addEventListener('pointerdown', this.tapListener, true);
    }
    return this.startLesson();
  }
  startLesson() {
    this.stopTimers();
    const L = this.lesson;
    this.mode = 'intro'; this.b = 0; this.tapped = false; this.tipKey = ''; this.autoKey = ''; this.gestureKey = '';
    const st = this.app.startTutorialLesson(lessonOptions(L));
    // `hp`: the unit's Health in this lesson, whatever its card (and its Commander's bonus) says (lesson 7: "a 2 against a 2")
    for (const b of L.board) if (b.hp) { const c = this.app.game.state.board.creatures.find((x: any) => x.row === b.row && x.col === b.col); if (c) c.health = Math.min(b.hp, c.maxHealth); }
    if (L.action) this.app.game.act({ type: 'done' });
    this.app.renderTip(this.app.game.state);
    this.startLoop();
    return st;
  }
  stopTimers() { for (const t of this.timers) clearTimeout(t); this.timers = []; }
  later(ms: number, f: () => void) { this.timers.push(setTimeout(f, ms)); }
  startLoop() { clearInterval(this.loopId); this.loopId = setInterval(() => this.poll(), 250); }
  stop() { clearInterval(this.loopId); this.loopId = 0; this.stopTimers(); }
  get match(): El | null { const tip = this.app.r?.tip as El | undefined; return tip && tip.isConnected ? (tip.parentElement as El) : null; }
  get unit() { return this.app.game.state?.board.creatures.find((c: any) => c.owner === 'player'); }
  get foes() { return (this.app.game.state?.board.creatures || []).filter((c: any) => c.owner === 'opponent'); }

  /** Every 250 ms (and after a pressed control): beats that are done move on; the pointer follows the camera. Stops when the tutorial screen is gone. */
  poll() {
    const st = this.app.game.state;
    if (!st || !st.tutorial || !this.match) { if (!st || !st.tutorial) this.stop(); return; }
    this.render(st);
  }
  /** Moves through every finished beat; the lesson ends after its last one. */
  advance(st: any) {
    if (this.mode !== 'do' || st.tutorial.step !== this.lesson.step) return;
    for (let n = 0; n < 10; n++) {
      const bt = this.beat;
      if (!bt) break;
      const ok = bt.goal ? bt.goal(this, st) : this.tapped;
      if (!ok) break;
      this.b++; this.tapped = false; this.tipKey = ''; this.gestureKey = '';
    }
    if (!this.beat) { markTutorialDone(st); this.finishLesson(); }
  }

  /** Called by the app on every match update (renderTip) and by the poll. */
  render(st: any, tip: El = this.app.r?.tip) {
    if (!tip) return;
    if (!st || !st.tutorial) { tip.hidden = true; return; }
    const L = this.lesson;
    if (st.tutorial.step !== L.step && st.tutorial.step !== 'complete') { const k = LESSONS.findIndex((l) => l.step === st.tutorial.step); if (k >= 0 && k !== this.i) { this.i = k; this.b = 0; this.mode = 'intro'; this.tipKey = ''; } }
    // the lessons that start in the Action phase pass their later Deploy phases by themselves
    if (L.action && st.phase === 'deploy' && st.activePlayer === 'player' && st.priority === 'player' && !st.pendingResponse) {
      const key = `${st.turn}`;
      if (this.autoKey !== key) { this.autoKey = key; this.later(this.fast ? 0 : 500, () => { const s = this.app.game.state; if (s && s.tutorial && s.phase === 'deploy' && s.activePlayer === 'player' && s.priority === 'player') this.app.game.act({ type: 'done' }); }); }
    }
    this.advance(st);
    this.renderLine(st, tip);
    this.renderCard();
    this.renderPointer(st);
  }

  finishLesson() {
    if (this.mode === 'yay') return;
    this.mode = 'yay';
    const L = this.lesson;
    this.later(this.fast ? 150 : L.slow ? 2600 : 700, () => {
      this.stamp(STAMPS[this.i % STAMPS.length], L.after);
      this.later(this.fast ? 200 : L.after ? 2400 : 1300, () => {
        if (this.i + 1 < LESSONS.length) { this.i++; this.startLesson(); } else { this.mode = 'legend'; this.render(this.app.game.state); }
      });
    });
  }
  stamp(word: string, after?: string) {
    const m = this.match;
    if (!m) return;
    m.querySelector('.tut-yay')?.remove();
    m.append(h('div', { class: 'tut-yay', role: 'status' }, h('span', { class: 'tut-yay-word' }, word), after ? h('span', { class: 'tut-yay-sub' }, after) : null));
  }

  /** The spoken line: big lettering over the top of the board, word by word like someone talking (no box; it never catches a touch,
   *  only its small Skip button does). Kept in the old "Tutorial tip" element. */
  renderLine(st: any, tip: El) {
    const L = this.lesson, bt = this.beat;
    const show = this.mode === 'do' && !!bt;
    tip.hidden = !show;
    tip.classList.add('tut-tip');
    if (!show) return;
    const u = this.unit;
    const feet = L.step === 'move' && u ? `${maxMove(u)}:${u.movesLeft ?? 0}` : '';
    const key = `${this.i}|${this.b}|${this.mode}|${feet}`;
    if (key === this.tipKey && tip.childElementCount) return;
    this.tipKey = key;
    tip.dataset.step = L.step;
    tip.dataset.beat = String(this.b);
    const line = bt!;
    let k = 0;
    const words = (txt: string, cls: string) => h('p', { class: cls }, ...txt.split(' ').flatMap((w, i) => { const s = h('span', { class: 'tut-w' }, w); if (!this.fast) s.style.animationDelay = `${(k++) * 0.13}s`; return i ? [' ', s] : [s]; }) as any);
    const kids: (El | null)[] = [
      words(line.say, 'tip-text tut-say'),
      line.sub ? words(line.sub, 'tut-sub') : null,
      L.step === 'fight' ? swingKey(false) : null,
    ];
    if (feet && u) {
      const n = maxMove(u) || 0, left = u.movesLeft ?? 0;
      const meter = h('div', { class: 'tut-feet', role: 'img', 'aria-label': `${left} of ${n} steps left` });
      for (let j = 0; j < n; j++) { const f = h('span', { class: 'tut-foot' + (j < left ? ' on' : '') }); f.innerHTML = FOOT; meter.append(f); }
      kids.push(meter);
    }
    kids.push(h('div', { class: 'tut-bar' }, h('span', { class: 'tut-count' }, `Lesson ${L.n} of ${LESSON_COUNT}`), button('Skip Tutorial', 'tip-skip', () => { this.stop(); this.app.showMenu(); })));
    tip.replaceChildren(...kids.filter(Boolean) as El[]);
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
    (card.querySelector('.tut-go') as El | null)?.focus?.({ preventScroll: true });
  }
  complete() {
    const st = this.app.game.state;
    if (st && st.tutorial) { st.tutorial.step = 'complete'; st.tutorial.done = true; }
    this.mode = 'final';
    this.render(st);
  }

  // ---------------------------------------------------------------- the pointing hand
  /** client point -> a point in the match area (it may be scaled to fit the window) */
  local(p: Pt | null) {
    const m = this.match;
    if (!m || !p) return null;
    const o = this.layer() || m; // the hand's own layer (it moves with the match area if that is ever scrolled)
    const r = o.getBoundingClientRect(), k = o.offsetWidth ? r.width / o.offsetWidth : 1;
    return { x: (p.x - r.left) / k, y: (p.y - r.top) / k };
  }
  layer(): El | null {
    const m = this.match;
    if (!m) return null;
    let l = m.querySelector(':scope > .tut-layer') as El | null;
    if (!l) { l = h('div', { class: 'tut-layer', 'aria-hidden': 'true' }); m.append(l); this.gestureKey = ''; }
    return l;
  }
  sq(c: Cell | null | undefined) { return c ? this.local(this.app.squareToScreen(c.row, c.col)) : null; }
  elPt(el: Element | null | undefined) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    return this.local({ x: r.left + r.width / 2, y: (r.top + Math.min(r.bottom, window.innerHeight)) / 2 });
  }
  handCard() { return this.match?.querySelector('.hand .hand-card:not(.popclone)') || null; }
  /** the size of a square on screen (for the ring) */
  cellSize(c: Cell | null | undefined) {
    const q = c ? this.app.squareQuad?.(c.row, c.col) : null;
    if (!q || q.length < 4) return null;
    const m = this.layer(), r = m?.getBoundingClientRect(), k = m && m.offsetWidth ? r!.width / m.offsetWidth : 1;
    const xs = q.map((p: any) => p.x), ys = q.map((p: any) => p.y);
    return { w: Math.max(30, (Math.max(...xs) - Math.min(...xs)) / k * 0.95), h: Math.max(20, (Math.max(...ys) - Math.min(...ys)) / k * 0.95) };
  }
  /** What the hand shows now: a tap beat points at its control; others show their drag or tap. */
  gesture(st: any): Gesture | null {
    const bt = this.beat;
    if (!bt || st.phase === 'over') return null;
    if (bt.show) return bt.show(this, st);
    if (bt.tap) { const el = bt.tap(this, st); return el ? { to: this.elPt(el), tap: true, el } : null; }
    return null;
  }
  renderPointer(st: any) {
    const m = this.match;
    if (!m) return;
    const layer = this.layer()!;
    const on = this.mode === 'do' && !st.pendingResponse;
    const g = on ? this.gesture(st) : null;
    const lines = on && this.lesson.step === 'ranged' ? this.rangedLines(st) : '';
    const key = g && g.to ? `${this.b}|${g.tap ? 't' : 'd'}|${g.from ? Math.round(g.from.x / 4) + ',' + Math.round(g.from.y / 4) : ''}|${Math.round(g.to.x / 4)},${Math.round(g.to.y / 4)}|${lines.length}` : 'none|' + lines.length;
    if (key === this.gestureKey) return;
    this.gestureKey = key;
    layer.replaceChildren();
    if (lines) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'tut-lines'); s.innerHTML = lines; layer.append(s as unknown as El); }
    if (!g || !g.to) return;
    const to = g.to;
    // the blinking ring: the square's size on the board, or the control's own outline
    const ring = h('div', { class: 'tut-ring' + (g.tap ? ' tap' : '') + (g.el ? ' ctl' : '') });
    ring.style.left = to.x + 'px'; ring.style.top = to.y + 'px';
    let size = g.at ? this.cellSize(g.at) : null;
    if (!size && g.el) { const r = g.el.getBoundingClientRect(), mm = layer.getBoundingClientRect(), k = layer.offsetWidth ? mm.width / layer.offsetWidth : 1; size = { w: r.width / k + 14, h: Math.min(r.height, window.innerHeight - r.top) / k + 14 }; }
    if (size) { ring.style.width = size.w + 'px'; ring.style.height = size.h + 'px'; ring.style.margin = `${-size.h / 2}px 0 0 ${-size.w / 2}px`; }
    const hand = h('img', { class: 'tut-hand', src: PIC('hand-pointing'), alt: '', draggable: 'false' }) as HTMLImageElement;
    layer.append(ring, hand);
    // the fingertip sits at 44 % / 86 % of Brush's picture; near the top of the screen the hand turns over and points up
    const top = Math.min(170, m.offsetHeight * 0.3);
    const flip = to.y < top && (!g.from || g.from.y < top);
    const at = (p: Pt, s = 1) => `translate(${p.x}px, ${p.y}px)${flip ? ' rotate(180deg)' : ''} scale(${s}) translate(-44%, -86%)`;
    const lift = flip ? 22 : -22;
    if (g.tap || !g.from) {
      hand.style.transform = at(to);
      hand.animate?.([{ transform: at({ x: to.x, y: to.y + lift }) }, { transform: at(to, 0.92), offset: 0.45 }, { transform: at({ x: to.x, y: to.y + lift }) }], { duration: 1000, iterations: Infinity, easing: 'ease-in-out' });
    } else {
      // the real drag, start to end: press on the unit or card, carry a ghost across, let go on the square
      const from = g.from;
      const ghost = h('div', { class: 'tut-ghost' });
      layer.insertBefore(ghost, hand);
      const gp = (p: Pt) => `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      ghost.animate?.([{ transform: gp(from), opacity: 0 }, { transform: gp(from), opacity: 0, offset: 0.18 }, { transform: gp(from), opacity: 0.9, offset: 0.22 }, { transform: gp(to), opacity: 0.9, offset: 0.72 }, { transform: gp(to), opacity: 0, offset: 0.84 }, { transform: gp(to), opacity: 0 }], { duration: 2200, iterations: Infinity, easing: 'ease-in-out' });
      hand.style.transform = at(from);
      hand.animate?.([
        { transform: at(from), opacity: 0 }, { transform: at(from), opacity: 1, offset: 0.08 }, { transform: at(from, 0.9), offset: 0.2 },
        { transform: at(to, 0.9), offset: 0.72 }, { transform: at(to, 1), opacity: 1, offset: 0.84 }, { transform: at(to, 1), opacity: 0 },
      ], { duration: 2200, iterations: Infinity, easing: 'ease-in-out' });
    }
  }
  /** Lesson 6: the archer's 8 straight lines (blue), up to 7 squares, stopping at the first unit. */
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

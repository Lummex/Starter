// Match controller: owns the engine state, runs the computer opponent, and notifies the UI.
import { createMatch, applyAction, legalActions, hasMovesLeft, other, CONFIG, brewActions, CARDS, creatureCost, funds, summonSpaces } from './engine';
import { aiChoose, makeRand, Rand } from './ai/ai';
import { stanceChoose, onlyUnit, Stance } from './ai/stances';
import tutorialJson from './content/tutorial.json';

export type Listener = (state: any, events: any[]) => void;

/** Referee for the computer's actions (Anvil, Oct 31; Ken: "they need to have a deck and play by the rules"). Every action the computer
 *  picks is checked against the same legalActions() list the player gets before it is applied; an illegal one is REFUSED (counted in
 *  `refused`) and the computer passes or ends the phase instead. Summons are also checked: paid in full, in the legal deploy zone
 *  (back row; front row only when the back row is full; Tunnel next to a mine) and a card from that side's own hand and starting deck.
 *  In test mode the match state is also compared before and after the computer's thinking (`touched`). Probe hook: window.__aiAudit. */
export const aiAudit = { checked: 0, refused: 0, touched: 0, summons: 0, unpaid: 0, offZone: 0, foreign: 0, last: '' as string };
(globalThis as any).__aiAudit = aiAudit;
const canonAction = (a: any) => JSON.stringify(Object.keys(a).filter((k) => a[k] !== undefined && !(k === 'redraw' && !a[k])).sort().reduce((o: any, k) => (o[k] = a[k], o), {}));
const ownUids: Record<string, Set<string>> = { player: new Set(), opponent: new Set() };
function auditPick(s: any, a: any, before: string | null): any {
  aiAudit.checked++;
  if (before !== null && JSON.stringify(s) !== before) { aiAudit.touched++; aiAudit.last = `turn ${s.turn}: the computer's thinking changed the match state`; }
  if (!a || !legalActions(s).some((l: any) => canonAction(l) === canonAction(a))) {
    aiAudit.refused++; aiAudit.last = `turn ${s.turn} ${s.phase}: refused ${JSON.stringify(a)}`;
    return s.pendingResponse ? { type: 'pass' } : s.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' };
  }
  if (a.type === 'summon') {
    const who = s.priority, pl = s.players[who];
    const h = pl.hand.find((x: any) => x.uid === a.uid), card = h && CARDS[h.cardId];
    aiAudit.summons++;
    if (!h || !ownUids[who].has(h.uid)) { aiAudit.foreign++; aiAudit.last = `turn ${s.turn}: ${who} summoned a card not from its own hand and deck`; }
    if (card) {
      const zone = summonSpaces(s, who, card), backFree = zone.some((z) => z.row === CONFIG.backRow[who]);
      const okRow = a.row === CONFIG.backRow[who] || (!backFree && a.row === CONFIG.frontRow[who]) || card.abilities?.includes('tunnel');
      if (!okRow || !zone.some((z) => z.row === a.row && z.col === a.col)) { aiAudit.offZone++; aiAudit.last = `turn ${s.turn}: ${who} summoned ${card.id} outside its deploy zone (${a.row},${a.col})`; }
      if (funds(pl) < creatureCost(s, who, card)) { aiAudit.unpaid++; aiAudit.last = `turn ${s.turn}: ${who} summoned ${card.id} without the crystals`; }
    }
  }
  return a;
}
function auditPaid(before: any, a: any, after: any) {
  if (!a || a.type !== 'summon' || !after) return;
  const who = before.priority, pl = before.players[who], h = pl.hand.find((x: any) => x.uid === a.uid);
  if (!h) return;
  const expect = funds(pl) - creatureCost(before, who, CARDS[h.cardId]);
  if (funds(after.players[who]) !== expect) { aiAudit.unpaid++; aiAudit.last = `turn ${before.turn}: ${who}'s summon of ${h.cardId} was not paid in full`; }
}

export class Game {
  state: any = null;
  options: any = {};
  testMode: boolean;
  ai = true;
  aiBoth = false;
  scripted = false;
  difficulty = 'normal';
  private listeners: Listener[] = [];
  private rand: Rand = makeRand(1);
  private aiTimer: any = null;
  private epoch = 0;
  paused = false;
  mode: 'standard' | 'cardplay' | 'compvscomp' = 'standard';
  stance: Stance = 'freeforall';
  speed = 1;
  unitAutoPlay = true;
  private modeTimer: any = null;
  lastStanceChoice: any = null;
  autoSkip = true;
  private skipTimer: any = null;

  constructor(testMode: boolean) {
    this.testMode = testMode;
  }

  subscribe(fn: Listener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }
  private emit(events: any[]) {
    for (const l of this.listeners) l(this.state, events);
  }

  newMatch(options: any = {}) {
    this.epoch++;
    clearTimeout(this.aiTimer);
    clearTimeout(this.modeTimer);
    this.options = options;
    if (options.mode) this.setMode(options.mode);
    else if (options.tutorial) this.mode = 'standard';
    if (options.stance) this.setStance(options.stance);
    this.speed = options.speed === 2 || options.speed === 4 ? options.speed : 1;
    this.unitAutoPlay = options.unitAutoPlay != null ? options.unitAutoPlay !== false : !this.testMode;
    this.ai = options.ai !== false;
    this.aiBoth = this.testMode && (options.aiBoth === true || (this.mode === 'compvscomp' && !options.paused));
    this.scripted = !!options.tutorial;
    this.autoSkip = !this.scripted && (this.testMode ? options.autoSkip === true : options.autoSkip !== false);
    clearTimeout(this.skipTimer);
    if (this.scripted) this.ai = true;
    this.difficulty = options.difficulty === 'easy' ? 'easy' : options.difficulty === 'hard' ? 'hard' : 'normal';
    const seed = options.seed ?? (this.testMode ? 1 : (Date.now() ^ (Math.random() * 1e9)) | 0);
    this.rand = makeRand(seed + 977);
    this.state = createMatch({ ...options, seed, testMode: this.testMode });
    this.state.difficulty = this.difficulty;
    for (const w of ['player', 'opponent']) { ownUids[w] = new Set(); for (const h of [...this.state.players[w].deck, ...this.state.players[w].hand]) ownUids[w].add(h.uid); }
    for (const k of Object.keys(aiAudit)) (aiAudit as any)[k] = typeof (aiAudit as any)[k] === 'number' ? 0 : '';
    this.paused = !!options.paused;
    this.state.mode = this.mode;
    this.emit([{ type: 'newMatch' }]);
    if (this.aiBoth) this.runBoth(); else this.afterAction();
    return JSON.parse(JSON.stringify(this.state));
  }

  /** Test mode: the computer plays both sides immediately until the match ends. */
  private runBoth() {
    let n = 0, turn = -1, cnt = 0;
    while (this.state.phase !== 'over' && n++ < 20000) {
      if (turn !== this.state.turn) { turn = this.state.turn; cnt = 0; }
      const snap = JSON.stringify(this.state);
      let a: any = this.compChoose();
      a = auditPick(this.state, a, snap);
      if (++cnt > 60 && !this.state.pendingResponse && this.state.phase !== 'mulligan') a = { type: 'done' };
      let r: any = applyAction(this.state, a);
      if (!r.ok) r = applyAction(this.state, this.state.pendingResponse ? { type: 'pass' } : this.state.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' });
      if (!r.ok) break;
      auditPaid(this.state, a, r.state);
      this.state = r.state;
    }
    this.emit([{ type: 'sync' }]);
  }

  setMode(m: string) {
    this.mode = m === 'cardplay' || m === 'compvscomp' ? m : 'standard';
    if (this.state) this.state.mode = this.mode;
    try { localStorage.setItem('oreheart.mode', this.mode); } catch { /* storage unavailable */ }
    if (this.state) this.afterAction();
    return this.mode;
  }
  setStance(n: string) {
    const k = String(n).toLowerCase().replace(/[^a-z]/g, '');
    const m: any = { aggressive: 'aggressive', minecontrol: 'minecontrol', mine: 'minecontrol', defensive: 'minecontrol', guard: 'guard', freeforall: 'freeforall', free: 'freeforall' };
    const v = m[k] as Stance | undefined;
    if (v) { this.stance = v; if (this.state) this.state.stance = v; try { localStorage.setItem('oreheart.stance', v); } catch { /* storage unavailable */ } }
    return this.stance;
  }
  getStance() { return this.stance; }
  setSpeed(n: number) { this.speed = n === 2 || n === 4 ? n : 1; }
  setPaused(p: boolean) {
    this.paused = p;
    if (p) return;
    // test mode: a released Card Comp vs Card Comp match plays to the end at once
    if (this.testMode && this.mode === 'compvscomp' && this.state && this.state.phase !== 'over') { this.aiBoth = true; clearTimeout(this.modeTimer); this.runBoth(); return; }
    this.afterAction();
  }

  /** The action the player's side would take under the current stance (units) or the full AI (cards). */
  private compChoose(): any {
    const s = this.state;
    if (s.priority === 'player' && s.phase !== 'mulligan' && !s.pendingResponse) {
      const u = stanceChoose(s, this.stance, 'player', this.difficulty, this.rand);
      if (u) { this.lastStanceChoice = u; return u; }
      return aiChoose(s, this.difficulty, this.rand, ['summon', 'cast', 'playCrystal', 'ability', 'minerUpgrade', 'gathererSwap', 'done']);
    }
    return aiChoose(s, this.difficulty, this.rand);
  }

  /** Card Play (test hook and timer): the next unit of the player (reading order) acts under the current stance. */
  autoActStep(): any {
    const s = this.state;
    if (!s || this.mode !== 'cardplay' || s.phase !== 'action' || s.activePlayer !== 'player' || s.priority !== 'player' || s.pendingResponse) return { ok: false, error: 'not the Action phase of Card Play' };
    const units = s.board.creatures.filter((c: any) => c.owner === 'player').sort((x: any, y: any) => x.row - y.row || x.col - y.col);
    for (const u of units) {
      const a = stanceChoose(onlyUnit(s, u.uid), this.stance, 'player', this.difficulty, this.rand);
      if (!a || a.creatureUid !== u.uid) continue;
      this.lastStanceChoice = a;
      const r = this.internal(() => this.act(a));
      if (r.ok) return { ok: true, action: a };
    }
    const r = this.internal(() => this.act({ type: 'done' }));
    return { ...r, action: { type: 'done' } };
  }
  /** What the current stance would do next (does not act). With a uid, only that unit's best action. */
  stanceChoice(uid?: string) {
    const s = this.state;
    if (!s) return null;
    return stanceChoose(uid ? onlyUnit(s, uid) : s, this.stance, 'player', this.difficulty, this.rand);
  }
  private bypass = false;
  private internal<T>(f: () => T): T { this.bypass = true; try { return f(); } finally { this.bypass = false; } }

  startTutorial() {
    const t: any = tutorialJson;
    return this.newMatch({ playerCommander: t.playerCommander, opponentCommander: t.opponentCommander, setup: t.setup, mines: t.mines, tutorial: true, seed: 1, difficulty: 'easy' });
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
  legalActions() {
    if (!this.state) return [];
    if (this.ai && this.state.priority === 'opponent') return this.state.phase === 'over' ? [] : brewActions(this.state, 'player').map((a: any) => ({ ...a, player: 'player' }));
    const l = legalActions(this.state);
    if (this.mode === 'cardplay' && !this.bypass && this.state.activePlayer === 'player') return l.filter((a: any) => !['move', 'attack', 'mine', 'mineAt', 'gathererSwap'].includes(a.type));
    return l;
  }

  /** Apply an action for whoever currently has priority. */
  act(action: any, external = false): { ok: boolean; events?: any[]; error?: string } {
    if (!this.state) return { ok: false, error: 'No match' };
    if (action && action.type === 'surrender') {
      if (this.ai) action = { ...action, player: 'player' };
    } else if (this.ai && this.state.priority === 'opponent') {
      if (!(action && action.type === 'ability' && action.ability === 'brew')) return { ok: false, error: "It is the opponent's turn" };
      action = { ...action, player: 'player' };
    }
    void external;
    if (this.mode === 'cardplay' && !this.bypass && action && ['move', 'attack', 'mine', 'mineAt', 'gathererSwap'].includes(action.type) && (action.player || this.state.priority) === 'player') return { ok: false, error: 'Card Play: your units act on their own' };
    if (this.mode === 'compvscomp' && !this.bypass && action && action.type !== 'surrender' && this.testMode === false) return { ok: false, error: 'Card Comp vs Card Comp: you only watch' };
    let r: any;
    try { r = applyAction(this.state, action); } catch (e: any) { return { ok: false, error: String(e && e.message || e) }; }
    if (!r.ok) return { ok: false, error: r.error };
    this.state = r.state;
    this.emit(r.events);
    this.afterAction();
    return { ok: true, events: JSON.parse(JSON.stringify(r.events)) };
  }

  movesLeft() {
    return !!this.state && hasMovesLeft(this.state);
  }

  /** Human phases with no moves left end by themselves after a short delay. */
  private scheduleAutoSkip() {
    clearTimeout(this.skipTimer);
    const s = this.state;
    if (!this.autoSkip || !s || s.phase === 'over' || s.pendingResponse) return;
    if (!['deploy', 'action'].includes(s.phase) || s.priority !== s.activePlayer) return;
    if (s.activePlayer !== 'player' || s.priority !== 'player') return; // the opponent's phases are never auto-skipped
    if (hasMovesLeft(s)) return;
    const key = `${s.turn}|${s.phase}`;
    const ep = this.epoch;
    this.skipTimer = setTimeout(() => {
      const c = this.state;
      if (ep !== this.epoch || !c || `${c.turn}|${c.phase}` !== key || c.pendingResponse || this.paused || hasMovesLeft(c)) return;
      this.act({ type: 'done' });
    }, (this.testMode ? 0.4 : CONFIG.autoSkipDelaySeconds) * 1000);
  }

  private afterAction() {
    clearTimeout(this.modeTimer);
    if (this.state && this.state.phase !== 'over') {
      if (this.mode === 'compvscomp' && !this.aiBoth) { this.scheduleComp(); return; }
      if (this.mode === 'cardplay' && this.unitAutoPlay && !this.scripted) this.scheduleUnits();
    }
    this.scheduleAutoSkip();
    if (!this.ai || !this.state || this.state.phase === 'over' || this.state.priority !== 'opponent') return;
    if (this.testMode) {
      let n = 0;
      while (this.state.priority === 'opponent' && this.state.phase !== 'over' && n++ < 400) this.aiStep();
      return;
    }
    const ep = this.epoch;
    clearTimeout(this.aiTimer);
    this.aiTimer = setTimeout(() => {
      if (ep !== this.epoch) return;
      if (this.paused) { this.afterAction(); return; }
      this.aiStep();
      this.afterAction();
    }, this.state.phase === 'mulligan' ? 200 : 650);
  }

  private scheduleComp() {
    const ep = this.epoch;
    this.modeTimer = setTimeout(() => {
      if (ep !== this.epoch || !this.state || this.state.phase === 'over') return;
      if (this.paused) { this.afterAction(); return; }
      const st = this.state;
      if (this.aiTurn !== st.turn) { this.aiTurn = st.turn; this.aiCount = 0; }
      const snap = this.testMode ? JSON.stringify(st) : null;
      let a = this.compChoose();
      a = auditPick(st, a, snap);
      if (++this.aiCount > 60 && !st.pendingResponse && st.phase !== 'mulligan') a = { type: 'done' };
      let r: any = applyAction(st, a);
      if (!r.ok) r = applyAction(st, st.pendingResponse ? { type: 'pass' } : st.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' });
      if (r.ok) { auditPaid(st, a, r.state); this.state = r.state; this.emit(r.events); }
      this.afterAction();
    }, (st0(this.state) / this.speed) / (this.testMode ? 8 : 1));
  }
  private scheduleUnits() {
    const s = this.state;
    if (s.phase !== 'action' || s.activePlayer !== 'player' || s.priority !== 'player' || s.pendingResponse) return;
    const ep = this.epoch;
    this.modeTimer = setTimeout(() => {
      if (ep !== this.epoch || this.paused) { if (ep === this.epoch) this.afterAction(); return; }
      this.autoActStep();
    }, 850 / this.speed);
  }

  private aiCount = 0;
  private aiTurn = -1;
  private aiStep() {
    const s = this.state;
    if (this.aiTurn !== s.turn) { this.aiTurn = s.turn; this.aiCount = 0; }
    const snap = this.testMode ? JSON.stringify(s) : null;
    let a = this.scripted ? (s.pendingResponse ? { type: 'pass' } : { type: 'done' }) : aiChoose(s, this.difficulty, this.rand);
    if (this.testMode && (globalThis as any).__aiForceNext) { const f = (globalThis as any).__aiForceNext; delete (globalThis as any).__aiForceNext; a = f(s); } // test hook: the referee must refuse this
    a = auditPick(s, a, snap);
    if (++this.aiCount > 60 && !s.pendingResponse && s.phase !== 'mulligan') a = { type: 'done' };
    let r = applyAction(s, a);
    if (!r.ok) r = applyAction(s, s.pendingResponse ? { type: 'pass' } : s.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' });
    if (!r.ok) return;
    auditPaid(s, a, r.state);
    this.state = r.state;
    this.emit(r.events);
  }
}

const st0 = (s: any) => (s.phase === 'mulligan' ? 350 : 500);
export { other };

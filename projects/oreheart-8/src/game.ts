// Match controller: owns the engine state, runs the computer opponent, and notifies the UI.
import { createMatch, applyAction, legalActions, hasMovesLeft, other, CONFIG } from './engine';
import { aiChoose, makeRand, Rand } from './ai/ai';
import tutorialJson from './content/tutorial.json';

export type Listener = (state: any, events: any[]) => void;

export class Game {
  state: any = null;
  options: any = {};
  testMode: boolean;
  ai = true;
  scripted = false;
  difficulty = 'normal';
  private listeners: Listener[] = [];
  private rand: Rand = makeRand(1);
  private aiTimer: any = null;
  private epoch = 0;
  paused = false;
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
    this.options = options;
    this.ai = options.ai !== false;
    this.scripted = !!options.tutorial;
    this.autoSkip = !this.scripted && (this.testMode ? options.autoSkip === true : options.autoSkip !== false);
    clearTimeout(this.skipTimer);
    if (this.scripted) this.ai = true;
    this.difficulty = options.difficulty === 'easy' ? 'easy' : 'normal';
    const seed = options.seed ?? (this.testMode ? 1 : (Date.now() ^ (Math.random() * 1e9)) | 0);
    this.rand = makeRand(seed + 977);
    this.state = createMatch({ ...options, seed });
    this.emit([{ type: 'newMatch' }]);
    this.afterAction();
    return JSON.parse(JSON.stringify(this.state));
  }

  startTutorial() {
    const t: any = tutorialJson;
    return this.newMatch({ playerCommander: t.playerCommander, opponentCommander: t.opponentCommander, setup: t.setup, mines: t.mines, tutorial: true, seed: 1, difficulty: 'easy' });
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
  legalActions() {
    if (!this.state) return [];
    if (this.ai && this.state.priority === 'opponent') return [];
    return legalActions(this.state);
  }

  /** Apply an action for whoever currently has priority. */
  act(action: any, external = false): { ok: boolean; events?: any[]; error?: string } {
    if (!this.state) return { ok: false, error: 'No match' };
    if (action && action.type === 'surrender') {
      if (this.ai) action = { ...action, player: 'player' };
    } else if (this.ai && this.state.priority === 'opponent') return { ok: false, error: "It is the opponent's turn" };
    void external;
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
    if (this.ai && s.priority === 'opponent') return;
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

  private aiCount = 0;
  private aiTurn = -1;
  private aiStep() {
    const s = this.state;
    if (this.aiTurn !== s.turn) { this.aiTurn = s.turn; this.aiCount = 0; }
    let a = this.scripted ? (s.pendingResponse ? { type: 'pass' } : { type: 'done' }) : aiChoose(s, this.difficulty, this.rand);
    if (++this.aiCount > 60 && !s.pendingResponse && s.phase !== 'mulligan') a = { type: 'done' };
    let r = applyAction(s, a);
    if (!r.ok) r = applyAction(s, s.pendingResponse ? { type: 'pass' } : s.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' });
    if (!r.ok) return;
    this.state = r.state;
    this.emit(r.events);
  }
}

export { other };

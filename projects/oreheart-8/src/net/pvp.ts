// Player vs player (Nov 2, Helper C): the network match driver (NetGame), the two transports (Supabase / local mock server) and the
// room screens (6-letter code). Contract: factory-design/design/oreheart-pvp-nov2-contract.md part 3.
// The browser never decides anything here: every action goes to the server, which rolls the dice, keeps the clocks and sends back a
// full snapshot (`view`) of what this player may see. In that view this player is ALWAYS engine side 'player' (the server mirrors the
// board for the second player and hides the other hand, both decks and the rng), so the match screen works unchanged.
import './pvp.css';
import { applyAction, legalActions as engineLegal, brewActions, hasMovesLeft, COMMANDERS, STARTER_DECK_LIST, warbandOf, deckProblems, CARDS } from '../engine';
import { net } from './state';
import type { App } from '../ui/app';

type El = HTMLElement;
type Listener = (state: any, events: any[]) => void;
const clone = <T>(x: T): T => (x == null ? x : JSON.parse(JSON.stringify(x)));

// ------------------------------------------------------------------ transports
export interface Transport {
  /** One server call; resolves to the server's JSON answer ({ ok: true, ... } or { ok: false, error, view? }). Throws only when the server can't be reached. */
  call(op: string, body?: Record<string, unknown>): Promise<any>;
  /** Pushes fresh views of a match (Realtime and/or polling). Returns a stop function. */
  watch(matchId: string, onView: (v: any) => void): () => void;
}

const MOCK_URL = 'http://127.0.0.1:4310/match';
const pageParams = () => new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const isMockPvp = () => { const p = pageParams(); return p.get('pvp') === 'mock' && p.get('test') === '1'; };
export const mockUser = () => (pageParams().get('user') || 'tester').slice(0, 24);

/** Local end-to-end testing: Anvil's in-memory server (tools/pvp-mock-server.mjs), fake sign-in by the x-mock-user header, 500 ms poll. */
export function mockTransport(user: string, url = MOCK_URL): Transport {
  const call = async (op: string, body: Record<string, unknown> = {}) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mock-user': user }, body: JSON.stringify({ op, ...body }) });
    if (r.status === 401) throw new Error('Not signed in');
    return r.json();
  };
  return {
    call,
    watch(matchId, onView) {
      // stands in for Realtime: the stored per-player view (match_views, with that seq's events, so the other player's moves animate);
      // falls back to the `state` op
      let stop = false;
      const who = user.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16);
      const rowUrl = url.replace(/\/match$/, '') + `/debug/views?matchId=${encodeURIComponent(matchId)}&user=${encodeURIComponent(who)}`;
      const poll = async () => {
        if (stop) return;
        try { const r = await (await fetch(rowUrl)).json(); if (!stop && r && r.ok && r.view) { onView(r.view); return; } } catch { /* fall back */ }
        try { const r = await call('state', { matchId }); if (!stop && r && r.ok && r.view) onView(r.view); } catch { /* next poll */ }
      };
      const iv = setInterval(poll, 500);
      return () => { stop = true; clearInterval(iv); };
    },
  };
}

/** The real thing: the `match` Edge Function, Realtime on my match_views row, a 3 s poll fallback and a refresh when the tab comes back. */
export function supabaseTransport(): Transport {
  const sbc = async () => (await import('./online')).client();
  const call = async (op: string, body: Record<string, unknown> = {}) => {
    const c = await sbc();
    const { data, error } = await c.functions.invoke('match', { body: { op, ...body } });
    if (error) {
      // a non-2xx answer: read the server's JSON if it sent one ({ ok:false, error }), else report the transport error
      try { const ctx: any = (error as any).context; if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); if (j) return j; } } catch { /* fall through */ }
      throw new Error(error.message || 'The server did not answer.');
    }
    return typeof data === 'string' ? JSON.parse(data) : data;
  };
  return {
    call,
    watch(matchId, onView) {
      let stop = false, channel: any = null;
      const pull = async () => { if (stop) return; try { const r = await call('state', { matchId }); if (!stop && r && r.ok && r.view) onView(r.view); } catch { /* next poll */ } };
      void (async () => {
        try {
          const c = await sbc();
          const { data } = await c.auth.getUser();
          const me = data.user?.id;
          if (!me || stop) return;
          channel = c.channel('match-views-' + matchId).on('postgres_changes' as any, { event: '*', schema: 'public', table: 'match_views', filter: `user_id=eq.${me}` },
            (p: any) => { const row = p && p.new; if (!stop && row && row.match_id === matchId && row.view) onView(row.view); }).subscribe();
        } catch { /* polling still works */ }
      })();
      const iv = setInterval(pull, 3000);
      const vis = () => { if (document.visibilityState === 'visible') void pull(); };
      const onl = () => void pull();
      document.addEventListener('visibilitychange', vis);
      window.addEventListener('online', onl);
      return () => {
        stop = true; clearInterval(iv);
        document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', onl);
        if (channel) void sbc().then((c) => c.removeChannel(channel)).catch(() => {});
      };
    },
  };
}

let transportCache: Transport | null = null;
export function transport(): Transport {
  if (!transportCache) transportCache = isMockPvp() ? mockTransport(mockUser()) : supabaseTransport();
  return transportCache;
}
/** tests: plug a fake transport in */
export function setTransport(t: Transport | null) { transportCache = t; }

// ------------------------------------------------------------------ plain-word errors
export function friendlyError(e: unknown): string {
  const m = String((e as any)?.message ?? e ?? '');
  if (/expired/i.test(m)) return 'That code has expired. Make a new one!';
  if (/own (code|room)|yourself|same player/i.test(m)) return "That's your own code. Send it to a friend instead!";
  if (/not found|no (such )?room|unknown code|invalid code|bad code|no room/i.test(m)) return 'No room has that code. Check the letters and try again.';
  if (/cancel/i.test(m)) return 'Your friend cancelled that code.';
  if (/full|already (started|joined)|taken|in use/i.test(m)) return 'That room already has two players.';
  if (/active match|already in a match/i.test(m)) return 'You are already in a match. Finish it first!';
  if (/fetch|network|reach|failed to/i.test(m)) return "Can't reach the server. Check your connection and try again.";
  return m || 'Something went wrong.';
}
/** Six letters A–Z without I and O (the server's room codes). Cleans what the player typed. */
export const cleanCode = (s: string) => String(s || '').toUpperCase().replace(/[^A-HJ-NP-Z]/g, '').slice(0, 6);
export const codeOk = (s: string) => /^[A-HJ-NP-Z]{6}$/.test(s);

// ------------------------------------------------------------------ NetGame: the match driver
/** The surface the match screen (src/ui/app.ts) uses from `Game`, fed by the server instead of a local engine. */
export class NetGame {
  readonly isNet = true;
  state: any = null;
  options: any = { pvp: true };
  mode: 'standard' = 'standard';
  paused = false;
  difficulty = 'pvp';
  autoSkip = false;
  ai = false;
  aiBoth = false;
  scripted = false;
  aiPace: any = null;
  aiStyle = 'balanced';
  stance = 'freeforall';
  speed = 1;
  unitAutoPlay = false;
  aiInfo = { worker: false, lastMs: 0, replies: 0 };
  paceLog: any[] = [];
  lastStanceChoice: any = null;
  // from the server's view
  matchId: string;
  seq = -1;
  status: 'active' | 'over' = 'active';
  mySide: 'a' | 'b' = 'a';
  /** ms since epoch (server clock) or null */
  deadline: number | null = null;
  respondDeadline: number | null = null;
  /** when this browser first saw the Respond window it must answer; answers wait until respondMinMs after that (the server refuses sooner) */
  private windowSeenAt: number | null = null;
  private windowSeen = '';
  respondMinMs = 2000;
  bank = { me: 0, them: 0 };
  timeouts = { me: 0, them: 0 };
  names = { me: '', them: '' };
  avatars: { me: string | null; them: string | null } = { me: null, them: null };
  result: null | { won: boolean; reason: string; coins?: number } = null;
  view: any = null;
  /** the screen shows these (a refused move, a lost connection) */
  onError: ((msg: string) => void) | null = null;
  /** test probe: every server answer to an act */
  actLog: { action: any; ok: boolean; error?: string; seq: number }[] = [];
  private listeners: Listener[] = [];
  private queue: any[] = [];
  private sending = false;
  /** the state after the moves still on their way (used only to plan the next step of a standing order, never shown) */
  private predicted: any = null;
  private unwatch: (() => void) | null = null;
  private clock: any = null;
  private lastTickCall = 0;
  private t: Transport;
  /** the local clock (tests replace it) */
  now: () => number = () => Date.now();

  constructor(t: Transport, matchId: string, view?: any) {
    this.t = t; this.matchId = matchId;
    if (view) this.applyView(view);
  }

  // ---- views
  /** Takes a server view. Older views (lower seq) are ignored; the same seq only refreshes the clocks. Returns true when the board changed. */
  applyView(v: any, force = false): boolean {
    if (!v || typeof v !== 'object' || !v.state) return false;
    if (v.matchId && this.matchId && v.matchId !== this.matchId) return false;
    const seq = typeof v.seq === 'number' ? v.seq : 0;
    if (seq < this.seq) return false;
    const fresh = seq > this.seq || !this.state;
    this.readClocks(v);
    if (!fresh && !force) return false;
    this.view = v;
    this.seq = seq;
    const st = clone(v.state);
    const pend = st.pendingResponse;
    const key = pend && pend.responder === 'player' ? JSON.stringify([pend.kind, pend.actor, pend.creatureUid ?? null, pend.card?.uid ?? null, pend.target ?? null]) : '';
    if (key !== this.windowSeen) { this.windowSeen = key; this.windowSeenAt = key ? this.now() : null; }
    if (this.status === 'over' && st.phase !== 'over') { st.phase = 'over'; if (!st.winner && this.result) st.winner = this.result.won ? 'player' : 'opponent'; }
    this.state = st;
    if (!this.queue.length && !this.sending) this.predicted = null;
    this.emit(fresh ? (Array.isArray(v.events) ? clone(v.events) : []) : [{ type: 'sync' }]);
    return true;
  }
  private readClocks(v: any) {
    const ms = (x: any) => (x == null ? null : typeof x === 'number' ? x : (Number.isFinite(Date.parse(x)) ? Date.parse(x) : null));
    this.deadline = ms(v.deadline);
    this.respondDeadline = ms(v.respondDeadline);
    if (v.bank) this.bank = { me: +v.bank.me || 0, them: +v.bank.them || 0 };
    if (v.timeouts) this.timeouts = { me: +v.timeouts.me || 0, them: +v.timeouts.them || 0 };
    if (v.names) this.names = { me: String(v.names.me ?? ''), them: String(v.names.them ?? '') };
    if (v.avatars) this.avatars = { me: v.avatars.me ?? null, them: v.avatars.them ?? null };
    if (v.mySide === 'a' || v.mySide === 'b') this.mySide = v.mySide;
    if (v.result) this.result = v.result;
    this.status = v.status === 'over' ? 'over' : 'active';
  }
  subscribe(fn: Listener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }
  private emit(events: any[]) { for (const l of this.listeners) { try { l(this.state, events); } catch (e) { console.warn('pvp listener', e); } } }

  /** Starts listening for the other player's moves and watching the clock. */
  start() {
    this.stop();
    this.unwatch = this.t.watch(this.matchId, (v) => this.applyView(v));
    this.clock = setInterval(() => { void this.maybeTick(); }, 500);
  }
  stop() {
    if (this.unwatch) { this.unwatch(); this.unwatch = null; }
    if (this.clock) { clearInterval(this.clock); this.clock = null; }
  }
  /** Re-reads the whole match from the server. */
  async sync(): Promise<boolean> {
    try { const r = await this.t.call('state', { matchId: this.matchId }); if (r && r.ok && r.view) { this.applyView(r.view); return true; } } catch { /* offline for a moment */ }
    return false;
  }

  // ---- the Game surface
  getState() {
    const c: any = clone(this.state);
    if (c && c.players && typeof c.players === 'object') c.players.length = 2;
    return c;
  }
  legalActions(): any[] {
    const s = this.state;
    if (!s || s.phase === 'over' || this.status === 'over') return [];
    try {
      if (s.priority !== 'player') return brewActions(s, 'player').map((a: any) => ({ ...a, player: 'player' }));
      return engineLegal(s);
    } catch { return []; }
  }
  movesLeft() { try { return !!this.state && hasMovesLeft(this.state); } catch { return false; } }
  newMatch(_o?: any) { return this.getState(); }
  setMode(_m?: string) { return this.mode; }
  setStance(n: string) { this.stance = String(n || 'freeforall'); return this.stance; }
  getStance() { return this.stance; }
  setSpeed(_n?: number) { /* no speed control against a person */ }
  setPaused(_p?: boolean) { /* a match against a person never pauses */ }
  setAiStyle(_id?: string) { return this.aiStyle; }
  autoActStep() { return { ok: false, error: 'Not in a match against a friend' }; }
  stanceChoice(_uid?: string) { return null; }
  aiPlan() { return null; }
  aiOrders() { return null; }
  startTutorial() { return this.getState(); }

  /** The state standing orders plan on: the server's state plus the moves still on their way. */
  planState() { return this.predicted ?? this.state; }
  /** A Game-like wrapper for the standing-order runner (orders-run.ts reads `state` right after each act). */
  ordersGame(): any {
    const g = this;
    return { get state() { return g.planState(); }, get mode() { return g.mode; }, get options() { return g.options; }, act: (a: any) => g.act(a), legalActions: () => g.legalActions() };
  }

  /** Sends an action. Answers at once like Game.act: refused here when it can't be legal; otherwise it is queued for the server and the
   *  board changes when the server's view comes back (a server refusal re-syncs and is shown through onError). */
  act(action: any, _external = false): { ok: boolean; events?: any[]; error?: string } {
    if (!action || typeof action !== 'object') return { ok: false, error: 'No action' };
    if (!this.state) return { ok: false, error: 'No match' };
    if (this.status === 'over' || this.state.phase === 'over') return { ok: false, error: 'The match is over' };
    if (action.type === 'surrender') { void this.forfeit(); return { ok: true, events: [] }; }
    const base = this.planState();
    let a = action;
    if (base.priority !== 'player') {
      if (!(a.type === 'ability' && a.ability === 'brew')) return { ok: false, error: "It is your friend's turn" };
      a = { ...a, player: 'player' };
    }
    // the engine's own check on what this player can see (never shown; the server decides): catches double taps and stale clicks
    let next: any = null;
    try { const r: any = applyAction(clone(base), a); if (r && !r.ok) return { ok: false, error: r.error }; next = r && r.ok ? r.state : null; } catch { next = null; }
    this.predicted = next;
    this.queue.push(a);
    void this.pump();
    return { ok: true, events: [] };
  }
  private async pump() {
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.queue.length) {
        const a = this.queue.shift();
        const r = await this.send(a);
        if (!r.ok) { this.queue = []; this.predicted = null; if (r.error) this.onError?.(r.error); break; }
      }
    } finally {
      this.sending = false;
      if (!this.queue.length) this.predicted = null;
    }
  }
  /** One act round trip. On refusal the returned view (or a fresh read) puts the board back to the server's. */
  async send(a: any): Promise<{ ok: boolean; error?: string }> {
    let r: any;
    const answers = a.type === 'pass' || a.type === 'respond' || (a.type === 'ability' && a.ability === 'brew');
    for (let tries = 0; ; tries++) {
      // Nov 2 (Gauge): no Respond window closes under 2 s, so a quick answer can't show you hold something. It waits here; a clock a little out with the server's gets told how much longer.
      if (answers && this.windowSeenAt != null) { const left = this.windowSeenAt + this.respondMinMs - this.now(); if (left > 0) await new Promise((res) => setTimeout(res, left)); }
      if (a.type === 'pass' && !this.windowSeen) return { ok: true }; // the window already closed while this waited (the server passed)
      try { r = await this.t.call('act', { matchId: this.matchId, seq: this.seq, action: a }); }
      catch { this.log({ action: a, ok: false, error: 'offline', seq: this.seq }); await this.sync(); return { ok: false, error: "Can't reach the server. Try that again." }; }
      if (!(r && r.tooSoonMs > 0) || tries >= 3) break;
      await new Promise((res) => setTimeout(res, r.tooSoonMs + 30));
    }
    if (r && r.ok) { this.log({ action: a, ok: true, seq: r.view?.seq ?? this.seq }); if (r.view) this.applyView(r.view); return { ok: true }; }
    const error = String(r?.error || 'Refused');
    this.log({ action: a, ok: false, error, seq: this.seq });
    this.predicted = null;
    if (r && r.view) this.applyView(r.view, true); else await this.sync();
    return { ok: false, error };
  }
  private log(e: { action: any; ok: boolean; error?: string; seq: number }) { this.actLog.push(e); if (this.actLog.length > 300) this.actLog.shift(); }
  /** Test hook: sends straight to the server (no local check) and waits for its answer. */
  async actRemote(a: any): Promise<{ ok: boolean; error?: string; seq: number }> {
    const r = await this.send(a);
    return { ...r, seq: this.seq };
  }
  async forfeit(): Promise<any> {
    try { const r = await this.t.call('forfeit', { matchId: this.matchId }); if (r && r.view) this.applyView(r.view, true); return r; }
    catch (e) { return { ok: false, error: friendlyError(e) }; }
  }
  /** Asks the server to apply a timeout that is due (harmless when nothing is due). */
  async tickNow(): Promise<any> {
    this.lastTickCall = this.now();
    try { const r = await this.t.call('tick', { matchId: this.matchId }); if (r && r.ok && r.view) this.applyView(r.view); return r; }
    catch (e) { return { ok: false, error: friendlyError(e) }; }
  }
  /** Called twice a second: when the local clock is a second past the server's deadline, ask the server (at most every 2 s), so a
   *  timeout happens even when the other player has left. */
  async maybeTick(): Promise<boolean> {
    if (this.status !== 'active' || !this.state) return false;
    const now = this.now();
    const due = this.respondDeadline != null ? now > this.respondDeadline + 1000 : (this.deadline != null && now > this.deadline + 1000);
    if (!due || now - this.lastTickCall < 2000) return false;
    await this.tickNow();
    return true;
  }
}

// ------------------------------------------------------------------ room screens
let app: App | null = null;
let current: NetGame | null = null;
let activeMatch: string | null = null;
let roomCode: string | null = null;
let roomTimer: any = null;
/** flow.ts (and the mock start in test pages) hand over the App. */
export function bindPvpApp(a: App) { app = a; }
export const currentNetGame = () => current;

function h(tag: string, attrs: Record<string, any> = {}, ...kids: (string | Node | null | undefined | false)[]): El {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
const nbtn = (label: string, onclick: (e: Event) => void, cls = '', attrs: Record<string, any> = {}) => h('button', { type: 'button', class: `net-btn ${cls}`.trim(), onclick, ...attrs }, label) as HTMLButtonElement;

function screen(name: string, ...kids: (El | null)[]): El {
  stopRoomPoll();
  app!.clear();
  const panel = h('div', { class: 'net-panel pvp-panel' }, ...kids);
  const bar = h('div', { class: 'test-server-bar', 'data-testid': 'test-server-bar' }, isMockPvp() ? 'TEST — local practice server' : 'TEST SERVER — practice accounts only');
  app!.root.append(h('main', { class: 'screen net-screen pvp-screen', 'data-screen': 'pvp-' + name }, bar, panel));
  return panel;
}
const alertEl = () => h('p', { class: 'net-alert', role: 'alert' });
function stopRoomPoll() { if (roomTimer) { clearInterval(roomTimer); roomTimer = null; } }

/** Main-menu extras when signed in: "Play a friend", and "Back to your match" while one is active. */
export function pvpMenu(el: El): void {
  if (!net.active) return;
  const box = h('div', { class: 'pvp-menu', role: 'group', 'aria-label': 'Play a friend' });
  box.append(nbtn('Play a friend', () => showFriend(), 'pvp-menu-btn primary', { 'data-testid': 'pvp-play-friend' }));
  const addBack = (id: string) => {
    if (box.querySelector('.pvp-back-btn')) return;
    box.prepend(nbtn('Back to your match', () => { void openMatch(id); }, 'pvp-back-btn primary', { 'data-testid': 'pvp-back-to-match' }));
  };
  if (activeMatch) addBack(activeMatch);
  el.append(box);
  // keep it honest: ask the server whether a match is still running
  void transport().call('my_match', {}).then((r: any) => {
    const id = r && r.ok ? r.matchId || null : activeMatch;
    activeMatch = id;
    if (id && box.isConnected) addBack(id);
    else if (!id) box.querySelector('.pvp-back-btn')?.remove();
  }).catch(() => {});
}

/** flow.ts proceed(): straight back into a running match after signing in or reloading. True when a match was opened. */
export async function resumePvp(): Promise<boolean> {
  try {
    const r = await transport().call('my_match', {});
    const id = r && r.ok ? r.matchId : null;
    activeMatch = id || null;
    if (!id) return false;
    return await openMatch(id);
  } catch { return false; }
}

export function showFriend() {
  screen('friend',
    h('div', { class: 'pvp-hero', 'aria-hidden': 'true' }, h('img', { class: 'pvp-swords', src: '/art/ui/badges/icon-sword-silver.webp', alt: '' })),
    h('h1', {}, 'Play a friend'),
    h('p', {}, 'Make a secret code and send it to a friend, or type in the code a friend sent you.'),
    h('div', { class: 'net-actions pvp-choice' },
      nbtn('Make a code', () => showMake(), 'primary pvp-make', { 'data-testid': 'pvp-make' }),
      nbtn('I have a code', () => showJoin(), 'pvp-join', { 'data-testid': 'pvp-join' })),
    h('div', { class: 'net-actions' }, nbtn('Back', () => app!.showMenu(), 'pvp-back')));
}

/** Commander + deck: the three starter Commanders and the player's saved decks (a starter deck when none is picked). */
function picker() {
  const ids = Object.keys(COMMANDERS).filter((id) => !(COMMANDERS as any)[id].locked);
  let cmd = ids.includes('grubnak') ? 'grubnak' : ids[0];
  const sel = h('select', { class: 'net-input pvp-deck', 'aria-label': 'Deck', 'data-testid': 'pvp-deck' }) as HTMLSelectElement;
  const cmdRow = h('div', { class: 'pvp-cmds', role: 'radiogroup', 'aria-label': 'Commander' });
  const portrait = (id: string) => (id === 'grubnak' ? '/art/owner/goblin/grubnak-on-throne-art.png' : id === 'sproingle' ? '/art/owner/gnome/sproingle-portrait.webp' : id === 'borgo' ? '/art/owner/dwarf/borgo-portrait.webp' : `/art/commanders/${id}.webp`);
  const fillDecks = () => {
    const fac = (COMMANDERS as any)[cmd].faction;
    sel.replaceChildren();
    const starters = h('optgroup', { label: 'Starter decks' });
    for (const d of STARTER_DECK_LIST.filter((x) => x.faction === fac)) starters.append(h('option', { value: 'starter:' + d.id }, d.name));
    sel.append(starters);
    const mine = (net.decks || []).map((d, i) => ({ d, i })).filter(({ d }) => (!d.commander || d.commander === cmd) && d.cards.every((c) => CARDS[c]) && deckProblems(d.cards, cmd).length === 0);
    if (mine.length) { const g = h('optgroup', { label: 'My decks' }); for (const { d, i } of mine) g.append(h('option', { value: 'saved:' + i }, d.name)); sel.append(g); }
    sel.value = 'starter:' + warbandOf(fac);
  };
  for (const id of ids) {
    const c = (COMMANDERS as any)[id];
    const b = h('button', { type: 'button', class: 'pvp-cmd', role: 'radio', 'aria-checked': String(id === cmd), 'aria-label': c.name, 'data-commander': id, 'data-faction': c.faction, title: c.name },
      h('img', { src: portrait(id), alt: '', draggable: 'false' }), h('span', { class: 'pvp-cmd-name', 'aria-hidden': 'true' }, ({ grubnak: 'Grubnak', sproingle: 'Knobbin', borgo: 'Borgo' } as Record<string, string>)[id] || String(c.name).split(/[ ,]/)[0]));
    b.addEventListener('click', () => { cmd = id; cmdRow.querySelectorAll('.pvp-cmd').forEach((x) => x.setAttribute('aria-checked', String((x as El).dataset.commander === id))); fillDecks(); sel.dispatchEvent(new Event('deckschanged')); });
    cmdRow.append(b);
  }
  fillDecks();
  // the deck list, painted (Gauge, Nov 2: open, the browser's own list showed): the real <select> stays underneath and holds the value
  sel.classList.remove('pvp-deck'); sel.classList.add('pvp-deck-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
  const deckBtn = h('button', { type: 'button', class: 'net-input pvp-deck', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': 'Deck', 'data-testid': 'pvp-deck-open' });
  const deckMenu = h('div', { class: 'pvp-deck-menu', role: 'listbox', 'aria-label': 'Deck', hidden: true });
  const showDeck = () => { deckBtn.textContent = sel.selectedOptions[0]?.textContent || 'Pick a deck'; };
  const closeDeck = (focus = false) => { deckMenu.hidden = true; deckBtn.setAttribute('aria-expanded', 'false'); if (focus) deckBtn.focus(); };
  const pickDeck = (v: string) => { sel.value = v; showDeck(); closeDeck(true); };
  const openDeck = () => {
    deckMenu.replaceChildren();
    for (const g of Array.from(sel.querySelectorAll('optgroup'))) {
      deckMenu.append(h('div', { class: 'pvp-deck-group', role: 'presentation' }, g.label));
      for (const o of Array.from(g.querySelectorAll('option'))) deckMenu.append(h('button', { type: 'button', class: 'pvp-deck-item', role: 'option', 'aria-selected': String(o.value === sel.value), 'data-deck': o.value, onclick: () => pickDeck(o.value) }, o.textContent));
    }
    // fixed, because the panel around it clips; it opens upward and scrolls when the room above is short (a phone)
    const box = deckBtn.getBoundingClientRect();
    Object.assign(deckMenu.style, { left: box.left + 'px', minWidth: box.width + 'px', bottom: (window.innerHeight - box.top + 6) + 'px', maxHeight: Math.max(120, box.top - 34) + 'px' });
    deckMenu.hidden = false; deckBtn.setAttribute('aria-expanded', 'true');
    ((deckMenu.querySelector('[aria-selected=true]') || deckMenu.querySelector('.pvp-deck-item')) as El | null)?.focus();
  };
  deckBtn.addEventListener('click', () => { if (deckMenu.hidden) openDeck(); else closeDeck(); });
  deckMenu.addEventListener('keydown', (e: KeyboardEvent) => {
    const items = Array.from(deckMenu.querySelectorAll('.pvp-deck-item')) as El[], at = items.indexOf(document.activeElement as El);
    if (e.key === 'Escape') { e.stopPropagation(); closeDeck(true); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus(); }
  });
  deckMenu.addEventListener('focusout', (e: FocusEvent) => { if (!deckMenu.hidden && !deckMenu.contains(e.relatedTarget as Node) && e.relatedTarget !== deckBtn) closeDeck(); });
  sel.addEventListener('deckschanged', showDeck);
  showDeck();
  const el = h('div', { class: 'pvp-picker' }, cmdRow, h('div', { class: 'pvp-deck-label' }, h('span', {}, 'Deck'), h('div', { class: 'pvp-deck-box' }, deckBtn, deckMenu, sel)));
  return {
    el,
    value(): { commander: string; deckId?: string; cards?: string[] } {
      const v = sel.value || '';
      // a saved deck goes by its server id (the server re-reads and re-checks it); its card list only if it has no id
      if (v.startsWith('saved:')) { const d = net.decks[+v.slice(6)]; if (d) return d.id ? { commander: cmd, deckId: d.id } : { commander: cmd, cards: d.cards.slice() }; }
      return { commander: cmd, deckId: v.startsWith('starter:') ? v.slice(8) : warbandOf((COMMANDERS as any)[cmd].faction) };
    },
  };
}

function showMake() {
  const p = picker(), err = alertEl();
  const go = nbtn('Make my code', async () => {
    go.disabled = true; err.textContent = '';
    const r = await makeCode(p.value());
    if (!r.ok) { go.disabled = false; err.textContent = r.error || ''; }
  }, 'primary pvp-go', { 'data-testid': 'pvp-create' });
  screen('make', h('h1', {}, 'Make a code'), p.el, err, h('div', { class: 'net-actions' }, go, nbtn('Back', () => showFriend())));
}

/** create → the code screen ("Waiting for your friend…", polling `room` every 2 s). */
export async function makeCode(pick: { commander: string; deckId?: string; cards?: string[] }): Promise<{ ok: boolean; code?: string; error?: string }> {
  let r: any;
  try { r = await transport().call('create', { commander: pick.commander, ...(pick.cards ? { cards: pick.cards } : { deckId: pick.deckId }) }); }
  catch (e) { return { ok: false, error: friendlyError(e) }; }
  if (!r || !r.ok || !r.code) return { ok: false, error: friendlyError(r?.error || 'Could not make a code') };
  showCode(r.code);
  return { ok: true, code: r.code };
}

function showCode(code: string) {
  roomCode = code;
  const copyNote = h('span', { class: 'pvp-copied', role: 'status' });
  const copy = nbtn('Copy', async () => {
    try { await navigator.clipboard.writeText(code); copyNote.textContent = 'Copied!'; }
    catch { copyNote.textContent = 'Select the letters to copy them'; }
    setTimeout(() => { copyNote.textContent = ''; }, 1800);
  }, 'pvp-copy', { 'data-testid': 'pvp-copy' });
  const err = alertEl();
  const waiting = h('p', { class: 'pvp-waiting', role: 'status' }, 'Waiting for your friend', h('span', { class: 'pvp-dots', 'aria-hidden': 'true' }, h('i', {}, '.'), h('i', {}, '.'), h('i', {}, '.')));
  const cancel = nbtn('Cancel', async () => {
    stopRoomPoll();
    try { await transport().call('cancel', { code }); } catch { /* it expires by itself */ }
    roomCode = null; showFriend();
  }, 'pvp-cancel');
  const panel = screen('code', h('h1', {}, 'Your secret code'),
    h('p', {}, 'Send these letters to your friend. The battle starts the moment they type them in.'),
    h('div', { class: 'pvp-code', 'data-code': code, 'aria-label': 'Room code ' + code.split('').join(' '), role: 'img' }, ...code.split('').map((ch, i) => h('span', { class: 'pvp-letter', style: `--i:${i}`, 'aria-hidden': 'true' }, ch))),
    h('div', { class: 'pvp-copy-row' }, copy, copyNote),
    waiting, err,
    h('div', { class: 'net-actions' }, cancel));
  const poll = async () => {
    if (!panel.isConnected) { stopRoomPoll(); return; }
    try {
      const r = await transport().call('room', { code });
      if (!panel.isConnected) return;
      if (r && r.ok && r.status === 'started' && r.matchId) { stopRoomPoll(); roomCode = null; await openMatch(r.matchId); }
      else if (r && r.ok && (r.status === 'expired' || r.status === 'cancelled')) {
        stopRoomPoll(); waiting.textContent = '';
        err.textContent = r.status === 'expired' ? 'That code has expired. Make a new one!' : 'That code was cancelled.';
        cancel.textContent = 'Back';
      } else if (r && !r.ok) err.textContent = friendlyError(r.error);
    } catch { /* keep polling */ }
  };
  stopRoomPoll();
  roomTimer = setInterval(() => { void poll(); }, 2000);
}

function showJoin() {
  const p = picker(), err = alertEl();
  const input = h('input', { class: 'net-input pvp-code-input', id: 'pvp-code-input', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '6', placeholder: 'ABCDEF', 'data-testid': 'pvp-code-input' }) as HTMLInputElement;
  const go = nbtn('Join the battle', async () => {
    const code = cleanCode(input.value);
    if (!codeOk(code)) { err.textContent = 'A code is six letters (there is no I or O).'; input.focus(); return; }
    go.disabled = true; err.textContent = '';
    const r = await joinCode(code, p.value());
    if (!r.ok) { go.disabled = false; err.textContent = r.error || ''; }
  }, 'primary pvp-go', { 'data-testid': 'pvp-join-go' });
  input.addEventListener('input', () => { const c = cleanCode(input.value); if (c !== input.value) input.value = c; err.textContent = ''; go.disabled = !codeOk(c); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
  go.disabled = true;
  screen('join', h('h1', {}, 'I have a code'), h('label', { for: 'pvp-code-input', class: 'pvp-code-label' }, "Your friend's code"), input, p.el, err, h('div', { class: 'net-actions' }, go, nbtn('Back', () => showFriend())));
  setTimeout(() => input.focus(), 0);
}

/** join → straight into the match. */
export async function joinCode(code: string, pick: { commander: string; deckId?: string; cards?: string[] }): Promise<{ ok: boolean; matchId?: string; error?: string }> {
  code = cleanCode(code);
  if (!codeOk(code)) return { ok: false, error: 'A code is six letters (there is no I or O).' };
  let r: any;
  try { r = await transport().call('join', { code, commander: pick.commander, ...(pick.cards ? { cards: pick.cards } : { deckId: pick.deckId }) }); }
  catch (e) { return { ok: false, error: friendlyError(e) }; }
  if (!r || !r.ok || !r.matchId) return { ok: false, error: friendlyError(r?.error || 'Could not join') };
  const ok = await openMatch(r.matchId, r.view);
  return ok ? { ok: true, matchId: r.matchId } : { ok: false, error: 'Could not open the match' };
}

/** Opens a match on the match screen (the app does not know it is online except through beginNetMatch). */
export async function openMatch(matchId: string, view?: any): Promise<boolean> {
  if (!app) return false;
  stopRoomPoll();
  if (current && current.matchId === matchId && current.state && (app as any).netGame === current && app.root.querySelector('.match')) return true;
  current?.stop();
  const ng = new NetGame(transport(), matchId, view);
  if (!ng.state && !(await ng.sync())) {
    screen('error', h('h1', {}, 'Lost the match'), h('p', {}, "Can't reach the server. Check your connection and try again."),
      h('div', { class: 'net-actions' }, nbtn('Try again', () => { void openMatch(matchId); }, 'primary'), nbtn('Back', () => app!.showMenu())));
    return false;
  }
  current = ng;
  activeMatch = ng.status === 'active' ? matchId : null;
  ng.subscribe(() => { if (ng.status === 'over' && activeMatch === matchId) activeMatch = null; });
  app.beginNetMatch(ng);
  ng.start();
  return true;
}

/** The match screen let go of this match (result screen closed, or another screen opened). */
export function releaseNetGame(ng: { stop(): void }) { ng.stop(); if (current === ng) current = null; }

// ------------------------------------------------------------------ test hooks (window.oreheart.pvp, test pages only)
export function pvpHooks() {
  const safe = (f: () => any) => { try { const r: any = f(); return r && typeof r.then === 'function' ? r.catch((e: any) => ({ ok: false, error: String(e?.message || e) })) : r; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; } };
  const pick = (commander?: string, deckId?: string) => { const c = commander && (COMMANDERS as any)[commander] ? commander : 'grubnak'; return { commander: c, deckId: deckId && STARTER_DECK_LIST.some((d) => d.id === deckId) ? deckId : warbandOf((COMMANDERS as any)[c].faction) }; };
  const none = () => Promise.resolve({ ok: false, error: 'No match' });
  return {
    create: (commander?: string, deckId?: string) => safe(() => makeCode(pick(commander, deckId))),
    join: (code: string, commander?: string, deckId?: string) => safe(() => joinCode(code, pick(commander, deckId))),
    view: () => safe(() => (current && current.view ? clone({ ...current.view, seq: current.seq, status: current.status }) : null)),
    act: (a: any) => safe(() => (current ? current.actRemote(a) : none())),
    forfeit: () => safe(() => (current ? current.forfeit() : none())),
    tick: () => safe(() => (current ? current.tickNow() : none())),
    seq: () => (current ? current.seq : -1),
    matchId: () => (current ? current.matchId : null),
    code: () => roomCode,
    actLog: () => (current ? clone(current.actLog) : []),
  };
}

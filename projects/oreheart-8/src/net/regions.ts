// Server regions (Ken, Nov 5: "so you can know the East Coast, West Coast, Central ... so players can log into their servers. And
// also I'd like to show for now how many players are in their server playing. Or waiting in lobby.").
// One database for everyone (East US); a region is a matchmaking pool, the edge the match function runs at for this player
// (x-region) and a home for the live counts. The player's server: the one they picked (remembered on the account and here),
// else the nearest by ping. Counts come from regions_info() (also the heartbeat that makes this player count as online).
import { h } from '../ui/app';
import { net } from './state';
import { api, stubMode, isTestPage } from './economy';
import { SUPABASE_URL } from './switch';

type El = HTMLElement;
export interface Region { id: string; name: string; edge: string; online?: number; playing?: number; waiting?: number }
export interface RegionsInfo { regions: Region[]; mine: string | null; fallback_seconds: number; counts: boolean }

const KEY = 'oreheart.region';
const FALLBACK_LIST: Region[] = [{ id: 'us-east', name: 'US East', edge: 'us-east-1' }, { id: 'us-central', name: 'US Central', edge: 'us-east-1' }, { id: 'us-west', name: 'US West', edge: 'us-west-1' }];
let info: RegionsInfo | null = null;
let loadedAt = 0;
let pings: Record<string, number | null> = {};
let pinged = false;
let chosen: string | null = ((): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } })();
const isMock = () => { const p = new URLSearchParams(location.search); return p.get('pvp') === 'mock' && p.get('test') === '1'; };

export const regionsNow = () => info;
export const pingOf = (id: string) => pings[id] ?? null;
export const regionList = (): Region[] => (info ? info.regions : FALLBACK_LIST);
export const regionById = (id: string | null) => (id ? regionList().find((r) => r.id === id) || null : null);
export const edgeOf = (id: string | null) => regionById(id)?.edge || 'us-east-1';
/** the nearest region by ping (the first listed when nothing was measured yet) */
export function nearestRegion(): string | null {
  const list = regionList();
  if (!list.length) return null;
  let best: Region | null = null;
  for (const r of list) { const p = pings[r.id]; if (p != null && (!best || p < (pings[best.id] as number))) best = r; }
  return (best || list[0]).id;
}
/** the region this player plays in: their own choice, else the account's, else the nearest */
export function currentRegion(): string | null {
  if (chosen && regionById(chosen)) return chosen;
  if (info && info.mine && regionById(info.mine)) return info.mine;
  return nearestRegion();
}
export const isAutoRegion = () => !(chosen && regionById(chosen)) && !(info && info.mine && regionById(info.mine));

/** regions_info() from the server (a 20 s cache; `force` refreshes). On a test page without a player it is stand-in data; on the mock PvP pages the mock's list. */
export async function loadRegions(force = false): Promise<RegionsInfo> {
  if (info && !force && Date.now() - loadedAt < 20_000) return info;
  let next: RegionsInfo;
  if (isMock()) {
    const t = await import('./pvp');
    let list: Region[] = FALLBACK_LIST;
    try { const r = await t.transport().call('regions', {}); if (r && r.ok && Array.isArray(r.regions) && r.regions.length) list = r.regions; } catch { /* the list below */ }
    next = { regions: list.map((r, i) => ({ ...r, online: [3, 1, 2][i] ?? 0, playing: [2, 0, 0][i] ?? 0, waiting: [1, 0, 1][i] ?? 0 })), mine: chosen, fallback_seconds: 4, counts: true };
  } else {
    next = await api.regionsInfo();
  }
  info = next; loadedAt = Date.now();
  return next;
}

/** Round trips to the match function at each region's edge, in ms (the better of two; the first warms the browser's CORS check). Once per page. */
export async function pingRegions(force = false): Promise<Record<string, number | null>> {
  if (pinged && !force) return pings;
  pinged = true;
  const list = regionList();
  if (isMock() || stubMode() || !SUPABASE_URL) { // no network on the test pages: East is "nearest"
    pings = Object.fromEntries(list.map((r, i) => [r.id, 24 + i * 23]));
    return pings;
  }
  const url = SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/match';
  const once = async (edge: string) => {
    const t0 = performance.now();
    try { await fetch(url, { method: 'POST', headers: { 'x-region': edge, 'content-type': 'application/json' }, body: '{}', cache: 'no-store' }); } catch { return null; } // a 401 is the answer we want: quick, no database
    return Math.round(performance.now() - t0);
  };
  const out: Record<string, number | null> = {};
  await Promise.all(list.map(async (r) => { await once(r.edge); const a = await once(r.edge), b = await once(r.edge); out[r.id] = a == null && b == null ? null : Math.min(a ?? 1e9, b ?? 1e9); }));
  pings = out;
  return pings;
}

/** The player picks a server (null = back to "nearest"). Remembered here and on the account. */
export async function chooseRegion(id: string | null): Promise<void> {
  chosen = id;
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* fine */ }
  if (isMock() || stubMode() || !net.active) { if (info) info.mine = id; return; }
  try { info = await api.setRegion(id); loadedAt = Date.now(); } catch { /* the choice still holds for this visit */ }
}

/** The heartbeat: while `el` is on screen and the tab is visible, regions_info() every 30 s (this player counts as online; the counts refresh). */
export function startHeartbeat(el: Element, onData?: (i: RegionsInfo) => void): () => void {
  let stop = false;
  const tick = async () => { if (stop || !el.isConnected) { stop = true; clearInterval(iv); return; } if (document.visibilityState !== 'visible') return; try { const i = await loadRegions(true); if (!stop && onData) onData(i); } catch { /* next time */ } };
  const iv = setInterval(() => { void tick(); }, 30_000);
  return () => { stop = true; clearInterval(iv); };
}

const n = (x: number | undefined) => (x == null ? '–' : String(x));
export const countsText = (r: Region, counts = true) => (counts && r.online != null ? `${n(r.online)} online · ${n(r.playing)} playing · ${n(r.waiting)} waiting` : 'counts are off');
/** the top-bar pill: "US East · online · 14 online" */
export function serverPillText(online: boolean): string {
  const r = regionById(currentRegion());
  if (!online) return 'Test server · cannot reach it';
  if (!r) return 'Test server · online';
  return `${r.name} · online${info && info.counts && r.online != null ? ` · ${r.online} here` : ''}`;
}

/** The server picker for the PvP Lobby's left column: one row per enabled region with its ping and live counts; the player's server is lit. */
export function regionPanel(opts: { onChange?: (id: string) => void } = {}): El {
  const list = h('div', { class: 'srv-list', role: 'radiogroup', 'aria-label': 'Server region' });
  const note = h('p', { class: 'auto', 'data-testid': 'region-note' }, '');
  const panel = h('section', { class: 'panel', 'data-testid': 'lobby-server', 'aria-label': 'Server' },
    h('div', { class: 'ptitle h' }, h('img', { src: '/art/ui/silver/icon-play.webp', alt: '' }), 'Server', h('button', { type: 'button', class: 'more', 'aria-label': 'Refresh the player counts', title: 'Refresh', onclick: () => { void loadRegions(true).then(draw).catch(() => {}); } }, '↻')),
    list, note);
  const draw = () => {
    const cur = currentRegion(), i = info;
    list.replaceChildren(...regionList().map((r) => {
      const on = r.id === cur, p = pings[r.id];
      const b = h('button', { type: 'button', class: 'srv well' + (on ? ' sel' : ''), role: 'radio', 'aria-checked': String(on), 'data-region': r.id, 'data-testid': 'region-' + r.id, 'aria-label': `${r.name}${p != null ? `, ${p} ms` : ''}: ${countsText(r, !i || i.counts)}`,
        onclick: () => { void chooseRegion(r.id).then(() => { draw(); opts.onChange?.(r.id); }); } },
        h('h4', {}, h('span', { class: 'radio' + (on ? ' on' : '') }), r.name, h('small', { class: 'ping', 'data-testid': 'region-ping' }, p == null ? (pinged ? 'no answer' : '… ms') : `${p} ms`)),
        h('p', { class: 'auto cnt' }, countsText(r, !i || i.counts)));
      return b;
    }));
    const cr = regionById(cur);
    note.textContent = cr ? (isAutoRegion() ? `${cr.name} is the nearest by ping; tap another to switch. Nobody near after ${i ? i.fallback_seconds : 45} s and the game offers every region.` : `Your server is ${cr.name}. Nobody near after ${i ? i.fallback_seconds : 45} s and the game offers every region.`) : 'No server is open right now.';
  };
  draw();
  void loadRegions().then(draw).catch(() => {});
  void pingRegions().then(draw).catch(() => {});
  startHeartbeat(panel, draw); // the counts refresh every 30 s while the panel is on screen
  return panel;
}
export { isTestPage };

// Emotes (Ken, Nov 7: "emotes ... that come out of your little character bubble. Your avatar"; "when you click your avatar, it'll pop up
// the emote dial where you can click and select which emote you want"). Sketch's stickers (src/content/emotes.json): ten free for
// everyone, three faction packs for coins or Oreshards. In a match: click your own avatar for the dial (your equipped wheel, up to 8);
// the sticker pops out of your avatar, the opponent's out of theirs; one every 2 s; the opponent's can be muted.
// Friend-ask (Ken): "Friends?" puts Yes! / No thanks under the other player's avatar for 15 s. Yes! shows their friend code on a plate
// under the Yes sticker AND sends a friend request; the asker's game sends one back, which makes them friends. No thanks: no more asks
// this match. The server's friend doors keep blocks and the friends-max rule.
import CATALOG from '../content/emotes.json';
import { h } from '../ui/app';
import { net } from './state';
import { rpc } from './online';
import { isTestPage, stubMode } from './economy';

type El = HTMLElement;
export interface EmotePack { id: string; name: string; free: boolean; emotes: { id: string; label: string }[] }
export const PACKS: EmotePack[] = (CATALOG as any).packs;
export const DEFAULT_WHEEL: string[] = (CATALOG as any).wheel_default;
const LABEL = new Map<string, string>(PACKS.flatMap((p) => p.emotes.map((e) => [e.id, e.label] as [string, string])));
const FREE = new Set<string>(PACKS.filter((p) => p.free).flatMap((p) => p.emotes.map((e) => e.id)));
export const emoteUrl = (id: string) => `/art/emotes/${id}.webp`;
export const emoteLabel = (id: string) => LABEL.get(id) || id;
export const FRIENDS = 'free-starter/friends', YES = 'free-starter/yes', NO = 'free-starter/no-thanks';
const COOLDOWN = 2000;

// ------------------------------------------------------------------ the server doors (stand-ins on test pages)
const STUB = { owned: new Set<string>(FREE), wheel: DEFAULT_WHEEL.slice(), coins: 2000, shards: 1000 };
export interface EmoteShop { coins: number; oreshards: number; packs: (EmotePack & { price_coins: number | null; price_oreshards: number | null; owned: boolean; emotes: { id: string; label: string; price_coins: number | null; price_oreshards: number | null; owned: boolean }[] })[] }
export const api = {
  async mine(): Promise<{ owned: string[]; wheel: string[] }> {
    if (stubMode() || !net.active) return { owned: [...STUB.owned], wheel: STUB.wheel.slice() };
    return await rpc('my_emotes');
  },
  async setWheel(ids: string[]): Promise<{ wheel: string[] }> {
    if (stubMode() || !net.active) { STUB.wheel = ids.slice(0, 8); return { wheel: STUB.wheel.slice() }; }
    return await rpc('set_emote_wheel', { p_ids: ids });
  },
  async shop(): Promise<EmoteShop> {
    if (stubMode() || !net.active) {
      return { coins: STUB.coins, oreshards: STUB.shards, packs: PACKS.map((p) => ({ ...p, price_coins: p.free ? null : 800, price_oreshards: p.free ? null : 400, owned: p.emotes.every((e) => STUB.owned.has(e.id)),
        emotes: p.emotes.map((e) => ({ ...e, price_coins: p.free ? null : 200, price_oreshards: p.free ? null : 100, owned: STUB.owned.has(e.id) })) })) };
    }
    return await rpc('emote_shop');
  },
  async buy(what: 'pack' | 'emote', id: string, pay: 'coins' | 'oreshards'): Promise<any> {
    if (stubMode() || !net.active) {
      const ids = what === 'pack' ? (PACKS.find((p) => p.id === id)?.emotes.map((e) => e.id) || []) : [id];
      const cost = what === 'pack' ? (pay === 'coins' ? 800 : 400) : (pay === 'coins' ? 200 : 100);
      if (pay === 'coins') { if (STUB.coins < cost) throw new Error(`Not enough coins (this costs ${cost}).`); STUB.coins -= cost; } else { if (STUB.shards < cost) throw new Error(`Not enough Oreshards (this costs ${cost}, you have ${STUB.shards}).`); STUB.shards -= cost; }
      ids.forEach((x) => STUB.owned.add(x)); return { ok: true, got: ids };
    }
    return await rpc('buy_emote', { p_what: what, p_id: id, p_pay: pay, p_idem_key: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) });
  },
};

// ------------------------------------------------------------------ in a match
export interface MatchCtx {
  /** the PvP game (null against the computer) */
  pvp: { sendEmote: (id: string, code?: string | null) => Promise<{ ok: boolean; error?: string }>; names: { them: string } } | null;
  myAv: () => El | null;
  theirAv: () => El | null;
}
let ctx: MatchCtx | null = null;
let wheel: string[] = DEFAULT_WHEEL.slice();
let lastSent = 0;
let mutedThem = false;
let askState: '' | 'asked' | 'refused' | 'done' = '';
let myCode: string | null = null;
const seen = new Set<number>();
let dial: El | null = null;
/** test pages: what was shown, newest last */
export const shownLog: { from: 'me' | 'them'; id: string; code?: string | null }[] = [];

/** a new match: the wheel (bought / free), no mute, no asks */
export function startMatchEmotes(c: MatchCtx): void {
  ctx = c; mutedThem = false; askState = ''; seen.clear(); closeDial(); shownLog.length = 0;
  void api.mine().then((m) => { wheel = (m.wheel && m.wheel.length ? m.wheel : DEFAULT_WHEEL).filter((x) => LABEL.has(x)).slice(0, 8); }).catch(() => { wheel = DEFAULT_WHEEL.slice(); });
  bindAvatar();
}
/** the plates are rebuilt now and then: the click lives on whatever avatar is there */
export function bindAvatar(): void {
  const av = ctx?.myAv();
  if (!av || (av as any)._emoteBound) return;
  (av as any)._emoteBound = true;
  av.classList.add('emote-av'); av.removeAttribute('aria-hidden'); av.setAttribute('role', 'button'); av.setAttribute('tabindex', '0'); av.setAttribute('aria-label', 'Emotes'); av.setAttribute('data-testid', 'emote-avatar');
  av.title = 'Emotes';
  const open = (e: Event) => { e.stopPropagation(); e.preventDefault(); if (dial) closeDial(); else openDial(); };
  av.addEventListener('click', open);
  av.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') open(e); });
  const theirs = ctx?.theirAv(); if (theirs) theirs.classList.add('emote-av-them');
}

export function closeDial() { dial?.remove(); dial = null; document.removeEventListener('pointerdown', outside, true); }
const outside = (e: Event) => { if (dial && !dial.contains(e.target as Node) && !(ctx?.myAv()?.contains(e.target as Node))) closeDial(); };

function openDial(): void {
  const av = ctx?.myAv(); if (!av) return;
  const r = av.getBoundingClientRect();
  const list = (wheel.length ? wheel : DEFAULT_WHEEL).slice(0, 8);
  const size = innerWidth < 900 || innerHeight < 500 ? 52 : 64, gap = 8;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  // a quarter-circle fan in two rings, opening toward the middle of the screen (up and right from the bottom-left avatar):
  // never off screen, the buttons never overlap, and it closes as soon as one is picked
  const dx = cx < innerWidth / 2 ? 1 : -1, dy = cy > innerHeight / 2 ? -1 : 1;
  const a0 = Math.atan2(dy, 0), a1 = Math.atan2(0, dx);
  const inner = Math.min(4, list.length), outer = list.length - inner;
  const R1 = Math.max(r.width / 2 + size / 2 + gap, (size + gap) / (2 * Math.sin(Math.PI / 12))), R2 = R1 + size + gap;
  const at = (i: number, n: number, R: number) => { const f = n === 1 ? 0.5 : i / (n - 1); const a = a0 + (a1 - a0) * f; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; };
  const am = (a0 + a1) / 2, Rm = (outer ? R2 : R1) + size * 0.95;
  dial = h('div', { class: 'emote-dial', role: 'menu', 'aria-label': 'Emotes', 'data-testid': 'emote-dial', style: `--es:${size}px` },
    ...list.map((id, i) => {
      const [x, y] = i < inner ? at(i, inner, R1) : at(i - inner, outer, R2);
      const disabled = id === FRIENDS && (!ctx?.pvp || askState !== '');
      return h('button', { type: 'button', class: 'emote-pick', role: 'menuitem', 'data-emote': id, 'aria-label': emoteLabel(id), title: disabled && id === FRIENDS ? (ctx?.pvp ? 'Already asked this match' : 'Only against a player') : emoteLabel(id),
        disabled: disabled ? 'true' : null, style: `left:${Math.round(x)}px;top:${Math.round(y)}px;animation-delay:${i * 18}ms`, onclick: () => { closeDial(); void send(id); } }, h('img', { src: emoteUrl(id), alt: '', draggable: 'false' }));
    }),
    ctx?.pvp ? h('button', { type: 'button', class: 'emote-mute', 'data-testid': 'emote-mute', 'aria-pressed': String(mutedThem), style: `left:${Math.round(cx + Math.cos(am) * Rm)}px;top:${Math.round(cy + Math.sin(am) * Rm)}px`,
      onclick: () => { mutedThem = !mutedThem; closeDial(); } }, mutedThem ? 'Unmute opponent' : 'Mute opponent') : null);
  document.body.append(dial);
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}

async function send(id: string, code: string | null = null): Promise<void> {
  const now = Date.now();
  if (now - lastSent < COOLDOWN) return;
  lastSent = now;
  pop('me', id, code);
  if (id === FRIENDS) askState = 'asked';
  if (ctx?.pvp) { const r = await ctx.pvp.sendEmote(id, code); if (!r.ok && r.error) console.info('emote', r.error); }
}

/** a sticker pops out of an avatar (CSS squash and stretch); a Yes to a Friends? ask carries the friend code on a plate under it */
export function pop(from: 'me' | 'them', id: string, code?: string | null): void {
  shownLog.push({ from, id, code: code || null });
  const av = from === 'me' ? ctx?.myAv() : ctx?.theirAv(); if (!av) return;
  const r = av.getBoundingClientRect();
  const up = r.top > innerHeight / 2;
  const s = h('div', { class: `emote-pop ${from}`, 'data-testid': 'emote-pop', 'data-emote': id, 'data-from': from, role: 'status', 'aria-label': `${from === 'me' ? 'You' : 'Opponent'}: ${emoteLabel(id)}`,
    style: `left:${r.left + r.width / 2}px;top:${up ? r.top : r.bottom}px;--dy:${up ? '-100%' : '0%'}` },
    h('img', { src: emoteUrl(id), alt: '', draggable: 'false' }), code ? h('span', { class: 'emote-code', 'data-testid': 'emote-code' }, 'Friend code ', h('b', {}, code)) : null);
  document.body.append(s);
  setTimeout(() => s.classList.add('out'), code ? 5200 : 2400);
  setTimeout(() => s.remove(), code ? 5700 : 2900);
}

/** the other player's emotes from the server view (each one once) */
export function takeEmotes(list: { from: 'me' | 'them'; id: string; n: number; code?: string | null }[] | undefined): void {
  if (!Array.isArray(list)) return;
  for (const e of list) {
    if (seen.has(e.n)) continue;
    seen.add(e.n);
    if (e.from !== 'them' || !LABEL.has(e.id)) continue;
    if (!mutedThem) pop('them', e.id, e.code);
    if (e.id === FRIENDS) offerAnswer();
    else if (e.id === YES && askState === 'asked') { askState = 'done'; void befriend(ctx?.pvp?.names.them || '', true); }
    else if (e.id === NO && askState === 'asked') askState = 'refused';
  }
}
/** the views also carry the emotes seen before this browser joined: those count as seen */
export function markSeen(list: { n: number }[] | undefined): void { if (Array.isArray(list)) for (const e of list) seen.add(e.n); }

function offerAnswer(): void {
  const av = ctx?.theirAv(); if (!av || !ctx?.pvp) return;
  document.querySelector('.emote-answer')?.remove();
  const r = av.getBoundingClientRect();
  const box = h('div', { class: 'emote-answer', 'data-testid': 'emote-answer', role: 'group', 'aria-label': 'Friends?', style: `left:${r.left + r.width / 2}px;top:${r.bottom + 8}px` },
    h('button', { type: 'button', class: 'net-btn primary', 'data-testid': 'emote-yes', onclick: async () => { box.remove(); const code = await friendCode(); void send(YES, code); void befriend(ctx?.pvp?.names.them || '', false); } }, 'Yes!'),
    h('button', { type: 'button', class: 'net-btn', 'data-testid': 'emote-no', onclick: () => { box.remove(); void send(NO); } }, 'No thanks'));
  document.body.append(box);
  setTimeout(() => box.remove(), 15000); // an ignored ask runs out
}
async function friendCode(): Promise<string | null> {
  if (myCode) return myCode;
  try { const m = await import('./friends'); const o: any = await m.overview(); myCode = o && o.code ? String(o.code) : null; } catch { myCode = null; }
  return myCode;
}
async function befriend(name: string, closing: boolean): Promise<void> {
  if (!name) return;
  try {
    const m = await import('./friends');
    const r: any = await m.call('request', { who: name });
    const { toast } = await import('./economy');
    if (r && r.ok !== false) toast(r.state === 'friends' ? `You and ${name} are friends now!` : `Friend request sent to ${name}.`, '/art/emotes/free-starter/friends.webp');
    else if (r && r.error && closing) toast(String(r.error), '/art/emotes/free-starter/friends.webp');
  } catch { /* offline: nothing to do */ }
}

/** test pages: the match emote state and a way to play the other side */
export function emoteHooks() {
  if (!isTestPage()) return null;
  return { shown: () => shownLog.slice(), wheel: () => wheel.slice(), muted: () => mutedThem, ask: () => askState, fromThem: (id: string, n: number, code?: string) => takeEmotes([{ from: 'them', id, n, code }]), owned: () => [...STUB.owned] };
}

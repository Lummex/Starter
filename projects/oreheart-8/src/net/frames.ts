// Avatar frames, the Founder avatars, and the Shop's Frames and Emotes sections (Ken, Nov 7). Sketch's frames (src/content/frames.json):
// six for sale, the Founder frame (beta reward) and the Producer frame (Ken only; only an admin can grant it). A frame is drawn 1.88x the
// avatar circle, centred over it, wherever others see your avatar. The 32 Founder avatars (src/content/founder-avatars.json) come with
// the beta welcome; never sold.
import FRAMES from '../content/frames.json';
import FOUNDERS from '../content/founder-avatars.json';
import { h, type App } from '../ui/app';
import { net } from './state';
import { rpc } from './online';
import { isTestPage, stubMode, toast } from './economy';
import { api as emoteApi, emoteUrl, PACKS, DEFAULT_WHEEL, emoteLabel } from './emotes';

type El = HTMLElement;
export const FRAME_LIST: { id: string; name: string; kind: string }[] = (FRAMES as any).frames;
export const FOUNDER_AVATARS: { id: string; label: string; group: string; gender: string }[] = (FOUNDERS as any).avatars;
const FRAME_NAME = new Map(FRAME_LIST.map((f) => [f.id, f.name]));
export const frameUrl = (id: string) => `/art/avatar-frames/${id}.webp`;
export const frameName = (id: string | null | undefined) => (id ? FRAME_NAME.get(id) || id : 'No frame');

/** draws (or clears) a frame over an avatar circle; the avatar element keeps its own size */
export function decorate(av: El | null | undefined, frame: string | null | undefined, title?: string | null): void {
  if (!av) return;
  av.querySelector(':scope > .av-frame')?.remove();
  av.classList.toggle('has-frame', !!frame && FRAME_NAME.has(frame));
  if (frame && FRAME_NAME.has(frame)) av.append(h('img', { class: 'av-frame', src: frameUrl(frame), alt: '', draggable: 'false', 'aria-hidden': 'true', 'data-frame': frame }));
  if (title) av.dataset.title = title; else delete av.dataset.title;
}

// ------------------------------------------------------------------ the server doors (stand-ins on test pages)
export interface MyFrames { equipped: string | null; title: string | null; coins: number; oreshards: number; frames: { id: string; name: string; kind: string; price_coins: number | null; price_oreshards: number | null; owned: boolean }[]; avatars: string[] }
const STUB = { owned: new Set<string>(), equipped: null as string | null, coins: 2000, shards: 1000, avatars: [] as string[] };
export const api = {
  async mine(): Promise<MyFrames> {
    if (stubMode() || !net.active) return { equipped: STUB.equipped, title: null, coins: STUB.coins, oreshards: STUB.shards, avatars: STUB.avatars.slice(),
      frames: FRAME_LIST.filter((f) => f.kind === 'store' || STUB.owned.has(f.id)).map((f) => ({ ...f, price_coins: f.kind === 'store' ? 1000 : null, price_oreshards: f.kind === 'store' ? 500 : null, owned: STUB.owned.has(f.id) })) };
    return await rpc('my_frames');
  },
  async setFrame(id: string | null): Promise<{ equipped: string | null }> {
    if (stubMode() || !net.active) { if (id && !STUB.owned.has(id)) throw new Error("You don't have that frame yet."); STUB.equipped = id; return { equipped: id }; }
    return await rpc('set_frame', { p_id: id });
  },
  async buy(id: string, pay: 'coins' | 'oreshards'): Promise<any> {
    if (stubMode() || !net.active) {
      const cost = pay === 'coins' ? 1000 : 500;
      if (pay === 'coins') { if (STUB.coins < cost) throw new Error(`Not enough coins (this costs ${cost}).`); STUB.coins -= cost; } else { if (STUB.shards < cost) throw new Error(`Not enough Oreshards (this costs ${cost}, you have ${STUB.shards}).`); STUB.shards -= cost; }
      STUB.owned.add(id); return { ok: true, frame: id };
    }
    return await rpc('buy_frame', { p_id: id, p_pay: pay, p_idem_key: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) });
  },
  async setAvatar(id: string): Promise<void> {
    if (stubMode() || !net.active) { net.avatar = id; return; }
    await rpc('set_avatar', { p_card: id }); net.avatar = id;
  },
};
/** the signed-in player's frame and title (for the Dashboard, the plates); loaded once, kept fresh by the pickers */
export async function loadMyFrame(): Promise<void> {
  try { const m = await api.mine(); net.frame = m.equipped; net.title = m.title; net.founderAvatars = m.avatars || []; } catch { /* no frame */ }
}
/** test pages: be given Founder items as the beta welcome would */
export function stubGrantFounder() { STUB.owned.add('founder'); STUB.avatars = FOUNDER_AVATARS.map((a) => a.id); }

// ------------------------------------------------------------------ pickers
const pay2 = (c: number | null, s: number | null, buy: (p: 'coins' | 'oreshards') => void, tid: string) => h('div', { class: 'cos-pay' },
  c != null ? h('button', { type: 'button', class: 'net-btn sbtn panel', 'data-testid': tid + '-coins', onclick: () => buy('coins') }, `${c.toLocaleString('en-US')} coins`) : null,
  s != null ? h('button', { type: 'button', class: 'net-btn sbtn panel primary', 'data-testid': tid + '-shards', onclick: () => buy('oreshards') }, `${s.toLocaleString('en-US')} Oreshards`) : null);

/** the Shop's Frames section: every frame on sale, preview round the player's avatar, buy (coins or Oreshards), wear */
export function framesPanel(): El {
  const box = h('section', { class: 'econ-panel cos-panel', 'data-testid': 'shop-frames', 'aria-label': 'Avatar frames' }, h('h3', { class: 'h' }, 'Avatar Frames'), h('p', { class: 'net-note' }, 'Polishing the frames…'));
  const note = h('p', { class: 'cos-note', role: 'status' });
  const draw = async (msg = '') => {
    let m: MyFrames; try { m = await api.mine(); } catch { box.replaceChildren(h('h3', { class: 'h' }, 'Avatar Frames'), h('p', { class: 'net-note' }, 'The frames are not on sale right now.')); return; }
    note.textContent = msg;
    const avPic = (net.avatar ? `/art/avatars/${net.avatar}.webp` : '/art/avatars/goblin-goggle-rogue.webp');
    box.replaceChildren(h('h3', { class: 'h' }, 'Avatar Frames'), h('p', { class: 'net-note' }, 'A frame around your avatar, where your opponents and friends see you. Looks only, never power.'),
      h('div', { class: 'cos-grid', role: 'list' }, ...m.frames.filter((f) => f.kind === 'store' || f.owned).map((f) => {
        const av = h('span', { class: 'cos-av', style: `background-image:url(${avPic})` }); decorate(av, f.id);
        const acts = f.owned ? (m.equipped === f.id ? h('span', { class: 'cos-owned' }, 'Wearing') : h('button', { type: 'button', class: 'net-btn sbtn panel', 'data-testid': 'frame-wear-' + f.id, onclick: async () => { try { await api.setFrame(f.id); net.frame = f.id; void draw(`${f.name} is on.`); } catch (e: any) { note.textContent = String(e?.message || e); } } }, 'Wear'))
          : pay2(f.price_coins, f.price_oreshards, async (p) => { try { await api.buy(f.id, p); toast(`${f.name} frame is yours!`, frameUrl(f.id)); void draw(`${f.name} is yours. Press Wear to put it on.`); } catch (e: any) { note.textContent = String(e?.message || e).replace(/^.*?: /, ''); } }, 'frame-buy-' + f.id);
        return h('div', { class: 'cos-item', role: 'listitem', 'data-frame': f.id }, av, h('b', {}, f.name), acts);
      })), note);
  };
  void draw();
  return box;
}

/** the Shop's Emotes section: the three packs (cheaper than their six singles) and every single emote */
export function emotesPanel(): El {
  const box = h('section', { class: 'econ-panel cos-panel', 'data-testid': 'shop-emotes', 'aria-label': 'Emotes' }, h('h3', { class: 'h' }, 'Emotes'), h('p', { class: 'net-note' }, 'Warming up the stickers…'));
  const note = h('p', { class: 'cos-note', role: 'status' });
  const draw = async (msg = '') => {
    let s: any; try { s = await emoteApi.shop(); } catch { box.replaceChildren(h('h3', { class: 'h' }, 'Emotes'), h('p', { class: 'net-note' }, 'The emotes are not on sale right now.')); return; }
    note.textContent = msg;
    const buy = async (what: 'pack' | 'emote', id: string, name: string, p: 'coins' | 'oreshards') => { try { await emoteApi.buy(what, id, p); toast(`${name} ${what === 'pack' ? 'are' : 'is'} yours!`, what === 'emote' ? emoteUrl(id) : '/art/emotes/free-starter/wow.webp'); void draw(`${name}: put them on your wheel in Collection.`); } catch (e: any) { note.textContent = String(e?.message || e).replace(/^.*?: /, ''); } };
    box.replaceChildren(h('h3', { class: 'h' }, 'Emotes'), h('p', { class: 'net-note' }, 'Click your avatar in a match to send one. Ten are free for everyone; the packs are cheaper than six singles.'),
      ...s.packs.map((p: any) => h('div', { class: 'cos-pack', 'data-pack': p.id },
        h('div', { class: 'cos-pack-head' }, h('b', {}, p.name), p.free ? h('span', { class: 'cos-owned' }, 'Free for everyone') : p.owned ? h('span', { class: 'cos-owned' }, 'All yours') : pay2(p.price_coins, p.price_oreshards, (pay) => buy('pack', p.id, p.name, pay), 'emote-pack-' + p.id)),
        h('div', { class: 'cos-emotes' }, ...p.emotes.map((e: any) => h('div', { class: 'cos-emote' + (e.owned ? ' owned' : ''), 'data-emote': e.id, title: e.label },
          h('img', { src: emoteUrl(e.id), alt: e.label, draggable: 'false' }), h('small', {}, e.label),
          e.owned || p.free ? null : pay2(e.price_coins, e.price_oreshards, (pay) => buy('emote', e.id, e.label, pay), 'emote-buy-' + e.id.replace('/', '-'))))))),
      note);
  };
  void draw();
  return box;
}

/** Collection: wear a frame, pick a Founder avatar, set the emote wheel (up to 8 of yours) */
export async function openLooksPicker(app: App): Promise<void> {
  let m: MyFrames; try { m = await api.mine(); } catch (e: any) { toast(String(e?.message || e)); return; }
  let em: { owned: string[]; wheel: string[] }; try { em = await emoteApi.mine(); } catch { em = { owned: DEFAULT_WHEEL.slice(), wheel: DEFAULT_WHEEL.slice() }; }
  const note = h('p', { class: 'cos-note', role: 'status' });
  const frames = h('div', { class: 'cos-grid small', role: 'radiogroup', 'aria-label': 'Frames', 'data-testid': 'looks-frames' });
  const avatars = h('div', { class: 'cos-grid small', role: 'radiogroup', 'aria-label': 'Founder avatars', 'data-testid': 'looks-avatars' });
  const wheelEl = h('div', { class: 'cos-wheel', 'data-testid': 'looks-wheel' });
  let wheel = em.wheel.slice();
  const avPic = () => (net.avatar ? `/art/avatars/${net.avatar}.webp` : '/art/avatars/goblin-goggle-rogue.webp');
  const drawFrames = () => frames.replaceChildren(...[null, ...m.frames.filter((f) => f.owned).map((f) => f.id)].map((id) => {
    const av = h('span', { class: 'cos-av', style: `background-image:url(${avPic()})` }); decorate(av, id);
    return h('button', { type: 'button', role: 'radio', class: 'cos-item' + ((m.equipped || null) === id ? ' on' : ''), 'aria-checked': String((m.equipped || null) === id), 'data-testid': 'looks-frame-' + (id || 'none'),
      onclick: async () => { try { await api.setFrame(id); m.equipped = id; net.frame = id; note.textContent = `${frameName(id)}.`; drawFrames(); } catch (e: any) { note.textContent = String(e?.message || e); } } }, av, h('b', {}, frameName(id)));
  }));
  const drawAvatars = () => avatars.replaceChildren(...(m.avatars || []).map((id) => h('button', { type: 'button', role: 'radio', class: 'cos-item' + (net.avatar === id ? ' on' : ''), 'aria-checked': String(net.avatar === id), 'data-testid': 'looks-avatar-' + id,
    onclick: async () => { try { await api.setAvatar(id); note.textContent = 'Founder avatar on.'; drawAvatars(); drawFrames(); } catch (e: any) { note.textContent = String(e?.message || e); } } },
    h('span', { class: 'cos-av', style: `background-image:url(/art/avatars/${id}.webp)` }))));
  const drawWheel = () => wheelEl.replaceChildren(...em.owned.map((id) => h('button', { type: 'button', class: 'cos-emote' + (wheel.includes(id) ? ' on' : ''), 'aria-pressed': String(wheel.includes(id)), title: emoteLabel(id), 'data-emote': id,
    onclick: async () => {
      const next = wheel.includes(id) ? wheel.filter((x) => x !== id) : wheel.length >= 8 ? wheel : [...wheel, id];
      if (next === wheel) { note.textContent = 'Up to 8 on the wheel: take one off first.'; return; }
      try { const r = await emoteApi.setWheel(next); wheel = r.wheel; note.textContent = `${wheel.length} of 8 on your wheel.`; drawWheel(); } catch (e: any) { note.textContent = String(e?.message || e); }
    } }, h('img', { src: emoteUrl(id), alt: emoteLabel(id), draggable: 'false' }))));
  drawFrames(); drawAvatars(); drawWheel();
  const d: any = app.dialog('Frames, avatars and emotes', [h('h2', {}, 'Frames, avatars and emotes'),
    h('h3', { class: 'h' }, 'Frame'), frames,
    ...(m.avatars && m.avatars.length ? [h('h3', { class: 'h' }, 'Founder avatars'), avatars] : []),
    h('h3', { class: 'h' }, 'Emote wheel (up to 8)'), wheelEl, note,
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn panel', 'data-testid': 'looks-close', onclick: () => d.close() }, 'Done'))]);
  d.el.setAttribute('data-testid', 'looks-dialog');
  d.el.classList.add('cb-overlay');
}

/** the beta welcome's Founder part: the frame and a choice of the 32 Founder avatars (keep your own, or pick one) */
export function founderChoice(onPick: (id: string | null) => void): El {
  const grid = h('div', { class: 'cos-grid founder', role: 'radiogroup', 'aria-label': 'Founder avatars', 'data-testid': 'beta-avatars' },
    h('button', { type: 'button', role: 'radio', class: 'cos-item on', 'aria-checked': 'true', 'data-testid': 'beta-keep-avatar', onclick: (e: Event) => { mark(e); onPick(null); } },
      h('span', { class: 'cos-av', style: `background-image:url(${net.avatar ? `/art/avatars/${net.avatar}.webp` : '/art/avatars/goblin-goggle-rogue.webp'})` }), h('small', {}, 'Keep mine')),
    ...FOUNDER_AVATARS.map((a) => h('button', { type: 'button', role: 'radio', class: 'cos-item', 'aria-checked': 'false', 'data-testid': 'beta-avatar-' + a.id, title: a.label, onclick: (e: Event) => { mark(e); onPick(a.id); } },
      h('span', { class: 'cos-av', style: `background-image:url(/art/avatars/${a.id}.webp)` }))));
  function mark(e: Event) { for (const b of grid.querySelectorAll('.cos-item')) { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); } const b = (e.currentTarget as El); b.classList.add('on'); b.setAttribute('aria-checked', 'true'); }
  return grid;
}

export function framesHooks() { if (!isTestPage()) return null; return { mine: () => api.mine(), grantFounder: () => stubGrantFounder(), equipped: () => STUB.equipped, packs: () => PACKS.length }; }

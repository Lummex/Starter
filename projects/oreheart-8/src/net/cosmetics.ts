// Card backs and the beta welcome (Ken, Nov 7: "A beta welcome. And yeah, let's give them like a founder card sleeve.").
// A card back ("sleeve") is the back of your cards that the other player sees: the Oreheart back for everyone, the chest back
// from the 99-pack chest, and the Founder back every account gets once during the beta. Equip one in the Collection; in PvP the
// opponent's hand shows it. The server keeps what you own and what you wear (my_cosmetics, set_card_back, beta_welcome).
// Art: the Founder back is a placeholder (art/ui/card-backs/founder.webp); Brush's painting replaces the file, no code change.
import { h } from '../ui/app';
import type { App } from '../ui/app';
import { rpc } from './online';
import { net } from './state';
import { stubMode, toast } from './economy';

type El = HTMLElement;
import { BACK_NAME, backArt } from '../content/card-backs';
export { BACK_ART, BACK_NAME, backArt, paintBack } from '../content/card-backs';
export interface Cosmetics { equipped: string; card_backs: { item: string; ref?: string | null; at?: string }[] }

// stand-ins for test pages (no database)
const STUB = { owned: ['default'] as string[], equipped: 'default', welcomed: false, beta: true };
const params = () => new URLSearchParams(location.search);

export const api = {
  async mine(): Promise<Cosmetics> {
    if (stubMode()) return { equipped: STUB.equipped, card_backs: STUB.owned.map((item) => ({ item, ref: item === 'founder' ? 'beta' : 'everyone' })) };
    return await rpc<Cosmetics>('my_cosmetics');
  },
  async equip(item: string): Promise<{ ok: boolean; equipped: string }> {
    if (stubMode()) { if (!STUB.owned.includes(item)) throw new Error("You don't have that card back yet."); STUB.equipped = item; return { ok: true, equipped: item }; }
    return await rpc('set_card_back', { p_item: item });
  },
  async welcome(): Promise<{ show: boolean; beta: boolean; reward?: string; equipped?: string }> {
    if (stubMode()) {
      if (params().get('beta') !== '1') return { show: false, beta: false }; // test pages: only when a check asks for it (&beta=1), so the box never blocks other checks
      if (!STUB.owned.includes('founder')) STUB.owned.push('founder');
      const show = !STUB.welcomed; STUB.welcomed = true;
      return { show, beta: true, reward: 'founder', equipped: STUB.equipped };
    }
    return await rpc('beta_welcome');
  },
};

let equipped = 'default';
export const myBack = () => equipped;
/** The card-back chooser: every back you own, tap one to wear it. */
export async function openBackPicker(app: App): Promise<void> {
  let c: Cosmetics;
  try { c = await api.mine(); } catch (e: any) { toast(String(e?.message || e)); return; }
  equipped = c.equipped || 'default';
  const grid = h('div', { class: 'cb-grid', role: 'radiogroup', 'aria-label': 'Card backs', 'data-testid': 'cb-grid' });
  const note = h('p', { class: 'cb-note', role: 'status' }, '');
  const draw = () => {
    grid.replaceChildren(...c.card_backs.map((b) => h('button', { type: 'button', role: 'radio', class: 'cb-item' + (b.item === equipped ? ' on' : ''), 'aria-checked': String(b.item === equipped), 'data-back': b.item, 'data-testid': 'cb-' + b.item,
      onclick: async () => {
        try { const r = await api.equip(b.item); equipped = r.equipped || b.item; note.textContent = `${BACK_NAME[equipped] || equipped} is on. Your opponents will see it in PvP.`; draw(); }
        catch (e: any) { note.textContent = String(e?.message || e); }
      } },
      h('img', { src: backArt(b.item), alt: '', draggable: 'false' }), h('b', {}, BACK_NAME[b.item] || b.item), h('small', {}, b.item === equipped ? 'Wearing' : b.ref === 'beta' ? 'Beta founder' : b.ref && b.ref.startsWith('bundle') ? 'From the chest' : ''))));
  };
  draw();
  const d: any = app.dialog('Card backs', [h('h2', {}, 'Card backs'), h('p', { class: 'cb-sub' }, 'The back of your cards: your opponent sees it on your hand in PvP.'), grid, note,
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn panel', 'data-testid': 'cb-close', onclick: () => d.close() }, 'Done'))]);
  d.el.setAttribute('data-testid', 'cb-dialog');
  d.el.classList.add('cb-overlay');
}

let welcomeAsked = false;
/** Once per page, after sign-in: during the beta, the welcome (once per account) with the Founder back. */
export async function maybeBetaWelcome(app: App): Promise<void> {
  if (welcomeAsked || (!net.active && !stubMode())) return;
  welcomeAsked = true;
  let w: any;
  try { w = await api.welcome(); } catch { return; }
  if (w && w.equipped) equipped = w.equipped;
  if (!w || !w.show) return;
  const wear = h('button', { type: 'button', class: 'btn panel play', 'data-testid': 'beta-wear' }, 'Wear it now');
  const later = h('button', { type: 'button', class: 'btn panel', 'data-testid': 'beta-later' }, 'Maybe later');
  const d: any = app.dialog('Welcome to the Oreheart beta', [
    h('div', { class: 'beta-box' },
      h('img', { class: 'beta-back', src: backArt('founder'), alt: 'The Founder card back', draggable: 'false' }),
      h('div', { class: 'beta-txt' },
        h('h2', {}, 'Welcome, brave tester!'),
        h('p', {}, 'You found Oreheart before almost anyone. The goblins are impressed. The gnomes took notes. The dwarves pretended not to care.'),
        h('p', {}, 'Things may wobble, squeak or catch fire (only a little). If you spot something odd, or dream up something great, press the ',
          h('b', {}, 'bug button'), ' at the top of the Dashboard and tell us.'),
        h('p', { class: 'beta-gift' }, 'For helping, the ', h('b', {}, 'Founder card back'), ' is yours forever. Only beta testers will ever have it.'))),
    h('div', { class: 'row' }, wear, later)]);
  d.el.setAttribute('data-testid', 'beta-welcome');
  d.el.dataset.sticky = '1'; // a choice, not a stray click outside
  wear.addEventListener('click', async () => { try { const r = await api.equip('founder'); equipped = r.equipped || 'founder'; toast('Founder card back on!', backArt('founder')); } catch { /* keeps the default */ } d.close(); });
  later.addEventListener('click', () => { d.close(); toast('It waits for you in Collection → Card backs.', backArt('founder')); });
}

/** test hooks */
export function cosmeticsHooks() {
  return { mine: () => api.mine(), equip: (i: string) => api.equip(i), welcome: () => api.welcome(), equipped: () => equipped, resetWelcome: () => { welcomeAsked = false; STUB.welcomed = false; } };
}

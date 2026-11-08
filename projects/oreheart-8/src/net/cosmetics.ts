// Card backs and the beta welcome (Ken, Nov 7: "A beta welcome. And yeah, let's give them like a founder card sleeve.").
// A card back ("sleeve") is the back of your cards that the other player sees: the Oreheart back for everyone, the chest back
// from the 99-pack chest, and the Founder back every account gets once during the beta. Equip one in the Collection; in PvP the
// opponent's hand shows it. The server keeps what you own and what you wear (my_cosmetics, set_card_back, beta_welcome).
// Art: the Founder back is a placeholder (art/ui/card-backs/founder.webp); Brush's painting replaces the file, no code change.
import { shardIcon } from './oreshards';
import { h } from '../ui/app';
import type { App } from '../ui/app';
import { rpc } from './online';
import { net } from './state';
import { stubMode, toast } from './economy';

type El = HTMLElement;
import { BACK_NAME, backArt } from '../content/card-backs';
export { BACK_NAME, backArt, paintBack } from '../content/card-backs';
export interface Cosmetics { equipped: string; card_backs: { item: string; ref?: string | null; at?: string; name?: string }[] }
export interface SleeveShop { oreshards: number; enabled: boolean; sleeves: { id: string; name: string; blurb: string | null; price: number; owned: boolean }[] }

// stand-ins for test pages (no database)
const STUB = { owned: ['default'] as string[], equipped: 'default', welcomed: false, beta: true, shards: 1000,
  store: [['goblin-junkpile', 'Goblin Junkpile', 400], ['gnome-arcane', 'Gnome Arcane', 400], ['dwarf-deepforge', 'Dwarf Deepforge', 400], ['crystal-mine', 'Crystal Mine', 450], ['piglet-stampede', 'Piglet Stampede', 350], ['skullfang-arena', 'Skullfang Arena', 500]] as [string, string, number][] };
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
  /** Nov 7: the sleeve store (Oreshards only) */
  async shop(): Promise<SleeveShop> {
    if (stubMode()) return { oreshards: STUB.shards, enabled: true, sleeves: STUB.store.map(([id, name, price]) => ({ id, name, blurb: null, price, owned: STUB.owned.includes(id) })) };
    return await rpc<SleeveShop>('sleeve_shop');
  },
  async buy(id: string): Promise<{ ok: boolean; oreshards: number }> {
    if (stubMode()) {
      const s = STUB.store.find((x) => x[0] === id); if (!s) throw new Error('That sleeve is not for sale.');
      if (STUB.owned.includes(id)) throw new Error('You already have that sleeve.');
      if (STUB.shards < s[2]) throw new Error(`Not enough Oreshards (this sleeve costs ${s[2]}, you have ${STUB.shards}).`);
      STUB.shards -= s[2]; STUB.owned.push(id); return { ok: true, oreshards: STUB.shards };
    }
    return await rpc('buy_sleeve', { p_id: id, p_idem_key: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) });
  },
  async welcome(): Promise<{ show: boolean; beta: boolean; reward?: string; equipped?: string; avatars?: string[] }> {
    if (stubMode()) {
      if (params().get('beta') !== '1') return { show: false, beta: false }; // test pages: only when a check asks for it (&beta=1), so the box never blocks other checks
      if (!STUB.owned.includes('founder')) STUB.owned.push('founder');
      const show = !STUB.welcomed; STUB.welcomed = true;
      const fr = await import('./frames'); fr.stubGrantFounder();
      return { show, beta: true, reward: 'founder', equipped: STUB.equipped, avatars: fr.FOUNDER_AVATARS.map((a) => a.id) };
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
      h('img', { src: backArt(b.item), alt: '', draggable: 'false' }), h('b', {}, b.name || BACK_NAME[b.item] || b.item), h('small', {}, b.item === equipped ? 'Wearing' : b.ref === 'beta' ? 'Beta founder' : b.ref && b.ref.startsWith('bundle') ? 'From the chest' : ''))));
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
  const fr = await import('./frames');
  let pick: string | null = null;
  const choice = fr.founderChoice((id) => { pick = id; });
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
        h('p', { class: 'beta-gift' }, 'For helping, the ', h('b', {}, 'Founder card back'), ', the ', h('b', {}, 'Founder frame'), ' and 32 ', h('b', {}, 'Founder avatars'), ' are yours forever. Only beta testers will ever have them.'))),
    h('div', { class: 'beta-founder' }, h('img', { class: 'beta-frame', src: fr.frameUrl('founder'), alt: 'The Founder frame', draggable: 'false' }), h('div', {}, h('b', {}, 'Pick a Founder avatar, or keep your own'), choice)),
    h('div', { class: 'row' }, wear, later)]);
  d.el.setAttribute('data-testid', 'beta-welcome');
  d.el.dataset.sticky = '1'; // a choice, not a stray click outside
  wear.addEventListener('click', async () => {
    try { const r = await api.equip('founder'); equipped = r.equipped || 'founder'; } catch { /* keeps the default */ }
    try { const r = await fr.api.setFrame('founder'); net.frame = r.equipped; } catch { /* no frame */ }
    if (pick) { try { await fr.api.setAvatar(pick); } catch { /* keeps their avatar */ } }
    toast('Founder back and frame on!', backArt('founder')); d.close();
    if (document.querySelector('[data-dash]')) void import('./dashboard').then((m) => m.showDashboard(app));
  });
  later.addEventListener('click', () => { d.close(); toast('It waits for you in Collection → Card backs.', backArt('founder')); });
}

/** test hooks */
export function cosmeticsHooks() {
  return { mine: () => api.mine(), equip: (i: string) => api.equip(i), welcome: () => api.welcome(), equipped: () => equipped, resetWelcome: () => { welcomeAsked = false; STUB.welcomed = false; }, shards: () => STUB.shards };
}

// ------------------------------------------------------------------ the Shop's Card Sleeves section (Ken, Nov 7)
/** A panel for the Shop: every sleeve on sale with its price in Oreshards, Preview, and Buy (with a confirm step) or Wear. */
export function sleevesPanel(): El {
  const box = h('section', { class: 'econ-panel sl-panel', 'data-testid': 'shop-sleeves', 'aria-label': 'Card Sleeves' }, h('h3', { class: 'h' }, 'Card Sleeves'), h('p', { class: 'net-note' }, 'Unrolling the sleeves…'));
  const note = h('p', { class: 'sl-note', role: 'status', 'data-testid': 'sl-note' });
  const draw = async (msg = '') => {
    let s: SleeveShop;
    try { s = await api.shop(); } catch { box.replaceChildren(h('h3', { class: 'h' }, 'Card Sleeves'), h('p', { class: 'net-note' }, 'The sleeves are not on sale right now.')); return; }
    note.textContent = msg;
    const grid = h('div', { class: 'sl-grid', role: 'list' }, ...s.sleeves.map((x) => {
      const buy = h('button', { type: 'button', class: 'cos-price cp-shards sl-buy', 'data-testid': 'sl-buy-' + x.id, 'aria-label': `Buy for ${x.price} Oreshards`, title: `${x.price} Oreshards` }, shardIcon('cos-ico'), h('span', {}, `${x.price} Oreshards`)) as HTMLButtonElement; // Nov 7 (Ken): a small pill, not the big gem button
      const acts = h('div', { class: 'sl-acts' });
      const reset = () => {
        if (!x.owned) { acts.replaceChildren(buy); return; }
        const wear = h('button', { type: 'button', class: 'cos-price cp-wear', 'data-testid': 'sl-wear-' + x.id,
          onclick: async () => { try { const r = await api.equip(x.id); equipped = r.equipped; void draw(`${x.name} is on.`); } catch (e: any) { note.textContent = String(e?.message || e); } } }, 'Wear');
        acts.replaceChildren(h('span', { class: 'sl-owned', 'data-testid': 'sl-owned-' + x.id }, equipped === x.id ? 'Wearing' : 'Owned'), ...(equipped === x.id ? [] : [wear]));
      };
      buy.addEventListener('click', () => {
        if (!s.enabled) { note.textContent = 'Oreshards are not on sale right now.'; return; }
        const yes = h('button', { type: 'button', class: 'cos-price cp-shards', 'data-testid': 'sl-confirm-' + x.id }, 'Buy') as HTMLButtonElement;
        const no = h('button', { type: 'button', class: 'cos-price', onclick: reset }, 'Cancel');
        acts.replaceChildren(h('span', { class: 'sl-ask' }, `${x.price} of your ${s.oreshards} Oreshards?`), yes, no);
        yes.addEventListener('click', async () => {
          yes.disabled = true;
          try { await api.buy(x.id); toast(`${x.name} is yours!`, backArt(x.id)); void draw(`${x.name} is yours. Press Wear to put it on.`); }
          catch (e: any) { note.textContent = String(e?.message || e).replace(/^.*?: /, ''); reset(); }
        });
      });
      reset();
      return h('div', { class: 'sl-item', role: 'listitem', 'data-sleeve': x.id },
        h('button', { type: 'button', class: 'sl-art', 'aria-label': `Preview ${x.name}`, 'data-testid': 'sl-preview-' + x.id, onclick: () => previewSleeve(x.id, x.name, x.blurb) }, h('img', { src: backArt(x.id), alt: '', draggable: 'false' })),
        h('b', {}, x.name), acts);
    }));
    box.replaceChildren(h('h3', { class: 'h' }, 'Card Sleeves', h('small', { class: 'sl-bal', 'data-testid': 'sl-balance' }, `${s.oreshards} Oreshards`)),
      h('p', { class: 'net-note' }, 'The back of your cards, the side your opponent sees. Looks only, never power. Bought with Oreshards.'), grid, note);
  };
  void draw();
  return box;
}

/** A big look at a sleeve: the back at full card size next to the Oreheart back, so the size and look are clear. */
export function previewSleeve(id: string, name: string, blurb?: string | null): void {
  const ov: El = h('div', { class: 'sl-preview', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${name} sleeve`, 'data-testid': 'sl-preview', tabindex: '-1' });
  const close = () => ov.remove();
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') close(); });
  ov.append(h('div', { class: 'sl-preview-box' },
    h('div', { class: 'sl-pair' }, h('img', { class: 'sl-big', src: backArt(id), alt: `${name} card back`, draggable: 'false' }), h('img', { class: 'sl-big face', src: backArt('default'), alt: 'The Oreheart back, for comparison', draggable: 'false' })),
    h('h3', { class: 'h' }, name), ...(blurb ? [h('p', {}, blurb)] : []),
    h('button', { type: 'button', class: 'net-btn sbtn panel', 'data-testid': 'sl-preview-close', onclick: close }, 'Close')));
  document.body.append(ov);
  ov.focus();
}

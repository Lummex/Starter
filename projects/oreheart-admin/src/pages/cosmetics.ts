// Emotes and frames (Nov 7; Nov 21 Ken: "I only want you to be able to buy them with Oreshards ... no coins"): Ken sets each Oreshard
// price (empty = not sold) and switches one on or off. The database refuses any coin price.
// The free starter emotes and the Founder / Producer frames are never sold (the database refuses a price on them).
import { rpc } from '../supabase';
import { busy, fmtNum, h, notice, table } from '../ui';

interface Item { id: string; name?: string; label?: string; kind?: string; free?: boolean; price_coins: number | null; price_oreshards: number | null; enabled: boolean; owners?: number }
interface All { emote_packs: Item[]; emotes: Item[]; frames: Item[] }

const priceText = (x: Item) => (x.price_oreshards != null ? `${fmtNum(x.price_oreshards)} Oreshards` : '—');

function priceForm(kind: 'emote_pack' | 'emote' | 'frame', x: Item, reload: () => void, sellable: boolean) {
  const n = notice();
  const shards = h('input', { type: 'number', min: 1, max: 100000, value: x.price_oreshards ?? '', placeholder: sellable ? 'Oreshards (empty = not sold)' : 'not sold', disabled: !sellable, 'data-testid': `cp-shards-${x.id}` });
  const enabled = h('input', { type: 'checkbox', checked: x.enabled ?? true });
  const reason = h('input', { type: 'text', required: true, minlength: 3, maxlength: 500, placeholder: 'Why? (required, recorded)', 'data-testid': `cp-reason-${x.id}` });
  const form = h('form', { class: 'stack' }, h('label', {}, 'Oreshards ', shards), h('label', {}, enabled, ' On sale / shown'), reason,
    h('button', { type: 'submit', class: 'primary', 'data-testid': `cp-save-${x.id}` }, 'Save'), n.el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await busy(form, async () => {
      try {
        const num = (el: HTMLInputElement) => (el.value === '' ? null : Math.trunc(Number(el.value)));
        await rpc('admin_set_cosmetic_price', { p_kind: kind, p_id: x.id, p_coins: null, p_oreshards: num(shards as HTMLInputElement), p_enabled: (enabled as HTMLInputElement).checked, p_reason: (reason as HTMLInputElement).value.trim() });
        reload();
      } catch (err) { n.error((err as Error).message); }
    });
  });
  return form;
}

export async function cosmeticsPage(root: HTMLElement) {
  root.replaceChildren(h('h1', {}, 'Emotes & frames'), h('p', { class: 'small' }, 'Loading…'));
  const all = await rpc<All>('admin_cosmetics');
  const reload = () => void cosmeticsPage(root);
  const nm = (x: Item) => x.name || x.label || x.id;
  const name = (x: Item) => h('span', {}, h('strong', {}, nm(x)), h('span', { class: 'small mono' }, ` ${x.id}`));
  const packs = all.emote_packs || [], emotes = all.emotes || [], frames = all.frames || [];
  root.replaceChildren(
    h('h1', {}, 'Emotes & frames'),
    h('p', { class: 'small' }, 'Prices players pay in the Shop, in Oreshards only (empty = not sold). Sleeves have their own page. The free starter emotes and the Founder and Producer frames are never sold. Every change is recorded in the audit log.'),
    h('h2', {}, 'Emote packs'),
    table(['Pack', 'Price', 'On', 'Owners'], packs.map((x) => [name(x), x.free ? 'free' : priceText(x), x.enabled ? 'yes' : 'no', fmtNum(x.owners ?? 0)]), 'cp-packs'),
    ...packs.filter((x) => !x.free).map((x) => h('details', { class: 'card' }, h('summary', {}, `Edit ${nm(x)}`), priceForm('emote_pack', x, reload, true))),
    h('h2', {}, 'Single emotes'),
    table(['Emote', 'Price', 'On'], emotes.map((x) => [name(x), priceText(x), x.enabled ? 'yes' : 'no']), 'cp-emotes'),
    ...emotes.map((x) => h('details', { class: 'card' }, h('summary', {}, `Edit ${nm(x)}`), priceForm('emote', x, reload, true))),
    h('h2', {}, 'Avatar frames'),
    table(['Frame', 'Kind', 'Price', 'On', 'Owners'], frames.map((x) => [name(x), x.kind || '', priceText(x), x.enabled ? 'yes' : 'no', fmtNum(x.owners ?? 0)]), 'cp-frames'),
    ...frames.map((x) => h('details', { class: 'card' }, h('summary', {}, `Edit ${nm(x)}`), priceForm('frame', x, reload, (x.kind || 'store') === 'store'))));
}

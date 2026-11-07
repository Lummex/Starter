// Card sleeves (Nov 7): every card back the game knows. Ken sets the price in Oreshards (empty = not sold), switches one on or off,
// and adds a new one: a new id here plus its picture at art/sleeves/<id>.webp in the game (512x768). No code change.
import { rpc } from '../supabase';
import { busy, fmtNum, h, notice, table } from '../ui';

interface Sleeve { id: string; name: string; blurb: string | null; kind: string; price: number | null; enabled: boolean; sort: number; owners: number }

function editForm(s: Partial<Sleeve>, reload: () => void, isNew = false) {
  const n = notice();
  const id = h('input', { type: 'text', required: true, pattern: '[a-z][a-z0-9-]{0,29}', value: s.id ?? '', disabled: !isNew, placeholder: 'id, e.g. winter-frost', 'data-testid': 'sl-id' });
  const name = h('input', { type: 'text', required: true, maxlength: 40, value: s.name ?? '', placeholder: 'Name', 'data-testid': 'sl-name' });
  const blurb = h('input', { type: 'text', maxlength: 160, value: s.blurb ?? '', placeholder: 'One short line (optional)' });
  const sellable = !s.kind || s.kind === 'store' || s.kind === 'event';
  const price = h('input', { type: 'number', min: 1, max: 100000, value: s.price ?? '', placeholder: sellable ? 'Oreshards (empty = not sold)' : 'not sold', disabled: !sellable, 'data-testid': 'sl-price' });
  const sort = h('input', { type: 'number', value: s.sort ?? 100, style: 'width:5em' });
  const enabled = h('input', { type: 'checkbox', checked: s.enabled ?? true });
  const reason = h('input', { type: 'text', required: true, minlength: 3, maxlength: 500, placeholder: 'Why? (required, recorded)', 'data-testid': 'sl-reason' });
  const form = h('form', { class: 'stack' }, id, name, blurb, h('label', {}, 'Price ', price), h('label', {}, 'Order ', sort), h('label', {}, enabled, ' On sale / shown'), reason,
    h('button', { type: 'submit', class: 'primary', 'data-testid': 'sl-save' }, isNew ? 'Add sleeve' : 'Save'), n.el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await busy(form, async () => {
      try {
        await rpc('admin_set_sleeve', { p_id: id.value.trim(), p_name: name.value.trim(), p_blurb: blurb.value.trim() || null,
          p_price: price.value === '' ? null : Math.trunc(Number(price.value)), p_enabled: enabled.checked, p_sort: Math.trunc(Number(sort.value) || 100), p_reason: reason.value.trim() });
        reload();
      } catch (err) { n.error((err as Error).message); }
    });
  });
  return form;
}

export async function sleevesPage(root: HTMLElement) {
  root.replaceChildren(h('h1', {}, 'Card sleeves'), h('p', { class: 'small' }, 'Loading…'));
  const rows = await rpc<Sleeve[]>('admin_sleeves');
  const reload = () => void sleevesPage(root);
  root.replaceChildren(
    h('h1', {}, 'Card sleeves'),
    h('p', { class: 'small' }, 'Card backs players can wear. Store sleeves sell for Oreshards. The Oreheart, Founder and Treasure Chest backs are never sold. A new sleeve needs its picture at art/sleeves/<id>.webp in the game first.'),
    table(['Sleeve', 'Kind', 'Price', 'On', 'Owners'], rows.map((s) => [h('span', {}, h('strong', {}, s.name), h('span', { class: 'small mono' }, ` ${s.id}`)), s.kind, s.price == null ? '—' : `${fmtNum(s.price)} Oreshards`, s.enabled ? 'yes' : 'no', fmtNum(s.owners)]), 'sleeve-table'),
    ...rows.map((s) => h('details', { class: 'card' }, h('summary', {}, `Edit ${s.name}`), editForm(s, reload))),
    h('section', { class: 'card' }, h('h2', {}, 'Add a sleeve'), editForm({}, reload, true)));
}

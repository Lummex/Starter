// Card lookup: type a card's unique id, see who first got it, how, and every account it passed through.
import { rpc } from '../supabase';
import { fmtDate, h, table } from '../ui';

interface Lookup {
  instance_id: string; card_id: string; status: string; origin: string; origin_ref: string | null; created_at: string;
  owner_id: string | null; owner_name: string | null; original_owner_id: string; original_owner_name: string | null;
  history: { at: string; event: string; from_user: string | null; from_name: string | null; to_user: string | null; to_name: string | null;
             reason: string | null; ref: string | null; by: string | null }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function who(id: string | null, name: string | null) {
  if (!id) return '—';
  return h('a', { href: `#/player/${id}` }, name ?? id);
}

export async function cardPage(root: HTMLElement, id: string) {
  const input = h('input', { type: 'search', value: id, placeholder: 'Card id (e.g. 3f2a…)', 'aria-label': 'Card id', class: 'mono', 'data-testid': 'card-search' });
  const form = h('form', { class: 'row' }, input, h('button', { type: 'submit' }, 'Look up'));
  form.addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/card/${encodeURIComponent(input.value.trim())}`; });
  const head = [h('h1', {}, 'Card lookup'), h('p', { class: 'small' }, 'Every card a player owns has its own id (back counter only; players never see it).'), form];
  if (!id) { root.replaceChildren(...head); return; }
  if (!UUID.test(id)) { root.replaceChildren(...head, h('p', { class: 'notice error' }, 'That is not a card id.')); return; }
  root.replaceChildren(...head, h('p', { class: 'small' }, 'Loading…'));
  const c = await rpc<Lookup>('admin_card_lookup', { p_instance: id });
  root.replaceChildren(...head,
    h('section', { class: 'card', 'data-testid': 'card-result' },
      h('h2', {}, c.card_id),
      h('dl', { class: 'facts' },
        h('dt', {}, 'Card id'), h('dd', { class: 'mono' }, c.instance_id),
        h('dt', {}, 'Owner now'), h('dd', { 'data-testid': 'card-owner' }, c.status === 'owned' ? who(c.owner_id, c.owner_name) : c.status),
        h('dt', {}, 'First owner'), h('dd', { 'data-testid': 'card-first-owner' }, who(c.original_owner_id, c.original_owner_name)),
        h('dt', {}, 'How they got it'), h('dd', {}, c.origin + (c.origin_ref ? ` (${c.origin_ref})` : '')),
        h('dt', {}, 'Made'), h('dd', {}, fmtDate(c.created_at)))),
    h('section', { class: 'card' }, h('h2', {}, `History (${c.history.length})`),
      table(['When', 'What', 'From', 'To', 'Reason', 'Ref'], c.history.map((x) => [
        fmtDate(x.at), x.event, who(x.from_user, x.from_name), who(x.to_user, x.to_name), x.reason ?? '—', x.ref ?? '—',
      ]), 'card-history')));
}

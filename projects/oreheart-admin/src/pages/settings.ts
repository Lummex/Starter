// Settings Ken can change: sign-up coins, deck limit, the bad-words list and the
// reserved-name lists. Every save needs a reason and lands in the audit log.
import { rpc } from '../supabase';
import { busy, fmtDate, h, notice } from '../ui';

type Settings = Record<string, { value: unknown; updated_at?: string; read_only?: boolean }>;

function section(title: string, help: string, key: string, s: Settings, input: HTMLInputElement | HTMLTextAreaElement,
                 parse: () => unknown, reload: () => void) {
  const n = notice();
  const reason = h('input', { type: 'text', required: true, minlength: 3, maxlength: 500, placeholder: 'Why? (required, recorded)', 'data-testid': `set-${key}-reason` });
  const form = h('form', { class: 'stack', 'data-testid': `set-${key}` },
    h('p', { class: 'small' }, help),
    input,
    h('label', {}, 'Reason', reason),
    h('button', { type: 'submit', class: 'primary', 'data-testid': `set-${key}-save` }, 'Save'),
    n.el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (reason.value.trim().length < 3) { n.error('Write a reason (3+ characters).'); return; }
    await busy(form, async () => {
      try { await rpc('admin_set_setting', { p_key: key, p_value: parse(), p_reason: reason.value.trim() }); reload(); }
      catch (err) { n.error((err as Error).message); }
    });
  });
  return h('section', { class: 'card' }, h('h2', {}, title),
    h('p', { class: 'small' }, `Last changed: ${fmtDate(s[key]?.updated_at)}`), form);
}

const words = (v: unknown) => (Array.isArray(v) ? v.join('\n') : '');
const parseWords = (t: HTMLTextAreaElement) => () => t.value.split(/[\n,]+/).map((w) => w.trim().toLowerCase()).filter(Boolean);

export async function settingsPage(root: HTMLElement) {
  root.replaceChildren(h('h1', {}, 'Settings'), h('p', { class: 'small' }, 'Loading…'));
  const s = await rpc<Settings>('admin_get_settings');
  const reload = () => void settingsPage(root);

  const coins = h('input', { type: 'number', min: 0, max: 100000, step: 1, required: true, value: String(s.signup_bonus_coins?.value ?? 0), 'data-testid': 'set-signup-coins' });
  const decks = h('input', { type: 'number', min: 1, max: 100, step: 1, required: true, value: String(s.max_decks?.value ?? 30), 'data-testid': 'set-max-decks' });
  const bad = h('textarea', { rows: 10, 'data-testid': 'set-blocked-words' }, words(s.blocked_words?.value));
  const reserved = h('textarea', { rows: 5, 'data-testid': 'set-reserved-names' }, words(s.reserved_usernames?.value));
  const parts = h('textarea', { rows: 4, 'data-testid': 'set-reserved-parts' }, words(s.reserved_name_parts?.value));
  const kind = String(s.server_kind?.value ?? 'test');

  root.replaceChildren(
    h('h1', {}, 'Settings'),
    h('p', {}, 'This server is: ', h('strong', { 'data-testid': 'server-kind' }, kind === 'production' ? 'REAL (production)' : 'TEST (practice / previews)'),
      h('span', { class: 'small' }, ' — set once by Ken in Supabase, not here.')),
    h('div', { class: 'grid' },
      section('Sign-up coins', 'Coins every new player gets. Changes only affect players who join after you save.', 'signup_bonus_coins', s, coins,
        () => Math.trunc(Number(coins.value)), reload),
      section('Deck limit', 'Most decks one player can keep on the server.', 'max_decks', s, decks,
        () => Math.trunc(Number(decks.value)), reload)),
    section('Bad words (player names)', 'One word per line, letters a–z only. A name is refused if it contains any of these, also when written with look-alikes (sh1t, $hit, s_h_i_t). Existing names are not changed: use Rename on the player page.',
      'blocked_words', s, bad, parseWords(bad), reload),
    h('div', { class: 'grid' },
      section('Reserved names (exact)', 'Names nobody may take, e.g. commander names. One per line, letters only.', 'reserved_usernames', s, reserved, parseWords(reserved), reload),
      section('Reserved name parts', 'No name may contain these (e.g. admin, oreheart). One per line.', 'reserved_name_parts', s, parts, parseWords(parts), reload)));
}

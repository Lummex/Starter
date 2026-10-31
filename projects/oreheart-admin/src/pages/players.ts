// Player list (search + paging) and the player page (info, consent, decks, coins,
// cards, ban/unban, grant coins, rename).
import { rpc } from '../supabase';
import { busy, changeView, fmtDate, fmtMoney, fmtNum, h, notice, table } from '../ui';

export interface PlayerRow {
  id: string; username: string; email: string; created_at: string; last_seen_at: string;
  coins: number; money_spent_cents: number; banned: boolean; ban_expires_at: string | null;
  age_group: string; consent_status: string; is_admin: boolean; total: number;
}

const PAGE = 25;

function banLabel(banned: boolean, until: string | null) {
  if (!banned) return h('span', { class: 'pill ok' }, 'OK');
  return h('span', { class: 'pill bad' }, until ? `Banned until ${fmtDate(until)}` : 'Banned (permanent)');
}

const CONSENT_TEXT: Record<string, [string, string]> = {
  not_needed: ['13+', 'muted'],
  pending: ['Under 13: waiting for parent', 'warn'],
  approved: ['Under 13: parent approved', 'ok'],
  revoked: ['Under 13: approval withdrawn', 'bad'],
};
export function consentLabel(status: string) {
  const [t, c] = CONSENT_TEXT[status] ?? [status, 'muted'];
  return h('span', { class: `pill ${c}`, 'data-testid': 'consent-state' }, t);
}

export async function playersPage(root: HTMLElement, params: URLSearchParams) {
  const q = params.get('q') ?? '';
  const page = Math.max(1, parseInt(params.get('p') ?? '1', 10) || 1);
  const search = h('input', { type: 'search', value: q, placeholder: 'Username or email', 'aria-label': 'Search players', 'data-testid': 'player-search' });
  const form = h('form', { class: 'row' }, search, h('button', { type: 'submit' }, 'Search'));
  form.addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/players?q=${encodeURIComponent(search.value.trim())}`; });
  root.replaceChildren(h('h1', {}, 'Players'), form, h('p', { class: 'small' }, 'Loading…'));

  const rows = await rpc<PlayerRow[]>('admin_list_players', { p_search: q, p_page: page, p_page_size: PAGE });
  const total = rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) => `#/players?q=${encodeURIComponent(q)}&p=${p}`;
  root.replaceChildren(
    h('h1', {}, 'Players'), form,
    h('p', { class: 'small', 'data-testid': 'player-total' }, `${fmtNum(total)} player${total === 1 ? '' : 's'}${q ? ` matching “${q}”` : ''}`),
    table(['Username', 'Email', 'Joined', 'Last seen', 'Coins', 'Money spent', 'Age / parent', 'State'], rows.map((r) => [
      h('a', { href: `#/player/${r.id}`, 'data-testid': 'player-link' }, r.username, r.is_admin ? h('span', { class: 'pill gold' }, 'admin') : null),
      r.email, fmtDate(r.created_at, false), fmtDate(r.last_seen_at), fmtNum(r.coins), fmtMoney(r.money_spent_cents),
      consentLabel(r.consent_status), banLabel(r.banned, r.ban_expires_at),
    ]), 'player-table'),
    h('nav', { class: 'pager' },
      page > 1 ? h('a', { href: link(page - 1) }, '← Previous') : h('span', {}),
      h('span', {}, `Page ${page} of ${pages}`),
      page < pages ? h('a', { href: link(page + 1) }, 'Next →') : h('span', {})));
}

interface Detail {
  profile: { id: string; username: string; avatar: string | null; created_at: string; last_seen_at: string; age_group: string; consent_status: string };
  email: string; email_confirmed_at: string | null; coins: number; money_spent_cents: number; roles: string[];
  ban: { id: number; reason: string; expires_at: string | null; created_at: string } | null;
  bans: { id: number; reason: string; created_at: string; expires_at: string | null; lifted_at: string | null; lift_reason: string | null }[];
  consent: { status: string; parent_email: string; method: string; notice_version: string; requested_at: string; expires_at: string;
             approved_at: string | null; revoked_at: string | null; revoked_by: string | null } | null;
  consent_events: { event: string; at: string; ip: string | null }[];
  decks: { id: string; name: string; commander: string | null; cards: number; source: string; updated_at: string }[];
  transactions: { id: number; delta: number; reason: string; balance_after: number; created_at: string; ref: string | null }[];
  cards_owned: number; cards_by_origin: Record<string, number>;
}

interface AuditRow { id: number; created_at: string; admin_name: string | null; action: string; before: unknown; after: unknown; reason: string }
interface CardRow { instance_id: string; card_id: string; origin: string; original_owner_id: string; original_owner_name: string | null; created_at: string; moves: number; total: number }

const DURATIONS: [string, number | null][] = [['1 day', 1], ['3 days', 3], ['7 days', 7], ['30 days', 30], ['Permanent', null]];

/** A small form: some fields + a required reason; calls run() and reloads on success. */
function actionForm(testid: string, fields: Node[], button: string, kind: 'primary' | 'danger',
                    run: (reason: string) => Promise<unknown>, reload: () => void, disabled?: string) {
  const n = notice();
  const reason = h('input', { type: 'text', required: true, minlength: 3, maxlength: 500, placeholder: 'Why? (required, recorded)', 'data-testid': `${testid}-reason` });
  const form = h('form', { class: 'stack', 'data-testid': `${testid}-form` },
    ...fields,
    h('label', {}, 'Reason', reason),
    h('button', { type: 'submit', class: kind, disabled: Boolean(disabled), 'data-testid': `${testid}-submit` }, disabled ?? button),
    n.el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (reason.value.trim().length < 3) { n.error('Write a reason (3+ characters).'); return; }
    await busy(form, async () => {
      try { await run(reason.value.trim()); reload(); } catch (err) { n.error((err as Error).message); }
    });
  });
  return form;
}

export async function playerPage(root: HTMLElement, id: string, params: URLSearchParams = new URLSearchParams()) {
  root.replaceChildren(h('p', { class: 'small' }, 'Loading…'));
  const cardFilter = (params.get('card') ?? '').trim();
  const cardPage = Math.max(1, parseInt(params.get('cp') ?? '1', 10) || 1);
  const [d, audit, cards] = await Promise.all([
    rpc<Detail>('admin_player_detail', { p_user: id }),
    rpc<AuditRow[]>('admin_audit_log', { p_page: 1, p_page_size: 50, p_target: id }),
    rpc<CardRow[]>('admin_player_cards', { p_user: id, p_card_id: cardFilter || null, p_page: cardPage, p_page_size: 100 }),
  ]);
  const reload = () => void playerPage(root, id, params);
  const isAdmin = d.roles.includes('admin');

  // --- Ban / unban ---
  let banForm: HTMLFormElement;
  if (d.ban) {
    banForm = actionForm('unban', [h('p', {}, banLabel(true, d.ban.expires_at), ' ', `Reason: ${d.ban.reason}`)], 'Unban', 'primary',
      (reason) => rpc('admin_unban', { p_user: id, p_reason: reason }), reload);
  } else {
    const dur = h('select', { 'data-testid': 'ban-duration' }, ...DURATIONS.map(([t, v]) => h('option', { value: v == null ? '' : String(v) }, t)));
    banForm = actionForm('ban', [h('label', {}, 'How long', dur)], 'Ban player', 'danger', async (reason) => {
      const days = dur.value ? Number(dur.value) : null;
      if (!confirm(`Ban ${d.profile.username} ${days ? `for ${dur.selectedOptions[0].text}` : 'permanently'}?`)) throw new Error('Not banned.');
      return rpc('admin_ban', { p_user: id, p_reason: reason, p_expires_at: days ? new Date(Date.now() + days * 86400000).toISOString() : null });
    }, reload, isAdmin ? 'Admins can\'t be banned here' : undefined);
  }

  // --- Grant coins (one fresh key per form, so a double click pays once) ---
  const idem = crypto.randomUUID();
  const amount = h('input', { type: 'number', step: 1, min: -100000, max: 100000, required: true, placeholder: 'e.g. 100', 'data-testid': 'grant-amount' });
  const grantForm = actionForm('grant', [h('label', {}, 'Coins (negative takes coins away)', amount)], 'Grant coins', 'primary', (reason) => {
    const n = Math.trunc(Number(amount.value));
    if (!n || Math.abs(n) > 100000) throw new Error('Amount must be between -100,000 and 100,000 and not 0.');
    return rpc('admin_grant_coins', { p_user: id, p_amount: n, p_reason: reason, p_idem_key: idem });
  }, reload);

  // --- Rename ---
  const newName = h('input', { type: 'text', required: true, pattern: '[A-Za-z0-9_]{3,16}', maxlength: 16, value: d.profile.username, 'data-testid': 'rename-name' });
  const renameForm = actionForm('rename', [h('label', {}, 'New username (3–16 letters, numbers, _)', newName)], 'Rename player', 'primary',
    (reason) => rpc('admin_rename_player', { p_user: id, p_new_name: newName.value.trim(), p_reason: reason }), reload);

  // --- Parent consent (under 13) ---
  let consentCard: HTMLElement | null = null;
  if (d.consent) {
    const c = d.consent;
    consentCard = h('section', { class: 'card', 'data-testid': 'consent-card' }, h('h2', {}, 'Parent consent (under 13)'),
      h('dl', { class: 'facts' },
        h('dt', {}, 'Status'), h('dd', {}, consentLabel(d.profile.consent_status)),
        h('dt', {}, 'Parent email'), h('dd', {}, c.parent_email),
        h('dt', {}, 'Method'), h('dd', {}, c.method === 'email_plus' ? 'Email plus (approve link + confirmation email)' : c.method),
        h('dt', {}, 'Notice version'), h('dd', {}, c.notice_version),
        h('dt', {}, 'Requested'), h('dd', {}, fmtDate(c.requested_at)),
        h('dt', {}, 'Link expires'), h('dd', {}, fmtDate(c.expires_at)),
        h('dt', {}, 'Approved'), h('dd', {}, fmtDate(c.approved_at)),
        h('dt', {}, 'Withdrawn'), h('dd', {}, c.revoked_at ? `${fmtDate(c.revoked_at)} (${c.revoked_by})` : '—')),
      table(['When', 'Event', 'IP'], d.consent_events.map((e) => [fmtDate(e.at), e.event, e.ip ?? '—'])),
      c.status !== 'revoked'
        ? actionForm('revoke-consent', [h('p', { class: 'small' }, 'Use when a parent asks by email. The account stops working online.')],
            'Withdraw approval', 'danger', (reason) => rpc('admin_revoke_consent', { p_user: id, p_reason: reason }), reload)
        : null);
  }

  // --- Cards (each with its own id) ---
  const cardSearch = h('input', { type: 'search', value: cardFilter, placeholder: 'Card id, e.g. fizzle', 'aria-label': 'Filter cards', 'data-testid': 'cards-filter' });
  const cardForm = h('form', { class: 'row' }, cardSearch, h('button', { type: 'submit' }, 'Filter'));
  cardForm.addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/player/${id}?card=${encodeURIComponent(cardSearch.value.trim())}`; });
  const cardTotal = cards[0]?.total ?? 0;
  const cardPages = Math.max(1, Math.ceil(cardTotal / 100));
  const cardLink = (p: number) => `#/player/${id}?card=${encodeURIComponent(cardFilter)}&cp=${p}`;

  const origins = Object.entries(d.cards_by_origin).map(([k, v]) => `${k} ${fmtNum(v)}`).join(', ') || '—';
  root.replaceChildren(
    h('p', {}, h('a', { href: '#/players' }, '← All players')),
    h('h1', { 'data-testid': 'player-name' }, d.profile.username, isAdmin ? h('span', { class: 'pill gold' }, 'admin') : null),
    h('div', { class: 'grid' },
      h('section', { class: 'card' }, h('h2', {}, 'Info'),
        h('dl', { class: 'facts' },
          h('dt', {}, 'Email'), h('dd', {}, d.email),
          h('dt', {}, 'Email confirmed'), h('dd', {}, fmtDate(d.email_confirmed_at)),
          h('dt', {}, 'Joined'), h('dd', {}, fmtDate(d.profile.created_at)),
          h('dt', {}, 'Last seen'), h('dd', {}, fmtDate(d.profile.last_seen_at)),
          h('dt', {}, 'Age / parent'), h('dd', {}, consentLabel(d.profile.consent_status)),
          h('dt', {}, 'Avatar card'), h('dd', {}, d.profile.avatar ?? '—'),
          h('dt', {}, 'Coins'), h('dd', { 'data-testid': 'player-coins' }, fmtNum(d.coins)),
          h('dt', {}, 'Money spent'), h('dd', { 'data-testid': 'player-money' }, fmtMoney(d.money_spent_cents)),
          h('dt', {}, 'Cards owned'), h('dd', {}, `${fmtNum(d.cards_owned)} (${origins})`),
          h('dt', {}, 'State'), h('dd', { 'data-testid': 'player-state' }, banLabel(!!d.ban, d.ban?.expires_at ?? null)),
          h('dt', {}, 'Player id'), h('dd', { class: 'mono' }, d.profile.id))),
      h('section', { class: 'card' }, h('h2', {}, d.ban ? 'Unban' : 'Ban'), banForm),
      h('section', { class: 'card' }, h('h2', {}, 'Grant coins'), grantForm),
      h('section', { class: 'card' }, h('h2', {}, 'Rename'), renameForm)),
    ...(consentCard ? [consentCard] : []),
    h('section', { class: 'card' }, h('h2', {}, `Decks (${d.decks.length})`),
      table(['Name', 'Commander', 'Cards', 'From', 'Updated'], d.decks.map((x) => [x.name, x.commander ?? '—', fmtNum(x.cards), x.source, fmtDate(x.updated_at)]), 'deck-table')),
    h('section', { class: 'card' }, h('h2', {}, 'Coin history'),
      table(['When', 'Change', 'Reason', 'Balance after'], d.transactions.map((t) => [fmtDate(t.created_at), (t.delta > 0 ? '+' : '') + fmtNum(t.delta), t.reason, fmtNum(t.balance_after)]), 'coin-table')),
    h('section', { class: 'card' }, h('h2', {}, `Cards (${fmtNum(cardTotal)}${cardFilter ? ` × ${cardFilter}` : ''})`),
      h('p', { class: 'small' }, 'Every card has its own id. Click one to see where it came from and every account it passed through.'),
      cardForm,
      table(['Card id (unique)', 'Card', 'How they got it', 'First owner', 'Got it', 'Moves'], cards.map((c) => [
        h('a', { href: `#/card/${c.instance_id}`, class: 'mono', 'data-testid': 'card-link' }, c.instance_id),
        c.card_id, c.origin,
        c.original_owner_id === id ? 'this player' : h('a', { href: `#/player/${c.original_owner_id}` }, c.original_owner_name ?? c.original_owner_id),
        fmtDate(c.created_at), fmtNum(c.moves),
      ]), 'card-table'),
      h('nav', { class: 'pager' },
        cardPage > 1 ? h('a', { href: cardLink(cardPage - 1) }, '← Previous') : h('span', {}),
        h('span', {}, `Page ${cardPage} of ${cardPages}`),
        cardPage < cardPages ? h('a', { href: cardLink(cardPage + 1) }, 'Next →') : h('span', {}))),
    h('section', { class: 'card' }, h('h2', {}, 'Ban history'),
      table(['Banned', 'Until', 'Reason', 'Lifted', 'Lift reason'], d.bans.map((b) => [fmtDate(b.created_at), b.expires_at ? fmtDate(b.expires_at) : 'permanent', b.reason, fmtDate(b.lifted_at), b.lift_reason ?? '—']))),
    h('section', { class: 'card' }, h('h2', {}, 'Admin actions on this player'),
      table(['When', 'Admin', 'Action', 'Before', 'After', 'Reason'], audit.map((a) => [fmtDate(a.created_at), a.admin_name ?? '—', a.action, changeView(a.before), changeView(a.after), a.reason]))));
}

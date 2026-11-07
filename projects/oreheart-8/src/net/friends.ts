// Friends (Ken, Nov 7: "I'd also like a friends list and so you can save in quick play your friends in your friends list").
// The Friends screen (design D): your friend code, your friends (online first, with rank charm and status), requests in and out,
// blocked players, Add friend by name or code, Remove, Block, and Challenge an online friend (friend or practice match on your
// server). The pop-up for a challenge arrives through Realtime (and a slow poll as a fallback); it lasts 60 s.
// Kid-safe: no free text, only names and avatars. The server decides everything (supabase/migrations/20261107000001_friends.sql);
// mock test pages (?test=1&pvp=mock&user=…) talk to tools/friends-mock.mjs instead.
import { h } from '../ui/app';
import { econShow, backBtn } from './economy';
import { rpc, client } from './online';
import { net } from './state';
import { avatarPicture, avatarName } from './avatars';
import { ladderCharm } from '../content/ladder';
import { isMockPvp, mockUser, makeCode, joinCode, quickPick } from './pvp';
import { currentRegion } from './regions';

type El = HTMLElement;
export interface FriendCard { id: string; username: string; avatar: string | null; rating: number; rank: string; status: 'online' | 'in_match' | 'offline'; since?: string }
export interface Person { id: string; username: string; avatar?: string | null; at?: string }
export interface Invite { id: string; from_id: string; from_name: string; from_avatar: string | null; mode: 'friend' | 'practice'; region: string | null; expires_at: string }
export interface Overview {
  code: string; max: number; invites_enabled: boolean; friends: FriendCard[]; incoming: Person[]; outgoing: Person[]; blocked: Person[]; invites: Invite[];
  sent: { id: string; to_id: string; status: string; code: string }[];
}

const MOCK_URL = 'http://127.0.0.1:4310/friends';
const RPC: Record<string, [string, (b: any) => any]> = {
  overview: ['friends_overview', () => ({})],
  request: ['friend_request', (b) => ({ p_who: b.who })],
  respond: ['friend_respond', (b) => ({ p_user: b.id, p_accept: !!b.accept })],
  remove: ['friend_remove', (b) => ({ p_user: b.id })],
  block: ['friend_block', (b) => ({ p_user: b.id })],
  unblock: ['friend_unblock', (b) => ({ p_user: b.id })],
  invite: ['friend_invite', (b) => ({ p_user: b.id, p_code: b.code, p_mode: b.mode, p_region: b.region ?? null })],
  invite_respond: ['friend_invite_respond', (b) => ({ p_invite: b.invite, p_accept: !!b.accept })],
  invite_cancel: ['friend_invite_cancel', (b) => ({ p_invite: b.invite })],
};
/** one door: the mock server on mock pages, the database otherwise; errors come back as { ok: false, error } */
export async function call<T = any>(op: string, body: Record<string, unknown> = {}): Promise<T & { ok?: boolean; error?: string }> {
  try {
    if (isMockPvp()) {
      const r = await fetch(MOCK_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mock-user': mockUser() }, body: JSON.stringify({ op, ...body }) });
      return await r.json();
    }
    const [fn, args] = RPC[op];
    const r: any = await rpc(fn, args(body));
    return { ok: true, ...(r || {}) };
  } catch (e: any) { return { ok: false, error: String(e?.message || e).replace(/^.*?: /, '') } as any; }
}
export const overview = () => call<Overview>('overview');

let challengeMode: 'friend' | 'practice' = 'friend';
const STATUS_WORD: Record<string, string> = { online: 'Online', in_match: 'In a match', offline: 'Offline' };
const charm = (rank: string) => h('img', { class: 'fr-charm', src: ladderCharm(String(rank || 'stone').split(' ')[0]), alt: '', draggable: 'false' });
const av = (id: string | null | undefined, name: string) => h('img', { class: 'fr-av', src: avatarPicture(id ?? null), alt: avatarName(id ?? null) || name, draggable: 'false' });
const btn = (label: string, onclick: () => void, cls = '', attrs: Record<string, string> = {}) => h('button', { type: 'button', class: `net-btn sbtn panel ${cls}`.trim(), onclick, ...attrs }, label);

// ------------------------------------------------------------------ the screen
export async function showFriends(): Promise<void> {
  const alert = h('p', { class: 'econ-alert', role: 'alert', 'data-testid': 'friends-alert' });
  const list = h('div', { class: 'fr-list', role: 'list', 'aria-label': 'Friends', 'data-testid': 'friends-list' }, h('p', { class: 'net-note' }, 'Gathering your friends…'));
  const side = h('div', { class: 'fr-side' });
  const codeBox = h('div', { class: 'fr-code', 'data-testid': 'friends-code' });
  econShow('friends',
    h('div', { class: 'econ-head' }, backBtn(),
      h('div', { class: 'econ-titles' }, h('h1', {}, 'Friends'), h('p', { class: 'econ-sub' }, 'Save the players you like, see who is online, and challenge them to a match.')),
      codeBox),
    alert,
    h('div', { class: 'fr-main' }, h('section', { class: 'econ-panel fr-friends' }, h('h3', { class: 'h' }, 'Your friends'), list), side));
  const refresh = async (msg?: string) => {
    const o = await overview();
    if (!list.isConnected) return;
    if (!o || o.ok === false) { alert.textContent = 'The friends list is not answering: ' + (o?.error || 'try again'); list.replaceChildren(); return; }
    if (msg != null) alert.textContent = msg;
    render(o, { list, side, codeBox, alert, refresh });
  };
  await refresh();
  // keep the statuses fresh while the screen is up (cheap: one call every 20 s, only when the tab is visible)
  const iv = setInterval(() => { if (!list.isConnected) { clearInterval(iv); return; } if (document.visibilityState === 'visible') void refresh(); }, isMockPvp() ? 3000 : 20000);
}

interface Parts { list: El; side: El; codeBox: El; alert: El; refresh: (msg?: string) => Promise<void> }

function render(o: Overview, p: Parts) {
  p.codeBox.replaceChildren(h('small', {}, 'Your friend code'), h('b', { 'data-testid': 'friends-my-code' }, o.code || '—'));
  // friends: online first (the server sorts; kept here too)
  const order = { online: 0, in_match: 1, offline: 2 } as Record<string, number>;
  const fs = [...(o.friends || [])].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.username.localeCompare(b.username));
  p.list.replaceChildren(...(fs.length ? fs.map((f) => friendRow(f, o, p)) : [h('p', { class: 'net-note', 'data-testid': 'friends-empty' }, 'No friends yet. Add one by name or friend code, or with "Add friend" after a match.')]),
    h('p', { class: 'fr-count' }, `${fs.length} / ${o.max} friends`));
  // the side: add, challenge kind, requests, sent, blocked
  const input = h('input', { class: 'net-input fr-input', type: 'text', maxlength: '40', autocomplete: 'off', spellcheck: 'false', placeholder: 'Name or friend code', 'aria-label': 'Player name or friend code', 'data-testid': 'friends-add-input' }) as HTMLInputElement;
  const send = btn('Send request', async () => {
    const who = input.value.trim();
    if (who.length < 3) { p.alert.textContent = 'Type a player’s name or friend code.'; return; }
    send.setAttribute('disabled', '');
    const r: any = await call('request', { who });
    send.removeAttribute('disabled');
    if (r.ok === false) { p.alert.textContent = r.error || 'That did not work.'; return; }
    input.value = '';
    await p.refresh(r.state === 'friends' ? `You and ${who} are friends now.` : `Request sent to ${who}.`);
  }, 'primary', { 'data-testid': 'friends-add-send' });
  input.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') send.click(); });
  const kind = h('div', { class: 'mode fr-kind', role: 'radiogroup', 'aria-label': 'Challenge kind' },
    ...(['friend', 'practice'] as const).map((k) => h('button', { type: 'button', role: 'radio', class: 'chip panel' + (challengeMode === k ? ' on' : ''), 'aria-checked': String(challengeMode === k), 'data-testid': 'friends-kind-' + k,
      onclick: () => { challengeMode = k; render(o, p); } }, k === 'friend' ? 'Friend match' : 'Practice')));
  const person = (x: Person, acts: El[]) => h('div', { class: 'fr-mini', role: 'listitem', 'data-player': x.username }, av(x.avatar ?? null, x.username), h('b', {}, x.username), h('span', { class: 'fr-acts' }, ...acts));
  const act = async (op: string, body: any, msg: string) => { const r: any = await call(op, body); await p.refresh(r.ok === false ? r.error || 'That did not work.' : msg); };
  p.side.replaceChildren(
    h('section', { class: 'econ-panel fr-add', 'data-testid': 'friends-add' }, h('h3', { class: 'h' }, 'Add a friend'), h('div', { class: 'fr-addrow' }, input, send),
      h('p', { class: 'shard-note' }, 'They see your name and avatar and choose to accept. Nobody can send messages here.')),
    h('section', { class: 'econ-panel' }, h('h3', { class: 'h' }, 'Challenge as'), kind,
      h('p', { class: 'shard-note' }, o.invites_enabled ? (challengeMode === 'practice' ? 'Practice: nothing is paid or counted.' : 'A friend match on your server: coins and quests count, rank does not.') : 'Challenges are switched off right now.')),
    h('section', { class: 'econ-panel', 'data-testid': 'friends-incoming' }, h('h3', { class: 'h' }, `Requests for you${o.incoming.length ? ` (${o.incoming.length})` : ''}`),
      ...(o.incoming.length ? o.incoming.map((x) => person(x, [
        btn('Accept', () => void act('respond', { id: x.id, accept: true }, `You and ${x.username} are friends now.`), 'primary', { 'data-testid': 'friends-accept' }),
        btn('Decline', () => void act('respond', { id: x.id, accept: false }, 'Request declined.'), '', { 'data-testid': 'friends-decline' }),
        btn('Block', () => void act('block', { id: x.id }, `${x.username} is blocked.`), 'danger', { 'data-testid': 'friends-block-req' })])) : [h('p', { class: 'net-note' }, 'None right now.')])),
    h('section', { class: 'econ-panel', 'data-testid': 'friends-outgoing' }, h('h3', { class: 'h' }, 'Requests you sent'),
      ...(o.outgoing.length ? o.outgoing.map((x) => person(x, [btn('Cancel', () => void act('remove', { id: x.id }, 'Request taken back.'), '', { 'data-testid': 'friends-cancel' })])) : [h('p', { class: 'net-note' }, 'None waiting.')])),
    ...(o.blocked.length ? [h('section', { class: 'econ-panel', 'data-testid': 'friends-blocked' }, h('h3', { class: 'h' }, 'Blocked'),
      ...o.blocked.map((x) => person(x, [btn('Unblock', () => void act('unblock', { id: x.id }, `${x.username} is no longer blocked.`), '', { 'data-testid': 'friends-unblock' })])))] : []));
}

function friendRow(f: FriendCard, o: Overview, p: Parts): El {
  const more = h('div', { class: 'fr-more', hidden: true },
    btn('Remove', async () => { if (!confirmBox(`Remove ${f.username} from your friends?`)) return; const r: any = await call('remove', { id: f.id }); await p.refresh(r.ok === false ? r.error : `${f.username} was removed.`); }, '', { 'data-testid': 'friends-remove' }),
    btn('Block', async () => { if (!confirmBox(`Block ${f.username}? They can't send you requests or challenges, or join your friend codes.`)) return; const r: any = await call('block', { id: f.id }); await p.refresh(r.ok === false ? r.error : `${f.username} is blocked.`); }, 'danger', { 'data-testid': 'friends-block' }));
  const canChallenge = f.status === 'online' && o.invites_enabled;
  const challenge = btn('Challenge', () => void challengeFriend(f, p.alert), 'primary', { 'data-testid': 'friends-challenge', title: canChallenge ? `Challenge ${f.username} to a ${challengeMode === 'practice' ? 'practice' : 'friend'} match` : f.status === 'in_match' ? `${f.username} is in a match` : `${f.username} is offline` });
  if (!canChallenge) challenge.setAttribute('disabled', '');
  return h('div', { class: 'fr-row ' + f.status, role: 'listitem', 'data-player': f.username, 'data-status': f.status, 'data-testid': 'friends-row' },
    h('span', { class: 'fr-avwrap' }, av(f.avatar, f.username), h('i', { class: 'fr-dot ' + f.status, 'aria-hidden': 'true' })),
    h('div', { class: 'fr-who' }, h('b', {}, f.username), h('small', {}, charm(f.rank), f.rank || 'Unranked', ' · ', h('span', { class: 'fr-status', 'data-testid': 'friends-status' }, STATUS_WORD[f.status] || f.status))),
    h('span', { class: 'fr-acts' }, challenge, btn('⋯', () => { more.hidden = !more.hidden; }, 'fr-dots', { 'aria-label': `More for ${f.username}`, 'data-testid': 'friends-more' })), more);
}

/** Challenge: make a friend-code room on my server (as usual), then tell the friend; the code screen waits for them like any code. */
async function challengeFriend(f: FriendCard, alert: El) {
  alert.textContent = '';
  const region = isMockPvp() ? null : currentRegion();
  const made = await makeCode(quickPick(), challengeMode === 'practice', region);
  if (!made.ok || !made.code) { alert.textContent = made.error || 'Could not make a room.'; return; }
  const r: any = await call('invite', { id: f.id, code: made.code, mode: challengeMode, region });
  const wait = document.querySelector('[data-screen="pvp-code"] .pvp-waiting');
  const note = r.ok === false ? `${f.username} could not be challenged: ${r.error}. You can still send them the code.` : `Challenge sent to ${f.username}. They have 60 seconds to accept.`;
  if (wait) wait.textContent = note;
  const panel = document.querySelector('[data-screen="pvp-code"] .pvp-panel');
  panel?.prepend(h('p', { class: 'fr-sent-note', role: 'status', 'data-testid': 'friends-challenge-sent' }, note));
}

// ------------------------------------------------------------------ the challenge pop-up
let watching = false;
const shown = new Set<string>();
/** Starts once per page after sign-in (and on mock pages): Realtime on my invite rows, plus a slow poll as a safety net. */
export function startInviteWatch(): void {
  if (watching) return;
  watching = true;
  const check = async () => {
    if (!net.active && !isMockPvp()) return;
    if (document.visibilityState !== 'visible') return;
    const o = await overview();
    if (!o || o.ok === false) return;
    setBadge((o.incoming?.length || 0) + (o.invites?.length || 0));
    for (const i of o.invites || []) if (!shown.has(i.id) && Date.parse(i.expires_at) > Date.now()) { shown.add(i.id); showInvite(i); }
  };
  setInterval(() => { void check(); }, isMockPvp() ? 1500 : 20000);
  void check();
  if (!isMockPvp()) {
    try {
      const c = client();
      void c.auth.getUser().then(({ data }) => {
        const uid = data?.user?.id; if (!uid) return;
        c.channel('friend-invites-' + uid).on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'friend_invites', filter: `to_user=eq.${uid}` }, () => { void check(); }).subscribe();
      }).catch(() => {});
    } catch { /* the poll covers it */ }
  }
}

let badgeN = 0;
function setBadge(n: number) {
  badgeN = n;
  for (const b of document.querySelectorAll('[data-friends-badge]')) { (b as El).textContent = n > 0 ? String(n) : ''; (b as El).hidden = n <= 0; }
}
/** the little count on a Friends button (requests + challenges waiting) */
export const friendsBadge = () => { const b = h('span', { class: 'fr-badge', 'data-friends-badge': '1', hidden: badgeN <= 0 }, badgeN > 0 ? String(badgeN) : ''); return b; };

function showInvite(i: Invite) {
  const secs = h('b', { 'data-testid': 'invite-secs' }, '60');
  const err = h('p', { class: 'net-alert', role: 'alert' });
  const close = () => { clearInterval(t); box.remove(); };
  const accept = btn('Accept', async () => {
    accept.setAttribute('disabled', '');
    const r: any = await call('invite_respond', { invite: i.id, accept: true });
    if (r.ok === false || !r.code) { err.textContent = r.error || 'That challenge is gone.'; setTimeout(close, 2500); return; }
    close();
    const j = await joinCode(String(r.code), quickPick());
    if (!j.ok) { const a = document.querySelector('[data-testid="friends-alert"]'); if (a) a.textContent = j.error || 'Could not join.'; }
  }, 'primary play', { 'data-testid': 'invite-accept' });
  const decline = btn('Decline', () => { void call('invite_respond', { invite: i.id, accept: false }); close(); }, '', { 'data-testid': 'invite-decline' });
  const box = h('div', { class: 'fr-invite', role: 'alertdialog', 'aria-modal': 'false', 'aria-label': `Challenge from ${i.from_name}`, 'data-testid': 'friend-invite' },
    h('div', { class: 'econ-panel fr-invite-box' }, av(i.from_avatar, i.from_name),
      h('div', {}, h('h3', { class: 'h' }, `${i.from_name} challenges you!`), h('p', {}, i.mode === 'practice' ? 'A practice match: nothing is paid or counted.' : 'A friend match: coins and quests count.'),
        h('p', { class: 'shard-note' }, 'Ends in ', secs, ' s')),
      h('div', { class: 'net-actions' }, accept, decline), err));
  document.body.append(box);
  const t = setInterval(() => { const left = Math.max(0, Math.round((Date.parse(i.expires_at) - Date.now()) / 1000)); secs.textContent = String(left); if (left <= 0) close(); }, 500);
}

// ------------------------------------------------------------------ "Add friend" on other screens
/** A small button that sends a request to a player by name (Match End, profiles). */
export function addFriendButton(username: string): El {
  const b = btn('Add friend', async () => {
    b.setAttribute('disabled', '');
    const r: any = await call('request', { who: username });
    b.textContent = r.ok === false ? (r.error || 'Not now') : r.state === 'friends' ? 'Friends!' : 'Request sent';
  }, 'fr-addbtn', { 'data-testid': 'add-friend', title: `Send ${username} a friend request` });
  return b;
}

function confirmBox(text: string): boolean { if (/[?&]test=1/.test(location.search)) return true; return window.confirm(text); }

/** test hooks */
export function friendsHooks() {
  return {
    open: () => showFriends(),
    overview: () => overview(),
    request: (who: string) => call('request', { who }),
    respond: (id: string, accept: boolean) => call('respond', { id, accept }),
    block: (id: string) => call('block', { id }),
    watch: () => startInviteWatch(),
  };
}

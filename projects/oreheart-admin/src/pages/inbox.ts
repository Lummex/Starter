// Inbox: messages sent with the game's "Contact us" form (parents and players).
// Nobody emails Ken; he reads and answers them here. Marking one handled needs a note and is audited.
import { rpc } from '../supabase';
import { busy, fmtDate, fmtNum, h, notice } from '../ui';

interface Msg {
  id: number; created_at: string; topic: string; message: string; reply_email: string | null; name: string | null;
  child_username: string | null; user_id: string | null; username: string | null; status: string;
  handled_at: string | null; handled_by_name: string | null; handled_note: string | null; reply_text: string | null; total: number;
}

const TOPICS: Record<string, string> = {
  parent_request: 'Parent request', delete_account: 'Delete account', question: 'Question', problem: 'Problem', other: 'Other',
};
const PAGE = 50;

function message(m: Msg, reload: () => void) {
  const n = notice();
  const note = h('input', { type: 'text', required: true, minlength: 3, maxlength: 500,
    placeholder: m.status === 'new' ? 'What did you do? (required, recorded)' : 'Why reopen? (required, recorded)', 'data-testid': 'inbox-note' });
  const next = m.status === 'new' ? 'handled' : 'new';
  const reply = h('textarea', { rows: 3, maxlength: 4000, placeholder: m.reply_email ? 'Answer (optional) — sent from the no-reply address, never your own email' : 'No reply address given', disabled: !m.reply_email || next !== 'handled', 'data-testid': 'inbox-reply' });
  const form = h('form', { class: 'stack' }, next === 'handled' ? reply : null, note,
    h('button', { type: 'submit', class: next === 'handled' ? 'primary' : '', 'data-testid': 'inbox-mark' }, next === 'handled' ? 'Mark handled' : 'Reopen'),
    n.el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (note.value.trim().length < 3) { n.error('Write a note (3+ characters).'); return; }
    await busy(form, async () => {
      try { await rpc('admin_inbox_mark', { p_id: m.id, p_status: next, p_note: note.value.trim(), p_reply: reply.value.trim() || null }); reload(); }
      catch (err) { n.error((err as Error).message); }
    });
  });
  const from = [
    m.name ? `${m.name}` : null,
    m.reply_email ? `reply to ${m.reply_email}` : 'no reply address',
    m.child_username ? `about player ${m.child_username}` : null,
  ].filter(Boolean).join(' · ');
  return h('article', { class: 'card', 'data-testid': 'inbox-message' },
    h('p', { class: 'small' },
      h('span', { class: `pill ${m.status === 'new' ? 'warn' : 'ok'}` }, m.status === 'new' ? 'New' : 'Handled'), ' ',
      h('strong', {}, TOPICS[m.topic] ?? m.topic), ` · ${fmtDate(m.created_at)} · #${m.id}`),
    h('p', { class: 'small' }, from,
      m.user_id ? h('span', {}, ' · sent while logged in as ', h('a', { href: `#/player/${m.user_id}` }, m.username ?? m.user_id)) : null),
    h('p', { class: 'message-text' }, m.message),
    m.reply_text ? h('p', { class: 'small' }, 'Answer sent: ', h('span', { class: 'message-text' }, m.reply_text)) : null,
    m.handled_note ? h('p', { class: 'small' }, `${m.status === 'handled' ? 'Handled' : 'Note'}${m.handled_by_name ? ` by ${m.handled_by_name}` : ''}${m.handled_at ? `, ${fmtDate(m.handled_at)}` : ''}: ${m.handled_note}`) : null,
    form);
}

export async function inboxPage(root: HTMLElement, params: URLSearchParams) {
  const status = params.get('status') ?? 'new';
  const page = Math.max(1, parseInt(params.get('p') ?? '1', 10) || 1);
  root.replaceChildren(h('h1', {}, 'Inbox'), h('p', { class: 'small' }, 'Loading…'));
  const rows = await rpc<Msg[]>('admin_inbox', { p_status: status === 'all' ? '' : status, p_page: page, p_page_size: PAGE });
  const total = rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const tab = (key: string, label: string) => h('a', { href: `#/inbox?status=${key}`, class: status === key ? 'active' : '' }, label);
  const reload = () => void inboxPage(root, params);
  root.replaceChildren(
    h('h1', {}, 'Inbox'),
    h('p', { class: 'small' }, 'Messages from the game\'s "Contact us" form. Answer in the box (it is emailed from the no-reply address, never your own email), or act in the back counter, then mark it handled with a note. Messages are never deleted.'),
    h('nav', { class: 'tabs' }, tab('new', 'New'), tab('handled', 'Handled'), tab('all', 'All')),
    h('p', { class: 'small', 'data-testid': 'inbox-total' }, `${fmtNum(total)} message${total === 1 ? '' : 's'}`),
    ...(rows.length ? rows.map((m) => message(m, reload)) : [h('p', { class: 'small' }, 'Nothing here.')]),
    h('nav', { class: 'pager' },
      page > 1 ? h('a', { href: `#/inbox?status=${status}&p=${page - 1}` }, '← Newer') : h('span', {}),
      h('span', {}, `Page ${page} of ${pages}`),
      page < pages ? h('a', { href: `#/inbox?status=${status}&p=${page + 1}` }, 'Older →') : h('span', {})));
}

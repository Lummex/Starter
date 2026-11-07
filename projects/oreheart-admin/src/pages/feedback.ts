// Feedback (Nov 7): bug reports and ideas sent with the game's bug button. Ken sets each one to Seen, Fixed or Won't fix (with an
// optional note the log keeps); the player sees the new status in the game. Screenshots load only when asked (they are big).
import { rpc } from '../supabase';
import { busy, fmtDate, fmtNum, h, notice } from '../ui';

interface Row {
  id: number; kind: string; message: string; status: string; meta: Record<string, unknown>; has_screenshot: boolean;
  user_id: string; username: string | null; admin_note: string | null; created_at: string; updated_at: string;
}
interface List { total: number; counts: Record<string, number>; rows: Row[] }

const STATUS: Record<string, string> = { new: 'New', seen: 'Seen', fixed: 'Fixed', wontfix: "Won't fix" };
const KIND: Record<string, string> = { bug: 'Bug', idea: 'Idea', other: 'Other' };
const PILL: Record<string, string> = { new: 'warn', seen: '', fixed: 'ok', wontfix: 'bad' };
const PAGE = 50;

function item(r: Row, reload: () => void) {
  const n = notice();
  const note = h('input', { type: 'text', maxlength: 500, placeholder: 'Note (optional, kept in the audit log)', value: r.admin_note ?? '', 'data-testid': 'fb-note' });
  const shot = h('div', { class: 'stack' });
  const set = (status: string) => h('button', { type: 'button', class: status === 'fixed' ? 'primary' : status === 'wontfix' ? 'danger' : '', disabled: r.status === status, 'data-testid': `fb-set-${status}`,
    onclick: async (e: Event) => {
      const b = e.currentTarget as HTMLButtonElement;
      await busy(b, async () => {
        try { await rpc('admin_feedback_set', { p_id: r.id, p_status: status, p_note: note.value.trim() || null }); reload(); }
        catch (err) { n.error((err as Error).message); }
      });
    } }, STATUS[status]);
  const meta = r.meta || {};
  const facts = [meta.screen && `screen ${meta.screen}`, meta.device, meta.region && `region ${meta.region}`, meta.match && `match ${meta.match}`, meta.build && `build ${meta.build}`].filter(Boolean).join(' · ');
  return h('article', { class: 'card', 'data-testid': 'fb-item' },
    h('p', { class: 'small' }, h('span', { class: `pill ${PILL[r.status] ?? ''}` }, STATUS[r.status] ?? r.status), ' ',
      h('strong', {}, KIND[r.kind] ?? r.kind), ` · ${fmtDate(r.created_at)} · #${r.id} · from `,
      h('a', { href: `#/player/${r.user_id}` }, r.username ?? r.user_id)),
    h('p', { class: 'message-text' }, r.message),
    facts ? h('p', { class: 'small mono' }, facts) : null,
    r.has_screenshot ? h('button', { type: 'button', class: 'link', 'data-testid': 'fb-show-shot', onclick: async (e: Event) => {
      const b = e.currentTarget as HTMLButtonElement; b.disabled = true;
      try { const url = await rpc<string>('admin_feedback_screenshot', { p_id: r.id }); shot.replaceChildren(h('img', { src: url, alt: 'Screenshot from the player', style: 'max-width:100%;border-radius:6px' })); b.remove(); }
      catch (err) { n.error((err as Error).message); b.disabled = false; }
    } }, 'Show screenshot') : null,
    shot,
    h('div', { class: 'row' }, note, set('seen'), set('fixed'), set('wontfix'), r.status !== 'new' ? set('new') : null),
    n.el);
}

export async function feedbackPage(root: HTMLElement, params: URLSearchParams) {
  const status = params.get('status') ?? 'new';
  const kind = params.get('kind') ?? '';
  const page = Math.max(1, parseInt(params.get('p') ?? '1', 10) || 1);
  root.replaceChildren(h('h1', {}, 'Feedback'), h('p', { class: 'small' }, 'Loading…'));
  const data = await rpc<List>('admin_feedback', { p_status: status === 'all' ? '' : status, p_kind: kind, p_page: page, p_page_size: PAGE });
  const pages = Math.max(1, Math.ceil((data.total || 0) / PAGE));
  const q = (s: string, k: string, p = 1) => `#/feedback?status=${s}${k ? `&kind=${k}` : ''}${p > 1 ? `&p=${p}` : ''}`;
  const tab = (s: string, label: string) => h('a', { href: q(s, kind), class: status === s ? 'active' : '' }, `${label}${s !== 'all' && data.counts?.[s] ? ` (${data.counts[s]})` : ''}`);
  const ktab = (k: string, label: string) => h('a', { href: q(status, k), class: kind === k ? 'active' : '' }, label);
  const reload = () => void feedbackPage(root, params);
  root.replaceChildren(
    h('h1', {}, 'Feedback'),
    h('p', { class: 'small' }, 'Bug reports and ideas from the game\'s bug button. Rude words were masked before they were saved. Set each one when you have looked at it.'),
    h('nav', { class: 'tabs' }, tab('new', 'New'), tab('seen', 'Seen'), tab('fixed', 'Fixed'), tab('wontfix', "Won't fix"), tab('all', 'All')),
    h('nav', { class: 'tabs' }, ktab('', 'All kinds'), ktab('bug', 'Bugs'), ktab('idea', 'Ideas'), ktab('other', 'Other')),
    h('p', { class: 'small', 'data-testid': 'fb-total' }, `${fmtNum(data.total || 0)} report${data.total === 1 ? '' : 's'}`),
    ...(data.rows.length ? data.rows.map((r) => item(r, reload)) : [h('p', { class: 'small' }, 'Nothing here.')]),
    h('nav', { class: 'pager' },
      page > 1 ? h('a', { href: q(status, kind, page - 1) }, '← Newer') : h('span', {}),
      h('span', {}, `Page ${page} of ${pages}`),
      page < pages ? h('a', { href: q(status, kind, page + 1) }, 'Older →') : h('span', {})));
}

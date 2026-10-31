// Audit log: every admin action, newest first. Read-only (the table is append-only on the server).
import { rpc } from '../supabase';
import { changeView, fmtDate, fmtNum, h, table } from '../ui';

interface Row {
  id: number; created_at: string; admin_id: string; admin_name: string | null; action: string;
  target_user: string | null; target_name: string | null; before: unknown; after: unknown; reason: string; ip: string | null; total: number;
}

const PAGE = 50;

export async function auditPage(root: HTMLElement, params: URLSearchParams) {
  const page = Math.max(1, parseInt(params.get('p') ?? '1', 10) || 1);
  root.replaceChildren(h('h1', {}, 'Audit log'), h('p', { class: 'small' }, 'Loading…'));
  const rows = await rpc<Row[]>('admin_audit_log', { p_page: page, p_page_size: PAGE, p_target: null });
  const total = rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  root.replaceChildren(
    h('h1', {}, 'Audit log'),
    h('p', { class: 'small' }, `${fmtNum(total)} admin action${total === 1 ? '' : 's'}. Nothing here can be edited or deleted.`),
    table(['When', 'Admin', 'Action', 'Player', 'Before', 'After', 'Reason', 'IP'], rows.map((r) => [
      fmtDate(r.created_at), r.admin_name ?? r.admin_id, r.action,
      r.target_user ? h('a', { href: `#/player/${r.target_user}` }, r.target_name ?? r.target_user) : '—',
      changeView(r.before), changeView(r.after), r.reason, r.ip || '—',
    ]), 'audit-table'),
    h('nav', { class: 'pager' },
      page > 1 ? h('a', { href: `#/audit?p=${page - 1}` }, '← Newer') : h('span', {}),
      h('span', {}, `Page ${page} of ${pages}`),
      page < pages ? h('a', { href: `#/audit?p=${page + 1}` }, 'Older →') : h('span', {})));
}

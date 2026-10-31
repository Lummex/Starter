// Tiny DOM helpers. Text always goes in through textContent, never as HTML,
// so player names or ban reasons can't inject anything into the page.

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function mount(...nodes: Node[]) {
  const app = document.getElementById('app')!;
  app.replaceChildren(...nodes);
}

export function fmtDate(v: string | null | undefined, withTime = true): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return withTime ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function fmtNum(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString();
}

/** US cents -> "$12.50". */
export function fmtMoney(cents: number | null | undefined): string {
  return cents == null ? '—' : (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

/** A message line (error or ok) that a form can update. */
export function notice() {
  const el = h('p', { class: 'notice', role: 'status', 'aria-live': 'polite', 'data-testid': 'notice' });
  return {
    el,
    error(msg: string) { el.className = 'notice error'; el.textContent = msg; },
    ok(msg: string) { el.className = 'notice ok'; el.textContent = msg; },
    clear() { el.className = 'notice'; el.textContent = ''; },
  };
}

/** Disables a form's buttons while an async action runs. */
export async function busy<T>(form: HTMLElement, fn: () => Promise<T>): Promise<T> {
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach((b) => (b.disabled = true));
  try { return await fn(); } finally { buttons.forEach((b) => (b.disabled = false)); }
}

export function table(headers: string[], rows: Child[][], testid?: string) {
  return h('div', { class: 'table-wrap' },
    h('table', { 'data-testid': testid },
      h('thead', {}, h('tr', {}, ...headers.map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, ...(rows.length ? rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, c))))
        : [h('tr', {}, h('td', { colspan: headers.length, class: 'empty' }, 'Nothing here yet.'))]))));
}

// Audit before/after: the readable fields only (ids and who-did-it columns are shown elsewhere).
const HIDDEN = new Set(['id', 'user_id', 'banned_by', 'lifted_by', 'transaction_id', 'created_at']);
const ISO = /^\d{4}-\d{2}-\d{2}T/;
export function changeView(v: unknown): Node | string {
  if (v == null) return '—';
  if (typeof v !== 'object' || Array.isArray(v)) return JSON.stringify(v);
  const lines = Object.entries(v as Record<string, unknown>)
    .filter(([k]) => !HIDDEN.has(k))
    .map(([k, x]) => `${k.replace(/_/g, ' ')}: ${x == null ? '—' : typeof x === 'string' && ISO.test(x) ? fmtDate(x) : typeof x === 'object' ? JSON.stringify(x) : String(x)}`);
  return h('span', { class: 'change', title: JSON.stringify(v) }, lines.join('\n'));
}

// Report a bug / send an idea (Ken, Nov 7: "I want to report a bug and feedback button in the game"). From the Dashboard top bar,
// the in-match menu and Settings. Bug / Idea / Other, up to 1000 characters (rude words are masked by the server, never refused),
// and an optional small picture of the screen. The game adds what it knows: build, screen, device, region, match. 10 a day.
// Ken reads them in the back counter → Feedback.
import { h } from '../ui/app';
import type { App } from '../ui/app';
import { rpc } from './online';
import { net } from './state';
import { stubMode, toast } from './economy';
import { currentRegion } from './regions';
import { currentActiveMatch } from './pvp';

type El = HTMLElement;
const MAX = 1000;
const SHOT_MAX = 550_000; // characters of the data URL (the server takes 600,000)

const STUB = { sent: [] as any[] };

/** what the game knows right now, for Ken (no personal data beyond the account the report is filed under) */
export function feedbackMeta(): Record<string, unknown> {
  const build = ([...document.scripts].map((s) => s.src).find((s) => /\/assets\/index-[^/]+\.js/.test(s)) || '').replace(/^.*\/assets\//, '');
  const screens = [...document.querySelectorAll('[data-screen]')].map((e) => (e as El).dataset.screen).filter(Boolean);
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'other';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'other';
  let region: string | null = null; try { region = currentRegion() || null; } catch { /* none */ }
  let match: string | null = null; try { match = currentActiveMatch(); } catch { /* none */ }
  return {
    build: build || 'dev', screen: screens[screens.length - 1] || 'unknown', screens: screens.slice(-4),
    device: `${os} · ${browser} · ${innerWidth}x${innerHeight}${navigator.maxTouchPoints > 0 ? ' · touch' : ''}`,
    region, match, installed: matchMedia('(display-mode: standalone)').matches, at: new Date().toISOString(),
  };
}

/** a small JPEG of the biggest canvas on screen (the 3D board), or null; capped in size */
export function captureScreen(): string | null {
  try {
    const cs = [...document.querySelectorAll('canvas')].filter((c) => c.width > 0 && c.height > 0 && c.getBoundingClientRect().width > 0);
    if (!cs.length) return null;
    const big = cs.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const scale = Math.min(1, 960 / big.width);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(big.width * scale)); out.height = Math.max(1, Math.round(big.height * scale));
    const g = out.getContext('2d'); if (!g) return null;
    g.fillStyle = '#0c0d14'; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(big, 0, 0, out.width, out.height);
    for (const q of [0.6, 0.45, 0.3]) { const u = out.toDataURL('image/jpeg', q); if (u.length <= SHOT_MAX) return u; }
    return null;
  } catch { return null; } // a tainted or lost canvas: send without a picture
}

export const api = {
  async send(kind: string, message: string, screenshot: string | null, meta: Record<string, unknown>): Promise<{ ok: boolean; id?: number }> {
    if (stubMode()) {
      if (STUB.sent.filter((s) => Date.now() - s.t < 86_400_000).length >= 10) throw new Error("Thanks, that's plenty for today! Send more tomorrow.");
      STUB.sent.push({ kind, message, screenshot: !!screenshot, meta, t: Date.now() }); return { ok: true, id: STUB.sent.length };
    }
    return await rpc('submit_feedback', { p_kind: kind, p_message: message, p_screenshot: screenshot, p_meta: meta });
  },
};

/** The box. The picture is taken BEFORE the box opens, so the box is never in it. */
export function openFeedback(app: App, opts: { kind?: 'bug' | 'idea' | 'other' } = {}): void {
  if (!net.active && !stubMode()) { toast('Sign in to send a bug report or an idea.'); return; }
  const shot = captureScreen();
  const meta = feedbackMeta();
  let kind: 'bug' | 'idea' | 'other' = opts.kind || 'bug';
  const kinds = h('div', { class: 'seg fb-kinds', role: 'radiogroup', 'aria-label': 'What is it?' });
  const drawKinds = () => kinds.replaceChildren(...([['bug', 'Bug'], ['idea', 'Idea'], ['other', 'Other']] as const).map(([k, label]) =>
    h('button', { type: 'button', role: 'radio', class: 'chip panel' + (kind === k ? ' on' : ''), 'aria-checked': String(kind === k), 'data-testid': 'fb-kind-' + k, onclick: () => { kind = k; drawKinds(); hint(); } }, label)));
  drawKinds();
  const text = h('textarea', { class: 'net-input fb-text', rows: '5', maxlength: String(MAX), 'aria-label': 'Tell us', 'data-testid': 'fb-text' }) as HTMLTextAreaElement;
  const count = h('small', { class: 'fb-count', 'data-testid': 'fb-count' }, `0 / ${MAX}`);
  const hint = () => { text.placeholder = kind === 'bug' ? 'What happened? What did you expect? (e.g. "My shiv rat walked through a wall in the middle lane")' : kind === 'idea' ? 'What would make Oreheart more fun?' : 'Tell us anything'; };
  hint();
  text.addEventListener('input', () => { count.textContent = `${text.value.length} / ${MAX}`; });
  const attach = h('input', { type: 'checkbox', id: 'fb-shot', 'data-testid': 'fb-shot' }) as HTMLInputElement;
  attach.checked = !!shot; if (!shot) attach.disabled = true;
  const shotRow = h('label', { class: 'fb-shot', for: 'fb-shot' }, attach, shot ? ' Attach a picture of the screen' : ' No picture of this screen is available',
    shot ? h('img', { class: 'fb-thumb', src: shot, alt: 'The picture that will be attached', 'data-testid': 'fb-thumb' }) : null);
  const err = h('p', { class: 'net-alert', role: 'alert', 'data-testid': 'fb-error' });
  const send = h('button', { type: 'button', class: 'btn panel play', 'data-testid': 'fb-send' }, 'Send') as HTMLButtonElement;
  const cancel = h('button', { type: 'button', class: 'btn panel', 'data-testid': 'fb-cancel' }, 'Cancel');
  const d: any = app.dialog('Report a bug or send an idea', [
    h('h2', {}, 'Tell the goblins (and Ken)'),
    h('p', { class: 'fb-sub' }, 'Found a bug or have an idea? Every report is read. Please no names, emails or phone numbers.'),
    kinds, text, count, shotRow, err,
    h('div', { class: 'row' }, send, cancel)]);
  d.el.setAttribute('data-testid', 'fb-dialog');
  d.el.dataset.sticky = '1'; // a typed report is never lost to a stray click outside
  cancel.addEventListener('click', () => d.close());
  send.addEventListener('click', async () => {
    const m = text.value.trim();
    if (m.length < 3) { err.textContent = 'Tell us a little more (at least a few words).'; text.focus(); return; }
    send.disabled = true; err.textContent = '';
    try {
      await api.send(kind, m, attach.checked ? shot : null, meta);
      d.close();
      toast(kind === 'bug' ? 'Thanks! The goblins are on it.' : 'Thanks! Every idea is read.', '/art/ui/silver/icon-howto.webp');
    } catch (e: any) { err.textContent = String(e?.message || e).replace(/^.*?: /, ''); send.disabled = false; }
  });
  setTimeout(() => text.focus(), 0);
}

/** the little bug button for top bars */
export function feedbackButton(app: App | null, testid = 'dash-feedback'): El {
  const ico = h('span', { class: 'fb-ico', 'aria-hidden': 'true' });
  // a small silver beetle (drawn, not an emoji, so it looks the same everywhere)
  ico.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%"><g fill="none" stroke="#dfe6f2" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="14" rx="5.2" ry="6.2" fill="#2b3446"/><path d="M12 8v12M8.6 6.6 7 4.5M15.4 6.6 17 4.5M6.8 12H3.5M17.2 12h3.3M6.9 16.5l-3 1.8M17.1 16.5l3 1.8"/><circle cx="12" cy="7.2" r="2.4" fill="#2b3446"/></g></svg>';
  return h('button', { type: 'button', class: 'icn panel fb-btn', 'aria-label': 'Report a bug or send an idea', title: 'Report a bug or send an idea', 'data-testid': testid,
    onclick: () => { if (app) openFeedback(app); } }, ico);
}

/** test hooks */
export function feedbackHooks() { return { sent: () => STUB.sent.map((s) => ({ ...s })), meta: () => feedbackMeta() }; }

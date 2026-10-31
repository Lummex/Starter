// Oreheart Back Counter (admin site v1).
// Gate order: Supabase set up? -> signed in? -> 2-step enrolled + used (aal2)? -> admin? -> pages.
// The site holds no secret. The server refuses every admin call without admin role + aal2.
import './style.css';
import { client, configured, rpc } from './supabase';
import { h, mount } from './ui';
import { challengePage, enrolPage, loginPage, notAdminPage, notConfiguredPage, wrongServerPage } from './pages/auth';
import { playerPage, playersPage } from './pages/players';
import { auditPage } from './pages/audit';
import { cardPage } from './pages/cards';
import { settingsPage } from './pages/settings';
import { inboxPage } from './pages/inbox';
import { buildKind, mismatch } from './env-guard';

const BUILD_KIND = buildKind(import.meta.env.VITE_OREHEART_ENV as string | undefined);
let serverKind = 'test';

const IDLE_MS = 30 * 60 * 1000; // sign out after 30 minutes without use
let idleTimer: number | undefined;
let me = '';

async function signOut() {
  window.clearTimeout(idleTimer);
  await client().auth.signOut();
  me = '';
  location.hash = '';
  start();
}

function armIdle() {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => { void signOut(); }, IDLE_MS);
}

async function start() {
  if (!configured) { notConfiguredPage(); return; }
  const auth = client().auth;
  // Test vs production: refuse to run if this build and the server don't match.
  const info = await rpc<{ server_kind: string }>('server_info').catch(() => null);
  const wrong = mismatch(BUILD_KIND, info?.server_kind);
  if (wrong) { wrongServerPage(wrong); return; }
  serverKind = info!.server_kind;
  const { data: { session } } = await auth.getSession();
  if (!session) { loginPage(start); return; }

  const { data: aal } = await auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    const { data: factors } = await auth.mfa.listFactors();
    const verified = factors?.totp?.find((f) => f.status === 'verified');
    if (verified) challengePage(verified.id, start, signOut);
    else await enrolPage(start, signOut);
    return;
  }

  const who = await rpc<{ admin: boolean; aal: string }>('am_i_admin').catch(() => ({ admin: false, aal: '' }));
  if (!who.admin) { notAdminPage(signOut); return; }
  me = session.user.email ?? '';
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, armIdle, { passive: true });
  armIdle();
  window.onhashchange = route;
  route();
}

function shell(active: string) {
  const link = (href: string, label: string, key: string) =>
    h('a', { href, class: active === key ? 'active' : '', 'aria-current': active === key ? 'page' : null }, label);
  const main = h('main', { class: 'content', 'data-testid': 'admin-main' });
  mount(
    serverKind === 'test' ? h('div', { class: 'test-banner', 'data-testid': 'test-banner' }, 'TEST SERVER — practice data only, not real players') : h('span', {}),
    h('header', { class: 'top' },
      h('span', { class: 'brand' }, 'Oreheart Back Counter'),
      h('nav', {}, link('#/players', 'Players', 'players'), link('#/inbox', 'Inbox', 'inbox'), link('#/card/', 'Card lookup', 'card'),
        link('#/settings', 'Settings', 'settings'), link('#/audit', 'Audit log', 'audit')),
      h('span', { class: 'who' }, me),
      h('button', { type: 'button', class: 'link', onclick: () => void signOut(), 'data-testid': 'sign-out' }, 'Sign out')),
    main);
  return main;
}

async function route() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  const key = ['audit', 'card', 'settings', 'inbox'].includes(parts[0]) ? parts[0] : 'players';
  const main = shell(key);
  try {
    if (parts[0] === 'player' && parts[1]) await playerPage(main, parts[1], params);
    else if (parts[0] === 'card') await cardPage(main, decodeURIComponent(parts[1] ?? ''));
    else if (parts[0] === 'settings') await settingsPage(main);
    else if (parts[0] === 'inbox') await inboxPage(main, params);
    else if (parts[0] === 'audit') await auditPage(main, params);
    else await playersPage(main, params);
  } catch (e) {
    const msg = (e as Error).message;
    main.replaceChildren(h('p', { class: 'notice error', 'data-testid': 'page-error' }, msg));
    // Lost the 2-step login or the admin role mid-session: start over.
    if (/2-step|not an admin/i.test(msg)) window.setTimeout(() => void start(), 1500);
  }
}

if (configured) {
  client().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') { me = ''; window.onhashchange = null; }
  });
}
void start();

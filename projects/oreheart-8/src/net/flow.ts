// Online Phase A screens and start-up flow: server check, login, sign-up (age question first), parent consent,
// avatar, welcome, profile, ban, forgot / set password, Contact us, server decks.
import './net.css';
import { h, btn, pictureOf } from '../ui/app';
import type { App } from '../ui/app';
import { CARDS } from '../engine';
import { loadBrowserDecks as loadLocalDecks } from '../ui/decks';
import type { SavedDeck } from '../ui/decks';
import { net } from './state';
import { client, rpc, redirectUrl, myStatus, passwordOk, underThirteen, savedAgeGroup, saveAgeGroup, type Status } from './online';
import { buildKind, mismatch } from './env-guard';
import { pageMode } from './switch';
import parentNotice from '../content/parent-notice.json';
import AVATARS from '../content/avatar-cards.json';

type El = HTMLElement;
const TURNSTILE = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY as string | undefined;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let app: App;
let serverKind: 'test' | 'production' = 'test';
let status: Status | null = null;
let checkTimer: any = null;
let recovering = false;
let setPwShown = false;
let uid = 0;

// ------------------------------------------------------------------ small UI helpers
const testBar = (): El | null => (serverKind === 'test' ? h('div', { class: 'test-server-bar', 'data-testid': 'test-server-bar' }, 'TEST SERVER — practice accounts only') : null);
const nbtn = (label: string, onclick: (e: Event) => void, cls = '') => h('button', { type: 'button', class: `net-btn ${cls}`.trim(), onclick }, label);
const alertEl = () => h('p', { class: 'net-alert', role: 'alert' });
const noteEl = () => h('p', { class: 'net-note', role: 'status' });

function field(label: string, id: string, type = 'text', attrs: Record<string, any> = {}) {
  const input = h('input', { id, type, class: 'net-input', autocomplete: 'off', ...attrs }) as HTMLInputElement;
  const msg = h('p', { class: 'net-hint', id: id + '-msg' });
  const help = attrs['data-help'] ? h('p', { class: 'net-help' }, attrs['data-help']) : null;
  return { input, msg, wrap: h('div', { class: 'net-field' }, h('label', { for: id }, label), input, help, msg) };
}

function show(name: string, plain: boolean, ...kids: (El | null)[]): El {
  app.clear();
  const panel = h('div', { class: 'net-panel' }, ...kids);
  const main = h('main', { class: `screen net-screen${plain ? ' plain' : ''}`, 'data-screen': 'net-' + name }, testBar(), panel);
  app.root.append(main);
  return panel;
}
const menuShow = (name: string, ...kids: (El | null)[]) => show(name, false, ...kids);
const plainShow = (name: string, ...kids: (El | null)[]) => show(name, true, h('img', { class: 'net-logo', src: '/art/logo-wide.webp', alt: 'Oreheart' }), ...kids);

function captchaBox() {
  let token: string | undefined; let id: string | undefined;
  const el = h('div', { class: 'captcha' });
  if (TURNSTILE) {
    const w: any = window;
    const go = () => { id = w.turnstile.render(el, { sitekey: TURNSTILE, theme: 'dark', callback: (t: string) => { token = t; }, 'expired-callback': () => { token = undefined; }, 'error-callback': () => { token = undefined; } }); };
    if (w.turnstile) go();
    else { const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = go; document.head.append(s); }
  }
  return { el: TURNSTILE ? el : null, token: () => token, reset() { token = undefined; if (id && (window as any).turnstile) (window as any).turnstile.reset(id); } };
}

async function busy<T>(b: HTMLButtonElement, fn: () => Promise<T>): Promise<T | undefined> {
  b.disabled = true;
  try { return await fn(); } finally { b.disabled = false; }
}

// ------------------------------------------------------------------ start
export async function startOnline(a: App, opts: { page?: boolean } = {}) {
  app = a;
  const page = pageMode(location.search);
  if (page) { await showPage(page); return; }
  void opts;
  const sb = client();
  if (/type=recovery/.test(location.hash)) recovering = true; // the link's own hash tells us, even if the event fired before we listened
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { recovering = true; if (!setPwShown) showSetPassword(); } });
  menuShow('wait', h('h1', {}, 'Oreheart'), noteEl());
  await serverCheck();
}

async function serverCheck() {
  menuShow('wait', h('h1', {}, 'Connecting…'));
  let kind: string | undefined;
  try {
    const info = await rpc<any>('server_info');
    kind = info?.server_kind;
  } catch { cantReach(); return; }
  const build = buildKind((import.meta as any).env?.VITE_OREHEART_ENV);
  const bad = mismatch(build, kind);
  if (bad) { wrongServer(); return; }
  serverKind = kind === 'production' ? 'production' : 'test';
  await new Promise((r) => setTimeout(r, 0));
  const { data } = await client().auth.getSession();
  if (recovering) { if (data.session && !setPwShown) showSetPassword(); else if (!data.session) { recovering = false; showLogin(); } return; }
  if (data.session) await afterSignIn(); else showLogin();
}

function offline() {
  net.active = false; net.offlineChosen = true; status = null;
  if (checkTimer) { clearInterval(checkTimer); checkTimer = null; }
  app.showMenu();
}
const offlineBtn = () => nbtn('Play offline (practice)', offline);

function wrongServer() {
  menuShow('wrong-server', h('h1', {}, 'Wrong server'), h('p', {}, 'This copy of the game is connected to the wrong server, so signing in is switched off to keep practice and real accounts apart.'), offlineBtn());
}
function cantReach() {
  menuShow('no-server', h('h1', {}, "Can't reach the server"), h('p', {}, 'Check your internet connection and try again.'),
    h('div', { class: 'net-actions' }, nbtn('Try again', () => { void serverCheck(); }, 'primary'), offlineBtn()));
}

// ------------------------------------------------------------------ login
function showLogin(prefill = '') {
  const email = field('Email', 'login-email', 'email', { autocomplete: 'username' });
  const pw = field('Password', 'login-password', 'password', { autocomplete: 'current-password' });
  email.input.value = prefill;
  const err = alertEl(); const note = noteEl();
  const extra = h('div', { class: 'net-actions' });
  const cap = captchaBox();
  const signIn = h('button', { type: 'submit', class: 'net-btn primary' }, 'Sign in') as HTMLButtonElement;
  async function doSignIn() {
    err.textContent = ''; note.textContent = ''; extra.replaceChildren();
    await busy(signIn, async () => {
      const { error } = await client().auth.signInWithPassword({ email: email.input.value.trim(), password: pw.input.value, options: { captchaToken: cap.token() } });
      cap.reset();
      if (error) {
        if (/not confirmed/i.test(error.message) || (error as any).code === 'email_not_confirmed') {
          err.textContent = 'Please confirm your email first';
          extra.append(nbtn('Send the email again', async () => {
            const r = await client().auth.resend({ type: 'signup', email: email.input.value.trim(), options: { emailRedirectTo: redirectUrl(), captchaToken: cap.token() } });
            cap.reset();
            if (r.error) err.textContent = r.error.message; else { err.textContent = ''; note.textContent = 'We sent the email again.'; }
          }));
        } else if (/invalid login|credentials/i.test(error.message)) err.textContent = 'Wrong email or password.';
        else err.textContent = error.message;
        return;
      }
      await afterSignIn();
    });
  }
  const form = h('form', { class: 'net-form', onsubmit: (e: Event) => { e.preventDefault(); void doSignIn(); } },
    email.wrap, pw.wrap, cap.el, err, note, extra,
    signIn);
  menuShow('login', h('h1', {}, 'Sign in'), form,
    h('div', { class: 'net-grid' }, nbtn('Create account', showAge), nbtn('Forgot password?', showForgot), offlineBtn(), nbtn('Contact us', () => showContact({ back: () => showLogin() }))));
}

// ------------------------------------------------------------------ create account
function showAge() {
  const month = h('select', { id: 'birth-month', class: 'net-input' }, h('option', { value: '' }, 'Month'), ...MONTHS.map((m, i) => h('option', { value: String(i + 1) }, m))) as HTMLSelectElement;
  const y = new Date().getFullYear();
  const year = h('select', { id: 'birth-year', class: 'net-input' }, h('option', { value: '' }, 'Year'), ...Array.from({ length: 101 }, (_, i) => h('option', { value: String(y - i) }, String(y - i)))) as HTMLSelectElement;
  const next = nbtn('Next', () => {
    const saved = savedAgeGroup();
    const group = saved ?? (underThirteen(+month.value, +year.value) ? 'under_13' : '13_plus');
    if (!saved) saveAgeGroup(group);
    showSignUp(group);
  }, 'primary') as HTMLButtonElement;
  next.disabled = true;
  const upd = () => { next.disabled = !(month.value && year.value); };
  month.addEventListener('change', upd); year.addEventListener('change', upd);
  menuShow('age', h('h1', {}, 'When were you born?'),
    h('div', { class: 'net-row' },
      h('div', { class: 'net-field' }, h('label', { for: 'birth-month' }, 'Month'), month),
      h('div', { class: 'net-field' }, h('label', { for: 'birth-year' }, 'Year'), year)),
    h('div', { class: 'net-actions' }, next, nbtn('Back', () => showLogin())));
}

function showSignUp(group: '13_plus' | 'under_13') {
  const kid = group === 'under_13';
  const user = field('Username', 'su-username', 'text', { maxlength: '32', autocapitalize: 'off', spellcheck: 'false' });
  const email = kid
    ? field("Parent or guardian's email", 'su-email', 'email', { 'data-help': "We'll ask your parent or guardian to say yes before you can play online." })
    : field('Email', 'su-email', 'email');
  const pw = field('Password', 'su-password', 'password', { autocomplete: 'new-password' });
  const pw2 = field('Confirm password', 'su-password2', 'password', { autocomplete: 'new-password' });
  pw.msg.textContent = '';
  const err = alertEl();
  const cap = captchaBox();
  let nameOk = false; let seq = 0; let timer: any;
  const create = nbtn('Create account', () => { void submit(); }, 'primary') as HTMLButtonElement;
  const update = () => {
    const pOk = passwordOk(pw.input.value);
    const match = pw.input.value === pw2.input.value;
    pw2.msg.textContent = pw2.input.value && !match ? "Passwords don't match." : '';
    pw.msg.textContent = pw.input.value && !pOk ? 'Use at least 10 characters with a lower case letter, an upper case letter and a number.' : '';
    create.disabled = !(nameOk && pOk && match && pw2.input.value && email.input.value.trim());
  };
  user.input.addEventListener('input', () => {
    nameOk = false; user.msg.textContent = ''; update();
    clearTimeout(timer);
    const v = user.input.value.trim();
    if (!v) return;
    const my = ++seq;
    timer = setTimeout(async () => {
      try {
        const r = await rpc<any>('username_available', { p_username: v });
        if (my !== seq) return;
        nameOk = !!r?.ok; user.msg.textContent = r?.ok ? '' : (r?.problem || 'Please pick a different name.');
      } catch { if (my === seq) user.msg.textContent = "Couldn't check the name right now."; }
      update();
    }, 400);
  });
  for (const f of [pw, pw2, email]) f.input.addEventListener('input', update);
  async function submit() {
    err.textContent = '';
    await busy(create, async () => {
      const { error } = await client().auth.signUp({ email: email.input.value.trim(), password: pw.input.value, options: { data: { username: user.input.value.trim(), age_group: group }, captchaToken: cap.token(), emailRedirectTo: redirectUrl() } });
      cap.reset();
      if (error) {
        if (/database error/i.test(error.message)) { nameOk = false; user.msg.textContent = 'That name is taken.'; }
        else err.textContent = error.message;
        return;
      }
      showCheckEmail(kid, email.input.value.trim());
    });
  }
  update();
  menuShow('signup', h('h1', {}, 'Create account'),
    h('form', { class: 'net-form', onsubmit: (e: Event) => { e.preventDefault(); if (!create.disabled) void submit(); } },
      user.wrap, email.wrap, pw.wrap, pw2.wrap, cap.el, err),
    h('div', { class: 'net-actions' }, create, nbtn('Back', showAge)));
}

function showCheckEmail(kid: boolean, email: string) {
  const note = noteEl(); const err = alertEl();
  const again = nbtn('Send again', async () => {
    err.textContent = ''; note.textContent = '';
    const r = await client().auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectUrl() } });
    if (r.error) err.textContent = r.error.message; else note.textContent = 'We sent the email again.';
  });
  menuShow('check-email',
    h('h1', {}, kid ? 'Ask your parent or guardian to check their email' : 'Check your email'),
    h('p', {}, kid ? 'We sent them two emails: one to confirm the address, one to say yes.' : 'We sent you an email. Open it and press the link to confirm your address, then sign in.'),
    err, note, h('div', { class: 'net-actions' }, again, nbtn('Back to sign in', () => showLogin(email))));
}

// ------------------------------------------------------------------ forgot / set password
function showForgot() {
  const email = field('Email', 'fp-email', 'email');
  const note = noteEl(); const err = alertEl(); const cap = captchaBox();
  const send = nbtn('Send link', () => { void go(); }, 'primary') as HTMLButtonElement;
  async function go() {
    err.textContent = ''; note.textContent = '';
    await busy(send, async () => {
      await client().auth.resetPasswordForEmail(email.input.value.trim(), { redirectTo: redirectUrl(), captchaToken: cap.token() });
      cap.reset();
      note.textContent = 'If that email has an account, we sent a link.';
    });
  }
  menuShow('forgot', h('h1', {}, 'Forgot password'),
    h('form', { class: 'net-form', onsubmit: (e: Event) => { e.preventDefault(); void go(); } }, email.wrap, cap.el, err, note),
    h('div', { class: 'net-actions' }, send, nbtn('Back', () => showLogin())));
}

function showSetPassword() {
  setPwShown = true;
  const pw = field('New password', 'np-password', 'password', { autocomplete: 'new-password' });
  const pw2 = field('Confirm password', 'np-password2', 'password', { autocomplete: 'new-password' });
  const err = alertEl();
  const save = nbtn('Save password', () => { void go(); }, 'primary') as HTMLButtonElement;
  const update = () => {
    const ok = passwordOk(pw.input.value);
    pw.msg.textContent = pw.input.value && !ok ? 'Use at least 10 characters with a lower case letter, an upper case letter and a number.' : '';
    pw2.msg.textContent = pw2.input.value && pw.input.value !== pw2.input.value ? "Passwords don't match." : '';
    save.disabled = !(ok && pw.input.value === pw2.input.value);
  };
  pw.input.addEventListener('input', update); pw2.input.addEventListener('input', update);
  async function go() {
    err.textContent = '';
    await busy(save, async () => {
      const r = await client().auth.updateUser({ password: pw.input.value });
      if (r.error) { err.textContent = r.error.message; return; }
      recovering = false; setPwShown = false;
      history.replaceState(null, '', location.pathname + location.search);
      await afterSignIn();
    });
  }
  update();
  menuShow('set-password', h('h1', {}, 'Set a new password'),
    h('form', { class: 'net-form', onsubmit: (e: Event) => { e.preventDefault(); if (!save.disabled) void go(); } }, pw.wrap, pw2.wrap, err),
    h('div', { class: 'net-actions' }, save));
}

// ------------------------------------------------------------------ after sign-in
async function signOut() {
  if (checkTimer) { clearInterval(checkTimer); checkTimer = null; }
  net.active = false; net.offlineChosen = false; net.decks = []; status = null;
  try { await client().auth.signOut(); } catch { /* ignore */ }
  showLogin();
}

function banScreen(s: Status) {
  const until = s.ban_expires_at ? new Date(s.ban_expires_at) : null;
  menuShow('banned',
    h('h1', {}, until ? `Your account is banned until ${until.toLocaleString()}.` : 'Your account is banned.'),
    s.ban_reason ? h('p', { class: 'net-reason' }, s.ban_reason) : null,
    h('div', { class: 'net-actions' }, nbtn('Sign out', () => { void signOut(); }), offlineBtn()));
}

function waitingScreen(s: Status) {
  const err = alertEl(); const note = noteEl();
  menuShow('waiting', h('h1', {}, 'Waiting for your parent or guardian'),
    h('p', {}, `${s.username} can play online once a parent or guardian has said yes in the email we sent.`),
    err, note,
    h('div', { class: 'net-actions' },
      nbtn('Send the email again', async () => {
        err.textContent = ''; note.textContent = '';
        try { await rpc('resend_parent_consent'); note.textContent = 'We sent the email again.'; } catch (e: any) { err.textContent = e.message; }
      }),
      nbtn('Sign out', () => { void signOut(); }), offlineBtn()));
}

function revokedScreen() {
  menuShow('revoked', h('h1', {}, 'A parent withdrew approval for this account.'),
    h('div', { class: 'net-actions' }, nbtn('Sign out', () => { void signOut(); }), offlineBtn()));
}

function avatarScreen(s: Status) {
  const err = alertEl();
  const grid = h('div', { class: 'net-avatars', role: 'group', 'aria-label': 'Avatars' },
    ...(AVATARS as string[]).filter((id) => CARDS[id]).map((id) => {
      const c = CARDS[id];
      const pic = pictureOf(c);
      return h('button', { type: 'button', class: 'net-avatar', 'aria-label': c.name, title: c.name, onclick: async () => {
        err.textContent = '';
        try { await rpc('set_avatar', { p_card: id }); s.avatar = id; s.needs_avatar = false; welcomeScreen(s); } catch (e: any) { err.textContent = e.message; }
      } }, pic ? h('img', { src: pic, alt: '' }) : h('span', {}, c.name));
    }));
  menuShow('avatar', h('h1', {}, 'Choose your avatar'), err, grid);
}

function welcomeScreen(s: Status) {
  menuShow('welcome', h('h1', {}, `Welcome to the Skullfang Arena, ${s.username}!`), h('p', {}, 'Your starter decks are ready.'),
    h('div', { class: 'net-actions' }, nbtn('Continue', () => {
      try { localStorage.setItem('oreheart.welcomed.' + s.user_id, '1'); } catch { /* ignore */ }
      void proceed(s);
    }, 'primary')));
}

async function refreshDecks() {
  const { data, error } = await client().from('decks').select('id,name,commander,cards,updated_at').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  net.decks = (data || []).map((d: any) => ({ id: d.id, name: d.name, commander: d.commander, cards: Array.isArray(d.cards) ? d.cards : [] } as SavedDeck));
}

async function afterSignIn() {
  const my = ++uid;
  let s: Status;
  try { s = await myStatus(); } catch (e: any) {
    if (/not logged in|jwt|session/i.test(e.message)) { showLogin(); return; }
    cantReach(); return;
  }
  if (my !== uid) return;
  status = s;
  net.under13 = s.age_group === 'under_13';
  if (!checkTimer) checkTimer = setInterval(() => { void recheck(); }, 5 * 60 * 1000);
  await proceed(s);
}

async function recheck() {
  if (!status || net.offlineChosen) return;
  if (app.view && app.root.querySelector('canvas')) return; // never interrupt a match
  try {
    const s = await myStatus();
    if (s.banned || s.consent_status === 'revoked') { net.active = false; status = s; if (s.banned) banScreen(s); else revokedScreen(); }
  } catch { /* ignore */ }
}

async function proceed(s: Status) {
  if (s.banned) { net.active = false; banScreen(s); return; }
  if (s.consent_status === 'pending') { net.active = false; waitingScreen(s); return; }
  if (s.consent_status === 'revoked') { net.active = false; revokedScreen(); return; }
  if (s.needs_avatar) { avatarScreen(s); return; }
  net.offlineChosen = false;
  net.active = true;
  net.saveDeck = async (id, d) => {
    await rpc('save_deck', { p_id: id ?? null, p_name: d.name, p_commander: d.commander || 'grubnak', p_cards: d.cards });
    await refreshDecks();
  };
  net.removeDeck = async (id) => { await rpc('delete_deck', { p_id: id }); await refreshDecks(); };
  try { await refreshDecks(); } catch { net.decks = []; }
  // one-time import of the local decks
  const local = loadLocalDecks();
  if (!s.decks_imported && local.length) {
    try {
      const r = await rpc<any>('import_local_decks', { p_decks: local.map((d) => ({ name: d.name, commander: d.commander || 'grubnak', cards: d.cards })) });
      s.decks_imported = true;
      await refreshDecks().catch(() => {});
      const skipped: any[] = r?.skipped || [];
      menuShow('import', h('h1', {}, `Imported ${r?.imported ?? 0} ${r?.imported === 1 ? 'deck' : 'decks'}`),
        ...skipped.map((k) => h('p', {}, `Skipped ${k.name}: ${k.problem}`)),
        h('div', { class: 'net-actions' }, nbtn('OK', () => app.showMenu(), 'primary')));
      return;
    } catch (e: any) {
      menuShow('import', h('h1', {}, 'Could not import your decks'), h('p', { role: 'alert' }, e.message), h('div', { class: 'net-actions' }, nbtn('OK', () => app.showMenu(), 'primary')));
      return;
    }
  }
  app.showMenu();
}

// ------------------------------------------------------------------ main menu extras (Profile button, offline chip, test bar)
export function menuExtras(el: El) {
  const bar = testBar();
  if (bar) el.append(bar);
  if (net.active && status) el.append(h('button', { type: 'button', class: 'net-btn net-profile-btn', onclick: showProfile }, 'Profile'));
  else if (net.offlineChosen) el.append(h('button', { type: 'button', class: 'net-chip', onclick: () => { void signOut(); } }, 'Offline — Sign in'));
}

function showProfile() {
  const s = status!;
  const card = s.avatar ? CARDS[s.avatar] : null;
  const pic = card ? pictureOf(card) : null;
  const joined = h('p', {}, '');
  menuShow('profile', h('h1', {}, 'Profile'),
    h('div', { class: 'net-profile' },
      pic ? h('img', { class: 'net-avatar-big', src: pic, alt: card?.name || 'Avatar' }) : null,
      h('div', {}, h('p', { class: 'net-username' }, s.username), joined, h('p', {}, 'No online matches yet'))),
    h('div', { class: 'net-actions' },
      nbtn('Contact us', () => showContact({ back: showProfile, email: undefined, player: s.username })),
      nbtn('Sign out', () => { void signOut(); }),
      nbtn('Back', () => app.showMenu())));
  client().auth.getUser().then(({ data }) => {
    const c = data.user?.created_at;
    joined.textContent = c ? `Joined ${new Date(c).toLocaleDateString()}` : '';
    const em = data.user?.email; void em;
  });
  // refresh the name (an admin may have renamed the player)
  myStatus().then((n) => { status = n; (document.querySelector('.net-username') as El | null)?.replaceChildren(n.username); }).catch(() => {});
}

// ------------------------------------------------------------------ Contact us and the parent pages
const TOPICS: [string, string][] = [['parent_request', 'Parent request'], ['delete_account', 'Delete an account'], ['question', 'Question'], ['problem', 'Problem'], ['other', 'Other']];

export function showContact(o: { back?: () => void; player?: string; email?: string } = {}) {
  const topic = h('select', { id: 'ct-topic', class: 'net-input' }, ...TOPICS.map(([v, l]) => h('option', { value: v }, l))) as HTMLSelectElement;
  const message = h('textarea', { id: 'ct-message', class: 'net-input', rows: '4', maxlength: '2000' }) as HTMLTextAreaElement;
  const reply = field('Reply email (optional)', 'ct-reply', 'email');
  const name = field('Your name (optional)', 'ct-name', 'text', { maxlength: '80' });
  const player = field('Player name (optional)', 'ct-player', 'text', { maxlength: '32' });
  if (o.player) player.input.value = o.player;
  if (o.email) reply.input.value = o.email;
  else if (net.active || status) client().auth.getUser().then(({ data }) => { if (data.user?.email && !reply.input.value && !net.under13) reply.input.value = data.user.email; }).catch(() => {});
  const err = alertEl(); const note = noteEl(); const cap = captchaBox();
  const send = nbtn('Send', () => { void go(); }, 'primary') as HTMLButtonElement;
  async function go() {
    err.textContent = ''; note.textContent = '';
    await busy(send, async () => {
      try {
        await rpc('contact_submit', { p_topic: topic.value, p_message: message.value, p_reply_email: reply.input.value.trim() || null, p_name: name.input.value.trim() || null, p_child_username: player.input.value.trim() || null });
        note.textContent = "Thanks, we got your message. If you gave an email, we'll answer from a no-reply address.";
        message.value = '';
      } catch (e: any) { err.textContent = e.message; }
      cap.reset();
    });
  }
  const back = o.back || (() => { location.href = location.origin + location.pathname + location.search.replace(/([?&])contact=1&?/, '$1').replace(/[?&]$/, ''); });
  plainShow('contact', h('h1', {}, 'Contact us'),
    h('form', { class: 'net-form', onsubmit: (e: Event) => { e.preventDefault(); void go(); } },
      h('div', { class: 'net-field' }, h('label', { for: 'ct-topic' }, 'Topic'), topic),
      h('div', { class: 'net-field' }, h('label', { for: 'ct-message' }, 'Message'), message),
      reply.wrap, name.wrap, player.wrap, cap.el, err, note),
    h('div', { class: 'net-actions' }, send, nbtn('Back', back)));
}

async function showPage(kind: 'consent' | 'withdraw' | 'contact') {
  if (kind === 'contact') { showContact(); return; }
  const p = new URLSearchParams(location.search);
  const token = (kind === 'consent' ? p.get('parent_consent') : p.get('parent_withdraw')) || '';
  const contactBtn = (player?: string) => nbtn('Contact us', () => showContact({ player, back: () => { void showPage(kind); } }));
  plainShow('parent', h('p', {}, 'Loading…'));
  const invalid = () => plainShow('parent', h('h1', {}, 'Oreheart'), h('p', {}, 'This link is not valid any more.'), h('div', { class: 'net-actions' }, contactBtn()));
  if (kind === 'withdraw') {
    const err = alertEl();
    let user: string | undefined;
    const wb = nbtn('Withdraw approval', async () => {
      err.textContent = '';
      try {
        const r = await rpc<any>('parent_revoke_consent', { p_token: token });
        user = r?.username;
        plainShow('parent', h('h1', {}, 'Withdraw approval'), h('p', {}, "Done. The account can't play online any more. To delete it, use the Contact us form."), h('div', { class: 'net-actions' }, contactBtn(user)));
      } catch { invalid(); }
    }, 'primary');
    plainShow('parent', h('h1', {}, 'Withdraw approval'), h('p', {}, 'Press the button to withdraw your approval for this Oreheart account.'), err, h('div', { class: 'net-actions' }, wb, contactBtn()));
    return;
  }
  let info: any;
  try { info = await rpc<any>('parent_consent_info', { p_token: token }); } catch { invalid(); return; }
  const user: string | undefined = info?.username;
  if (info?.status === 'expired') { plainShow('parent', h('h1', {}, 'Oreheart'), h('p', {}, 'This link has expired. Ask your child to press Send again in the game.'), h('div', { class: 'net-actions' }, contactBtn(user))); return; }
  if (!info || info.status !== 'pending') { invalid(); return; }
  const contactUrl = location.origin + location.pathname + '?contact=1';
  const fill = (t: string) => t.split('{username}').join(user || '').split('{contact_url}').join(contactUrl);
  // The link at the end of a sentence is drawn by the style sheet (the sentence's own full stop goes with it).
  const fillNodes = (t: string): (string | El)[] => fill(t.replace(/\{contact_url\}\./g, '\u0001')).split('\u0001').flatMap((part, i, arr) => (i < arr.length - 1 ? [part, h('a', { class: 'net-cu', href: contactUrl, 'data-url': contactUrl, 'data-end': '.' })] : [part]));
  const draft = /-draft$/.test((parentNotice as any).version);
  const box = h('input', { type: 'checkbox', id: 'parent-agree' }) as HTMLInputElement;
  const approve = nbtn('Approve', async () => {
    err.textContent = '';
    try {
      await rpc('parent_give_consent', { p_token: token, p_agree: true });
      plainShow('parent', h('h1', {}, 'Oreheart'), h('p', {}, `Thank you. ${user} can now play online. We sent you a confirmation email with a link to withdraw at any time.`), h('div', { class: 'net-actions' }, contactBtn(user)));
    } catch (e: any) { if (/expired/i.test(e.message)) plainShow('parent', h('h1', {}, 'Oreheart'), h('p', {}, 'This link has expired. Ask your child to press Send again in the game.'), contactBtn(user)); else if (/valid/i.test(e.message)) invalid(); else err.textContent = e.message; }
  }, 'primary') as HTMLButtonElement;
  approve.disabled = true;
  box.addEventListener('change', () => { approve.disabled = !box.checked; });
  const err = alertEl();
  plainShow('parent',
    h('h1', {}, `${user} would like an Oreheart account`),
    draft ? h('p', { class: 'net-draft' }, 'DRAFT – lawyer review before launch') : null,
    h('h2', {}, fill((parentNotice as any).title)),
    ...((parentNotice as any).sections as { heading: string; text: string }[]).map((s) => h('section', { class: 'net-section' }, h('h3', {}, fill(s.heading)), h('p', {}, ...fillNodes(s.text)))),
    h('label', { class: 'net-check', for: 'parent-agree' }, box, h('span', {}, "I am this child's parent or guardian and I agree")),
    err, h('div', { class: 'net-actions' }, approve, contactBtn(user)));
}

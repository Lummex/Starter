// Login, then forced 2-step: enrol an authenticator the first time, enter a code every time.
import { client, messageOf } from '../supabase';
import { busy, h, mount, notice } from '../ui';
import { captchaBox } from '../captcha';

function card(title: string, ...body: Node[]) {
  return h('main', { class: 'auth' },
    h('section', { class: 'card auth-card' },
      h('h1', { class: 'brand' }, 'Oreheart Back Counter'),
      h('h2', {}, title),
      ...body));
}

export function loginPage(onDone: () => void) {
  const n = notice();
  const email = h('input', { type: 'email', name: 'email', autocomplete: 'username', required: true, 'data-testid': 'login-email' });
  const password = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true, 'data-testid': 'login-password' });
  const captcha = captchaBox();
  const form = h('form', { class: 'stack' },
    h('label', {}, 'Email', email),
    h('label', {}, 'Password', password),
    captcha.enabled ? captcha.el : null,
    h('button', { type: 'submit', class: 'primary', 'data-testid': 'login-submit' }, 'Sign in'),
    n.el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    n.clear();
    if (captcha.enabled && !captcha.token()) { n.error('Please finish the "I am human" check first.'); return; }
    await busy(form, async () => {
      const { error } = await client().auth.signInWithPassword({
        email: email.value.trim(), password: password.value, options: { captchaToken: captcha.token() },
      });
      captcha.reset();
      if (error) { n.error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : messageOf(error)); return; }
      password.value = '';
      onDone();
    });
  });
  mount(card('Sign in', form, h('p', { class: 'small' }, 'Admins only. Every action is recorded.')));
  email.focus();
}

function codeInput() {
  return h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]{6}', maxlength: 6,
    required: true, placeholder: '123456', class: 'code', 'data-testid': 'mfa-code' });
}

/** First time: show a QR code to scan, then check one code. */
export async function enrolPage(onDone: () => void, onSignOut: () => void) {
  const auth = client().auth;
  const n = notice();
  // Remove half-finished enrolments from earlier visits, so the QR code is always fresh.
  const { data: list } = await auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.factor_type === 'totp' && f.status !== 'verified') await auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await auth.mfa.enroll({ factorType: 'totp', friendlyName: `Back counter ${new Date().toISOString().slice(0, 16)}` });
  if (error || !data) {
    mount(card('2-step setup', h('p', { class: 'notice error' }, messageOf(error ?? 'Could not start 2-step setup.')),
      h('button', { type: 'button', onclick: onSignOut }, 'Sign out')));
    return;
  }
  // The QR code arrives as an SVG data URL; re-encode it so characters like # can't cut it short.
  const qr = data.totp.qr_code;
  const svgPrefix = qr.match(/^data:image\/svg\+xml(;[^,]*)?,/)?.[0];
  const qrSrc = svgPrefix && !/;base64,$/.test(svgPrefix) && /[<#]/.test(qr.slice(svgPrefix.length))
    ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qr.slice(svgPrefix.length))
    : qr;
  const code = codeInput();
  const form = h('form', { class: 'stack' },
    h('label', {}, 'Code from the app', code),
    h('button', { type: 'submit', class: 'primary', 'data-testid': 'mfa-submit' }, 'Turn on 2-step'),
    n.el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    n.clear();
    await busy(form, async () => {
      const r = await auth.mfa.challengeAndVerify({ factorId: data.id, code: code.value.trim() });
      if (r.error) { n.error('That code did not work. Wait for the next one and try again.'); return; }
      onDone();
    });
  });
  mount(card('Turn on 2-step login',
    h('p', {}, 'The back counter needs 2-step login. Scan this with an authenticator app (Google Authenticator, 1Password, Authy), then type the 6-digit code.'),
    h('img', { src: qrSrc, alt: '2-step QR code', class: 'qr', width: 200, height: 200, 'data-testid': 'mfa-qr' }),
    h('p', { class: 'small' }, 'Can\'t scan? Type this key instead:'),
    h('code', { class: 'secret', 'data-testid': 'mfa-secret' }, data.totp.secret),
    form,
    h('p', { class: 'small' }, 'Tip: add the same QR code on a second device as a backup. There are no recovery codes.'),
    h('button', { type: 'button', class: 'link', onclick: onSignOut }, 'Sign out')));
  code.focus();
}

/** Every login: ask for the current code. */
export function challengePage(factorId: string, onDone: () => void, onSignOut: () => void) {
  const auth = client().auth;
  const n = notice();
  const code = codeInput();
  const form = h('form', { class: 'stack' },
    h('label', {}, '6-digit code', code),
    h('button', { type: 'submit', class: 'primary', 'data-testid': 'mfa-submit' }, 'Check code'),
    n.el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    n.clear();
    await busy(form, async () => {
      const r = await auth.mfa.challengeAndVerify({ factorId, code: code.value.trim() });
      if (r.error) { n.error('That code did not work. Try the next one.'); code.select(); return; }
      onDone();
    });
  });
  mount(card('2-step login', h('p', {}, 'Open your authenticator app and type the code for Oreheart.'), form,
    h('button', { type: 'button', class: 'link', onclick: onSignOut }, 'Sign out')));
  code.focus();
}

export function notAdminPage(onSignOut: () => void) {
  mount(card('Not an admin',
    h('p', { 'data-testid': 'not-admin' }, 'This account is not an admin, so the back counter is closed to it.'),
    h('button', { type: 'button', class: 'primary', onclick: onSignOut }, 'Sign out')));
}

export function notConfiguredPage() {
  mount(card('Not set up yet',
    h('p', { 'data-testid': 'not-configured' }, 'This site has no Supabase project yet. In Vercel (project oreheart-admin) add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then redeploy.')));
}

export function wrongServerPage(message: string) {
  mount(card('Wrong server', h('p', { class: 'notice error', 'data-testid': 'wrong-server' }, message)));
}

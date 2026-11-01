// Cloudflare Turnstile captcha. When the Supabase project has captcha switched on,
// it is required for every password sign-in, so the admin login needs it too.
// Only used when VITE_TURNSTILE_SITE_KEY is set (public by design); otherwise nothing loads.
import { h } from './ui';

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

interface Turnstile {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id?: string): void;
}
declare global { interface Window { turnstile?: Turnstile } }

let loading: Promise<void> | null = null;
function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Captcha could not load.'));
    document.head.append(s);
  });
  return loading;
}

/** A captcha box for a form. token() is undefined until solved; reset() after every attempt (tokens are single-use). */
export function captchaBox() {
  let token: string | undefined;
  let id: string | undefined;
  const el = h('div', { class: 'captcha', 'data-testid': 'captcha' });
  if (siteKey) {
    load().then(() => {
      id = window.turnstile!.render(el, {
        sitekey: siteKey, theme: 'dark',
        callback: (t: string) => { token = t; },
        'expired-callback': () => { token = undefined; },
        'error-callback': () => { token = undefined; },
      });
    }).catch((e: Error) => { el.textContent = e.message; });
  }
  return {
    el,
    enabled: Boolean(siteKey),
    token: () => token,
    reset() { token = undefined; if (id && window.turnstile) window.turnstile.reset(id); },
  };
}

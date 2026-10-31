// The online switch: online only when the build has the Supabase settings, and never in plain ?test=1 mode.
export function isOnlineEnabled(url: unknown, key: unknown, search: string): boolean {
  const p = new URLSearchParams(search);
  const test = p.get('test') === '1';
  const online = p.get('online') === '1';
  return Boolean(url && key) && !(test && !online);
}
const env = (import.meta as any).env || {};
export const SUPABASE_URL = env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const configured = Boolean(SUPABASE_URL && SUPABASE_KEY);
// Automated browsers (WebDriver / headless) that did not ask for ?online=1 get the plain offline game, like ?test=1.
const automated = typeof navigator !== 'undefined' && (navigator.webdriver === true || /Headless|Playwright/i.test(navigator.userAgent || ''));
const search = typeof location !== 'undefined' ? location.search : '';
export const onlineEnabled = isOnlineEnabled(SUPABASE_URL, SUPABASE_KEY, search) && !(automated && new URLSearchParams(search).get('online') !== '1');
/** Parent and Contact pages (opened from emails) work whenever the build is configured. */
export function pageMode(search: string): 'consent' | 'withdraw' | 'contact' | null {
  if (!configured) return null;
  const p = new URLSearchParams(search);
  if (p.get('parent_consent')) return 'consent';
  if (p.get('parent_withdraw')) return 'withdraw';
  if (p.get('contact') === '1') return 'contact';
  return null;
}

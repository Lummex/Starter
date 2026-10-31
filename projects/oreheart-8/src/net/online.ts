// Online layer: the Supabase client (public URL + publishable key only), server calls and error texts.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, configured, onlineEnabled } from './switch';
export { onlineEnabled, configured };

export const sb: SupabaseClient | null = configured
  ? createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'oreheart-auth' } })
  : null;

export function client(): SupabaseClient {
  if (!sb) throw new Error('Online play is not set up for this build.');
  return sb;
}

/** Calls a server function; throws an Error with the server's message. */
export async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(error.message || 'Something went wrong.');
  return data as T;
}

/** Address of this page without the hash, keeping the query (so ?test=1&online=1 survives an email link). */
export const redirectUrl = () => location.origin + location.pathname + location.search.replace(/([?&])(parent_consent|parent_withdraw|contact)=[^&]*&?/g, '$1').replace(/[?&]$/, '');

export interface Status {
  user_id: string; username: string; avatar: string | null; needs_avatar: boolean; age_group: string;
  consent_status: string; decks_imported: boolean; coins: number; banned: boolean; ban_expires_at: string | null; ban_reason: string | null;
}
export const myStatus = () => rpc<Status>('my_status');

/** Username rules / password rule shared by the forms. */
export const passwordOk = (p: string) => p.length >= 10 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p);

export function underThirteen(month: number, year: number, now = new Date()): boolean {
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  return months < 13 * 12;
}

const GATE = 'oreheart.ageGate';
export function savedAgeGroup(now = Date.now()): '13_plus' | 'under_13' | null {
  try {
    const v = JSON.parse(localStorage.getItem(GATE) || 'null');
    if (v && (v.group === '13_plus' || v.group === 'under_13') && typeof v.at === 'number' && now - v.at < 24 * 3600 * 1000) return v.group;
  } catch { /* ignore */ }
  return null;
}
export function saveAgeGroup(group: '13_plus' | 'under_13') {
  try { localStorage.setItem(GATE, JSON.stringify({ group, at: Date.now() })); } catch { /* storage unavailable */ }
}

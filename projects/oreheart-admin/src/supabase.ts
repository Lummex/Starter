import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Both values are public by design (project URL + publishable key). The real
// lock is on the server: every admin function checks admin role + 2-step login.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const configured = Boolean(url && key);

export const sb: SupabaseClient | null = configured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'oreheart-admin-auth' },
    })
  : null;

export function client(): SupabaseClient {
  if (!sb) throw new Error('Supabase is not set up for this site.');
  return sb;
}

/** Turns a Supabase/Postgres error into a short message for the screen. */
export function messageOf(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/2-step login required/i.test(m)) return 'This needs your 2-step login. Sign in again.';
  if (/not admin/i.test(m)) return 'This account has no admin access.';
  return m;
}

/** Calls a server function and throws a readable error if it fails. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(messageOf(error));
  return data as T;
}

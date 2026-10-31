// Test vs production. Each build says which server it is meant for
// (VITE_OREHEART_ENV = "production" on the real site, "test" on previews/local),
// and each database says what it is (server_info().server_kind). If they differ,
// the site refuses to work, so practice data and real players never mix.

export type ServerKind = 'production' | 'test';

export function buildKind(raw: string | undefined): ServerKind {
  return raw === 'production' ? 'production' : 'test';
}

/** null when OK, otherwise the message to show. */
export function mismatch(build: ServerKind, server: string | undefined | null): string | null {
  const s = server === 'production' ? 'production' : server === 'test' ? 'test' : null;
  if (!s) return 'The server did not say whether it is the test or the real server.';
  if (s === build) return null;
  return build === 'production'
    ? 'This is the real site, but it is connected to the TEST server. Fix VITE_SUPABASE_URL in Vercel (Production).'
    : 'This is a test site, but it is connected to the REAL server. Fix VITE_SUPABASE_URL in Vercel (Preview).';
}

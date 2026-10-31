import { defineConfig } from 'vite';
// Same security headers as vercel.json, so the local preview/dev server sends them too.
const headers = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; img-src 'self' data:; frame-src https://challenges.cloudflare.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
// No source maps in the build: the admin site's code is public anyway, but there is no need to hand out a map.
export default defineConfig({
  base: '/',
  build: { sourcemap: false },
  preview: { headers },
  // The dev server needs inline scripts/styles for hot reload, so it only gets the non-CSP headers.
  server: { headers: Object.fromEntries(Object.entries(headers).filter(([k]) => k !== 'Content-Security-Policy')) },
});

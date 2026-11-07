// `stripe-checkout` (Anvil-online, Nov 6): the game asks for a Stripe-hosted Checkout Session for one Oreshard bundle.
// POST { bundle, origin } with the player's JWT -> { ok, url } (the player is sent to Stripe's own page; card details never touch us).
// The database does the player checks (ban, parent consent, agreement, the on/off switch, the bundle) in oreshard_checkout_start,
// Stripe makes the session, and oreshard_checkout_link remembers its id. Oreshards are credited ONLY by the stripe-webhook function.
// Secrets (Supabase function secrets, pasted by Ken, never in code or chat): STRIPE_SECRET_KEY (a restricted key of the Oreheart TEST
// sandbox: Checkout Sessions write, Customers write). SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY come from the platform.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@23.1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const API_VERSION = '2026-10-28.endive';

const CORS: Record<string, string> = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-region', 'access-control-allow-methods': 'POST, OPTIONS' };
const json = (code: number, body: unknown) => new Response(JSON.stringify(body), { status: code, headers: { ...CORS, 'content-type': 'application/json' } });

/** Where Stripe sends the player back: the game's own origins only (never a URL the request could point elsewhere). */
function allowedOrigin(o: unknown): string | null {
  const s = String(o || '').trim();
  if (!/^https?:\/\/[A-Za-z0-9.:-]+$/.test(s)) return null;
  try {
    const u = new URL(s);
    const host = u.hostname;
    if (u.protocol === 'https:' && (host === 'oreheart.cards' || host === 'www.oreheart.cards' || host === 'guardianstargames.com' || host === 'www.guardianstargames.com')) return u.origin;
    if (u.protocol === 'https:' && /^oreheart-8(-[a-z0-9]+)?(-lummex)?\.vercel\.app$/.test(host)) return u.origin;
    if (u.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1')) return u.origin; // the local checks
  } catch { /* not a URL */ }
  return null;
}

/** eight random letters for Stripe's integration_identifier (the Dashboard groups sessions by it) */
function letters(n = 8): string {
  const a = 'abcdefghijklmnopqrstuvwxyz', u = new Uint8Array(n); crypto.getRandomValues(u);
  return Array.from(u, (x) => a[x % 26]).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
  if (!STRIPE_KEY) return json(500, { ok: false, error: 'The shop is not set up yet (no Stripe key on this server).' });
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(auth)) return json(401, { ok: false, error: 'not signed in' });
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: whoErr } = await asUser.auth.getUser();
  if (whoErr || !who?.user) return json(401, { ok: false, error: 'not signed in' });

  let body: any = {};
  try { const t = await req.text(); if (t.length > 2000) return json(413, { ok: false, error: 'too big' }); body = t ? JSON.parse(t) : {}; } catch { return json(400, { ok: false, error: 'bad JSON' }); }
  const bundle = String(body.bundle || '');
  if (!/^[a-z][a-z0-9-]{1,19}$/.test(bundle)) return json(400, { ok: false, error: 'Pick a bundle.' });
  const origin = allowedOrigin(body.origin);
  if (!origin) return json(400, { ok: false, error: 'This page cannot start a purchase.' });

  // 1. the player's checks and the purchase row, as the player
  const start = await asUser.rpc('oreshard_checkout_start', { p_bundle: bundle });
  if (start.error) return json(200, { ok: false, error: start.error.message });
  const s: any = start.data || {};
  const b = s.bundle || {};
  const purchaseId = String(s.purchase_id || '');
  if (!purchaseId) return json(500, { ok: false, error: 'no purchase row' });

  // 2. Stripe: a customer for the player (once), then the hosted Checkout Session
  const stripe = new Stripe(STRIPE_KEY, { apiVersion: API_VERSION as any, appInfo: { name: 'Oreheart Online', version: 'nov6' } });
  let customer: string | null = s.stripe_customer_id ? String(s.stripe_customer_id) : null;
  try {
    if (!customer) {
      const c = await stripe.customers.create({ email: s.email ? String(s.email) : undefined, name: s.username ? String(s.username) : undefined, metadata: { user_id: who.user.id } });
      customer = c.id;
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer,
      client_reference_id: who.user.id,
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Number(b.usd_cents) | 0, product_data: { name: String(b.name || 'Oreshards'), description: `${Number(b.oreshards) | 0} Oreshards for Oreheart${Number(b.bonus_pct) > 0 ? ` (+${Number(b.bonus_pct)}% bonus)` : ''}. Oreshards are not refundable and have no cash value.` } } }],
      metadata: { purchase_id: purchaseId, user_id: who.user.id, bundle, oreshards: String(Number(b.oreshards) | 0) },
      payment_intent_data: { metadata: { purchase_id: purchaseId, user_id: who.user.id, bundle } },
      success_url: `${origin}/?oreshards=paid&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?oreshards=cancel`,
      integration_identifier: 'oreheart-oreshards-' + letters(),
    } as any);
    // 3. remember the session on the purchase (the webhook finds the purchase by this id)
    const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const link = await svc.rpc('oreshard_checkout_link', { p_purchase: purchaseId, p_session: session.id, p_customer: customer });
    if (link.error) { console.error('oreshard_checkout_link', link.error.message); return json(500, { ok: false, error: 'could not record the purchase' }); }
    return json(200, { ok: true, url: session.url, session_id: session.id, bundle: { id: bundle, name: b.name, usd_cents: b.usd_cents, oreshards: b.oreshards } });
  } catch (e: any) {
    console.error('stripe-checkout', e?.type || '', e?.code || '', e?.message || String(e)); // never the key, never card data (there is none here)
    const msg = e?.type === 'StripePermissionError' ? 'The shop key is missing a permission (Checkout Sessions or Customers write).' : 'Stripe could not start the payment right now.';
    return json(200, { ok: false, error: msg });
  }
});

// `stripe-webhook` (Anvil-online, Nov 6): Stripe tells us what happened to a payment; this is the ONLY place Oreshards are credited.
// Stripe POSTs signed events here (no player JWT: config.toml sets verify_jwt = false; the Stripe signature is the proof).
//   checkout.session.completed / checkout.session.async_payment_succeeded, payment_status 'paid' -> oreshard_credit (once per session)
//   checkout.session.async_payment_failed                                                     -> oreshard_fail
//   charge.refunded                                                                           -> oreshard_reverse('refund')
//   charge.dispute.created                                                                    -> oreshard_reverse('dispute')
// Every event id is recorded first (stripe_event_begin), so a repeated delivery is skipped; the credit itself is also idempotent on the
// session id. Secrets: STRIPE_WEBHOOK_SECRET (the endpoint's signing secret, pasted by Ken), STRIPE_SECRET_KEY (only to look a
// session up again when the event carries no payment intent), SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the platform.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@23.1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const API_VERSION = '2026-10-28.endive';

const json = (code: number, body: unknown) => new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json' } });
const stripe = new Stripe(STRIPE_KEY || 'rk_unset', { apiVersion: API_VERSION as any });
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const idOf = (x: unknown): string | null => (typeof x === 'string' ? x : x && typeof x === 'object' && typeof (x as any).id === 'string' ? (x as any).id : null);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
  if (!WEBHOOK_SECRET) { console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET is not set'); return json(500, { ok: false, error: 'webhook secret not set' }); }
  const sig = req.headers.get('stripe-signature') || '';
  const raw = await req.text();
  if (raw.length > 500_000) return json(413, { ok: false, error: 'too big' });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (e: any) {
    console.error('stripe-webhook: bad signature', e?.message || String(e));
    return json(400, { ok: false, error: 'bad signature' });
  }
  if (event.livemode) { console.error('stripe-webhook: a LIVE event reached the TEST server', event.id); return json(400, { ok: false, error: 'live events are not accepted here' }); }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const begin = await db.rpc('stripe_event_begin', { p_event_id: event.id, p_type: event.type });
  if (begin.error) { console.error('stripe_event_begin', begin.error.message); return json(500, { ok: false, error: 'database' }); }
  if (begin.data !== true) return json(200, { ok: true, repeat: true });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.payment_status !== 'paid') return json(200, { ok: true, waiting: s.payment_status }); // a delayed method: the paid event comes later
        const r = await db.rpc('oreshard_credit', { p_session: s.id, p_payment_intent: idOf(s.payment_intent), p_amount_cents: s.amount_total ?? null, p_currency: s.currency ?? 'usd', p_customer: idOf(s.customer), p_event_id: event.id });
        if (r.error) throw new Error(r.error.message);
        if (r.data && r.data.ok === false) console.error('oreshard_credit refused', JSON.stringify(r.data));
        return json(200, { ok: true, ...(r.data || {}) });
      }
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const r = await db.rpc('oreshard_fail', { p_session: s.id });
        if (r.error) throw new Error(r.error.message);
        return json(200, { ok: true, failed: r.data === true });
      }
      case 'charge.refunded': {
        const c = event.data.object as Stripe.Charge;
        const pi = idOf(c.payment_intent);
        if (!pi) return json(200, { ok: true, skipped: 'no payment intent' });
        const r = await db.rpc('oreshard_reverse', { p_payment_intent: pi, p_kind: 'refund', p_amount_cents: c.amount_refunded ?? null, p_event_id: event.id });
        if (r.error) throw new Error(r.error.message);
        return json(200, { ok: true, ...(r.data || {}) });
      }
      case 'charge.dispute.created': {
        const d = event.data.object as Stripe.Dispute;
        const pi = idOf(d.payment_intent);
        if (!pi) return json(200, { ok: true, skipped: 'no payment intent' });
        const r = await db.rpc('oreshard_reverse', { p_payment_intent: pi, p_kind: 'dispute', p_amount_cents: d.amount ?? null, p_event_id: event.id });
        if (r.error) throw new Error(r.error.message);
        return json(200, { ok: true, ...(r.data || {}) });
      }
      default:
        return json(200, { ok: true, ignored: event.type });
    }
  } catch (e: any) {
    console.error('stripe-webhook', event.type, e?.message || String(e));
    try { await db.rpc('stripe_event_forget', { p_event_id: event.id }); } catch { /* the row stays; Ken sees the error in the logs */ }
    return json(500, { ok: false, error: 'handler failed' }); // a 5xx makes Stripe retry, and the event is forgotten so the retry is handled
  }
});

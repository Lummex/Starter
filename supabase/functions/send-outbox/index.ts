// Sends queued emails from public.email_outbox. Called every minute by pg_cron, with the project's secret key.
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (n: string) => Deno.env.get(n) ?? '';
const SB_URL = env('SUPABASE_URL');
const SECRET = env(['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_'));
const KEY_LISTS = [env('SB_SECRET_KEYS'), env('SUPABASE_SECRET_KEYS')];

function validKeys(): string[] {
  const out: string[] = [];
  if (SECRET) out.push(SECRET);
  for (const raw of KEY_LISTS) {
    if (!raw) continue;
    try {
      const v = JSON.parse(raw);
      if (typeof v === 'string') out.push(v);
      else if (Array.isArray(v)) for (const x of v) { if (typeof x === 'string') out.push(x); else if (x && typeof x.api_key === 'string') out.push(x.api_key); }
      else if (v && typeof v === 'object') for (const x of Object.values(v)) if (typeof x === 'string') out.push(x);
    } catch { for (const x of raw.split(',')) if (x.trim()) out.push(x.trim()); }
  }
  return out.filter(Boolean);
}

function same(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let d = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) d |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return d === 0;
}

function authorized(req: Request): boolean {
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const api = req.headers.get('apikey') ?? '';
  if (!bearer || !api) return false;
  let ok = false;
  for (const k of validKeys()) {
    const a = same(bearer, k), b = same(api, k);
    if (a && b) ok = true;
  }
  return ok;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TOPICS: Record<string, string> = {
  parent_request: 'a parent request', delete_account: 'deleting an account', question: 'a question', problem: 'a problem', other: 'your message',
};

function build(kind: string, p: Record<string, unknown>, site: string): { subject: string; lines: string[] } | null {
  const user = String(p.username ?? 'your child');
  const base = site.replace(/\/+$/, '');
  switch (kind) {
    case 'parent_consent_request':
      return {
        subject: 'Oreheart: please approve your child\'s account',
        lines: [
          `Someone signed up for Oreheart (a card game) with the player name "${user}" and said you are their parent or guardian.`,
          'Notice: Oreheart stores a player name, the birth year they entered, their sign-in email, their saved decks and game settings. It shows no ads, has no chat, and shares nothing with other companies. You can withdraw approval at any time.',
          `To approve, open: ${base}/?parent_consent=${encodeURIComponent(String(p.token ?? ''))}`,
          'This link expires in 7 days. If you do not recognise this, ignore this email and the account will not be activated.',
        ],
      };
    case 'parent_consent_confirmed':
      return {
        subject: 'Oreheart: approval received',
        lines: [
          `Thank you. The account "${user}" is now approved.`,
          `To withdraw your approval at any time, open: ${base}/?parent_withdraw=${encodeURIComponent(String(p.revoke_token ?? ''))}`,
        ],
      };
    case 'parent_consent_revoked':
      return {
        subject: 'Oreheart: approval withdrawn',
        lines: [`Your approval for the account "${user}" has been withdrawn. The account can no longer be used.`],
      };
    case 'contact_reply': {
      const topic = TOPICS[String(p.topic ?? '')] ?? 'your message';
      return { subject: 'Oreheart: reply to your message', lines: [`About ${topic}:`, '', String(p.reply ?? '')] };
    }
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);

  const site = env('SITE_URL');
  const from = env('EMAIL_FROM');
  const resendKey = env('RESEND_API_KEY');
  const logMode = env('OUTBOX_MODE') === 'log';
  const db = createClient(SB_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: rows, error } = await db.from('email_outbox')
    .select('id, to_email, kind, payload, attempts')
    .is('sent_at', null).lt('attempts', 5).order('id', { ascending: true }).limit(50);
  if (error) return json({ error: error.message }, 500);

  let sent = 0, failed = 0;
  for (const row of rows ?? []) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    try {
      const mail = build(row.kind, payload, site);
      if (!mail) throw new Error('unknown kind ' + row.kind);
      if (!row.to_email) throw new Error('no recipient');
      const footer = `This address can't receive replies — use the Contact us form: ${site.replace(/\/+$/, '')}/?contact=1`;
      const text = [...mail.lines, '', footer].join('\n');
      if (logMode) {
        console.log(JSON.stringify({ outbox: row.id, to: row.to_email, kind: row.kind, subject: mail.subject, text }));
      } else {
        if (!resendKey || !from || !site) throw new Error('RESEND_API_KEY, EMAIL_FROM and SITE_URL must be set');
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from, to: [row.to_email], subject: mail.subject, text,
            html: mail.lines.concat(['', footer]).map((l) => `<p>${esc(l).replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`).join(''),
          }),
        });
        if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
      }
      const clean = { ...payload }; delete clean.token; delete clean.revoke_token;
      clean.sent_at = new Date().toISOString();
      const { error: ue } = await db.from('email_outbox')
        .update({ sent_at: new Date().toISOString(), payload: clean, last_error: null }).eq('id', row.id);
      if (ue) throw new Error('update failed: ' + ue.message);
      sent++;
    } catch (e) {
      failed++;
      await db.from('email_outbox')
        .update({ attempts: (row.attempts ?? 0) + 1, last_error: String((e as Error).message ?? e).slice(0, 500) }).eq('id', row.id);
    }
  }
  return json({ sent, failed });
});

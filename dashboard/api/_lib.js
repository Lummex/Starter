// Shared helpers for the dashboard API: auth cookie + GitHub calls.
import crypto from 'node:crypto';

export const STATUS_LABELS = [
  'factory:new', 'factory:building', 'factory:needs-info', 'factory:review',
  'factory:revise', 'factory:approved', 'factory:shipping', 'factory:shipped', 'factory:failed',
];

const COOKIE = 'factory_session';

function sessionToken() {
  const pw = process.env.DASHBOARD_PASSWORD || '';
  return crypto.createHmac('sha256', pw).update('factory-session-v1').digest('hex');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function checkPassword(pw) {
  const real = process.env.DASHBOARD_PASSWORD;
  return Boolean(real) && safeEqual(pw || '', real);
}

export function setSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=${sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export function isAuthed(req) {
  if (!process.env.DASHBOARD_PASSWORD) return false;
  const raw = req.headers.cookie || '';
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  return Boolean(m) && safeEqual(m.slice(COOKIE.length + 1), sessionToken());
}

// Wraps a handler: requires login, JSON errors, no caching.
export function guarded(handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isAuthed(req)) return res.status(401).json({ error: 'Please log in.' });
    const missing = ['GITHUB_TOKEN', 'GITHUB_REPO'].filter((k) => !process.env[k]);
    if (missing.length) return res.status(500).json({ error: `Dashboard setup incomplete: missing ${missing.join(', ')} in Vercel settings.` });
    try {
      await handler(req, res);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'Something went wrong.' });
    }
  };
}

export async function gh(method, endpoint, body) {
  const res = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${process.env.GITHUB_REPO}/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'software-factory-dashboard',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`GitHub said: ${data?.message || res.statusText} (${res.status})`);
    err.status = res.status === 401 || res.status === 403 ? 502 : res.status;
    throw err;
  }
  return data;
}

export function statusOf(issue) {
  const names = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  // Later entries in STATUS_LABELS are later stages; pick the furthest one present.
  return [...STATUS_LABELS].reverse().find((s) => names.includes(s))?.replace('factory:', '') || 'new';
}

export function parseMarker(body) {
  const m = /<!-- factory:(\{.*?\}) -->/s.exec(body || '');
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export function stripMarker(body) {
  return (body || '').replace(/\n*<!-- factory:\{.*?\} -->/s, '').trim();
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

import { checkPassword, setSession, clearSession, readJson } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'DELETE') { clearSession(res); return res.status(200).json({ ok: true }); }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.DASHBOARD_PASSWORD) return res.status(500).json({ error: 'DASHBOARD_PASSWORD is not set in Vercel yet.' });
  const { password } = await readJson(req);
  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    return res.status(401).json({ error: 'Wrong password.' });
  }
  setSession(res);
  res.status(200).json({ ok: true });
}

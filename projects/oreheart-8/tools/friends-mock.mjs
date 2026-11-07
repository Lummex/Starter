// Friends on the local mock server (Anvil-online, Nov 7): the same rules as supabase/migrations/20261107000001_friends.sql, in memory,
// so two browser pages can add each other, challenge and play without Supabase. Never deployed; the real rules live in SQL.
// POST /friends {op, ...} with the x-mock-user header. Ops: overview, request {who}, respond {id, accept}, remove {id}, block {id},
// unblock {id}, invite {id, code, mode, region}, invite_respond {invite, accept}, invite_cancel {invite}.
import { randomUUID } from 'node:crypto';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_MS = 60_000;
const ONLINE_MS = 120_000;

export function makeFriends(store, users) {
  const codes = new Map();   // userId -> friend code
  const pairs = new Map();   // "a|b" (sorted) -> { a, b, status, by, at }
  const invites = new Map(); // id -> { id, from, to, code, mode, region, status, expires }
  const seen = new Map();    // userId -> last call (ms)
  store.blocks = store.blocks || new Set(); // "blocker|blocked"; the store's claimRoom reads it
  const key = (x, y) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const codeOf = (id) => { if (!codes.has(id)) { let c; do { c = Array.from({ length: 8 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join(''); } while ([...codes.values()].includes(c)); codes.set(id, c); } return codes.get(id); };
  const byId = (id) => [...users.values()].find((u) => u.userId === id) || null;
  const blocked = (x, y) => store.blocks.has(`${x}|${y}`) || store.blocks.has(`${y}|${x}`);
  const find = (who) => {
    const w = String(who || '').trim();
    for (const u of users.values()) if (codeOf(u.userId) === w.toUpperCase() || u.username.toLowerCase() === w.toLowerCase()) return u;
    return null;
  };
  const status = async (id) => ((await store.activeMatchFor(id)) ? 'in_match' : Date.now() - (seen.get(id) || 0) < ONLINE_MS ? 'online' : 'offline');
  const card = async (u) => ({ id: u.userId, username: u.username, avatar: u.avatar, rating: 1000, rank: 'Sapphire III', status: await status(u.userId) });
  const count = (id) => [...pairs.values()].filter((p) => (p.a === id || p.b === id) && (p.status === 'accepted' || p.by === id)).length;
  const fail = (error) => ({ ok: false, error });
  const MAX = 100;

  async function handle(op, b, me) {
    const id = me.userId;
    seen.set(id, Date.now());
    codeOf(id);
    for (const i of invites.values()) if (i.status === 'open' && i.expires <= Date.now()) i.status = 'expired';
    switch (op) {
      case 'overview': {
        const friends = [], incoming = [], outgoing = [];
        for (const p of pairs.values()) {
          if (p.a !== id && p.b !== id) continue;
          const o = byId(p.a === id ? p.b : p.a); if (!o) continue;
          if (p.status === 'accepted') friends.push({ ...(await card(o)), since: p.at });
          else if (p.by === id) outgoing.push({ id: o.userId, username: o.username, avatar: o.avatar, at: p.at });
          else incoming.push({ id: o.userId, username: o.username, avatar: o.avatar, at: p.at });
        }
        friends.sort((x, y) => (x.status === 'offline') - (y.status === 'offline') || x.username.localeCompare(y.username));
        const blockedList = [...store.blocks].filter((k) => k.startsWith(id + '|')).map((k) => byId(k.split('|')[1])).filter(Boolean).map((u) => ({ id: u.userId, username: u.username }));
        const mine = [...invites.values()].filter((i) => i.to === id && i.status === 'open').map((i) => { const f = byId(i.from); return { id: i.id, from_id: i.from, from_name: f?.username, from_avatar: f?.avatar, mode: i.mode, region: i.region, expires_at: new Date(i.expires).toISOString() }; });
        const sent = [...invites.values()].filter((i) => i.from === id).map((i) => ({ id: i.id, to_id: i.to, status: i.status, code: i.code }));
        return { ok: true, code: codeOf(id), max: MAX, invites_enabled: true, friends, incoming, outgoing, blocked: blockedList, invites: mine, sent };
      }
      case 'request': {
        const o = find(b.who);
        if (!o || blocked(id, o.userId)) return fail('No player with that name or friend code.');
        if (o.userId === id) return fail("That's you!");
        const k = key(id, o.userId), p = pairs.get(k);
        if (p) {
          if (p.status === 'accepted' || p.by === id) return { ok: true, state: p.status === 'accepted' ? 'friends' : 'sent', id: o.userId };
          p.status = 'accepted'; p.at = new Date().toISOString(); return { ok: true, state: 'friends', id: o.userId };
        }
        if (count(id) >= MAX) return fail(`Your friends list is full (${MAX} friends).`);
        pairs.set(k, { a: k.split('|')[0], b: k.split('|')[1], status: 'pending', by: id, at: new Date().toISOString() });
        return { ok: true, state: 'sent', id: o.userId };
      }
      case 'respond': {
        const k = key(id, String(b.id)), p = pairs.get(k);
        if (!p || p.status !== 'pending' || p.by !== String(b.id)) return fail('That request is gone.');
        if (b.accept) { p.status = 'accepted'; p.at = new Date().toISOString(); return { ok: true, state: 'friends' }; }
        pairs.delete(k); return { ok: true, state: 'declined' };
      }
      case 'remove': {
        const removed = pairs.delete(key(id, String(b.id)));
        for (const i of invites.values()) if (i.status === 'open' && ((i.from === id && i.to === b.id) || (i.from === b.id && i.to === id))) i.status = 'cancelled';
        return { ok: true, removed };
      }
      case 'block': {
        if (!byId(String(b.id)) || b.id === id) return fail('No such player.');
        store.blocks.add(`${id}|${b.id}`); pairs.delete(key(id, String(b.id)));
        for (const i of invites.values()) if (i.status === 'open' && ((i.from === id && i.to === b.id) || (i.from === b.id && i.to === id))) i.status = 'cancelled';
        return { ok: true };
      }
      case 'unblock': store.blocks.delete(`${id}|${b.id}`); return { ok: true };
      case 'invite': {
        const p = pairs.get(key(id, String(b.id)));
        if (!p || p.status !== 'accepted' || blocked(id, String(b.id))) return fail('You can only challenge your friends.');
        const room = await store.getRoom(String(b.code || ''));
        if (!room || room.host.userId !== id || room.status !== 'waiting' || room.guest) return fail('Make a room first.');
        for (const i of invites.values()) if (i.from === id && i.to === b.id && i.status === 'open') i.status = 'cancelled';
        const inv = { id: randomUUID(), from: id, to: String(b.id), code: room.code, mode: b.mode === 'practice' ? 'practice' : 'friend', region: b.region || null, status: 'open', expires: Date.now() + INVITE_MS };
        invites.set(inv.id, inv);
        return { ok: true, id: inv.id, expires_at: new Date(inv.expires).toISOString() };
      }
      case 'invite_respond': {
        const i = invites.get(String(b.invite));
        if (!i || i.to !== id) return fail('That challenge is gone.');
        if (i.status !== 'open') return fail(`That challenge was ${i.status === 'cancelled' ? 'called off' : i.status}.`);
        if (i.expires <= Date.now()) { i.status = 'expired'; return fail('That challenge has expired.'); }
        i.status = b.accept ? 'accepted' : 'declined';
        return b.accept ? { ok: true, code: i.code, mode: i.mode, region: i.region } : { ok: true, declined: true };
      }
      case 'invite_cancel': { const i = invites.get(String(b.invite)); if (i && i.from === id && i.status === 'open') i.status = 'cancelled'; return { ok: true }; }
      default: return fail('unknown op');
    }
  }
  return { handle, debugExpire: () => { for (const i of invites.values()) if (i.status === 'open') i.expires = Date.now() - 1; } };
}

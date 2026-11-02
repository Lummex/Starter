/* Oreheart service worker (Nov 2): the installed app plays against the computer with no internet.
 * Generated at build time by tools/sw-plugin.mjs: the version, the CORE list and the FULL manifest are filled in from the built files.
 *
 * How it works, in plain words:
 *  - CORE (the game itself: code, card art, arena, sounds, UI) is downloaded in one go when this version installs. All or nothing,
 *    so a player is never left with half a game. It lives in the cache "oreheart-core-<version>".
 *  - FULL (the 3D models, music and voices, the big part) is cached as it is used, and the game can ask for all of it at once
 *    ("Download everything for offline" in Settings, or by itself when the device has room). Cache "oreheart-full-<version>".
 *  - A new version installs quietly next to the old one and takes over on the next launch (or when the player taps Restart);
 *    then the old caches are deleted. FULL files whose content hash is unchanged are moved over, not downloaded again.
 *  - Every file is served cache-first; what isn't cached comes from the network and (if it belongs to this version) is kept.
 */
const VERSION = '__VERSION__';
const CORE = __CORE__;
const FULL = __FULL__; // path -> [hash, bytes]
const CORE_BYTES = __CORE_BYTES__;
const FULL_BYTES = __FULL_BYTES__;
const CORE_CACHE = 'oreheart-core-' + VERSION, FULL_CACHE = 'oreheart-full-' + VERSION, MANIFEST_KEY = '/__oreheart-manifest__';
const BASE = new URL('./', self.location.href).pathname; // the app's folder on this origin
const pathOf = (url) => { const u = new URL(url, self.location.href); return u.origin === self.location.origin && u.pathname.startsWith(BASE) ? '/' + u.pathname.slice(BASE.length) : null; };
const urlOf = (path) => new URL('.' + path, self.location.href).href;

let downloading = null; // the running "download everything" job, if any
const clientsSay = async (msg) => { for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg); };

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const core = await caches.open(CORE_CACHE);
    // all or nothing: addAll rejects (and the install fails, leaving the old version in place) if any one file can't be fetched
    await core.addAll(CORE.map(urlOf));
    const full = await caches.open(FULL_CACHE);
    await full.put(MANIFEST_KEY, new Response(JSON.stringify(FULL), { headers: { 'content-type': 'application/json' } }));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    const full = await caches.open(FULL_CACHE);
    // carry over unchanged FULL files from the previous version (same content hash), then drop every old cache
    for (const n of names) {
      if (!n.startsWith('oreheart-full-') || n === FULL_CACHE) continue;
      try {
        const old = await caches.open(n);
        const mr = await old.match(MANIFEST_KEY); const om = mr ? await mr.json() : {};
        for (const path of Object.keys(FULL)) {
          if (!om[path] || om[path][0] !== FULL[path][0]) continue;
          if (await full.match(urlOf(path))) continue;
          const r = await old.match(urlOf(path)); if (r) await full.put(urlOf(path), r);
        }
      } catch { /* an unreadable old cache is just deleted */ }
    }
    for (const n of names) if ((n.startsWith('oreheart-core-') || n.startsWith('oreheart-full-')) && n !== CORE_CACHE && n !== FULL_CACHE) await caches.delete(n);
    await self.clients.claim();
    clientsSay({ type: 'oreheart-sw', event: 'activated', version: VERSION });
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const path = pathOf(req.url);
  if (path == null) return; // other origins (never cached here)
  if (req.headers.has('range')) return; // media range requests go straight through
  e.respondWith((async () => {
    if (req.mode === 'navigate') { // the app's page always comes from this version's CORE, so the player gets a whole game, online or not
      const core = await caches.open(CORE_CACHE);
      return (await core.match(urlOf('/index.html'))) || fetch(req);
    }
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    const res = await fetch(req);
    if (res && res.ok && (FULL[path] || CORE.includes(path))) { try { const c = await caches.open(FULL[path] ? FULL_CACHE : CORE_CACHE); await c.put(req, res.clone()); } catch { /* out of room: play on from the network */ } }
    return res;
  })());
});

/** How much of FULL is already cached (bytes), for the Settings line. */
async function fullProgress() {
  const full = await caches.open(FULL_CACHE);
  const keys = await full.keys(); let have = 0, n = 0;
  const got = new Set(keys.map((k) => pathOf(k.url)));
  for (const path of Object.keys(FULL)) if (got.has(path)) { have += FULL[path][1]; n++; }
  return { have, total: FULL_BYTES, files: n, of: Object.keys(FULL).length };
}
async function downloadAll() {
  if (downloading) return downloading;
  downloading = (async () => {
    const full = await caches.open(FULL_CACHE);
    const paths = Object.keys(FULL); let done = 0, failed = 0;
    const p0 = await fullProgress(); let have = p0.have;
    for (const path of paths) {
      if (await full.match(urlOf(path))) { done++; continue; }
      try { const r = await fetch(urlOf(path), { priority: 'low', cache: 'no-cache' }); if (r.ok) { await full.put(urlOf(path), r); have += FULL[path][1]; } else failed++; } catch { failed++; }
      done++;
      if (done % 5 === 0 || done === paths.length) clientsSay({ type: 'oreheart-sw', event: 'progress', have, total: FULL_BYTES, done, of: paths.length, failed });
    }
    clientsSay({ type: 'oreheart-sw', event: 'done', have, total: FULL_BYTES, failed });
    downloading = null;
  })();
  return downloading;
}
self.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.type !== 'oreheart-sw') return;
  if (m.cmd === 'skipWaiting') self.skipWaiting();
  else if (m.cmd === 'downloadAll') downloadAll();
  else if (m.cmd === 'status') { e.waitUntil(fullProgress().then((p) => e.source && e.source.postMessage({ type: 'oreheart-sw', event: 'status', version: VERSION, coreBytes: CORE_BYTES, ...p, downloading: !!downloading }))); }
});

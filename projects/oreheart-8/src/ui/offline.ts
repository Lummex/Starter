/** Offline app (Nov 2): registers the service worker (dist/sw.js, built by tools/sw-plugin.mjs) and keeps a small status for Settings.
 *  Status: 'off' (no service worker: dev page, test page or an old browser) -> 'installing' -> 'core' (the game is playable offline; models
 *  cached as used) -> 'full' (everything cached). `updateReady` is true once a newer version has installed and waits for a restart. */
export type OfflineStatus = { status: 'off' | 'installing' | 'core' | 'full'; version: string; coreMB: number; fullMB: number; haveMB: number; files: number; of: number; downloading: boolean; updateReady: boolean; failed: number };
const st: OfflineStatus = { status: 'off', version: '', coreMB: 0, fullMB: 0, haveMB: 0, files: 0, of: 0, downloading: false, updateReady: false, failed: 0 };
const subs = new Set<() => void>();
const MB = (b: number) => Math.round(b / 1048576);
let reg: ServiceWorkerRegistration | null = null;
const ping = () => { for (const f of subs) f(); };
const send = (msg: any) => { const w = navigator.serviceWorker?.controller || reg?.active; w?.postMessage({ type: 'oreheart-sw', ...msg }); };

export const offlineStatus = (): OfflineStatus => ({ ...st });
export const onOffline = (f: () => void) => { subs.add(f); return () => subs.delete(f); };
/** Ask the worker to cache every model, song and voice (Settings button, or by itself when the device has room). */
export const downloadAll = () => { st.downloading = true; ping(); send({ cmd: 'downloadAll' }); };
/** Switch to the waiting version now: the page reloads once it takes over. */
export const applyUpdate = () => { reg?.waiting?.postMessage({ type: 'oreheart-sw', cmd: 'skipWaiting' }); };

/** Nov 8 (Forge, after launch night: returning players kept yesterday's game until they found "Restart to update" in Settings):
 *  a waiting update is applied by itself, but only while the main menu / Dashboard is on screen with no match, dialog or form open
 *  (nothing to lose: decks, settings and progress are already saved). A short "Updating Oreheart..." shows, then the page reloads. */
const safeToUpdate = (): boolean => {
  if (typeof document === 'undefined') return false;
  if (!document.querySelector('main[data-screen="title"]')) return false;           // only on the menu or the Dashboard
  if (document.querySelector('main.match, .overlay, dialog[open], .dialog, .cardzoom, .pko, .pkm')) return false; // no match, dialog or pack opening
  const a = document.activeElement as HTMLElement | null;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;              // never while typing
  return true;
};
let updating = false;
/** Apply a waiting update now if it is safe (call on every menu / Dashboard visit). True when the page is about to reload. */
export async function autoUpdate(): Promise<boolean> {
  if (updating || !navigator.serviceWorker?.controller || !safeToUpdate()) return false;
  // ask the browser afresh: the registration object kept from start-up can miss a version that installed later
  let r: ServiceWorkerRegistration | null | undefined = null;
  try { r = await navigator.serviceWorker.getRegistration(); } catch { r = null; }
  const w = r?.waiting || reg?.waiting;
  if (!w || updating || !safeToUpdate()) return false;
  updating = true; st.updateReady = true; // controllerchange reloads only when an update was expected
  const note = document.createElement('div');
  note.className = 'oh-updating'; note.setAttribute('role', 'status'); note.setAttribute('data-testid', 'auto-update');
  note.textContent = 'Updating Oreheart…';
  document.body.append(note);
  w.postMessage({ type: 'oreheart-sw', cmd: 'skipWaiting' });
  setTimeout(() => location.reload(), 4000); // the new worker normally takes over first (controllerchange reloads); never get stuck
  return true;
}
/** test hook: what the automatic update sees */
export const autoUpdateDebug = async () => { let r: any = null; try { r = await navigator.serviceWorker.getRegistration(); } catch { /* none */ } return { reg: !!reg, waiting: !!(r?.waiting || reg?.waiting), controller: !!navigator.serviceWorker?.controller, safe: safeToUpdate(), updating }; };

/** Enough room to keep the whole game? Phones with little storage stay on CORE and cache models as they are used. */
async function roomForEverything(): Promise<boolean> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e || !e.quota) return false;
    const free = e.quota - (e.usage || 0);
    return free > (st.fullMB + st.coreMB) * 1048576 * 2.5; // keep well clear of the device's limit
  } catch { return false; }
}

export async function initOffline(enabled: boolean): Promise<void> {
  if (!enabled || !('serviceWorker' in navigator)) return;
  try {
    reg = await navigator.serviceWorker.register(new URL('sw.js', location.href).href, { scope: new URL('./', location.href).pathname });
  } catch { return; }
  st.status = reg.active ? 'core' : 'installing'; ping();
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    const m = e.data || {}; if (m.type !== 'oreheart-sw') return;
    if (m.event === 'status') { st.version = m.version; st.coreMB = MB(m.coreBytes); st.fullMB = MB(m.total); st.haveMB = MB(m.have); st.files = m.files; st.of = m.of; st.downloading = !!m.downloading; st.status = m.files >= m.of && m.of > 0 ? 'full' : 'core'; ping(); }
    else if (m.event === 'progress') { st.haveMB = MB(m.have); st.files = m.done; st.of = m.of; st.failed = m.failed || 0; st.downloading = true; ping(); }
    else if (m.event === 'done') { st.haveMB = MB(m.have); st.failed = m.failed || 0; st.downloading = false; st.status = m.failed ? 'core' : 'full'; ping(); }
    else if (m.event === 'activated' && !navigator.serviceWorker.controller) { st.status = 'core'; ping(); }
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (st.updateReady && !reloading) { reloading = true; location.reload(); } });
  const watch = (w: ServiceWorker | null) => { if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { st.updateReady = true; ping(); } if (w.state === 'activated') refresh(); }); };
  reg.addEventListener('updatefound', () => watch(reg!.installing));
  setInterval(() => { void reg?.update().catch(() => {}); }, 20 * 60 * 1000); // long sessions look for a new version every 20 minutes
  if (reg.waiting && navigator.serviceWorker.controller) { st.updateReady = true; ping(); }
  const refresh = () => send({ cmd: 'status' });
  await navigator.serviceWorker.ready;
  refresh();
  // a first install: once CORE is in, fetch the rest by itself when the device clearly has the room (PCs always do)
  setTimeout(async () => { if (st.status === 'core' && !st.downloading && st.of > st.files && (await roomForEverything())) downloadAll(); }, 4000);
  setInterval(refresh, 15000);
}

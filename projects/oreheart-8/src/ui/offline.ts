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
  if (reg.waiting && navigator.serviceWorker.controller) { st.updateReady = true; ping(); }
  const refresh = () => send({ cmd: 'status' });
  await navigator.serviceWorker.ready;
  refresh();
  // a first install: once CORE is in, fetch the rest by itself when the device clearly has the room (PCs always do)
  setTimeout(async () => { if (st.status === 'core' && !st.downloading && st.of > st.files && (await roomForEverything())) downloadAll(); }, 4000);
  setInterval(refresh, 15000);
}

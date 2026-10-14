import { defineConfig } from 'vite';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

function walk(d, out = []) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

const swPlugin = () => ({
  name: 'oreheart-sw',
  apply: 'build',
  closeBundle() {
    const dist = resolve('dist');
    const files = walk(dist).map((p) => '/' + relative(dist, p).split('\\').join('/')).filter((f) => f !== '/sw.js');
    const urls = ['/', ...files];
    const ver = Date.now().toString(36);
    writeFileSync(join(dist, 'sw.js'), `const CACHE='oreheart-${ver}';
const URLS=${JSON.stringify(urls)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(URLS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).catch(()=>caches.match('/index.html')||caches.match('/'))));
});
`);
  },
});

export default defineConfig({ plugins: [swPlugin()], build: { target: 'es2020' } });

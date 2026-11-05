// Vite plugin (Nov 2): after `vite build`, write dist/sw.js from vite-plugins/sw-template.js (not under tools/, which .vercelignore drops from the Vercel build) with this build's file lists.
// CORE = everything a match needs except the big optional parts; FULL = the 3D models, music and voices (cached as used, or all at once).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const FULL_PREFIXES = ['/models/', '/audio/music/', '/audio/voice/', '/art/upgrades/']; // Nov 5: the upgraded cards' pictures (33 MB) load as used, never on first load
const SKIP = (p) => p === '/sw.js' || p.endsWith('.map') || p.startsWith('/screenshots/');

export function listBuild(dist) {
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f); else files.push(f); } };
  walk(dist);
  const core = [], full = {}; let coreBytes = 0, fullBytes = 0;
  const digest = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
  const hash = crypto.createHash('sha1');
  for (const f of files.sort()) {
    const p = '/' + path.relative(dist, f).split(path.sep).join('/');
    if (SKIP(p)) continue;
    const size = fs.statSync(f).size, h = digest(f);
    hash.update(p + ':' + h + ';');
    if (FULL_PREFIXES.some((x) => p.startsWith(x))) { full[p] = [h, size]; fullBytes += size; }
    else { core.push(p); coreBytes += size; }
  }
  return { version: hash.digest('hex').slice(0, 12), core, full, coreBytes, fullBytes };
}

export function writeServiceWorker(dist, templatePath) {
  const m = listBuild(dist);
  const sw = fs.readFileSync(templatePath, 'utf8').replace(/\r\n/g, '\n') // one line-ending style whatever the checkout (Windows CRLF or not), so sw.js is the same everywhere
    .replaceAll('__VERSION__', m.version).replaceAll('__CORE__', JSON.stringify(m.core)).replaceAll('__FULL__', JSON.stringify(m.full))
    .replaceAll('__CORE_BYTES__', String(m.coreBytes)).replaceAll('__FULL_BYTES__', String(m.fullBytes));
  fs.writeFileSync(path.join(dist, 'sw.js'), sw);
  return m;
}

export default function oreheartServiceWorker() {
  let outDir = 'dist';
  return {
    name: 'oreheart-service-worker',
    apply: 'build',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    closeBundle() {
      const m = writeServiceWorker(outDir, path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'sw-template.js'));
      console.log(`[sw] ${m.version}: core ${m.core.length} files ${(m.coreBytes / 1048576).toFixed(1)} MB, full ${Object.keys(m.full).length} files ${(m.fullBytes / 1048576).toFixed(1)} MB`);
    },
  };
}

// Offline app (Nov 2): the build plugin sorts the built files into CORE (all-or-nothing install) and FULL (models, music, voices), hashes them, and writes sw.js.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listBuild, writeServiceWorker } from '../vite-plugins/sw-plugin.mjs';

function fakeDist(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-sw-'));
  const put = (p: string, s: string) => { const f = path.join(d, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
  put('index.html', '<html>'); put('assets/index-abc.js', 'js'); put('assets/index-abc.css', 'css'); put('manifest.webmanifest', '{}');
  put('art/ui/match/done.webp', 'w'); put('art/owner/goblin/x.png', 'p'); put('audio/sfx/hit.ogg', 'o');
  put('models/creatures/goblin-grunt/char.glb', 'glb'); put('models/creatures/goblin-grunt/models.json', '{}'); put('audio/music/a.ogg', 'm'); put('audio/voice/a.ogg', 'v');
  put('sw.js', 'old'); put('assets/index-abc.js.map', 'map');
  return d;
}

describe('offline app build (sw-plugin)', () => {
  it('CORE holds the page, code, art and sounds; FULL holds models, music and voices; sw.js and maps are left out', () => {
    const d = fakeDist(); const m = listBuild(d);
    expect(m.core).toEqual(['/art/owner/goblin/x.png', '/art/ui/match/done.webp', '/assets/index-abc.css', '/assets/index-abc.js', '/audio/sfx/hit.ogg', '/index.html', '/manifest.webmanifest']);
    expect(Object.keys(m.full).sort()).toEqual(['/audio/music/a.ogg', '/audio/voice/a.ogg', '/models/creatures/goblin-grunt/char.glb', '/models/creatures/goblin-grunt/models.json']);
    expect(m.full['/models/creatures/goblin-grunt/char.glb'][1]).toBe(3);
    expect(m.coreBytes).toBeGreaterThan(0); expect(m.fullBytes).toBe(3 + 2 + 1 + 1);
  });
  it('the version changes when any file changes, and stays when nothing does', () => {
    const d = fakeDist(); const v1 = listBuild(d).version; expect(listBuild(d).version).toBe(v1);
    fs.writeFileSync(path.join(d, 'models/creatures/goblin-grunt/char.glb'), 'glb2');
    expect(listBuild(d).version).not.toBe(v1);
  });
  it('writes sw.js with the lists filled in', () => {
    const d = fakeDist(); const m = writeServiceWorker(d, path.resolve(__dirname, '../vite-plugins/sw-template.js'));
    const sw = fs.readFileSync(path.join(d, 'sw.js'), 'utf8');
    expect(sw).toContain(`const VERSION = '${m.version}'`);
    expect(sw).toContain('"/index.html"'); expect(sw).toContain('"/models/creatures/goblin-grunt/char.glb":[');
    expect(sw).not.toContain('__CORE__');
  });
});

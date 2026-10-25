// Validate a character GLB the way the game loads it: three.js GLTFLoader + MeshoptDecoder + AnimationMixer.
// usage: node validate-three.mjs <three-root> <file.glb> [events.json] > report.json
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const [threeRoot, glb, eventsPath] = process.argv.slice(2);
const files = { '/m.glb': glb };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  let f = files[p] || (p.startsWith('/three/') ? path.join(threeRoot, p.slice(7)) : null);
  if (p === '/') { r.writeHead(200, {'content-type':'text/html'}); return r.end(`<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>`); }
  if (!f || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, {'content-type': f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'}); fs.createReadStream(f).pipe(r);
}).listen(0);
const port = srv.address().port;
const events = eventsPath ? JSON.parse(fs.readFileSync(eventsPath, 'utf8')) : null;
const b = await chromium.launch(); const pg = await b.newPage();
await pg.goto(`http://127.0.0.1:${port}/`);
const rep = await pg.evaluate(async (events) => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
  const g = await L.loadAsync('/m.glb');
  const out = { ok: true, problems: [], clips: [] };
  const skinned = []; g.scene.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  out.skinned_meshes = skinned.length; out.bones = skinned[0]?.skeleton.bones.length || 0;
  if (!skinned.length) { out.ok = false; out.problems.push('no skinned mesh'); }
  // skin weights sum to ~1
  if (skinned[0]) { const w = skinned[0].geometry.attributes.skinWeight; let bad = 0; for (let i = 0; i < w.count; i++) { const s = w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i); if (Math.abs(s-1) > 0.02) bad++; } out.bad_weight_vertices = bad; if (bad) out.problems.push(bad + ' vertices have weights not summing to 1'); }
  const box = new THREE.Box3().setFromObject(g.scene); out.size = box.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(4)); out.min_y = +box.min.y.toFixed(4);
  const hand = skinned[0]?.skeleton.bones.find(b => /right.?hand|hand.?r/i.test(b.name));
  const mixer = new THREE.AnimationMixer(g.scene);
  for (const clip of g.animations) {
    const c = { name: clip.name, duration: +clip.duration.toFixed(4), tracks: clip.tracks.length };
    let nan = false; for (const t of clip.tracks) for (const v of t.values) if (!Number.isFinite(v)) { nan = true; break; }
    if (nan) { out.problems.push(clip.name + ' has invalid numbers'); }
    mixer.stopAllAction(); const act = mixer.clipAction(clip); act.reset().play();
    const pts = []; const v = new THREE.Vector3();
    for (let i = 0; i <= 10; i++) { mixer.setTime(clip.duration * i / 10); g.scene.updateMatrixWorld(true); if (hand) { hand.getWorldPosition(v); pts.push(v.toArray().map(x => +x.toFixed(3))); } }
    c.right_hand_path = pts;
    const ev = events?.clips?.[clip.name]; if (ev) { c.events = ev.events; for (const e of ev.events) if (e.time < 0 || e.time > clip.duration + 1e-3) out.problems.push(`${clip.name}: event ${e.name} at ${e.time}s is outside the clip`); }
    out.clips.push(c); act.stop();
  }
  out.ok = out.problems.length === 0;
  return out;
}, events);
console.log(JSON.stringify(rep, null, 1));
await b.close(); srv.close();

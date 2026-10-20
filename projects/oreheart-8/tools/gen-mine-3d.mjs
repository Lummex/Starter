// Runs the Meshy job for the crystal mine ONCE and saves public/models/mine/crystal-mine.glb + mine.json.
// Usage: MESHY_API_KEY=... node tools/gen-mine-3d.mjs   (skips if mine.json exists; --force to regenerate)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const KEY = process.env.MESHY_API_KEY;
const API = 'https://api.meshy.ai/openapi/v1';
const SRC = path.resolve('../../factory-design/design/references/crystal-mine/crystal-mine-front.png');
const OUT = path.resolve('public/models/mine');
if (fs.existsSync(path.join(OUT, 'mine.json')) && !process.argv.includes('--force')) { console.log('mine.json exists; skipping'); process.exit(0); }
if (!KEY) throw new Error('MESHY_API_KEY is not set');
const h = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const buf = await sharp(SRC).resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
let r = await fetch(API + '/image-to-3d', { method: 'POST', headers: h, body: JSON.stringify({ image_url: 'data:image/png;base64,' + buf.toString('base64'), ai_model: 'latest', should_texture: true, enable_pbr: true, topology: 'triangle', target_polycount: 12000, should_remesh: true }) });
const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j));
const id = j.result; console.log('task', id);
for (;;) {
  const t = await (await fetch(`${API}/image-to-3d/${id}`, { headers: h })).json();
  if (t.status === 'SUCCEEDED') {
    const g = Buffer.from(await (await fetch(t.model_urls.glb)).arrayBuffer());
    fs.writeFileSync(path.join(OUT, 'crystal-mine.glb'), g);
    fs.writeFileSync(path.join(OUT, 'mine.json'), JSON.stringify({ generated: new Date().toISOString(), task: id, targetPolycount: 12000, bytes: g.length, creditsSpent: 30 }, null, 1));
    console.log('done', g.length); break;
  }
  if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(JSON.stringify(t.task_error));
  await new Promise((r) => setTimeout(r, 8000));
}

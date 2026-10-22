// Meshy jobs for ONE owner-sheet creature, run ONCE; saves public/models/creatures/<slug>/. Resumable via tools/.state-<slug>.json.
// Usage: MESHY_API_KEY=... node tools/gen-creature-3d.mjs <slug>     (specs below; skips if models.json exists)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const SHEETS = path.resolve('../../factory-design/goblin-art');
const SPECS = {
  'goblin-scrounger': { sheet: 'goblin-miner-tpose-sheet.png', char: [[0, 0, 575, 610], [575, 0, 215, 610], [780, 0, 555, 610]],
    parts: { backpack: [[630, 840, 260, 338]], pickaxe: [[10, 850, 318, 325]] }, height: 1.0,
    actions: { idle: 0, walk: 30, attack: 237, mine: 128, hit: 178, defeat: 8 } },
  'goblin-pebbler': { sheet: 'boneknocker-model-sheet.png', char: [[10, 10, 280, 400], [525, 10, 140, 400], [820, 10, 210, 400]],
    parts: { club: [[20, 425, 90, 250]] }, height: 1.0, actions: { idle: 0, walk: 30, attack: 128, hit: 178, defeat: 8 } },
  'shiv-rat': { sheet: 'shiv-rat-model-sheet.png', char: [[90, 10, 350, 480], [520, 10, 250, 480], [800, 10, 330, 480]],
    parts: { dagger: [[1185, 10, 110, 460]] }, height: 0.9, actions: { idle: 0, walk: 115, attack: 240, hit: 178, defeat: 8 } },
  'goblin-smith-miner': { sheet: 'apron-goblin-model-sheet-UNASSIGNED.png', char: [[10, 20, 290, 410], [560, 20, 170, 410], [920, 20, 230, 410]],
    parts: { pickaxe: [[1165, 515, 215, 230]], hammer: [[1395, 520, 135, 230]] }, height: 1.0, actions: { idle: 0, walk: 30, attack: 128, mine: 237, hit: 178, defeat: 8 } },
  'grubnak': { sheet: 'grubnak-model-sheet.png', char: [[150, 0, 470, 600], [620, 0, 260, 600], [830, 0, 470, 600]],
    parts: { scepter: [[1240, 0, 160, 600]], throne: [[0, 0, 610, 610], [620, 0, 380, 620], [990, 0, 540, 620]] }, sheets: { throne: 'grubnak-throne-model-sheet.png' }, height: 1.5,
    actions: { idle: 33, laugh: 88, point: 29, celebrate: 403, surprised: 179, cast: 129, hit: 178, defeat: 8 } },
};
const slug = process.argv[2];
const spec = SPECS[slug]; if (!spec) throw new Error('unknown slug');
const KEY = process.env.MESHY_API_KEY; const API = 'https://api.meshy.ai/openapi/v1';
const OUT = path.resolve('public/models/creatures', slug); fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(path.join(OUT, 'models.json'))) { console.log('exists; skip'); process.exit(0); }
const STATE = path.resolve(`tools/.state-${slug}.json`);
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, p, body) {
  const r = await fetch(API + p, { method, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${t.slice(0, 400)}`); return JSON.parse(t);
}
async function crop([x, y, w, h], sheet = spec.sheet) {
  const s = Math.max(w, h) + 40;
  const buf = await sharp(path.join(SHEETS, sheet)).extract({ left: x, top: y, width: w, height: h })
    .extend({ top: Math.floor((s - h) / 2), bottom: Math.ceil((s - h) / 2), left: Math.floor((s - w) / 2), right: Math.ceil((s - w) / 2), background: '#ffffff' })
    .resize(1024, 1024, { fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer();
  return 'data:image/png;base64,' + buf.toString('base64');
}
async function job(kind, key, body) {
  if (!state[key]) { state[key] = (await api('POST', `/${kind}`, body)).result; save(); console.log('started', key, state[key]); }
  for (;;) {
    const t = await api('GET', `/${kind}/${state[key]}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${key} ${t.status}: ${JSON.stringify(t.task_error)}`);
    await sleep(8000);
  }
}
async function download(url, name) { const b = Buffer.from(await (await fetch(url)).arrayBuffer()); fs.writeFileSync(path.join(OUT, name), b); return b.length; }
const gen = { should_texture: true, enable_pbr: true, topology: 'triangle', should_remesh: true, ai_model: 'latest' };
const sizes = {};
const views = await Promise.all(spec.char.map((c) => crop(c)));
const base = await job('multi-image-to-3d', 'character', { image_urls: views, ...gen, target_polycount: 20000 });
const rig = await job('rigging', 'rig', { input_task_id: state.character, height_meters: spec.height });
/* rigged.glb not kept (15 MB) */
const names = Object.keys(spec.actions);
const anim = await job('animations', 'anim', { rig_task_id: state.rig, action_ids: names.map((n) => spec.actions[n]) });
sizes['char.glb'] = await download(anim.result?.animation_glb_url || anim.animation_glb_url, 'char.glb');
for (const [pn, crops] of Object.entries(spec.parts)) {
  const imgs = await Promise.all(crops.map((c) => crop(c, spec.sheets?.[pn])));
  const t = imgs.length > 1 ? await job('multi-image-to-3d', pn, { image_urls: imgs, ...gen, target_polycount: 20000 }) : await job('image-to-3d', pn, { image_url: imgs[0], ...gen, target_polycount: 5000 });
  sizes[pn + '.glb'] = await download(t.model_urls.glb, pn + '.glb');
}
fs.writeFileSync(path.join(OUT, 'models.json'), JSON.stringify({ generated: new Date().toISOString(), tasks: state, actions: spec.actions, fileSizes: sizes }, null, 1));
console.log('done', sizes);

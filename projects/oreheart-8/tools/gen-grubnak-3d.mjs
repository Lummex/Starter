// Runs the Meshy jobs for Grubnak ONCE and saves the results under public/models/commanders/.
// Usage: MESHY_API_KEY=... node tools/gen-grubnak-3d.mjs   (resumes from tools/.grubnak-state.json; skips if models.json exists)
// After the download, textures were shrunk with: gltf-transform resize --width 1024 --height 1024 + webp (fortress, scepter) and webp (character); see models.json.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const KEY = process.env.MESHY_API_KEY;
const API = 'https://api.meshy.ai/openapi/v1';
const REF = path.resolve('../../factory-design/design/references/commanders/grubnak');
const OUT = path.resolve('public/models/commanders');
const STATE = path.resolve('tools/.grubnak-state.json');
if (fs.existsSync(path.join(OUT, 'models.json')) && !process.argv.includes('--force')) { console.log('models.json exists; not calling Meshy again (use --force to regenerate)'); process.exit(0); }
if (!KEY) throw new Error('MESHY_API_KEY is not set');
fs.mkdirSync(OUT, { recursive: true });
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// idle, laugh (taunt), point (call gesture), celebrate, surprised (hit reaction 1), cast, hit, defeat
const ANIMS = [['idle', 0], ['laugh', 88], ['point', 29], ['celebrate', 403], ['surprised', 179], ['cast', 129], ['hit', 178], ['defeat', 8]];

async function api(method, p, body) {
  const r = await fetch(API + p, { method, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${t.slice(0, 400)}`);
  return JSON.parse(t);
}
async function dataUri(file) {
  const buf = await sharp(path.join(REF, file)).resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return 'data:image/png;base64,' + buf.toString('base64');
}
async function wait(kind, key) {
  for (;;) {
    const t = await api('GET', `/${kind}/${state[key]}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${key} ${t.status}: ${JSON.stringify(t.task_error)}`);
    process.stdout.write(`${key} ${t.status} ${t.progress ?? ''}\r`);
    await sleep(8000);
  }
}
async function job(kind, key, body) {
  if (!state[key]) { state[key] = (await api('POST', `/${kind}`, body)).result; save(); console.log('started', key, state[key]); }
  return wait(kind, key);
}
async function download(url, name) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('download ' + name + ' ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(path.join(OUT, name), buf);
  return buf.length;
}

const views = await Promise.all(['front', 'left', 'back', 'right'].map((v) => dataUri(`grubnak-${v}.png`)));
const base = await job('multi-image-to-3d', 'character', { image_urls: views, ai_model: 'latest', should_texture: true, enable_pbr: true, topology: 'triangle', target_polycount: 30000, should_remesh: true });
const rig = await job('rigging', 'rig', { input_task_id: state.character, height_meters: 1.2 });
const anim = await job('animations', 'anim', { rig_task_id: state.rig, action_ids: ANIMS.map((a) => a[1]) });
const fort = await job('image-to-3d', 'fortress', { image_url: await dataUri('fortress-front.png'), ai_model: 'latest', should_texture: true, enable_pbr: true, topology: 'triangle', target_polycount: 10000, should_remesh: true });
const scep = await job('image-to-3d', 'scepter', { image_url: await dataUri('scepter-front.png'), ai_model: 'latest', should_texture: true, enable_pbr: true, topology: 'triangle', target_polycount: 3000, should_remesh: true });

const au = anim.result?.animation_glb_url || anim.animation_glb_url;
const sizes = {
  'grubnak.glb': await download(au, 'grubnak.glb'),
  'grubnak-fortress.glb': await download(fort.model_urls.glb, 'grubnak-fortress.glb'),
  'grubnak-scepter.glb': await download(scep.model_urls.glb, 'grubnak-scepter.glb'),
};
fs.writeFileSync(path.join(OUT, 'models.json'), JSON.stringify({
  generated: new Date().toISOString(),
  tasks: { character: state.character, rig: state.rig, animations: state.anim, fortress: state.fortress, scepter: state.scepter },
  polycounts: { character: 30000, fortress: 10000, scepter: 3000, note: 'requested targets' },
  fileSizes: sizes,
  animationActions: Object.fromEntries(ANIMS),
}, null, 1));
console.log('done', sizes);

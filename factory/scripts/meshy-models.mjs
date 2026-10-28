// Turns owner-approved Model Editor sheets into 3D models with Meshy. Runs ONCE per model:
// a model whose models.json already exists is skipped (never regenerated unless the owner asks).
// Input:  factory-design/meshy-jobs/jobs.json + the cropped view pictures next to it.
// Output: factory-design/models/<id>/char.glb (rigged + animations), <part>.glb, models.json
// Progress is saved in factory-design/meshy-jobs/state.json so a re-run resumes instead of paying twice.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const JOBS_DIR = path.join(ROOT, 'factory-design/meshy-jobs');
const OUT_ROOT = path.join(ROOT, 'factory-design/models');
const KEY = process.env.MESHY_API_KEY;
const API = process.env.MESHY_API_BASE || 'https://api.meshy.ai/openapi/v1';
if (!KEY) throw new Error('MESHY_API_KEY is missing');
const only = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const { jobs } = JSON.parse(fs.readFileSync(path.join(JOBS_DIR, 'jobs.json'), 'utf8'));
const STATE = path.join(JOBS_DIR, 'state.json');
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const saveState = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function api(method, p, body) {
  for (let i = 0; ; i++) {
    const r = await fetch(API + p, { method, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    if (r.ok) return JSON.parse(t);
    if ((r.status === 429 || r.status >= 500) && i < 6) { await sleep(10000 * (i + 1)); continue; }
    throw new Error(`${method} ${p} -> ${r.status} ${t.slice(0, 400)}`);
  }
}
const img = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(JOBS_DIR, f)).toString('base64');
async function task(id, kind, key, body) {
  state[id] ||= {};
  if (!state[id][key]) { state[id][key] = (await api('POST', `/${kind}`, body)).result; saveState(); log(id, 'started', key, state[id][key]); }
  for (;;) {
    const t = await api('GET', `/${kind}/${state[id][key]}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${id} ${key} ${t.status}: ${JSON.stringify(t.task_error)}`);
    await sleep(10000);
  }
}
async function download(url, file) { const b = Buffer.from(await (await fetch(url)).arrayBuffer()); fs.writeFileSync(file, b); return b.length; }
const gen = { should_texture: true, enable_pbr: true, topology: 'triangle', should_remesh: true, ai_model: 'latest' };
// Text-to-3D (Meshy v2) for a simple prop with no sheet: a part written as { "text": "...", "texture": "..." } instead of a list of view pictures.
const API2 = API.replace(/\/v1$/, '/v2');
async function textTask(id, key, body) {
  state[id] ||= {};
  if (!state[id][key]) {
    const r = await fetch(API2 + '/text-to-3d', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const t = await r.text(); if (!r.ok) throw new Error(`POST text-to-3d -> ${r.status} ${t.slice(0, 400)}`);
    state[id][key] = JSON.parse(t).result; saveState(); log(id, 'started', key, state[id][key]);
  }
  for (;;) {
    const r = await fetch(API2 + '/text-to-3d/' + state[id][key], { headers: { Authorization: `Bearer ${KEY}` } });
    if (!r.ok) { if (r.status === 429 || r.status >= 500) { await sleep(10000); continue; } throw new Error(`GET text-to-3d -> ${r.status} ${(await r.text()).slice(0, 300)}`); }
    const t = await r.json();
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${id} ${key} ${t.status}: ${JSON.stringify(t.task_error)}`);
    await sleep(10000);
  }
}
async function makePart(id, pn, views) {
  if (Array.isArray(views)) return task(id, 'multi-image-to-3d', pn, { image_urls: views.map(img), ...gen, target_polycount: 15000 });
  await textTask(id, pn + ':preview', { mode: 'preview', prompt: views.text, art_style: 'realistic', topology: 'triangle', target_polycount: 15000, should_remesh: true, ai_model: 'latest' });
  return textTask(id, pn, { mode: 'refine', preview_task_id: state[id][pn + ':preview'], enable_pbr: true, ...(views.texture ? { texture_prompt: views.texture } : {}) });
}

async function run(job) {
  const out = path.join(OUT_ROOT, job.id);
  if (fs.existsSync(path.join(out, 'models.json'))) {
    // Character already made (never regenerated). Only make accessories (parts) that are listed but not made yet.
    const info = JSON.parse(fs.readFileSync(path.join(out, 'models.json'), 'utf8'));
    const missing = Object.entries(job.parts || {}).filter(([pn]) => !fs.existsSync(path.join(out, pn + '.glb')));
    if (!missing.length) { log(job.id, 'already made; skip'); return { id: job.id, skipped: true }; }
    const got = {};
    const rs = await Promise.allSettled(missing.map(async ([pn, views]) => {
      const t = await makePart(job.id, pn, views);
      got[pn + '.glb'] = await download(t.model_urls.glb, path.join(out, pn + '.glb'));
      log(job.id, 'part done', pn);
    }));
    info.parts = [...new Set([...(info.parts || []), ...Object.keys(got).map((f) => f.replace(/\.glb$/, ''))])];
    info.fileSizes = Object.assign(info.fileSizes || {}, got); info.tasks = state[job.id]; info.partsAdded = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'models.json'), JSON.stringify(info, null, 1));
    const bad = rs.filter((r) => r.status === 'rejected').map((r) => r.reason.message);
    if (bad.length) throw new Error(bad.join(' | '));
    return { id: job.id, partsAdded: got };
  }
  fs.mkdirSync(out, { recursive: true });
  const sizes = {};
  const partJobs = Object.entries(job.parts || {}).map(async ([pn, views]) => {
    const t = await makePart(job.id, pn, views);
    sizes[pn + '.glb'] = await download(t.model_urls.glb, path.join(out, pn + '.glb'));
    log(job.id, 'part done', pn);
  });
  const charJob = (async () => {
    const ch = await task(job.id, 'multi-image-to-3d', 'character', { image_urls: job.char.map(img), ...gen, target_polycount: 20000 });
    // Non-humanoid units (rig: false) get no skeleton or animations: the model itself is the character.
    if (job.rig === false) { sizes['char.glb'] = await download(ch.model_urls.glb, path.join(out, 'char.glb')); log(job.id, 'character done (no rig)'); return; }
    await task(job.id, 'rigging', 'rig', { input_task_id: state[job.id].character, height_meters: job.height || 1 });
    const names = Object.keys(job.actions);
    const anim = await task(job.id, 'animations', 'anim', { rig_task_id: state[job.id].rig, action_ids: names.map((n) => job.actions[n]) });
    sizes['char.glb'] = await download(anim.result?.animation_glb_url || anim.animation_glb_url, path.join(out, 'char.glb'));
    log(job.id, 'character done');
  })();
  await Promise.all([charJob, ...partJobs]);
  fs.writeFileSync(path.join(out, 'models.json'), JSON.stringify({ generated: new Date().toISOString(), from: 'Model Editor approved sheet', tasks: state[job.id], actions: job.rig === false ? {} : job.actions, rigged: job.rig !== false, parts: Object.keys(job.parts || {}), notes: job.notes || '', fileSizes: sizes }, null, 1));
  return { id: job.id, sizes };
}

const todo = jobs.filter((j) => !only.length || only.includes(j.id));
const results = [];
const queue = [...todo];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const j = queue.shift();
    try { results.push(await run(j)); } catch (e) { log('FAILED', j.id, e.message); results.push({ id: j.id, error: e.message }); }
  }
}));
fs.writeFileSync(path.join(JOBS_DIR, 'last-run.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
log('finished', JSON.stringify(results));
if (results.some((r) => r.error)) process.exitCode = 0; // keep what succeeded; failures are listed in last-run.json

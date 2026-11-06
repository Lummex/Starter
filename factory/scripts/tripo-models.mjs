// Turns the same approved front/side/back sheets as the Meshy script into 3D models with Tripo (https://developers.tripo3d.ai, API v3).
// Runs ONCE per model: a model whose models.json already exists is skipped, never regenerated or overwritten.
// Input:  factory-design/tripo-jobs/jobs.json (JOBS=tripo, the default) or factory-design/meshy-jobs/jobs.json (JOBS=meshy), same job format;
//         the view pictures are the ones in factory-design/meshy-jobs/.
// Output: factory-design/tripo/<id>/char.glb (rigged unless "tripo_rig": false), <part>.glb, models.json with "source": "tripo".
// Progress is saved in factory-design/tripo-jobs/state.json so a re-run resumes instead of paying twice.
// Steps per character: upload views -> multiview-to-model (H series, PBR) -> rig-check (free) -> rig. The animation presets are NOT bought:
// the shared animation pack is applied later, as with Meshy. A part is a multiview-to-model and nothing else.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TRIPO_DIR = path.join(ROOT, 'factory-design/tripo-jobs');
const VIEW_DIR = path.join(ROOT, 'factory-design/meshy-jobs');
const OUT_ROOT = path.join(ROOT, 'factory-design/tripo');
const KEY = process.env.TRIPO_API_KEY;
const API = process.env.TRIPO_API_BASE || 'https://openapi.tripo3d.ai/v3';
const DRY = process.env.DRY_RUN === 'true';
if (!KEY) {
  console.error('TRIPO_API_KEY is missing. Ken: GitHub repo Settings > Secrets and variables > Actions > New repository secret, name TRIPO_API_KEY, value = the key from https://developers.tripo3d.ai/en/keys. Nothing was sent and nothing was spent.');
  process.exit(1);
}
const MODEL = process.env.TRIPO_MODEL || 'v3.1-20260211';
const RIG_BIPED = 'v3.0-20260909', RIG_OTHER = 'v2.5-20260210';
const COST = { mesh: 40, rig: 25 }; // multiview 30 + HD texture 10; rig 25 (rig-check is free)
const only = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const jobsFile = process.env.JOBS === 'meshy' ? path.join(VIEW_DIR, 'jobs.json') : path.join(TRIPO_DIR, 'jobs.json');
const { jobs } = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const STATE = path.join(TRIPO_DIR, 'state.json');
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const saveState = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let spent = 0;

async function call(method, p, body, form) {
  for (let i = 0; ; i++) {
    const r = await fetch(API + p, { method, headers: { Authorization: `Bearer ${KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: form || (body ? JSON.stringify(body) : undefined) });
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { j = null; }
    if (r.ok && j && (j.code === undefined || j.code === 0)) return j.data;
    if (r.status === 401 || r.status === 403 || j?.code === 2010) throw new Error(`Tripo refused the request (${r.status}, code ${j?.code}): ${j?.message || t.slice(0, 200)}. ${j?.code === 2010 ? 'Out of Tripo credits: stopped; Ken tops up.' : 'Check the TRIPO_API_KEY secret.'}`);
    if ((r.status === 429 || r.status >= 500) && i < 8) { await sleep(Math.max(5, +r.headers.get('retry-after') || 0, 5 * (i + 1)) * 1000); continue; }
    throw new Error(`${method} ${p} -> ${r.status} ${t.slice(0, 400)}`);
  }
}
async function upload(file) {
  const f = path.join(VIEW_DIR, file);
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(f)], { type: 'image/jpeg' }), path.basename(f));
  return (await call('POST', '/files', null, fd)).file_token;
}
// one task = create once (task id saved in state), then poll until it ends
async function task(id, key, create) {
  state[id] ||= {};
  if (!state[id][key]) { state[id][key] = (await create()).task_id; saveState(); log(id, 'started', key, state[id][key]); }
  for (let n = 0; n < 360; n++) {
    const t = await call('GET', `/tasks/${state[id][key]}`);
    if (t.status === 'success') { spent += +t.credits_consumed || 0; return t; }
    if (['failed', 'cancelled', 'banned', 'expired'].includes(t.status)) throw new Error(`${id} ${key} ${t.status}: ${t.error_code || ''} ${t.error_message || ''}`);
    await sleep(8000);
  }
  throw new Error(`${id} ${key} did not finish in 48 minutes (task ${state[id][key]})`);
}
// the link is short-lived: download in the same run, and keep the file only if it is a whole GLB
async function download(url, file) {
  for (let i = 0; i < 3; i++) {
    const b = Buffer.from(await (await fetch(url)).arrayBuffer());
    if (b.length > 20 && b.toString('latin1', 0, 4) === 'glTF' && b.readUInt32LE(8) === b.length) { fs.writeFileSync(file, b); return b.length; }
    await sleep(3000);
  }
  throw new Error('download of ' + path.basename(file) + ' was not a whole GLB');
}
const views = async (names) => {
  const keys = ['front', 'left', 'back']; // our sheets are front, side, back
  const out = [];
  for (const [i, n] of names.slice(0, 3).entries()) out.push({ [keys[i]]: await upload(n) });
  return out;
};
const mesh = (id, key, names) => task(id, key, async () => call('POST', '/generation/multiview-to-model', { inputs: await views(names), model: MODEL, texture: true, pbr: true, texture_quality: 'detailed', face_limit: key === 'character' ? 20000 : 15000 }));

async function run(job) {
  const out = path.join(OUT_ROOT, job.id);
  if (fs.existsSync(path.join(out, 'models.json'))) {
    // Character already made (never regenerated). Only make listed parts that are missing.
    const info = JSON.parse(fs.readFileSync(path.join(out, 'models.json'), 'utf8'));
    const missing = Object.entries(job.parts || {}).filter(([pn, v]) => Array.isArray(v) && !fs.existsSync(path.join(out, pn + '.glb')));
    if (!missing.length) { log(job.id, 'already made; skip'); return { id: job.id, skipped: true }; }
    const got = {};
    for (const [pn, v] of missing) { const t = await mesh(job.id, pn, v); got[pn + '.glb'] = await download(t.output.model_url, path.join(out, pn + '.glb')); }
    info.parts = [...new Set([...(info.parts || []), ...Object.keys(got).map((f) => f.slice(0, -4))])];
    info.fileSizes = Object.assign(info.fileSizes || {}, got); info.partsAdded = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'models.json'), JSON.stringify(info, null, 1));
    return { id: job.id, partsAdded: got };
  }
  fs.mkdirSync(out, { recursive: true });
  const sizes = {}, meta = {};
  const parts = Object.entries(job.parts || {}).filter(([, v]) => Array.isArray(v)).map(async ([pn, v]) => {
    const t = await mesh(job.id, pn, v); sizes[pn + '.glb'] = await download(t.output.model_url, path.join(out, pn + '.glb')); log(job.id, 'part done', pn);
  });
  const character = (async () => {
    const m = await mesh(job.id, 'character', job.char);
    if (job.tripo_rig === false) { sizes['char.glb'] = await download(m.output.model_url, path.join(out, 'char.glb')); meta.rigged = false; return; }
    // rig-check is free and says which skeleton fits (biped, quadruped, hexapod, octopod, ...)
    const chk = await task(job.id, 'rigcheck', () => call('POST', '/animations/rig-check', { input: state[job.id].character }));
    meta.riggable = chk.output?.riggable; meta.rig_type = job.rig_type || chk.output?.rig_type;
    if (!chk.output?.riggable) { sizes['char.glb'] = await download(m.output.model_url, path.join(out, 'char.glb')); meta.rigged = false; meta.note = 'Tripo says not riggable: unrigged mesh saved'; log(job.id, meta.note); return; }
    const biped = meta.rig_type === 'biped';
    meta.rig_model = biped ? RIG_BIPED : RIG_OTHER; if (biped) meta.spec = 'mixamo';
    const r = await task(job.id, 'rig', () => call('POST', '/animations/rig', { input: state[job.id].character, model: meta.rig_model, rig_type: meta.rig_type, ...(biped ? { spec: 'mixamo' } : {}), out_format: 'glb' }));
    sizes['char.glb'] = await download(r.output.model_url, path.join(out, 'char.glb')); meta.rigged = true; log(job.id, 'character done', meta.rig_type);
  })();
  const rs = await Promise.allSettled([character, ...parts]);
  const bad = rs.filter((x) => x.status === 'rejected').map((x) => x.reason.message);
  if (bad.length) throw new Error(bad.join(' | ') + ' (finished files are kept; models.json is not written, so a re-run resumes from the saved task ids)');
  fs.writeFileSync(path.join(out, 'models.json'), JSON.stringify({ source: 'tripo', generated: new Date().toISOString(), from: 'Model Editor approved sheet', model: MODEL, tasks: state[job.id], ...meta, parts: Object.keys(job.parts || {}).filter((pn) => Array.isArray(job.parts[pn])), notes: job.notes || '', fileSizes: sizes }, null, 1));
  return { id: job.id, sizes };
}

const todo = jobs.filter((j) => j.char && (!only.length || only.includes(j.id)));
const pending = todo.filter((j) => !fs.existsSync(path.join(OUT_ROOT, j.id, 'models.json')));
const estimate = pending.reduce((s, j) => s + COST.mesh * (1 + Object.values(j.parts || {}).filter(Array.isArray).length) + (j.tripo_rig === false ? 0 : COST.rig), 0);
const bal = await call('GET', '/account/balance');
log(`Tripo balance ${bal.balance} credits (${bal.frozen} frozen). ${pending.length} model(s) to make, estimated ${estimate} credits.`);
if (DRY) { log('DRY RUN: nothing started:', pending.map((j) => j.id).join(', ')); process.exit(0); }
if (bal.balance < estimate) { console.error(`Not enough Tripo credits: need about ${estimate}, have ${bal.balance}. Nothing was started. Ken tops up, or run with a shorter "only" list.`); process.exit(1); }
const results = [], queue = [...todo];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const j = queue.shift();
    try { results.push(await run(j)); } catch (e) { log('FAILED', j.id, e.message); results.push({ id: j.id, error: e.message }); if (/Out of Tripo credits|TRIPO_API_KEY/.test(e.message)) queue.length = 0; }
  }
}));
const after = await call('GET', '/account/balance').catch(() => ({}));
fs.writeFileSync(path.join(TRIPO_DIR, 'last-run.json'), JSON.stringify({ at: new Date().toISOString(), creditsSpentThisRun: spent, balanceAfter: after.balance, results }, null, 1));
log('finished', JSON.stringify({ creditsSpent: spent, balanceAfter: after.balance, results }));
if (results.some((r) => r.error)) process.exitCode = 0; // keep what succeeded; failures are listed in last-run.json

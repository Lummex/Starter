// Makes still pictures (avatars, icons...) with Runway's image model, matching the look of reference pictures.
// Input:  factory-design/runway-images/jobs*.json  { jobs: [ { id, prompt, refs: [ { file, tag } ], ratio?, model? } ] }
//         refs = pictures next to the jobs file; the prompt names them as @tag (max 3).
// Output: factory-design/runway-images/out/<id>.png + <id>.json (status, model, cost estimate).
// Runs ONCE per job: a job whose <id>.json says "done" is skipped (never paid for twice). Up to 4 jobs at a time.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'factory-design/runway-images');
const OUT = path.join(DIR, 'out');
const KEY = process.env.RUNWAY_API_KEY;
const API = 'https://api.dev.runwayml.com/v1';
if (!KEY) throw new Error('RUNWAY_API_KEY is missing');
const only = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const PARALLEL = Number(process.env.PARALLEL || 4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Runway-Version': '2024-11-06' };

async function call(method, p, body) {
  for (let i = 0; ; i++) {
    const r = await fetch(API + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    if (r.ok) return JSON.parse(t);
    if ((r.status === 429 || r.status >= 500) && i < 6) { await sleep(10000 * (i + 1)); continue; }
    const e = new Error(`${method} ${p} -> ${r.status} ${t.slice(0, 500)}`); e.status = r.status; throw e;
  }
}
const mime = (f) => (f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

const jobs = [];
for (const f of fs.readdirSync(DIR).filter((f) => /^jobs.*\.json$/.test(f)).sort()) {
  for (const j of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).jobs || []) jobs.push(j);
}
fs.mkdirSync(OUT, { recursive: true });
const done = (id) => { try { return JSON.parse(fs.readFileSync(path.join(OUT, id + '.json'), 'utf8')).status === 'done'; } catch { return false; } };
const todo = jobs.filter((j) => (!only.length || only.includes(j.id)) && !done(j.id));
log(todo.length, 'picture(s) to make');

async function run(job) {
  const model = job.model || 'gen4_image';
  const ratio = job.ratio || '1080:1080';
  const referenceImages = (job.refs || []).slice(0, 3).map((r) => ({ uri: `data:${mime(r.file)};base64,` + fs.readFileSync(path.join(DIR, r.file)).toString('base64'), tag: r.tag }));
  const task = await call('POST', '/text_to_image', { model, promptText: job.prompt.slice(0, 1000), ratio, referenceImages });
  log(job.id, 'started', task.id);
  let t;
  for (;;) {
    t = await call('GET', `/tasks/${task.id}`);
    if (t.status === 'SUCCEEDED') break;
    if (['FAILED', 'CANCELLED', 'CANCELED'].includes(t.status)) throw new Error(`${t.status}: ${t.failure || ''} ${t.failureCode || ''}`);
    await sleep(5000);
  }
  fs.writeFileSync(path.join(OUT, job.id + '.png'), Buffer.from(await (await fetch(t.output[0])).arrayBuffer()));
  const credits = model === 'gen4_image' ? (ratio.startsWith('1080') || ratio.startsWith('1920') ? 8 : 5) : 2;
  return { id: job.id, status: 'done', model, ratio, taskId: task.id, credits, usd: credits / 100, at: new Date().toISOString() };
}

const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(PARALLEL, todo.length) }, async () => {
  while (next < todo.length) {
    const j = todo[next++];
    let res;
    try { res = await run(j); } catch (e) { res = { id: j.id, status: 'failed', error: e.message, at: new Date().toISOString() }; }
    fs.writeFileSync(path.join(OUT, j.id + '.json'), JSON.stringify(res, null, 1));
    log(j.id, res.status, res.error || '');
    results.push(res);
  }
}));
fs.writeFileSync(path.join(DIR, 'last-run.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
log('finished:', results.filter((r) => r.status === 'done').length, 'made,', results.filter((r) => r.status !== 'done').length, 'failed,',
  '$' + results.reduce((s, r) => s + (r.usd || 0), 0).toFixed(2));

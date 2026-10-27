// Makes short Runway reference videos of a character doing one move (idle, walk, attack...).
// The Blender worker uses the frames as visual reference so its animation matches the owner's wish.
// Input:  factory-design/runway-jobs/jobs.json  { jobs: [ { id, image, prompt, duration?, ratio?, model? } ] }
//         image = a picture next to jobs.json (a still of the character's 3D model).
// Output: factory-design/runway/<id>/clip.mp4, frames/fNN.jpg, sheet.jpg, info.json
// Runs ONCE per job: a job whose info.json exists is skipped (never paid for twice).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const JOBS_DIR = path.join(ROOT, 'factory-design/runway-jobs');
const OUT_ROOT = path.join(ROOT, 'factory-design/runway');
const KEY = process.env.RUNWAY_API_KEY;
const API = 'https://api.dev.runwayml.com/v1';
if (!KEY) throw new Error('RUNWAY_API_KEY is missing');
const only = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const { jobs } = JSON.parse(fs.readFileSync(path.join(JOBS_DIR, 'jobs.json'), 'utf8'));
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
function mime(f) { return f.endsWith('.png') ? 'image/png' : 'image/jpeg'; }

async function run(job) {
  const out = path.join(OUT_ROOT, job.id);
  if (fs.existsSync(path.join(out, 'info.json'))) { log(job.id, 'already made; skip'); return { id: job.id, skipped: true }; }
  fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
  const img = `data:${mime(job.image)};base64,` + fs.readFileSync(path.join(JOBS_DIR, job.image)).toString('base64');
  const model = job.model || 'gen4.5';
  const ratio = job.ratio || '1280:720';
  // Try the asked length first (owner wants about 3 s); if this model does not allow it, use 5 s.
  const asked = job.duration || 3;
  let duration = asked, task;
  const tries = [...new Set([asked, asked > 5 ? 10 : 5, 5])];
  for (const d of tries) {
    try { task = await call('POST', '/image_to_video', { model, promptImage: img, promptText: job.prompt, ratio, duration: d }); duration = d; break; }
    catch (e) { if (e.status === 400 && d !== tries[tries.length - 1]) { log(job.id, `length ${d}s not allowed:`, e.message.slice(0, 200)); continue; } throw e; }
  }
  log(job.id, 'started', task.id, model, `${duration}s`);
  let t;
  for (;;) {
    t = await call('GET', `/tasks/${task.id}`);
    if (t.status === 'SUCCEEDED') break;
    if (t.status === 'FAILED' || t.status === 'CANCELLED' || t.status === 'CANCELED') throw new Error(`${job.id} ${t.status}: ${t.failure || ''} ${t.failureCode || ''}`);
    await sleep(8000);
  }
  const url = t.output[0];
  const clip = path.join(out, 'clip.mp4');
  fs.writeFileSync(clip, Buffer.from(await (await fetch(url)).arrayBuffer()));
  // Frames for the animator. A clip can hold several moves one after another ("segments": [{move, from, to}] in seconds
  // of the asked length); each move gets its own frames folder and contact sheet. Times are scaled if Runway made a different length.
  const segs = (job.segments && job.segments.length ? job.segments : [{ move: job.move || 'move', from: 0, to: asked }])
    .map((g) => ({ ...g, from: g.from * duration / asked, to: g.to * duration / asked }));
  const n = job.frames || 12;
  for (const g of segs) {
    const dir = path.join(out, 'frames', segs.length > 1 ? g.move : '');
    fs.mkdirSync(dir, { recursive: true });
    const len = g.to - g.from;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(g.from), '-t', String(len), '-i', clip, '-vf', `fps=${n}/${len},scale=640:-2`, '-frames:v', String(n), '-q:v', '3', path.join(dir, 'f%02d.jpg')]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(g.from), '-t', String(len), '-i', clip, '-vf', `fps=${n}/${len},scale=320:-2,tile=4x${Math.ceil(n / 4)}`, '-frames:v', '1', '-q:v', '3', path.join(out, segs.length > 1 ? `sheet-${g.move}.jpg` : 'sheet.jpg')]);
  }
  const info = { id: job.id, character: job.character, move: job.move, prompt: job.prompt, model, ratio, duration, taskId: task.id, made: new Date().toISOString(), view: job.view || 'front', segments: segs, framesPerMove: n, approved: false };
  fs.writeFileSync(path.join(out, 'info.json'), JSON.stringify(info, null, 1));
  log(job.id, 'done', segs.length, 'moves');
  return { id: job.id, duration, moves: segs.map((g) => g.move) };
}

const todo = jobs.filter((j) => !only.length || only.includes(j.id));
const results = [];
for (const j of todo) {
  try { results.push(await run(j)); } catch (e) { log('FAILED', j.id, e.message); results.push({ id: j.id, error: e.message }); }
}
fs.mkdirSync(OUT_ROOT, { recursive: true });
fs.writeFileSync(path.join(JOBS_DIR, 'last-run.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
log('finished', JSON.stringify(results));

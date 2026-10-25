import { guarded, gh, readJson } from './_lib.js';

// 3D Production: the Blender job queue lives on the `blender-queue` branch, one folder per job:
//   blender-jobs/<id>/job.json   (spec + state)   blender-jobs/<id>/out/...  (results from the Windows worker)
// GET              -> jobs + worker status
// GET ?job=<id>    -> one job with its output files
// GET ?file=<path> -> a result file (pictures, reports, GLB) streamed through the dashboard (the repo is private)
// POST {action: create|cancel|retry|approve|reject, ...}
const BRANCH = 'blender-queue';
const DIR = 'blender-jobs';
const ID_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const NAME_RE = /^[A-Za-z0-9_]{1,48}$/;
const SRC_RE = /^(local:[^\0<>|"*?]{3,300}\.(glb|gltf)|repo:[A-Za-z0-9_./-]{3,300}\.glb(@[A-Za-z0-9_./-]{1,100})?)$/i;
const FILE_RE = /^blender-jobs\/[a-z0-9][a-z0-9-]{2,63}\/(job\.json|out\/[A-Za-z0-9_.-]{1,120})$/;

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const fromB64 = (s) => Buffer.from(s, 'base64').toString('utf8');
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

async function tryGh(method, endpoint, body) {
  try { return await gh(method, endpoint, body); } catch (e) { if (String(e.message).includes('(404)')) return null; throw e; }
}

async function ensureBranch() {
  if (await tryGh('GET', `git/ref/heads/${BRANCH}`)) return;
  const main = await gh('GET', 'git/ref/heads/main');
  try { await gh('POST', 'git/refs', { ref: `refs/heads/${BRANCH}`, sha: main.object.sha }); } catch (e) { if (!String(e.message).includes('(422)')) throw e; }
}

async function readJob(id) {
  const f = await tryGh('GET', `contents/${DIR}/${id}/job.json?ref=${BRANCH}`);
  if (!f) return null;
  return { job: JSON.parse(fromB64(f.content)), sha: f.sha };
}

async function writeJob(id, job, sha, msg) {
  job.updated_at = now();
  return gh('PUT', `contents/${DIR}/${id}/job.json`, { message: `blender job ${id}: ${msg}`, content: b64(JSON.stringify(job, null, 1) + '\n'), branch: BRANCH, ...(sha ? { sha } : {}) });
}

// Read-modify-write with the file's sha, so a change never overwrites the worker's newer update.
async function changeJob(id, fn, msg) {
  for (let i = 0; i < 4; i++) {
    const r = await readJob(id);
    if (!r) { const e = new Error('Job not found.'); e.status = 404; throw e; }
    const out = fn(r.job);
    if (out === false) return r.job;
    try { await writeJob(id, r.job, r.sha, msg); return r.job; } catch (e) { if (!/\((409|422)\)/.test(e.message)) throw e; }
  }
  throw new Error('The job was busy; please try again.');
}

function summary(j) {
  return { id: j.id, type: j.type, asset_id: j.asset_id, status: j.status, priority: j.priority, created_at: j.created_at,
    updated_at: j.updated_at, progress: j.progress, error: j.error, worker_id: j.worker_id, heartbeat_at: j.heartbeat_at,
    lease_until: j.lease_until, retries: j.retries, cancel_requested: j.cancel_requested,
    animations: (j.animations || []).map((a) => a.name), result: j.result ? { summary: j.result.summary } : null, review: j.review || null };
}

function clean(s, max) { return String(s ?? '').slice(0, max); }

function buildJob(b) {
  const type = b.type === 'animate' ? 'animate' : b.type === 'inspect' ? 'inspect' : null;
  if (!type) throw Object.assign(new Error('Type must be inspect or animate.'), { status: 400 });
  const asset = clean(b.asset_id, 64).toLowerCase();
  if (!ID_RE.test(asset)) throw Object.assign(new Error('Asset id: lowercase letters, digits and dashes (e.g. goblin-slinger).'), { status: 400 });
  const character = clean(b.character, 320).trim();
  if (!SRC_RE.test(character)) throw Object.assign(new Error('Source model must look like local:~/Downloads/.../char.glb or repo:path/char.glb'), { status: 400 });
  const parts = {};
  for (const [k, v] of Object.entries(b.parts || {})) {
    if (!ID_RE.test(k) || !SRC_RE.test(String(v))) throw Object.assign(new Error(`Bad part ${k}`), { status: 400 });
    parts[k] = String(v);
  }
  const animations = [];
  if (type === 'animate') {
    for (const a of (b.animations || []).slice(0, 4)) {
      if (!NAME_RE.test(a.name || '')) throw Object.assign(new Error('Clip names: letters, digits and _ only (e.g. Skull_Throw).'), { status: 400 });
      const fr = Array.isArray(a.frames) ? a.frames.map(Number).filter((x) => x > 0 && x <= 600).slice(0, 2) : null;
      animations.push({ name: a.name, description: clean(a.description, 2000), ...(fr && fr.length === 2 ? { frames: fr } : {}),
        loop: !!a.loop, return_to_idle: a.return_to_idle !== false, replace: !!a.replace, feet_may_move: !!a.feet_may_move,
        events: (a.events || []).slice(0, 8).filter((e) => NAME_RE.test(e.name || '')).map((e) => ({ name: e.name, bone: clean(e.bone, 48) })) });
    }
    if (!animations.length) throw Object.assign(new Error('Add at least one clip.'), { status: 400 });
  }
  const stamp = now().replace(/[-:TZ]/g, '').slice(0, 12);
  const id = `${asset}-${type}-${stamp}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 64);
  return {
    id, type, asset_id: asset, status: 'queued', priority: Math.max(1, Math.min(9, Number(b.priority) || 5)),
    created_at: now(), created_by: 'dashboard', retries: 0, max_retries: 2, retry_on_failure: false, cancel_requested: false,
    worker_id: null, lease_until: null, heartbeat_at: null, error: null,
    progress: { stage: 'queued', percent: 0, message: 'Waiting for the Blender worker' },
    source: { character, ...(Object.keys(parts).length ? { parts } : {}) },
    request: clean(b.request, 4000), animations,
    attachments: (b.attachments || []).slice(0, 4).filter((a) => parts[a.part]).map((a) => ({ part: a.part, bone: clean(a.bone, 48), note: clean(a.note, 300) })),
    output: { format: 'glb' }, history: [{ at: now(), status: 'queued', by: 'dashboard' }],
  };
}

export default guarded(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET') {
    const file = url.searchParams.get('file');
    if (file) {
      if (!FILE_RE.test(file) || file.includes('..')) return res.status(400).json({ error: 'Bad file path.' });
      const meta = await tryGh('GET', `contents/${file}?ref=${BRANCH}`);
      if (!meta) return res.status(404).json({ error: 'Not found.' });
      let buf;
      if (meta.content) buf = Buffer.from(meta.content, 'base64');
      else {
        const r = await fetch(meta.download_url || '', { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } });
        buf = Buffer.from(await r.arrayBuffer());
      }
      const ext = file.split('.').pop().toLowerCase();
      const type = { png: 'image/png', json: 'application/json', glb: 'model/gltf-binary', txt: 'text/plain; charset=utf-8' }[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      if (!['png', 'json', 'txt'].includes(ext)) res.setHeader('Content-Disposition', `attachment; filename="${file.split('/').pop()}"`);
      return res.status(200).send(buf);
    }
    const id = url.searchParams.get('job');
    if (id) {
      if (!ID_RE.test(id)) return res.status(400).json({ error: 'Bad job id.' });
      const r = await readJob(id);
      if (!r) return res.status(404).json({ error: 'Job not found.' });
      const outs = (await tryGh('GET', `contents/${DIR}/${id}/out?ref=${BRANCH}`)) || [];
      return res.json({ job: r.job, files: Array.isArray(outs) ? outs.map((f) => ({ name: f.name, size: f.size, path: f.path })) : [] });
    }
    const dirs = await tryGh('GET', `contents/${DIR}?ref=${BRANCH}`);
    if (!dirs) return res.json({ jobs: [], workers: [], branch: false });
    const jobDirs = dirs.filter((d) => d.type === 'dir' && ID_RE.test(d.name)).slice(-40);
    const jobs = (await Promise.all(jobDirs.map((d) => readJob(d.name).catch(() => null)))).filter(Boolean).map((r) => summary(r.job));
    jobs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const wdir = (await tryGh('GET', `contents/${DIR}/_workers?ref=${BRANCH}`)) || [];
    const workers = (await Promise.all((Array.isArray(wdir) ? wdir : []).filter((f) => f.name.endsWith('.json')).map(async (f) => {
      const x = await tryGh('GET', `contents/${f.path}?ref=${BRANCH}`).catch(() => null);
      try { return x ? JSON.parse(fromB64(x.content)) : null; } catch { return null; }
    }))).filter(Boolean);
    return res.json({ jobs, workers, branch: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const b = await readJson(req);
  if (b.action === 'create') {
    await ensureBranch();
    const job = buildJob(b);
    await writeJob(job.id, job, null, 'queued from dashboard');
    return res.json({ ok: true, id: job.id });
  }
  const id = String(b.id || '');
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'Bad job id.' });
  const hist = (j, status, extra = {}) => { (j.history ||= []).push({ at: now(), status, by: 'dashboard', ...extra }); };
  let job;
  if (b.action === 'cancel') {
    job = await changeJob(id, (j) => {
      if (['completed', 'cancelled'].includes(j.status)) return false;
      j.cancel_requested = true;
      if (['queued', 'failed', 'awaiting_review'].includes(j.status)) { j.status = 'cancelled'; j.progress = { stage: 'cancelled', percent: 0, message: 'Cancelled' }; hist(j, 'cancelled'); }
    }, 'cancel');
  } else if (b.action === 'retry') {
    job = await changeJob(id, (j) => {
      if (!['failed', 'cancelled'].includes(j.status)) return false;
      Object.assign(j, { status: 'queued', cancel_requested: false, error: null, worker_id: null, lease_until: null, retries: 0,
        progress: { stage: 'queued', percent: 0, message: 'Waiting for the Blender worker' } });
      hist(j, 'queued', { retry: true });
    }, 'retry');
  } else if (b.action === 'approve' || b.action === 'reject') {
    job = await changeJob(id, (j) => {
      if (j.status !== 'awaiting_review') return false;
      j.status = b.action === 'approve' ? 'completed' : 'failed';
      j.review = { decision: b.action === 'approve' ? 'approved' : 'changes requested', note: clean(b.note, 2000), at: now() };
      if (b.action === 'reject') j.error = { message: `Owner asked for changes: ${clean(b.note, 500)}`, at: now() };
      hist(j, j.status, { review: j.review.decision });
    }, b.action);
  } else return res.status(400).json({ error: 'Unknown action.' });
  return res.json({ ok: true, job: summary(job) });
});

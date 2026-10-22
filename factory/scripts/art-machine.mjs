// Oreheart art machine: turns art requests into pictures with OpenAI's image model.
// Reads  factory-design/art-requests/*.json   ({ requests: [ {id, cardName, kind, size, prompt, n?, references?: [repo paths]} ] })
// Writes factory-design/art-made/<id>-<n>.png (full size) and factory-design/art-made/<id>.json (status + small previews).
// The key comes from the OPENAI_API_KEY environment variable (GitHub secret CHAT_GPT_KEY). Never print it.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REQ_DIR = path.join(ROOT, 'factory-design/art-requests');
const OUT_DIR = path.join(ROOT, 'factory-design/art-made');
const KEY = process.env.OPENAI_API_KEY || '';
const MODELS = (process.env.ART_MODEL || 'gpt-image-2,gpt-image-1').split(',').map(s => s.trim()).filter(Boolean);
const QUALITY = process.env.ART_QUALITY || 'high';
const MAX_PER_RUN = Number(process.env.ART_MAX || 20);
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.log('sharp not available: previews will be skipped'); }

fs.mkdirSync(OUT_DIR, { recursive: true });
const log = (...a) => console.log('[art]', ...a);

function readRequests() {
  if (!fs.existsSync(REQ_DIR)) return [];
  const all = [];
  for (const f of fs.readdirSync(REQ_DIR).filter(f => f.endsWith('.json')).sort()) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(REQ_DIR, f), 'utf8'));
      for (const r of (j.requests || [])) if (r && r.id && r.prompt) all.push(r);
    } catch (e) { log('could not read', f, e.message); }
  }
  return all.filter(r => !fs.existsSync(path.join(OUT_DIR, safe(r.id) + '.json')));
}
const safe = s => String(s).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);

function friendly(status, body) {
  const msg = (body && body.error && body.error.message) || '';
  if (status === 401) return 'OpenAI rejected the key. Make a new key at platform.openai.com/api-keys and update the GitHub secret CHAT_GPT_KEY.';
  if (status === 429 && /quota|billing|credit/i.test(msg)) return 'The OpenAI account is out of credits. Add credits at platform.openai.com → Billing.';
  if (status === 429) return 'OpenAI is busy (rate limit). Try again in a few minutes.';
  if (status === 403 && /verif/i.test(msg)) return 'OpenAI asks you to verify your organization first: platform.openai.com → Settings → Organization → Verify.';
  if (/safety|moderation|content_policy/i.test(msg)) return 'OpenAI refused this prompt (safety filter). Change the wording and try again.';
  return 'OpenAI error ' + status + ': ' + msg.slice(0, 300);
}

async function callOpenAI(r, model) {
  const n = Math.max(1, Math.min(4, Number(r.n || 2)));
  const size = r.size || '1024x1536';
  const refs = (r.references || []).map(p => path.join(ROOT, p)).filter(p => fs.existsSync(p));
  let res;
  if (refs.length) {
    const fd = new FormData();
    fd.append('model', model); fd.append('prompt', r.prompt); fd.append('n', String(n)); fd.append('size', size); fd.append('quality', QUALITY);
    for (const p of refs) fd.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/png' }), path.basename(p));
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + KEY }, body: fd });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: r.prompt, n, size, quality: QUALITY })
    });
  }
  let body = null; try { body = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, body };
}

async function make(r) {
  const id = safe(r.id);
  let last = null;
  for (const model of MODELS) {
    log('making', id, '(' + (r.kind || 'art') + ') with', model);
    let out = await callOpenAI(r, model);
    if (!out.ok && out.status === 400 && /size/i.test(JSON.stringify(out.body || ''))) { log('size not accepted, trying auto'); out = await callOpenAI({ ...r, size: 'auto' }, model); }
    if (out.ok) {
      const files = [], previews = [];
      for (const [i, d] of (out.body.data || []).entries()) {
        let buf = null;
        if (d.b64_json) buf = Buffer.from(d.b64_json, 'base64');
        else if (d.url) buf = Buffer.from(await (await fetch(d.url)).arrayBuffer());
        if (!buf) continue;
        const rel = 'factory-design/art-made/' + id + '-' + (i + 1) + '.png';
        fs.writeFileSync(path.join(ROOT, rel), buf); files.push(rel);
        if (sharp) { const p = await sharp(buf).resize({ width: 360 }).webp({ quality: 66 }).toBuffer(); previews.push('data:image/webp;base64,' + p.toString('base64')); }
      }
      return { id: r.id, status: files.length ? 'done' : 'failed', error: files.length ? '' : 'OpenAI sent no pictures back.', model, files, previews, kind: r.kind, cardName: r.cardName, at: new Date().toISOString() };
    }
    last = out;
    const msg = JSON.stringify(out.body || '');
    const modelProblem = (out.status === 400 || out.status === 404) && /model/i.test(msg);
    if (!modelProblem) break;
    log('model', model, 'not available, trying the next one');
  }
  return { id: r.id, status: 'failed', error: friendly(last.status, last.body), files: [], previews: [], kind: r.kind, cardName: r.cardName, at: new Date().toISOString() };
}

const todo = readRequests().slice(0, MAX_PER_RUN);
log(todo.length, 'request(s) to make');
if (todo.length && !KEY) {
  for (const r of todo) fs.writeFileSync(path.join(OUT_DIR, safe(r.id) + '.json'), JSON.stringify({ id: r.id, status: 'failed', error: 'No OpenAI key: add the GitHub secret CHAT_GPT_KEY.', files: [], previews: [], at: new Date().toISOString() }, null, 1));
  process.exit(0);
}
let made = 0, failed = 0;
for (const r of todo) {
  let res;
  try { res = await make(r); } catch (e) { res = { id: r.id, status: 'failed', error: 'Art machine crashed: ' + e.message, files: [], previews: [], at: new Date().toISOString() }; }
  fs.writeFileSync(path.join(OUT_DIR, safe(r.id) + '.json'), JSON.stringify(res, null, 1));
  res.status === 'done' ? made++ : failed++;
  log(r.id, res.status, res.error || res.files.join(', '));
}
log('finished:', made, 'made,', failed, 'failed');

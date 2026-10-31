// Makes voice lines (text-to-speech) and sound effects through the Runway API (Brush, 2026-10-31).
// Input:  factory-design/runway-audio/jobs.json
//   { voices: { <voiceId>: { preset: "<Runway preset voice name>" } },
//     lines:  [ { id, voice, text } ],          -> factory-design/runway-audio/out/<id>.mp3
//     sfx:    [ { id, prompt, duration? } ] }    -> factory-design/runway-audio/out/<id>.mp3
// MODE=probe: makes nothing; asks the API which models / preset voices exist and logs the answers (costs nothing).
// MODE=run: makes every line / sfx whose file does not exist yet (never pays twice). ONLY = comma-separated ids or voice ids.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'factory-design/runway-audio');
const OUT = path.join(DIR, 'out');
const KEY = process.env.RUNWAY_API_KEY;
const API = 'https://api.dev.runwayml.com/v1';
const MODE = process.env.MODE || 'run';
const only = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!KEY) throw new Error('RUNWAY_API_KEY is missing');
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Runway-Version': '2024-11-06' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function call(method, p, body) {
  for (let i = 0; ; i++) {
    const r = await fetch(API + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    if (r.ok) return JSON.parse(t);
    if ((r.status === 429 || r.status >= 500) && i < 6) { await sleep(8000 * (i + 1)); continue; }
    const e = new Error(`${method} ${p} -> ${r.status} ${t.slice(0, 1500)}`); e.status = r.status; throw e;
  }
}
async function task(id) {
  for (;;) {
    const t = await call('GET', `/tasks/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (['FAILED', 'CANCELLED', 'CANCELED'].includes(t.status)) throw new Error(`task ${t.status}: ${t.failure || ''} ${t.failureCode || ''}`);
    await sleep(3000);
  }
}
async function save(url, file) { fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer())); }

if (MODE === 'probe') {
  const tries = [
    ['/text_to_speech', { model: 'eleven_multilingual_v2', promptText: 'Hello.', voice: { type: 'runway-preset', presetId: '__list_please__' } }],
    ['/sound_effect', { model: 'eleven_text_to_sound_v2', promptText: '', duration: 0 }],
    ['/organization', null],
  ];
  for (const [p, b] of tries) {
    try { const r = await call(b ? 'POST' : 'GET', p, b || undefined); log("PROBE", p, "OK", JSON.stringify(r)); }
    catch (e) { log('PROBE', p, e.message); }
  }
  process.exit(0);
}

const jobs = JSON.parse(fs.readFileSync(path.join(DIR, 'jobs.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const want = (x) => !only.length || only.includes(x.id) || (x.voice && only.includes(x.voice));
const todo = [
  ...(jobs.lines || []).filter(want).map((l) => ({ kind: 'tts', ...l })),
  ...(jobs.sfx || []).filter(want).map((s) => ({ kind: 'sfx', ...s })),
].filter((j) => !fs.existsSync(path.join(OUT, j.id + '.mp3')));
log('to make:', todo.length);
const results = [];
async function one(j) {
  try {
    const body = j.kind === 'tts'
      ? { model: 'eleven_multilingual_v2', promptText: j.text, voice: { type: 'runway-preset', presetId: jobs.voices[j.voice].preset } }
      : { model: 'eleven_text_to_sound_v2', promptText: j.prompt, ...(j.duration ? { duration: j.duration } : {}) };
    const t0 = await call('POST', j.kind === 'tts' ? '/text_to_speech' : '/sound_effect', body);
    const t = await task(t0.id);
    await save(t.output[0], path.join(OUT, j.id + '.mp3'));
    results.push({ id: j.id, ok: true }); log('ok', j.id);
  } catch (e) { results.push({ id: j.id, error: e.message }); log('FAILED', j.id, e.message); }
}
// a few at a time (Runway limits concurrent tasks)
for (const j of todo) await one(j);   // Runway allows 1 ElevenLabs task at a time
fs.writeFileSync(path.join(DIR, 'last-run.json'), JSON.stringify({ at: new Date().toISOString(), made: results.filter((r) => r.ok).length, results }, null, 1));
log('finished', results.filter((r) => r.ok).length, 'made,', results.filter((r) => r.error).length, 'failed');

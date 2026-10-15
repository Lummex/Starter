// Generates Goblin card pictures with the xAI Grok image API. Only entries whose file is missing or whose prompt changed are generated.
// Usage: XAI_API_KEY=... node tools/gen-card-art.mjs   (the key is read from the environment and never printed)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = new URL('..', import.meta.url).pathname;
const entries = JSON.parse(fs.readFileSync(path.join(root, 'src/content/card-art.json'), 'utf8'));
const hashFile = path.join(root, 'public/art/cards/.hashes.json');
const hashes = fs.existsSync(hashFile) ? JSON.parse(fs.readFileSync(hashFile, 'utf8')) : {};
const key = process.env.XAI_API_KEY;
const MODEL = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image';
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

async function generate(prompt) {
  const r = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, prompt, n: 1, response_format: 'b64_json' }),
  });
  if (!r.ok) throw new Error(`xAI API ${r.status}`);
  const j = await r.json();
  const d = j.data && j.data[0];
  if (!d) throw new Error('no image');
  if (d.b64_json) return Buffer.from(d.b64_json, 'base64');
  const img = await fetch(d.url);
  return Buffer.from(await img.arrayBuffer());
}

async function save(buf, file, size = 512) {
  let q = 80;
  let out;
  do { out = await sharp(buf).resize(size, size, { fit: 'cover' }).webp({ quality: q }).toBuffer(); q -= 10; } while (out.length > 190000 && q > 20);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
}

const fallback = [];
for (const e of entries) {
  const file = path.join(root, 'public', e.file);
  const h = hash(e.prompt);
  if (fs.existsSync(file) && hashes[e.cardId] === h) continue;
  let ok = false;
  for (let attempt = 0; attempt < 3 && key && !ok; attempt++) {
    try { await save(await generate(e.prompt), file); hashes[e.cardId] = h; ok = true; console.log('generated', e.cardId); }
    catch (err) { console.log('retry', e.cardId, String(err.message || err)); }
  }
  if (!ok) { fallback.push(e.cardId); console.log('FALLBACK needed for', e.cardId); }
}
fs.writeFileSync(hashFile, JSON.stringify(hashes, null, 1));
if (fallback.length) console.log('Cards without a generated picture (use the 3D figure render fallback):', fallback.join(', '));

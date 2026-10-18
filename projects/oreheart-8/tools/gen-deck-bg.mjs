// One-off: paints the Deck Builder background (no text) with the xAI image API. Key comes from XAI_API_KEY.
import fs from 'node:fs';
import sharp from 'sharp';
const key = process.env.XAI_API_KEY;
const prompt = 'dark fantasy painted game background, wide landscape, a dark underground goblin war room and forge cavern, stone war table in the middle distance, hanging iron lanterns, rich glowing green, blue and purple crystals lighting the stone walls, soft fog and embers, moody and dim so foreground cards stand out, painterly digital art, no text, no letters, no characters, no UI';
const r = await fetch('https://api.x.ai/v1/images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: 'grok-imagine-image', prompt, n: 1, response_format: 'b64_json' }) });
if (!r.ok) { console.log('failed', r.status, await r.text()); process.exit(1); }
const j = await r.json();
const buf = Buffer.from(j.data[0].b64_json, 'base64');
fs.mkdirSync('public/art/ui', { recursive: true });
fs.writeFileSync('public/art/ui/deck-builder-bg.webp', await sharp(buf).resize(1280, 720, { fit: 'cover' }).webp({ quality: 70 }).toBuffer());
console.log('ok');

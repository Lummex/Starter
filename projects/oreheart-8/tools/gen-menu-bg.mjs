// One-off: paints the main-menu cavern background (no text) with the xAI image API. Key comes from XAI_API_KEY.
import fs from 'node:fs';
import sharp from 'sharp';
const key = process.env.XAI_API_KEY;
const prompt = 'dark fantasy mobile game main menu background, wide landscape, a dark underground cavern lit by glowing crystals: on the left a fierce green goblin warrior with a pickaxe and spiked armor beside huge glowing green crystals and a red banner, in the middle low a bearded gnome engineer with goggles and a brass crystal gun beside small blue crystals, on the right a stout red-bearded dwarf in heavy armor with a big hammer beside huge glowing white crystals, the center of the image is dark and empty, rich painted style, dramatic rim lighting, black rocks, embers, no text, no letters, no logos, no watermark, original characters';
const r = await fetch('https://api.x.ai/v1/images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: 'grok-imagine-image', prompt, n: 1, aspect_ratio: '16:9', response_format: 'b64_json' }) });
if (!r.ok) { console.log('failed', r.status); process.exit(1); }
const j = await r.json();
const buf = Buffer.from(j.data[0].b64_json, 'base64');
fs.mkdirSync('public/art', { recursive: true });
fs.writeFileSync('public/art/menu-bg.webp', await sharp(buf).resize(1280, 720, { fit: 'cover' }).webp({ quality: 72 }).toBuffer());
console.log('ok');

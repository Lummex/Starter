// Round 6a: paints the card back and the ruby heart with the xAI image API (no text); the OREHEART logo is composited on the back afterwards.
import fs from 'node:fs';
import sharp from 'sharp';
const key = process.env.XAI_API_KEY;
async function gen(prompt) {
  const r = await fetch('https://api.x.ai/v1/images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: 'grok-imagine-image', prompt, n: 1, response_format: 'b64_json' }) });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()));
  return Buffer.from((await r.json()).data[0].b64_json, 'base64');
}
const which = process.argv[2];
if (which === 'back') {
  const buf = await gen('portrait playing card back design, symmetrical, very dark near-black purple and deep indigo background, ornate gold filigree border with rounded corners, intricate gold scrollwork, a large glowing cyan-violet crystal gem motif in the center surrounded by a dark empty circular medallion with gold ring, rich painted fantasy style, vertical 2:3 portrait, absolutely no text, no letters, no words, no numbers');
  const W = 576, H = 856;
  const base = await sharp(buf).resize(W, H, { fit: 'cover' }).toBuffer();
  const logo = await sharp('public/art/logo.webp').resize({ width: Math.round(W * 0.74), fit: 'inside' }).toBuffer();
  const out = await sharp(base).composite([{ input: logo, gravity: 'centre' }]).webp({ quality: 82 }).toBuffer();
  fs.writeFileSync('public/art/ui/card-back.webp', out);
  console.log('back ok');
} else {
  const buf = await gen('a single glossy faceted ruby heart gem icon, deep red with bright highlights and a thin gold rim, centered on a plain pure black background, painted fantasy game icon, no text');
  const out = await sharp(buf).resize(256, 256, { fit: 'cover' }).png().toBuffer();
  fs.writeFileSync('/tmp/heart-raw.png', out);
  console.log('heart raw ok');
}

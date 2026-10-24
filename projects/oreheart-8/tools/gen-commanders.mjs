// Generates borderless full-art Commander portraits with the xAI image API (key from the environment, never printed).
import fs from 'node:fs';
import sharp from 'sharp';
const key = process.env.XAI_API_KEY;
const STYLE = 'rich dark-fantasy painted card illustration, glowing crystals, moody lighting, detailed, full-bleed portrait composition, no text, no letters, no frame, no border';
const P = {
  grubnak: `Grubnak Rotgut, fat grinning goblin king with a crooked gold crown with purple gems, fur-trimmed purple cape, gold chains, sitting on a throne of junk and scrap, rocket barrel beside him, green glow, ${STYLE}`,
  sproingle: `Archmagister Sproingle, an elderly eccentric gnome wizard with a huge white beard, brass goggles, gear-covered robes and a crackling blue crystal staff, floating gears around him, blue glow, ${STYLE}`,
  sprocket: `Madame Sprocket, a stern clever gnome engineer woman with brass goggles, a mechanical arm and tools, steam and gears, blue glow, ${STYLE}`,
  borgo: `Thane Borgo Gravelgrim, a mighty armored dwarf lord with a braided grey beard, runed war hammer and heavy plate armor, forge fire and purple rune glow, ${STYLE}`,
};
for (const [id, prompt] of Object.entries(P)) {
  const file = `public/art/commanders/${id}.webp`;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch('https://api.x.ai/v1/images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: 'grok-imagine-image', prompt, n: 1, response_format: 'b64_json', aspect_ratio: '3:4' }) });
      if (!r.ok) throw new Error('status ' + r.status);
      const d = (await r.json()).data[0];
      const buf = d.b64_json ? Buffer.from(d.b64_json, 'base64') : Buffer.from(await (await fetch(d.url)).arrayBuffer());
      await sharp(buf).resize(480, 640, { fit: 'cover' }).webp({ quality: 78 }).toFile(file);
      console.log('ok', id); break;
    } catch (e) { console.log('retry', id, String(e.message)); }
  }
}

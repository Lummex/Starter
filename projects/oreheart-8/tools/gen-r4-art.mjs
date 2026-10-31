// Round 4 art via the xAI image API (key from XAI_API_KEY): spell frames (temporary until owner files arrive), gold/silver metal textures, Venom Shiv picture.
// Existing outputs are skipped. Usage: XAI_API_KEY=... node tools/gen-r4-art.mjs
import fs from 'node:fs';
import sharp from 'sharp';
const key = process.env.XAI_API_KEY;
async function gen(prompt) {
  const r = await fetch('https://api.x.ai/v1/images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: 'grok-imagine-image', prompt, n: 1, response_format: 'b64_json' }) });
  if (!r.ok) throw new Error('xAI ' + r.status);
  const j = await r.json();
  const d = j.data[0];
  return d.b64_json ? Buffer.from(d.b64_json, 'base64') : Buffer.from(await (await fetch(d.url)).arrayBuffer());
}
const frame = (look) => `ornate fantasy trading card frame, portrait, ${look}, a large empty dark rectangular picture window in the upper two thirds, a round ornate orb socket in the top-left corner and another round orb socket in the bottom-right corner, a dark empty banner strip at the bottom for text, elaborate filigree border, symmetrical, flat front view, game asset, no text, no letters, no numbers, no characters`;
const jobs = [
  ['public/art/frames/spell-frame-goblin.webp', frame('green filigree metal with glowing purple magical glow'), (b) => sharp(b).resize(420, 624, { fit: 'fill' }).webp({ quality: 82 })],
  ['public/art/frames/spell-frame-gnome.webp', frame('polished gold filigree with glowing blue magical glow'), (b) => sharp(b).resize(420, 624, { fit: 'fill' }).webp({ quality: 82 })],
  ['public/art/frames/spell-frame-dwarf.webp', frame('lavender silver filigree with glowing purple magical glow'), (b) => sharp(b).resize(420, 624, { fit: 'fill' }).webp({ quality: 82 })],
  ['public/art/frames/spell-frame-shared.webp', frame('polished silver filigree with rainbow prismatic glow'), (b) => sharp(b).resize(420, 624, { fit: 'fill' }).webp({ quality: 82 })],
  ['public/art/ui/metal-gold.webp', 'seamless tileable photorealistic texture of polished yellow gold metal, rich warm reflections, subtle brushed scratches, flat top-down, fills the whole image, no text, no objects', (b) => sharp(b).resize(512, 512).webp({ quality: 80 })],
  ['public/art/ui/metal-silver.webp', 'seamless tileable photorealistic texture of polished silver metal, cool bright reflections, subtle brushed scratches, flat top-down, fills the whole image, no text, no objects', (b) => sharp(b).resize(512, 512).webp({ quality: 80 })],
  ['public/art/cards/venom-shiv.webp', 'dark fantasy trading card spell art, richly painted: a goblin dagger dripping glowing toxic green poison flying through a dark cave toward a creature, sickly green bubbles, dramatic rim lighting, moody, painterly, no text', (b) => sharp(b).resize(420, 420, { fit: 'cover' }).webp({ quality: 78 })],
];
const SPELLS = {
  'prospectors-prayer': 'a desperate goblin prospector kneeling in a dark mine with a column of golden light and falling glowing crystals',
  'tunnel-rush': 'rats bursting out of a dirt tunnel hole in a cave floor, a goblin popping out of the hole, flying dust',
  fireball: 'a blazing arcane fireball of orange and violet flames flying through a dark cavern',
  'battle-cry': 'a huge steam war horn blasting a red shockwave while armored dwarves glow red behind it',
  'meteor-strike': 'a huge flaming meteor crashing down from a dark sky with sparks and a shockwave',
  'healing-light': 'bandages wrapping a glowing wound with soft green healing light and small crosses',
  'shield-bubble': 'a clanking steel shield device unfolding over a dwarf warrior with a blue energy dome',
  'second-wind': 'gears and wrenches repairing a dark stone fortress gate with warm sparks and glowing hearts',
  fizzle: 'a fizzling cloud of snuffed magic sparks fading into smoke, a shattered rune',
  'hold-it': 'a sneaky green goblin hand snatching a glowing card out of the air',
  'spell-snap': 'a lightning crack shattering a glowing spell circle like glass',
};
for (const [id, desc] of Object.entries(SPELLS)) jobs.push([`public/art/cards/${id}.webp`, `dark fantasy trading card spell art, richly painted: ${desc}, dramatic rim lighting, moody, painterly, no text`, (b) => sharp(b).resize(420, 420, { fit: 'cover' }).webp({ quality: 78 })]);
for (const [out, prompt, fin] of jobs) {
  if (fs.existsSync(out)) continue;
  try { fs.writeFileSync(out, await fin(await gen(prompt)).toBuffer()); console.log('ok', out); } catch (e) { console.log('failed', out, e.message); }
}

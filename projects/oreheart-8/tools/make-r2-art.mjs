// Builds Round 2 art from the owner's files: card frames (webp, plus a grey neutral recolor) and the deck image cut out to real alpha.
import sharp from 'sharp';
const D = '../../factory-design/design/references/';
for (const f of ['goblin', 'gnome', 'dwarf']) await sharp(`${D}card-frames/card-frame-${f}.jpg`).resize(420).webp({ quality: 82 }).toFile(`public/art/frames/card-frame-${f}.webp`);
await sharp(`${D}card-frames/card-frame-goblin.jpg`).resize(420).modulate({ saturation: 0.05, brightness: 1.1 }).tint({ r: 190, g: 195, b: 205 }).webp({ quality: 82 }).toFile('public/art/frames/card-frame-neutral.webp');
const { data, info } = await sharp(`${D}Deck_image.jpg`).resize(600).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const isCheck = (i) => { const r = data[i], g = data[i + 1], b = data[i + 2]; return Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r > 170; };
const seen = new Uint8Array(W * H), stack = [];
const push = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (seen[p] || !isCheck(p * 4)) return; seen[p] = 1; stack.push(p); };
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
while (stack.length) { const p = stack.pop(), x = p % W, y = (p / W) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
// grow the removed area by 1px so no light fringe stays
const out = Buffer.from(data);
for (let p = 0; p < W * H; p++) {
  if (seen[p]) out[p * 4 + 3] = 0;
}
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const p = y * W + x; if (!seen[p] && (seen[p - 1] || seen[p + 1] || seen[p - W] || seen[p + W]) && isCheck(p * 4)) out[p * 4 + 3] = 0; }
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 88, alphaQuality: 100 }).toFile('public/art/deck/deck-image.webp');
console.log('ok', W, H);

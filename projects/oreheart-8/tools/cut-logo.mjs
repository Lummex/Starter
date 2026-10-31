// Cuts the Oreheart logo (factory-design/design/references/main logo.jpg) cleanly from its dark background:
// dark pixels connected to the image edge become transparent, with a soft edge.
import sharp from 'sharp';
const src = process.argv[2];
async function cut(crop, out, width) {
  let img = sharp(src);
  if (crop) img = img.extract(crop);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const lum = (i) => Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const T = 62;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || lum(i) > T) continue;
    seen[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1); if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = seen[i] ? 0 : 255;
  // soften the edge by one pixel
  const alpha = Buffer.from(data.filter((_, k) => k % 4 === 3));
  const { data: soft, info: si } = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(1.2).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = soft[i * si.channels];
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).resize(width).webp({ quality: 88 }).toFile(out);
}
await cut(null, 'public/art/logo.webp', 512);
await cut({ left: 0, top: 640, width: 784, height: 440 }, 'public/art/logo-wide.webp', 640);

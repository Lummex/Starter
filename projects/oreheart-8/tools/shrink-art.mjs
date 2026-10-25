// Re-encodes webp card/owner art at a smaller size (build-size budget, AC90). Usage: node tools/shrink-art.mjs dir maxSide quality
import fs from 'node:fs'; import path from 'node:path'; import sharp from 'sharp';
const [dir, max, q] = process.argv.slice(2);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(dir).filter((f) => f.endsWith('.webp'))) {
  const buf = await sharp(f).resize(+max, +max, { fit: 'inside', withoutEnlargement: true }).webp({ quality: +q }).toBuffer();
  if (buf.length < fs.statSync(f).size) fs.writeFileSync(f, buf);
}

import sharp from 'sharp';
import fs from 'fs';
for (const f of process.argv.slice(2)) {
  const m = await sharp(f).metadata();
  const b = await sharp(f).resize({ height: Math.min(m.height, 1400), withoutEnlargement: true }).png({ palette: true, quality: 85, compressionLevel: 9 }).toBuffer();
  if (b.length < fs.statSync(f).size) fs.writeFileSync(f, b);
  console.log(f, m.width, m.height, fs.statSync(f).size);
}

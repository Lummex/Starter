// Re-encodes the embedded textures of a GLB at <=1024 px JPEG (keeps geometry). Usage: node tools/shrink-glb-textures.mjs in.glb out.glb
import fs from 'node:fs';
import sharp from 'sharp';
const [inp, out] = process.argv.slice(2);
const b = fs.readFileSync(inp);
const jl = b.readUInt32LE(12);
const json = JSON.parse(b.subarray(20, 20 + jl).toString());
const binStart = 20 + jl + 8;
const bin = b.subarray(binStart);
const chunks = json.bufferViews.map((bv) => bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength));
for (const im of json.images) {
  const buf = await sharp(chunks[im.bufferView]).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 88 }).toBuffer();
  chunks[im.bufferView] = buf; im.mimeType = 'image/jpeg';
}
let off = 0; const parts = [];
json.bufferViews.forEach((bv, i) => { bv.byteOffset = off; bv.byteLength = chunks[i].length; const pad = (4 - (chunks[i].length % 4)) % 4; parts.push(chunks[i], Buffer.alloc(pad)); off += chunks[i].length + pad; });
json.buffers[0].byteLength = off;
const nb = Buffer.concat(parts);
let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const hdr = Buffer.alloc(12); hdr.write('glTF', 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + 8 + js.length + 8 + nb.length, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.write('JSON', 4);
const c2 = Buffer.alloc(8); c2.writeUInt32LE(nb.length, 0); c2.write('BIN\0', 4);
fs.writeFileSync(out, Buffer.concat([hdr, c1, js, c2, nb]));
console.log(fs.statSync(out).size);

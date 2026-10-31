// Lossless meshopt packing: every non-image bufferView is run through the
// meshopt byte codec (no quantization, no filters, no reordering of data).
// usage: node pack.mjs in.glb out.glb [TRIANGLES|INDICES]
import fs from 'fs';
import { MeshoptEncoder } from 'meshoptimizer';

const [, , inFn, outFn, idxMode = 'TRIANGLES'] = process.argv;
await MeshoptEncoder.ready;

const b = fs.readFileSync(inFn);
const jl = b.readUInt32LE(12);
const j = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
const binStart = 20 + jl + 8;
const bin = b.subarray(binStart, binStart + b.readUInt32LE(20 + jl));
if (j.buffers.length !== 1) throw new Error('expected one buffer');

const imgViews = new Set((j.images || []).map((im) => im.bufferView));
const accByView = new Map();
j.accessors.forEach((a, i) => {
  if (a.bufferView === undefined || a.sparse) return;
  if (!accByView.has(a.bufferView)) accByView.set(a.bufferView, []);
  accByView.get(a.bufferView).push(a);
});
const indexAcc = new Set();
for (const m of j.meshes) for (const p of m.primitives) if (p.indices !== undefined) indexAcc.add(p.indices);
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const CS = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

const chunks = []; let off = 0;
const push = (u8) => { const o = off; chunks.push(u8); off += u8.length; const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); off += pad; } return o; };
let fallback = 0; const stats = { packed: 0, kept: 0, before: 0, after: 0 };

j.bufferViews.forEach((v, vi) => {
  const src = new Uint8Array(bin.buffer, bin.byteOffset + (v.byteOffset || 0), v.byteLength);
  const accs = accByView.get(vi) || [];
  let enc = null, ext = null;
  if (!imgViews.has(vi) && accs.length === 1 && !v.byteStride && !(accs[0].byteOffset)) {
    const a = accs[0]; const es = NC[a.type] * CS[a.componentType];
    if (es * a.count === v.byteLength) {
      const isIdx = indexAcc.has(j.accessors.indexOf(a));
      let mode = isIdx ? (idxMode === 'TRIANGLES' && a.count % 3 === 0 ? 'TRIANGLES' : 'INDICES') : 'ATTRIBUTES';
      if (mode === 'ATTRIBUTES' && (es % 4 !== 0 || es > 256)) mode = null;
      if (isIdx && es !== 2 && es !== 4) mode = null;
      if (mode) {
        const e = MeshoptEncoder.encodeGltfBuffer(src, a.count, es, mode);
        if (e.length < v.byteLength) { enc = e; ext = { byteStride: es, mode, count: a.count }; }
      }
    }
  }
  stats.before += v.byteLength;
  if (enc) {
    const o = push(enc);
    v.extensions = { ...(v.extensions || {}), EXT_meshopt_compression: { buffer: 0, byteOffset: o, byteLength: enc.length, ...ext } };
    v.buffer = 1; v.byteOffset = fallback; fallback += v.byteLength; fallback += (4 - (fallback % 4)) % 4;
    stats.packed++; stats.after += enc.length;
  } else {
    v.byteOffset = push(src); v.buffer = 0; stats.kept++; stats.after += v.byteLength;
  }
});

const newBin = Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.length)));
j.buffers = [{ byteLength: newBin.length }, { byteLength: fallback, extensions: { EXT_meshopt_compression: { fallback: true } } }];
j.extensionsUsed = [...new Set([...(j.extensionsUsed || []), 'EXT_meshopt_compression'])];
j.extensionsRequired = [...new Set([...(j.extensionsRequired || []), 'EXT_meshopt_compression'])];

let js = Buffer.from(JSON.stringify(j), 'utf8');
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const hdr = Buffer.alloc(12); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4);
const total = 12 + 8 + js.length + 8 + newBin.length; hdr.writeUInt32LE(total, 8);
const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
fs.writeFileSync(outFn, Buffer.concat([hdr, ch(js.length, 0x4e4f534a), js, ch(newBin.length, 0x004e4942), newBin]));
console.log(outFn, b.length, '->', total, JSON.stringify(stats));

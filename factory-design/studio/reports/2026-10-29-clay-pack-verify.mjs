// Decode a packed GLB and compare it to the original, exactly.
// usage: node verify.mjs orig.glb packed.glb decoder.module.js
import fs from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';

const [, , oFn, pFn, decPath] = process.argv;
const { MeshoptDecoder } = await import(pathToFileURL(path.resolve(decPath)).href);
await MeshoptDecoder.ready;

const read = (fn) => {
  const b = fs.readFileSync(fn); const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const s = 20 + jl + 8; return { j, bin: b.subarray(s, s + b.readUInt32LE(20 + jl)) };
};
const O = read(oFn), P = read(pFn);
const viewBytes = (G, v, decode) => {
  const e = v.extensions && v.extensions.EXT_meshopt_compression;
  if (e && decode) {
    const out = new Uint8Array(e.count * e.byteStride);
    const src = new Uint8Array(G.bin.buffer, G.bin.byteOffset + (e.byteOffset || 0), e.byteLength);
    MeshoptDecoder.decodeGltfBuffer(out, e.count, e.byteStride, src, e.mode, e.filter || 'NONE');
    return out.subarray(0, v.byteLength);
  }
  if (v.buffer !== 0) throw new Error('view on fallback buffer without extension');
  return new Uint8Array(G.bin.buffer, G.bin.byteOffset + (v.byteOffset || 0), v.byteLength);
};
const eq = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
let bad = 0; const fail = (m) => { bad++; console.log('MISMATCH', m); };

// 1. glTF JSON identical apart from buffers, view placement and the extension lists
const strip = (j) => {
  const c = JSON.parse(JSON.stringify(j)); delete c.buffers; delete c.extensionsUsed; delete c.extensionsRequired;
  c.bufferViews = c.bufferViews.map((v) => { const { buffer, byteOffset, extensions, ...r } = v; return r; });
  return JSON.stringify(c);
};
if (strip(O.j) !== strip(P.j)) fail('glTF JSON differs');
if (P.j.bufferViews.length !== O.j.bufferViews.length) fail('view count');

// 2. every bufferView's decoded bytes identical (covers images too)
const ov = O.j.bufferViews.map((v) => viewBytes(O, v, false));
const pv = P.j.bufferViews.map((v) => viewBytes(P, v, true));
ov.forEach((b, i) => { if (!eq(b, pv[i])) fail('bufferView ' + i); });

// 3. every accessor, by kind, identical
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const CS = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const kinds = {};
const label = new Map();
for (const m of O.j.meshes) for (const p of m.primitives) {
  for (const [k, a] of Object.entries(p.attributes)) label.set(a, k);
  if (p.indices !== undefined) label.set(p.indices, 'INDICES');
}
for (const s of O.j.skins || []) if (s.inverseBindMatrices !== undefined) label.set(s.inverseBindMatrices, 'INVERSE_BIND');
for (const an of O.j.animations || []) for (const s of an.samplers) { label.set(s.input, 'ANIM_TIMES'); label.set(s.output, 'ANIM_VALUES'); }
O.j.accessors.forEach((a, i) => {
  const v = a.bufferView; const len = NC[a.type] * CS[a.componentType] * a.count; const o = a.byteOffset || 0;
  const k = label.get(i) || 'OTHER'; kinds[k] = kinds[k] || { n: 0, bytes: 0, same: 0 };
  kinds[k].n++; kinds[k].bytes += len;
  if (eq(ov[v].subarray(o, o + len), pv[v].subarray(o, o + len))) kinds[k].same++; else fail('accessor ' + i + ' ' + k);
});

// 4. animation clips: same samplers, same times and values
for (const [ai, an] of (O.j.animations || []).entries()) {
  const pa = P.j.animations[ai];
  if (JSON.stringify(an) !== JSON.stringify(pa)) fail('animation ' + an.name);
}
const packed = P.j.bufferViews.filter((v) => v.extensions && v.extensions.EXT_meshopt_compression).length;
console.log(path.basename(pFn), 'decoder', path.basename(path.dirname(decPath)), '| packed views', packed, '| accessors', JSON.stringify(kinds));
console.log(bad ? 'RESULT: NOT EXACT (' + bad + ' mismatches)' : 'RESULT: EXACT - every byte identical after decoding');

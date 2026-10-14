import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(S) {
  const raw = Buffer.alloc((S * 4 + 1) * S);
  const heart = (x, y) => { const a = x * x + y * y - 1; return a * a * a - x * x * y * y * y <= 0; };
  for (let py = 0; py < S; py++) {
    raw[py * (S * 4 + 1)] = 0;
    for (let px = 0; px < S; px++) {
      let cov = 0, hl = 0;
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
        const x = ((px + (sx + 0.5) / 3) / S - 0.5) * 3.0, y = -((py + (sy + 0.5) / 3) / S - 0.5) * 3.0 + 0.15;
        if (heart(x, y)) { cov++; if (x < 0 && y > 0.1 && x > -1.0) hl++; if (Math.abs(x) < 0.04 || Math.abs(y - 0.3 + Math.abs(x) * 0.0) < 0.02) hl += 0.3; }
      }
      const f = cov / 9, nx = px / S, ny = py / S, d = Math.hypot(nx - 0.5, ny - 0.5);
      const bg = [31 - 17 * d * 1.4, 26 - 15 * d * 1.4, 23 - 12 * d * 1.4];
      const gl = 1 - ny * 0.55, fg = [212 * gl + hl * 6, 168 * gl + hl * 8, 75 * gl + hl * 8];
      const o = py * (S * 4 + 1) + 1 + px * 4;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.max(0, Math.min(255, Math.round(bg[k] * (1 - f) + fg[k] * f)));
      raw[o + 3] = 255;
    }
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(S, 0); ih.writeUInt32BE(S, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [192, 512]) writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), png(s));

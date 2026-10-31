// Evens out the unit voices (Ken, Oct 31: "a little inconsistent in volume. Some are really quiet").
// Measures every line in public/audio/voice/ in headless Chromium (ITU-R BS.1770 K-weighting over the speech itself: the line is trimmed to where it rises
// above 3 % of its own peak, then 100 ms blocks within 10 dB of the span's mean are averaged), then writes one linear gain per line into manifest.json
// ("gain"). The game multiplies each line by its gain at playback, so no audio file is re-encoded. The gain brings every line to TARGET_LUFS, but never
// past CEIL_DB peak (+3 dBFS inside the graph; the voice bus has a limiter and the bus/event volumes leave about 4.5 dB of headroom). A line whose own peak is
// below FLOOR_DB (-45 dBFS) is silence, not speech: it is dropped from "present" (the game then plays the old grunt) and listed in "defective".
//
// Run from the factory folder (where Playwright is installed) with the built game served:
//   node ../projects/oreheart-8/tools/voice-loudness.mjs http://127.0.0.1:4208 [targetLufs]
// Re-run after tools/voice-manifest.py (it keeps the "gain" block for lines that are still there, but new lines need measuring).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] || 'http://127.0.0.1:4208';
const TARGET_LUFS = Number(process.argv[3] ?? -14), CEIL_DB = 3, FLOOR_DB = -45, MAX_BOOST_DB = 45;
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio', 'voice');
const manPath = path.join(dir, 'manifest.json');
const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ogg')).map((f) => f.slice(0, -4));
const { chromium } = createRequire(process.cwd() + '/')('@playwright/test');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(BASE + '/?test=1&seed=1');
const m = await p.evaluate(async (names) => {
  const ctx = new AudioContext({ sampleRate: 48000 });
  const s1 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1, -1.69065929318241, 0.73248077421585] };
  const s2 = { b: [1, -2, 1], a: [1, -1.99004745483398, 0.99007225036621] };
  const biq = (x, c) => { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = c.b[0] * x[i] + c.b[1] * x1 + c.b[2] * x2 - c.a[1] * y1 - c.a[2] * y2; y[i] = v; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; } return y; };
  const L = (z) => -0.691 + 10 * Math.log10(Math.max(z, 1e-12));
  const out = {};
  for (const n of names) {
    const buf = await ctx.decodeAudioData(await (await fetch('/audio/voice/' + n + '.ogg')).arrayBuffer());
    const d0 = buf.getChannelData(0), N = buf.length;
    let pk = 0; for (let i = 0; i < N; i++) { const a = Math.abs(d0[i]); if (a > pk) pk = a; }
    const th = pk * 0.03; let i0 = 0, i1 = N - 1; while (i0 < N && Math.abs(d0[i0]) < th) i0++; while (i1 > i0 && Math.abs(d0[i1]) < th) i1--;
    const ch = []; for (let c = 0; c < buf.numberOfChannels; c++) ch.push(biq(biq(buf.getChannelData(c), s1), s2));
    const span = Math.max(1, i1 - i0 + 1), bs = Math.min(span, 4800); let tot = 0; const bl = [];
    for (let s = i0; s < i1 + 1; s += bs) { const e = Math.min(i1 + 1, s + bs); let z = 0; for (const x of ch) { let q = 0; for (let i = s; i < e; i++) q += x[i] * x[i]; z += q; } z /= e - s; bl.push(z); tot += z * (e - s); }
    const mean = tot / span, kept = bl.filter((z) => z >= mean / 10);
    out[n] = { lufs: L(kept.reduce((a, z) => a + z, 0) / Math.max(1, kept.length)), peakDb: 20 * Math.log10(pk || 1e-9) };
  }
  return out;
}, files);
await b.close();
const gain = {}, defective = [], rep = [];
for (const n of files) {
  const x = m[n];
  if (x.peakDb < FLOOR_DB) { defective.push(n); continue; }
  const db = Math.min(TARGET_LUFS - x.lufs, CEIL_DB - x.peakDb, MAX_BOOST_DB);
  gain[n] = +Math.pow(10, db / 20).toFixed(4);
  rep.push({ n, from: x.lufs, to: x.lufs + db, db, capped: TARGET_LUFS - x.lufs > CEIL_DB - x.peakDb });
}
man.gain = { target_lufs: TARGET_LUFS, ceiling_db: CEIL_DB, lines: gain };
man.defective = defective;
man.present = (man.present || []).filter((n) => !defective.includes(n));
fs.writeFileSync(manPath, JSON.stringify(man), 'utf8');
const to = rep.map((r) => r.to).sort((a, c) => a - c), from = rep.map((r) => r.from).sort((a, c) => a - c);
const med = (a) => a[Math.floor(a.length / 2)].toFixed(1), q = (a, k) => a[Math.floor(a.length * k)].toFixed(1);
console.log(`lines ${rep.length} (+${defective.length} silent: ${defective.join(', ') || 'none'})`);
console.log(`before: min ${from[0].toFixed(1)}  5% ${q(from, 0.05)}  median ${med(from)}  max ${from[from.length - 1].toFixed(1)} LUFS`);
console.log(`after : min ${to[0].toFixed(1)}  5% ${q(to, 0.05)}  median ${med(to)}  max ${to[to.length - 1].toFixed(1)} LUFS   (target ${TARGET_LUFS}; ${rep.filter((r) => r.capped).length} lines held back by the peak ceiling)`);
console.log('biggest boosts:', rep.sort((a, c) => c.db - a.db).slice(0, 5).map((r) => `${r.n} +${r.db.toFixed(1)} dB`).join(', '));

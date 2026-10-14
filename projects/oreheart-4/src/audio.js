import { store } from './store.js';
let ctx;
function tone(freq, dur, type = 'sine', vol = 0.08, delay = 0, slide = 0) {
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
const SFX = {
  click: () => tone(520, 0.06, 'square', 0.04),
  play: () => { tone(330, 0.1, 'triangle'); tone(495, 0.12, 'triangle', 0.07, 0.07); },
  build: () => tone(140, 0.18, 'sawtooth', 0.06, 0, -40),
  move: () => tone(300, 0.1, 'sine', 0.05, 0, 150),
  hit: () => tone(180, 0.12, 'square', 0.07, 0, -100),
  die: () => tone(220, 0.3, 'sawtooth', 0.06, 0, -170),
  crumble: () => tone(110, 0.35, 'sawtooth', 0.07, 0, -70),
  spell: () => { tone(660, 0.2, 'sine', 0.06, 0, 400); tone(990, 0.2, 'sine', 0.04, 0.05); },
  coins: () => { tone(880, 0.08, 'square', 0.04); tone(1320, 0.12, 'square', 0.04, 0.08); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, i * 0.13)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.06, i * 0.16)),
  flip: () => tone(400, 0.12, 'triangle', 0.06, 0, 300),
  rare: () => [660, 880, 1100].forEach((f, i) => tone(f, 0.25, 'sine', 0.07, i * 0.08)),
};
export function sfx(name) {
  if (!store.data.settings.sound) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    SFX[name] && SFX[name]();
  } catch (e) { /* audio unavailable */ }
}

import { profile } from './store.js';
let ctx = null, musicTimer = null, step = 0;
const get = () => {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};
function tone(freq, dur, type = 'sine', vol = 0.08, when = 0) {
  const c = get();
  if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t = c.currentTime + when;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
export function sfx(kind) {
  if (!profile.sound) return;
  if (kind === 'tap') tone(660, 0.07, 'triangle');
  else if (kind === 'summon') { tone(440, 0.1, 'triangle'); tone(660, 0.12, 'triangle', 0.08, 0.08); }
  else if (kind === 'hit') { tone(160, 0.15, 'square', 0.06); }
  else if (kind === 'gather') { tone(880, 0.08, 'sine'); tone(1175, 0.1, 'sine', 0.07, 0.07); }
  else if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.08, i * 0.12));
  else if (kind === 'lose') [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'sine', 0.08, i * 0.15));
  else tone(500, 0.06);
}
const TUNE = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 880, 784, 659, 587];
export function syncMusic() {
  if (profile.music && ctx && !musicTimer) {
    musicTimer = setInterval(() => {
      if (!profile.music) return;
      tone(TUNE[step % TUNE.length] / 2, 0.5, 'sine', 0.025);
      step++;
    }, 600);
  } else if (!profile.music && musicTimer) {
    clearInterval(musicTimer); musicTimer = null;
  }
}
// audio only starts after a user tap
export function unlockAudio() {
  get();
  syncMusic();
}

// Round 9c: the owner's menus from the Menu Builder (src/content/menus.json) drawn on a 16:9 stage.
// Pieces (text, buttons, pictures, panels), entrance animations (incl. the crash landing with dirt, dust and screen shake),
// loops, Web Audio sound effects (ported from the builder's SFX table) and owner sound files.
import menus from '../content/menus.json';
import { audio } from './audio';

type Piece = any;
const FONT = "'Alegreya SC',Georgia,serif";
const EASE: Record<string, string> = { smooth: 'cubic-bezier(.22,1,.36,1)', gentle: 'cubic-bezier(.45,0,.25,1)', springy: 'cubic-bezier(.34,1.56,.64,1)', even: 'linear' };
const BUILTIN: Record<string, string> = { logo: '/art/logo-wide.webp', menubg: '/art/menu-cavern.webp', dbbg: '/art/deck-bg.webp' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const hexA = (h: string, a: number) => { const n = parseInt((h || '#000000').slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
export const src = (s: string) => (!s ? '' : s.startsWith('img:') ? `/art/menu/img-${s.slice(4)}.webp` : BUILTIN[s] || s);
export const menuScreens: any[] = (menus as any).screens;
export const firstScreen: string = (menus as any).first;

// ------------------------------------------------------------------ sound effects (ported from the Menu Builder)
const RND = (a: number, b: number) => a + Math.random() * (b - a);
const NZ = new WeakMap<AudioContext, AudioBuffer>();
function noiseBuf(c: AudioContext) { let b = NZ.get(c); if (!b) { b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; NZ.set(c, b); } return b; }
function envG(c: AudioContext, out: AudioNode, t: number, a: number, peak: number, d: number) { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.001, a)); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(out); return g; }
function nz(c: AudioContext, out: AudioNode, t: number, o: any) { const s = c.createBufferSource(); s.buffer = noiseBuf(c); s.playbackRate.value = o.rate || 1; const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.7; f.frequency.setValueAtTime(o.f0, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + (o.a || 0.005) + o.d); s.connect(f); f.connect(envG(c, out, t, o.a || 0.005, o.peak, o.d)); s.start(t, Math.random() * 1.5, (o.a || 0.005) + o.d + 0.05); }
function tone(c: AudioContext, out: AudioNode, t: number, o: any) { const s = c.createOscillator(); s.type = o.type || 'sine'; s.frequency.setValueAtTime(o.f0, t); if (o.f1) s.frequency.exponentialRampToValueAtTime(o.f1, t + (o.a || 0.005) + o.d); s.connect(envG(c, out, t, o.a || 0.005, o.peak, o.d)); s.start(t); s.stop(t + (o.a || 0.005) + o.d + 0.05); }
const SFX: Record<string, (c: AudioContext, o: AudioNode, t: number, p: number) => void> = {
  crash(c, o, t, p) { nz(c, o, t, { f0: 5000 * p, f1: 220 * p, d: 1.3, peak: 0.9 }); tone(c, o, t, { f0: 95 * p, f1: 32 * p, d: 0.55, peak: 0.9 }); for (let i = 0; i < 16; i++) nz(c, o, t + RND(0.03, 0.8), { type: 'bandpass', f0: RND(1200, 4500) * p, q: 3, d: RND(0.02, 0.07), peak: RND(0.1, 0.35) }); },
  boom(c, o, t, p) { nz(c, o, t, { f0: 1500 * p, f1: 70 * p, a: 0.01, d: 2.6, peak: 0.75 }); tone(c, o, t, { f0: 75 * p, f1: 24 * p, d: 1.3, peak: 0.6 }); tone(c, o, t + 0.02, { type: 'triangle', f0: 48 * p, f1: 30 * p, d: 1.6, peak: 0.28 }); nz(c, o, t, { type: 'highpass', f0: 2500 * p, d: 0.12, peak: 0.35 }); },
  bang(c, o, t, p) { nz(c, o, t, { type: 'highpass', f0: 700 * p, a: 0.002, d: 0.28, peak: 1 }); tone(c, o, t, { type: 'square', f0: 190 * p, f1: 55 * p, d: 0.13, peak: 0.35 }); tone(c, o, t, { f0: 110 * p, f1: 45 * p, d: 0.25, peak: 0.6 }); },
  thud(c, o, t, p) { tone(c, o, t, { f0: 150 * p, f1: 42 * p, d: 0.35, peak: 1 }); nz(c, o, t, { f0: 500 * p, f1: 150 * p, d: 0.18, peak: 0.55 }); },
  whoosh(c, o, t, p) { nz(c, o, t, { type: 'bandpass', q: 1.8, f0: 350 * p, f1: 2600 * p, a: 0.45, d: 0.35, peak: 1 }); },
  whistle(c, o, t, p) { tone(c, o, t, { f0: 2300 * p, f1: 320 * p, a: 0.08, d: 1.05, peak: 0.35 }); nz(c, o, t, { type: 'bandpass', q: 2, f0: 600 * p, f1: 2400 * p, a: 0.8, d: 0.25, peak: 0.35 }); },
  rumble(c, o, t, p) { const g = c.createGain(); g.connect(o); const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 9; lg.gain.value = 0.35; l.connect(lg); lg.connect(g.gain); g.gain.value = 0.65; l.start(t); l.stop(t + 2.8); nz(c, g, t, { f0: 170 * p, a: 0.35, d: 2.3, peak: 1, q: 1.2 }); tone(c, g, t, { f0: 42 * p, f1: 30 * p, a: 0.3, d: 2.2, peak: 0.5 }); },
  clang(c, o, t, p) { [1, 2.76, 5.4, 8.93, 13.3].forEach((k, i) => tone(c, o, t, { f0: 410 * k * p, d: 1.8 / (1 + i * 0.5), peak: 0.28 / (1 + i * 0.4) })); nz(c, o, t, { type: 'highpass', f0: 3000 * p, d: 0.06, peak: 0.5 }); },
  shatter(c, o, t, p) { nz(c, o, t, { type: 'bandpass', q: 1.2, f0: 5000 * p, d: 0.35, peak: 0.7 }); for (let i = 0; i < 34; i++) { const s = t + RND(0, 0.6) * RND(0, 1); tone(c, o, s, { f0: RND(2800, 7500) * p, d: RND(0.04, 0.14), peak: RND(0.05, 0.16) }); nz(c, o, s, { type: 'highpass', f0: 3500 * p, d: RND(0.01, 0.04), peak: RND(0.05, 0.2) }); } },
  pebbles(c, o, t, p) { for (let i = 0; i < 30; i++) { const s = t + Math.pow(Math.random(), 1.6) * 1.3; nz(c, o, s, { type: 'bandpass', q: 4, f0: RND(1500, 5000) * p, d: RND(0.015, 0.05), peak: RND(0.2, 0.6) * (1 - (s - t) / 1.6) }); } nz(c, o, t, { f0: 900 * p, f1: 300 * p, a: 0.05, d: 0.9, peak: 0.3 }); },
  thunder(c, o, t, p) { nz(c, o, t, { type: 'highpass', f0: 1500 * p, a: 0.002, d: 0.25, peak: 1 }); nz(c, o, t + 0.05, { f0: 3000 * p, f1: 120 * p, a: 0.02, d: 0.6, peak: 0.9 }); nz(c, o, t + 0.25, { f0: 220 * p, a: 0.3, d: 2.6, peak: 0.9, q: 1 }); tone(c, o, t + 0.2, { f0: 55 * p, f1: 30 * p, a: 0.2, d: 2, peak: 0.4 }); },
  zap(c, o, t, p) { tone(c, o, t, { type: 'sawtooth', f0: 1600 * p, f1: 90 * p, d: 0.35, peak: 0.45 }); tone(c, o, t, { type: 'square', f0: 1100 * p, f1: 70 * p, d: 0.3, peak: 0.25 }); nz(c, o, t, { type: 'bandpass', q: 5, f0: 3000 * p, f1: 600 * p, d: 0.3, peak: 0.6 }); },
  sparkle(c, o, t, p) { [1318, 1568, 1976, 2637, 3136].forEach((f, i) => tone(c, o, t + i * 0.07, { f0: f * p, d: 0.7, peak: 0.18 })); },
  stomp(c, o, t, p) { tone(c, o, t, { f0: 70 * p, f1: 28 * p, d: 0.7, peak: 1 }); nz(c, o, t, { f0: 300 * p, f1: 60 * p, d: 0.6, peak: 0.8 }); nz(c, o, t + 0.05, { type: 'bandpass', q: 2, f0: 1800 * p, d: 0.25, peak: 0.25 }); },
  swordhit(c, o, t, p) { [1, 2.4, 3.9, 6.1].forEach((k, i) => tone(c, o, t, { f0: 1250 * k * p, d: 0.9 / (1 + i * 0.6), peak: 0.16 / (1 + i * 0.3) })); nz(c, o, t, { type: 'highpass', f0: 4000 * p, a: 0.001, d: 0.12, peak: 0.7 }); },
};
let curScreen = '', screenT0 = 0;
const bufs: Record<string, Promise<AudioBuffer>> = {};
/** Plays one sound of a piece or screen: a built-in name (Web Audio) or `snd:<id>` (the owner's file in /audio/menu/). */
export function playMenuSound(s: { src: string; vol?: number; pitch?: number }) {
  if (!s || !s.src) return;
  const entry = { name: s.src, src: s.src, screen: curScreen, t: Math.round(performance.now() - screenT0), played: false };
  audio.sfxLog.push(entry);
  if (audio.muted) return;
  const c = audio.ctx;
  if (!c) return;
  const vol = (s.vol === undefined ? 1 : s.vol) * 0.8 * (audio.sfx / 100);
  const g = c.createGain(); g.gain.value = vol;
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.2;
  const mk = c.createGain(); mk.gain.value = 1.7; g.connect(lim); lim.connect(mk); mk.connect(c.destination);
  const p = s.pitch || 1;
  if (s.src.startsWith('snd:')) {
    const url = `/audio/menu/snd-${s.src.slice(4)}.mp3`;
    (bufs[url] ||= fetch(url).then((r) => r.arrayBuffer()).then((ab) => new Promise<AudioBuffer>((res, rej) => { const pr: any = c.decodeAudioData(ab, res, rej); if (pr && pr.then) pr.then(res, rej); })))
      .then((b) => { const n = c.createBufferSource(); n.buffer = b; n.playbackRate.value = p; n.connect(g); n.start(); entry.played = true; })
      .catch(() => { try { const a = new Audio(url); a.volume = Math.min(1, vol); void a.play(); entry.played = true; } catch { /* ignore */ } });
    return;
  }
  const f = SFX[s.src];
  if (f) { f(c, g, c.currentTime + 0.01, p); entry.played = true; }
}

// ------------------------------------------------------------------ drawing
function textStyle(t: any) {
  const sz = t.size;
  const sh: string[] = [];
  if ((t.shadow || 0) > 0) sh.push(`0 ${(0.12 * sz).toFixed(2)}cqh 0 rgba(0,0,0,${t.shadow})`, `0 0 ${(0.25 * sz).toFixed(2)}cqh rgba(0,0,0,${t.shadow * 0.8})`);
  if ((t.glow || 0) > 0) sh.push(`0 0 ${(0.5 * sz * t.glow + 0.2).toFixed(2)}cqh ${t.glowColor || '#FFD700'}`, `0 0 ${(0.18 * sz * t.glow + 0.1).toFixed(2)}cqh ${t.glowColor || '#FFD700'}`);
  return `font-family:${FONT};font-size:${sz}cqh;color:${t.color};font-weight:${t.bold ? 700 : 400} !important;font-style:${t.italic ? 'italic' : 'normal'} !important;letter-spacing:${t.spacing || 0}em;justify-content:${t.align === 'center' ? 'center' : t.align === 'right' ? 'flex-end' : 'flex-start'};text-align:${t.align};align-items:${t.valign === 'top' ? 'flex-start' : t.valign === 'bottom' ? 'flex-end' : 'center'};text-shadow:${sh.join(',') || 'none'}`;
}
function haloHtml(t: any) {
  if (!(t.halo > 0)) return '';
  const s = t.haloSize === undefined ? 30 : t.haloSize;
  return `<div class="mb-halo" style="inset:-${s}% -${s * 0.6}%;background:radial-gradient(closest-side,${hexA(t.haloColor || '#FFD700', Math.min(1, t.halo * 0.55))},${hexA(t.haloColor || '#FFD700', Math.min(1, t.halo * 0.2))} 55%,transparent 100%)"></div>`;
}
function innerHtml(p: Piece) {
  if (p.kind === 'text' || p.kind === 'button') return haloHtml(p.text) + `<div class="mb-txt" style="${textStyle(p.text)}">${esc(p.text.content)}</div>`;
  if (p.kind === 'pic') {
    const q = p.pic, u = src(q.src);
    return q.mode === 'frame' ? `<div class="mb-fr" style="border-width:${q.border}cqh;border-image:url('${u}') ${q.slice}% ${q.fill !== false ? 'fill' : ''} / ${q.border}cqh / 0 round"></div>` : `<img src="${u}" alt="" style="object-fit:${q.fit || 'contain'}">`;
  }
  if (p.kind === 'panel') { const q = p.panel; return `<div style="position:absolute;inset:0;background:${hexA(q.color, q.alpha)};border-radius:${q.radius}cqh"></div>`; }
  return '';
}

export interface MenuHandle { stage: HTMLElement; timers: ReturnType<typeof setTimeout>[]; destroy(): void }
export interface MenuOpts { go(target: string): void }

/** Builds a screen (intro / main / any custom one) into `host`. Zones are left empty (the game draws its own screens for them). */
export function drawMenuScreen(host: HTMLElement, id: string, opts: MenuOpts): MenuHandle {
  const sc = menuScreens.find((s) => s.id === id)!;
  curScreen = id; screenT0 = performance.now();
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, Math.max(0, ms))); };
  const root = document.createElement('div');
  root.className = 'mb-root';
  root.dataset.menu = id;
  const bg = document.createElement('div');
  bg.className = 'mb-bg';
  bg.setAttribute('data-menu-bg', '');
  bg.style.background = sc.bg.src ? `url('${src(sc.bg.src)}') center/cover no-repeat` : sc.bg.color;
  const dim = document.createElement('div');
  dim.className = 'mb-dim';
  dim.style.background = `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${sc.bg.vignette || 0}) 100%), rgba(0,0,0,${sc.bg.dim || 0})`;
  const stage = document.createElement('div');
  stage.className = 'mb-stage';
  const layer = document.createElement('div');
  layer.className = 'mb-layer';
  const fx = document.createElement('div');
  fx.className = 'mb-fx';
  stage.append(layer, fx);
  root.append(bg, dim, stage);
  host.append(root);
  const done = () => { timers.forEach(clearTimeout); };

  const crash = (p: Piece, el: HTMLElement, a: any) => {
    const inn = el.querySelector('.mb-inner') as HTMLElement;
    const base = inn.style.transform || '';
    const c = Object.assign({ dirt: 1, color: '#6b4a2b', shake: 1 }, a.crash || {});
    const fall = -(p.y + p.h + 8);
    const T = (t: string) => `${t} ${base}`.trim();
    inn.style.transformOrigin = '50% 100%';
    inn.animate([{ transform: T(`translateY(${fall}cqh)`), opacity: 1, offset: 0, easing: 'cubic-bezier(.55,0,1,.6)' }, { transform: T('translateY(0) scale(1.14,.78)'), offset: 0.6, easing: 'cubic-bezier(.2,.8,.3,1)' }, { transform: T('translateY(-1.6cqh) scale(.95,1.06)'), offset: 0.78, easing: 'cubic-bezier(.5,0,.6,1)' }, { transform: T('none'), offset: 1 }], { duration: a.dur, delay: a.delay, fill: 'backwards' });
    later(() => {
      const R = stage.getBoundingClientRect(), W = R.width, H = R.height;
      const gx = ((p.x + p.w / 2) / 100) * W, gy = ((p.y + p.h) / 100) * H, sp = (p.w / 100) * W * 0.5;
      const n = Math.round(28 * c.dirt), hex = parseInt(c.color.slice(1), 16);
      const shade = (k: number) => `rgb(${Math.min(255, ((hex >> 16) & 255) * k) | 0},${Math.min(255, ((hex >> 8) & 255) * k) | 0},${Math.min(255, (hex & 255) * k) | 0})`;
      for (let i = 0; i < n; i++) {
        const d = document.createElement('div'); d.className = 'mb-dirt'; d.setAttribute('data-crash-debris', '');
        const sz = (0.006 + Math.random() * 0.02) * H * (0.7 + c.dirt * 0.3), x0 = gx + (Math.random() * 2 - 1) * sp * 0.9;
        const ang = ((-90 + (x0 < gx ? -1 : 1) * (15 + Math.random() * 60)) * Math.PI) / 180, v = H * (0.35 + Math.random() * 0.55) * (0.8 + c.dirt * 0.2), vx = Math.cos(ang) * v, vy = Math.sin(ang) * v, g = H * 2.4, tt = 0.7 + Math.random() * 0.5, rot = (Math.random() * 2 - 1) * 720;
        d.style.cssText = `position:absolute;left:${x0 - sz / 2}px;top:${gy - sz / 2}px;width:${sz}px;height:${sz}px;background:${shade(0.6 + Math.random() * 0.8)};clip-path:polygon(${Math.random() * 30}% 0,100% ${Math.random() * 30}%,${70 + Math.random() * 30}% 100%,0 ${70 + Math.random() * 30}%);pointer-events:none`;
        fx.appendChild(d);
        const K: Keyframe[] = [];
        for (let k = 0; k <= 8; k++) { const t = (tt * k) / 8; K.push({ transform: `translate(${vx * t}px,${vy * t + (g * t * t) / 2}px) rotate(${rot * t}deg)`, opacity: k < 6 ? 1 : 1 - (k - 5) / 3 }); }
        d.animate(K, { duration: tt * 1000, easing: 'linear', fill: 'forwards' }).onfinish = () => d.remove();
      }
      const puffs = Math.round(7 * Math.max(0.4, c.dirt));
      for (let i = 0; i < puffs; i++) {
        const d = document.createElement('div'); d.className = 'mb-dust'; d.setAttribute('data-crash-debris', '');
        const sz = H * (0.08 + Math.random() * 0.08) * (0.6 + c.dirt * 0.4), x0 = gx + (Math.random() * 2 - 1) * sp;
        d.style.cssText = `position:absolute;left:${x0 - sz / 2}px;top:${gy - sz * 0.7}px;width:${sz}px;height:${sz}px;border-radius:50%;background:radial-gradient(circle,${shade(1.6)}ee 0,${shade(1.35)}88 45%,transparent 70%);pointer-events:none`;
        fx.appendChild(d);
        const dx = (x0 - gx) * 1.2 + (Math.random() * 2 - 1) * sz * 0.4;
        d.animate([{ transform: 'scale(.3)', opacity: 0.95 }, { transform: `translate(${dx}px,${-sz * 0.5}px) scale(2.4)`, opacity: 0 }], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () => d.remove();
      }
      if (c.shake > 0) {
        const m = H * 0.012 * c.shake, K: Keyframe[] = [];
        for (let k = 0; k < 9; k++) { const f = 1 - k / 9; K.push({ transform: k === 8 ? 'none' : `translate(${(Math.random() * 2 - 1) * m * f}px,${(Math.random() * 2 - 1) * m * f}px)` }); }
        [layer, bg].forEach((t) => t.animate(K, { duration: 380, easing: 'linear' }));
      }
      root.dataset.impact = String(Math.round(performance.now()));
    }, a.delay + a.dur * 0.6);
  };
  const animIn = (p: Piece, el: HTMLElement) => {
    const a = p.anim;
    if (!a || a.in === 'none') return;
    if (a.in === 'crash') { crash(p, el, a); return; }
    const d = a.dist || 8;
    const off = ({ left: `translateX(-${d * 3}cqw)`, right: `translateX(${d * 3}cqw)`, top: `translateY(-${d * 3}cqh)`, bottom: `translateY(${d * 3}cqh)` } as any)[a.from] || 'translateY(8cqh)';
    const K: Record<string, Keyframe[]> = { fade: [{ opacity: 0 }, { opacity: 1 }], slide: [{ opacity: 0, transform: off }, { opacity: 1, transform: 'none' }], grow: [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }], shrink: [{ opacity: 0, transform: 'scale(2.2)' }, { opacity: 1, transform: 'none' }], drop: [{ opacity: 0, transform: 'translateY(-40cqh)' }, { opacity: 1, transform: 'none' }], spin: [{ opacity: 0, transform: 'rotate(-200deg) scale(.4)' }, { opacity: 1, transform: 'none' }], flash: [{ opacity: 0, filter: 'brightness(4)' }, { opacity: 1, filter: 'brightness(1)' }], wipe: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }] };
    const k = K[a.in];
    if (k) (el.querySelector('.mb-inner') as HTMLElement).animate(k, { duration: a.dur, delay: a.delay, easing: EASE[a.ease] || EASE.smooth, fill: 'backwards' });
  };
  const soundTime = (p: Piece, s: any) => {
    const a = p.anim || {};
    const has = a.in && a.in !== 'none';
    const d = has ? a.delay || 0 : 0, du = has ? a.dur || 0 : 0;
    const base = s.when === 'open' ? 0 : s.when === 'impact' ? d + du * 0.6 : s.when === 'end' ? d + du : d;
    return base + (s.at || 0);
  };

  [...sc.pieces].sort((a: Piece, b: Piece) => (a.z || 0) - (b.z || 0)).forEach((p: Piece) => {
    if (p.hidden || p.kind === 'zone') return;
    const isBtn = p.kind === 'button';
    const el = document.createElement(isBtn ? 'button' : 'div');
    el.className = 'mb-pc' + (isBtn ? ' mb-btn' : '');
    el.dataset.id = p.id; el.dataset.menuPiece = p.id;
    if (isBtn) { (el as HTMLButtonElement).type = 'button'; el.setAttribute('aria-label', p.text.content); el.dataset.goto = p.button.goto || ''; }
    el.style.cssText = `left:${p.x}%;top:${p.y}%;width:${p.w}%;height:${p.h}%;transform:${p.rot ? `rotate(${p.rot}deg)` : 'none'};z-index:${10 + (p.z || 0)};opacity:${p.opacity === undefined ? 1 : p.opacity}`;
    if (isBtn) { const b = p.button; el.style.setProperty('--hc', b.hoverColor); el.style.setProperty('--hgc', b.hoverGlowColor); el.style.setProperty('--hg', (b.hoverGlow * 0.8).toFixed(2) + 'cqh'); }
    const inn = document.createElement('div');
    inn.className = 'mb-inner';
    inn.innerHTML = innerHtml(p);
    const fxm = p.mirror ? -1 : 1, fy = p.flipV ? -1 : 1;
    if (fxm < 0 || fy < 0) inn.style.transform = `scale(${fxm},${fy})`;
    const lp = p.anim && p.anim.loop;
    if (lp && lp !== 'none') {
      const a = p.anim;
      inn.style.setProperty('--la', String(a.loopAmt)); inn.style.setProperty('--lc', a.loopColor);
      inn.style.animation = `mb-lp-${lp} ${(lp === 'spin' ? 6 : 2.4) / Math.max(0.05, a.loopSpeed)}s ${lp === 'spin' ? 'linear' : 'ease-in-out'} infinite`;
    }
    el.appendChild(inn);
    if (isBtn) el.addEventListener('click', (e) => { e.stopPropagation(); opts.go(p.button.goto); });
    layer.appendChild(el);
    animIn(p, el);
    (p.sounds || []).forEach((s: any) => later(() => playMenuSound(s), soundTime(p, s)));
  });
  (sc.sounds || []).forEach((s: any) => later(() => playMenuSound(s), soundTime({ anim: {} }, s)));
  if (sc.kind === 'intro' && sc.intro) {
    if (sc.intro.next) later(() => opts.go(sc.intro.next), sc.intro.length);
    if (sc.intro.skip) { root.classList.add('mb-skippable'); root.addEventListener('click', () => { done(); opts.go(sc.intro.next); }); }
  }
  return { stage, timers, destroy: done };
}

/** Round 9c: wraps a game-drawn element in a box placed exactly like the Menu Builder piece `pieceId` of screen `screenId` (% of the 16:9 stage). */
export function ownerBox(screenId: string, pieceId: string, el: HTMLElement | HTMLElement[], cls = '', owner = true): HTMLElement {
  const sc = menuScreens.find((m) => m.id === screenId)!;
  const p = sc.pieces.find((q: Piece) => q.id === pieceId)!;
  const d = document.createElement('div');
  d.className = 'mb-zone ' + cls;
  if (owner) d.dataset.menuPiece = pieceId;
  d.style.cssText = `left:${p.x}%;top:${p.y}%;width:${p.w}%;height:${p.h}%`;
  d.append(...(Array.isArray(el) ? el : [el]));
  return d;
}
/** A free box (not an owner piece) in stage percentages. */
export function freeBox(x: number, y: number, w: number, h: number, el: HTMLElement | HTMLElement[], cls = ''): HTMLElement {
  const d = document.createElement('div');
  d.className = 'mb-zone ' + cls;
  d.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%`;
  d.append(...(Array.isArray(el) ? el : [el]));
  return d;
}

// Oct 31 (Ken: "the fireball graphic looks awful. It's so tiny ... make it like an event that's happening ... completely serious, but absolutely ridiculous.")
// Brush's painted spell FX (public/art/spell-fx/<spell>/<spell>-<layer>[-m].webp) played as sprites in the 3D board scene, driven by
// studio/spell-fx-spec.json (copied to src/content/spell-fx-spec.json): per spell three beats (windup at the caster, travel/impact,
// aftermath), per-layer scale in board squares, a path type, additive glow/ring/particles, the ring laid flat on the board, a light
// shake, slow-mo at impact on the big ones, a tint flash and the sound-word starburst.
// Timing only: the engine has already resolved the spell when its FX starts; nothing here waits for or delays the game.
// Everything is a pure function of elapsed time (never per-frame steps), so a slow frame rate never slows the FX.
import * as THREE from 'three';
import SPEC_JSON from '../content/spell-fx-spec.json';

export const SPELL_FX_SPEC: any = SPEC_JSON;
export const FX_LAYERS = ['core', 'glow', 'particles', 'ring', 'debris', 'word'] as const;
type Layer = typeof FX_LAYERS[number];
const SLOW_K = 0.35, SLOW_MS = 300, SHAKE_MAX_PX = 6, SHAKE_MS = 250, FLASH_OPACITY = 0.18, FLASH_MS = 120, POP_MS = 220, FADE_MS = 250;

/** Phone = the Phone display mode, a mobile browser, or a touch screen whose short side is phone-sized (same idea as the AI's PHONE). */
export function fxPhone(): boolean {
  try {
    if (document.documentElement.dataset.display === 'phone') return true;
    if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '')) return true;
    const touch = (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches);
    return !!touch && Math.min(window.innerWidth, window.innerHeight) <= 500;
  } catch { return false; }
}
export function fxLayerUrl(spell: string, layer: string, phone: boolean): string {
  const l = SPELL_FX_SPEC.spells[spell]?.layers?.[layer];
  return l ? '/' + (phone ? l.file_phone : l.file) : '';
}

// ---- textures: loaded once per page (both sets cached by URL)
const texCache = new Map<string, THREE.Texture>();
const bitmaps = typeof createImageBitmap === 'function';
/** a texture for this URL (cached); decoded off the main thread (ImageBitmap) where the browser can, so uploading it is cheap */
function tex(url: string, onLoad?: (t: THREE.Texture) => void): THREE.Texture {
  let t = texCache.get(url);
  if (t) { if (onLoad && t.image) onLoad(t); return t; }
  if (bitmaps) {
    const tt = new THREE.Texture(); tt.flipY = false; tt.colorSpace = THREE.SRGBColorSpace; t = tt;
    const ld = new THREE.ImageBitmapLoader(); ld.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
    ld.load(url, (bmp: any) => { tt.image = bmp; tt.needsUpdate = true; onLoad?.(tt); }, undefined, () => { /* missing file: the layer stays empty */ });
  } else {
    t = new THREE.TextureLoader().load(url, (tt) => onLoad?.(tt)); t.colorSpace = THREE.SRGBColorSpace;
  }
  texCache.set(url, t);
  return t;
}

// ---- the test probe's log (kept for the page, across matches)
export const spellFxLog: any[] = [];
let current: SpellFxPlayer | null = null;
/** test hook: off = cast spells play no FX (a yardstick for the performance check) */
let fxEnabled = true;
export function setSpellFxEnabled(v: boolean) { fxEnabled = !!v; }
/** Oct 31: ms from the start of a spell's FX to its impact (same math as play()); null when the spell has no painted FX or FX are off.
 *  The scene times the spell's hit flashes, deaths and bubble pops to this, so Starfall's 3x3 flashes as the meteor lands. */
export function fxImpactMs(spell: string): number | null {
  const s = SPELL_FX_SPEC.spells[spell];
  if (!s || !fxEnabled) return null;
  const [b0, b1] = s.beats;
  const moving = !['at_caster', 'at_target'].includes(s.path);
  return b0.ms + Math.round(b1.travel_ms ?? b1.ms * (moving ? 0.4 : 0.15));
}
export function spellFxNow(): any { return current ? current.now() : { active: [], buffGlows: [] }; }
export function spellFxAt(id: number, ms: number): any { return current ? current.timeline(id, ms) : null; }

const ease = {
  outBack: (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; },
  inQuad: (x: number) => x * x,
  outCubic: (x: number) => 1 - (1 - x) ** 3,
  lin: (x: number) => x,
};
const cl = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export interface SpellFxRequest {
  spell: string;
  caster: 'player' | 'opponent';
  /** the caster's square (the Commander casts from the Stronghold) */
  from: { row: number; col: number };
  /** the target square (a unit, a Commander's Stronghold, the 3x3 centre), or null = at the caster */
  target: { row: number; col: number } | null;
  /** Tunnel: the destination square */
  to?: { row: number; col: number } | null;
  /** heights above the floor (world units) for the caster and target points */
  fromH?: number; targetH?: number;
  /** start this many ms later (Hex Reversal's copied spell waits for the reflection) */
  delay?: number;
  kind?: 'cast' | 'counter' | 'replay';
  countered?: string | null;
  /** Thunderhorn Blast: the caster's units at cast time (uid + square), to time the per-unit glow */
  units?: { uid: string; row: number; col: number }[];
}

interface LayerState { visible: boolean; pos: THREE.Vector3; scale: number; alpha: number; rot: number }
interface Fx {
  id: number; spell: string; s: any; req: SpellFxRequest; t0: number; total: number; /** Oct 31: the FX stays until its sound word has popped, held and faded (may outlast `total`) */ life: number; w: number; ti: number; af: number; impact: number; travel: number;
  fromP: THREE.Vector3; toP: THREE.Vector3; toGround: THREE.Vector3; destP: THREE.Vector3 | null; startP: THREE.Vector3; windAt: THREE.Vector3;
  act: Record<string, any>[]; objs: Partial<Record<Layer, THREE.Object3D>>; aspect: Record<string, number>; log: any; done: boolean;
}

export interface SpellFxHost {
  scene: THREE.Scene; camera: THREE.Camera; renderer: THREE.WebGLRenderer;
  low: boolean; testMode: boolean;
  /** ground centre of a square in world units (1 square = 1 unit) */
  world(row: number, col: number): THREE.Vector3;
  cellOf(p: THREE.Vector3): { row: number; col: number };
  /** elements that shake (both board canvases) and the element the tint flash covers */
  shakeEls(): HTMLElement[];
  flashHost: HTMLElement;
  /** Oct 31: a world point just under a side's HUD Flow counter (Prospector's Prayer gems fly there), and a pulse when they land */
  flowDest?(side: 'player' | 'opponent'): THREE.Vector3 | null;
  flowPulse?(side: 'player' | 'opponent'): void;
}
export type SpellFxPlayer = ReturnType<typeof createSpellFx>;

export function createSpellFx(host: SpellFxHost) {
  const { scene, camera } = host;
  const phone = fxPhone();
  const url = (spell: string, layer: string) => fxLayerUrl(spell, layer, phone);
  const fxs: Fx[] = [];
  /** slow-mo windows in real time [start, end) */
  const slowWins: [number, number][] = [];
  let nextId = 1, disposed = false;
  const tmp = new THREE.Vector3(), right = new THREE.Vector3();

  // warm the cache: the six layers of every spell either side holds, one texture at a time, uploaded to the GPU as each arrives (no hitch at the first cast)
  const queued = new Set<string>(), queue: string[] = [];
  let pumping = false;
  const pump = () => {
    if (disposed || !queue.length) { pumping = false; return; }
    pumping = true;
    const u = queue.shift()!;
    tex(u, (t) => { if (!disposed) try { host.renderer.initTexture(t); } catch { /* ignore */ } });
    setTimeout(pump, 60);
  };
  function preload(spells: Iterable<string>) {
    for (const sp of spells) {
      if (!SPELL_FX_SPEC.spells[sp] || queued.has(sp)) continue;
      queued.add(sp);
      for (const l of FX_LAYERS) queue.push(url(sp, l));
    }
    if (!pumping && queue.length) { pumping = true; setTimeout(pump, 30); }
  }

  // compile the FX shaders once up front (a normal sprite, an additive sprite, the flat additive ring) so the first cast has no hitch
  setTimeout(() => {
    if (disposed) return;
    try {
      const t = tex(url('fizzle', 'debris')), g = new THREE.Group();
      g.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, toneMapped: false, opacity: 0 })));
      g.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 })));
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 })));
      scene.add(g); host.renderer.compile(scene, camera); scene.remove(g);
      g.traverse((o: any) => { o.material?.dispose?.(); o.geometry?.dispose?.(); });
    } catch { /* ignore */ }
  }, 400);

  /** local FX time (ms) at real time `now`: the elapsed time with every slow-mo window running at 0.35x */
  function localT(fx: Fx, now: number) {
    let t = now - fx.t0;
    for (const [a, b] of slowWins) { const o = Math.min(now, b) - Math.max(fx.t0, a); if (o > 0) t -= o * (1 - SLOW_K); }
    return t;
  }
  function slowK(now: number) { for (const [a, b] of slowWins) if (now >= a && now < b) return SLOW_K; return 1; }

  const beatAct = (s: any, bi: number, layer: string) => (s.beats[bi]?.do || []).find((d: any) => d.layer === layer) || null;
  const fxAct = (s: any, name: string) => (s.beats[1]?.do || []).find((d: any) => d.fx === name) || null;

  function play(req: SpellFxRequest) {
    const s = SPELL_FX_SPEC.spells[req.spell];
    if (!s || disposed || !fxEnabled) return null;
    const now = performance.now();
    const [b0, b1, b2] = s.beats;
    const w = b0.ms, ti = b1.ms, af = b2.ms, total = w + ti + af;
    const moving = !['at_caster', 'at_target'].includes(s.path);
    const travel = Math.round(b1.travel_ms ?? ti * (moving ? 0.4 : 0.15)); // Oct 31: a spell may set its own flight time (Fireball 0.8 s)
    const impact = w + travel;
    const fromG = host.world(req.from.row, req.from.col);
    const tgtCell = s.path === 'at_caster' || !req.target ? req.from : req.target;
    const toGround = host.world(tgtCell.row, tgtCell.col);
    const fromP = fromG.clone().setY(req.fromH ?? 1.8);
    const toP = toGround.clone().setY(s.path === 'at_caster' ? (req.fromH ?? 1.8) * 0.6 : req.targetH ?? 0.7);
    let destP: THREE.Vector3 | null = null;
    if (s.path === 'burrow' && req.to) destP = host.world(req.to.row, req.to.col).setY(0.5);
    // camera right (for the swipe's screen edge and the word's offset)
    right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    const hitP = destP || toP;
    // Oct 31 (Ken: "the fireball and the meteor both need to come from like a random part from the top down. Not from the ground up."):
    // a sky fall starts high above the target from a random direction on the far side, so it enters from the top of the screen, a new one each cast
    const skyA = (Math.random() * 2 - 1) * 1.15, skyR = 4 + Math.random() * 3.5, skyH = 9.5 + Math.random() * 3;
    const skyOff = new THREE.Vector3(Math.sin(skyA) * skyR, skyH, -Math.cos(skyA) * skyR);
    const startP = s.path === 'sky_fall' ? hitP.clone().add(skyOff)
      : s.path === 'drop_in' ? hitP.clone().add(new THREE.Vector3(0, 5, 0))
      : s.path === 'swipe' ? hitP.clone().addScaledVector(right, 7).setY(hitP.y + 0.6)
      : s.path === 'burrow' ? toGround.clone().setY(0.15)
      : fromP.clone();
    // windup: at the caster, except the counters that pop at their target and the burrow that opens under the unit
    const windAt = s.path === 'sky_fall' ? startP.clone() // gathers up in the sky, never at the Stronghold
      : b0.where === 'target' || s.path === 'burrow' ? (s.path === 'burrow' ? toGround.clone().setY(0.45) : toP.clone()) : s.path === 'at_caster' ? toP.clone() : fromP.clone();
    const t0 = now + Math.max(0, req.delay || 0);
    const aspect: Record<string, number> = {};
    for (const l of FX_LAYERS) { const px = s.layers[l][phone ? 'px_phone' : 'px']; aspect[l] = px[1] / px[0]; }
    const fx: Fx = { id: nextId++, spell: req.spell, s, req, t0, total, life: total, w, ti, af, impact, travel, fromP, toP, toGround, destP, startP, windAt, act: [], objs: {}, aspect, log: null, done: false };
    // objects
    for (const l of FX_LAYERS) {
      const add = l === 'glow' || l === 'ring' || l === 'particles';
      const mat = l === 'ring'
        ? new THREE.MeshBasicMaterial({ map: tex(url(req.spell, l)), transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 })
        : new THREE.SpriteMaterial({ map: tex(url(req.spell, l)), transparent: true, depthWrite: false, depthTest: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, opacity: 0 });
      const o: THREE.Object3D = l === 'ring' ? new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat as THREE.MeshBasicMaterial) : new THREE.Sprite(mat as THREE.SpriteMaterial);
      if (l === 'ring') o.rotation.x = -Math.PI / 2; // flat on the board
      o.name = `spellfx-${req.spell}-${l}`;
      o.renderOrder = l === 'ring' ? 11 : l === 'word' ? 26 : l === 'core' ? 24 : l === 'debris' ? 23 : 22;
      o.visible = false; o.frustumCulled = false;
      scene.add(o); fx.objs[l] = o;
    }
    // slow-mo (0.35x for 300 ms right at impact) and the shake + tint flash at impact (real time, frame-independent)
    const impactReal = t0 + impact;
    const slow = !!s.slowmo;
    if (slow) slowWins.push([impactReal, impactReal + SLOW_MS]);
    const shakeAmt = Math.min(1, Math.max(0, +(fxAct(s, 'shake')?.amount ?? s.shake ?? 0)));
    const shakePx = host.low ? 0 : Math.min(SHAKE_MAX_PX, SHAKE_MAX_PX * shakeAmt);
    const fl = fxAct(s, 'flash');
    const flash = fl && !fl.skip && shakeAmt > 0 ? { color: fl.color || s.tint, opacity: FLASH_OPACITY, ms: FLASH_MS } : null;
    const delayMs = Math.max(0, impactReal - now);
    if (shakePx > 0) for (const el of host.shakeEls()) {
      const A = shakePx;
      try { el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${A}px,${-A * 0.5}px)` }, { transform: `translate(${-A * 0.8}px,${A * 0.4}px)` }, { transform: `translate(${A * 0.5}px,${-A * 0.3}px)` }, { transform: `translate(${-A * 0.25}px,${A * 0.15}px)` }, { transform: 'translate(0,0)' }], { duration: SHAKE_MS, delay: delayMs, easing: 'linear' }); } catch { /* old browser */ }
    }
    if (flash) {
      const d = document.createElement('div');
      d.className = 'spellfx-flash'; d.setAttribute('aria-hidden', 'true');
      d.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:5;background:${flash.color};opacity:0`;
      host.flashHost.append(d);
      try { d.animate([{ opacity: flash.opacity }, { opacity: 0 }], { duration: flash.ms, delay: delayMs, easing: 'linear' }); } catch { /* old browser */ }
      setTimeout(() => d.remove(), delayMs + flash.ms + 60);
    }
    const word = beatAct(s, 1, 'word'), wordAf = beatAct(s, 2, 'word');
    const hold = Math.max(600, +(wordAf?.hold_ms ?? 600));
    fx.life = Math.max(total, impact + POP_MS + hold + FADE_MS);
    const ringA = beatAct(s, 1, 'ring');
    const sh = (n: number) => Math.round((n / total) * 1000) / 1000;
    const covered: { row: number; col: number }[] = [];
    if (s.target === 'area_3x3' && req.target) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) covered.push({ row: req.target.row + dr, col: req.target.col + dc });
    fx.log = {
      id: fx.id, spell: req.spell, name: s.name, kind: req.kind || 'cast', caster: req.caster, from: { ...req.from }, target: req.target ? { ...req.target } : null, to: req.to ? { ...req.to } : null,
      path: s.path, sky: s.path === 'sky_fall' ? { dx: +skyOff.x.toFixed(2), dy: +skyOff.y.toFixed(2), dz: +skyOff.z.toFixed(2) } : null, startedAt: Math.round(t0), delayMs: Math.round(req.delay || 0), totalMs: total,
      beats: [{ beat: b0.beat, startMs: 0, ms: w, share: sh(w) }, { beat: b1.beat, startMs: w, ms: ti, share: sh(ti) }, { beat: b2.beat, startMs: w + ti, ms: af, share: sh(af) }],
      impactMs: impact, layers: [...FX_LAYERS], files: FX_LAYERS.map((l) => url(req.spell, l)),
      ring: { flat: true, at: host.cellOf(destP || toGround), scaleSquares: ringA?.scale || null, ms: ringA?.ms || 0 },
      area: covered.length ? { cells: covered, ringSquares: ringA?.scale?.[1] || 0 } : null,
      slowmo: slow ? { factor: SLOW_K, ms: SLOW_MS, atMs: impact } : null,
      shake: shakePx > 0 ? { px: Math.round(shakePx * 100) / 100, ms: SHAKE_MS, atMs: impact } : null,
      shakeSkipped: shakePx === 0 && shakeAmt > 0 ? (host.low ? 'low graphics' : '') : '',
      flash, tint: s.tint,
      word: { text: s.sound_word, popMs: POP_MS, peak: 1.25, holdMs: hold, fadeMs: FADE_MS, visibleMs: POP_MS + hold + FADE_MS, sizeSquares: word?.size_squares || 0 },
      reduced: phone, textures: phone ? 'phone' : 'pc', blend: { glow: 'additive', ring: 'additive', particles: 'additive', core: 'normal', debris: 'normal', word: 'normal' },
      countered: req.countered || null, units: (req.units || []).map((u) => u.uid),
    };
    if (req.spell === 'prospectors-prayer' && (req.kind || 'cast') !== 'counter') gemsAt(req.caster, (destP || toP).clone(), impactReal, fx.log);
    spellFxLog.push(fx.log);
    fxs.push(fx);
    if (req.spell === 'battle-cry') for (const u of req.units || []) {
      const d = Math.hypot(u.row - req.from.row, u.col - req.from.col);
      buffStart.set(u.uid, impactReal + Math.min(700, d * 70));
    }
    return fx.log;
  }

  /** where the core is during travel (k = 0..1) */
  function pathPos(fx: Fx, k: number, out: THREE.Vector3) {
    const p = fx.s.path, to = fx.destP || fx.toP;
    if (p === 'arc') { const e = 0.55 * k + 0.45 * k * k; /* Oct 31 (Ken): it speeds INTO the target and crashes; no slowing hang before the boom */ out.lerpVectors(fx.fromP, to, e); out.y += Math.sin(Math.PI * e) * (1.6 + 0.22 * fx.fromP.distanceTo(to)); }
    else if (p === 'sky_fall' || p === 'drop_in') out.lerpVectors(fx.startP, to, ease.inQuad(k));
    else if (p === 'throw') { const e = ease.outCubic(k); out.lerpVectors(fx.fromP, to, e); out.y += Math.sin(Math.PI * e) * 0.35; }
    else if (p === 'burrow') { out.lerpVectors(fx.startP, to, ease.outCubic(k)); out.y = 0.15; }
    else if (p === 'swipe') out.lerpVectors(fx.startP, to, ease.outCubic(k));
    else out.copy(fx.toP);
    return out;
  }

  /** every layer's state at local time t (ms) */
  function layerState(fx: Fx, l: Layer, t: number): LayerState {
    const s = fx.s, w = fx.w, ti = fx.ti, imp = fx.impact, aft = w + ti, P = fx.s.path;
    const hitP = fx.destP || fx.toP;
    const st: LayerState = { visible: false, pos: new THREE.Vector3(), scale: 0, alpha: 0, rot: 0 };
    const a0 = beatAct(s, 0, l), a1 = beatAct(s, 1, l), a2 = beatAct(s, 2, l);
    if (t < 0 || t >= (l === 'word' ? fx.life : fx.total)) return st;
    if (l === 'core') {
      const sw = a0?.scale || [0, 1], sm = a1?.scale || [sw[1], sw[1]];
      const hideAtImpact = /hide/.test(a1?.then || '');
      if (t < w) { const k = t / w; st.pos.copy(P === 'sky_fall' || P === 'drop_in' || P === 'swipe' ? fx.startP : fx.windAt); st.scale = lerp(sw[0], sw[1], ease.outBack(k)); st.alpha = cl(k * 2); st.rot = k * 0.6; if (P === 'burrow') st.scale *= 0.8; }
      else if (t < imp) {
        const k = (t - w) / Math.max(1, fx.travel);
        pathPos(fx, k, st.pos); st.scale = lerp(sm[0], sm[1], k); st.alpha = 1;
        st.rot = P === 'throw' ? k * Math.PI * 4 : P === 'arc' ? k * 1.2 : 0;
        if (P === 'burrow') st.alpha = 0; // underground: only the dust line shows
        if (P === 'at_caster' || P === 'at_target') { st.pos.copy(fx.toP); st.scale = lerp(sm[0], sm[1], Math.sin(k * Math.PI / 2)); }
      } else {
        if (hideAtImpact) return st;
        const k = (t - imp) / Math.max(1, fx.total - imp);
        st.pos.copy(hitP); st.scale = sm[1]; st.alpha = 1;
        if (P === 'burrow') { const kk = cl((t - imp) / 260); st.scale = sm[1] * ease.outBack(kk); st.pos.y = 0.15 + kk * 0.45; }
        if (P === 'drop_in') { const kb = cl((t - imp) / 400); st.pos.y += Math.abs(Math.sin(kb * Math.PI)) * 0.5 * (1 - kb); }
        if (P === 'swipe' && t >= aft) { const kk = cl((t - aft) / fx.af); st.pos.lerpVectors(hitP, fx.startP, ease.inQuad(kk)); }
        if (t >= aft && a2 && a2.alpha) st.alpha = lerp(a2.alpha[0], a2.alpha[1], cl((t - aft) / fx.af));
        void k;
      }
      st.visible = st.alpha > 0.001 && st.scale > 0.001;
      return st;
    }
    if (l === 'glow') {
      const sw = a0?.scale || [0.3, 1];
      if (t < w) { const k = t / w; st.pos.copy(fx.windAt); st.scale = lerp(sw[0], sw[1], ease.outCubic(k)); st.alpha = lerp(0, a0?.alpha?.[1] ?? 0.9, cl(k * 1.5)); st.rot = (k * (a0?.rotate_deg ?? 90) * Math.PI) / 180; }
      else if (t < aft) {
        const k = (t - w) / ti;
        if (t < imp) pathPos(fx, (t - w) / Math.max(1, fx.travel), st.pos); else st.pos.copy(hitP);
        if (P === 'burrow' && t < imp) st.pos.y = 0.2;
        st.scale = sw[1]; st.alpha = lerp(a1?.alpha?.[0] ?? 0.9, a1?.alpha?.[1] ?? 0.6, k); st.rot = Math.PI / 2 + k * 0.5;
      } else { const k = (t - aft) / fx.af, sa = a2?.scale || [sw[1], sw[1] * 1.6]; st.pos.copy(hitP); st.scale = lerp(sa[0], sa[1], ease.outCubic(k)); st.alpha = lerp(a2?.alpha?.[0] ?? 0.6, a2?.alpha?.[1] ?? 0, k); st.rot = Math.PI / 2 + 0.5 + k * 0.4; }
      st.visible = st.alpha > 0.001; return st;
    }
    if (l === 'particles') {
      const sw = a0?.scale || [0.6, 1.2];
      if (t < w) { const k = t / w; st.pos.copy(fx.windAt); st.scale = lerp(sw[0], sw[1], ease.outCubic(k)); st.alpha = cl(k * 1.6); st.rot = a0?.swirl_in ? -k * Math.PI * 1.5 : 0; }
      else if (t < aft) {
        const k = (t - w) / ti;
        if (t < imp) pathPos(fx, (t - w) / Math.max(1, fx.travel), st.pos); else st.pos.copy(hitP);
        if (P === 'burrow' && t < imp) st.pos.y = 0.25;
        st.scale = sw[1] * (P === 'burrow' ? 1 : 0.85); st.alpha = lerp(1, 0.75, k); st.rot = -Math.PI * 1.5 - k * 0.8;
      } else { const k = (t - aft) / fx.af; st.pos.copy(hitP); st.pos.y += (a2?.drift_up_squares ?? 0.8) * ease.outCubic(k); st.scale = sw[1]; st.alpha = lerp(a2?.alpha?.[0] ?? 1, a2?.alpha?.[1] ?? 0, k); st.rot = -Math.PI * 1.5 - 0.8 - k * 0.6; }
      st.visible = st.alpha > 0.001; return st;
    }
    if (l === 'ring' || l === 'debris') {
      if (t < imp || !a1) return st;
      const ms = a1.ms || ti, k = (t - imp) / ms;
      if (k >= 1) return st;
      const sc = a1.scale || [0.2, 2];
      st.scale = lerp(sc[0], sc[1], ease.outCubic(k));
      st.alpha = lerp(a1.alpha?.[0] ?? 1, a1.alpha?.[1] ?? 0, cl((k - 0.35) / 0.65));
      if (l === 'ring') { st.pos.copy(fx.destP ? fx.destP : fx.toGround).setY(0.03); }
      else { st.pos.copy(hitP); st.rot = (k * (a1.spin_deg ?? 40) * Math.PI) / 180; }
      st.visible = st.alpha > 0.001; return st;
    }
    // word: pops 0 -> 1.25 -> 1.0 over 220 ms, wobbles +/-6 deg, holds, fades over 250 ms; always faces the camera
    if (t < imp || !a1) return st;
    const wt = t - imp, hold = fx.log.word.holdMs;
    if (wt >= POP_MS + hold + FADE_MS) return st;
    const size = a1.size_squares || 1.8;
    const k1 = POP_MS * 0.6;
    const m = wt < k1 ? 1.25 * ease.outCubic(wt / k1) : wt < POP_MS ? lerp(1.25, 1, (wt - k1) / (POP_MS - k1)) : 1;
    st.scale = size * m;
    st.alpha = wt < POP_MS + hold ? 1 : 1 - (wt - POP_MS - hold) / FADE_MS;
    st.rot = (Math.sin(wt / 70) * 6 * Math.PI) / 180;
    const off = a1.offset_squares || [0.6, -1];
    st.pos.copy(hitP).addScaledVector(right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize(), off[0]); st.pos.y += -off[1];
    st.visible = st.alpha > 0.001; return st;
  }

  function apply(fx: Fx, now: number) {
    const t = localT(fx, now);
    for (const l of FX_LAYERS) {
      const o = fx.objs[l]!; const st = layerState(fx, l, t);
      o.visible = st.visible;
      if (!st.visible) continue;
      o.position.copy(st.pos);
      const h = st.scale * fx.aspect[l];
      if (l === 'ring') { o.scale.set(st.scale, h, 1); ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = st.alpha; }
      else { o.scale.set(st.scale, h, 1); const m = (o as THREE.Sprite).material; m.opacity = st.alpha; m.rotation = st.rot; }
    }
  }
  function drop(fx: Fx) {
    fx.done = true; fx.log.done = true;
    for (const l of FX_LAYERS) { const o = fx.objs[l]; if (!o) continue; scene.remove(o); const m: any = (o as any).material; m?.dispose?.(); (o as any).geometry?.dispose?.(); }
  }

  // ---- Thunderhorn Blast: a small glow (0.8 sq, 0.35 alpha) stays on each buffed unit while the buff lasts
  const buffStart = new Map<string, number>();
  const buffGlows = new Map<string, THREE.Sprite>();
  let buffInfo: { uid: string; side: string; shownAt: number }[] = [];
  function syncBuff(units: { uid: string; side: string; pos: THREE.Vector3; h: number }[], now: number) {
    const keep = new Set<string>();
    buffInfo = [];
    for (const u of units) {
      keep.add(u.uid);
      let g = buffGlows.get(u.uid);
      if (!g) {
        g = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(url('battle-cry', 'glow')), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
        const asp = SPELL_FX_SPEC.spells['battle-cry'].layers.glow[phone ? 'px_phone' : 'px'];
        g.scale.set(0.8, 0.8 * asp[1] / asp[0], 1); g.renderOrder = 9; g.name = 'spellfx-battle-cry-buff'; g.frustumCulled = false;
        scene.add(g); buffGlows.set(u.uid, g);
      }
      const at = buffStart.get(u.uid) ?? 0;
      const k = cl((now - at) / 300);
      g.position.copy(u.pos).setY(Math.max(0.35, u.h * 0.45));
      g.material.opacity = 0.35 * k; g.material.rotation = now / 1400;
      g.visible = k > 0;
      buffInfo.push({ uid: u.uid, side: u.side, shownAt: Math.round(at) });
    }
    for (const [uid, g] of buffGlows) if (!keep.has(uid)) { scene.remove(g); g.material.dispose(); buffGlows.delete(uid); buffStart.delete(uid); }
  }

  // ---- shards: every countered card shatters into Snuff Out's debris shards
  const shards: { objs: THREE.Sprite[]; t0: number; at: THREE.Vector3; dirs: THREE.Vector3[] }[] = [];
  function shatter(at: { row: number; col: number }, countered: string | null, h = 1.6) {
    const p = host.world(at.row, at.col).setY(h), n = phone ? 6 : 9;
    const objs: THREE.Sprite[] = [], dirs: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(url('fizzle', 'debris')), transparent: true, depthWrite: false, depthTest: false, toneMapped: false, opacity: 1 }));
      sp.scale.set(0.55, 0.55, 1); sp.position.copy(p); sp.renderOrder = 25; sp.name = 'spellfx-shard'; sp.frustumCulled = false; scene.add(sp); objs.push(sp);
      const a = (i / n) * Math.PI * 2; dirs.push(new THREE.Vector3(Math.cos(a) * 1.8, 1.6 + (i % 3) * 0.5, Math.sin(a) * 1.2));
    }
    const t0 = performance.now();
    shards.push({ objs, t0, at: p, dirs });
    spellFxLog.push({ kind: 'shards', art: 'fizzle-debris', countered, at: { ...at }, count: n, startedAt: Math.round(t0), file: url('fizzle', 'debris'), reduced: phone, textures: phone ? 'phone' : 'pc' });
  }

  // ---- Prospector's Prayer (Oct 31, Forge): at impact a handful of the spell's own gem particles arc from the caster into that side's Flow counter
  const GEM_MS = 760, GEM_STAGGER = 70;
  const gems: { side: 'player' | 'opponent'; t0: number; from: THREE.Vector3; to: THREE.Vector3 | null; objs: THREE.Sprite[]; landed: boolean; log: any }[] = [];
  function gemsAt(side: 'player' | 'opponent', from: THREE.Vector3, atReal: number, fxLog: any) {
    const n = phone ? 5 : 8, objs: THREE.Sprite[] = [];
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(url('prospectors-prayer', 'debris')), transparent: true, depthWrite: false, depthTest: false, toneMapped: false, opacity: 0 }));
      sp.scale.set(0.42, 0.42, 1); sp.position.copy(from); sp.renderOrder = 27; sp.name = 'spellfx-prayer-gem'; sp.frustumCulled = false; sp.visible = false; scene.add(sp); objs.push(sp);
    }
    const log = { kind: 'gems', spell: 'prospectors-prayer', side, to: side === 'player' ? 'player-flow-crystal' : 'enemy-flow-crystal', count: n, startsAt: Math.round(atReal), flightMs: GEM_MS + GEM_STAGGER * (n - 1), landedAt: 0, file: url('prospectors-prayer', 'debris'), reduced: phone };
    fxLog.gems = log;
    gems.push({ side, t0: atReal, from, to: null, objs, landed: false, log });
  }
  function updateGems(now: number) {
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      if (now < g.t0) continue;
      if (!g.to) g.to = host.flowDest?.(g.side)?.clone() || g.from.clone().add(new THREE.Vector3(g.side === 'player' ? -4 : 4, 3, g.side === 'player' ? 3 : -3)); // aim once, at launch
      let all = true;
      g.objs.forEach((o, j) => {
        const k = cl((now - g.t0 - j * GEM_STAGGER) / GEM_MS);
        if (k < 1) all = false;
        o.visible = k > 0 && k < 1;
        if (!o.visible) return;
        const e = ease.inQuad(k), sway = Math.sin(j * 1.7) * 0.6 * Math.sin(Math.PI * k);
        o.position.lerpVectors(g.from, g.to!, e); o.position.y += Math.sin(Math.PI * k) * 1.4; o.position.x += sway;
        o.material.opacity = Math.min(1, k * 5); o.material.rotation = k * 6 + j;
        const sc = lerp(0.42, 0.18, e); o.scale.set(sc, sc, 1);
      });
      if (all) {
        if (!g.landed) { g.landed = true; g.log.landedAt = Math.round(now); host.flowPulse?.(g.side); }
        for (const o of g.objs) { scene.remove(o); o.material.dispose(); }
        gems.splice(i, 1);
      }
    }
  }

  let updates = 0;
  /** JS cost of the FX (ms): the slowest update() and play() so far (test probe) */
  const perf = { maxUpdateMs: 0, maxPlayMs: 0, updates: 0 };
  /** finished FX kept (without their scene objects) so the probe can still read their timeline */
  const past: Fx[] = [];
  function update(now: number) {
    const p0 = performance.now();
    updates++;
    for (let i = fxs.length - 1; i >= 0; i--) {
      const fx = fxs[i];
      if (localT(fx, now) >= fx.life) { drop(fx); fxs.splice(i, 1); past.push(fx); if (past.length > 24) past.shift(); continue; }
      apply(fx, now);
    }
    for (let i = slowWins.length - 1; i >= 0; i--) if (now > slowWins[i][1] + 10000) slowWins.splice(i, 1);
    updateGems(now);
    for (let i = shards.length - 1; i >= 0; i--) {
      const sh = shards[i], k = (now - sh.t0) / 900;
      if (k >= 1) { for (const o of sh.objs) { scene.remove(o); o.material.dispose(); } shards.splice(i, 1); continue; }
      sh.objs.forEach((o, j) => { const d = sh.dirs[j], tt = k * 0.9; o.position.set(sh.at.x + d.x * tt, sh.at.y + d.y * tt - 4.5 * tt * tt, sh.at.z + d.z * tt); o.material.opacity = 1 - k * k; o.material.rotation = k * (j % 2 ? 6 : -6); o.scale.setScalar(0.55 * (1 - k * 0.4)); });
    }
    if (fxs.length || shards.length || gems.length) { perf.updates++; perf.maxUpdateMs = Math.max(perf.maxUpdateMs, performance.now() - p0); }
  }

  const beatAt = (fx: Fx, t: number) => (t < 0 ? 'waiting' : t < fx.w ? 'windup' : t < fx.w + fx.ti ? 'travel_impact' : t < fx.total ? 'aftermath' : 'done');
  function probeLayers(fx: Fx, t: number) {
    const layers: any = {};
    for (const l of FX_LAYERS) {
      const st = layerState(fx, l, t), o = fx.objs[l]!;
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(o.quaternion);
      layers[l] = { visible: st.visible, scale: Math.round(st.scale * 1000) / 1000, alpha: Math.round(st.alpha * 1000) / 1000, cell: host.cellOf(st.pos), x: Math.round(st.pos.x * 100) / 100, y: Math.round(st.pos.y * 100) / 100, z: Math.round(st.pos.z * 100) / 100, ...(l === 'ring' ? { normalY: Math.round(n.y * 1000) / 1000, sprite: false } : { sprite: true }) };
    }
    return layers;
  }
  /** test probe: every live FX with each layer's state right now (computed from the timeline, not sampled from frames) */
  function nowState() {
    const now = performance.now();
    return {
      at: now, slowK: slowK(now), updates, perf: { ...perf },
      active: fxs.filter((fx) => localT(fx, now) < fx.life).map((fx) => { const t = localT(fx, now); return { id: fx.id, spell: fx.spell, localMs: Math.round(t), realMs: Math.round(now - fx.t0), beat: beatAt(fx, t), layers: probeLayers(fx, t) }; }),
      buffGlows: buffInfo.map((b) => ({ ...b, visible: !!buffGlows.get(b.uid)?.visible, alpha: Math.round((buffGlows.get(b.uid)?.material.opacity || 0) * 1000) / 1000 })),
      shards: shards.map((s) => s.objs.length),
    };
  }
  /** test probe: an FX's layers at a given point of its own timeline (ms), live or finished */
  function timeline(id: number, ms: number) {
    const fx = fxs.find((f) => f.id === id) || past.find((f) => f.id === id);
    return fx ? { id, spell: fx.spell, localMs: ms, beat: beatAt(fx, ms), layers: probeLayers(fx, ms) } : null;
  }

  function dispose() {
    disposed = true;
    for (const fx of fxs) drop(fx); fxs.length = 0;
    for (const g of buffGlows.values()) { scene.remove(g); g.material.dispose(); } buffGlows.clear();
    for (const sh of shards) for (const o of sh.objs) { scene.remove(o); o.material.dispose(); } shards.length = 0;
    for (const g of gems) for (const o of g.objs) { scene.remove(o); o.material.dispose(); } gems.length = 0;
    if (current === player) current = null;
  }

  const player = { preload, play: (r: SpellFxRequest) => { const p0 = performance.now(), out = play(r); perf.maxPlayMs = Math.max(perf.maxPlayMs, performance.now() - p0); return out; }, update, slowK, syncBuff, shatter, now: nowState, timeline, dispose, phone, get active() { return fxs.length; },
    /** Oct 31 (pacing): an FX, flying gems or shards still on screen */ busy: (now: number) => fxs.some((fx) => localT(fx, now) < fx.total) || gems.length > 0 || shards.length > 0 };
  current = player;
  void tmp;
  return player;
}

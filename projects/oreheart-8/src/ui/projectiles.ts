// Oct 31 (Ken): "Oathbound Overwatch is essentially a sniper ... all range need like a shooting animation ... the projectile actually flying out ...
// skull ... bullet ... arrow ... spell type object. Only melee do melee type moves. Any range, stay in place and do their attack, and their projectile
// comes out. And ... the bowler, the bowling ball should come out and roll across the screen, the 3D bowling ball."
// Ledger's table (studio/ranged-attacks.json) + Clay's projectile models (public/models/projectiles/, origin at the centre, flying along +Z, up +Y).
// A shot is planned when the attack event arrives (release time and arrival time are fixed then, so the hit, damage, deaths and bubbles can wait
// for the arrival); the model spawns at the launch bone on the first frame after the release and flies by ELAPSED time, so slow frames never slow it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type FlightStyle = 'straight' | 'arc' | 'roll' | 'magic';
export interface ShotSpec {
  file: string; style: FlightStyle;
  /** board squares per second */ speed: number;
  /** longest side on the board, squares (a roll uses the held ball's size when it can) */ size: number;
  /** 'muzzle' = an end of a held part (tip 'far' = the end farthest from the hand, a gun's muzzle; 'toward' = the end nearer the target, a staff's head); 'hand' = the launch bone itself */ launch: 'muzzle' | 'hand'; tip?: 'far' | 'toward'; part?: string; bone: string;
  spin: 'none' | 'tumble' | 'flat' | 'roll' | 'crackle'; arcH?: number; wobble?: number;
  /** muzzle-flash.glb size (squares), 0 = none */ muzzle?: number;
  trail: 'none' | 'tracer' | 'spark' | 'dust'; color: number; impact: 'spark' | 'chips' | 'stars' | 'flash';
}
/** every ranged unit (Ledger's ranged-attacks.json; Commanders never shoot; Junk Shaman, Goblin Chef and Rocket Rider stay melee) */
export const SHOTS: Record<string, ShotSpec> = {
  'oathbound-pikeman': { file: 'bullet.glb', style: 'straight', speed: 30, size: 0.3, launch: 'muzzle', part: 'rifle', bone: 'RightHand', spin: 'none', muzzle: 0.24, trail: 'tracer', color: 0x7fd3ff, impact: 'spark' },
  'deepforge-crossbowman': { file: 'crystal-shot.glb', style: 'straight', speed: 14, size: 0.42, launch: 'muzzle', part: 'crystal-gun', bone: 'RightHand', spin: 'roll', muzzle: 0.42, trail: 'spark', color: 0x4aa8ff, impact: 'spark' },
  'goblin-slinger': { file: 'skull.glb', style: 'arc', speed: 6, size: 0.36, launch: 'hand', bone: 'RightHand', spin: 'tumble', arcH: 0.8, trail: 'none', color: 0xe8dcc0, impact: 'chips' },
  'axe-thrower': { file: 'grudge-book.glb', style: 'arc', speed: 7, size: 0.46, launch: 'hand', bone: 'RightHand', spin: 'flat', arcH: 0.45, trail: 'spark', color: 0x4aa8ff, impact: 'spark' },
  'spark-gnome': { file: 'lightning-orb.glb', style: 'magic', speed: 10, size: 0.36, launch: 'muzzle', tip: 'toward', part: 'staff', bone: 'RightHand', spin: 'crackle', wobble: 0.14, trail: 'spark', color: 0x8fd6ff, impact: 'spark' },
  'hexwright-apprentice': { file: 'hex-bolt.glb', style: 'magic', speed: 10, size: 0.48, launch: 'hand', bone: 'LeftHand', spin: 'roll', wobble: 0.12, trail: 'spark', color: 0xb266ff, impact: 'flash' },
  'gyrocopter-ace': { file: 'fireball.glb', style: 'arc', speed: 8, size: 0.5, launch: 'hand', bone: 'LeftHand', spin: 'roll', arcH: 0.35, trail: 'spark', color: 0xff9a3c, impact: 'flash' },
  'goblin-scrapper': { file: 'bowling-ball.glb', style: 'roll', speed: 7, size: 0.42, launch: 'hand', part: 'bowling-ball', bone: 'RightHand', spin: 'roll', trail: 'dust', color: 0x4a2f3f, impact: 'stars' },
};
/** an attack by this card is a shot (not a melee lunge) */
export const isShooter = (cardId: string) => !!SHOTS[cardId] && SHOTS[cardId].style !== 'roll';

const BASE = '/models/projectiles/';
const cache = new Map<string, Promise<THREE.Object3D | null>>();
const ready = new Map<string, { obj: THREE.Object3D; len: number }>();
let loader: GLTFLoader | null = null;
export function loadShotModel(file: string): Promise<THREE.Object3D | null> {
  let p = cache.get(file);
  if (!p) {
    p = (loader ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)).loadAsync(BASE + file).then((g) => {
      const o = g.scene;
      o.traverse((m: any) => {
        if (!m.isMesh) return;
        m.frustumCulled = false; m.castShadow = false;
        const mt = m.material; // the dark arena: a plain painted model glows a little on its own colours (as the units do); emissive glows stay
        if (mt && mt.isMeshStandardMaterial && mt.emissive && mt.emissive.getHex() === 0 && !mt.emissiveMap) { if (mt.map) { mt.emissiveMap = mt.map; mt.emissive.setHex(0xffffff); } else mt.emissive.copy(mt.color); mt.emissiveIntensity = 0.45; }
      });
      const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      ready.set(file, { obj: o, len: Math.max(1e-4, s.x, s.y, s.z) });
      return o;
    }).catch(() => null);
    cache.set(file, p);
  }
  return p;
}
export function preloadShots(cardId: string) { const s = SHOTS[cardId]; if (!s) return; void loadShotModel(s.file); if (s.muzzle) void loadShotModel('muzzle-flash.glb'); }

export interface ShotRequest {
  shooterUid: string; unit: string; clip: string; spec: ShotSpec;
  /** seconds into the clip where the release event sits */ releaseTime: number;
  /** performance.now() ms */ releaseAt: number; arriveAt: number;
  to: THREE.Vector3; targetUid?: string;
  /** a roll: the squares it rolls through (world, on the ground) and when it reaches each one */ path?: THREE.Vector3[]; pathAt?: number[];
  launch(): { pos: THREE.Vector3; bone: THREE.Vector3; size?: number; drift?: number } | null;
  onSpawn?(): void; onLand?(): void;
}
interface Live {
  r: ShotRequest; obj: THREE.Group | null; spin: THREE.Group | null; from: THREE.Vector3; side: THREE.Vector3; rad: number; spun: number; lastTrail: number;
  tracer: THREE.Mesh | null; flash: THREE.Object3D | null; flashT: number; log: any; done: boolean; fadeT: number; prev: THREE.Vector3;
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
const arr = (v: THREE.Vector3) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];

export function createProjectiles(scene: THREE.Scene, fx: (kind: 'dust' | 'stars' | 'spark' | 'chips' | 'flash', at: THREE.Vector3, n: number) => void, low: boolean) {
  const live: Live[] = [];
  const log: any[] = [];
  let tracerGeo: THREE.CylinderGeometry | null = null, fallGeo: THREE.SphereGeometry | null = null;
  const instance = (spec: ShotSpec, size: number) => {
    const holder = new THREE.Group(), spin = new THREE.Group(); holder.add(spin); holder.name = 'projectile';
    const rd = ready.get(spec.file);
    if (rd) { const m = rd.obj.clone(true); m.scale.setScalar(size / rd.len); spin.add(m); }
    else { // not downloaded yet (first shot on a slow phone): a glowing stand-in keeps the timing
      const m = new THREE.Mesh(fallGeo ||= new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: spec.color })); m.scale.setScalar(size * 0.6); spin.add(m);
    }
    scene.add(holder);
    return { holder, spin };
  };
  /** where the shot is at k (0..1) of its flight */
  const at = (L: Live, k: number, out: THREE.Vector3) => {
    const r = L.r, s = r.spec;
    if (s.style === 'roll' && r.path && r.pathAt && r.path.length) {
      const now = r.releaseAt + k * (r.arriveAt - r.releaseAt);
      const pts = [L.from, ...r.path], ts = [r.releaseAt, ...r.pathAt];
      let i = 0; while (i < ts.length - 2 && now > ts[i + 1]) i++;
      const e = Math.min(1, Math.max(0, (now - ts[i]) / Math.max(1, ts[i + 1] - ts[i])));
      out.lerpVectors(pts[i], pts[Math.min(pts.length - 1, i + 1)], e); out.y = L.rad + 0.002;
      return out;
    }
    out.lerpVectors(L.from, r.to, k);
    if (s.style === 'arc') out.y += 4 * (s.arcH || 0.6) * k * (1 - k);
    if (s.style === 'magic') { const w = (s.wobble || 0.1) * Math.sin(Math.PI * k); out.addScaledVector(L.side, w * (0.7 + 0.3 * Math.sin(k * Math.PI * 4))); out.y += w * 0.5 * Math.sin(k * Math.PI * 3); }
    return out;
  };
  const spawn = (L: Live, now: number) => {
    const r = L.r, s = r.spec;
    const la = r.launch();
    const pos = la ? la.pos.clone() : r.to.clone();
    let size = s.size;
    if (s.style === 'roll') { if (la?.size) size = la.size; L.rad = size / 2; pos.y = Math.max(L.rad, pos.y); }
    L.from.copy(pos);
    const d = _v.copy(r.to).sub(pos).setY(0); if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize();
    L.side.set(d.z, 0, -d.x);
    const { holder, spin } = instance(s, size); L.obj = holder; L.spin = spin;
    holder.position.copy(pos); L.prev.copy(pos);
    if (s.muzzle && la) {
      const mf = ready.get('muzzle-flash.glb');
      if (mf) {
        const m = mf.obj.clone(true); m.scale.setScalar(s.muzzle / mf.len);
        const g = new THREE.Group(); g.add(m); g.position.copy(pos); g.lookAt(_w.copy(r.to)); m.rotation.z = Math.random() * Math.PI * 2;
        scene.add(g); L.flash = g; L.flashT = now;
      }
      if (!low) fx('dust', _w.copy(pos).setY(pos.y - 0.3), 2); // a puff of smoke at the barrel
    }
    if (s.trail === 'tracer') {
      const t = new THREE.Mesh(tracerGeo ||= new THREE.CylinderGeometry(0.022, 0.022, 1, 5, 1, true), new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      t.renderOrder = 30; t.visible = false; scene.add(t); L.tracer = t;
    }
    L.log.spawnedAt = Math.round(now); L.log.spawn = arr(pos); L.log.bonePos = la ? arr(la.bone) : null; L.log.size = +size.toFixed(3);
    L.log.boneDist = la ? +la.bone.distanceTo(pos).toFixed(3) : null;
    L.log.bodyDrift = la && la.drift !== undefined ? +la.drift.toFixed(3) : null;
    r.onSpawn?.();
  };
  const land = (L: Live, now: number) => {
    const r = L.r, s = r.spec;
    L.done = true; L.fadeT = now;
    const p = L.obj ? L.obj.position : r.to;
    L.log.landedAt = Math.round(now); L.log.end = arr(p);
    fx(s.impact, _w.copy(p).setY(Math.max(0.2, p.y) - (s.impact === 'spark' ? 0.3 : 0)), s.impact === 'flash' ? 1 : low ? 2 : 5);
    if (s.style === 'roll') fx('dust', _w.copy(p).setY(0), 5);
    if (L.obj) { scene.remove(L.obj); L.obj = null; }
    r.onLand?.();
  };
  function fire(r: ShotRequest) {
    const L: Live = { r, obj: null, spin: null, from: new THREE.Vector3(), side: new THREE.Vector3(), rad: r.spec.size / 2, spun: 0, lastTrail: 0, tracer: null, flash: null, flashT: 0, done: false, fadeT: 0, prev: new THREE.Vector3(),
      log: { shooterUid: r.shooterUid, unit: r.unit, clip: r.clip, releaseTime: +r.releaseTime.toFixed(4), releaseAt: Math.round(r.releaseAt), file: r.spec.file, style: r.spec.style, launchBone: r.spec.bone, launch: r.spec.launch,
        target: arr(r.to), targetUid: r.targetUid || '', arriveAt: Math.round(r.arriveAt), flightMs: Math.round(r.arriveAt - r.releaseAt), spawnedAt: 0, landedAt: 0, spawn: null, bonePos: null, end: null,
        ...(r.path ? { path: r.path.map(arr), pathAt: (r.pathAt || []).map((x) => Math.round(x)), minY: 1e9, maxY: -1e9, spin: 0 } : {}) } };
    live.push(L); log.push(L.log); if (log.length > 60) log.shift();
  }
  function update(now: number) {
    for (let i = live.length - 1; i >= 0; i--) {
      const L = live[i], r = L.r, s = r.spec;
      if (L.flash && now - L.flashT > 100) { scene.remove(L.flash); L.flash = null; } // ~0.1 s at the barrel
      if (L.done) {
        const k = (now - L.fadeT) / 180;
        if (L.tracer) { if (k >= 1) { scene.remove(L.tracer); (L.tracer.material as THREE.Material).dispose(); L.tracer = null; } else (L.tracer.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k); }
        if (!L.tracer && !L.flash) live.splice(i, 1);
        continue;
      }
      if (now < r.releaseAt) continue;
      if (!L.obj) spawn(L, now);
      const k = Math.min(1, (now - r.releaseAt) / Math.max(1, r.arriveAt - r.releaseAt));
      const o = L.obj!, p = at(L, k, _v);
      const step = _w.copy(p).sub(L.prev);
      o.position.copy(p);
      // facing: along the flight (a roll keeps its own spin axis)
      if (s.style !== 'roll') { at(L, Math.min(1, k + 0.02), _w); if (_w.distanceToSquared(p) > 1e-8) o.lookAt(_w); }
      const dt = Math.min(0.5, (now - (L.log._t || now)) / 1000); L.log._t = now;
      if (L.spin) {
        if (s.spin === 'tumble') L.spin.rotation.x += dt * Math.PI * 4;
        else if (s.spin === 'flat') L.spin.rotation.y += dt * Math.PI * 5;
        else if (s.spin === 'roll' && s.style !== 'roll') L.spin.rotation.z += dt * Math.PI * 3;
        else if (s.spin === 'crackle') L.spin.rotation.set(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
        if (s.style === 'roll') { const dist = Math.hypot(step.x, step.z); if (dist > 1e-6) { _q.setFromAxisAngle(_v.set(step.z, 0, -step.x).normalize(), dist / Math.max(0.01, L.rad)); L.spin.quaternion.premultiply(_q); L.spun += dist / Math.max(0.01, L.rad); } }
      }
      if (r.path) { L.log.minY = Math.min(L.log.minY, +(o.position.y - L.rad).toFixed(4)); L.log.maxY = Math.max(L.log.maxY, +(o.position.y - L.rad).toFixed(4)); L.log.spin = +L.spun.toFixed(2); }
      if (L.tracer) { // a thin line that trails the bullet (up to 1.2 squares) and lingers a moment after it lands
        const tail = _w.copy(L.from); const len = tail.distanceTo(o.position);
        if (len > 1.2) tail.lerp(o.position, 1 - 1.2 / len);
        const d = o.position.clone().sub(tail), l = d.length();
        L.tracer.visible = l > 0.01; L.tracer.position.copy(tail).addScaledVector(d, 0.5); L.tracer.scale.set(1, Math.max(0.001, l), 1); if (l > 1e-4) L.tracer.quaternion.setFromUnitVectors(Y, d.normalize());
      }
      if (!low && s.trail !== 'none' && s.trail !== 'tracer' && now - L.lastTrail > (s.trail === 'dust' ? 110 : 70)) { L.lastTrail = now; fx(s.trail === 'dust' ? 'dust' : 'spark', _w.copy(o.position).setY(s.trail === 'dust' ? 0 : o.position.y - 0.3), 1); }
      L.prev.copy(o.position);
      if (k >= 1) land(L, now);
    }
  }
  return {
    fire, update,
    /** something is about to fly or flying (the computer's pacing waits) */ busy: () => live.some((L) => !L.done),
    active: () => live.filter((L) => !L.done).map((L) => ({ shooterUid: L.r.shooterUid, unit: L.r.unit, file: L.r.spec.file, style: L.r.spec.style, spawned: !!L.obj, pos: L.obj ? arr(L.obj.position) : null, k: L.obj ? +Math.min(1, (performance.now() - L.r.releaseAt) / Math.max(1, L.r.arriveAt - L.r.releaseAt)).toFixed(3) : 0 })),
    log: () => log.map((e) => { const { _t, ...x } = e; void _t; return { ...x }; }),
    dispose() { for (const L of live) { if (L.obj) scene.remove(L.obj); if (L.tracer) scene.remove(L.tracer); if (L.flash) scene.remove(L.flash); } live.length = 0; },
  };
}


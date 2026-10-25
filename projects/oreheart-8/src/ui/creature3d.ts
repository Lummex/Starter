// Owner-sheet creatures as real 3D models (Meshy, generated once by tools/gen-creature-3d.mjs, saved under public/models/creatures/<card id>/).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { skinBox } from './grubnak3d';

export type CreatureAnim = 'idle' | 'walk' | 'attack' | 'mine' | 'hit' | 'defeat';
export interface PartCfg { file: string; bone: string[]; /** target length as a fraction of the character height */ len: number; /** point along the long axis (0 bottom .. 1 top) that sits on the bone */ grip: number; rot: [number, number, number]; pos?: [number, number, number]; name: string; axis?: 'x' | 'y' | 'z'; /** owner look (Model Editor): exact bone-local transform of the raw part */ look?: LookPart; /** a mount standing under the rider */ mount?: boolean }
export interface LookPart { bone: string; pos: [number, number, number]; rot: [number, number, number]; scale: [number, number, number] }
/** owner looks (factory-design/looks/*.json): height in squares + stretch of the main model */
export const LOOKS: Record<string, { height: number; stretch: [number, number, number] }> = {
  'goblin-scrapper': { height: 1.188, stretch: [1, 0.93, 1] },
  'goblin-bomber': { height: 0.97, stretch: [1, 1, 1] },
  'goblin-pebbler': { height: 1.011, stretch: [1, 1, 1] },
  'goblin-sneak': { height: 0.982, stretch: [1, 1, 1] },
  'rotgut-grenadier': { height: 1.219, stretch: [1, 1, 1] },
};
/** default height (board squares) for creatures without an owner look */
const DEFAULT_H: Record<string, number> = { 'grubnaks-big-boss-troll': 1.4, 'wolf-rider': 1.35, 'the-great-steam-golem': 1.6, 'ram-rider': 1.35, 'clockwork-beetle': 0.9 };
/** which parts each creature carries (tuned by eye against the owner's assembled reference) */
const PARTS: Record<string, PartCfg[]> = {
  'goblin-scrounger': [
    { name: 'backpack', file: 'backpack.glb', bone: ['Spine02', 'Spine01', 'Spine'], len: 0.36, grip: 0.5, rot: [0, 180, 0], pos: [0, 0, -0.1] },
    { name: 'pickaxe', file: 'pickaxe.glb', bone: ['RightHand'], len: 0.62, grip: 0.3, rot: [180, 0, 0], axis: 'y' },
  ],
  'goblin-pebbler': [{ name: 'club', file: 'club.glb', bone: ['RightHand'], len: 0.55, grip: 0.2, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [-9.231, 12.794, 2.402], rot: [27, 11, 52], scale: [25, 25, 25] } }],
  'goblin-scrapper': [{ name: 'bowling-ball', file: 'bowling-ball.glb', bone: ['RightHand'], len: 0.3, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-3.194, 27.128, -12.731], rot: [50.405, 1.159, 166.638], scale: [23, 23, 23] } }],
  'goblin-bomber': [],
  'goblin-sneak': [
    { name: 'bag', file: 'bag.glb', bone: ['neck'], len: 0.3, grip: 0.5, rot: [0, 0, 0], look: { bone: 'neck', pos: [-5.34, 1.862, -14.029], rot: [8.548, 3.663, 3.154], scale: [15, 15, 15] } },
    { name: 'dagger', file: 'dagger.glb', bone: ['RightHand'], len: 0.4, grip: 0.2, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [8.502, 7.038, -9.251], rot: [159.362, -37.54, -90.548], scale: [29, 29, 29] } },
  ],
  'rotgut-grenadier': [{ name: 'spatula', file: 'spatula.glb', bone: ['RightHand'], len: 0.5, grip: 0.2, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [18.162, -9.844, 27.054], rot: [35.239, -53.157, -88.87], scale: [43, 43 * 1.46, 43 * 0.76] } }],
  'goblin-slinger': [{ name: 'skull-mace', file: 'skull-mace.glb', bone: ['RightHand'], len: 0.5, grip: 0.2, rot: [180, 0, 0], axis: 'y' }],
  'goblin-grunt': [{ name: 'frying-pan', file: 'frying-pan.glb', bone: ['RightHand'], len: 0.42, grip: 0.15, rot: [180, 0, 0], axis: 'y' }],
  'junk-shaman': [{ name: 'staff', file: 'staff.glb', bone: ['RightHand'], len: 0.85, grip: 0.4, rot: [180, 0, 0], axis: 'y' }],
  'shard-guzzler': [{ name: 'rocket', file: 'rocket.glb', bone: ['Spine02', 'Spine01', 'Spine'], len: 0.55, grip: 0.5, rot: [0, 180, 0], pos: [0, 0, -0.14] }],
  'blastrat-sapper': [{ name: 'bomb', file: 'bomb.glb', bone: ['Spine02', 'Spine01', 'Spine'], len: 0.32, grip: 0.5, rot: [0, 180, 0], pos: [0, -0.02, -0.12] }],
  'skullbasher-rusher': [
    { name: 'mace', file: 'mace.glb', bone: ['RightHand'], len: 0.5, grip: 0.2, rot: [180, 0, 0], axis: 'y' },
    { name: 'shield', file: 'shield.glb', bone: ['LeftForeArm'], len: 0.45, grip: 0.5, rot: [0, 90, 0], pos: [0.06, 0, 0] },
  ],
  'wolf-rider': [
    { name: 'wolf', file: 'wolf.glb', bone: [], len: 0.9, grip: 0.5, rot: [0, 0, 0], mount: true },
    { name: 'mace', file: 'mace.glb', bone: ['RightHand'], len: 0.5, grip: 0.2, rot: [180, 0, 0], axis: 'x' },
  ],
  'grubnaks-big-boss-troll': [],
  'shiv-rat': [{ name: 'dagger', file: 'dagger.glb', bone: ['RightHand'], len: 0.4, grip: 0.2, rot: [180, 0, 0], axis: 'y' }],
  'goblin-smith-miner': [
    { name: 'pickaxe', file: 'pickaxe.glb', bone: ['RightHand'], len: 0.55, grip: 0.3, rot: [180, 0, 0], axis: 'y' },
    { name: 'hammer', file: 'hammer.glb', bone: ['LeftHand'], len: 0.4, grip: 0.2, rot: [0, 0, 0], axis: 'y' },
  ],
  // owner (Oct 25): Gnome and Dwarf models, character only for now (the owner adds their items with the Model Editor later)
  'axe-thrower': [],
  'barrelback-courier': [],
  'brewmaster': [],
  'clockwork-beetle': [],
  'crystal-drunk-delver': [],
  'deepforge-crossbowman': [],
  'dwarf-miner': [],
  'dwarf-pickman': [],
  'dwarf-stoneback': [],
  'gearward-sentinel': [],
  'glyphshield-warden': [],
  'gnome-cogger': [],
  'gnome-illusionist': [],
  'gnome-smith-miner': [],
  'gnome-tinker': [],
  'gnome-widget': [],
  'grimhold-ravager': [],
  'gyrocopter-ace': [],
  'hexwright-apprentice': [],
  'ironhammer-berserker': [],
  'oathbound-pikeman': [],
  'phase-stalker': [],
  'queen-brunhilda-stonebeard': [],
  'ram-rider': [],
  'rune-splitter': [],
  'runic-siphoner': [],
  'shieldbeard': [],
  'spark-gnome': [],
  'the-great-steam-golem': [],
};
export const hasCreature3dSlug = (id: string) => id in PARTS;

interface Assets { char: THREE.Object3D; clips: Record<string, THREE.AnimationClip>; parts: Record<string, THREE.Object3D>; info: any }
const cache = new Map<string, Promise<Assets | null>>();
const ready = new Map<string, Assets>();
export const creature3dReady = (id: string) => ready.get(id) || null;

export function loadCreature3d(id: string): Promise<Assets | null> {
  if (!hasCreature3dSlug(id)) return Promise.resolve(null);
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      try {
        const base = `/models/creatures/${id}/`;
        const r = await fetch(base + 'models.json');
        if (!r.ok) return null;
        const info = await r.json();
        const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
        const c = await gl.loadAsync(base + 'char.glb');
        const names = Object.keys(info.actions || {});
        const clips: Record<string, THREE.AnimationClip> = {};
        names.forEach((n, i) => { const cl = c.animations.find((a) => a.name === n) || c.animations[i]; if (cl) clips[n] = cl; });
        const parts: Record<string, THREE.Object3D> = {};
        for (const pc of PARTS[id]) { try { parts[pc.name] = (await gl.loadAsync(base + pc.file)).scene; } catch { /* part missing: the figure still works */ } }
        const a = { char: c.scene, clips, parts, info };
        ready.set(id, a);
        return a;
      } catch { return null; }
    })();
    cache.set(id, p);
  }
  return p;
}

export interface C3D {
  group: THREE.Group; mixer: THREE.AnimationMixer; mats: THREE.MeshStandardMaterial[];
  play(n: CreatureAnim): void; current(): string; update(dt: number): void;
  clipNames: string[]; held: string[]; worn: string[]; height: number;
  /** height in board squares (owner look or default) */ heightSpaces: number; items: { name: string; bone: string; matchesLook: boolean }[]; log: string[]; onPlay?: (n: string) => void; dur(n: string): number;
  /** Bowler Brawler only: hand-keyed special moves, ball hooks, flame effect */ special?: (n: 'bowl' | 'spinBall' | 'basketShot') => void; trig?: (shootT: number, born: number) => void; advanceIdle?: (sec: number) => void; ballInfo?: () => any; effects?: () => any[];
}

/** Instances one figure: the model stands on y = 0, centred, normalised to height 1 (the scene scales it to the board). */
export function makeCreature3d(id: string, a: Assets): C3D {
  const ch = skeletonClone(a.char) as THREE.Object3D;
  const mats: THREE.MeshStandardMaterial[] = [];
  const prep = (o: THREE.Object3D) => o.traverse((m: any) => {
    if (m.isMesh || m.isSkinnedMesh) {
      m.frustumCulled = false; m.castShadow = false;
      const own = (x: any) => { const c = x.clone(); if (c.isMeshStandardMaterial) { if (c.map && !c.emissiveMap) { c.emissiveMap = c.map; c.emissive.setHex(0xffffff); c.emissiveIntensity = 0.5; } c.metalness = Math.min(c.metalness, 0.25); c.userData.e0 = { hex: c.emissive.getHex(), i: c.emissiveIntensity }; mats.push(c); } return c; };
      m.material = Array.isArray(m.material) ? m.material.map(own) : own(m.material);
    }
  });
  prep(ch);
  const held: string[] = [], worn: string[] = [];
  let ballRec: { part: THREE.Object3D; bone: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 } | null = null;
  const items: { name: string; bone: string; matchesLook: boolean }[] = [];
  ch.updateMatrixWorld(true);
  const look = LOOKS[id];
  const H = Math.max(0.01, skinBox(ch).getSize(new THREE.Vector3()).y);
  // the figure is normalised on the body alone when an owner look exists (items must not change its height)
  const mixer = new THREE.AnimationMixer(ch);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const k of Object.keys(a.clips)) actions[k] = mixer.clipAction(a.clips[k]);
  let cur = '';
  const log: string[] = [];
  const once = (n: string) => n === 'attack' || n === 'mine' || n === 'hit' || n === 'defeat';
  const resolve = (n: string) => (actions[n] ? n : n === 'mine' && actions.attack ? 'attack' : 'idle');
  const lockLen = (n: string) => (n === 'defeat' ? 1e9 : Math.min(actions[n]?.getClip().duration || 0.8, n === 'hit' ? 0.8 : 1.1));
  let started = 0;
  const out: C3D = {} as C3D;
  const play = (want: CreatureAnim) => {
    const n = resolve(want);
    if (!actions[n] || cur === n) return;
    // a started one-shot (attack / hit / mine) finishes before idle or walk take over; defeat never ends
    if (cur && once(cur) && !once(n) && mixer.time - started < lockLen(cur)) return;
    if (cur === 'defeat') return;
    const next = actions[n];
    next.reset(); next.setLoop(once(n) ? THREE.LoopOnce : THREE.LoopRepeat, once(n) ? 1 : Infinity); next.clampWhenFinished = true;
    const prev = actions[cur]; if (prev && prev !== next) next.crossFadeFrom(prev, 0.15, false);
    next.play(); cur = n; started = mixer.time; log.push(n); out.onPlay?.(n);
  };
  play('idle');
  mixer.setTime(0); started = 0;
  // stand on the ground, centred, height 1
  const b = skinBox(ch, new THREE.Box3());
  const bodyH = Math.max(0.01, b.max.y - b.min.y);
  for (const pc of PARTS[id]) {
    const src = a.parts[pc.name]; if (!src || pc.mount) continue;
    if (pc.look) {
      const bone = ch.getObjectByName(pc.look.bone);
      if (!bone) continue;
      const part = src.clone(true); prep(part);
      part.position.set(...pc.look.pos); part.rotation.set(...(pc.look.rot.map((d) => THREE.MathUtils.degToRad(d)) as [number, number, number]), 'XYZ'); part.scale.set(...pc.look.scale);
      bone.add(part);
      if (pc.name === 'bowling-ball') ballRec = { part, bone, p: part.position.clone(), q: part.quaternion.clone(), s: part.scale.clone() };
      items.push({ name: pc.name, bone: bone.name, matchesLook: true });
      (/Hand/.test(bone.name) ? held : worn).push(pc.name);
      continue;
    }
    const bn = attachPart(ch, pc, src, H, prep);
    if (bn) { items.push({ name: pc.name, bone: bn, matchesLook: false }); (/Hand/.test(bn) ? held : worn).push(pc.name); }
  }
  const root = new THREE.Group();
  const sc = new THREE.Group();
  const k = 1 / bodyH;
  ch.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  let heightSpaces = look ? look.height : DEFAULT_H[id] || 1.1;
  const st = look ? look.stretch : [1, 1, 1];
  sc.scale.set(k * st[0], k * st[1], k * st[2]);
  sc.add(ch); root.add(sc);
  // a mount stands on the ground; the rider sits on its back
  const mt = PARTS[id].find((p) => p.mount);
  if (mt && a.parts[mt.name]) {
    const w = a.parts[mt.name].clone(true); prep(w);
    const wb = new THREE.Box3().setFromObject(w), ws = wb.getSize(new THREE.Vector3()), wc = wb.getCenter(new THREE.Vector3());
    const long = Math.max(ws.x, ws.z);
    const kw = mt.len / Math.max(long, 1e-4);
    const holder = new THREE.Group();
    w.position.set(-wc.x, -wb.min.y, -wc.z);
    holder.add(w); holder.scale.setScalar(kw);
    if (ws.x > ws.z) holder.rotation.y = Math.PI / 2; // long axis along the facing (+Z)
    root.add(holder);
    const seat = ws.y * kw * 0.62;
    sc.scale.multiplyScalar(0.8);
    sc.position.y = seat; sc.position.z = -0.02;
    root.userData.mount = true;
    items.push({ name: mt.name, bone: 'ground', matchesLook: false });
    const total = seat + 0.8;
    root.scale.setScalar(1 / total);
    heightSpaces = DEFAULT_H[id] || 1.35;
    root.scale.setScalar(heightSpaces / 1.1 / total);
  } else root.scale.setScalar(heightSpaces / 1.1);
  const rig = ballRec ? makeBallRig(ch, root, ballRec, out, log, () => cur, () => heightSpaces) : null;
  Object.assign(out, { group: root, mixer, mats, play, current: () => cur, update: (dt: number) => { mixer.update(dt); if (rig) rig.step(dt); }, clipNames: Object.keys(actions), held, worn, height: 1, heightSpaces, items, log, dur: (n: string) => actions[resolve(n)]?.getClip().duration || 0 });
  if (rig) { out.clipNames = [...out.clipNames, 'bowl', 'spinBall', 'basketShot']; out.special = rig.special; out.trig = rig.trig; out.advanceIdle = rig.advanceIdle; out.ballInfo = rig.info; out.effects = rig.effects; const cn = out.clipNames; Object.defineProperty(out, 'current', { value: () => rig.active() || cur }); void cn; }
  return out;
}

/** Fits a Meshy part (long axis -> up, grip point at the origin) onto a bone of a skinned character; returns the bone name used. */
export function attachPart(ch: THREE.Object3D, pc: PartCfg, src: THREE.Object3D, H: number, prep: (o: THREE.Object3D) => void): string {
  let bone: THREE.Object3D | null = null;
  for (const n of pc.bone) { bone = ch.getObjectByName(n) || null; if (bone) break; }
  if (!bone) return '';
  const part = src.clone(true); prep(part);
  const pb = new THREE.Box3().setFromObject(part), sz = pb.getSize(new THREE.Vector3());
  const axis = pc.axis || (sz.y >= sz.x && sz.y >= sz.z ? 'y' : sz.x >= sz.z ? 'x' : 'z');
  const k = (pc.len * H) / Math.max(sz[axis], 1e-4);
  const ctr = pb.getCenter(new THREE.Vector3());
  // long axis -> +Y, grip point at the origin
  const lift = new THREE.Group();
  const inner = new THREE.Group();
  part.position.set(-ctr.x, -ctr.y, -ctr.z);
  inner.add(part);
  if (axis === 'x') inner.rotation.z = Math.PI / 2; else if (axis === 'z') inner.rotation.x = Math.PI / 2;
  lift.add(inner);
  lift.position.set(0, -(pc.grip - 0.5) * sz[axis], 0);
  const hold = new THREE.Group();
  hold.add(lift);
  const ws = new THREE.Vector3(); bone.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), ws);
  hold.scale.setScalar(k / Math.max(ws.x, 1e-6));
  hold.rotation.set(THREE.MathUtils.degToRad(pc.rot[0]), THREE.MathUtils.degToRad(pc.rot[1]), THREE.MathUtils.degToRad(pc.rot[2]));
  if (pc.pos) hold.position.set(pc.pos[0] * H / Math.max(ws.x, 1e-6), pc.pos[1] * H / Math.max(ws.x, 1e-6), pc.pos[2] * H / Math.max(ws.x, 1e-6));
  const ov = (globalThis as any).__tune?.[pc.name]; if (ov) { hold.position.set(ov[0] * H / Math.max(ws.x, 1e-6), ov[1] * H / Math.max(ws.x, 1e-6), ov[2] * H / Math.max(ws.x, 1e-6)); if (ov[3] !== undefined) hold.rotation.set(THREE.MathUtils.degToRad(ov[3]), THREE.MathUtils.degToRad(ov[4]), THREE.MathUtils.degToRad(ov[5])); }
  bone.add(hold);
  return bone.name;
}

// ---------------------------------------------------------------- Round 22.5: Bowler Brawler special moves (hand-keyed arm aims + a scripted ball)
let flameTex: THREE.Texture | null = null;
const FLAME = { size: 0.29, height: 1, speed: 1.38, core: '#238b5a', mid: '#00f088', tip: '#00ff04' };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _box = new THREE.Box3(), _id = new THREE.Quaternion();
const ease = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

function aim(bone: THREE.Object3D, child: THREE.Object3D, dirWorld: THREE.Vector3, w: number) {
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(true, false);
  bone.getWorldPosition(_a); child.getWorldPosition(_b);
  _d.subVectors(_b, _a).normalize();
  _q.setFromUnitVectors(_d, dirWorld); _q2.copy(_id).slerp(_q, w);
  bone.getWorldQuaternion(_q); _q.premultiply(_q2);
  bone.parent!.getWorldQuaternion(_qi).invert();
  bone.quaternion.copy(_qi.multiply(_q));
  bone.updateMatrixWorld(true);
}

function makeBallRig(ch: THREE.Object3D, root: THREE.Group, rec: { part: THREE.Object3D; bone: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }, out: C3D, log: string[], cur: () => string, hs: () => number) {
  const arm = ch.getObjectByName('RightArm'), fore = ch.getObjectByName('RightForeArm'), hand = ch.getObjectByName('RightHand');
  const part = rec.part;
  const flame = new THREE.Group(); flame.visible = true; root.add(flame);
  const layers: THREE.Sprite[] = [];
  if (!flameTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!, g = x.createRadialGradient(32, 40, 0, 32, 40, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    flameTex = new THREE.CanvasTexture(c);
  }
  for (const col of [FLAME.tip, FLAME.mid, FLAME.core]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.center.set(0.5, 0.25); flame.add(sp); layers.push(sp);
  }
  let ready = false, r = 0.07, off = new THREE.Vector3(), sx = 1;
  let state = 'hand', detached = false, spec = '', t = 0, D = 0, rollD = 0, vz = 0, pos = new THREE.Vector3(), vel = new THREE.Vector3(), landed = false;
  let idleT = 0, idleThr = 10 + Math.random() * 10, lastShoot = 0, bornDone = false, clock = 0;
  let minClear = Infinity, pen = 0, plog: string[] = [], lastLanding = { bounces: 0, rollDistance: 0 };
  const dirA = new THREE.Vector3(), dirB = new THREE.Vector3(), q0 = new THREE.Quaternion();
  const center = (v: THREE.Vector3) => { _box.setFromObject(part); _box.getCenter(v); root.worldToLocal(v); return v; };
  const ws = () => root.getWorldScale(_c).y;
  const init = () => {
    if (ready || !hand) return;
    const w = ws(); if (w < 0.05) return;
    root.updateMatrixWorld(true);
    _box.setFromObject(part); r = Math.max(0.01, (_box.max.y - _box.min.y) / 2 / w);
    const c = center(new THREE.Vector3());
    part.getWorldPosition(_t); root.worldToLocal(_t); off.copy(c).sub(_t);
    sx = c.x >= 0 ? 1 : -1; ready = true;
  };
  const detach = () => { if (detached) return; root.attach(part); detached = true; };
  const reattach = () => { if (!detached) return; rec.bone.add(part); part.position.copy(rec.p); part.quaternion.copy(rec.q); part.scale.copy(rec.s); detached = false; state = 'hand'; };
  const setCenter = (v: THREE.Vector3) => { part.position.copy(v).sub(off); };
  const start = (n: 'bowl' | 'spinBall' | 'basketShot') => {
    init(); if (!ready || spec) return;
    spec = n; t = 0; plog = []; state = n === 'spinBall' ? 'hand' : 'swing'; landed = false; idleT = 0; idleThr = 10 + Math.random() * 10;
    D = n === 'bowl' ? 1.6 : n === 'basketShot' ? 2.7 : 2.6;
    log.push(n); out.onPlay?.(n);
    if (n === 'bowl') { plog.push('swingBack'); dirA.set(sx * 0.75, -0.2, -0.65); dirB.set(sx * 0.3, -0.5, 0.85); }
    else if (n === 'basketShot') { plog.push('shoot'); dirA.set(sx * 0.15, 1, 0.35); }
    else { plog.push('spin'); dirA.set(sx * 0.3, 0.35, 0.9); }
    dirA.normalize(); dirB.normalize();
  };
  const toWorldDir = (v: THREE.Vector3, o: THREE.Vector3) => o.copy(v).applyQuaternion(root.getWorldQuaternion(q0)).normalize();
  const finish = () => { reattach(); spec = ''; state = 'hand'; };
  const step = (dt: number) => {
    clock += dt; init();
    if (!ready) return;
    if (!spec) { if (cur() === 'idle') { idleT += dt; if (idleT >= idleThr) start('spinBall'); } else idleT = 0; }
    else {
      t += dt;
      let w = 0;
      if (spec === 'bowl') {
        if (t < 0.45) w = ease(t / 0.45), toWorldDir(dirA, _t);
        else if (t < 0.7) { w = 1; toWorldDir(_c.copy(dirA).lerp(dirB, ease((t - 0.45) / 0.25)).normalize(), _t); }
        else { w = 1 - ease((t - 0.7) / 0.3); toWorldDir(dirB, _t); }
        if (t >= 0.7 && !detached) {
          plog.push('release'); center(pos); detach(); state = 'rolling'; plog.push('roll'); rollD = 0; pos.z = pos.z; vz = 2.4; pos.y = r + 0.002; pos.x = pos.x;
        }
        if (detached) {
          const k = Math.max(0, 1 - (t - 0.7) / 0.85); const sp = vz * k; pos.z += sp * dt; rollD += sp * dt; pos.y = r + 0.002;
          setCenter(pos); part.rotateOnWorldAxis(_d.set(1, 0, 0), sp * dt / r);
          if (t - 0.7 > 0.85) { lastLanding = { bounces: 0, rollDistance: +(rollD * hs()).toFixed(3) }; finish(); }
        }
      } else if (spec === 'basketShot') {
        if (t < 0.5) w = ease(t / 0.5); else w = 1 - ease((t - 0.5) / 0.4);
        toWorldDir(dirA, _t);
        if (t >= 0.5 && !detached) {
          center(pos); detach(); state = 'flying'; plog.push('fly');
          const T = 0.9, g = 7, ty = r + 0.002;
          vel.set((sx * 0.1 - pos.x) / T, (ty - pos.y + 0.5 * g * T * T) / T, (0.9 - pos.z) / T);
        }
        if (detached && !landed) {
          vel.y -= 7 * dt; pos.addScaledVector(vel, dt);
          if (pos.y <= r + 0.002 && vel.y < 0) { pos.y = r + 0.002; landed = true; state = 'landed'; plog.push('land'); lastLanding = { bounces: 0, rollDistance: 0 }; }
          setCenter(pos); part.rotateOnWorldAxis(_d.set(1, 0, 0), 9 * dt);
        }
        if (landed && t > 2.3) finish();
      } else {
        w = ease(t / 0.4) * (t > D - 0.4 ? ease((D - t) / 0.4) : 1);
        toWorldDir(dirA, _t);
        if (t > 0.35) {
          if (!detached) detach();
          if (hand) { hand.getWorldPosition(pos); root.worldToLocal(pos); pos.y += r * 1.3; }
          setCenter(pos); part.rotateOnWorldAxis(_d.set(0, 1, 0), 14 * dt);
        }
        if (t >= D) finish();
      }
      if (arm && fore && hand && w > 0.001) { aim(arm, fore, _t, w); aim(fore, hand, _t, w); }
      if (spec && !detached && hand === rec.bone) { /* ball follows the hand while swinging */ }
    }
    // hooks: lowest ball bottom, body hits, flame follows the ball
    const c = center(_c);
    if (detached) minClear = Math.min(minClear, (c.y - r) * hs()); // a ball held in the hand rides the animation; only a free ball can sink into the ground
    if (c.y > 0.2 && c.y < 0.9 && Math.hypot(c.x, c.z) < 0.13) pen++;
    flame.position.copy(c);
    const W = r * 2 * (FLAME.size / 0.29) * 1.4, Hh = r * 2 * 1.6 * FLAME.height;
    layers.forEach((sp, i) => { const f = 1 + 0.18 * Math.sin(clock * 9 * FLAME.speed + i * 2) * Math.sin(clock * 5.3 * FLAME.speed + i); const k = 1 - i * 0.28; sp.scale.set(W * k * f, Hh * k * f, 1); });
  };
  return {
    special: start,
    active: () => spec,
    step,
    trig: (shootT: number, born: number) => {
      if (born && !bornDone) { start('basketShot'); if (spec) bornDone = true; }
      if (shootT && shootT !== lastShoot) { lastShoot = shootT; if (spec === 'spinBall') finish(); start('bowl'); }
    },
    advanceIdle: (sec: number) => { idleT += sec; if (!spec && idleT >= idleThr - 1e-6) start('spinBall'); },
    info: () => ({ state, bone: 'RightHand', log: plog.slice(), minGroundClearance: isFinite(minClear) ? +minClear.toFixed(4) : 0, bodyPenetrations: pen, lastLanding }),
    effects: () => [{ name: 'Flame', type: 'flame', attachedTo: 'bowling-ball', visible: flame.visible, settings: { size: FLAME.size, height: FLAME.height, speed: FLAME.speed, cCore: FLAME.core, cMid: FLAME.mid, cTip: FLAME.tip, coreColor: FLAME.core, midColor: FLAME.mid, tipColor: FLAME.tip, colors: { core: FLAME.core, mid: FLAME.mid, tip: FLAME.tip } } }],
  };
}

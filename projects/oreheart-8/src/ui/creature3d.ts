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
/** default height (board squares) for the goblins without an owner look */
const DEFAULT_H: Record<string, number> = { 'grubnaks-big-boss-troll': 1.4, 'wolf-rider': 1.35 };
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
  Object.assign(out, { group: root, mixer, mats, play, current: () => cur, update: (dt: number) => mixer.update(dt), clipNames: Object.keys(actions), held, worn, height: 1, heightSpaces, items, log, dur: (n: string) => actions[resolve(n)]?.getClip().duration || 0 });
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

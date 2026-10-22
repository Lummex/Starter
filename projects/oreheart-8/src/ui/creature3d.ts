// Owner-sheet creatures as real 3D models (Meshy, generated once by tools/gen-creature-3d.mjs, saved under public/models/creatures/<card id>/).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { skinBox } from './grubnak3d';

export type CreatureAnim = 'idle' | 'walk' | 'attack' | 'mine' | 'hit' | 'defeat';
export interface PartCfg { file: string; bone: string[]; /** target length as a fraction of the character height */ len: number; /** point along the long axis (0 bottom .. 1 top) that sits on the bone */ grip: number; rot: [number, number, number]; pos?: [number, number, number]; name: string; axis?: 'x' | 'y' | 'z' }
/** which parts each creature carries (tuned by eye against the owner's assembled reference) */
const PARTS: Record<string, PartCfg[]> = {
  'goblin-scrounger': [
    { name: 'backpack', file: 'backpack.glb', bone: ['Spine02', 'Spine01', 'Spine'], len: 0.36, grip: 0.5, rot: [0, 180, 0], pos: [0, 0, -0.1] },
    { name: 'pickaxe', file: 'pickaxe.glb', bone: ['RightHand'], len: 0.62, grip: 0.3, rot: [180, 0, 0], axis: 'y' },
  ],
  'goblin-pebbler': [{ name: 'club', file: 'club.glb', bone: ['RightHand'], len: 0.55, grip: 0.2, rot: [180, 0, 0], axis: 'y' }],
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
  ch.updateMatrixWorld(true);
  const H = Math.max(0.01, skinBox(ch).getSize(new THREE.Vector3()).y);
  for (const pc of PARTS[id]) {
    const src = a.parts[pc.name]; if (!src) continue;
    const bn = attachPart(ch, pc, src, H, prep);
    if (bn) (/Hand/.test(bn) ? held : worn).push(pc.name);
  }
  const mixer = new THREE.AnimationMixer(ch);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const k of Object.keys(a.clips)) actions[k] = mixer.clipAction(a.clips[k]);
  let cur = '';
  const play = (n: CreatureAnim) => {
    const next = actions[n] || actions.idle; if (!next || cur === n) return;
    const once = n === 'attack' || n === 'mine' || n === 'hit' || n === 'defeat';
    next.reset(); next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); next.clampWhenFinished = true;
    const prev = actions[cur]; if (prev && prev !== next) next.crossFadeFrom(prev, 0.15, false);
    next.play(); cur = n;
  };
  play('idle');
  // stand on the ground, centred, height 1
  mixer.setTime(0);
  const b = skinBox(ch, new THREE.Box3());
  const root = new THREE.Group();
  const sc = new THREE.Group();
  sc.scale.setScalar(1 / Math.max(0.01, b.max.y - b.min.y));
  ch.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  sc.add(ch); root.add(sc);
  return { group: root, mixer, mats, play, current: () => cur, update: (dt) => mixer.update(dt), clipNames: Object.keys(actions), held, worn, height: 1 };
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

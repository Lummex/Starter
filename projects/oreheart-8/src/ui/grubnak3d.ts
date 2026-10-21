// Grubnak Rotgut as a real 3D model (Meshy, generated once by tools/gen-grubnak-3d.mjs and saved under public/models/commanders).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = '/models/commanders/';
export const GRUBNAK_ANIMS = ['idle', 'laugh', 'point', 'celebrate', 'surprised', 'cast', 'hit', 'defeat'] as const;
export type GrubnakAnim = (typeof GRUBNAK_ANIMS)[number];

export interface G3DAssets {
  char: THREE.Object3D;
  clips: Record<string, THREE.AnimationClip>;
  fortress: THREE.Object3D;
  scepter: THREE.Object3D | null;
  info: any;
}

let loading: Promise<G3DAssets | null> | null = null;
let loaded: G3DAssets | null = null;
export const grubnak3dReady = () => loaded;

/** Loads the saved models once; resolves null when they are not shipped (the procedural figure stays). */
export function loadGrubnak3d(): Promise<G3DAssets | null> {
  return (loading ||= (async () => {
    try {
      const r = await fetch(BASE + 'models.json');
      if (!r.ok) return null;
      const info = await r.json();
      const gl = new GLTFLoader();
      const [c, f, s] = await Promise.all([
        gl.loadAsync(BASE + 'grubnak.glb'),
        gl.loadAsync(BASE + 'grubnak-fortress.glb'),
        gl.loadAsync(BASE + 'grubnak-scepter.glb').catch(() => null),
      ]);
      const clips: Record<string, THREE.AnimationClip> = {};
      const names: Record<string, string> = info.clipNames || {};
      for (const k of GRUBNAK_ANIMS) {
        const want = names[k];
        const clip = c.animations.find((a) => a.name === want) || c.animations[GRUBNAK_ANIMS.indexOf(k)];
        if (clip) clips[k] = clip;
      }
      loaded = { char: c.scene, clips, fortress: f.scene, scepter: s ? s.scene : null, info };
      return loaded;
    } catch {
      return null;
    }
  })());
}

export interface G3D {
  /** fortress + character, one space wide */
  group: THREE.Group;
  /** only the character (so the fortress can stay when he leaves) */
  figure: THREE.Group;
  fortress: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  play(name: GrubnakAnim, opts?: { loop?: boolean }): void;
  current(): string;
  update(dt: number): void;
  clipNames: string[]; scepterBone?: string; held?: any;
  /** native-units height of the whole assembly */
  height: number;
}

/** Bounding box that follows the skeleton (Meshy rigs sit under a 0.01-scaled armature, so the raw geometry box is wrong). */
export function skinBox(o: THREE.Object3D, into = new THREE.Box3()): THREE.Box3 {
  o.updateMatrixWorld(true);
  o.traverse((m: any) => {
    if (m.isSkinnedMesh) {
      m.skeleton.update(); m.boundingBox = null; m.computeBoundingBox();
      into.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld));
    } else if (m.isMesh) into.expandByObject(m);
  });
  return into;
}
const box = (o: THREE.Object3D) => skinBox(o, new THREE.Box3());

export interface OwnerPose { fort: { scale: number; sx?: number; sy?: number; sz?: number; turn: number }; cmd: { scale: number; turn: number }; groups?: number }
const OWNER_FORT_K = 0.67, OWNER_CMD_K = 1.54;
const D2R = Math.PI / 180;

/** Owner's Game Editor pose: each model's bounding-box bottom-centre sits at the piece's board point (y = 0), scaled by Model Editor scale x piece scale, stretched in its own axes, then turned (no tilt, no lean). */
function makeGrubnakOwner(a: G3DAssets, pose: OwnerPose): G3D {
  const group = new THREE.Group();
  const figure = new THREE.Group(); // yaw holder (the scene turns this one for look-backs)
  const place = (obj: THREE.Object3D, k: number, st: { sx?: number; sy?: number; sz?: number }, idle?: THREE.AnimationClip) => {
    let b = box(obj);
    if (idle) {
      // stand on the ground through the whole Idle loop: use the lowest point over the clip, bottom-centre from the first frame
      const m = new THREE.AnimationMixer(obj); m.clipAction(idle).play();
      let lo = Infinity;
      for (let i = 0; i < 8; i++) { m.setTime((idle.duration * i) / 8); lo = Math.min(lo, box(obj).min.y); if (i === 0) b = box(obj); }
      m.stopAllAction(); m.uncacheRoot(obj);
      b = b.clone(); b.min.y = lo;
    }
    obj.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    const sc = new THREE.Group();
    sc.scale.set(k * (st.sx ?? 1), k * (st.sy ?? 1), k * (st.sz ?? 1));
    sc.add(obj);
    return sc;
  };
  const fortress = a.fortress.clone(true);
  fortress.updateMatrixWorld(true);
  const fYaw = new THREE.Group();
  fYaw.rotation.y = pose.fort.turn * D2R;
  fYaw.add(place(fortress, OWNER_FORT_K * pose.fort.scale * (pose.groups ?? 1), pose.fort));
  group.add(fYaw);
  const ch = skeletonClone(a.char) as THREE.Object3D;
  ch.traverse((o: any) => { if (o.isMesh || o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = false; } });
  figure.add(place(ch, OWNER_CMD_K * pose.cmd.scale * (pose.groups ?? 1), {}, a.clips.idle));
  figure.rotation.y = pose.cmd.turn * D2R;
  group.add(figure);
  return finish(a, group, figure, fortress, ch);
}

export function makeGrubnak3d(a: G3DAssets, pose?: OwnerPose): G3D {
  if (pose) return makeGrubnakOwner(a, pose);
  const group = new THREE.Group();
  const figure = new THREE.Group();
  // fortress: footprint 1 x 1, standing on y = 0
  const fortress = a.fortress.clone(true);
  let fb = box(fortress);
  const fw = Math.max(fb.max.x - fb.min.x, fb.max.z - fb.min.z, 0.01);
  fortress.scale.multiplyScalar(1 / fw);
  fb = box(fortress);
  fortress.position.set(-(fb.max.x + fb.min.x) / 2, -fb.min.y, -(fb.max.z + fb.min.z) / 2);
  group.add(fortress);
  const top = box(fortress).max.y;
  // character: about 1.5 tall, standing on the fortress top
  const ch = skeletonClone(a.char) as THREE.Object3D;
  ch.traverse((o: any) => { if (o.isMesh || o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = false; } });
  const cb0 = box(ch);
  const H = 1.5;
  ch.scale.multiplyScalar(H / Math.max(cb0.max.y - cb0.min.y, 0.01));
  ch.updateMatrixWorld(true);
  const cb = box(ch);
  ch.position.set(-(cb.max.x + cb.min.x) / 2, top - cb.min.y, -(cb.max.z + cb.min.z) / 2);
  figure.add(ch);
  group.add(figure);
  return finish(a, group, figure, fortress, ch);
}

function finish(a: G3DAssets, group: THREE.Group, figure: THREE.Group, fortress: THREE.Object3D, ch: THREE.Object3D): G3D {
  // scepter in the right hand
  let scepterBone = '';
  if (a.scepter) {
    // Owner's Model Editor setup: scepter on the RightHand bone, position -4.404, 8.752, -3.774, rotation -109.365 / 5.199 / 154.757 degrees (XYZ), scale 61.35 (glb units)
    const hand = ch.getObjectByName('RightHand') || (() => { let f: THREE.Object3D | null = null; ch.traverse((o) => { if (!f && o.type === 'Bone' && /right.?hand$|hand.?r$|r_?hand$/i.test(o.name)) f = o; }); return f; })();
    if (hand) {
      const hold = new THREE.Group();
      hold.position.set(-4.404, 8.752, -3.774);
      hold.rotation.set(THREE.MathUtils.degToRad(-109.365), THREE.MathUtils.degToRad(5.199), THREE.MathUtils.degToRad(154.757), 'XYZ');
      hold.scale.setScalar(61.35);
      hold.add(a.scepter.clone(true));
      hand.add(hold);
      scepterBone = hand.name;
    }
  }
  const mixer = new THREE.AnimationMixer(ch);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const k of Object.keys(a.clips)) actions[k] = mixer.clipAction(a.clips[k]);
  let cur = '';
  let back: ReturnType<typeof setTimeout> | null = null;
  const play = (name: GrubnakAnim, opts: { loop?: boolean } = {}) => {
    const next = actions[name];
    if (!next) return;
    if (back) { clearTimeout(back); back = null; }
    const once = name !== 'idle' && !opts.loop;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = true;
    next.enabled = true;
    const prev = actions[cur];
    if (prev && prev !== next) next.crossFadeFrom(prev, 0.2, false);
    next.play();
    cur = name;
    if (once && name !== 'defeat') {
      const ms = Math.max(300, next.getClip().duration * 1000 - 150);
      back = setTimeout(() => { back = null; play('idle'); }, ms);
    }
  };
  play('idle');
  const total = box(group);
  return { group, figure, fortress, mixer, play, current: () => cur, update: (dt) => mixer.update(dt), clipNames: Object.keys(actions), scepterBone, held: scepterBone ? { item: 'scepter', bone: scepterBone, position: [-4.404, 8.752, -3.774], rotationDeg: [-109.365, 5.199, 154.757], scale: 61.35 } : null, height: total.max.y - total.min.y };
}

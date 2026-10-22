// Grubnak Rotgut as a real 3D model (Meshy, generated once by tools/gen-grubnak-3d.mjs and saved under public/models/commanders).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { attachPart } from './creature3d';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = '/models/creatures/grubnak/';
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
      const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const [c, f, s] = await Promise.all([
        gl.loadAsync(BASE + 'char.glb'),
        gl.loadAsync(BASE + 'throne.glb'),
        gl.loadAsync(BASE + 'scepter.glb').catch(() => null),
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


const D2R = Math.PI / 180;
/** Round 12b-1: Grubnak SEATED on his junk throne (the throne replaces the castle/stand). The throne stands flat on the board point; he sits in it holding the staff,
 *  both turned to the owner's `turn` (146 deg = toward the enemy corner). `figure` (the seated Grubnak) turns alone for look-backs. */
const THRONE_H = 1.5, SEAT = { k: 0.55, y: 0.17, z: 0.1 };
export interface OwnerPose { fort: { scale: number; sx?: number; sy?: number; sz?: number; turn: number }; cmd: { scale: number; turn: number }; groups?: number }

export function makeGrubnak3d(a: G3DAssets, pose?: OwnerPose): G3D {
  const turn = (pose?.cmd.turn ?? 0) * D2R;
  const group = new THREE.Group();
  const figure = new THREE.Group();
  const tH = THRONE_H * (pose?.groups ?? 1);
  // throne: bottom-centre on the board point, upright, turned with Grubnak
  const throne = a.fortress.clone(true);
  let tb = box(throne);
  const tk = tH / Math.max(tb.max.y - tb.min.y, 0.01);
  const tsc = new THREE.Group(); tsc.scale.setScalar(tk);
  throne.position.set(-(tb.min.x + tb.max.x) / 2, -tb.min.y, -(tb.min.z + tb.max.z) / 2);
  tsc.add(throne);
  const tYaw = new THREE.Group(); tYaw.rotation.y = turn; tYaw.add(tsc);
  group.add(tYaw);
  // Grubnak
  const ch = skeletonClone(a.char) as THREE.Object3D;
  ch.traverse((o: any) => { if (o.isMesh || o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = false; } });
  const idle = a.clips.idle;
  const m0 = new THREE.AnimationMixer(ch); if (idle) { m0.clipAction(idle).play(); m0.setTime(0); }
  ch.updateMatrixWorld(true);
  const cb0 = box(ch);
  const H0 = cb0.max.y - cb0.min.y;
  let scepterBone = '';
  if (a.scepter) {
    const pcfg = { name: 'scepter', file: '', bone: ['RightHand'], len: 1.05, grip: 0.12, rot: [90, 0, 0] as [number, number, number], axis: 'y' as const };
    scepterBone = attachPart(ch, pcfg, a.scepter, H0, () => {});
  }
  m0.stopAllAction(); m0.uncacheRoot(ch);
  const ck = (SEAT.k * tH) / Math.max(H0, 0.01);
  const sc = new THREE.Group(); sc.scale.setScalar(ck);
  ch.position.set(-(cb0.min.x + cb0.max.x) / 2, -cb0.min.y, -(cb0.min.z + cb0.max.z) / 2);
  sc.add(ch);
  figure.add(sc);
  figure.position.set(Math.sin(turn) * SEAT.z * tH, SEAT.y * tH, Math.cos(turn) * SEAT.z * tH);
  figure.rotation.y = turn;
  group.add(figure);
  return finish(a, group, figure, throne, ch, scepterBone);
}

function finish(a: G3DAssets, group: THREE.Group, figure: THREE.Group, fortress: THREE.Object3D, ch: THREE.Object3D, scepterBone: string): G3D {
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
  return { group, figure, fortress, mixer, play, current: () => cur, update: (dt) => mixer.update(dt), clipNames: Object.keys(actions), scepterBone, held: scepterBone ? { item: 'scepter', bone: scepterBone } : null, height: total.max.y - total.min.y };
}

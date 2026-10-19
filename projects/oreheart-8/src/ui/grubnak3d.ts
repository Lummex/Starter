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
  clipNames: string[];
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

export function makeGrubnak3d(a: G3DAssets): G3D {
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
  // scepter in the right hand
  if (a.scepter) {
    let hand: THREE.Object3D | null = null;
    ch.traverse((o) => { if (!hand && o.type === 'Bone' && /right.?hand$|hand.?r$|r_?hand$/i.test(o.name)) hand = o; });
    if (hand) {
      const sc = a.scepter.clone(true);
      const sb = box(sc);
      const len = Math.max(sb.max.y - sb.min.y, 0.01);
      // bones live in the (scaled) character's local space
      const worldS = new THREE.Vector3(); (hand as THREE.Object3D).getWorldScale(worldS);
      sc.scale.multiplyScalar((0.9 / len) / Math.max(worldS.x, 1e-4));
      sc.position.set(0, 0, 0);
      (hand as THREE.Object3D).add(sc);
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
  return { group, figure, fortress, mixer, play, current: () => cur, update: (dt) => mixer.update(dt), clipNames: Object.keys(actions), height: total.max.y - total.min.y };
}

// Grubnak Rotgut as a real 3D model (Meshy, generated once by tools/gen-grubnak-3d.mjs and saved under public/models/commanders).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { attachPart, packClipsFor } from './creature3d';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = '/models/creatures/grubnak/';
export const GRUBNAK_ANIMS = ['idle', 'laugh', 'point', 'celebrate', 'surprised', 'cast', 'hit', 'defeat'] as const;
export type GrubnakAnim = (typeof GRUBNAK_ANIMS)[number];

export interface G3DAssets {
  /** Oct 30: a hand prop placed exactly as in Ken's Studio setup (Ledger) */ prop?: THREE.Object3D | null;
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
  play(name: GrubnakAnim | string, opts?: { loop?: boolean }): void;
  current(): string;
  update(dt: number): void;
  clipNames: string[]; scepterBone?: string; held?: any;
  /** native-units height of the whole assembly */
  height: number;
  /** Oct 30: file names reported by the test hook (only set for Commanders other than Grubnak) */
  files?: { source: string; fortress: string; scepter: string };
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
export interface OwnerPose { fort: { scale: number; sx?: number; sy?: number; sz?: number; turn: number }; cmd: { scale: number; turn: number }; groups?: number;
  /** Ken (Oct 30 playtest): Commander size on the board (owner-layout characterSizes.commanders, 1 = the old size) and whether the throne / stronghold under a 3D Commander shows (characterSizes.commanderBase) */ size?: number; base?: boolean }

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
  const onBase = pose?.base ?? true, size = pose?.size ?? 1;
  tYaw.visible = onBase; // Ken (Oct 30): "take the thrones off them" (kept, hidden, so the stronghold spot and its test poses stay put)
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
  const ck = (SEAT.k * tH * size) / Math.max(H0, 0.01);
  const sc = new THREE.Group(); sc.scale.setScalar(ck);
  ch.position.set(-(cb0.min.x + cb0.max.x) / 2, -cb0.min.y, -(cb0.min.z + cb0.max.z) / 2);
  sc.add(ch);
  figure.add(sc);
  if (onBase) figure.position.set(Math.sin(turn) * SEAT.z * tH, SEAT.y * tH, Math.cos(turn) * SEAT.z * tH); // without the throne he stands on the ground
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
  const play = (want: GrubnakAnim | string, opts: { loop?: boolean } = {}) => {
    // Oct 30: a Commander without a clip for this emote plays a stand-in (attack / hit / idle); Grubnak has every clip, so nothing changes for him
    const name = actions[want] ? want : actions[EMOTE_FALLBACK[want]] ? EMOTE_FALLBACK[want] : actions.idle ? 'idle' : '';
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

// ---------------------------------------------------------------- Oct 30: other Commanders as 3D models (Thane Borgo first)
/** emotes a Commander may lack -> the clip that stands in for it */
const EMOTE_FALLBACK: Record<string, string> = { laugh: 'attack', point: 'attack', celebrate: 'attack', cast: 'attack', taunt: 'attack', cheer: 'attack', surprised: 'hit', flinch: 'hit', walk: 'idle' };
/** per Commander: model folder, files and how tall he stands (board squares) on top of his stronghold */
type Look = { bone: string; pos: [number, number, number]; rot: [number, number, number]; scale: [number, number, number] };
const OTHER_CMDS: Record<string, { base: string; files: { source: string; fortress: string; scepter: string }; figH: number; keepK: number; deck: number; sceptre: { len: number; grip: number; rot: [number, number, number]; upright?: boolean }; prop?: { file: string; look: Look } }> = {
  borgo: { base: '/models/commanders/borgo/', files: { source: 'borgo.glb', fortress: 'dwarf-stronghold', scepter: 'borgo-sceptre.glb' }, figH: 0.8, keepK: 1.1, deck: 0.71, sceptre: { len: 0.5, grip: 0.2, rot: [90, 0, 0] } },
  // Oct 30 (Clay): rigged, rest pose only; every move comes from the shared pack. figH = Ken's Studio body scale (Ledger) x 0.8, the same conversion as Borgo's.
  // Ken (Oct 31): "The gnome commander doesn't have his staff." Knobbin's crystal staff (Studio model sproingle-staff) in his right hand by the grip rule until Ledger saves a placement
  sproingle: { base: '/models/commanders/sproingle/', files: { source: 'sproingle.glb', fortress: 'gnome-stronghold', scepter: 'staff.glb' }, figH: 0.72, keepK: 1.1, deck: 0.71, sceptre: { len: 0.95, grip: 0.42, rot: [0, 0, 0], upright: true } },
  skreeka: { base: '/models/commanders/skreeka/', files: { source: 'skreeka.glb', fortress: 'goblin-stronghold', scepter: '' }, figH: 1.2, keepK: 1.1, deck: 0.71, sceptre: { len: 0.5, grip: 0.2, rot: [90, 0, 0] } },
  sprocket: { base: '/models/commanders/sprocket/', files: { source: 'sprocket.glb', fortress: 'gnome-stronghold', scepter: '' }, figH: 0.68, keepK: 1.1, deck: 0.71, sceptre: { len: 0.5, grip: 0.2, rot: [90, 0, 0] }, prop: { file: 'wrench.glb', look: { bone: 'RightHand', pos: [-2.293, 7.176, 7.017], rot: [-16.36, -20.67, 135.98], scale: [15.776, 15.776, 15.776] } } },
  grumblebeard: { base: '/models/commanders/grumblebeard/', files: { source: 'grumblebeard.glb', fortress: 'dwarf-stronghold', scepter: '' }, figH: 0.84, keepK: 1.1, deck: 0.71, sceptre: { len: 0.5, grip: 0.2, rot: [90, 0, 0] }, prop: { file: 'hammer.glb', look: { bone: 'RightHand', pos: [-4.807, -4.132, 0.907], rot: [-3.17, -47.48, 163.5], scale: [44.699, 44.699, 44.699] } } },
};
/** Oct 30: which pack kind fills each Commander role it lacks (or has only as a stock Meshy clip) */
const CMD_PACK: [string, string][] = [['idle', 'idle'], ['walk', 'walk'], ['attack', 'attack'], ['hit', 'hit'], ['defeat', 'defeat'], ['cheer', 'cheer'], ['celebrate', 'cheer'], ['laugh', 'cheer'], ['taunt', 'cheer'], ['cast', 'attack'], ['point', 'attack'], ['surprised', 'hit'], ['flinch', 'hit']];
const CMD_STOCK = /^(Idle|Casual_Walk|Walk|Heavy_Hammer_Swing|Hit_Reaction|Dead)$/;
export const hasCommander3d = (id: string) => id === 'grubnak' || id in OTHER_CMDS;
export const commanderIds3d = () => ['grubnak', ...Object.keys(OTHER_CMDS)];
const otherLoading = new Map<string, Promise<G3DAssets | null>>();
const otherLoaded = new Map<string, G3DAssets>();
/** Ready assets for a Commander (Grubnak keeps his own loader). */
export const commander3dReady = (id: string): G3DAssets | null => (id === 'grubnak' ? loaded : otherLoaded.get(id) || null);

/** Loads a Commander's saved model once; resolves null when it is not shipped (the placeholder stays). Clips strictly by name from models.json `clips`. */
export function loadCommander3d(id: string): Promise<G3DAssets | null> {
  if (id === 'grubnak') return loadGrubnak3d();
  const cfg = OTHER_CMDS[id];
  if (!cfg) return Promise.resolve(null);
  let p = otherLoading.get(id);
  if (!p) {
    p = (async () => {
      try {
        const r = await fetch(cfg.base + 'models.json');
        if (!r.ok) return null;
        const info = await r.json();
        const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
        const [c, s] = await Promise.all([gl.loadAsync(cfg.base + (info.files?.char || 'char.glb')), info.files?.sceptre ? gl.loadAsync(cfg.base + info.files.sceptre).catch(() => null) : Promise.resolve(null)]);
        const clips: Record<string, THREE.AnimationClip> = {};
        for (const [role, nm] of Object.entries((info.clips || {}) as Record<string, string>)) { const cl = c.animations.find((x) => x.name === nm); if (cl) clips[role] = cl; }
        const sh = await packClipsFor('cmd-' + id, c.scene).catch(() => null);
        if (sh) for (const [role, kind] of CMD_PACK) {
          if (clips[role] && !CMD_STOCK.test(clips[role].name)) continue;
          const l = sh.byKind[kind] || []; if (l.length) clips[role] = l[Math.floor(Math.random() * l.length)];
        }
        const pr = cfg.prop ? await gl.loadAsync(cfg.base + cfg.prop.file).then((x) => x.scene).catch(() => null) : null;
        const a: G3DAssets = { char: c.scene, clips, fortress: new THREE.Group(), scepter: s ? s.scene : null, info, prop: pr };
        otherLoaded.set(id, a);
        return a;
      } catch {
        return null;
      }
    })();
    otherLoading.set(id, p);
  }
  return p;
}

/** A standing Commander on top of his (procedural) stronghold `keep`, both turned to the owner's `turn`. `figure` turns alone for look-backs. */
export function makeCommander3d(id: string, a: G3DAssets, keep: THREE.Object3D, pose?: OwnerPose): G3D {
  const cfg = OTHER_CMDS[id];
  const turn = (pose?.cmd.turn ?? 0) * D2R, gk = pose?.groups ?? 1;
  const group = new THREE.Group();
  const kYaw = new THREE.Group(); kYaw.rotation.y = turn;
  keep.scale.setScalar(cfg.keepK * gk); keep.position.set(0, 0, 0);
  kYaw.add(keep); group.add(kYaw);
  const onBase = pose?.base ?? true, size = pose?.size ?? 1;
  kYaw.visible = onBase; // Ken (Oct 30): Commanders stand on the board, no throne or stronghold under them
  const ch = skeletonClone(a.char) as THREE.Object3D;
  ch.traverse((o: any) => { if (o.isMesh || o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = false; } });
  const m0 = new THREE.AnimationMixer(ch); if (a.clips.idle) { m0.clipAction(a.clips.idle).play(); m0.setTime(0); }
  ch.updateMatrixWorld(true);
  const cb0 = box(ch), H0 = cb0.max.y - cb0.min.y;
  let scepterBone = '';
  const items: { name: string; bone: string; obj: THREE.Object3D | null }[] = []; // Oct 31 test hook: the items a Commander carries
  const lastChild = (bn: string) => { const o = ch.getObjectByName(bn); return o && o.children.length ? o.children[o.children.length - 1] : null; };
  if (a.scepter) { scepterBone = attachPart(ch, { name: 'scepter', file: '', bone: ['RightHand'], len: cfg.sceptre.len, grip: cfg.sceptre.grip, rot: cfg.sceptre.rot, axis: 'y', upright: (cfg.sceptre as any).upright }, a.scepter, H0, () => {}); if (scepterBone) items.push({ name: cfg.files.scepter.replace(/\.glb$/, ''), bone: scepterBone, obj: lastChild(scepterBone) }); }
  if (a.prop && cfg.prop) { const bn = ch.getObjectByName(cfg.prop.look.bone); if (bn) { const p = a.prop.clone(true); const L = cfg.prop.look; p.position.set(...L.pos); p.rotation.set(...(L.rot.map((d) => THREE.MathUtils.degToRad(d)) as [number, number, number]), 'XYZ'); p.scale.set(...L.scale); p.traverse((o: any) => { if (o.isMesh) o.frustumCulled = false; }); bn.add(p); scepterBone = scepterBone || bn.name; items.push({ name: cfg.prop.file.replace(/\.glb$/, ''), bone: bn.name, obj: p }); } } // Ken's Studio placement (Ledger)
  m0.stopAllAction(); m0.uncacheRoot(ch);
  const sc = new THREE.Group(); sc.scale.setScalar((cfg.figH * gk * size) / Math.max(H0, 0.01));
  ch.position.set(-(cb0.min.x + cb0.max.x) / 2, -cb0.min.y, -(cb0.min.z + cb0.max.z) / 2);
  sc.add(ch);
  sc.position.y = onBase ? cfg.deck * cfg.keepK * gk : 0; // feet on the stronghold's top deck (the scene keeps `figure` itself at y 0)
  const figure = new THREE.Group();
  figure.add(sc);
  figure.rotation.y = turn;
  group.add(figure);
  const g = finish(a, group, figure, keep, ch, scepterBone);
  g.files = cfg.files;
  (g as any).items = items;
  return g;
}

// Owner-sheet creatures as real 3D models (Meshy, generated once by tools/gen-creature-3d.mjs, saved under public/models/creatures/<card id>/).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { skinBox } from './grubnak3d';
import { CARDS } from '../engine';
import animSlotsJson from '../content/anim-slots.json';
import unitHeightsJson from '../content/unit-heights.json';
/** Ken (Oct 30): every unit at the height he saved in Oreheart Studio (Ledger's table, board squares; mounts = rider + mount); beats LOOKS and the faction defaults */
export const HEIGHTS: Record<string, number> = Object.fromEntries(Object.entries(unitHeightsJson as Record<string, unknown>).filter(([k, v]) => !k.startsWith('_') && typeof v === 'number')) as Record<string, number>;

export type CreatureAnim = 'idle' | 'walk' | 'run' | 'attack' | 'mine' | 'hit' | 'defeat' | 'lifted' | 'special' | 'knockback' | 'bowled' | 'idleBreak';
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
const DEFAULT_H_SPECIAL: Record<string, number> = { 'grubnaks-big-boss-troll': 1.4, 'wolf-rider': 1.35, 'the-great-steam-golem': 1.6, 'ram-rider': 1.35, 'clockwork-beetle': 0.9, 'queen-brunhilda-stonebeard': 1.05 };
/** Round 23: dwarves ~0.95, gnomes ~0.85 spaces tall, goblins 1.1 (via the fallback) */
const defaultH = (id: string): number | undefined => DEFAULT_H_SPECIAL[id] ?? ({ dwarves: 0.95, gnomes: 0.85 } as Record<string, number>)[(CARDS as any)[id]?.faction];
const DEFAULT_H = new Proxy({} as Record<string, number>, { get: (_t, id: string) => defaultH(id) });
/** which parts each creature carries (tuned by eye against the owner's assembled reference) */
const PARTS: Record<string, PartCfg[]> = {
  'goblin-scrounger': [
    { name: 'backpack', file: 'backpack.glb', bone: ['Spine02', 'Spine01', 'Spine'], len: 0.36, grip: 0.5, rot: [0, 180, 0], pos: [0, 0, -0.1] },
    { name: 'pickaxe', file: 'pickaxe.glb', bone: ['RightHand'], len: 0.62, grip: 0.3, rot: [180, 0, 0], axis: 'y' },
  ],
  'goblin-pebbler': [{ name: 'club', file: 'club.glb', bone: ['RightHand'], len: 0.55, grip: 0.2, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [-9.231, 12.794, 2.402], rot: [27, 11, 52], scale: [25, 25, 25] } }],
  'goblin-scrapper': [{ name: 'bowling-ball', file: 'bowling-ball.glb', bone: ['RightHand'], len: 0.3, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-3.51, 8.733, -1.595], rot: [50.405, 1.159, 166.638], scale: [23, 23, 23] } }],
  'goblin-bomber': [],
  'goblin-sneak': [
    { name: 'bag', file: 'bag.glb', bone: ['neck'], len: 0.3, grip: 0.5, rot: [0, 0, 0], look: { bone: 'neck', pos: [-5.34, 1.862, -14.029], rot: [8.548, 3.663, 3.154], scale: [15, 15, 15] } },
    { name: 'dagger', file: 'dagger.glb', bone: ['RightHand'], len: 0.4, grip: 0.2, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [8.502, 7.038, -9.251], rot: [159.362, -37.54, -90.548], scale: [29, 29, 29] } },
  ],
  'rotgut-grenadier': [{ name: 'spatula', file: 'spatula.glb', bone: ['RightHand'], len: 0.5, grip: 0.2, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [18.162, -9.844, 27.054], rot: [35.239, -53.157, -88.87], scale: [43, 43 * 1.46, 43 * 0.76] } }],
  'goblin-slinger': [{ name: 'skull-mace', file: 'skull-mace.glb', bone: ['RightHand'], len: 0.5, grip: 0.2, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [-4.733, 9.93, 4.184], rot: [7.674, 57.734, 67.236], scale: [19, 19, 19] } }],
  'goblin-grunt': [{ name: 'frying-pan', file: 'frying-pan.glb', bone: ['RightHand'], len: 0.42, grip: 0.15, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [-13.281, 9.76, 19.154], rot: [126.389, -36.031, 38.735], scale: [43.449, 43.449, 43.449] } }],
  'junk-shaman': [{ name: 'staff', file: 'staff.glb', bone: ['RightHand'], len: 0.85, grip: 0.4, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [5.156, -7.33, 3.734], rot: [-10.17, -24.8, -150.09], scale: [52.566, 52.566, 52.566] } }], // Ken (Oct 30): upright, hand-gripping (Ledger)
  'shard-guzzler': [{ name: 'rocket', file: 'rocket.glb', bone: ['Spine02', 'Spine01', 'Spine'], len: 0.55, grip: 0.5, rot: [0, 180, 0], pos: [0, 0, -0.14] }],
  'blastrat-sapper': [{ name: 'bomb', file: 'bomb.glb', bone: ['Spine02', 'Spine01', 'Spine'], len: 0.32, grip: 0.5, rot: [0, 180, 0], pos: [0, -0.02, -0.12] }],
  'skullbasher-rusher': [
    { name: 'mace', file: 'mace.glb', bone: ['RightHand'], len: 0.5, grip: 0.2, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [-8.9, 18.747, 8.443], rot: [-8.725, 65.398, 73.206], scale: [36, 36, 36] } },
    { name: 'shield', file: 'shield.glb', bone: ['LeftHand'], len: 0.45, grip: 0.5, rot: [0, 90, 0], look: { bone: 'LeftHand', pos: [-3.667, 7.628, -2.335], rot: [-157.797, -59.618, -151.009], scale: [37, 37, 37] } },
  ],
  'wolf-rider': [
    { name: 'wolf', file: 'wolf.glb', bone: [], len: 0.9, grip: 0.5, rot: [0, 0, 0], mount: true },
    { name: 'mace', file: 'mace.glb', bone: ['RightHand'], len: 0.5, grip: 0.2, rot: [180, 0, 0], axis: 'x' },
  ],
  'grubnaks-big-boss-troll': [],
  'shiv-rat': [
    { name: 'backpack', file: 'backpack.glb', bone: ['Spine'], len: 0.36, grip: 0.5, rot: [0, 180, 0], look: { bone: 'Spine', pos: [0.756, -10.807, -6.926], rot: [176.37, 0.217, 178.765], scale: [19, 19, 19] } },
    { name: 'dagger', file: 'dagger.glb', bone: ['RightHand'], len: 0.4, grip: 0.2, rot: [180, 0, 0], axis: 'y', look: { bone: 'RightHand', pos: [-8.478, 10.344, 13.399], rot: [132.296, -65.655, 54.851], scale: [26, 26, 26] } },
  ],
  'goblin-smith-miner': [
    { name: 'pickaxe', file: 'pickaxe.glb', bone: ['RightHand'], len: 0.55, grip: 0.3, rot: [180, 0, 0], axis: 'y' },
    { name: 'hammer', file: 'hammer.glb', bone: ['LeftHand'], len: 0.4, grip: 0.2, rot: [0, 0, 0], axis: 'y' },
  ],
  // owner (Oct 25): Gnome and Dwarf models, character only for now (the owner adds their items with the Model Editor later)
  'axe-thrower': [{ name: 'shield', file: 'shield.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-12.652, 21.111, 0.103], rot: [-58.52, 43.389, -47.797], scale: [17, 17, 17] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'barrelback-courier': [{ name: 'barrel-pack', file: 'barrel-pack.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [3.631, 13.995, -18.271], rot: [-160.68, -0.629, 176.305], scale: [28.026, 28.026, 28.026] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'brewmaster': [{ name: 'keg-pack', file: 'keg-pack.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [3.052, 10.711, -23.178], rot: [-167.137, 7.3, 175.685], scale: [24.348, 24.348, 24.348] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'clockwork-beetle': [],
  'crystal-drunk-delver': [
    { name: 'pickaxe', file: 'pickaxe.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-11.916, 9.542, 10.035], rot: [-47.527, 43.36, 126.79], scale: [29.769, 29.769, 29.769] } },
    { name: 'crystal-backpack', file: 'crystal-backpack.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [-22.899, -0.026, -8.549], rot: [1.154, 39.312, 0.926], scale: [23.689, 23.689, 23.689] } },
  ], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'deepforge-crossbowman': [{ name: 'crystal-gun', file: 'crystal-gun.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-13.667, 14.213, 10.056], rot: [124.622, -40.578, -4.098], scale: [33.745, 33.745, 33.745] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'dwarf-miner': [{ name: 'tower-shield', file: 'tower-shield.glb', bone: ['LeftForeArm'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'LeftForeArm', pos: [3.309, 4.936, 12.344], rot: [-35.451, -2.837, 156.794], scale: [43, 43, 43] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'dwarf-pickman': [],
  'dwarf-smith-miner': [{ name: 'pickaxe', file: 'pickaxe.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-6.164, 15.149, 10.053], rot: [-66.649, 52.929, 128.399], scale: [38, 38, 38] } }, { name: 'hammer', file: 'hammer.glb', bone: ['Hips'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Hips', pos: [10.074, 4.349, -12.19], rot: [19.81, -0.33, -120.23], scale: [15.769, 15.769, 15.769] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'dwarf-stoneback': [{ name: 'hammer', file: 'hammer.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-7.435, 10.978, 9.103], rot: [127.903, -62.14, 44.02], scale: [31.335, 31.335, 31.335] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'gearward-sentinel': [],
  'gnome-prospector': [], // Oct 30 (Clay): new Meshy model, moves from the shared pack; pickaxe waits for Ken's Studio setup
  'overclocked-conduit': [], // Oct 30 (Clay): the robot, moves from the shared pack; two pickaxes wait for Ken's Studio setup
  'glyphshield-warden': [{ name: 'shield', file: 'shield.glb', bone: ['LeftForeArm'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'LeftForeArm', pos: [-0.289, 25.921, 0.524], rot: [-114.616, -54.523, 103.055], scale: [28.912, 28.912, 28.912] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'gnome-cogger': [{ name: 'mace', file: 'mace.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-16.476, -10.052, 6.626], rot: [-106.963, -35.01, 84.605], scale: [32.833, 32.833, 32.833] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'gnome-illusionist': [],
  'gnome-smith-miner': [],
  'gnome-tinker': [
    { name: 'scepter', file: 'scepter.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-5.106, 4.336, 10.391], rot: [-91.862, 22.237, 178.441], scale: [29.826, 29.826, 29.826] } },
    { name: 'crystal-shield', file: 'crystal-shield.glb', bone: ['LeftForeArm'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'LeftForeArm', pos: [-6.589, 20.19, 0.021], rot: [-110.166, -61.024, 179.49], scale: [29.536, 29.536, 29.536] } },
    { name: 'wrench', file: 'wrench.glb', bone: ['Hips'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Hips', pos: [-12.29, -9.118, 25.184], rot: [5.886, 46.054, 92.626], scale: [16.542, 16.542, 16.542] } },
  ],
  'gnome-widget': [],
  'grimhold-ravager': [{ name: 'hammer', file: 'hammer.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-7.368, 14.973, 3.457], rot: [-39.361, 49.914, 95.703], scale: [31.019, 31.019, 31.019] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'gyrocopter-ace': [
    { name: 'gyro-wings', file: 'gyro-wings.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [1, 8.127, -15.443], rot: [-178.557, 0.345, 175.676], scale: [53, 53, 53] } },
    { name: 'gyro-wings-2', file: 'gyro-wings.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [2.731, 7.516, -13.38], rot: [-84.27, 23.646, 2.952], scale: [62.608, 56.172, 69.629] } },
  ],
  'hexwright-apprentice': [{ name: 'staff', file: 'staff.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-8.889, 11.139, 14.226], rot: [-153.173, -64.937, 132.76], scale: [52.968, 52.968, 52.968] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'ironhammer-berserker': [{ name: 'crystal-pistol', file: 'crystal-pistol.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-1.882, 21.222, -1.587], rot: [168.899, -32.158, 92.346], scale: [16.176, 16.176, 16.176] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'oathbound-pikeman': [{ name: 'rifle', file: 'rifle.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-44.159, 16.494, 20.613], rot: [163.196, -28.673, 7.516], scale: [79.963, 79.963, 79.963] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'phase-stalker': [],
  'queen-brunhilda-stonebeard': [{ name: 'warhammer', file: 'warhammer.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-6.749, 6.967, 10.796], rot: [31.091, 75.481, 74.138], scale: [31.171, 31.171, 31.171] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'ram-rider': [{ name: 'ram', file: 'ram.glb', bone: [], len: 0.9, grip: 0.5, rot: [0, 0, 0], mount: true }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'rune-splitter': [{ name: 'crystal-hammer', file: 'crystal-hammer.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-5.945, 14.395, 2.713], rot: [-90.58, 40.418, 154.032], scale: [31.285, 31.285, 31.285] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'runic-siphoner': [{ name: 'staff', file: 'staff.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-5.934, 11.383, -0.229], rot: [67.927, -40.258, -143.624], scale: [20, 41.4, 20] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'shieldbeard': [{ name: 'medic-pack', file: 'medic-pack.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [2.392, 13.129, -18.358], rot: [-154.103, -0.121, 171.756], scale: [25.761, 25.761, 25.761] } }, { name: 'shoulder-shield', file: 'shoulder-shield.glb', bone: ['RightArm'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightArm', pos: [0.448, 1.281, 4.02], rot: [-21.37, 15.38, -166.37], scale: [16.825, 16.825, 16.825] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'spark-gnome': [{ name: 'staff', file: 'staff.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-2.63, 8.57, 0.056], rot: [-128.277, -22.025, 141.36], scale: [41, 51.25, 41] } }], // Oct 30: Ken's Studio placement (Ledger), part from Clay
  'the-great-steam-golem': [],
};
export const hasCreature3dSlug = (id: string) => id in PARTS;

interface Assets { char: THREE.Object3D; clips: Record<string, THREE.AnimationClip>; parts: Record<string, THREE.Object3D>; info: any; events?: any; shared?: SharedSet | null; picked?: Set<string>; packFree?: Set<string> }

// ---------------------------------------------------------------- Oct 30 (Ken's fighting vision): Spring's shared biped animation pack
// One pack (public/models/anims/biped-pack-v1.glb + .json) is loaded once and retargeted at load time onto every model whose bones match by
// name (rest-pose delta per bone, Hips bob scaled by hip height), so no unit carries its own copy. Ken's Studio slot picks (shared: true) win;
// otherwise a unit whose own idle / walk is the stock Meshy one gets a random pack idle (with a random start time) and a random walk / run.
export interface PackClip { clip: THREE.AnimationClip; kind: string; loop: boolean; impact?: number; rootSpeed?: number; events?: { name: string; time: number }[] }
interface Pack { clips: PackClip[]; rig: Rig }
export interface SharedSet { byName: Record<string, THREE.AnimationClip>; byKind: Record<string, THREE.AnimationClip[]>; impact: Record<string, number>; speed: Record<string, number>; events: Record<string, { name: string; time: number }[]> }
export const PACK_URL = '/models/anims/biped-pack-v3'; // Spring's v3 (Oct 30): v2's 57 clips + 2 Gnome Plow ride clips (ride, rideRam)
let packP: Promise<Pack | null> | null = null;
/** test hook (window.__sharedPack): what the pack loader did */
export const packInfo = { url: PACK_URL, loaded: false, clips: [] as { name: string; kind: string }[], error: '', units: {} as Record<string, string> };
(globalThis as any).__sharedPack = packInfo;
export function loadSharedPack(): Promise<Pack | null> {
  if (!packP) packP = (async () => {
    try {
      const r = await fetch(PACK_URL + '.json');
      if (!r.ok || !/json/.test(r.headers.get('content-type') || 'json')) { packInfo.error = 'no pack (' + r.status + ')'; return null; }
      const meta = await r.json();
      const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(PACK_URL + '.glb');
      const list: any[] = Array.isArray(meta.clips) ? meta.clips : Object.entries(meta.clips || {}).map(([name, v]: [string, any]) => ({ name, ...v }));
      const clips: PackClip[] = [];
      for (const m of list) {
        const clip = g.animations.find((x) => x.name === m.name); if (!clip) continue;
        const ev = Array.isArray(m.events) ? m.events.filter((e: any) => typeof e?.time === 'number') : undefined;
        const imp = typeof m.impact === 'number' ? m.impact : ev?.find((e: any) => e.name === 'impact' || e.name === 'hit')?.time;
        clips.push({ clip, kind: String(m.kind || ''), loop: m.loop !== false, impact: imp, rootSpeed: typeof m.rootSpeed === 'number' ? m.rootSpeed : undefined, events: ev });
      }
      Object.assign(packInfo, { loaded: true, clips: clips.map((c) => ({ name: c.clip.name, kind: c.kind })) });
      const rig = rigOf(g.scene, true);
      if (!rig.restW.has('Hips') || rig.order.length < 20) { packInfo.error = 'pack skeleton not found (' + rig.order.length + ' nodes)'; console.warn('[anim pack] ' + packInfo.error); return null; }
      return { clips, rig };
    } catch (e: any) { packInfo.error = String(e?.message || e); return null; }
  })();
  return packP;
}
// Retarget (Spring's method, Oct 30): per bone b in world rotations, D = Wsrc_now(b) * inv(Wsrc_rest(b)); C(b) = shortest swing turning the target's
// rest bone direction (b -> child) onto the pack's; Wtgt_now(b) = D * C(b) * Wtgt_rest(b); local = inv(Wtgt_now(parent)) * Wtgt_now(b). Hips: C = identity;
// leaf bones use their parent's C. Hips position = the pack's world offset from rest x (target leg / pack leg). Baked once per model at load.
interface Rig { order: string[]; parent: Map<string, string | null>; restW: Map<string, THREE.Quaternion>; restP: Map<string, THREE.Vector3>; restL: Map<string, THREE.Quaternion>; restLp: Map<string, THREE.Vector3>; restS: Map<string, THREE.Vector3>; upW: Map<string, THREE.Quaternion>; upM: Map<string, THREE.Matrix4>; leg: number; kids: Map<string, string[]> }
/** `anyNode`: Spring's pack GLB is skeleton-only (no skin), so three.js loads its joints as plain nodes, not Bones; every named node under the root counts */
function rigOf(root: THREE.Object3D, anyNode = false): Rig {
  root.updateMatrixWorld(true);
  const isBone = (o: any) => (anyNode ? o !== root && !!o.name && !o.isMesh : !!o.isBone);
  const rg: Rig = { order: [], parent: new Map(), restW: new Map(), restP: new Map(), restL: new Map(), restLp: new Map(), restS: new Map(), upW: new Map(), upM: new Map(), leg: 0, kids: new Map() };
  root.traverse((o: any) => {
    if (!isBone(o) || rg.restW.has(o.name)) return;
    const pb = o.parent && isBone(o.parent) ? o.parent.name : null;
    rg.order.push(o.name); rg.parent.set(o.name, pb);
    rg.restW.set(o.name, o.getWorldQuaternion(new THREE.Quaternion())); rg.restP.set(o.name, o.getWorldPosition(new THREE.Vector3())); rg.restL.set(o.name, o.quaternion.clone()); rg.restLp.set(o.name, o.position.clone()); rg.restS.set(o.name, o.scale.clone());
    if (pb) { if (!rg.kids.has(pb)) rg.kids.set(pb, []); rg.kids.get(pb)!.push(o.name); }
    // the parent's world transform, for every bone (the Hips track needs it even when the Hips hang under an armature node)
    rg.upW.set(o.name, o.parent ? o.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion()); rg.upM.set(o.name, o.parent ? o.parent.matrixWorld.clone() : new THREE.Matrix4());
  });
  const P = (n: string) => rg.restP.get(n);
  const chain = ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase'].map(P);
  for (let k = 0; k < 3; k++) if (chain[k] && chain[k + 1]) rg.leg += chain[k]!.distanceTo(chain[k + 1]!);
  return rg;
}
const CHILD: Record<string, string> = { Spine02: 'Spine01', Spine01: 'Spine', Spine: 'neck', neck: 'Head', Head: 'head_end' };
for (const sd of ['Left', 'Right']) Object.assign(CHILD, { [sd + 'Shoulder']: sd + 'Arm', [sd + 'Arm']: sd + 'ForeArm', [sd + 'ForeArm']: sd + 'Hand', [sd + 'UpLeg']: sd + 'Leg', [sd + 'Leg']: sd + 'Foot', [sd + 'Foot']: sd + 'ToeBase' });
function swings(S: Rig, T: Rig): Map<string, THREE.Quaternion> {
  const C = new Map<string, THREE.Quaternion>();
  const dir = (rg: Rig, a: string, b: string) => rg.restP.get(b)!.clone().sub(rg.restP.get(a)!).normalize();
  for (const b of T.order) {
    const pb = T.parent.get(b) || null;
    if (!pb || !S.restW.has(b)) { C.set(b, new THREE.Quaternion()); continue; } // Hips (and bones the pack lacks): no swing
    const want = CHILD[b];
    const ch = want && T.restP.has(want) && S.restP.has(want) ? want : (T.kids.get(b) || []).find((k) => S.restP.has(k));
    const dT = ch ? dir(T, b, ch) : null, dS = ch ? dir(S, b, ch) : null;
    C.set(b, dT && dS && dT.lengthSq() > 0.5 && dS.lengthSq() > 0.5 ? new THREE.Quaternion().setFromUnitVectors(dT, dS) : (C.get(pb) || new THREE.Quaternion()).clone());
  }
  return C;
}
/** Spring (Oct 30): one shared lift can't fit every body, so a standing clip is lowered / raised until this unit's lowest foot at frame 0
 *  matches its own rest stance (forward kinematics on the baked first frame; the Hips track moves by the difference) */
const FEET = ['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot'];
function groundFix(T: Rig, hip: string, outQ: Map<string, number[]>, outP: number[]) {
  const W = new Map<string, THREE.Matrix4>(), q = new THREE.Quaternion(), v = new THREE.Vector3();
  for (const b of T.order) {
    const pb = T.parent.get(b), qa = outQ.get(b)!;
    q.set(qa[0], qa[1], qa[2], qa[3]);
    const pos = b === hip ? v.set(outP[0], outP[1], outP[2]) : T.restLp.get(b)!;
    W.set(b, (pb ? W.get(pb)! : T.upM.get(b)!).clone().multiply(new THREE.Matrix4().compose(pos, q, T.restS.get(b)!)));
  }
  const feet = FEET.filter((f) => W.has(f) && T.restP.has(f));
  if (!feet.length) return;
  const now = Math.min(...feet.map((f) => new THREE.Vector3().setFromMatrixPosition(W.get(f)!).y)), rest = Math.min(...feet.map((f) => T.restP.get(f)!.y));
  const top = Math.max(...[...T.restP.values()].map((p) => p.y)), h = Math.max(1e-6, top - rest);
  const d = now - rest;
  if (Math.abs(d) < 0.005 * h || Math.abs(d) > 0.25 * h) return; // already on the floor, or a pose that really leaves it
  const up = T.upM.get(hip)!, local = new THREE.Vector3(0, -d, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(up.clone().invert()));
  for (let k = 0; k < outP.length; k += 3) { outP[k] += local.x; outP[k + 1] += local.y; outP[k + 2] += local.z; }
}
/** a pack clip baked onto this model's skeleton, or null when fewer than 80 % of its rotated bones exist here */
function retarget(src: THREE.AnimationClip, S: Rig, T: Rig, C: Map<string, THREE.Quaternion>, ground = false): THREE.AnimationClip | null {
  const qTr = new Map<string, THREE.KeyframeTrack>(); let hipTr: THREE.KeyframeTrack | null = null, hipName = '';
  for (const tr of src.tracks) { const i = tr.name.lastIndexOf('.'), bone = tr.name.slice(0, i), prop = tr.name.slice(i + 1); if (prop === 'quaternion') qTr.set(bone, tr); else if (prop === 'position' && /hips/i.test(bone) && S.restW.has(bone)) { hipTr = tr; hipName = bone; } }
  if (!qTr.size || [...qTr.keys()].filter((b) => T.restW.has(b)).length / qTr.size < 0.8) return null;
  const times = Array.from(new Set([...qTr.values()].flatMap((t) => Array.from(t.times)))).sort((a, b) => a - b);
  const qi = new Map([...qTr].map(([b, t]) => [b, t.createInterpolant()]));
  const pi = hipTr ? hipTr.createInterpolant() : null;
  const ratio = S.leg > 1e-6 && T.leg > 1e-6 ? T.leg / S.leg : 1;
  const outQ = new Map(T.order.map((b) => [b, [] as number[]])), outP: number[] = [];
  const Ws = new Map<string, THREE.Quaternion>(), Wt = new Map<string, THREE.Quaternion>(), D = new THREE.Quaternion(), q = new THREE.Quaternion(), inv = new THREE.Quaternion(), v = new THREE.Vector3(), mi = new THREE.Matrix4();
  for (const t of times) {
    for (const b of S.order) {
      const it = qi.get(b); const l = it ? q.fromArray(it.evaluate(t) as any) : q.copy(S.restL.get(b)!);
      const pb = S.parent.get(b); Ws.set(b, (pb ? Ws.get(pb)! : S.upW.get(b)!).clone().multiply(l));
    }
    for (const b of T.order) {
      const pb = T.parent.get(b);
      let w: THREE.Quaternion;
      if (Ws.has(b)) { D.copy(Ws.get(b)!).multiply(inv.copy(S.restW.get(b)!).invert()); w = D.clone().multiply(C.get(b)!).multiply(T.restW.get(b)!); }
      else w = (pb ? Wt.get(pb)! : T.upW.get(b)!).clone().multiply(T.restL.get(b)!);
      Wt.set(b, w);
      const loc = inv.copy(pb ? Wt.get(pb)! : T.upW.get(b)!).invert().multiply(w).normalize();
      outQ.get(b)!.push(loc.x, loc.y, loc.z, loc.w);
    }
    if (pi && T.restP.has(hipName)) {
      v.fromArray(pi.evaluate(t) as any).applyMatrix4(S.upM.get(hipName)!).sub(S.restP.get(hipName)!).multiplyScalar(ratio).add(T.restP.get(hipName)!);
      v.applyMatrix4(mi.copy(T.upM.get(hipName)!).invert()); outP.push(v.x, v.y, v.z);
    }
  }
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [b, vals] of outQ) if (S.restW.has(b)) tracks.push(new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, vals));
  if (outP.length && ground) groundFix(T, hipName, outQ, outP);
  if (outP.length) tracks.push(new THREE.VectorKeyframeTrack(hipName + '.position', times, outP));
  if (!tracks.some((t) => t instanceof THREE.QuaternionKeyframeTrack)) return null; // an empty clip would leave the bind pose showing (Ken's T-poses, Oct 30)
  return new THREE.AnimationClip(src.name, src.duration, tracks);
}
function sharedFor(id: string, char: THREE.Object3D, pack: Pack | null): SharedSet | null {
  if (!pack || !pack.clips.length) return null;
  const T = rigOf(char);
  if (!T.order.length) { packInfo.units[id] = 'no skeleton'; return null; }
  const C = swings(pack.rig, T), ratio = pack.rig.leg > 1e-6 && T.leg > 1e-6 ? T.leg / pack.rig.leg : 1;
  const out: SharedSet = { byName: {}, byKind: {}, impact: {}, speed: {}, events: {} };
  for (const pc of pack.clips) {
    const cl = retarget(pc.clip, pack.rig, T, C, /^(idle|idleBreak|walk|run|attack|ranged|hit|cheer)$/.test(pc.kind));
    if (!cl) { packInfo.units[id] = 'bones do not match (' + pc.clip.name + ')'; console.warn('[anim pack] ' + id + ': ' + packInfo.units[id] + '; using its own clips'); return null; }
    out.byName[cl.name] = cl; (out.byKind[pc.kind] ||= []).push(cl); if (pc.events) out.events[cl.name] = pc.events;
    if (pc.impact !== undefined) out.impact[cl.name] = pc.impact;
    if (pc.rootSpeed !== undefined) out.speed[cl.name] = pc.rootSpeed * ratio; // model units per second
  }
  packInfo.units[id] = 'retargeted ' + pack.clips.length;
  return out;
}
/** Oct 30: the shared pack baked onto any rigged model (Commanders use it for idles, cheers and the emotes they lack) */
export async function packClipsFor(key: string, char: THREE.Object3D): Promise<SharedSet | null> { return sharedFor(key, char, await loadSharedPack()); }
const STOCK = /^(Idle|Casual_Walk|Walk|Heavy_Hammer_Swing|Hit_Reaction|Dead)$/;
const cache = new Map<string, Promise<Assets | null>>();
const ready = new Map<string, Assets>();
/** Round 26 (AC390): roles whose mapped clip was not found in the GLB, so the old Meshy clip (by name) plays; also at window.__missingClips */
export const missingClips: { id: string; role: string; wanted: string; used: string }[] = [];
(globalThis as any).__missingClips = missingClips;
export const creature3dReady = (id: string) => ready.get(id) || null;
/** Round 28b: what the Studio slot file did per card (test hook: window.__animSlotLog) */
export const slotLog: { id: string; role: string; clip: string; how: string }[] = [];
(globalThis as any).__animSlotLog = slotLog;

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
        // Round 26: clips strictly by name (models.json `clips` map first, then the old Meshy clip of that role by name); never by position
        const OLD: Record<string, string> = { idle: 'Idle', walk: 'Casual_Walk', attack: 'Heavy_Hammer_Swing', hit: 'Hit_Reaction', defeat: 'Dead' };
        const MAPKEY: Record<string, string[]> = { idle: ['idle'], walk: ['walk'], attack: ['attack'], hit: ['hit'], defeat: ['defeat', 'death'], mine: ['mine'] };
        const byName = (nm?: string) => (nm ? c.animations.find((a) => a.name === nm) : undefined);
        for (const n of names) {
          const want = (MAPKEY[n] || [n]).map((k) => info.clips?.[k]).find((v) => typeof v === 'string') as string | undefined;
          let cl = byName(want);
          if (!cl) { cl = byName(OLD[n]) || byName(n); if (cl && info.clips && typeof info.clips === 'object') missingClips.push({ id, role: n, wanted: want || `OH_${n}`, used: cl.name }); }
          if (cl) clips[n] = cl;
        }
        // Owner fix (Ken, Oct 28): a unit carried by the Junk Shaman loops its lifted clip; the Shaman holds his lift special
    for (const [role, key] of [['lifted', 'react_lifted'], ['special', 'special']]) { const nm = info.clips?.[key]; const cl = typeof nm === 'string' ? byName(nm) : undefined; if (cl && !clips[role]) clips[role] = cl; }
        const shared = sharedFor(id, c.scene, await loadSharedPack()), picked = new Set<string>(), packFree = new Set<string>();
        // Round 28b (Ken's Studio slots, Oct 29): a card's slot choices from src/content/anim-slots.json come first. Only clips in this card's
        // own GLB play (a shared-library clip from another model is noted, not retargeted); "none" removes the role; roles without a choice keep the logic above.
        { const sl = (animSlotsJson as any).cards?.[id]?.slots as Record<string, any> | undefined;
          if (sl) for (const [role, pick] of Object.entries(sl)) {
            const p = Array.isArray(pick) ? pick[0] : pick;
            if (!p) continue;
            if (p.none) { delete clips[role]; slotLog.push({ id, role, clip: '', how: 'none' }); continue; }
            if (p.pack === 'random') { delete clips[role]; packFree.add(role); slotLog.push({ id, role, clip: '', how: 'pack-random' }); continue; } // Oct 30 (Spring): a random pack clip of this kind
            if (p.shared) { const sc = shared?.byName[p.clip] || shared?.byName[p.animation]; if (sc) { clips[role] = sc; picked.add(role); slotLog.push({ id, role, clip: sc.name, how: 'shared' }); } else slotLog.push({ id, role, clip: p.clip, how: 'shared-skipped' }); continue; }
            const cl = byName(p.clip);
            if (cl) { clips[role] = cl; picked.add(role); slotLog.push({ id, role, clip: p.clip, how: p.auto ? 'auto' : 'pick' }); }
            else slotLog.push({ id, role, clip: p.clip, how: 'missing-in-glb' });
          } }
    let events: any = null;
        if (info.clips) { try { const er = await fetch(base + 'events.json'); if (er.ok) events = await er.json(); } catch { /* no events file */ } }
        const parts: Record<string, THREE.Object3D> = {};
        for (const pc of PARTS[id]) { try { parts[pc.name] = (await gl.loadAsync(base + pc.file)).scene; } catch { /* part missing: the figure still works */ } }
        const a = { char: c.scene, clips, parts, info, events, shared, picked, packFree };
        ready.set(id, a);
        return a;
      } catch (e: any) { console.warn('[creature3d] ' + id + ' failed to load: ' + (e?.message || e)); return null; }
    })();
    cache.set(id, p);
  }
  return p;
}

export interface C3D {
  group: THREE.Group; mixer: THREE.AnimationMixer; mats: THREE.MeshStandardMaterial[];
  play(n: CreatureAnim): void; current(): string; update(dt: number): void;
  /** Round 24: attack clip played by the model (GLB clip name), release time (ms into the clip) and bone read from events.json; onRelease fires exactly when the clip passes it */ attackClip?: string; partObject?: (name: string) => THREE.Object3D | null; clipOf?: (anim: string) => string; release?: { ms: number; bone: string } | null; onRelease?: (bone: THREE.Object3D) => void; currentClip?: () => string; partInfo?: () => { name: string; file: string; bone: string; pos: number[]; rot: number[]; rotDeg: number[]; scale: number[]; loaded: boolean }[];
  /** flying units */ flying?: { hoverSquares: number; floatSquares: number; floatsPerSecond: number; swayDeg: number; groundShadow: boolean; source: string }; lift?: number; swayNowDeg?: number; groundShadow?: boolean;
  /** Owner fix (Oct 28): true when the model has this clip */ has?: (n: string) => boolean;
  /** Oct 30: where the attack blow lands (s into the clip, if known) and a clip speed setter */ impactOf?: (n: string) => number | undefined; setSpeed?: (n: string, k: number) => void; gaitSpeed?: (n: string) => number | undefined; setPace?: (n: string, pace: number) => void; eventsOf?: (n: string) => { name: string; time: number }[]; packRoles?: Set<string>; animWeight?: () => number; poseDelta?: () => number; diag?: () => any; seek?: (n: string, t: number) => void;
  clipNames: string[]; held: string[]; worn: string[]; height: number;
  /** height in board squares (owner look or default) */ heightSpaces: number; items: { name: string; bone: string; matchesLook: boolean; visible: boolean }[]; log: string[]; onPlay?: (n: string) => void; dur(n: string): number;
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
  // test hook (Oct 30 T-pose hunt): the bind pose, captured before any clip plays; poseDelta() = mean bone rotation away from it (radians); ~0 = T-pose showing
  const restQ = new Map<string, THREE.Quaternion>(); ch.traverse((o: any) => { if (o.isBone && !restQ.has(o.name)) restQ.set(o.name, o.quaternion.clone()); });
  const held: string[] = [], worn: string[] = [];
  let ballRec: { part: THREE.Object3D; bone: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 } | null = null;
  const items: { name: string; bone: string; matchesLook: boolean; visible: boolean }[] = [];
  const partInfo: { name: string; file: string; bone: string; pos: number[]; rot: number[]; rotDeg: number[]; scale: number[]; loaded: boolean }[] = [];
  const objs = new Map<string, THREE.Object3D | null>();
  const addItem = (name: string, bone: string, matchesLook: boolean, obj: THREE.Object3D | null) => { objs.set(name, obj); items.push({ name, bone, matchesLook, get visible() { let o: THREE.Object3D | null = obj; if (!o) return true; while (o) { if (!o.visible) return false; o = o.parent; } return true; } }); };
  const attackClipName = a.clips.attack?.name || '';
  const release: { ms: number; bone: string } | null = null; // Round 26 item (0): no projectile release any more
  ch.updateMatrixWorld(true);
  const look = LOOKS[id];
  const H = Math.max(0.01, skinBox(ch).getSize(new THREE.Vector3()).y);
  // the figure is normalised on the body alone when an owner look exists (items must not change its height)
  const mixer = new THREE.AnimationMixer(ch);
  const actions: Record<string, THREE.AnimationAction> = {};
  // Oct 30: every figure draws its own idle / walk / run from the shared pack (unless Ken picked a slot or the model has its own custom clip)
  const packRoles = new Set<string>();
  const clips = { ...a.clips }, sh = a.shared, pick = (l?: THREE.AnimationClip[]) => (l && l.length ? l[Math.floor(Math.random() * l.length)] : undefined);
  if (sh) {
    // a role is free unless Ken picked a slot for it, the model's own clips map names it, or the model has its own custom clip for it
    const mapped = (role: string) => { const m = a.info?.clips || {}; return typeof m[role] === 'string' || (role === 'defeat' && typeof m.death === 'string') || (role === 'knockback' && typeof m.react_knockback === 'string') || (role === 'lifted' && typeof m.react_lifted === 'string'); };
    const free = (role: string) => !a.picked?.has(role) && (!!a.packFree?.has(role) || (!mapped(role) && (!clips[role] || STOCK.test(clips[role].name))));
    const ranged = ((CARDS as any)[id]?.abilities || []).includes('ranged');
    for (const [role, kinds] of [['idle', ['idle']], ['walk', ['walk']], ['run', ['run']], ['idleBreak', ['idleBreak']], ['attack', [ranged ? 'ranged' : 'attack']], ['hit', ['hit']], ['knockback', ['knockback']], ['bowled', ['bowled']], ['defeat', ['defeat']], ['lifted', ['lifted']]] as [string, string[]][]) {
      if (!free(role)) continue;
      const cl = pick(kinds.flatMap((k) => sh.byKind[k] || []));
      if (cl) { clips[role] = cl; packRoles.add(role); }
    }
  }
  for (const k of Object.keys(clips)) actions[k] = mixer.clipAction(clips[k]);
  let cur = '';
  const log: string[] = [];
  const randomIdle = () => { const ac = actions.idle; if (ac) { ac.time = Math.random() * (ac.getClip().duration || 1); ac.timeScale = 0.9 + Math.random() * 0.2; } }; // nothing idles in unison
  const once = (n: string) => n === 'attack' || n === 'mine' || n === 'hit' || n === 'defeat' || n === 'knockback' || n === 'bowled' || n === 'idleBreak'; // Round 28b: new one-shot roles
  const resolve = (n: string): string => (actions[n] ? n : n === 'run' && actions.walk ? 'walk' : n === 'mine' && actions.attack ? 'attack' : (n === 'knockback' || n === 'bowled') && actions.hit ? 'hit' : 'idle'); // Round 28b: knockback / bowled fall back to the hit clip, idleBreak to idle
  const lockLen = (n: string) => (n === 'defeat' ? 1e9 : Math.min(actions[n]?.getClip().duration || 0.8, n === 'hit' ? 0.8 : 1.1));
  let started = 0, shakeT = 0;
  const out: C3D = {} as C3D;
  const play = (want: CreatureAnim) => {
    if (!Object.keys(actions).length) {
      // no skeleton (the Iron Scarab beetle): log the action; the figure slides when moved and shakes when hit
      if (want !== cur) { cur = want; log.push(want); out.onPlay?.(want); if (want === 'hit') shakeT = 0.45; }
      return;
    }
    const n = resolve(want);
    if (!actions[n] || cur === n) return;
    // a started one-shot (attack / hit / mine) finishes before idle or walk take over; defeat never ends
    // Oct 30 (Ken: "moving, but their animation's not playing"): walking or running always takes over at once (only a defeat or an idle break-in
    // fidget used to hold it back for up to 1.1 s, so the unit slid); other one-shots still finish before idle
    if (cur && once(cur) && !once(n) && n !== 'walk' && n !== 'run' && mixer.time - started < lockLen(cur)) return;
    if (cur === 'defeat') return;
    const next = actions[n];
    next.reset(); next.setLoop(once(n) ? THREE.LoopOnce : THREE.LoopRepeat, once(n) ? 1 : Infinity); next.clampWhenFinished = true;
    const prev = actions[cur]; if (prev && prev !== next) next.crossFadeFrom(prev, 0.15, false);
    if (n === 'idle') randomIdle();
    next.play(); cur = n; started = mixer.time; log.push(n); if (n === 'run') log.push('walk'); out.onPlay?.(n);
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
      partInfo.push({ name: pc.name, file: pc.file, bone: bone.name, pos: [...pc.look.pos], rot: [...pc.look.rot], rotDeg: [...pc.look.rot], scale: [...pc.look.scale], loaded: true });
      if (pc.name === 'bowling-ball') ballRec = { part, bone, p: part.position.clone(), q: part.quaternion.clone(), s: part.scale.clone() };
      addItem(pc.name, bone.name, true, part);
      (/Hand/.test(bone.name) ? held : worn).push(pc.name);
      continue;
    }
    const bn = attachPart(ch, pc, src, H, prep);
    if (bn) { addItem(pc.name, bn, false, ch.getObjectByName(bn)?.children[ch.getObjectByName(bn)!.children.length - 1] || null); (/Hand/.test(bn) ? held : worn).push(pc.name); }
  }
  const root = new THREE.Group();
  const sc = new THREE.Group();
  const k = 1 / bodyH;
  ch.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  let heightSpaces = HEIGHTS[id] ?? (look ? look.height : DEFAULT_H[id] || 1.1);
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
    addItem(mt.name, 'ground', false, holder);
    const total = seat + 0.8;
    root.scale.setScalar(1 / total);
    heightSpaces = HEIGHTS[id] ?? (DEFAULT_H[id] || 1.35);
    root.scale.setScalar(heightSpaces / 1.1 / total);
  } else root.scale.setScalar(heightSpaces / 1.1);
  // Round 23: flying units (a saved look's `flying`, or the Gyronaut defaults) hover, bob, sway and keep a soft ground shadow
  const flyCfg: any = (look as any)?.flying || (id === 'gyrocopter-ace' ? { hoverSquares: 0.7, floatSquares: 0.06, floatsPerSecond: 0.6, swayDeg: 3, groundShadow: true, source: 'default' } /* Ken (Oct 30): hover twice as high */ : null);
  let flyT = 0, shadow: THREE.Mesh | null = null;
  if (flyCfg) {
    out.flying = { hoverSquares: flyCfg.hoverSquares, floatSquares: flyCfg.floatSquares, floatsPerSecond: flyCfg.floatsPerSecond, swayDeg: flyCfg.swayDeg, groundShadow: !!flyCfg.groundShadow, source: flyCfg.source || 'look' };
    out.lift = flyCfg.hoverSquares; out.swayNowDeg = 0; out.groundShadow = !!flyCfg.groundShadow;
    if (flyCfg.groundShadow) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d')!, g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.renderOrder = 1; shadow.userData.shadow = true; root.add(shadow);
    }
  }
  const rig = ballRec ? makeBallRig(ch, root, ballRec, out, log, () => cur, () => heightSpaces) : null;
  // Owner fix (Ken, Oct 28): while the Shaman carries a unit his special loops between its lift_start and lift_end events (he holds the lift)
  const holdSeg = (): [number, number] => { const ac = actions.special; const cn = ac ? ac.getClip().name : ''; const d = ac ? ac.getClip().duration || 1 : 1; const ev: any[] = (a.events as any)?.clips?.[cn]?.events || []; const s0 = ev.find((e: any) => e.name === 'lift_start')?.time; const s1 = ev.find((e: any) => e.name === 'lift_end')?.time; return [typeof s0 === 'number' ? s0 : d * 0.3, typeof s1 === 'number' ? s1 : d * 0.8]; };
  randomIdle();
  /** Oct 30: seconds into a clip where the blow lands (pack metadata, or an impact/hit/contact event in events.json) */
  out.impactOf = (n: string): number | undefined => { const cl = actions[resolve(n)]?.getClip(); if (!cl) return undefined; if (sh?.impact[cl.name] !== undefined) return sh.impact[cl.name]; const ev: any[] = (a.events as any)?.clips?.[cl.name]?.events || []; const e = ev.find((x: any) => /impact|hit|contact|strike|release/i.test(x.name || '')); return typeof e?.time === 'number' ? e.time : undefined; };
  /** Oct 30: walk / run pace from the pack (rootSpeed x leg ratio), in board squares per second */
  out.gaitSpeed = (n: string) => { const cl = actions[resolve(n)]?.getClip(); const sp = cl ? sh?.speed[cl.name] : undefined; return sp ? (sp / bodyH) * heightSpaces : undefined; };
  /** Oct 30: the pack's timed events of the clip playing this role (launch / land / recovered, hit, ground...) */
  out.packRoles = packRoles;
  out.poseDelta = () => { let n = 0, t = 0; ch.traverse((o: any) => { if (o.isBone && restQ.has(o.name)) { n++; t += 2 * Math.acos(Math.min(1, Math.abs(o.quaternion.dot(restQ.get(o.name)!)))); } }); return n ? t / n : 0; };
  out.diag = () => { const run = Object.entries(actions).filter(([, ac]) => ac.isRunning()).map(([k, ac]) => `${k}:${ac.getClip().name}:w${ac.getEffectiveWeight().toFixed(2)}:t${ac.time.toFixed(2)}:ts${ac.timeScale}`); return { cur, run, mixerTime: +mixer.time.toFixed(2), tracks: actions[cur] ? actions[cur].getClip().tracks.length : 0 }; };
  /** test hook (Oct 30 T-pose sweep): total effective weight of the playing clips; ~0 = the bind pose shows */
  out.animWeight = () => Object.values(actions).reduce((t, ac) => t + (ac.isRunning() || ac.clampWhenFinished && ac.enabled ? ac.getEffectiveWeight() : 0), 0);
  out.eventsOf = (n: string) => { const cl = actions[resolve(n)]?.getClip(); return (cl && sh?.events[cl.name]) || []; };
  out.seek = (n: string, t: number) => { const ac = actions[resolve(n)]; if (ac) ac.time = t; };
  /** Oct 30: play a walk / run clip at the speed that matches a pace in board squares per second (feet stay planted) */
  out.setPace = (n: string, pace: number) => { const g = out.gaitSpeed?.(n); const ac = actions[resolve(n)]; if (ac) ac.timeScale = g ? Math.min(1.8, Math.max(0.6, pace / g)) : 1; };
  out.setSpeed = (n: string, k: number) => { const ac = actions[resolve(n)]; if (ac) ac.timeScale = k; };
  Object.assign(out, { group: root, mixer, mats, play, current: () => cur, update: (dt: number) => { mixer.update(dt); if (cur === 'special' && actions.special) { const sg = holdSeg(); if (actions.special.time > sg[1]) actions.special.time = sg[0]; } if (flyCfg) { flyT += dt; out.lift = flyCfg.hoverSquares + Math.sin(flyT * Math.PI * 2 * flyCfg.floatsPerSecond) * flyCfg.floatSquares; out.swayNowDeg = Math.sin(flyT * Math.PI * 2 * flyCfg.floatsPerSecond * 0.7) * flyCfg.swayDeg; sc.rotation.z = THREE.MathUtils.degToRad(out.swayNowDeg!); if (shadow) { const rs = root.scale.y || 1; shadow.position.y = 0.01 - out.lift! / rs; shadow.scale.setScalar(1 / rs * (1 - out.lift! * 0.3)); } } if (shakeT > 0) { shakeT = Math.max(0, shakeT - dt); root.position.x = Math.sin(shakeT * 70) * 0.04 * (shakeT / 0.45); if (!shakeT) { root.position.x = 0; if (cur === 'hit') cur = 'idle'; } } if (rig) rig.step(dt); }, attackClip: attackClipName, release, currentClip: () => actions[cur]?.getClip().name || '', partInfo: () => partInfo, partObject: (n: string) => objs.get(n) || null, clipOf: (n: string) => actions[resolve(n)]?.getClip().name || '', clipNames: Object.keys(actions), has: (n: string) => !!actions[n], held, worn, height: 1, heightSpaces, items, log, dur: (n: string) => actions[resolve(n)]?.getClip().duration || 0 });
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
          { const hr = Math.hypot(pos.x, pos.z); if (hr < 0.2) { const dx = sx * 0.35, dz = 1.0, dl = Math.hypot(dx, dz); const ex = hr > 1e-4 ? pos.x : dx / dl * 0.01, ez = hr > 1e-4 ? pos.z : dz / dl * 0.01; const el = Math.hypot(ex, ez); pos.x = ex / el * 0.2; pos.z = Math.abs(ez / el * 0.2) < 0.12 ? 0.12 : ez / el * 0.2; } } // released clear of the body (never through it)
          const T = 0.9, g = 7, ty = r + 0.002;
          vel.set((sx * 0.35 - pos.x) / T, (ty - pos.y + 0.5 * g * T * T) / T, (1.0 - pos.z) / T); // lands well in front of the body, dead (0 bounces)
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
    if (detached && c.y > 0.2 && c.y < 0.9 && Math.hypot(c.x, c.z) < 0.13) pen++; // only a free ball can pass through the body
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

// Placeholder 3D battlefield (Three.js). Returns null when WebGL is unavailable (the UI then shows a 2D board).
import * as THREE from 'three';
import { COLORS, FACTIONS, CARDS, CONFIG, isActed, weaponOf } from '../engine';
import { loadGrubnak3d, makeGrubnak3d, grubnak3dReady, G3D } from './grubnak3d';
import { MINE_MODEL, makeMine, makeGoblin, setUpgrades, makeStronghold, makeGrubnak, makeRocketBarrel, MineArt, GrubnakArt, StrongholdArt } from './art';
import { audio } from './audio';
import layoutJson from '../content/arena-layout.json';
import { buildArena } from './arena-fx';
import { boardHomography, cellGeometry, fitCamera, groundToPainting, BG, BOARD } from './arena-geo';

const BW: number = CONFIG.boardWidth, BH: number = CONFIG.boardHeight;
const SHP = CONFIG.strongholds as Record<string, number[]>;

export interface Rect { x: number; y: number; w: number; h: number }
export interface BoardView {
  is3D: boolean;
  setState(state: any, events: any[]): void;
  cellRect(row: number, col: number): Rect;
  resize(): void;
  setCamera(c: { zoom: number; x: number; y: number }): void;
  /** painted-arena view controls (round 8a) */
  zoomAt(factor: number, sx?: number, sy?: number): void;
  panBy(dx: number, dy: number): void;
  recenter(): void;
  getView(): any;
  onViewChange?: () => void;
  cellQuad(row: number, col: number): { x: number; y: number }[];
  screenRects(): any;
  setFlowMode(m: string): void;
  pulseFlow(side: string): void;
  emote(side: 'player' | 'opponent', kind: 'cheer' | 'groan' | 'flinch' | 'cast'): void;
  poke(uid: string): string | null;
  retreat(side: 'player' | 'opponent'): void;
  stats(): Promise<any>;
  dispose(): void;
}

const SYMBOL: Record<string, string> = { skull: '💀', gear: '⚙️', hammer: '🔨' };
const hexOf = (id: string | null) => (id && id !== 'white' ? COLORS[id].hex : COLORS.neutral.hex);
const CMD_H = 2.4, CREATURE_H = 1.1;
/** Height of the solid meshes in a group (sprites, beams and transparent effects ignored), in world units. */
function measureBox(o: THREE.Object3D): THREE.Box3 {
  const b = new THREE.Box3();
  o.updateMatrixWorld(true);
  o.traverse((m: any) => {
    if (!m.isMesh || m.name === 'bomb-spark' || (m.material && m.material.transparent && m.material.opacity < 0.5)) return;
    let p: THREE.Object3D | null = m, skip = false;
    while (p) { if (p.name === 'bomb' || p.name === 'acting-ring') skip = true; p = p.parent; }
    if (!skip) { if (m.isSkinnedMesh) { m.skeleton.update(); m.boundingBox = null; m.computeBoundingBox(); b.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld)); } else b.expandByObject(m); }
  });
  return b;
}
function measureHeight(o: THREE.Object3D): number {
  const b = measureBox(o);
  return b.isEmpty() ? 0 : b.max.y - Math.max(b.min.y, 0);
}
const world = (row: number, col: number) => new THREE.Vector3(col - (BW + 1) / 2, 0, row - (BH + 1) / 2);

const symCache: Record<string, THREE.Texture> = {};
function symbolSprite(sym: string, size = 0.55) {
  if (!symCache[sym]) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.font = '44px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(SYMBOL[sym] || '?', 32, 36);
    symCache[sym] = new THREE.CanvasTexture(c);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: symCache[sym], transparent: true, depthWrite: false }));
  sp.scale.set(size, size, 1);
  return sp;
}

const M = (color: number, extra: any = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });
const WOOD = 0x8a5a2a, IRON = 0xc4c8d4;
/** Big comic-style weapon for a creature's figure, chosen by type (see weaponOf). */
function addWeapon(g: THREE.Group, weapon: string | null, faction: string) {
  const add = (m: THREE.Object3D, x: number, y: number, z: number, rx = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; g.add(m); return m; };
  const rod = (len: number, x: number, y: number, z: number, rz = 0, color = WOOD, r = 0.03) => add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), M(color)), x, y, z, 0, rz);
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color = IRON, rz = 0) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color, { metalness: 0.4 })), x, y, z, 0, rz);
  const pick = (x: number) => {
    rod(0.9, x, 0.6, 0.12, 0.3);
    const head = add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 6, 14, Math.PI), M(IRON, { metalness: 0.4 })), x - 0.1, 1.05, 0.12, 0, -0.3 + Math.PI);
    head.name = 'pickaxe';
  };
  const sword = (x: number) => {
    if (faction === 'goblins') { box(0.2, 0.7, 0.05, x, 0.85, 0.14, 0x9aa0a8, -0.2); box(0.1, 0.2, 0.06, x - 0.02, 0.45, 0.14, WOOD, -0.2); }
    else if (faction === 'gnomes') { box(0.08, 0.85, 0.05, x, 0.9, 0.14, 0x6fd0ff, -0.15); box(0.3, 0.05, 0.06, x + 0.02, 0.5, 0.14, 0xd0a030); }
    else { box(0.18, 0.85, 0.05, x, 0.9, 0.14, 0xd8dce6, -0.1); box(0.34, 0.07, 0.07, x + 0.01, 0.5, 0.14, 0x7a5a20); }
  };
  switch (weapon) {
    case 'pick': pick(-0.34); break;
    case 'pick-hammer':
      pick(-0.34);
      box(0.3, 0.2, 0.2, 0.36, 1.0, 0.12, 0x555a66); rod(0.7, 0.36, 0.62, 0.12);
      box(0.42, 0.08, 0.22, 0, 0.14, 0.4, 0x555a66); box(0.3, 0.1, 0.18, 0, 0.05, 0.4, 0x555a66);
      break;
    case 'pick-crystal': {
      pick(-0.34);
      const cr = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.2), M(0x7affc8, { emissive: 0x20a070, emissiveIntensity: 0.8 })), 0.38, 0.8, 0.14);
      cr.scale.y = 1.4;
      break;
    }
    case 'sword': sword(0.36); break;
    case 'sword-shield': {
      sword(0.36);
      const sh = add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 14), M(0xb08a30, { metalness: 0.4 })), -0.3, 0.55, 0.22, Math.PI / 2, 0);
      sh.rotation.y = 0.3;
      break;
    }
    case 'lance': {
      rod(1.6, 0.36, 0.7, 0.1, 0.0, WOOD, 0.035);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 8), M(IRON, { metalness: 0.5 })), 0.36, 1.65, 0.1);
      add(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), M(0xd02828, { side: THREE.DoubleSide })), 0.5, 1.3, 0.1);
      break;
    }
    case 'sling': {
      rod(0.5, 0.34, 0.55, 0.12, 0.0, WOOD);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 14), M(0x6a4a20)), 0.34, 0.95, 0.12);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), M(0x888888)), 0.34, 0.95, 0.12);
      break;
    }
    case 'wand': {
      rod(0.85, 0.36, 0.7, 0.12, -0.15, 0x6a3aa0, 0.035);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), M(0x9ad0ff, { emissive: 0x3a80ff, emissiveIntensity: 1 })), 0.3, 1.18, 0.12);
      break;
    }
    case 'crossbow': {
      box(0.6, 0.06, 0.08, 0.3, 0.6, 0.2, WOOD);
      box(0.07, 0.06, 0.6, 0.3, 0.6, 0.0 + 0.2, WOOD);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 14, Math.PI), M(0x444444)), 0.3, 0.6, 0.45, 0, Math.PI / 2 * 0).rotation.y = Math.PI / 2;
      add(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 6), M(0xdddddd)), 0.3, 0.6, 0.55, Math.PI / 2, 0);
      break;
    }
    case 'axes':
      for (const [x, rz] of [[-0.36, 0.2], [0.36, -0.2]] as [number, number][]) {
        rod(0.7, x, 0.7, 0.12, rz);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 3), M(IRON, { metalness: 0.4 })), x + (x < 0 ? -0.12 : 0.12), 1.02, 0.12, Math.PI / 2, 0);
      }
      break;
    case 'gyro': {
      rod(0.3, 0, 1.0, 0, 0, 0x444444, 0.03);
      const bl = box(1.2, 0.03, 0.12, 0, 1.18, 0, 0x888888); bl.name = 'rotor';
      box(0.12, 0.03, 1.2, 0, 1.18, 0, 0x888888);
      break;
    }
    case 'signature': {
      sword(0.4);
      const crown = add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 6), M(0xffd45a, { emissive: 0xaa7a00, emissiveIntensity: 0.7 })), 0, 1.05, 0);
      crown.scale.set(1, 0.7, 1);
      break;
    }
  }
}

export function createBoardView(container: HTMLElement, low: boolean): BoardView | null {
  let renderer: THREE.WebGLRenderer;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
    renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: true });
  } catch {
    return null;
  }
  const testMode = document.body.classList.contains('test');
  renderer.setPixelRatio(testMode ? 0.5 : low ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !low;
  renderer.info.autoReset = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const canvas = renderer.domElement;
  canvas.className = 'board-canvas';
  container.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
  // dark moody base light; the glowing mines are the main light sources, cool rim light keeps creatures readable
  scene.add(new THREE.HemisphereLight(0xa0a2cc, 0x3a3040, 1.9));
  const sun = new THREE.DirectionalLight(0xd8dcff, 2.2);
  sun.position.set(-4, 9, 5);
  sun.castShadow = !low;
  sun.shadow.mapSize.set(1024, 512);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffb070, 2.0);
  rim.position.set(3, 4, -8);
  scene.add(rim);

  // the painted arena is a 2D picture behind this canvas; the floor only catches the pieces' shadows
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.ShadowMaterial({ opacity: 0.4 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.receiveShadow = true;
  scene.add(catcher);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const composer: null = null, bloomPass: null = null;

  // glowing crystal mines inside spiked palisades
  const mines: MineArt[] = [];
  for (let mi = 0; mi < CONFIG.mineCount; mi++) {
    const m = makeMine(low, mi);
    m.recolor(COLORS.neutral.hex);
    scene.add(m.group);
    mines.push(m);
  }
  const crystals = mines.map((m) => ({ ctl: undefined as any, art: m, sprite: null as THREE.Sprite | null }));

  const embers: null = null;

  // Round 5b: soul crystal flow particles (mines stream into their owner's Stronghold; neutral mines swirl)
  const FN = 16;
  let flowMode = (() => { try { return localStorage.getItem('oreheart.flow') || ''; } catch { return ''; } })() || (low ? 'reduced' : 'on');
  const pulseAt: Record<string, number> = { player: 0, opponent: 0 };
  const flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CONFIG.mineCount * FN * 3), 3));
  flowGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CONFIG.mineCount * FN * 3), 3));
  const flowMat = new THREE.PointsMaterial({ size: 0.17, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!; const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })() });
  const flowPts = new THREE.Points(flowGeo, flowMat);
  flowPts.frustumCulled = false;
  flowPts.renderOrder = -1;
  scene.add(flowPts);
  const flowOwner: string[] = [];
  const flowCol: Record<string, THREE.Color> = { player: new THREE.Color(0x66ccff), opponent: new THREE.Color(0xff5a4a), neutral: new THREE.Color(0xe8e8ff) };
  const bez = new THREE.Vector3();
  function updateFlow(now: number) {
    const n = flowMode === 'off' ? 0 : flowMode === 'reduced' ? 6 : FN;
    flowPts.visible = n > 0;
    if (!n) return;
    const pos = flowGeo.getAttribute('position') as THREE.BufferAttribute, col = flowGeo.getAttribute('color') as THREE.BufferAttribute;
    const t = now / 1000;
    let pulse = 0;
    for (const sd of ['player', 'opponent']) pulse = Math.max(pulse, 1 - Math.min(1, (now - pulseAt[sd]) / 1000));
    flowMat.size = 0.17 + pulse * 0.1;
    mines.forEach((m, mi) => {
      const owner = flowOwner[mi] || 'neutral';
      const a = m.group.position;
      const dest = owner === 'neutral' ? null : cmd[owner].group.position;
      const c = flowCol[owner];
      for (let i = 0; i < FN; i++) {
        const k = mi * FN + i;
        if (i >= n) { pos.setXYZ(k, 0, -50, 0); continue; }
        if (dest) {
          const u = (t * 0.32 + i / n) % 1;
          const sx = a.x, sy = 1.5, sz = a.z, ex = dest.x, ey = CMD_H * 0.55, ez = dest.z;
          const cx = (sx + ex) / 2, cy = 3.4, cz = (sz + ez) / 2;
          const w = 1 - u;
          bez.set(w * w * sx + 2 * w * u * cx + u * u * ex, w * w * sy + 2 * w * u * cy + u * u * ey, w * w * sz + 2 * w * u * cz + u * u * ez);
          bez.x += Math.sin(t * 3 + i) * 0.06; bez.z += Math.cos(t * 3 + i * 1.7) * 0.06;
          pos.setXYZ(k, bez.x, bez.y, bez.z);
          const fade = Math.min(1, u * 6, (1 - u) * 4) * (0.8 + pulse * 0.6);
          col.setXYZ(k, c.r * fade, c.g * fade, c.b * fade);
        } else {
          const ang = t * 1.1 + (i / n) * Math.PI * 2, r = 0.38 + 0.12 * Math.sin(t * 1.7 + i);
          pos.setXYZ(k, a.x + Math.cos(ang) * r, 1.45 + 0.25 * Math.sin(t * 1.3 + i * 2) + (i % 3) * 0.12, a.z + Math.sin(ang) * r);
          col.setXYZ(k, c.r * 0.8, c.g * 0.8, c.b * 0.8);
        }
      }
    });
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  // strongholds + commanders
  type Cmd = { group: THREE.Group; keep: StrongholdArt | null; fig: THREE.Group; grub: GrubnakArt | null; g3d: G3D | null; body: THREE.Mesh; emote: { kind: string; t: number } | null; baseK?: number; faction: string; id: string; retreat: { t: number; barrel: THREE.Group } | null };
  const cmd: Record<string, Cmd> = {};
  for (const side of ['player', 'opponent'] as const) {
    const g = new THREE.Group();
    const p = world(SHP[side][0], SHP[side][1]);
    g.position.copy(p);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    const fig = new THREE.Group();
    scene.add(g);
    cmd[side] = { group: g, keep: null, fig, grub: null, g3d: null, body, emote: null, faction: '', id: '', retreat: null };
  }
  function buildCommander(side: 'player' | 'opponent', faction: string, id: string) {
    const cm = cmd[side];
    cm.group.clear();
    cm.g3d = null;
    const a3 = id === 'grubnak' ? grubnak3dReady() : null;
    if (a3) { cm.keep = null; cm.retreat = null; } else { cm.keep = makeStronghold(faction, low); cm.group.add(cm.keep.group); }
    cm.fig = new THREE.Group();
    cm.grub = null;
    if (a3) {
      // Round 7 Part B: the Meshy 3D Grubnak on his own fortress
      cm.g3d = makeGrubnak3d(a3);
      cm.fig = cm.g3d.group;
    } else if (id === 'grubnak') {
      cm.grub = makeGrubnak(low);
      cm.grub.group.position.y = 0.8;
      cm.grub.group.scale.setScalar(0.85);
      cm.fig.add(cm.grub.group);
    } else {
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 12), new THREE.MeshStandardMaterial({ color: hexOf(FACTIONS[faction].crystal) }));
      body.position.y = 1.1;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), new THREE.MeshStandardMaterial({ color: 0xe9c89a }));
      head.position.y = 1.55;
      cm.fig.add(body, head);
    }
    if (cm.g3d) {
      // face the opposing Commander (the model looks down +Z)
      const me = world(SHP[side][0], SHP[side][1]), you = world(SHP[side === 'player' ? 'opponent' : 'player'][0], SHP[side === 'player' ? 'opponent' : 'player'][1]);
      // the player's Grubnak (near the camera) turns about half-way toward the camera so his face stays visible
      const yaw = Math.atan2(you.x - me.x, you.z - me.z);
      cm.fig.rotation.y = side === 'player' ? yaw * 0.35 : yaw;
    } else if (side === 'opponent') cm.fig.rotation.y = Math.PI;
    cm.group.add(cm.fig);
    cm.faction = faction; cm.id = id;
    flowCol[side] = new THREE.Color(hexOf(FACTIONS[faction].crystal)).lerp(new THREE.Color(0xffffff), 0.25);
    // Round 5b: Commander + Stronghold about 2.4 spaces tall, feet to head
    cm.group.scale.setScalar(1);
    cm.g3d?.update(0.05);
    cm.group.updateMatrixWorld(true);
    const bx = measureBox(cm.group), nat = bx.isEmpty() ? 0 : bx.max.y - Math.max(bx.min.y, 0);
    if (nat > 0.5) {
      // tall and narrow: 2.4 spaces high, but still inside its one space (about 1.3 wide)
      const k = CMD_H / nat, wide = Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z, 0.1);
      const sxz = cm.g3d ? k : Math.min(k, 1.3 / wide);
      cm.group.scale.set(sxz, k, sxz);
    }
    cm.baseK = cm.group.scale.y;
  }
  loadGrubnak3d().then((a) => { if (a && !disposed) for (const side of ['player', 'opponent'] as const) if (cmd[side].id === 'grubnak' && !cmd[side].g3d) buildCommander(side, cmd[side].faction, 'grubnak'); });

  // creatures
  type Fig = {
    group: THREE.Group; target: THREE.Vector3; born: number; dying: number; lunge: THREE.Vector3 | null; lungeT: number; owner: string; acted?: boolean;
    uid: string; cardId: string; finished: boolean; mats: THREE.MeshStandardMaterial[]; parts: any; baseScale: number; hitT: number; mineT: number; poke: { name: string; t: number } | null; upg: number; moving: number; shootT: number;
  };
  const figs = new Map<string, Fig>();
  const fx: { obj: THREE.Object3D; t: number; kind: string; vel?: THREE.Vector3 }[] = [];
  const puffTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; g.fillStyle = '#ffe14a'; g.strokeStyle = '#3a2400'; g.lineWidth = 4; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 28, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); return new THREE.CanvasTexture(c); })();
  function spawnFx(kind: 'dust' | 'stars' | 'spark', at: THREE.Vector3, n = 5) {
    if (low) return;
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: kind === 'stars' ? starTex : puffTex, transparent: true, depthWrite: false, color: kind === 'spark' ? 0xfff0a0 : kind === 'dust' ? 0xb8a890 : 0xffffff }));
      sp.scale.setScalar(kind === 'stars' ? 0.22 : kind === 'spark' ? 0.12 : 0.3);
      sp.position.copy(at).add(new THREE.Vector3(0, 0.3, 0));
      scene.add(sp);
      const a = (i / n) * Math.PI * 2;
      fx.push({ obj: sp, t: performance.now(), kind, vel: new THREE.Vector3(Math.cos(a) * 0.9, kind === 'stars' ? 2 : 0.9, Math.sin(a) * 0.9) });
    }
  }
  function makeFigure(c: any): { group: THREE.Group; finished: boolean; mats: THREE.MeshStandardMaterial[]; parts: any; baseScale: number } {
    const card = CARDS[c.cardId];
    const f = FACTIONS[card.faction];
    const colorHex = hexOf(f.crystal);
    const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xffd400 });
    let g: THREE.Group;
    let finished = false, mats: THREE.MeshStandardMaterial[] = [], parts: any = null, baseScale = 1;
    if (card.faction === 'goblins') {
      const gf = makeGoblin(card.id, card, (wg) => addWeapon(wg, weaponOf(card), 'goblins'), low);
      g = gf.group; finished = true; mats = gf.mats.list; parts = gf.parts; baseScale = gf.baseScale;
      (g as any).userData.goblin = gf;
    } else {
      g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.55 });
      const big = card.rarity === 'Collector' ? 1.35 : card.rarity === 'Ultra Rare' ? 1.15 : 1;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 12), mat);
      body.position.y = 0.3;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8d3a8 }));
      head.position.y = 0.72;
      body.castShadow = head.castShadow = !low;
      g.add(body, head);
      if (card.faction === 'gnomes') { const h = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.32, 10), new THREE.MeshStandardMaterial({ color: 0xd04040 })); h.position.y = 1.0; g.add(h); }
      if (card.faction === 'dwarves') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.1), new THREE.MeshStandardMaterial({ color: 0x8a5a2a })); b.position.set(0, 0.6, 0.17); g.add(b); }
      addWeapon(g, weaponOf(card), card.faction);
      const sp = symbolSprite(f.symbol, 0.42);
      sp.position.y = 1.2;
      g.add(sp);
      baseScale = big;
      parts = { body, head };
      g.scale.setScalar(big);
    }
    const hasBomb = (card.abilities || []).some((a: string) => a === 'kaboom' || a === 'kaboom1');
    if (hasBomb) {
      // big round bomb with a lit fuse carried at the creature's side (R2.17)
      const bomb = new THREE.Group();
      bomb.name = 'bomb';
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.35, metalness: 0.5 }));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.07, 8), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.5 }));
      cap.position.y = 0.2;
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5), new THREE.MeshBasicMaterial({ color: 0xc9a46a }));
      fuse.position.set(0.04, 0.3, 0); fuse.rotation.z = -0.5;
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
      spark.position.set(0.1, 0.38, 0); spark.name = 'bomb-spark';
      bomb.add(ball, cap, fuse, spark);
      bomb.position.set(-0.34, 0.55, 0.1);
      g.add(bomb);
    }
    (g as any).userData.bomb = hasBomb;
    // Round 5b: every creature stands about 1.1 spaces tall
    g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const nat = measureHeight(g);
    if (nat > 0.05) baseScale = (CREATURE_H / nat) * (card.rarity === 'Collector' ? 1.1 : 1);
    g.scale.setScalar(baseScale);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 6, 24), ringMat());
    ring.name = 'acting-ring';
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    ring.scale.setScalar(1 / baseScale);
    g.add(ring);
    return { group: g, finished, mats, parts, baseScale };
  }

  let state: any = null;
  function setState(st: any, events: any[]) {
    state = st;
    const now = performance.now();
    st.sites.forEach((s: any, i: number) => {
      const cr = crystals[i];
      cr.art.group.position.copy(world(s.row, s.col));
      if (cr.ctl === s.color) return;
      const first = cr.ctl === undefined;
      cr.ctl = s.color;
      flowOwner[i] = s.controller || 'neutral';
      cr.art.recolor(s.controller === 'player' ? '#3fa9ff' : s.controller === 'opponent' ? '#ff6a3f' : hexOf(null));
      if (!first) cr.art.burst();
      if (cr.sprite) cr.art.group.remove(cr.sprite);
      cr.sprite = null;
      if (s.controller) {
        cr.sprite = symbolSprite(FACTIONS[st.players[s.controller].faction].symbol, 0.5);
        cr.sprite.position.y = 1.85;
        cr.art.group.add(cr.sprite);
      }
    });
    (['player', 'opponent'] as const).forEach((side) => {
      const fct = st.players[side].faction, id = st.players[side].commanderId;
      if (cmd[side].faction !== fct || cmd[side].id !== id) buildCommander(side, fct, id);
      // heart cracks: more cracks as Health drops (shown on the Stronghold gem)
      const hp = st.players[side].health;
      const k = cmd[side].keep;
      if (k) k.gemMat.emissiveIntensity = hp <= 7 ? 0.5 : hp <= 14 ? 1.1 : 1.8;
    });
    const seen = new Set<string>();
    for (const c of st.board.creatures) {
      seen.add(c.uid);
      let f = figs.get(c.uid);
      const tgt = world(c.row, c.col);
      if (!f) {
        const m = makeFigure(c);
        const born = events.some((e) => e.type === 'summon' && e.uid === c.uid) ? now : 0;
        m.group.position.copy(tgt);
        scene.add(m.group);
        f = { group: m.group, target: tgt.clone(), born, dying: 0, lunge: null, lungeT: 0, owner: c.owner, uid: c.uid, cardId: c.cardId, finished: m.finished, mats: m.mats, parts: m.parts, baseScale: m.baseScale, hitT: 0, mineT: 0, poke: null, upg: 0, moving: 0, shootT: 0 };
        figs.set(c.uid, f);
        if (born) { spawnFx('dust', tgt, 6); audio.play('summon'); if (f.finished) audio.voiceLine('grunt'); }
        // creatures face the enemy
        m.group.rotation.y = 0;
      }
      if (f.target.distanceTo(tgt) > 0.01) { f.moving = now; if (f.group.position.distanceTo(tgt) < 6) audio.play('step', CARDS[c.cardId].faction); }
      f.target.copy(tgt);
      if (f.finished) {
        const card = CARDS[c.cardId];
        const upg = Math.max(0, (c.attack - card.attack)) + Math.max(0, (c.maxHealth - card.health));
        if (upg !== f.upg) { f.upg = upg; setUpgrades({ group: f.group, mats: { list: f.mats } }, upg); }
      }
      const acted = isActed(st, c);
      if (f.acted !== acted) {
        f.acted = acted;
        f.group.traverse((o: any) => {
          if (o.name === 'acting-ring') { o.material.color.set(acted ? 0x3a3d44 : 0xffd400); return; }
          const m = o.material;
          if (!m || !m.color || o.isSprite || m.isMeshBasicMaterial || m.isPointsMaterial) return;
          if (!m.userData.base) m.userData.base = m.color.clone();
          m.color.copy(m.userData.base);
          if (acted) { const hsl: any = {}; m.color.getHSL(hsl); m.color.setHSL(hsl.h, hsl.s * 0.8, hsl.l * 0.5); }
        });
      }
      const mv = events.find((e) => e.type === 'move' && e.uid === c.uid);
      if (mv && mv.teleport) f.group.position.copy(tgt);
    }
    for (const [uid, f] of figs) if (!seen.has(uid) && !f.dying) { f.dying = now; spawnFx('stars', f.group.position, 5); spawnFx('dust', f.group.position, 4); audio.play('defeat-poof'); if (f.finished) audio.voiceLine('sulk'); }
    for (const e of events) {
      if (e.type === 'attack' && figs.get(e.uid)) {
        const f = figs.get(e.uid)!;
        const to = e.target.commander ? world(SHP[e.target.commander][0], SHP[e.target.commander][1]) : world(e.target.row, e.target.col);
        f.lunge = to.clone().sub(f.target).multiplyScalar(0.45);
        f.lungeT = now;
        f.shootT = now;
        audio.play(e.ranged || (CARDS[f.cardId].abilities || []).includes('ranged') ? 'ranged' : 'melee');
        if (f.finished) audio.voiceLine('yell');
        if (!e.target.commander && !e.ranged) {
          for (const d of figs.values()) if (d !== f && d.target.distanceTo(to) < 0.1) { d.lunge = f.target.clone().sub(d.target).multiplyScalar(0.3); d.lungeT = now; }
        }
      } else if (e.type === 'mine' && figs.get(e.uid)) {
        const f = figs.get(e.uid)!;
        f.mineT = now;
        const m = world(e.row, e.col);
        setTimeout(() => { spawnFx('spark', m, 4); audio.play('pick'); audio.play('chime'); }, 220);
      } else if (e.type === 'damage' && e.uid) {
        const f = figs.get(e.uid);
        if (f && e.amount > 0) { f.hitT = now; }
      } else if (e.type === 'damage' && e.commander) audio.play('stronghold');
    }
  }

  // ---------------------------------------------------------------- painted arena (round 8a)
  // 2D paintings (swamp + arena + the owner's effects) sit behind this canvas in a second WebGL canvas; the 3D pieces stand on
  // the painted floor through a camera fitted to the owner's four floor corners (arena-geo.ts). One view transform (zoom and
  // pan in painting pixels) moves the paintings, effects, pieces and highlights together.
  const H0 = boardHomography();
  const fit = fitCamera(H0);
  const dprNow = () => (testMode ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  const backCanvas = document.createElement('canvas');
  backCanvas.className = 'board-canvas arena-canvas';
  container.prepend(backCanvas);
  let backRenderer: THREE.WebGLRenderer | null = null;
  try {
    backRenderer = new THREE.WebGLRenderer({ canvas: backCanvas, antialias: false, alpha: false });
    backRenderer.setPixelRatio(testMode ? 0.5 : low ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    backRenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    backRenderer.setClearColor(0x000000, 1);
  } catch { backRenderer = null; }
  let arena: ReturnType<typeof buildArena> | null = null;
  const arenaInfo = { background: 'skullfang-swamp-background.jpg', picture: 'skullfang-arena.png', layout: 'skullfang-arena-layout.json', loaded: false, effects: 0, cutouts: 0, gridLines: false };
  {
    const loader = new THREE.TextureLoader();
    const aniso = backRenderer ? backRenderer.capabilities.getMaxAnisotropy() : 1;
    const load = (url: string) => new Promise<THREE.Texture>((res, rej) => loader.load(url, (t) => { t.anisotropy = aniso; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; res(t); }, undefined, rej));
    Promise.all([load('/art/arena/skullfang-swamp-background.jpg'), load('/art/arena/skullfang-arena.png')]).then(([bg, ar]) => {
      if (disposed) return;
      const prev = THREE.ColorManagement.enabled;
      arena = buildArena(layoutJson, bg, ar, () => view.scale * (testMode ? 0.5 : low ? 1 : Math.min(window.devicePixelRatio || 1, 2)));
      THREE.ColorManagement.enabled = prev;
      Object.assign(arenaInfo, { loaded: true, effects: arena.effects.length, cutouts: arena.cuts.length });
      applyView();
    }).catch(() => {});
  }

  // view: zoom 1 = the painting fills the window (cover-fit, never stretched); centre in painting pixels
  const view = { zoom: 1, cx: BG.w / 2, cy: BG.h / 2, scale: 1, s0: 1, maxZoom: 2, W: 390, H: 420 };
  const cam = { zoom: 1, x: 0, y: 0 };
  function clampView() {
    const { W, H } = view;
    view.s0 = Math.max(W / BG.w, H / BG.h);
    // at most 2.5 screen pixels per painting pixel (never less than a useful zoom range on very large screens)
    const maxScale = Math.max(2.5 / dprNow(), view.s0 * 1.6);
    view.maxZoom = maxScale / view.s0;
    view.zoom = Math.min(view.maxZoom, Math.max(1, view.zoom));
    view.scale = view.s0 * view.zoom;
    const hw = W / (2 * view.scale), hh = H / (2 * view.scale);
    view.cx = hw * 2 >= BG.w ? BG.w / 2 : Math.min(BG.w - hw, Math.max(hw, view.cx));
    view.cy = hh * 2 >= BG.h ? BG.h / 2 : Math.min(BG.h - hh, Math.max(hh, view.cy));
    cam.zoom = view.zoom; cam.x = (BG.w / 2 - view.cx) * view.scale; cam.y = (BG.h / 2 - view.cy) * view.scale;
  }
  const toScreen = (x: number, y: number): [number, number] => [(x - view.cx) * view.scale + view.W / 2, (y - view.cy) * view.scale + view.H / 2];
  const tmpM = new THREE.Matrix4();
  function applyView() {
    clampView();
    const { W, H, scale } = view;
    const x0 = view.cx - W / (2 * scale), y0 = view.cy - H / (2 * scale), P = fit.P;
    const n = 0.1, f = 300, A = (f + n) / (f - n), B = (-2 * f * n) / (f - n);
    const row = (k: number) => { // rows of P: u (0), v (1), w (2), each over x, y, z, 1
      return [P[k * 4], P[k * 4 + 1], P[k * 4 + 2], P[k * 4 + 3]];
    };
    const u = row(0), v = row(1), w = row(2);
    const cxr = u.map((c, i) => ((2 * scale) / W) * (c - x0 * w[i]) - w[i]);
    const cyr = v.map((c, i) => w[i] - ((2 * scale) / H) * (c - y0 * w[i]));
    const czr = w.map((c, i) => A * c + (i === 3 ? B : 0));
    camera.position.set(...fit.pos);
    tmpM.makeBasis(new THREE.Vector3(...fit.right), new THREE.Vector3(...fit.up), new THREE.Vector3(...fit.back));
    camera.quaternion.setFromRotationMatrix(tmpM);
    camera.updateMatrixWorld(true);
    camera.projectionMatrix.set(...([...cxr, ...cyr, ...czr, ...w] as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number])).multiply(camera.matrixWorld);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    arena?.setView(x0, y0, W / scale, H / scale);
  }
  let lastT = performance.now();
  function arenaFrame(now: number) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    easeView(dt);
    if (arena && backRenderer) { arena.update(now / 1000, dt); backRenderer.render(arena.scene, arena.cam); }
  }
  /** a point on the floor (or at a height) in screen pixels */
  const projPt = (x: number, y: number, z: number): [number, number] => {
    const P = fit.P;
    const u = P[0] * x + P[1] * y + P[2] * z + P[3], v = P[4] * x + P[5] * y + P[6] * z + P[7], w = P[8] * x + P[9] * y + P[10] * z + P[11];
    return toScreen(u / w, v / w);
  };
  /** Commander + Stronghold silhouette: the one-space footprint at the feet and the narrower head top at 2.4 spaces. */
  const figPts = (side: string): [number, number][] => {
    const p = world(SHP[side][0], SHP[side][1]), out: [number, number][] = [];
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) out.push(projPt(p.x + dx, 0, p.z + dz));
    for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) out.push(projPt(p.x + dx, CMD_H, p.z + dz));
    return out;
  };
  let sizedW = 0, sizedH = 0;
  function resize() {
    const W = container.clientWidth || 390, H = container.clientHeight || 420;
    view.W = W; view.H = H;
    if (W !== sizedW || H !== sizedH) { sizedW = W; sizedH = H; renderer.setSize(W, H, false); backRenderer?.setSize(W, H, false); }
    canvas.style.width = '100%'; canvas.style.height = '100%';
    backCanvas.style.width = '100%'; backCanvas.style.height = '100%';
    applyView();
  }
  const tgt = { zoom: 1, cx: BG.w / 2, cy: BG.h / 2 };
  let easing = false;
  function setViewState(zoom: number, cx: number, cy: number) {
    const prev = { zoom: view.zoom, cx: view.cx, cy: view.cy };
    view.zoom = zoom; view.cx = cx; view.cy = cy; applyView();
    Object.assign(tgt, { zoom: view.zoom, cx: view.cx, cy: view.cy });
    if (!testMode) { Object.assign(view, prev); applyView(); easing = true; }
  }
  /** smooth, eased motion toward the target view (every frame; instant in automated runs) */
  function easeView(dt: number) {
    if (!easing) return;
    const k = 1 - Math.exp(-dt * 16);
    view.zoom *= Math.pow(tgt.zoom / view.zoom, k); view.cx += (tgt.cx - view.cx) * k; view.cy += (tgt.cy - view.cy) * k;
    if (Math.abs(Math.log(tgt.zoom / view.zoom)) < 0.0015 && Math.hypot(tgt.cx - view.cx, tgt.cy - view.cy) * view.scale < 0.3) { view.zoom = tgt.zoom; view.cx = tgt.cx; view.cy = tgt.cy; easing = false; }
    applyView();
    api.onViewChange?.();
  }
  function zoomAt(factor: number, sx = view.W / 2, sy = view.H / 2) {
    // keep the painting point under (sx, sy) fixed
    const bx = view.cx + (sx - view.W / 2) / view.scale, by = view.cy + (sy - view.H / 2) / view.scale;
    view.zoom *= factor; clampView();
    setViewState(view.zoom, bx - (sx - view.W / 2) / view.scale, by - (sy - view.H / 2) / view.scale);
  }
  function panBy(dx: number, dy: number) { setViewState(view.zoom, view.cx - dx / view.scale, view.cy - dy / view.scale); }
  function recenter() { setViewState(1, BG.w / 2, BG.h / 2); }
  function getView() {
    const homog = H0;
    return {
      zoom: view.zoom, maxZoom: view.maxZoom, centerX: view.cx, centerY: view.cy, scale: view.scale, coverScale: view.s0,
      pxPerPaintingPx: view.scale * dprNow(), cssPxPerPaintingPx: view.scale, window: { w: view.W, h: view.H },
      visible: { x0: view.cx - view.W / (2 * view.scale), y0: view.cy - view.H / (2 * view.scale), x1: view.cx + view.W / (2 * view.scale), y1: view.cy + view.H / (2 * view.scale) },
      painting: { w: BG.w, h: BG.h }, arena: arenaInfo, homography: homog, corners: layoutJson.boardCorners,
      cells: [[1, 1], [1, 13], [7, 13], [7, 1], [4, 7], [7, 2], [1, 12]].map(([r, c]) => ({ row: r, col: c, center: toScreen(...cellGeometry(H0, r, c).center), quad: cellGeometry(H0, r, c).quad.map(([x, y]) => toScreen(x, y)) })),
    };
  }
  void groundToPainting; void BOARD;
  function screenRects() {
    const W = view.W, H = view.H;
    const box = (pts: [number, number][]) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [sx, sy] of pts) { x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    };
    const hx = BW / 2, hz = BH / 2;
    const bb = box([projPt(-hx, 0, -hz), projPt(hx, 0, -hz), projPt(hx, 0, hz), projPt(-hx, 0, hz)]);
    const cx0 = Math.max(0, bb.x), cx1 = Math.min(W, bb.x + bb.width), cy0 = Math.max(0, bb.y), cy1 = Math.min(H, bb.y + bb.height);
    return { playerCommander: box(figPts('player')), opponentCommander: box(figPts('opponent')), board: { x: cx0, y: cy0, width: cx1 - cx0, height: cy1 - cy0 } };
  }
  function cellQuad(row: number, col: number) { return cellGeometry(H0, row, col).quad.map(([x, y]) => { const [sx, sy] = toScreen(x, y); return { x: sx, y: sy }; }); }
  function cellRect(row: number, col: number): Rect {
    const q = cellQuad(row, col);
    const x0 = Math.min(...q.map((p) => p.x)), x1 = Math.max(...q.map((p) => p.x)), y0 = Math.min(...q.map((p) => p.y)), y1 = Math.max(...q.map((p) => p.y));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function emote(side: 'player' | 'opponent', kind: string) {
    cmd[side].emote = { kind, t: performance.now() };
    const g3 = cmd[side].g3d;
    if (g3) g3.play(kind === 'cheer' ? (Math.random() < 0.7 ? (Math.random() < 0.5 ? 'laugh' : 'point') : 'idle') : kind === 'flinch' ? 'hit' : kind === 'cast' ? 'cast' : kind === 'groan' ? 'surprised' : 'idle');
    if (cmd[side].id === 'grubnak') audio.voiceLine(kind === 'cheer' ? 'laugh' : kind === 'groan' ? 'sulk' : kind === 'flinch' ? 'yell' : 'grunt');
  }

  const POKES = ['cackle', 'rude dance', 'angry stomp'];
  let pokeN = 0;
  function poke(uid: string): string | null {
    const f = figs.get(uid);
    if (!f || !f.finished) return null;
    const name = POKES[pokeN++ % 3];
    f.poke = { name, t: performance.now() };
    audio.voiceLine(name === 'cackle' ? 'cackle' : name === 'angry stomp' ? 'stomp' : 'grunt');
    return name;
  }

  function retreat(side: 'player' | 'opponent') {
    const cm = cmd[side];
    const barrel = makeRocketBarrel();
    barrel.position.set(0, 1.0, 0);
    cm.group.add(barrel);
    const other = cmd[side === 'player' ? 'opponent' : 'player'];
    other.g3d?.play('celebrate', { loop: true });
    if (cm.g3d) {
      cm.g3d.play('defeat');
      barrel.visible = false;
      cm.retreat = { t: performance.now() + 1400, barrel };
      setTimeout(() => { if (cm.g3d) cm.g3d.figure.visible = false; barrel.visible = true; }, 1400);
      audio.play('kaboom');
      return;
    }
    if (cm.grub) cm.fig.visible = false;
    cm.retreat = { t: performance.now(), barrel };
    audio.play('kaboom');
  }

  /** Test info for the Meshy 3D Grubnak: measured height in board spaces, footprint, animations. */
  function c3(side: 'player' | 'opponent') {
    const cm = cmd[side];
    if (!cm.g3d) return {};
    cm.group.updateMatrixWorld(true);
    const b = measureBox(cm.group);
    return { model3d: 'meshy', heightSpaces: +(b.max.y - Math.max(b.min.y, 0)).toFixed(2), footprint: +Math.max(b.max.x - b.min.x, b.max.z - b.min.z).toFixed(2), animations: cm.g3d.clipNames, animation: cm.g3d.current() };
  }
  let lastRender = 0;
  let lastDur = 0;
  let lastFrame = { calls: 0, tris: 0 };
  let frames = 0;
  let raf = 0;
  let disposed = false;
  const tmpV = new THREE.Vector3();
  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    if (testMode && now - lastRender < Math.max(300, lastDur * 5)) return; // automated runs use software GL: keep the page responsive
    lastRender = now;
    for (const [uid, f] of figs) {
      const g = f.group;
      if (f.dying) {
        const k = (now - f.dying) / 380;
        g.scale.setScalar(Math.max(0.001, f.baseScale * (1 - k)));
        g.rotation.y += 0.3;
        g.position.y = Math.sin(Math.min(1, k) * Math.PI) * 0.4;
        if (k >= 1) { scene.remove(g); figs.delete(uid); }
        continue;
      }
      let goal = f.target.clone();
      if (f.lunge) {
        const k = (now - f.lungeT) / 380;
        if (k >= 1) f.lunge = null;
        else goal.add(f.lunge.clone().multiplyScalar(Math.sin(k * Math.PI)));
      }
      g.position.lerp(goal, 0.22);
      const walking = g.position.distanceTo(f.target) > 0.05;
      if (f.born) {
        const k = Math.min(1, (now - f.born) / 450);
        g.position.y = (1 - k) * -0.6;
        g.visible = true;
        if (k >= 1) f.born = 0;
      } else g.position.y = walking ? Math.abs(Math.sin(now / 90)) * 0.09 : Math.abs(Math.sin(now / 260 + g.position.x)) * 0.015;
      // hit flash (red) + flinch
      if (f.hitT) {
        const k = (now - f.hitT) / 320;
        const on = k < 1;
        for (const m of f.mats) { const e0 = m.userData.e0; if (on) { m.emissive.setHex(0xff1a1a); m.emissiveIntensity = 0.9 * (1 - k); } else { m.emissive.setHex(e0.hex); m.emissiveIntensity = e0.i; } }
        if (on) g.rotation.z = Math.sin(k * 24) * 0.18 * (1 - k); else { g.rotation.z = 0; f.hitT = 0; }
      }
      const p = f.parts;
      if (f.finished && p) {
        const t = now / 1000;
        // idle: breathing hunch, ear-twitch head sway
        p.body.scale.y = 1 + Math.sin(t * 2.2 + g.position.x) * 0.02;
        p.head.rotation.z = Math.sin(t * 1.3 + g.position.z) * 0.06;
        p.armL.rotation.x = Math.sin(t * 2 + 1) * 0.06; p.armR.rotation.x = Math.sin(t * 2) * 0.06;
        p.weapon.rotation.x = 0; p.weapon.rotation.z = 0;
        p.legL.rotation.x = p.legR.rotation.x = 0;
        if (walking) { p.legL.rotation.x = Math.sin(now / 80) * 0.6; p.legR.rotation.x = -Math.sin(now / 80) * 0.6; p.armL.rotation.x = -Math.sin(now / 80) * 0.5; }
        const ak = (now - f.shootT) / 380;
        if (f.shootT && ak < 1) { p.weapon.rotation.x = -Math.sin(ak * Math.PI) * 1.3; p.armR.rotation.x = -Math.sin(ak * Math.PI) * 1.6; }
        const mk = (now - f.mineT) / 900;
        if (f.mineT && mk < 1) { p.weapon.rotation.x = -Math.abs(Math.sin(mk * Math.PI * 3)) * 1.2 + 0.3; p.armR.rotation.x = p.weapon.rotation.x; p.body.rotation.x = Math.abs(Math.sin(mk * Math.PI * 3)) * 0.2; }
        else p.body.rotation.x = 0;
        if (f.poke) {
          const k = (now - f.poke.t) / 1100;
          if (k >= 1) { f.poke = null; g.rotation.y = 0; g.scale.setScalar(f.baseScale); }
          else if (f.poke.name === 'cackle') { p.head.rotation.x = -0.5 + Math.sin(k * 60) * 0.1; p.body.rotation.x = -0.15; g.position.y += Math.abs(Math.sin(k * Math.PI * 6)) * 0.07; }
          else if (f.poke.name === 'rude dance') { g.rotation.y = Math.sin(k * Math.PI * 8) * 0.7; g.position.y += Math.abs(Math.sin(k * Math.PI * 8)) * 0.1; p.armL.rotation.z = Math.sin(k * 30) * 0.8; }
          else { g.scale.set(f.baseScale * (1 + Math.sin(k * Math.PI * 4) * 0.06), f.baseScale * (1 - Math.abs(Math.sin(k * Math.PI * 4)) * 0.12), f.baseScale); p.armL.rotation.x = p.armR.rotation.x = -2.2; }
        } else { p.armL.rotation.z = 0; p.head.rotation.x = 0; }
        if (p.aura) (p.aura.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(t * 2) * 0.06;
      }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i], k = (now - e.t) / 700;
      if (k >= 1) { scene.remove(e.obj); (e.obj as THREE.Sprite).material.dispose(); fx.splice(i, 1); continue; }
      e.obj.position.add(tmpV.copy(e.vel!).multiplyScalar(0.016));
      e.vel!.y -= e.kind === 'stars' ? 0.06 : 0;
      ((e.obj as THREE.Sprite).material as THREE.SpriteMaterial).opacity = 1 - k;
    }
    for (const side of ['player', 'opponent'] as const) {
      const cm = cmd[side];
      cm.fig.position.y = cm.g3d ? 0 : Math.sin(now / 600 + (side === 'player' ? 0 : 2)) * 0.02;
      if (cm.g3d) cm.g3d.update(Math.min(0.1, Math.max(0, (now - (cm.g3d as any)._t || 0) / 1000))), ((cm.g3d as any)._t = now);
      cm.fig.rotation.z = 0;
      const gr = cm.grub;
      if (gr) { gr.armL.rotation.set(0, 0, 0); gr.armR.rotation.set(0, 0, 0); gr.head.rotation.set(0, 0, 0); gr.mouth.scale.y = 1; }
      if (cm.keep) cm.keep.flags.forEach((fl, i) => { fl.rotation.y = Math.sin(now / 500 + i) * 0.3; });
      if (cm.emote) {
        const k = (now - cm.emote.t) / 700;
        if (k >= 1) cm.emote = null;
        else if (cm.emote.kind === 'cheer') {
          cm.fig.position.y += Math.abs(Math.sin(k * Math.PI * 3)) * 0.25;
          if (gr) { gr.head.rotation.x = -0.35; gr.mouth.scale.y = 1.8; gr.armR.rotation.x = -Math.abs(Math.sin(k * Math.PI * 4)) * 1.4; } // belly laugh + throne pound
        } else if (cm.emote.kind === 'groan') {
          cm.fig.rotation.z = Math.sin(k * Math.PI) * 0.5;
          if (gr) { gr.head.rotation.x = 0.4; gr.armR.rotation.x = Math.sin(k * Math.PI * 2) * 0.8; } // sulk + crate kick
        } else if (cm.emote.kind === 'flinch') {
          cm.fig.rotation.z = Math.sin(k * 30) * 0.2 * (1 - k);
          if (gr) { gr.armL.rotation.x = -2.2; gr.armL.rotation.z = Math.sin(k * 40) * 0.3; } // fist shake
        } else {
          cm.fig.position.y += Math.sin(k * Math.PI) * 0.15;
          if (gr) gr.armR.rotation.x = -Math.sin(k * Math.PI) * 2.4; // fastball throw
        }
      }
      if (cm.retreat) {
        const k = Math.max(0, (now - cm.retreat.t) / 2200);
        cm.retreat.barrel.position.set(Math.sin(k * 6) * 0.1, 1.0 + k * k * 14, -k * 2);
        cm.retreat.barrel.rotation.x = -k * 0.6;
        const fl = cm.retreat.barrel.getObjectByName('flame');
        if (fl) fl.scale.set(1, 0.7 + Math.random() * 0.6, 1);
        cm.group.rotation.z = Math.sin(k * 40) * 0.06 * (1 - Math.min(1, k));
        if (cm.keep) cm.keep.group.scale.y = Math.max(0.5, 1 - k * 0.4);
      }
    }
    mines.forEach((m) => m.update(now));
    updateFlow(now);
    renderer.info.reset();
    const t0 = performance.now();
    arenaFrame(now);
    renderer.clear();
    renderer.render(scene, camera);
    if (arena) { renderer.clearDepth(); renderer.render(arena.fgScene, arena.cam); }
    lastDur = performance.now() - t0;
    lastFrame = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    frames++;
  }
  resize();
  frame();
  void state;

  function stats(): Promise<any> {
    const f0 = frames, t0 = Date.now();
    return new Promise((resolve) => {
      const wait = () => {
        if (frames >= f0 + 2 && (Date.now() - t0 > 4000 || mines.every((m) => m.group.userData.mineHeight))) {
          resolve({
            webgl: true, graphics: low ? 'low' : 'high', drawCalls: lastFrame.calls, triangles: lastFrame.tris,
            bloom: false, shadows: renderer.shadowMap.enabled, particles: false, arena: arenaInfo,
            figures: [...figs.values()].filter((f) => !f.dying).map((f) => ({ uid: f.uid, cardId: f.cardId, model: f.finished ? 'finished' : 'placeholder', bomb: !!(f.group && f.group.userData && f.group.userData.bomb) })),
            commanders: { player: { commanderId: cmd.player.id, model: cmd.player.grub || cmd.player.g3d ? 'finished' : 'placeholder', ...c3('player') }, opponent: { commanderId: cmd.opponent.id, model: cmd.opponent.grub || cmd.opponent.g3d ? 'finished' : 'placeholder', ...c3('opponent') } },
            strongholds: { player: 'finished', opponent: 'finished' }, mines: 'finished', mineModels: mines.map((m, i) => ({ source: MINE_MODEL, height: m.group.userData.mineHeight || 0, owner: flowOwner[i] || 'neutral', tint: m.group.userData.tintHex || '#ffffff' })), mineModel: mines.every((m) => m.group.userData.mineModel === 'gltf') ? 'gltf' : 'loading',
          });
        } else setTimeout(wait, 30);
      };
      wait();
    });
  }

  const api: BoardView = {
    is3D: true, setState, cellRect, cellQuad, resize, setCamera() { /* the painted view is driven by zoomAt / panBy / recenter */ }, zoomAt, panBy, recenter, getView, screenRects, setFlowMode(m) { flowMode = m; }, pulseFlow(side) { pulseAt[side] = performance.now(); }, emote, poke, retreat, stats,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
      backRenderer?.dispose();
      try { backRenderer?.forceContextLoss(); } catch { /* ignore */ }
      backCanvas.remove();
      try { renderer.forceContextLoss(); } catch { /* ignore */ }
      canvas.remove();
    },
  };
  return api;
}

/** Flat board used when WebGL is not available. */
export function createFlatView(container: HTMLElement): BoardView {
  container.classList.add('flat');
  const cam = { zoom: 1, x: 0, y: 0 };
  return {
    is3D: false,
    setState() {},
    setCamera(c) { Object.assign(cam, c); },
    zoomAt() {}, panBy() {}, recenter() {}, getView: () => ({}), cellQuad() { return []; },
    screenRects: () => ({ playerCommander: { x: 0, y: 0, width: 0, height: 0 }, opponentCommander: { x: 0, y: 0, width: 0, height: 0 }, board: { x: 0, y: 0, width: 0, height: 0 } }),
    setFlowMode() {},
    pulseFlow() {},
    cellRect(row, col) {
      const w = container.clientWidth || 390, h = container.clientHeight || 420;
      const cs = Math.min((h * 0.87) / BH, w / BW);
      const x0 = (w - cs * BW) / 2, y0 = h * 0.03;
      const x = x0 + (col - 1) * cs, y = y0 + (row - 1) * cs, z = cam.zoom;
      return { x: (x - w / 2) * z + w / 2 + cam.x, y: (y - h / 2) * z + h / 2 + cam.y, w: cs * z, h: cs * z };
    },
    resize() {},
    poke: () => null,
    retreat() { /* flat board: the overlay shows the retreat */ },
    stats: async () => ({ webgl: false, graphics: 'low', drawCalls: 0, triangles: 0, bloom: false, shadows: false, particles: false, figures: [], commanders: { player: { commanderId: '', model: 'placeholder' }, opponent: { commanderId: '', model: 'placeholder' } }, strongholds: { player: 'finished', opponent: 'finished' }, mines: 'finished' }),
    emote(side, kind) {
      const el = container.querySelector(`.stronghold.${side}`);
      if (el) { el.classList.remove('emote-cheer', 'emote-groan', 'emote-flinch', 'emote-cast'); void (el as HTMLElement).offsetWidth; el.classList.add('emote-' + kind); }
    },
    dispose() { container.classList.remove('flat'); },
  };
}

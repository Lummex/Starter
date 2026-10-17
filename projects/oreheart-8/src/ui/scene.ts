// Placeholder 3D battlefield (Three.js). Returns null when WebGL is unavailable (the UI then shows a 2D board).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { COLORS, FACTIONS, CARDS, CONFIG, isActed, weaponOf } from '../engine';
import { darkGround, borderDecor, makeMine, makeGoblin, setUpgrades, makeStronghold, makeGrubnak, makeRocketBarrel, MineArt, GrubnakArt, StrongholdArt } from './art';
import { audio } from './audio';

const BW: number = CONFIG.boardWidth, BH: number = CONFIG.boardHeight;
const SHP = CONFIG.strongholds as Record<string, number[]>;

export interface Rect { x: number; y: number; w: number; h: number }
export interface BoardView {
  is3D: boolean;
  setState(state: any, events: any[]): void;
  cellRect(row: number, col: number): Rect;
  resize(): void;
  setCamera(c: { zoom: number; x: number; y: number }): void;
  emote(side: 'player' | 'opponent', kind: 'cheer' | 'groan' | 'flinch' | 'cast'): void;
  poke(uid: string): string | null;
  retreat(side: 'player' | 'opponent'): void;
  stats(): Promise<any>;
  dispose(): void;
}

const SYMBOL: Record<string, string> = { skull: '💀', gear: '⚙️', hammer: '🔨' };
const hexOf = (id: string | null) => (id && id !== 'white' ? COLORS[id].hex : COLORS.neutral.hex);
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
  scene.fog = new THREE.FogExp2(0x15101c, 0.012);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  // dark moody base light; the glowing mines are the main light sources, cool rim light keeps creatures readable
  scene.add(new THREE.HemisphereLight(0x8a8cba, 0x2a2030, 1.3));
  const sun = new THREE.DirectionalLight(0xc8d0ff, 1.6);
  sun.position.set(-4, 9, 5);
  sun.castShadow = !low;
  sun.shadow.mapSize.set(1024, 512);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffb070, 2.0);
  rim.position.set(3, 4, -8);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ map: darkGround(), roughness: 1, color: 0x9a9aa0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  scene.add(borderDecor(BW, BH, low));

  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  if (!low) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(128, 128), 0.32, 0.5, 0.92);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    } catch { composer = null; bloomPass = null; }
  }

  // glowing crystal mines inside spiked palisades
  const mines: MineArt[] = [];
  for (let mi = 0; mi < CONFIG.mineCount; mi++) {
    const m = makeMine(low, mi);
    m.recolor(COLORS.neutral.hex);
    scene.add(m.group);
    mines.push(m);
  }
  const crystals = mines.map((m) => ({ ctl: undefined as any, art: m, sprite: null as THREE.Sprite | null }));

  // embers
  let embers: THREE.Points | null = null;
  if (!low) {
    const n = 60, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 14; pos[i * 3 + 1] = Math.random() * 2.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 8; }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa050, size: 0.05, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(embers);
  }

  // strongholds + commanders
  type Cmd = { group: THREE.Group; keep: StrongholdArt | null; fig: THREE.Group; grub: GrubnakArt | null; body: THREE.Mesh; emote: { kind: string; t: number } | null; faction: string; id: string; retreat: { t: number; barrel: THREE.Group } | null };
  const cmd: Record<string, Cmd> = {};
  for (const side of ['player', 'opponent'] as const) {
    const g = new THREE.Group();
    const p = world(SHP[side][0], SHP[side][1]);
    g.position.copy(p);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    const fig = new THREE.Group();
    scene.add(g);
    cmd[side] = { group: g, keep: null, fig, grub: null, body, emote: null, faction: '', id: '', retreat: null };
  }
  function buildCommander(side: 'player' | 'opponent', faction: string, id: string) {
    const cm = cmd[side];
    cm.group.clear();
    cm.keep = makeStronghold(faction, low);
    cm.group.add(cm.keep.group);
    cm.fig = new THREE.Group();
    cm.grub = null;
    if (id === 'grubnak') {
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
    if (side === 'opponent') cm.fig.rotation.y = Math.PI;
    cm.group.add(cm.fig);
    cm.faction = faction; cm.id = id;
  }

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
      cr.art.recolor(hexOf(s.color));
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

  const cam = { zoom: 1, x: 0, y: 0 };
  const YAW = (33 * Math.PI) / 180;
  function resize() {
    const w = container.clientWidth || 390, h = container.clientHeight || 420;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    bloomPass?.resolution.set(Math.max(64, w / 2), Math.max(64, h / 2));
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = w / h;
    const el = (40 * Math.PI) / 180;
    const y0 = 0.02 * h, y1 = 0.97 * h;
    const hx = BW / 2 + 0.05, hz = BH / 2 + 0.05;
    const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    const fit = (dist: number) => {
      camera.clearViewOffset();
      camera.zoom = 1;
      camera.position.set(Math.sin(YAW) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(YAW) * Math.cos(el) * dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      let top = 1e9, bot = -1e9, left = 1e9, right = -1e9;
      for (const [x, z] of corners) {
        const v = new THREE.Vector3(x, 0, z).project(camera);
        const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
        top = Math.min(top, sy); bot = Math.max(bot, sy); left = Math.min(left, sx); right = Math.max(right, sx);
      }
      return { top, bot, left, right };
    };
    let lo = 4, hi = 80;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      const f = fit(mid);
      if (f.bot - f.top <= y1 - y0 && f.right - f.left <= w) hi = mid; else lo = mid;
    }
    const f = fit(hi);
    // slide the view so the enemy Stronghold row sits at the top edge
    const baseX = -((w - (f.right - f.left)) / 2 - f.left), baseY = -(y0 - f.top);
    camera.setViewOffset(w, h, baseX - cam.x, baseY - cam.y, w, h);
    camera.zoom = cam.zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function cellRect(row: number, col: number): Rect {
    const c = world(row, col);
    const w = container.clientWidth || 390, h = container.clientHeight || 420;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      const v = new THREE.Vector3(c.x + dx, 0, c.z + dz).project(camera);
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function emote(side: 'player' | 'opponent', kind: string) {
    cmd[side].emote = { kind, t: performance.now() };
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
    if (cm.grub) cm.fig.visible = false;
    cm.retreat = { t: performance.now(), barrel };
    audio.play('kaboom');
  }

  let lastRender = 0;
  let lastFrame = { calls: 0, tris: 0 };
  let frames = 0;
  let raf = 0;
  let disposed = false;
  const tmpV = new THREE.Vector3();
  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    if (testMode && now - lastRender < 150) return; // automated runs use software GL: keep the page responsive
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
      cm.fig.position.y = Math.sin(now / 600 + (side === 'player' ? 0 : 2)) * 0.02;
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
        const k = (now - cm.retreat.t) / 2200;
        cm.retreat.barrel.position.set(Math.sin(k * 6) * 0.1, 1.0 + k * k * 14, -k * 2);
        cm.retreat.barrel.rotation.x = -k * 0.6;
        const fl = cm.retreat.barrel.getObjectByName('flame');
        if (fl) fl.scale.set(1, 0.7 + Math.random() * 0.6, 1);
        cm.group.rotation.z = Math.sin(k * 40) * 0.06 * (1 - Math.min(1, k));
        if (cm.keep) cm.keep.group.scale.y = Math.max(0.5, 1 - k * 0.4);
      }
    }
    mines.forEach((m) => m.update(now));
    if (embers) { const a = embers.geometry.getAttribute('position') as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + 0.004; if (y > 2.4) y = 0; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(now / 900 + i) * 0.001); } a.needsUpdate = true; }
    renderer.info.reset();
    if (composer) composer.render(); else renderer.render(scene, camera);
    lastFrame = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    frames++;
  }
  resize();
  frame();
  void state;

  function stats(): Promise<any> {
    const f0 = frames;
    return new Promise((resolve) => {
      const wait = () => {
        if (frames >= f0 + 2) {
          resolve({
            webgl: true, graphics: low ? 'low' : 'high', drawCalls: lastFrame.calls, triangles: lastFrame.tris,
            bloom: !!bloomPass, shadows: renderer.shadowMap.enabled, particles: !!embers,
            figures: [...figs.values()].filter((f) => !f.dying).map((f) => ({ uid: f.uid, cardId: f.cardId, model: f.finished ? 'finished' : 'placeholder', bomb: !!(f.group && f.group.userData && f.group.userData.bomb) })),
            commanders: { player: { commanderId: cmd.player.id, model: cmd.player.grub ? 'finished' : 'placeholder' }, opponent: { commanderId: cmd.opponent.id, model: cmd.opponent.grub ? 'finished' : 'placeholder' } },
            strongholds: { player: 'finished', opponent: 'finished' }, mines: 'finished',
          });
        } else setTimeout(wait, 30);
      };
      wait();
    });
  }

  return {
    is3D: true, setState, cellRect, resize, setCamera(c) { Object.assign(cam, c); resize(); }, emote, poke, retreat, stats,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      composer?.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* ignore */ }
      canvas.remove();
    },
  };
}

/** Flat board used when WebGL is not available. */
export function createFlatView(container: HTMLElement): BoardView {
  container.classList.add('flat');
  const cam = { zoom: 1, x: 0, y: 0 };
  return {
    is3D: false,
    setState() {},
    setCamera(c) { Object.assign(cam, c); },
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

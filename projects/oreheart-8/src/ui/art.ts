// Procedural dark-fantasy art for the 3D board: Goblin rig, Grubnak, Strongholds, mines, ground.
// Painted-PBR look: rough/metal materials, rim light and glowing gems. No toon shading, no outlines.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface Mats { list: THREE.MeshStandardMaterial[] }

const newMat = (mats: Mats, color: number, o: any = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.1, ...o });
  m.userData.e0 = { hex: m.emissive.getHex(), i: m.emissiveIntensity };
  mats.list.push(m);
  return m;
};
const glow = (color: number, i = 1.4) => ({ emissive: color, emissiveIntensity: i, roughness: 0.3 });

// ---------------------------------------------------------------- ground
export function darkGround(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a232c';
  g.fillRect(0, 0, 512, 512);
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const palette = ['#3a3140', '#463a46', '#241d28', '#4a4452', '#312c38', '#3d322e'];
  for (let i = 0; i < 600; i++) {
    g.fillStyle = palette[Math.floor(rnd() * palette.length)];
    g.globalAlpha = 0.35 + rnd() * 0.4;
    g.beginPath();
    g.ellipse(rnd() * 512, rnd() * 512, 10 + rnd() * 40, 8 + rnd() * 26, rnd() * 3, 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
  // faintly glowing ore cracks
  for (let i = 0; i < 26; i++) {
    let x = rnd() * 512, y = rnd() * 512;
    g.strokeStyle = i % 3 === 0 ? 'rgba(90,255,150,0.22)' : 'rgba(150,120,255,0.16)';
    g.lineWidth = 1 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = '#6a6672';
    g.beginPath();
    g.ellipse(rnd() * 512, rnd() * 512, 4 + rnd() * 8, 3 + rnd() * 5, rnd() * 3, 0, 7);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 8);
  return t;
}

/** Stones, spiked palisade sections, mine carts and broken rails around the border only (never on a playable space). */
export function borderDecor(bw: number, bh: number, low: boolean): THREE.Group {
  const g = new THREE.Group();
  const mats: Mats = { list: [] };
  const rock = newMat(mats, 0x2a272e, { roughness: 1 });
  const wood = newMat(mats, 0x3a2a1c, { roughness: 0.9 });
  const iron = newMat(mats, 0x55555e, { metalness: 0.6, roughness: 0.5 });
  let seed = 99;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const hx = bw / 2 + 0.25, hz = bh / 2 + 0.45;
  const n = low ? 10 : 26;
  for (let i = 0; i < n; i++) {
    const side = i % 4;
    const along = rnd();
    const x = side < 2 ? (along - 0.5) * (bw + 3) : (side === 2 ? -hx - 0.3 - rnd() * 0.6 : hx + 0.3 + rnd() * 0.6);
    const z = side < 2 ? (side === 0 ? -hz - 0.15 - rnd() * 0.5 : hz + 0.15 + rnd() * 0.5) : (rnd() - 0.5) * (bh + 1.5);
    const r = 0.15 + rnd() * 0.3;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rock);
    m.position.set(x, r * 0.5, z);
    m.rotation.set(rnd() * 3, rnd() * 3, 0);
    m.scale.y = 0.7;
    g.add(m);
  }
  // spiked palisade fences along the long edges, with gaps
  const posts = low ? 8 : 22;
  for (let i = 0; i < posts; i++) {
    const x = -bw / 2 + 0.4 + (i / posts) * (bw - 0.8);
    for (const z of [-hz - 0.12, hz + 0.12]) {
      if (Math.abs(x) < 0.9 && !low) continue;
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.55, 5), wood);
      p.position.set(x + (rnd() - 0.5) * 0.1, 0.27, z);
      p.rotation.z = (rnd() - 0.5) * 0.25;
      g.add(p);
    }
  }
  if (!low) {
    // mine carts + broken rails on the left and right borders
    for (const sx of [-1, 1]) {
      const cart = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.36), wood);
      body.position.y = 0.28;
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.4), iron);
      rim.position.y = 0.42;
      const ore = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), newMat(mats, 0x40ff90, glow(0x28d070, 1.1)));
      ore.position.y = 0.5;
      cart.add(body, rim, ore);
      for (const wx of [-0.18, 0.18]) for (const wz of [-0.2, 0.2]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8), iron);
        w.rotation.x = Math.PI / 2; w.position.set(wx, 0.1, wz);
        cart.add(w);
      }
      cart.position.set(sx * (hx + 0.55), 0, -0.6 * sx);
      cart.rotation.y = 0.3 * sx;
      g.add(cart);
      for (let k = 0; k < 5; k++) {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.06), wood);
        tie.position.set(sx * (hx + 0.55) + (rnd() - 0.5) * 0.1, 0.02, -0.6 * sx + 0.35 + k * 0.28);
        tie.rotation.y = 0.3 * sx + (rnd() - 0.5) * 0.2;
        g.add(tie);
      }
    }
  }
  return g;
}

// ---------------------------------------------------------------- mines
export interface MineArt {
  group: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  light: THREE.PointLight | null;
  beam: THREE.Mesh | null;
  sparks: THREE.Points | null;
  crystals: THREE.Group;
  recolor(hex: string | number): void;
  setDecal(hex: string | number): void;
  burst(): void;
  update(now: number): void;
}

export const MINE_MODEL = '/models/mines/crystal-mine.glb';
/** Owner layout: the mine is fitted to 1.7 squares tall at piece scale 1.46. */
const MINE_HEIGHT = 1.7 * 1.46;
let mineModelP: Promise<THREE.Object3D> | null = null;
function loadMineModel(): Promise<THREE.Object3D> {
  return (mineModelP ||= new GLTFLoader().loadAsync(MINE_MODEL).then((g) => g.scene));
}

/** Round 8a: the Meshy crystal mine. Blue crystal, banner and steel are re-coloured in the shader to the owner's tint (player blue, enemy red, unowned pale); the crystal glows. */
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
/** Stone rubble ring, iron-and-gold pedestal with corner posts, blue banner with a gold diamond, a tall glowing crystal with six smaller shards and a few on the rubble. */
function buildMineModel(crystalMats: THREE.MeshStandardMaterial[]): THREE.Group {
  const g = new THREE.Group();
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const rock = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0, flatShading: true });
  const rc = ['#746a5e', '#5f574e', '#81766a', '#6a6157', '#544d46'];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 0.3 + rnd() * 0.42, s = 0.06 + rnd() * 0.12;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock(rc[i % 5]));
    m.position.set(Math.cos(a) * r, s * 0.4, Math.sin(a) * r * 0.85); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); m.scale.y = 0.65 + rnd() * 0.4; g.add(m);
  }
  const steel = new THREE.MeshStandardMaterial({ color: '#2a3b58', roughness: 0.5, metalness: 0.65, flatShading: true });
  const gold = new THREE.MeshStandardMaterial({ color: '#c0913c', roughness: 0.32, metalness: 0.9 });
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.33, 0.42, 8), steel); ped.position.y = 0.25; g.add(ped);
  for (const [y, r] of [[0.06, 0.345], [0.45, 0.29]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.045, 8), gold); t.position.y = y; g.add(t); }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.52, 0.075), steel); p.position.set(Math.cos(a) * 0.31, 0.28, Math.sin(a) * 0.31); p.rotation.y = -a; g.add(p);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 4), gold); cap.position.set(Math.cos(a) * 0.31, 0.59, Math.sin(a) * 0.31); g.add(cap);
  }
  const ban = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.02), new THREE.MeshStandardMaterial({ color: '#1d3f93', roughness: 0.6 })); ban.position.set(0, 0.25, 0.34); g.add(ban);
  for (const [y, w] of [[0.42, 0.22], [0.09, 0.22]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, 0.03), gold); t.position.set(0, y, 0.345); g.add(t); }
  const emb = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), gold); emb.scale.set(0.75, 1.3, 0.3); emb.position.set(0, 0.26, 0.355); g.add(emb);
  const crys = new THREE.MeshStandardMaterial({ color: '#7ab8ff', emissive: '#1f63ff', emissiveIntensity: 1, roughness: 0.12, metalness: 0.1, flatShading: true });
  crystalMats.push(crys);
  const crystal = (h: number, r: number, x: number, y: number, z: number, tx: number, tz: number) => {
    const c = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h * 0.75, 6), crys); b.position.y = h * 0.375;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(r * 0.85, h * 0.25, 6), crys); tip.position.y = h * 0.875;
    c.add(b, tip); c.position.set(x, y, z); c.rotation.set(tx, rnd() * 1, tz); g.add(c);
  };
  crystal(1.1, 0.14, 0, 0.42, 0, 0.04, -0.05);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.4, r = 0.15 + rnd() * 0.1; crystal(0.35 + rnd() * 0.3, 0.05 + rnd() * 0.04, Math.cos(a) * r, 0.42, Math.sin(a) * r * 0.8, Math.sin(a) * 0.45, -Math.cos(a) * 0.45); }
  for (let i = 0; i < 5; i++) { const a = rnd() * Math.PI * 2, r = 0.42 + rnd() * 0.2; crystal(0.18 + rnd() * 0.15, 0.035 + rnd() * 0.025, Math.cos(a) * r, 0.05, Math.sin(a) * r * 0.8, Math.sin(a) * 0.6, -Math.cos(a) * 0.6); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#3d8bff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
  glow.name = 'mine-glow'; glow.position.y = 0.85; glow.scale.set(1.5, 1.7, 1); g.add(glow);
  return g;
}

export function makeMine(low: boolean, idx: number): MineArt {
  const group = new THREE.Group();
  const crystals = new THREE.Group();
  const mats: THREE.MeshStandardMaterial[] = [];
  const uTint = { value: new THREE.Color(0xffffff) }, uGlow = { value: 0.9 };
  const tintMaterial = (src: THREE.MeshStandardMaterial) => {
    const m = src.clone();
    m.roughness = 0.55; m.metalness = 0.1;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTint = uTint; sh.uniforms.uGlow = uGlow;
      sh.fragmentShader = 'uniform vec3 uTint;uniform float uGlow;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          float mnLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          float mnMask = smoothstep(0.012, 0.09, diffuseColor.b - diffuseColor.r);
          float mnGlowMask = mnMask * smoothstep(0.06, 0.4, mnLum);
          diffuseColor.rgb = mix(diffuseColor.rgb, uTint * (0.18 + 1.9 * mnLum), mnMask);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += uTint * mnGlowMask * (0.25 + 2.2 * mnLum) * uGlow;`);
    };
    return m;
  };
  // Round 9a: the owner-approved mine, built in code (port of the Game Editor's buildMineModel).
  const crystalMats: THREE.MeshStandardMaterial[] = [];
  const built = buildMineModel(crystalMats);
  const nb = new THREE.Box3().setFromObject(built);
  const nh = nb.max.y - nb.min.y;
  const sy = MINE_HEIGHT / nh;
  built.scale.setScalar(sy);
  built.position.set(-((nb.max.x + nb.min.x) / 2) * sy, -nb.min.y * sy, -((nb.max.z + nb.min.z) / 2) * sy);
  built.traverse((o: any) => { if (o.isMesh) o.castShadow = !low; });
  group.userData.mineModel = 'code-built';
  crystals.add(built);
  const glowSpr = built.getObjectByName('mine-glow') as THREE.Sprite | undefined;
  {
    const bb = new THREE.Box3().setFromObject(crystals);
    group.userData.mineHeight = bb.max.y - bb.min.y;
    group.userData.mineFootprint = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
  }
  group.add(crystals);
  // Round 11 (R10.10): no ring; a flat glow-and-rubble decal lies on the ground under the mine, tinted by owner.
  const decalMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
  const decal = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), decalMat);
  decal.name = 'mine-decal'; decal.rotation.x = -Math.PI / 2; decal.position.y = 0.012; decal.renderOrder = 1;
  group.add(decal);
  let light: THREE.PointLight | null = null, beam: THREE.Mesh | null = null, sparks: THREE.Points | null = null;
  if (!low) {
    light = new THREE.PointLight(0xffffff, 7, 7.5, 1.4);
    light.position.y = 1.0;
    group.add(light);
    beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 2.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 1.5;
    group.add(beam);
    const pts = new Float32Array(36);
    for (let i = 0; i < 12; i++) { pts[i * 3] = Math.sin(i * 7 + idx) * 0.5; pts[i * 3 + 1] = 0.2 + (i % 6) * 0.3; pts[i * 3 + 2] = Math.cos(i * 5 + idx) * 0.5; }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(sparks);
  }
  let burstT = 0;
  return {
    group, mats, light, beam, sparks, crystals,
    recolor(hex) {
      uTint.value.set(hex as any);
      for (const m of crystalMats) { m.color.set(hex as any).lerp(new THREE.Color(0xffffff), 0.25); m.emissive.set(hex as any).multiplyScalar(0.55); }
      glowSpr?.material.color.set(hex as any);
      decalMat.color.set(hex as any); group.userData.decalHex = '#' + new THREE.Color(hex as any).getHexString();
      group.userData.tintHex = '#' + new THREE.Color(hex as any).getHexString();
      light?.color.set(hex as any);
      (beam?.material as THREE.MeshBasicMaterial | undefined)?.color.set(hex as any);
      (sparks?.material as THREE.PointsMaterial | undefined)?.color.set(hex as any);
    },
    setDecal(hex) { decalMat.color.set(hex as any); group.userData.decalHex = '#' + new THREE.Color(hex as any).getHexString(); },
    burst() { burstT = performance.now(); },
    update(now) {
      const w = now / 420 + idx;
      uGlow.value = 0.95 + Math.sin(w) * 0.18;
      for (const m of crystalMats) m.emissiveIntensity = 0.8 + Math.sin(w) * 0.2;
      if (glowSpr) glowSpr.material.opacity = 0.3 + Math.sin(w) * 0.08;
      if (sparks) { sparks.rotation.y = now / 2200 + idx; sparks.position.y = Math.sin(now / 900 + idx) * 0.06; }
      if (beam) (beam.material as THREE.MeshBasicMaterial).opacity = 0.05 + Math.sin(w * 0.7) * 0.02;
      if (burstT) {
        const k = Math.min(1, (now - burstT) / 700);
        // burst out, then regrow
        const s = k < 0.25 ? 1 + k * 2.4 : 0.35 + 0.65 * ((k - 0.25) / 0.75);
        crystals.scale.setScalar(Math.max(0.1, s));
        if (light) light.intensity = 7 + (k < 0.3 ? 20 * (1 - k / 0.3) : 0);
        if (k >= 1) { burstT = 0; crystals.scale.setScalar(1); }
      }
    },
  };
}

// ---------------------------------------------------------------- Goblin rig
interface Look {
  skin: number; helm?: string; extras?: string[]; scale?: number; belly?: number; eye?: number; armor?: number; cloth?: number;
}
const GREEN = 0x5d8f2f;
const LOOKS: Record<string, Look> = {
  'goblin-scrounger': { skin: 0x6a9a34, helm: 'lamp', extras: ['pouch', 'cloth'], cloth: 0x6a4e2a },
  'goblin-scrapper': { skin: 0x5a8a2a, helm: 'bottlecap', extras: ['pauldron', 'nails', 'scar'], armor: 0x7b6a58 },
  'goblin-slinger': { skin: 0x6e9a3a, helm: 'skull', extras: ['bandolier'], cloth: 0x4a3a28 },
  'goblin-bomber': { skin: 0x7aa23a, helm: 'goggles', extras: ['bombs', 'pauldron'], eye: 0xff5a20, armor: 0x5a4a3a },
  'goblin-sneak': { skin: 0x4e7a34, helm: 'hood', extras: ['cloth'], cloth: 0x2a2a3a, eye: 0xffe040 },
  'wolf-rider': { skin: 0x5a8a2a, helm: 'spike', extras: ['pauldron', 'wolf'], armor: 0x6a5a4a },
  'grubnaks-big-boss-troll': { skin: 0x6a7a4a, helm: 'horns', extras: ['pauldron', 'nails', 'belly', 'cloth'], scale: 1.4, belly: 1.4, armor: 0x5a5560, cloth: 0x6a2a8a },
  'shard-guzzler': { skin: 0x7aa23a, helm: 'none', extras: ['belly', 'gembelly'], belly: 1.9, cloth: 0x4a3a28 },
  'goblin-grunt': { skin: 0x5a8a2a, helm: 'bucket', extras: ['pauldron'], armor: 0x6a6a72 },
  'goblin-pebbler': { skin: 0x6a9a34, helm: 'bone', extras: ['bones'], cloth: 0x5a4a3a },
  'goblin-smith-miner': { skin: 0x5a8a2a, helm: 'goggles', extras: ['apron', 'pouch'], cloth: 0x3a2a22 },
  'rotgut-grenadier': { skin: 0x70a038, helm: 'goggles', extras: ['bandolier', 'bombs'], cloth: 0x4a3a28 },
  'shiv-rat': { skin: 0x6a8a44, helm: 'hood', extras: ['cloth'], cloth: 0x3a3a30, scale: 0.9 },
  'skullbasher-rusher': { skin: 0x5a8a2a, helm: 'skullhelm', extras: ['pauldron', 'nails'], armor: 0x72665a },
  'junk-shaman': { skin: 0x6a9a34, helm: 'can', extras: ['robe', 'bones'], cloth: 0x4a3a58, eye: 0x66ffcc },
  'blastrat-sapper': { skin: 0x7aa23a, helm: 'goggles', extras: ['keg'], cloth: 0x4a3a28, eye: 0xff5a20 },
};

export interface GoblinFig {
  group: THREE.Group;
  mats: Mats;
  parts: { armL: THREE.Group; armR: THREE.Group; legL: THREE.Mesh; legR: THREE.Mesh; head: THREE.Group; body: THREE.Group; weapon: THREE.Group; aura: THREE.Mesh | null };
  baseScale: number;
}

export function makeGoblin(cardId: string, card: any, weaponBuild: (g: THREE.Group) => void, low: boolean): GoblinFig {
  const look = LOOKS[cardId] || { skin: GREEN };
  const mats: Mats = { list: [] };
  const root = new THREE.Group();
  const skin = newMat(mats, look.skin, { roughness: 0.55 });
  const dark = newMat(mats, 0x2a2420, { roughness: 0.9 });
  const metal = newMat(mats, look.armor || 0x6a6a74, { metalness: 0.65, roughness: 0.42 });
  const rust = newMat(mats, 0x8a4a22, { metalness: 0.5, roughness: 0.75 });
  const leather = newMat(mats, look.cloth || 0x5a4630, { roughness: 0.85 });
  const bone = newMat(mats, 0xe4dcc4, { roughness: 0.6 });
  const eyeM = new THREE.MeshBasicMaterial({ color: look.eye || 0xffe94a });
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const hasBelly = look.belly || 1;

  const body = new THREE.Group();
  body.position.y = 0.33;
  root.add(body);
  // hunched torso
  const torso = add(body, new THREE.SphereGeometry(0.2, 12, 10), skin, 0, 0.12, 0);
  torso.scale.set(0.95 * Math.sqrt(hasBelly), 1.2, 0.85 * Math.sqrt(hasBelly));
  torso.rotation.x = 0.3;
  const chest = new THREE.Group();
  body.add(chest);
  // legs
  const legL = add(root, new THREE.CylinderGeometry(0.06, 0.07, 0.26, 7), skin, -0.1, 0.13, 0);
  const legR = add(root, new THREE.CylinderGeometry(0.06, 0.07, 0.26, 7), skin, 0.1, 0.13, 0);
  for (const x of [-0.1, 0.1]) add(root, new THREE.BoxGeometry(0.13, 0.05, 0.2), dark, x, 0.03, 0.04);
  // head
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.1);
  body.add(head);
  const skull = add(head, new THREE.SphereGeometry(0.17, 12, 10), skin);
  skull.scale.set(1.1, 0.95, 1);
  add(head, new THREE.SphereGeometry(0.05, 8, 6), skin, 0, -0.02, 0.17).scale.set(1.2, 1, 1); // nose
  for (const s of [-1, 1]) {
    const ear = add(head, new THREE.ConeGeometry(0.07, 0.34, 5), skin, s * 0.22, 0.02, -0.02);
    ear.rotation.z = -s * 1.35; ear.rotation.y = s * 0.3;
    add(head, new THREE.SphereGeometry(0.035, 6, 5), eyeM, s * 0.075, 0.04, 0.145);
    const brow = add(head, new THREE.BoxGeometry(0.1, 0.025, 0.04), dark, s * 0.075, 0.1, 0.15);
    brow.rotation.z = s * 0.35;
  }
  add(head, new THREE.BoxGeometry(0.17, 0.045, 0.04), dark, 0, -0.09, 0.15); // grin
  if (!low) for (let i = 0; i < 4; i++) { const t = add(head, new THREE.ConeGeometry(0.014, 0.04, 4), bone, -0.06 + i * 0.04, -0.075, 0.17); t.rotation.x = Math.PI; }
  // helmets / heads
  const ex = look.extras || [];
  switch (look.helm) {
    case 'bucket': add(head, new THREE.CylinderGeometry(0.15, 0.19, 0.2, 10), metal, 0, 0.16, 0); break;
    case 'bottlecap': { const c = add(head, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), rust, 0, 0.16, 0.0); c.scale.set(1, 1, 1); add(head, new THREE.SphereGeometry(0.15, 10, 6, 0, 6.3, 0, 1.3), metal, 0, 0.08, 0); break; }
    case 'skull': add(head, new THREE.SphereGeometry(0.08, 8, 6), bone, 0, 0.22, 0.02); break;
    case 'skullhelm': { add(head, new THREE.SphereGeometry(0.19, 10, 8, 0, 6.3, 0, 1.6), bone, 0, 0.03, 0); for (const s of [-1, 1]) { const h = add(head, new THREE.ConeGeometry(0.04, 0.16, 5), bone, s * 0.12, 0.22, 0); h.rotation.z = -s * 0.5; } break; }
    case 'horns': { add(head, new THREE.SphereGeometry(0.19, 10, 8, 0, 6.3, 0, 1.3), metal, 0, 0.03, 0); for (const s of [-1, 1]) { const h = add(head, new THREE.ConeGeometry(0.05, 0.28, 6), bone, s * 0.17, 0.2, 0); h.rotation.z = -s * 0.7; } break; }
    case 'spike': { add(head, new THREE.SphereGeometry(0.19, 10, 8, 0, 6.3, 0, 1.3), metal, 0, 0.03, 0); add(head, new THREE.ConeGeometry(0.04, 0.22, 5), metal, 0, 0.26, 0); break; }
    case 'goggles': for (const s of [-1, 1]) { const l = add(head, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), newMat(mats, 0x8acaff, glow(0x4aa0ff, 0.6)), s * 0.075, 0.14, 0.12); l.rotation.x = Math.PI / 2 - 0.4; } add(head, new THREE.TorusGeometry(0.17, 0.018, 5, 14), leather, 0, 0.1, 0).rotation.x = Math.PI / 2; break;
    case 'hood': { const hd = add(head, new THREE.ConeGeometry(0.22, 0.3, 8), leather, 0, 0.14, -0.03); hd.rotation.x = -0.15; break; }
    case 'lamp': { add(head, new THREE.SphereGeometry(0.14, 10, 6, 0, 6.3, 0, 1.2), leather, 0, 0.06, 0); add(head, new THREE.SphereGeometry(0.05, 8, 6), newMat(mats, 0xfff0a0, glow(0xffd060, 1.8)), 0, 0.14, 0.15); break; }
    case 'bone': add(head, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), bone, 0, 0.2, 0).rotation.z = Math.PI / 2; break;
    case 'can': add(head, new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10), newMat(mats, 0x9aa0a8, { metalness: 0.7, roughness: 0.4 }), 0, 0.22, 0); break;
    default: break;
  }
  // arms (pivot at shoulders)
  const armOf = (s: number) => {
    const a = new THREE.Group();
    a.position.set(s * 0.22, 0.15, 0.02);
    body.add(a);
    const upper = add(a, new THREE.CylinderGeometry(0.04, 0.035, 0.36, 6), skin, 0, -0.17, 0.04);
    upper.rotation.x = -0.2;
    add(a, new THREE.SphereGeometry(0.065, 8, 6), skin, 0, -0.36, 0.08); // big hand
    return a;
  };
  const armL = armOf(-1), armR = armOf(1);
  // clothing + armor extras
  if (ex.includes('cloth') || look.cloth) { const t = add(body, new THREE.CylinderGeometry(0.2, 0.23, 0.2, 9), leather, 0, 0.0, 0); t.scale.set(1.1, 1, 0.9); }
  if (ex.includes('pauldron')) for (const s of [-1, 1]) { const p = add(body, new THREE.SphereGeometry(0.12, 8, 6, 0, 6.3, 0, 1.4), metal, s * 0.24, 0.22, 0); p.rotation.z = -s * 0.3; if (!low) add(body, new THREE.ConeGeometry(0.03, 0.12, 5), metal, s * 0.28, 0.33, 0); }
  if (ex.includes('nails') && !low) for (let i = 0; i < 6; i++) { const n = add(body, new THREE.ConeGeometry(0.015, 0.07, 4), rust, -0.1 + (i % 3) * 0.1, 0.08 + Math.floor(i / 3) * 0.1, 0.17); n.rotation.x = Math.PI / 2; }
  if (ex.includes('bandolier')) { const b = add(body, new THREE.TorusGeometry(0.2, 0.02, 4, 12), leather, 0, 0.1, 0.02); b.rotation.set(1.2, 0.2, 0.9); }
  if (ex.includes('bombs')) for (let i = 0; i < 3; i++) add(body, new THREE.SphereGeometry(0.055, 8, 6), newMat(mats, 0x2a2a30, { metalness: 0.5 }), -0.1 + i * 0.1, -0.05, 0.2);
  if (ex.includes('apron')) add(body, new THREE.BoxGeometry(0.24, 0.3, 0.03), leather, 0, 0.0, 0.19);
  if (ex.includes('robe')) { const r = add(root, new THREE.ConeGeometry(0.28, 0.5, 9, 1, true), leather, 0, 0.3, 0); (r.material as THREE.Material).side = THREE.DoubleSide; }
  if (ex.includes('pouch')) add(body, new THREE.SphereGeometry(0.07, 7, 6), leather, 0.17, -0.05, 0.15);
  if (ex.includes('bones') && !low) for (let i = 0; i < 4; i++) add(body, new THREE.CylinderGeometry(0.014, 0.014, 0.08, 5), bone, -0.1 + i * 0.07, 0.2, 0.17).rotation.z = 0.5;
  if (ex.includes('keg')) { const k = add(root, new THREE.CylinderGeometry(0.15, 0.15, 0.25, 10), newMat(mats, 0x7a4a22, { roughness: 0.8 }), 0, 0.4, 0.26); k.rotation.x = 0.1; add(root, new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4), dark, 0, 0.6, 0.26); add(root, new THREE.SphereGeometry(0.03, 6, 4), newMat(mats, 0xffa030, glow(0xff8010, 2.2)), 0, 0.67, 0.26); }
  if (ex.includes('belly') && look.belly && look.belly > 1.5) add(body, new THREE.SphereGeometry(0.12, 8, 6), leather, 0, -0.05, 0.2);
  if (ex.includes('gembelly')) add(body, new THREE.OctahedronGeometry(0.1, 0), newMat(mats, 0x58ffa0, glow(0x28e070, 2.2)), 0, 0.03, 0.26);
  if (ex.includes('wolf')) {
    const wolf = new THREE.Group();
    const wm = newMat(mats, 0x5a5560, { roughness: 0.95 });
    const wb = add(wolf, new THREE.SphereGeometry(0.2, 10, 8), wm, 0, 0.3, -0.05); wb.scale.set(0.8, 0.8, 1.7);
    add(wolf, new THREE.SphereGeometry(0.1, 8, 6), wm, 0, 0.36, 0.38).scale.set(1, 0.9, 1.3);
    for (const s of [-1, 1]) { add(wolf, new THREE.ConeGeometry(0.04, 0.1, 4), wm, s * 0.06, 0.47, 0.34); for (const z of [-0.25, 0.2]) add(wolf, new THREE.CylinderGeometry(0.035, 0.03, 0.26, 5), wm, s * 0.1, 0.13, z); }
    add(wolf, new THREE.ConeGeometry(0.05, 0.28, 5), wm, 0, 0.35, -0.38).rotation.x = -2;
    root.add(wolf);
    body.position.y += 0.22; legL.visible = legR.visible = false;
  }
  // weapon on its own pivot so it can swing
  const weapon = new THREE.Group();
  const wInner = new THREE.Group();
  weapon.position.set(0, 0.6, 0.1);
  wInner.position.set(0, -0.6, -0.1);
  weapon.add(wInner);
  weaponBuild(wInner);
  root.add(weapon);

  // size by rarity
  const r = card.rarity;
  let scale = look.scale || 1;
  scale *= r === 'Collector' ? 1.25 : r === 'Ultra Rare' ? 1.15 : r === 'Rare' ? 1.06 : 1;
  const fig: GoblinFig = { group: root, mats, parts: { armL, armR, legL, legR, head, body, weapon, aura: null }, baseScale: scale };
  if (r === 'Ultra Rare' || r === 'Collector') {
    const aura = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.02;
    root.add(aura);
    fig.parts.aura = aura;
  }
  root.scale.setScalar(scale);
  return fig;
}

/** Gold pips and shinier armor for upgraded creatures. */
export function setUpgrades(fig: { group: THREE.Group; mats: Mats }, n: number) {
  const old = fig.group.getObjectByName('pips');
  if (old) fig.group.remove(old);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd45a, emissive: 0xaa7a10, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.25 });
  const g = new THREE.Group();
  g.name = 'pips';
  for (let i = 0; i < Math.min(5, n); i++) {
    const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), gold);
    p.position.set(-0.12 + i * 0.06, 0.62, 0.2);
    g.add(p);
  }
  if (n > 0) fig.group.add(g);
  fig.mats.list.forEach((m) => { if (m.metalness > 0.4) m.metalness = n > 0 ? 0.9 : 0.65; });
}

// ---------------------------------------------------------------- Strongholds
export interface StrongholdArt { group: THREE.Group; gem: THREE.Mesh; gemMat: THREE.MeshStandardMaterial; flags: THREE.Mesh[]; crown: THREE.Group; mats: Mats }

export function makeStronghold(faction: string, low: boolean): StrongholdArt {
  const mats: Mats = { list: [] };
  const g = new THREE.Group();
  const stone = newMat(mats, 0x3a3640, { roughness: 0.9 });
  const stone2 = newMat(mats, 0x2a2730, { roughness: 0.95 });
  const gold = newMat(mats, 0xd8aa3a, { metalness: 0.85, roughness: 0.3 });
  const gemHex = faction === 'goblins' ? 0x40ff80 : faction === 'gnomes' ? 0x48a8ff : 0xb860ff;
  const gemMat = newMat(mats, gemHex, glow(gemHex, 1.8));
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  // stacked stone with a flared base
  add(new THREE.CylinderGeometry(0.5, 0.62, 0.3, 10), stone2, 0, 0.15, 0);
  add(new THREE.CylinderGeometry(0.44, 0.5, 0.32, 10), stone, 0, 0.45, 0);
  add(new THREE.CylinderGeometry(0.5, 0.44, 0.1, 10), gold, 0, 0.66, 0);
  // crenellations
  const n = low ? 6 : 10;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const c = add(new THREE.BoxGeometry(0.11, 0.14, 0.11), stone, Math.cos(a) * 0.46, 0.78, Math.sin(a) * 0.46); c.rotation.y = -a; }
  // spikes
  for (let i = 0; i < (low ? 4 : 8); i++) { const a = (i / (low ? 4 : 8)) * Math.PI * 2 + 0.2; const s = add(new THREE.ConeGeometry(0.045, 0.28, 5), gold, Math.cos(a) * 0.6, 0.3, Math.sin(a) * 0.6); s.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
  const gem = add(new THREE.OctahedronGeometry(0.11, 0), gemMat, 0, 0.46, 0.46);
  gem.scale.y = 1.4;
  add(new THREE.TorusGeometry(0.13, 0.025, 5, 10), gold, 0, 0.46, 0.45);
  // banners
  const flags: THREE.Mesh[] = [];
  const bannerCol = gemHex === 0x40ff80 ? 0x2c8a40 : gemHex === 0x48a8ff ? 0x2860a8 : 0x6a30a8;
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.55, 5), gold, s * 0.42, 0.95, 0.1);
    const f = add(new THREE.PlaneGeometry(0.2, 0.34), newMat(mats, bannerCol, { side: THREE.DoubleSide, roughness: 0.9 }), s * 0.42, 0.95, 0.1);
    f.position.x += s * 0.1;
    flags.push(f);
  }
  const crown = new THREE.Group();
  g.add(crown);
  // faction flavor
  if (faction === 'goblins') {
    const scrap = newMat(mats, 0x6a4a2a, { roughness: 0.8 });
    for (let i = 0; i < 3; i++) { const p = add(new THREE.BoxGeometry(0.22, 0.04, 0.3), scrap, -0.3 + i * 0.06, 0.38 + i * 0.1, 0.35); p.rotation.set(0.2, 0.3 * i, 0.4 - i * 0.3); }
    for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.05, 0.3 + i * 0.05, 4), newMat(mats, 0x7a7a80, { metalness: 0.6 }), -0.3 + i * 0.2, 0.95, -0.38).rotation.z = (i - 1.5) * 0.15;
  } else if (faction === 'gnomes') {
    for (const [x, sz] of [[-0.18, 1], [0.18, 0.7]] as [number, number][]) { const gear = add(new THREE.TorusGeometry(0.11 * sz, 0.035, 5, 8), gold, x, 0.95, -0.36); gear.rotation.y = 0.2; }
    const tele = add(new THREE.CylinderGeometry(0.04, 0.06, 0.4, 7), newMat(mats, 0xb88a30, { metalness: 0.8, roughness: 0.35 }), 0.28, 1.0, -0.3); tele.rotation.set(0.6, 0, -0.4);
    add(new THREE.TorusGeometry(0.1, 0.02, 5, 10), newMat(mats, 0x7ad0ff, glow(0x40a0ff, 2.2)), -0.28, 0.9, -0.32);
  } else {
    const iron = newMat(mats, 0x44444c, { metalness: 0.7, roughness: 0.5 });
    add(new THREE.BoxGeometry(0.26, 0.28, 0.06), iron, 0, 0.3, 0.46);
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.06, 0.04, 0.12, 6), iron, s * 0.34, 0.9, -0.3); add(new THREE.SphereGeometry(0.06, 6, 5), newMat(mats, 0xc080ff, glow(0xa050ff, 2.4)), s * 0.34, 1.0, -0.3); }
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.06, 0.06, 0.02), newMat(mats, 0xc080ff, glow(0xa050ff, 1.2)), -0.18 + i * 0.18, 0.55, 0.45);
  }
  return { group: g, gem, gemMat, flags, crown, mats };
}

// ---------------------------------------------------------------- Grubnak
export interface GrubnakArt { group: THREE.Group; head: THREE.Group; armL: THREE.Group; armR: THREE.Group; torso: THREE.Group; mouth: THREE.Mesh }

/** Grubnak Rotgut: green goblin king, gold crown with purple gems, fur-trimmed purple cape, gold chain, purple-and-gold armor. */
export function makeGrubnak(low: boolean): GrubnakArt {
  const mats: Mats = { list: [] };
  const g = new THREE.Group();
  const skin = newMat(mats, 0x6aa835, { roughness: 0.5 });
  const purple = newMat(mats, 0x5a2a8a, { roughness: 0.8 });
  const fur = newMat(mats, 0xcfc4a8, { roughness: 1 });
  const gold = newMat(mats, 0xe0b040, { metalness: 0.9, roughness: 0.28 });
  const gem = newMat(mats, 0xc060ff, glow(0xa040ff, 1.8));
  const dark = newMat(mats, 0x241a1a, { roughness: 0.9 });
  const white = newMat(mats, 0xf4f0e0);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xfff060 });
  const add = (p: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); p.add(o); return o; };
  const torso = new THREE.Group();
  torso.position.y = 0.72;
  g.add(torso);
  const chest = add(torso, new THREE.SphereGeometry(0.3, 12, 10), purple, 0, 0, 0);
  chest.scale.set(1.15, 0.95, 0.85);
  add(torso, new THREE.SphereGeometry(0.22, 10, 8), gold, 0, 0.02, 0.12).scale.set(1.1, 0.8, 0.6); // gold breastplate
  const chain = add(torso, new THREE.TorusGeometry(0.2, 0.018, 5, 14), gold, 0, 0.12, 0.12); chain.rotation.x = 1.3;
  add(torso, new THREE.OctahedronGeometry(0.06, 0), gem, 0, 0.0, 0.27);
  // cape
  const cape = add(torso, new THREE.ConeGeometry(0.4, 0.7, 8, 1, true), purple, 0, -0.08, -0.14);
  (cape.material as THREE.Material).side = THREE.DoubleSide;
  add(torso, new THREE.TorusGeometry(0.3, 0.07, 6, 14, Math.PI * 1.4), fur, 0, 0.22, -0.05).rotation.set(1.5, 0, 0.2);
  for (const s of [-1, 1]) { const p = add(torso, new THREE.SphereGeometry(0.15, 8, 6, 0, 6.3, 0, 1.4), gold, s * 0.34, 0.2, 0); p.rotation.z = -s * 0.3; if (!low) add(torso, new THREE.ConeGeometry(0.04, 0.16, 5), gold, s * 0.4, 0.34, 0); }
  // head
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.06);
  torso.add(head);
  const skull = add(head, new THREE.SphereGeometry(0.2, 14, 12), skin);
  skull.scale.set(1.15, 1, 1.05);
  add(head, new THREE.SphereGeometry(0.06, 8, 6), skin, 0, -0.03, 0.2).scale.set(1.3, 1, 1);
  const mouth = add(head, new THREE.BoxGeometry(0.2, 0.09, 0.05), dark, 0, -0.11, 0.17); // shouting mouth
  for (let i = 0; i < 4; i++) { const t = add(head, new THREE.ConeGeometry(0.016, 0.05, 4), white, -0.07 + i * 0.047, -0.075, 0.19); t.rotation.x = Math.PI; }
  for (const s of [-1, 1]) {
    const ear = add(head, new THREE.ConeGeometry(0.08, 0.42, 5), skin, s * 0.28, 0.04, -0.02);
    ear.rotation.z = -s * 1.3; ear.rotation.y = s * 0.3;
    add(head, new THREE.SphereGeometry(0.04, 6, 5), eyeM, s * 0.09, 0.05, 0.17);
    add(head, new THREE.BoxGeometry(0.13, 0.03, 0.04), dark, s * 0.09, 0.115, 0.18).rotation.z = s * 0.45; // furious brow
  }
  // crown
  add(head, new THREE.CylinderGeometry(0.18, 0.2, 0.08, 10), gold, 0, 0.2, 0);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(head, new THREE.ConeGeometry(0.035, 0.14, 4), gold, Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17); add(head, new THREE.OctahedronGeometry(0.03, 0), gem, Math.cos(a) * 0.18, 0.2, Math.sin(a) * 0.18); }
  // arms
  const armOf = (s: number) => {
    const a = new THREE.Group();
    a.position.set(s * 0.38, 0.1, 0.02);
    torso.add(a);
    add(a, new THREE.CylinderGeometry(0.06, 0.05, 0.4, 7), skin, s * 0.04, -0.2, 0.05).rotation.z = s * 0.15;
    add(a, new THREE.SphereGeometry(0.09, 8, 6), skin, s * 0.08, -0.42, 0.08);
    add(a, new THREE.CylinderGeometry(0.07, 0.07, 0.1, 7), gold, s * 0.05, -0.28, 0.05);
    return a;
  };
  const armL = armOf(-1), armR = armOf(1);
  return { group: g, head, armL, armR, torso, mouth };
}

/** Rocket barrel with a gold skull emblem and flame trail, for Grubnak's retreat. */
export function makeRocketBarrel() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: 0.9, roughness: 0.3 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 12), wood);
  barrel.rotation.x = Math.PI / 2;
  g.add(barrel);
  for (const z of [-0.2, 0.2]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.025, 5, 14), gold); band.position.z = z; g.add(band); }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), gold); skull.position.set(0, 0.3, 0.05); g.add(skull);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 8), new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  flame.rotation.x = -Math.PI / 2; flame.position.z = -0.9; flame.name = 'flame';
  g.add(flame);
  return g;
}

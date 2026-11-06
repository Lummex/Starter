// Nov 6 (Ken: "when they upgrade, they look like the card ... the energy ... aura ... around them"): an upgraded Commander's aura on the board.
// Enhanced = a soft glow and a glowing weapon; Overcharged = + crackling lightning in faction colours; Radiant = + halo, rune ring, sparks and orbiting
// crystals; Mythic = + the orange-and-cosmic blaze, flames and bursts of light. Settings: src/content/cmd-aura.json (the Model Editor previews the same file).
// Everything is additive light (no real lights, no post-processing); Graphics: Low uses fewer particles and arcs.
import * as THREE from 'three';
import auraJson from '../content/cmd-aura.json';

export const AURA = auraJson as any;
export const TIER_NAMES = ['', 'Original', 'Enhanced', 'Overcharged', 'Radiant', 'Mythic'];

export interface CommanderAura {
  group: THREE.Group;
  tier: number;
  update(dt: number, camera: THREE.Camera): void;
  dispose(): void;
  /** test hook: what is showing */
  info(): any;
}
export interface AuraOpts { id: string; faction: string; tier: number; low: boolean; host: THREE.Object3D; char: THREE.Object3D; weapon?: THREE.Object3D | null }

// ------------------------------------------------------------------ textures (drawn once; Brush's painted sprites replace them when listed in the json)
const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, size: number, draw: (x: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  let t = texCache.get(key);
  if (t) return t;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d')!;
  draw(x, size);
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  const f = brushFile(key);
  if (f) new THREE.TextureLoader().load(AURA.sprites.dir + f, (bt) => { t!.image = blackToAlpha(bt.image as HTMLImageElement); t!.needsUpdate = true; }, undefined, () => { /* keep the drawn one */ });
  return t;
}
/** a sprite painted on black -> see-through: alpha = its brightest channel, colour un-darkened to match */
function blackToAlpha(img: HTMLImageElement): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const x = cv.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, cv.width, cv.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const m = Math.max(a[i], a[i + 1], a[i + 2]); if (m < 3) { a[i + 3] = 0; continue; } const k = 255 / m; a[i] = Math.min(255, a[i] * k); a[i + 1] = Math.min(255, a[i + 1] * k); a[i + 2] = Math.min(255, a[i + 2] * k); a[i + 3] = m; }
  x.putImageData(d, 0, 0);
  return cv;
}
function brushFile(key: string): string | null { const files: string[] = AURA.sprites?.files || []; return files.find((f) => f.replace(/\.\w+$/, '') === key) || null; }

const glowTex = () => canvasTex('glow', 128, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
const sparkTex = () => canvasTex('spark', 64, (x, s) => {
  const c = s / 2, g = x.createRadialGradient(c, c, 0, c, c, c * 0.5); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s);
  x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineCap = 'round';
  for (const [w, l] of [[3, 0.95], [1.5, 0.6]] as const) { x.lineWidth = w; x.beginPath(); x.moveTo(c - c * l, c); x.lineTo(c + c * l, c); x.moveTo(c, c - c * l); x.lineTo(c, c + c * l); x.stroke(); }
});
const boltTex = () => canvasTex('bolt', 64, (x, s) => { const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(0.65, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
const ringTex = () => canvasTex('ring', 256, (x, s) => { const c = s / 2; for (const [r, w, a] of [[0.44, 10, 0.25], [0.44, 4, 0.9], [0.36, 2, 0.4]] as const) { x.strokeStyle = `rgba(255,255,255,${a})`; x.lineWidth = w; x.shadowColor = '#fff'; x.shadowBlur = 12; x.beginPath(); x.arc(c, c, s * r, 0, Math.PI * 2); x.stroke(); } });

/** the halo behind the head, drawn in the look's colours: crown (Grubnak), rune (Knobbin), gear (Borgo) */
function haloTex(kind: string, look: any, variant = ''): THREE.Texture {
  return canvasTex((kind === 'crown' ? 'grubnak-halo' : kind === 'gear' ? 'borgo-halo' : 'sproingle-halo') + variant, 512, (x, s) => {
    const c = s / 2, R = s * 0.36;
    const glowLine = (col: string, w: number, blur: number, path: () => void) => { x.save(); x.strokeStyle = col; x.lineWidth = w; x.shadowColor = col; x.shadowBlur = blur; x.lineJoin = 'round'; x.lineCap = 'round'; path(); x.stroke(); x.restore(); };
    const ring = (r: number) => () => { x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); };
    if (kind === 'gear') {
      const teeth = 12, gear = (r0: number, r1: number) => () => { x.beginPath(); for (let i = 0; i < teeth; i++) { const a0 = (i / teeth) * Math.PI * 2, d = (Math.PI * 2) / teeth; const pts: [number, number][] = [[a0, r0], [a0 + d * 0.18, r1], [a0 + d * 0.5, r1], [a0 + d * 0.68, r0]]; pts.forEach(([a, r], k) => { const px = c + Math.cos(a) * r, py = c + Math.sin(a) * r; if (i === 0 && k === 0) x.moveTo(px, py); else x.lineTo(px, py); }); } x.closePath(); };
      glowLine(look.main, 14, 30, gear(R * 1.02, R * 1.2)); glowLine(look.hi, 4, 8, gear(R * 1.02, R * 1.2));
      glowLine(look.main, 10, 24, ring(R * 0.74)); glowLine(look.hi, 3, 6, ring(R * 0.74));
      x.save(); x.fillStyle = look.hi; x.shadowColor = look.main; x.shadowBlur = 14; x.font = `bold ${Math.round(s * 0.06)}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.26; x.save(); x.translate(c + Math.cos(a) * R * 0.9, c + Math.sin(a) * R * 0.9); x.rotate(a + Math.PI / 2); x.fillText(RUNES[i], 0, 0); x.restore(); } x.restore();
    } else if (kind === 'crown') {
      glowLine(look.main, 16, 34, ring(R)); glowLine(look.hi, 5, 8, ring(R));
      for (let i = 0; i < 8; i++) { // gold crowns and green crystal shards around the ring
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2; x.save(); x.translate(c + Math.cos(a) * R * 1.12, c + Math.sin(a) * R * 1.12); x.rotate(a + Math.PI / 2);
        if (i % 2 === 0) { const w = s * 0.07, h = s * 0.05; x.beginPath(); x.moveTo(-w, h); x.lineTo(-w, -h * 0.4); x.lineTo(-w * 0.5, h * 0.1); x.lineTo(0, -h); x.lineTo(w * 0.5, h * 0.1); x.lineTo(w, -h * 0.4); x.lineTo(w, h); x.closePath(); x.fillStyle = '#ffd34d'; x.shadowColor = look.main; x.shadowBlur = 18; x.fill(); x.lineWidth = 2; x.strokeStyle = look.hi; x.stroke(); }
        else { const w = s * 0.026, h = s * 0.075; x.beginPath(); x.moveTo(0, -h); x.lineTo(w, 0); x.lineTo(0, h * 0.6); x.lineTo(-w, 0); x.closePath(); x.fillStyle = look.main; x.shadowColor = look.main; x.shadowBlur = 22; x.fill(); x.strokeStyle = look.hi; x.lineWidth = 2; x.stroke(); }
        x.restore();
      }
    } else {
      glowLine(look.main, 12, 30, ring(R * 1.08)); glowLine('#f2f6ff', 4, 6, ring(R * 1.08)); glowLine(look.main, 8, 18, ring(R * 0.86)); glowLine('#f2f6ff', 2.5, 4, ring(R * 0.86));
      for (let i = 0; i < 16; i++) { // diamond runes in the band, an eye at the top, four star points
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2; x.save(); x.translate(c + Math.cos(a) * R * 0.97, c + Math.sin(a) * R * 0.97); x.rotate(a);
        if (i === 0) { x.beginPath(); x.ellipse(0, 0, s * 0.032, s * 0.055, 0, 0, Math.PI * 2); x.strokeStyle = '#f2f6ff'; x.lineWidth = 3; x.shadowColor = look.main; x.shadowBlur = 16; x.stroke(); x.beginPath(); x.arc(0, 0, s * 0.014, 0, Math.PI * 2); x.fillStyle = look.main; x.fill(); }
        else if (i % 4 === 0) { x.beginPath(); x.moveTo(0, -s * 0.07); x.lineTo(s * 0.02, 0); x.lineTo(0, s * 0.07); x.lineTo(-s * 0.02, 0); x.closePath(); x.fillStyle = '#f2f6ff'; x.shadowColor = look.main; x.shadowBlur = 20; x.fill(); }
        else { const d = s * 0.016; x.strokeStyle = '#dfe8ff'; x.lineWidth = 2; x.shadowColor = look.main; x.shadowBlur = 10; x.strokeRect(-d, -d, d * 2, d * 2); }
        x.restore();
      }
    }
  });
}
const raysTex = () => canvasTex('mythic-rays', 256, (x, s) => {
  const c = s / 2; x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2 + Math.random() * 0.1, len = c * (i % 2 ? 0.55 : 0.95) * (0.8 + Math.random() * 0.2), w = c * 0.035;
    x.save(); x.translate(c, c); x.rotate(a); const g = x.createLinearGradient(0, 0, len, 0); g.addColorStop(0, 'rgba(255,255,240,0.95)'); g.addColorStop(0.5, 'rgba(255,214,90,0.5)'); g.addColorStop(1, 'rgba(255,150,30,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, -w); x.lineTo(len, 0); x.lineTo(0, w); x.closePath(); x.fill(); x.restore(); }
  const g = x.createRadialGradient(c, c, 0, c, c, c * 0.3); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,220,120,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s);
});
const blazeTex = () => canvasTex('mythic-blaze', 512, (x, s) => {
  const c = s / 2, m = AURA.mythic;
  const g = x.createRadialGradient(c, c, 0, c, c, c); g.addColorStop(0, 'rgba(255,246,220,1)'); g.addColorStop(0.18, m.gold); g.addColorStop(0.42, 'rgba(255,122,18,0.75)'); g.addColorStop(0.7, 'rgba(200,60,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) { // flame tongues licking outward
    const a = Math.random() * Math.PI * 2, len = s * (0.28 + Math.random() * 0.2), w = s * (0.02 + Math.random() * 0.035), bend = (Math.random() - 0.5) * 0.6;
    x.save(); x.translate(c, c); x.rotate(a);
    const fg = x.createLinearGradient(0, 0, len, 0); fg.addColorStop(0, 'rgba(255,220,120,0.5)'); fg.addColorStop(0.6, 'rgba(255,110,20,0.35)'); fg.addColorStop(1, 'rgba(255,60,0,0)');
    x.fillStyle = fg; x.beginPath(); x.moveTo(s * 0.08, -w); x.quadraticCurveTo(len * 0.6, -w + bend * len * 0.3, len, bend * len * 0.25); x.quadraticCurveTo(len * 0.6, w + bend * len * 0.3, s * 0.08, w); x.closePath(); x.fill(); x.restore();
  }
});
const cosmosTex = () => canvasTex('mythic-cosmos', 512, (x, s) => {
  const c = s / 2, m = AURA.mythic;
  const g = x.createRadialGradient(c, c, 0, c, c, c); g.addColorStop(0, 'rgba(255,220,255,0.9)'); g.addColorStop(0.15, 'rgba(200,90,255,0.6)'); g.addColorStop(0.55, 'rgba(90,60,220,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s); x.globalCompositeOperation = 'lighter';
  for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 260; i++) { // spiral arms of stars
    const t = i / 260, a = arm * (Math.PI * 2 / 3) + t * 5.5, r = s * 0.04 + t * s * 0.44, j = (Math.random() - 0.5) * s * 0.05 * (0.4 + t);
    const px = c + Math.cos(a) * r + j, py = c + Math.sin(a) * r + j, sz = Math.random() * 2.2 + 0.4;
    x.fillStyle = Math.random() < 0.5 ? m.cosmic : Math.random() < 0.5 ? m.cosmic2 : '#ffe6ff'; x.globalAlpha = (1 - t) * 0.9; x.beginPath(); x.arc(px, py, sz, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
});

// ------------------------------------------------------------------ helpers
/** additive light that leaves the canvas alpha alone: the board canvas is see-through over the painted arena, so plain additive blending
 *  would turn the dark parts of a sprite into dark boxes */
const LIGHT = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } as const;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const add = (col: THREE.ColorRepresentation, map: THREE.Texture, opacity = 1) => new THREE.SpriteMaterial({ map, color: col, transparent: true, opacity, ...LIGHT, depthWrite: false, toneMapped: false });
function flatMat(col: THREE.ColorRepresentation, map: THREE.Texture, opacity: number) { return new THREE.MeshBasicMaterial({ map, color: col, transparent: true, opacity, ...LIGHT, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); }

/** jagged lightning between two points (midpoint displacement), with an optional branch */
function bolt(a: THREE.Vector3, b: THREE.Vector3, rough: number, branch: number): THREE.Vector3[][] {
  let pts = [a.clone(), b.clone()];
  for (let lv = 0; lv < 4; lv++) {
    const next: THREE.Vector3[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], len = p.distanceTo(q);
      next.push(p.clone().lerp(q, 0.5).add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(len * rough)), q);
    }
    pts = next; rough *= 0.62;
  }
  const out = [pts];
  if (Math.random() < branch) { const k = 3 + Math.floor(Math.random() * (pts.length - 6)), from = pts[k], dir = b.clone().sub(a).multiplyScalar(0.45).add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(a.distanceTo(b) * 0.35)); out.push(bolt(from, from.clone().add(dir), 0.3, 0)[0]); }
  return out;
}

export function lookOf(id: string, faction: string): any {
  const L = AURA.looks;
  return L[id] || L[AURA.factionLook[faction]] || L.grubnak;
}

export function makeCommanderAura(o: AuraOpts): CommanderAura {
  const tier = Math.max(1, Math.min(5, Math.round(o.tier) || 1));
  const T = AURA.tiers[String(tier)] || null;
  const look = lookOf(o.id, o.faction), M = AURA.mythic, low = o.low;
  const mythic = tier >= 5;
  const group = new THREE.Group(); group.name = 'commander-aura';
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  // the body in the host's frame: feet, height, middle
  o.host.updateMatrixWorld(true);
  const wb = new THREE.Box3().setFromObject(o.char, true);
  const inv = new THREE.Matrix4().copy(o.host.matrixWorld).invert();
  const lb = wb.isEmpty() ? new THREE.Box3(new THREE.Vector3(-0.2, 0, -0.2), new THREE.Vector3(0.2, 1, 0.2)) : wb.clone().applyMatrix4(inv);
  const H = Math.max(0.05, lb.max.y - lb.min.y), base = lb.min.y, mid = lb.getCenter(new THREE.Vector3()), R = Math.max(lb.max.x - lb.min.x, lb.max.z - lb.min.z) * 0.42 + H * 0.06;
  const at = (y: number) => new THREE.Vector3(mid.x, base + y * H, mid.z);
  o.host.add(group);
  const layers: Record<string, number> = {};
  if (!T) return { group, tier, update() {}, dispose() { group.removeFromParent(); }, info: () => ({ tier, name: TIER_NAMES[tier], layers }) };
  const main = new THREE.Color(mythic ? M.fire : look.main), hi = new THREE.Color(mythic ? M.gold : look.hi);

  // materials the aura brightens (cloned so the other side's copy of the same Commander is not touched)
  const tint: { m: THREE.MeshStandardMaterial; k: number; col: THREE.Color; e0: THREE.Color; i0: number; weapon: boolean }[] = [];
  const restore: [any, any][] = [];
  const own = (root: THREE.Object3D | null | undefined, k: number, col: THREE.Color, weapon: boolean) => root?.traverse((m: any) => {
    if (!(m.isMesh || m.isSkinnedMesh) || !k) return;
    restore.push([m, m.material]);
    const one = (x: any) => { if (!x?.isMeshStandardMaterial) return x; const c = x.clone(); keep(c); tint.push({ m: c, k, col, e0: c.emissive.clone(), i0: c.emissiveIntensity, weapon }); if (weapon) c.emissiveMap = null; else if (!c.emissiveMap && c.map) c.emissiveMap = c.map; return c; };
    m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
  });
  own(o.weapon, T.weapon?.emissive || 0, mythic ? new THREE.Color(M.gold) : new THREE.Color(look.weapon || look.main), true);
  if (T.bodyTint) { const w = new Set<THREE.Object3D>(); o.weapon?.traverse((x) => w.add(x)); o.char.traverse((m: any) => { if (!w.has(m) && (m.isMesh || m.isSkinnedMesh)) own(m, T.bodyTint, mythic ? new THREE.Color(M.fire) : new THREE.Color(look.main), false); }); }

  // the body glow (behind him), the ground glow and the rune circle
  const glow = new THREE.Sprite(keep(add(main, glowTex(), T.glow.opacity))); glow.scale.setScalar(T.glow.size * H); glow.renderOrder = 2; group.add(glow); layers.glow = 1;
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(flatMat(main, glowTex(), T.ground.opacity))); ground.rotation.x = -Math.PI / 2; ground.position.copy(at(0.01)); ground.scale.setScalar(T.ground.size * H); ground.renderOrder = 2; group.add(ground); layers.ground = 1;
  let runes: THREE.Mesh | null = null;
  if (T.runes) { runes = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(flatMat('#ffffff', mythic ? haloTex(look.halo, { ...look, ...(look.mythicHalo || {}) }, '-mythic') : haloTex(look.halo, look), T.runes.opacity))); runes.rotation.x = -Math.PI / 2; runes.position.copy(at(0.02)); runes.scale.setScalar(T.runes.size * H); runes.renderOrder = 2; group.add(runes); layers.runes = 1; }
  // the glowing weapon (a light at its top end)
  const weaponGlow = new THREE.Sprite(keep(add(mythic ? M.gold : look.weapon || look.main, glowTex(), T.weapon.opacity)));
  const weaponCore = new THREE.Sprite(keep(add(mythic ? M.white : look.weaponHi || look.hi, glowTex(), T.weapon.opacity))); weaponCore.scale.setScalar(T.weapon.size * H * 0.35); weaponCore.renderOrder = 4; group.add(weaponCore);
  let rays: THREE.Sprite | null = null;
  if (T.weapon.rays) { rays = new THREE.Sprite(keep(add('#ffffff', raysTex(), 1))); rays.scale.setScalar(T.weapon.rays * H); rays.renderOrder = 4; group.add(rays); layers.rays = 1; } weaponGlow.scale.setScalar(T.weapon.size * H); weaponGlow.renderOrder = 4; group.add(weaponGlow); layers.weapon = o.weapon ? 1 : 0;
  const tipLocal = new THREE.Vector3(); let hasTip = false;
  if (o.weapon) { const b = new THREE.Box3().setFromObject(o.weapon, true); if (!b.isEmpty()) { tipLocal.set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2); o.weapon.worldToLocal(tipLocal); hasTip = true; } else { tipLocal.set(0, 0, 0); hasTip = true; } } // an empty marker = the tip itself (a staff built into the mesh)
  if (!hasTip) { weaponGlow.visible = false; weaponCore.visible = false; if (rays) rays.visible = false; }
  const head = o.char.getObjectByName('Head') || o.char.getObjectByName('head') || null;

  // the halo behind the head, and Mythic's blaze and cosmos behind him
  let halo: THREE.Sprite | null = null, blaze: THREE.Sprite | null = null, cosmos: THREE.Sprite | null = null;
  const HC = T.halo || (look.haloFrom && tier >= look.haloFrom ? AURA.haloEarly[String(tier)] : null);
  if (HC) { halo = new THREE.Sprite(keep(add('#ffffff', mythic ? haloTex(look.halo, { ...look, ...(look.mythicHalo || {}) }, '-mythic') : haloTex(look.halo, look), HC.opacity))); halo.scale.setScalar(HC.size * H); halo.renderOrder = 3; group.add(halo); layers.halo = 1; }
  if (T.blaze) { blaze = new THREE.Sprite(keep(add('#ffffff', blazeTex(), T.blaze.opacity))); blaze.scale.setScalar(T.blaze.size * H); blaze.renderOrder = 1; group.add(blaze); layers.blaze = 1; }
  if (T.cosmos) { cosmos = new THREE.Sprite(keep(add('#ffffff', cosmosTex(), T.cosmos.opacity))); cosmos.scale.setScalar(T.cosmos.size * H); cosmos.renderOrder = 0; group.add(cosmos); layers.cosmos = 1; }

  // orbiting crystal shards (Radiant, Mythic)
  const shards: { m: THREE.Mesh; a: number; y: number; s: number }[] = [];
  if (T.shards) {
    const n = low ? T.shards.countLow : T.shards.count, geo = keep(new THREE.OctahedronGeometry(1, 0)), mat = keep(new THREE.MeshBasicMaterial({ color: look.shard || look.main, transparent: true, opacity: 0.95, ...LIGHT, depthWrite: false, toneMapped: false }));
    const gm = keep(add(look.shard || look.main, glowTex(), 0.7));
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mat); m.scale.set(T.shards.size * H * 0.55, T.shards.size * H * 1.3, T.shards.size * H * 0.55); const gl = new THREE.Sprite(gm); gl.scale.setScalar(3.2); m.add(gl); group.add(m); shards.push({ m, a: (i / n) * Math.PI * 2, y: rnd(-0.06, 0.06), s: rnd(0.8, 1.2) }); }
    layers.shards = n;
  }

  // particles: sparks (Overcharged up) and Mythic's flames
  type P = { pts: THREE.Points; n: number; st: Float32Array; cfg: any; flame: boolean };
  const parts: P[] = [];
  const makePts = (cfg: any, flame: boolean, cols: THREE.Color[]) => {
    const n = low ? cfg.countLow : cfg.count, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), st = new Float32Array(n * 5);
    const geo = keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (let i = 0; i < n; i++) { st[i * 5] = Math.random() * Math.PI * 2; st[i * 5 + 1] = Math.random(); st[i * 5 + 2] = rnd(0.6, 1.4); st[i * 5 + 3] = rnd(0.5, 1); st[i * 5 + 4] = Math.floor(Math.random() * cols.length); }
    const mat = keep(new THREE.PointsMaterial({ map: flame ? glowTex() : sparkTex(), size: cfg.size * H, sizeAttenuation: true, vertexColors: true, transparent: true, ...LIGHT, depthWrite: false, toneMapped: false }));
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; group.add(pts);
    (pts.userData as any).cols = cols;
    parts.push({ pts, n, st, cfg, flame });
  };
  if (T.sparks) makePts(T.sparks, false, mythic ? [new THREE.Color(M.gold), new THREE.Color(M.white), new THREE.Color(look.main), new THREE.Color(M.cosmic)] : [new THREE.Color(look.main), new THREE.Color(look.hi), new THREE.Color(look.deep)]);
  if (T.flames) makePts(T.flames, true, [new THREE.Color(M.fire), new THREE.Color(M.gold), new THREE.Color('#ff4a0a')]);
  for (const p of parts) layers[p.flame ? 'flames' : 'sparks'] = p.n;

  // lightning: camera-facing ribbons (a wide coloured glow and a thin bright core), rebuilt as each arc dies
  type Arc = { lines: THREE.Vector3[][]; until: number; weapon: boolean; k: number };
  const arcs: Arc[] = [];
  let arcMeshes: { glow: THREE.Mesh; core: THREE.Mesh; max: number } | null = null;
  if (T.arcs) {
    const nBody = low ? T.arcs.countLow : T.arcs.count, nWeap = hasTip ? (low ? T.arcs.weaponArcsLow : T.arcs.weaponArcs) : 0;
    for (let i = 0; i < nBody + nWeap; i++) arcs.push({ lines: [], until: 0, weapon: i >= nBody, k: 1 });
    const max = (nBody + nWeap) * 2 * 17 * 6;
    const uv = new Float32Array(max * 2); for (let i = 0; i < max; i += 6) [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0].forEach((v, k) => (uv[i * 2 + k] = v)); // across the ribbon: v 0 .. 1
    const mk = (col: THREE.Color, op: number) => { const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setDrawRange(0, 0); const m = new THREE.Mesh(g, keep(new THREE.MeshBasicMaterial({ color: col, map: boltTex(), vertexColors: true, transparent: true, opacity: op, ...LIGHT, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))); m.frustumCulled = false; m.renderOrder = 6; group.add(m); return m; };
    arcMeshes = { glow: mk(new THREE.Color(look.main), 0.75), core: mk(new THREE.Color(look.hi), 1), max };
    layers.arcs = nBody; layers.weaponArcs = nWeap;
  }

  // Mythic bursts of light
  const bursts: { flash: THREE.Sprite; ring: THREE.Mesh; t: number }[] = [];
  let nextBurst = performance.now() + rnd(600, 1400), burstCount = 0;
  const burstMat = T.bursts ? { flash: add(M.white, glowTex(), 0), ring: flatMat(M.gold, ringTex(), 0) } : null;
  if (burstMat) { keep(burstMat.flash); keep(burstMat.ring); layers.bursts = 1; }

  const tmp = new THREE.Vector3(), cam = new THREE.Vector3(), away = new THREE.Vector3(), tip = new THREE.Vector3(), headP = new THREE.Vector3();
  let t = Math.random() * 10;
  const behind = (s: THREE.Object3D, p: THREE.Vector3, back: number) => { s.position.copy(p).addScaledVector(away, back * H); };

  function newArc(a: Arc, now: number) {
    const cfg = T.arcs; a.until = now + rnd(cfg.lifeMs[0], cfg.lifeMs[1]); a.k = rnd(0.7, 1.15);
    let p: THREE.Vector3, q: THREE.Vector3;
    if (a.weapon) { p = tip.clone(); q = tip.clone().add(new THREE.Vector3(rnd(-1, 1), rnd(-0.6, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.12, 0.3) * H)); }
    else {
      const th = Math.random() * Math.PI * 2, y = rnd(0.12, 0.98), r = R * rnd(0.9, 1.25);
      p = new THREE.Vector3(mid.x + Math.cos(th) * r, base + y * H, mid.z + Math.sin(th) * r);
      const th2 = th + rnd(0.5, 1.5) * (Math.random() < 0.5 ? -1 : 1), y2 = Math.min(1.05, Math.max(0.05, y + rnd(-0.3, 0.3) * cfg.reach * 1.6));
      q = new THREE.Vector3(mid.x + Math.cos(th2) * r * rnd(0.9, 1.2), base + y2 * H, mid.z + Math.sin(th2) * r * rnd(0.9, 1.2));
      if (hasTip && Math.random() < 0.25) q = tip.clone(); // now and then a bolt jumps to the weapon
    }
    a.lines = bolt(p, q, 0.28, cfg.branch);
  }
  function writeArcs(now: number) {
    if (!arcMeshes) return;
    const P = arcMeshes.glow.geometry.getAttribute('position') as THREE.BufferAttribute, C = arcMeshes.glow.geometry.getAttribute('color') as THREE.BufferAttribute;
    const P2 = arcMeshes.core.geometry.getAttribute('position') as THREE.BufferAttribute, C2 = arcMeshes.core.geometry.getAttribute('color') as THREE.BufferAttribute;
    let v = 0;
    const seg = (p: THREE.Vector3, q: THREE.Vector3, w: number, wc: number, k: number) => {
      if (v + 6 > arcMeshes!.max) return;
      const d = tmp.copy(q).sub(p), side = new THREE.Vector3().crossVectors(d, cam.clone().sub(p)).normalize();
      const quad = (PA: THREE.BufferAttribute, CA: THREE.BufferAttribute, ww: number) => { const s = side.clone().multiplyScalar(ww); const vs = [p.clone().sub(s), p.clone().add(s), q.clone().add(s), p.clone().sub(s), q.clone().add(s), q.clone().sub(s)]; vs.forEach((x, i) => { PA.setXYZ(v + i, x.x, x.y, x.z); CA.setXYZ(v + i, k, k, k); }); };
      quad(P, C, w); quad(P2, C2, wc); v += 6;
    };
    for (const a of arcs) {
      const life = Math.max(0, (a.until - now) / 120), k = Math.min(1, 0.35 + life) * a.k;
      a.lines.forEach((ln, bi) => { for (let i = 1; i < ln.length; i++) seg(ln[i - 1], ln[i], T.arcs.glowWidth * H * (bi ? 0.6 : 1), T.arcs.width * H * (bi ? 0.6 : 1), k * (bi ? 0.7 : 1)); });
    }
    for (const [PA, CA] of [[P, C], [P2, C2]] as const) { PA.needsUpdate = true; CA.needsUpdate = true; }
    arcMeshes.glow.geometry.setDrawRange(0, v); arcMeshes.core.geometry.setDrawRange(0, v);
  }

  function update(dt: number, camera: THREE.Camera) {
    t += dt;
    const now = performance.now();
    group.updateMatrixWorld();
    camera.getWorldPosition(cam); group.worldToLocal(cam);
    away.copy(mid).sub(cam).setY(0).normalize(); // from the camera through him: "behind" him on screen
    if (head) { head.getWorldPosition(headP); group.worldToLocal(headP); } else headP.copy(at(0.86));
    if (hasTip) { tip.copy(tipLocal); o.weapon!.localToWorld(tip); group.worldToLocal(tip); }
    const pulse = (hz: number) => 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * hz);
    // glow, ground, weapon
    behind(glow, at(T.glow.y), 0.3); glow.material.opacity = T.glow.opacity * (0.75 + 0.25 * pulse(T.glow.pulseHz)) * (arcs.length ? 0.9 + Math.random() * 0.15 : 1);
    (ground.material as THREE.MeshBasicMaterial).opacity = T.ground.opacity * (0.8 + 0.2 * pulse(T.glow.pulseHz));
    if (hasTip) { weaponGlow.position.copy(tip); weaponCore.position.copy(tip); const wp = pulse(T.weapon.pulseHz); weaponGlow.material.opacity = T.weapon.opacity * (0.7 + 0.3 * wp); weaponGlow.scale.setScalar(T.weapon.size * H * (0.9 + 0.2 * wp)); weaponCore.material.opacity = 0.8 + 0.2 * wp;
      if (rays) { rays.position.copy(tip); rays.material.rotation += dt * 0.35; rays.scale.setScalar(T.weapon.rays * H * (0.85 + 0.25 * wp + Math.random() * 0.05)); } }
    for (const x of tint) { const p = x.weapon ? pulse(T.weapon.pulseHz) : pulse(T.glow.pulseHz); x.m.emissive.copy(x.e0).lerp(x.col, Math.min(1, x.k * (0.75 + 0.25 * p) * (x.weapon ? 1 : 3))); x.m.emissiveIntensity = Math.max(x.i0, x.k * (0.8 + 0.4 * p) * (x.weapon ? 1.4 : 1)); }
    if (runes) runes.rotation.z += THREE.MathUtils.degToRad(T.runes.spinDegPerSec) * dt;
    if (halo && HC) { behind(halo, new THREE.Vector3(headP.x, Math.max(headP.y, base + HC.y * H), headP.z), HC.back); halo.material.rotation += THREE.MathUtils.degToRad(HC.spinDegPerSec) * dt; halo.material.opacity = HC.opacity * (0.85 + 0.15 * pulse(HC.pulseHz)); }
    if (blaze) { behind(blaze, at(T.blaze.y), T.blaze.back); blaze.material.rotation += THREE.MathUtils.degToRad(T.blaze.spinDegPerSec) * dt; const bp = pulse(T.blaze.pulseHz); blaze.material.opacity = T.blaze.opacity * (0.8 + 0.2 * bp); blaze.scale.setScalar(T.blaze.size * H * (0.95 + 0.08 * bp + Math.random() * 0.02)); }
    if (cosmos) { behind(cosmos, at(T.cosmos.y), T.cosmos.back); cosmos.material.rotation += THREE.MathUtils.degToRad(T.cosmos.spinDegPerSec) * dt; }
    for (const s of shards) { const a = s.a + t * THREE.MathUtils.degToRad(T.shards.orbitDegPerSec); s.m.position.set(headP.x + Math.cos(a) * T.shards.radius * H, base + (T.shards.y + s.y + Math.sin(t * 2 + s.a) * 0.03) * H, headP.z + Math.sin(a) * T.shards.radius * H); s.m.rotation.y += dt * 2 * s.s; }
    // particles
    for (const p of parts) {
      const pos = p.pts.geometry.getAttribute('position') as THREE.BufferAttribute, col = p.pts.geometry.getAttribute('color') as THREE.BufferAttribute, cols = (p.pts.userData as any).cols as THREE.Color[];
      for (let i = 0; i < p.n; i++) {
        const o5 = i * 5; p.st[o5 + 1] += dt * p.cfg.rise * p.st[o5 + 2] * (p.flame ? 1.2 : 0.5);
        if (p.st[o5 + 1] > 1) { p.st[o5 + 1] -= 1; p.st[o5] = Math.random() * Math.PI * 2; }
        const life = p.st[o5 + 1], a = p.st[o5] + t * (p.flame ? 0.4 : 1.1) * p.st[o5 + 2], r = p.cfg.radius * H * (p.flame ? 1 - life * 0.6 : 0.7 + 0.3 * Math.sin(life * 3 + p.st[o5]));
        pos.setXYZ(i, mid.x + Math.cos(a) * r, base + (p.flame ? life * 1.1 : 0.05 + life * 1.15) * H, mid.z + Math.sin(a) * r);
        const fade = Math.sin(Math.PI * life) * p.st[o5 + 3], c = cols[p.st[o5 + 4] | 0];
        col.setXYZ(i, c.r * fade, c.g * fade, c.b * fade);
      }
      pos.needsUpdate = true; col.needsUpdate = true;
    }
    // lightning
    if (arcMeshes) { for (const a of arcs) if (now > a.until) newArc(a, now); writeArcs(now); }
    // Mythic bursts
    if (burstMat && now > nextBurst) {
      nextBurst = now + rnd(T.bursts.everyMs[0], T.bursts.everyMs[1]); burstCount++;
      const flash = new THREE.Sprite(burstMat.flash.clone()); flash.renderOrder = 7; const ring = new THREE.Mesh(ground.geometry, (burstMat.ring as THREE.MeshBasicMaterial).clone()); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 7;
      group.add(flash, ring); bursts.push({ flash, ring, t: now });
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], k = (now - b.t) / T.bursts.ms;
      if (k >= 1) { group.remove(b.flash, b.ring); b.flash.material.dispose(); (b.ring.material as THREE.Material).dispose(); bursts.splice(i, 1); continue; }
      behind(b.flash, at(0.6), 0.35); b.flash.scale.setScalar(H * (0.4 + T.bursts.flash * Math.sqrt(k))); b.flash.material.opacity = (1 - k) * (1 - k) * (T.bursts.opacity ?? 0.5);
      b.ring.position.copy(at(0.03)); b.ring.scale.setScalar(H * (0.3 + T.bursts.ring * k)); (b.ring.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
  }

  function dispose() {
    for (const [m, mat] of restore) m.material = mat; // his own materials back
    for (const b of bursts) { b.flash.material.dispose(); (b.ring.material as THREE.Material).dispose(); }
    group.removeFromParent();
    for (const d of disposables) d.dispose();
  }
  const info = () => ({ tier, name: TIER_NAMES[tier], look: o.id in AURA.looks ? o.id : AURA.factionLook[o.faction] || 'grubnak', low, layers: { ...layers }, bodyHeight: +H.toFixed(3), liveArcs: arcs.filter((a) => a.lines.length).length, bursts: burstCount, weaponLit: hasTip, tinted: tint.length });
  return { group, tier, update, dispose, info };
}

import * as THREE from 'three';
import look from '../../public/models/mines/crystal-node-look.json';

/** Round 22.6: the 9 Crystal Node effects from crystal-node-look.json (twinkles, glows, sparks), tinted by the mine owner. */
let glowTex: THREE.Texture | null = null;
function tex() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (glowTex = new THREE.CanvasTexture(c));
}
const MAIN = (look as any).main.localPosition as number[], MS = (look as any).main.localScale as number;
const SPARKS = 24;

export interface MineFx { group: THREE.Group; setColor(hex: string): void; setLow(low: boolean): void; update(t: number): void; stats(): any[] }

export function makeMineFx(low: boolean): MineFx {
  const group = new THREE.Group();
  group.position.set(MAIN[0], MAIN[1], MAIN[2]); group.scale.setScalar(MS);
  const items: { e: any; obj: THREE.Object3D; mat: THREE.SpriteMaterial | THREE.PointsMaterial; seed: number; pos?: Float32Array; vel?: Float32Array; age?: Float32Array }[] = [];
  let color = '#ffffff', glowIdx = -1, isLow = low;
  for (const e of (look as any).effects as any[]) {
    const s = e.settings, p = e.localPosition as number[];
    let obj: THREE.Object3D, mat: any, extra: any = {};
    if (e.effectType === 'glow') {
      mat = new THREE.SpriteMaterial({ map: tex(), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(mat); sp.scale.setScalar(s.size); obj = sp;
      if (glowIdx < 0) glowIdx = items.length;
    } else {
      const n = e.effectType === 'twinkle' ? s.count : SPARKS, pos = new Float32Array(n * 3);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      mat = new THREE.PointsMaterial({ map: tex(), color: '#ffffff', size: e.effectType === 'twinkle' ? s.size * 0.25 : s.size * 1.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; obj = pts; extra = { pos };
      if (e.effectType === 'twinkle') for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, r = s.area * Math.sqrt(Math.random()); pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (Math.random() - 0.3) * s.area; pos[i * 3 + 2] = Math.sin(a) * r; }
      else { extra.vel = new Float32Array(n * 3); extra.age = new Float32Array(n); for (let i = 0; i < n; i++) extra.age[i] = Math.random(); }
    }
    obj.position.set(p[0], p[1], p[2]); group.add(obj);
    items.push({ e, obj, mat, seed: Math.random() * 10, ...extra });
  }
  const apply = () => items.forEach((it, i) => { it.mat.color.set(color); it.obj.visible = !isLow || i === glowIdx; });
  apply();
  return {
    group,
    setColor(hex) { color = hex; apply(); },
    setLow(l) { isLow = l; apply(); },
    update(t) {
      items.forEach((it, i) => {
        if (!it.obj.visible) return;
        const s = it.e.settings;
        if (it.e.effectType === 'glow') {
          const fl = 1 - s.flicker * 0.25 * (0.5 + 0.5 * Math.sin(t * 5 + it.seed) * Math.sin(t * 3.1 + it.seed * 2));
          (it.mat as THREE.SpriteMaterial).opacity = Math.min(1, s.strength * 0.4) * fl;
        } else if (it.e.effectType === 'twinkle') {
          (it.mat as THREE.PointsMaterial).opacity = 0.55 + 0.45 * Math.sin(t * s.speed * 4 + it.seed);
          it.obj.rotation.y = t * 0.1 * s.speed;
        } else if (it.pos && it.vel && it.age) {
          const dt = 1 / 30, n = SPARKS;
          for (let k = 0; k < n; k++) {
            it.age[k] += dt * 0.8;
            if (it.age[k] >= 1) {
              it.age[k] = 0; it.pos[k * 3] = it.pos[k * 3 + 1] = it.pos[k * 3 + 2] = 0;
              const a = Math.random() * 6.283, sp = Math.sin(s.spread * Math.random());
              it.vel[k * 3] = Math.cos(a) * sp * s.speed; it.vel[k * 3 + 1] = Math.cos(s.spread * Math.random()) * s.speed; it.vel[k * 3 + 2] = Math.sin(a) * sp * s.speed;
            }
            it.vel[k * 3 + 1] -= s.gravity * dt;
            for (let c = 0; c < 3; c++) it.pos[k * 3 + c] += it.vel[k * 3 + c] * dt;
          }
          ((it.obj as THREE.Points).geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        }
      });
    },
    stats() {
      return items.map((it) => ({ name: it.e.name, type: it.e.effectType, localPosition: it.e.localPosition, settings: { ...it.e.settings, color }, color, visible: it.obj.visible }));
    },
  };
}

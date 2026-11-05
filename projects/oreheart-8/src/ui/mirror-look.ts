// Same-faction matches (Ken, Nov 4: "it's hard to distinguish my guys from his guys"): on YOUR screen only, the opponent's units,
// their rings and the mines they hold turn ruby red. Your own side always looks normal, and the other player sees the reverse on
// their screen. Display only: a few lines of shader maths on the opponent's (already per-figure) materials, no art or model change,
// nothing through the server. Spring's recipe and Ken's picks: studio/mirror-colours-nov4-settings.md (goblins round 3, gnomes H,
// dwarves J). One place to tune: MIRROR_LOOK below.
import * as THREE from 'three';

export interface MirrorPreset {
  /** 'snap': every masked colour becomes one ruby hue (goblins: purple clothes only, skin untouched). 'turn': turn the keyed colours by an amount */
  mode: 'snap' | 'turn';
  hue: number;      // degrees: 'snap' = the target hue, 'turn' = how far to turn
  sat: number; light: number;
  key: number;      // degrees: which colours move (the faction's own hue)
  mask: [number, number]; // 'snap' only: how tightly the mask hugs the key
}
export const MIRROR_LOOK = {
  ring: '#ff3b4a',
  mine: '#ff3b4a',
  presets: {
    goblins: { mode: 'snap', hue: 20, sat: 1.5, light: 0.8, key: 75, mask: [0.62, 0.82] } as MirrorPreset,
    gnomes: { mode: 'snap', hue: 20, sat: 1.5, light: 0.9, key: 115, mask: [0.25, 0.65] } as MirrorPreset, // Ken, Nov 4: closer to true ruby, like Grubnak
    dwarves: { mode: 'snap', hue: 20, sat: 1.6, light: 1.15, key: 150, mask: [0.25, 0.65] } as MirrorPreset,
  } as Record<string, MirrorPreset>,
};

/** The preset to use for the opponent's units in this match, or null when the two sides are different factions. */
export function mirrorLook(st: any): MirrorPreset | null {
  const a = st?.players?.player?.faction, b = st?.players?.opponent?.faction;
  if (!a || a !== b) return null;
  return MIRROR_LOOK.presets[a] || null;
}

const rad = (d: number) => (d * Math.PI) / 180;

// YIQ: y = brightness, w = the colour part (hue = angle, length = how colourful). Both hooks shift the texture colour AND the
// emissive copy of it (creature3d uses the map as emissive too), or the unit keeps a green glow under a red coat.
const GLSL_FN = `
uniform vec2 mH; uniform vec2 mL; uniform vec2 mK; uniform float mS; uniform float mV; uniform float mSnap;
vec3 mirrorC(vec3 c){
  float y = dot(c, vec3(.299,.587,.114));
  vec2 w = vec2(dot(c, vec3(.596,-.274,-.322)), dot(c, vec3(.211,-.523,.312)));
  float l = length(w) + 1e-4;
  float m = smoothstep(mL.x, mL.y, dot(w/l, mK)) * smoothstep(.006, .03, l);
  vec2 turned = vec2(w.x*mH.x - w.y*mH.y, w.x*mH.y + w.y*mH.x) * mS;
  vec2 snapped = mH * l * mS;
  w = mix(w, mix(turned, snapped, mSnap), m); y *= mix(1., mV, m);
  return max(vec3(y+.956*w.x+.621*w.y, y-.272*w.x-.647*w.y, y-1.106*w.x+1.703*w.y), 0.);
}`;

/** A Commander's figure shares its materials with the loaded model (and so with the other side's Commander): give this one its own copies first. */
export function ownMaterials(group: THREE.Object3D) {
  group.traverse((o: any) => {
    if (!(o.isMesh || o.isSkinnedMesh) || o.isSprite || !o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map((m: any) => m.clone()) : o.material.clone();
  });
}
export function countMirrored(group: THREE.Object3D) {
  let n = 0;
  group.traverse((o: any) => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) if (m.userData?.mirror) n++; });
  return n;
}

/** Gives every material under the group the ruby look (once; props included, rings and sprites left alone). */
export function applyMirrorLook(group: THREE.Object3D, p: MirrorPreset, faction: string) {
  const uniforms = {
    mH: { value: new THREE.Vector2(Math.cos(rad(p.hue)), Math.sin(rad(p.hue))) },
    mL: { value: new THREE.Vector2(p.mask[0], p.mask[1]) },
    mK: { value: new THREE.Vector2(Math.cos(rad(p.key)), Math.sin(rad(p.key))) },
    mS: { value: p.sat }, mV: { value: p.light }, mSnap: { value: p.mode === 'snap' ? 1 : 0 },
  };
  group.traverse((o: any) => {
    if (!(o.isMesh || o.isSkinnedMesh) || o.isSprite || o.name === 'acting-ring' || o.name === 'ring-halo') return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!m || !m.isMeshStandardMaterial || m.userData.mirror) continue;
      m.userData.mirror = faction;
      m.onBeforeCompile = (shader: any) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + GLSL_FN)
          .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb = mirrorC(diffuseColor.rgb);')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance = mirrorC(totalEmissiveRadiance);');
      };
      m.customProgramCacheKey = () => 'mirror-' + faction; // one extra compiled shader per faction, shared by every ruby unit
      m.needsUpdate = true;
    }
  });
}

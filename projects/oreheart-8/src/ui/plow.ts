// Gnome Plow (card 'phase-stalker'), Ken Oct 30: "a gnome riding the plow ... vibrating with a little smoke effect ... wheels and tracks
// moving ... driving it, and ramming people". Everything plow-specific lives here; creature3d.ts and scene.ts only call the hooks below.
//  - plowMount(): the plow is the unit's base (a mount): it stands on the square facing the unit's facing, the gnome sits on its cushion.
//  - a per-figure rig (runs from the plow mesh's onBeforeRender): engine vibration + bob, wheel spin and tread judder from the ground speed,
//    exhaust smoke puffs (world-space sprites that animate and remove themselves).
//  - stagePlow() / plowFrame(): the 'plow' ability is staged as a drive along its line with a ram (lunge half a square, hit, reverse) at
//    every unit it knocks aside; the victims' knock-backs wait for the hit.
import * as THREE from 'three';
import { skinBox } from './grubnak3d';

export const PLOW_ID = 'phase-stalker';
/** Spring + Ledger (Oct 30): the gnome's origin (feet centre of the raw model) in plow-local units, turned -90 deg about Y (gnome +Z -> plow -x), scale 1.061 */
const RIDER_AT: [number, number, number] = [0.561, 0.093, -0.016], RIDER_YAW = -Math.PI / 2, RIDER_SCALE = 1.061;
const WHEEL_R = 0.105; // wheel radius in plow units (Clay's split: wheels are about 0.2 tall)
const PLOW_SPEED = 2.4; // squares per second while driving the ram line
const RAM_IN = 0.4, RAM_HOLD = 0.08, RAM_OUT = 0.32; // seconds; RAM_IN = biped-ride-02's impact time, so the gnome leans in as it hits

/** test hook (window.__plowRigs): one entry per plow figure built */
export interface PlowInfo { wheelAngle: number; wheelTurns: number; speed: number; moving: boolean; puffs: number; jitter: number; trackJudder: number; rider: { at: number[]; scale: number; yawDeg: number }; wheels: number; tracks: number; exhaust: boolean; lastRam: number; rams: number; seat?: { hips: number[]; rider: number[]; lowest: number } }
const rigs: PlowInfo[] = [];
(globalThis as any).__plowRigs = rigs;

let puffTex: THREE.Texture | null = null;
function puffTexture(): THREE.Texture {
  if (puffTex) return puffTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d')!, g = x.createRadialGradient(32, 32, 3, 32, 32, 30);
  g.addColorStop(0, 'rgba(235,235,235,0.9)'); g.addColorStop(0.5, 'rgba(190,190,190,0.55)'); g.addColorStop(1, 'rgba(150,150,150,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(cv);
  return puffTex;
}
/** one grey exhaust puff in world space: grows, rises, drifts and fades, then removes itself */
function puff(scene: THREE.Object3D, at: THREE.Vector3, size: number, drift: THREE.Vector3) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, color: 0x9c9c9c, opacity: 0.9 }));
  sp.position.copy(at); sp.scale.setScalar(size * 0.5); sp.renderOrder = 2; sp.userData.plowPuff = true;
  const born = performance.now(), life = 1100 + Math.random() * 300, from = at.clone(), rise = size * 2.2;
  sp.onBeforeRender = () => {
    const k = (performance.now() - born) / life;
    if (k >= 1) { sp.visible = false; queueMicrotask(() => { sp.parent?.remove(sp); sp.material.dispose(); }); return; }
    sp.position.set(from.x + drift.x * k, from.y + rise * (1 - (1 - k) * (1 - k)), from.z + drift.z * k);
    sp.scale.setScalar(size * (0.5 + 1.1 * k));
    sp.material.opacity = 0.9 * (1 - k) * Math.min(1, k * 8);
  };
  scene.add(sp);
}

/**
 * creature3d.ts hook (mount block): builds the plow under `root` with the rider `sc` (holding the gnome `ch`) on its seat, scaled so the
 * whole figure is 1.1 units tall standing on y = 0 (creature3d then scales root to the unit's height). Returns false for every other unit.
 */
export function plowMount(id: string, src: THREE.Object3D, root: THREE.Group, sc: THREE.Object3D, ch: THREE.Object3D, prep: (o: THREE.Object3D) => void, addItem: (name: string, obj: THREE.Object3D) => void): boolean {
  if (id !== PLOW_ID) return false;
  const plow = src.clone(true); prep(plow);
  const content = new THREE.Group(); content.name = 'plow-rig';
  content.add(plow);
  sc.parent?.remove(sc); content.add(sc);
  ch.position.set(0, 0, 0);
  sc.position.set(...RIDER_AT); sc.rotation.set(0, RIDER_YAW, 0); sc.scale.setScalar(RIDER_SCALE);
  content.rotation.y = Math.PI / 2; // plow front (-x) -> the unit's facing (+Z)
  root.add(content);
  root.updateMatrixWorld(true);
  const pb = new THREE.Box3().setFromObject(plow), all = pb.clone().union(skinBox(ch, new THREE.Box3()));
  const s = 1.1 / Math.max(1e-4, all.max.y - all.min.y), c = pb.getCenter(new THREE.Vector3());
  content.scale.setScalar(s);
  content.position.set(-c.x * s, -all.min.y * s, -c.z * s);
  root.userData.mount = true;
  addItem('plow', content);
  // ---- the rig: vibration, wheels, treads, smoke
  const wheels = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'].map((n) => plow.getObjectByName('wheel_' + n)).filter(Boolean) as THREE.Object3D[];
  const tracks = ['track_L', 'track_R'].map((n) => plow.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
  const trackX = tracks.map((t) => t.position.x);
  const exhaust = plow.getObjectByName('exhaust');
  const body = (plow.getObjectByName('plow_body') as THREE.Mesh | undefined) || (() => { let m: THREE.Mesh | undefined; plow.traverse((o: any) => { if (!m && o.isMesh) m = o; }); return m; })();
  const base = content.position.clone(), hips = ch.getObjectByName('Hips'), riderPt = plow.getObjectByName('rider'), hv = new THREE.Vector3();
  const info: PlowInfo = { wheelAngle: 0, wheelTurns: 0, speed: 0, moving: false, puffs: 0, jitter: 0, trackJudder: 0, rider: { at: [...RIDER_AT], scale: RIDER_SCALE, yawDeg: RIDER_YAW * 180 / Math.PI }, wheels: wheels.length, tracks: tracks.length, exhaust: !!exhaust, lastRam: 0, rams: 0 };
  rigs.push(info); if (rigs.length > 24) rigs.shift();
  root.userData.plow = info;
  let last = 0, nextPuff = 0, t = 0, spd = 0, seatT = 0;
  let lowFx = false; try { lowFx = localStorage.getItem('oreheart.graphics') === 'low'; } catch { /* no storage */ }
  const lowest = +plow.worldToLocal(skinBox(ch, new THREE.Box3()).min.clone()).y.toFixed(3); // the gnome's lowest point (feet) in plow units, at build
  const prev = new THREE.Vector3(), cur = new THREE.Vector3(), fwd = new THREE.Vector3(), ws = new THREE.Vector3(), ex = new THREE.Vector3();
  if (body) body.onBeforeRender = (_r: any, scene: THREE.Object3D) => {
    const now = performance.now();
    if (now === last) return; // several render passes in one frame
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 0; last = now; t += dt;
    root.getWorldPosition(cur);
    if (dt > 0) {
      const dx = cur.x - prev.x, dz = cur.z - prev.z, v = Math.hypot(dx, dz) / dt;
      root.getWorldDirection(fwd);
      const sign = dx * fwd.x + dz * fwd.z < 0 ? -1 : 1;
      spd = v > 8 ? spd : spd + (sign * v - spd) * Math.min(1, dt * 12); // ignore teleports
    }
    prev.copy(cur);
    const moving = Math.abs(spd) > 0.12;
    plow.getWorldScale(ws);
    const local = spd / Math.max(1e-4, ws.x); // plow units per second
    for (const w of wheels) w.rotation.z += (local / WHEEL_R) * dt;
    info.wheelAngle += (local / WHEEL_R) * dt; info.wheelTurns = info.wheelAngle / (Math.PI * 2);
    const jud = moving ? Math.sin(t * 55) * 0.006 : 0; // tread judder (the tread texture itself never scrolls)
    tracks.forEach((tr, i) => { tr.position.x = trackX[i] + jud * (i ? -1 : 1); });
    info.trackJudder = jud;
    // engine vibration: a small fast random jitter (about 1-2 % of the figure's height) plus a slight bob, stronger while moving
    const a = (moving ? 0.018 : 0.009) * 1.1, bob = Math.sin(t * Math.PI * 2 * (moving ? 3 : 1.6)) * a * 0.6;
    const jx = (Math.random() - 0.5) * a, jy = (Math.random() - 0.5) * a + bob + a * 0.5, jz = (Math.random() - 0.5) * a;
    content.position.set(base.x + jx, base.y + jy, base.z + jz);
    content.rotation.z = (Math.random() - 0.5) * (moving ? 0.016 : 0.008);
    if (hips && t >= seatT) { seatT = t + 0.5; plow.worldToLocal(hips.getWorldPosition(hv)); info.seat = { hips: hv.toArray().map((x) => +x.toFixed(3)), rider: riderPt ? riderPt.position.toArray().map((x) => +x.toFixed(3)) : [], lowest }; } // test hook: the gnome's hips in plow units
    info.jitter = Math.hypot(jx, jy - a * 0.5, jz); info.speed = +spd.toFixed(3); info.moving = moving;
    // exhaust smoke
    if (exhaust && now >= nextPuff && root.visible) {
      nextPuff = now + (moving ? 220 : 400) * (lowFx ? 2 : 1) * (0.85 + Math.random() * 0.3); // Low graphics: half the puffs
      exhaust.getWorldPosition(ex);
      const h = ws.y * 1.1 / s; // world height of the whole figure
      const size = h * (moving ? 0.42 : 0.28);
      const drift = fwd.clone().multiplyScalar(moving ? -0.35 * h * 2 : 0).add(new THREE.Vector3((Math.random() - 0.5) * 0.1 * h, 0, (Math.random() - 0.5) * 0.1 * h));
      if (scene) { puff(scene, ex, size, drift); info.puffs++; }
    }
  };
  return true;
}

// ---------------------------------------------------------------- the 'plow' ability on the board (scene.ts hooks)
interface Seg { t0: number; t1: number; d0: number; d1: number; ram?: boolean; hit?: number; hitDone?: boolean; at?: THREE.Vector3 }
interface Run { segs: Seg[]; start: THREE.Vector3; dir: THREE.Vector3; end: number }
const runs = new Map<string, Run>();
const holds = new Map<string, { until: number; land: THREE.Vector3 }>();
export interface PlowStageKit { world: (row: number, col: number) => THREE.Vector3; fx?: (kind: any, at: THREE.Vector3, n?: number) => void; sound?: (name: any) => void }
const cheb = (a: { row: number; col: number }, b: { row: number; col: number }) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k));

/** scene.ts setState hook (after the per-creature loop): stage each 'plow' ability as a drive with rams */
export function stagePlow(events: any[], figs: Map<string, any>, now: number, kit: PlowStageKit): void {
  for (const [uid, r] of runs) if (now > r.end + 2000 || !figs.has(uid)) runs.delete(uid); // a plow defeated mid-run
  for (const [uid, h] of holds) if (now > h.until + 2000 || !figs.has(uid)) holds.delete(uid);
  events.forEach((e, i) => {
    if (e.type !== 'abilityUsed' || e.ability !== 'plow') return;
    const f = figs.get(e.uid); if (!f) return;
    const tail: any[] = []; for (let j = i + 1; j < events.length && events[j].type !== 'abilityUsed'; j++) tail.push(events[j]);
    const own = tail.filter((x) => x.type === 'move' && x.uid === e.uid);
    const from = { row: e.row, col: e.col }, start = kit.world(from.row, from.col);
    const lastTo = own.length ? own[own.length - 1].to : from;
    const victims = new Map<string, any>(); for (const x of tail) if (x.type === 'move' && x.knock && x.uid !== e.uid && !victims.has(x.uid)) victims.set(x.uid, x);
    const dir = kit.world(lastTo.row, lastTo.col).sub(start).setY(0);
    if (dir.lengthSq() < 1e-6) { const v = [...victims.values()][0]; if (v) dir.copy(kit.world(v.from.row, v.from.col).sub(start).setY(0)); }
    if (dir.lengthSq() < 1e-6) { const y = f.faceWant ?? f.yaw ?? 0; dir.set(Math.sin(y), 0, Math.cos(y)); }
    dir.normalize();
    const unit = Math.abs(dir.x) > 0.01 && Math.abs(dir.z) > 0.01 ? Math.SQRT2 : 1; // one square along the line, in world units
    const D = own.length ? cheb(from, lastTo) : 0;
    const contacts = [...new Set([...victims.values()].map((v) => cheb(from, v.from)))].filter((k) => k >= 1).sort((a, b) => a - b);
    if (!own.length && !contacts.length) contacts.push(1); // blocked at once: it still rams the unit in front
    const segs: Seg[] = []; let t = now, d = 0;
    const drive = (to: number) => { if (to > d + 1e-6) { const dur = ((to - d) * unit / PLOW_SPEED) * 1000; segs.push({ t0: t, t1: t + dur, d0: d, d1: to }); t += dur; d = to; } };
    for (const k of contacts) {
      drive(k - 1);
      const hit = t + RAM_IN * 1000, at = start.clone().addScaledVector(dir, k * unit);
      segs.push({ t0: t, t1: hit, d0: d, d1: k - 0.5, ram: true, hit, at });
      segs.push({ t0: hit, t1: hit + RAM_HOLD * 1000, d0: k - 0.5, d1: k - 0.5 });
      segs.push({ t0: hit + RAM_HOLD * 1000, t1: hit + (RAM_HOLD + RAM_OUT) * 1000, d0: k - 0.5, d1: k - 1 });
      t = hit + (RAM_HOLD + RAM_OUT) * 1000;
      for (const v of victims.values()) {
        if (cheb(from, v.from) !== k) continue;
        const vf = figs.get(v.uid); if (!vf) continue;
        if (vf.kb && vf.kb.knockMove) { vf.kb.t0 = hit; vf.knockT = hit + 100; }
        holds.set(v.uid, { until: hit, land: vf.target.clone() }); vf.target.copy(vf.kb ? vf.kb.from : kit.world(v.from.row, v.from.col));
        vf.faceTo = Math.atan2(-dir.x, -dir.z); vf.faceUntil = hit + 900;
      }
    }
    drive(D);
    f.path = []; f.run = false; f.lunge = null;
    f.faceTo = Math.atan2(dir.x, dir.z); f.faceUntil = t + 300;
    runs.set(f.uid, { segs, start, dir: dir.multiplyScalar(unit), end: t });
    kit.sound?.('melee');
    (globalThis as any).__plowStaged = { uid: f.uid, at: now, contacts, drive: D, victims: [...victims.keys()], end: t };
  });
}

/** scene.ts frame hook (per figure, after its position update): drives a staged plow along its line; holds its victims until the hit */
export function plowFrame(f: any, now: number, kit?: PlowStageKit): void {
  const h = holds.get(f.uid);
  if (h) { if (now >= h.until) { f.target.copy(h.land); holds.delete(f.uid); } }
  const r = runs.get(f.uid); if (!r) return;
  const g: THREE.Object3D = f.group;
  if (now >= r.end) { runs.delete(f.uid); g.position.x = f.target.x; g.position.z = f.target.z; return; }
  const s = r.segs.find((x) => now < x.t1) || r.segs[r.segs.length - 1];
  const k = s.t1 > s.t0 ? Math.min(1, Math.max(0, (now - s.t0) / (s.t1 - s.t0))) : 1;
  const d = s.d0 + (s.d1 - s.d0) * (s.ram ? k * k : s.d1 < s.d0 ? ease(k) : k); // the ram accelerates into the hit; the reverse eases
  g.position.x = r.start.x + r.dir.x * d; g.position.z = r.start.z + r.dir.z * d;
  if (s.ram && f.shootT !== s.t0) { f.shootT = s.t0; f.c3d?.setSpeed?.('attack', 1); } // the gnome's ram clip (biped-ride-02): lean in, hit at 0.4 s
  for (const x of r.segs) if (x.ram && !x.hitDone && now >= x.hit!) {
    x.hitDone = true;
    const info = f.c3d?.group?.userData?.plow as PlowInfo | undefined; if (info) { info.lastRam = now; info.rams++; }
    const at = x.at!.clone(); at.y = 0.4;
    const fx = kit?.fx; if (fx) { fx('stars', at, 7); fx('flash', at, 1); fx('dust', at.clone().setY(0.05), 5); }
    kit?.sound?.('bonk');
  }
}

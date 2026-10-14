// Placeholder 3D battlefield (Three.js). Returns null when WebGL is unavailable (the UI then shows a 2D board).
import * as THREE from 'three';
import { COLORS, FACTIONS, CARDS, isActed } from '../engine';

export interface Rect { x: number; y: number; w: number; h: number }
export interface BoardView {
  is3D: boolean;
  setState(state: any, events: any[]): void;
  cellRect(row: number, col: number): Rect;
  resize(): void;
  emote(side: 'player' | 'opponent', kind: 'cheer' | 'groan' | 'flinch' | 'cast'): void;
  dispose(): void;
}

const SYMBOL: Record<string, string> = { skull: '💀', gear: '⚙️', hammer: '🔨' };
const hexOf = (id: string | null) => (id && id !== 'white' ? COLORS[id].hex : COLORS.neutral.hex);
const world = (row: number, col: number) => new THREE.Vector3(col - 4, 0, row - 4);

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

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4b3b2b';
  g.fillRect(0, 0, 512, 512);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const palette = ['#3d5a2e', '#2f4a27', '#5a4632', '#6b5a45', '#3b3d40', '#4f6a35', '#3a2d20'];
  for (let i = 0; i < 520; i++) {
    g.fillStyle = palette[Math.floor(rnd() * palette.length)];
    g.globalAlpha = 0.25 + rnd() * 0.35;
    g.beginPath();
    g.ellipse(rnd() * 512, rnd() * 512, 14 + rnd() * 46, 10 + rnd() * 30, rnd() * 3, 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = '#8b8d93';
    g.beginPath();
    g.ellipse(rnd() * 512, rnd() * 512, 5 + rnd() * 9, 4 + rnd() * 6, rnd() * 3, 0, 7);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 8);
  return t;
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
  renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !low;
  const canvas = renderer.domElement;
  canvas.className = 'board-canvas';
  container.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x554466, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
  sun.position.set(-4, 9, 5);
  sun.castShadow = !low;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // crystal formations
  const crystals: { mats: THREE.MeshStandardMaterial[]; sprite: THREE.Sprite | null; group: THREE.Group; ctl: any }[] = [];
  const sparkles: THREE.Points[] = [];
  for (const col of [2, 4, 6]) {
    const grp = new THREE.Group();
    grp.position.copy(world(4, col));
    const mats: THREE.MeshStandardMaterial[] = [];
    [[0, 0, 1.15, 0.28], [-0.28, 0.1, 0.75, 0.2], [0.28, -0.08, 0.6, 0.18]].forEach(([x, z, h, r]) => {
      const m = new THREE.MeshStandardMaterial({ color: COLORS.neutral.hex, emissive: COLORS.neutral.hex, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.3 });
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), m);
      mesh.scale.y = h / r;
      mesh.position.set(x, h * 0.5, z);
      mesh.castShadow = !low;
      grp.add(mesh);
      mats.push(m);
    });
    scene.add(grp);
    crystals.push({ mats, sprite: null, group: grp, ctl: undefined });
    if (!low) {
      const pts = new Float32Array(30);
      for (let i = 0; i < 10; i++) { pts[i * 3] = (Math.sin(i * 7) * 0.5); pts[i * 3 + 1] = 0.2 + (i % 5) * 0.25; pts[i * 3 + 2] = Math.cos(i * 5) * 0.5; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.8 }));
      grp.add(p);
      sparkles.push(p);
    }
  }

  // strongholds + commanders
  const cmd: Record<string, { group: THREE.Group; body: THREE.Mesh; fig: THREE.Group; emote: { kind: string; t: number } | null; faction: string }> = {};
  for (const side of ['player', 'opponent'] as const) {
    const g = new THREE.Group();
    const p = world(side === 'player' ? 7 : 1, 4);
    g.position.copy(p);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.55, 0.55, 10), new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 0.9 }));
    tower.position.y = 0.27;
    tower.castShadow = !low;
    g.add(tower);
    const fig = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    body.position.y = 0.85;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), new THREE.MeshStandardMaterial({ color: 0xe9c89a }));
    head.position.y = 1.3;
    fig.add(body, head);
    if (side === 'opponent') fig.rotation.y = Math.PI;
    g.add(fig);
    scene.add(g);
    cmd[side] = { group: g, body, fig, emote: null, faction: '' };
  }

  // creatures
  type Fig = { group: THREE.Group; target: THREE.Vector3; born: number; dying: number; lunge: THREE.Vector3 | null; lungeT: number; owner: string; acted?: boolean };
  const figs = new Map<string, Fig>();
  function makeFigure(c: any): THREE.Group {
    const card = CARDS[c.cardId];
    const f = FACTIONS[card.faction];
    const colorHex = hexOf(f.crystal);
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.55 });
    const big = card.rarity === 'Collector' ? 1.35 : card.rarity === 'Ultra Rare' ? 1.15 : 1;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 12), mat);
    body.position.y = 0.3;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8d3a8 }));
    head.position.y = 0.72;
    body.castShadow = head.castShadow = !low;
    g.add(body, head);
    if (card.faction === 'goblins') [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), mat); e.position.set(s * 0.22, 0.78, 0); e.rotation.z = -s * 1.2; g.add(e); });
    if (card.faction === 'gnomes') { const h = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.32, 10), new THREE.MeshStandardMaterial({ color: 0xd04040 })); h.position.y = 1.0; g.add(h); }
    if (card.faction === 'dwarves') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.1), new THREE.MeshStandardMaterial({ color: 0x8a5a2a })); b.position.set(0, 0.6, 0.17); g.add(b); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 6, 20), new THREE.MeshBasicMaterial({ color: c.owner === 'player' ? 0xe3b54a : 0x7a1f1f }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    g.add(ring);
    const sp = symbolSprite(f.symbol, 0.42);
    sp.position.y = 1.2;
    g.add(sp);
    g.scale.setScalar(big);
    return g;
  }

  let state: any = null;
  function setState(st: any, events: any[]) {
    state = st;
    const now = performance.now();
    st.sites.forEach((s: any, i: number) => {
      const cr = crystals[i];
      if (cr.ctl === s.color) return;
      cr.ctl = s.color;
      const hex = hexOf(s.color);
      cr.mats.forEach((m) => { m.color.set(hex); m.emissive.set(hex); });
      if (cr.sprite) cr.group.remove(cr.sprite);
      cr.sprite = null;
      if (s.controller) {
        cr.sprite = symbolSprite(FACTIONS[st.players[s.controller].faction].symbol, 0.5);
        cr.sprite.position.y = 1.65;
        cr.group.add(cr.sprite);
      }
    });
    (['player', 'opponent'] as const).forEach((side) => {
      const fct = st.players[side].faction;
      const cm = cmd[side];
      if (cm.faction !== fct) {
        cm.faction = fct;
        (cm.body.material as THREE.MeshStandardMaterial).color.set(hexOf(FACTIONS[fct].crystal));
      }
    });
    const seen = new Set<string>();
    for (const c of st.board.creatures) {
      seen.add(c.uid);
      let f = figs.get(c.uid);
      const tgt = world(c.row, c.col);
      if (!f) {
        const group = makeFigure(c);
        const born = events.some((e) => e.type === 'summon' && e.uid === c.uid) ? now : 0;
        group.position.copy(tgt);
        scene.add(group);
        f = { group, target: tgt.clone(), born, dying: 0, lunge: null, lungeT: 0, owner: c.owner };
        figs.set(c.uid, f);
      }
      f.target.copy(tgt);
      const acted = isActed(st, c);
      if (f.acted !== acted) {
        f.acted = acted;
        f.group.traverse((o: any) => {
          const m = o.material;
          if (!m || !m.color || o.isSprite || m.isMeshBasicMaterial) return;
          if (!m.userData.base) m.userData.base = m.color.clone();
          m.color.copy(m.userData.base);
          if (acted) { const hsl: any = {}; m.color.getHSL(hsl); m.color.setHSL(hsl.h, hsl.s * 0.8, hsl.l * 0.5); }
        });
      }
      const mv = events.find((e) => e.type === 'move' && e.uid === c.uid);
      if (mv && mv.teleport) f.group.position.copy(tgt);
    }
    for (const [uid, f] of figs) if (!seen.has(uid) && !f.dying) f.dying = now;
    for (const e of events) {
      if (e.type === 'attack' && figs.get(e.uid)) {
        const f = figs.get(e.uid)!;
        const to = e.target.commander ? world(e.target.commander === 'player' ? 7 : 1, 4) : world(e.target.row, e.target.col);
        f.lunge = to.clone().sub(f.target).multiplyScalar(0.45);
        f.lungeT = now;
        if (!e.target.commander && !e.ranged) {
          for (const d of figs.values()) if (d !== f && d.target.distanceTo(to) < 0.1) { d.lunge = f.target.clone().sub(d.target).multiplyScalar(0.3); d.lungeT = now; }
        }
      }
    }
  }

  function resize() {
    const w = container.clientWidth || 390, h = container.clientHeight || 420;
    renderer.setSize(w, h, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = w / h;
    const el = (60 * Math.PI) / 180;
    const y0 = 0.03 * h, y1 = 0.9 * h;
    const corners = [[-3.6, -3.6], [3.6, -3.6], [3.6, 3.6], [-3.6, 3.6]];
    const fit = (dist: number) => {
      camera.clearViewOffset();
      camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist);
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
      if (f.bot - f.top <= y1 - y0 && f.right - f.left <= w * 0.98) hi = mid; else lo = mid;
    }
    const f = fit(hi);
    // slide the view so the enemy Stronghold row sits at the top edge
    camera.setViewOffset(w, h, 0, -(y0 - f.top), w, h);
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
  }

  let raf = 0;
  let disposed = false;
  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    for (const [uid, f] of figs) {
      const g = f.group;
      if (f.dying) {
        const k = (now - f.dying) / 350;
        g.scale.setScalar(Math.max(0.001, 1 - k));
        g.rotation.y += 0.3;
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
      if (f.born) {
        const k = Math.min(1, (now - f.born) / 450);
        g.position.y = (1 - k) * -0.6;
        g.visible = true;
        if (k >= 1) f.born = 0;
      } else g.position.y = Math.abs(Math.sin(now / 260 + g.position.x)) * 0.015;
    }
    for (const side of ['player', 'opponent'] as const) {
      const cm = cmd[side];
      cm.fig.position.y = Math.sin(now / 600 + (side === 'player' ? 0 : 2)) * 0.02;
      cm.fig.rotation.z = 0;
      if (cm.emote) {
        const k = (now - cm.emote.t) / 700;
        if (k >= 1) cm.emote = null;
        else if (cm.emote.kind === 'cheer') cm.fig.position.y += Math.abs(Math.sin(k * Math.PI * 3)) * 0.25;
        else if (cm.emote.kind === 'groan') cm.fig.rotation.z = Math.sin(k * Math.PI) * 0.5;
        else if (cm.emote.kind === 'flinch') cm.fig.rotation.z = Math.sin(k * 30) * 0.2 * (1 - k);
        else cm.fig.position.y += Math.sin(k * Math.PI) * 0.15;
      }
    }
    crystals.forEach((c, i) => c.mats.forEach((m) => (m.emissiveIntensity = 0.5 + Math.sin(now / 420 + i) * 0.15)));
    sparkles.forEach((p, i) => (p.rotation.y = now / 2000 + i));
    renderer.render(scene, camera);
  }
  resize();
  frame();
  void state;

  return {
    is3D: true, setState, cellRect, resize, emote,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* ignore */ }
      canvas.remove();
    },
  };
}

/** Flat board used when WebGL is not available. */
export function createFlatView(container: HTMLElement): BoardView {
  container.classList.add('flat');
  return {
    is3D: false,
    setState() {},
    cellRect(row, col) {
      const w = container.clientWidth || 390, h = container.clientHeight || 420;
      const cs = Math.min((h * 0.87) / 7, w / 7);
      const x0 = (w - cs * 7) / 2, y0 = h * 0.03;
      return { x: x0 + (col - 1) * cs, y: y0 + (row - 1) * cs, w: cs, h: cs };
    },
    resize() {},
    emote(side, kind) {
      const el = container.querySelector(`.stronghold.${side}`);
      if (el) { el.classList.remove('emote-cheer', 'emote-groan', 'emote-flinch', 'emote-cast'); void (el as HTMLElement).offsetWidth; el.classList.add('emote-' + kind); }
    },
    dispose() { container.classList.remove('flat'); },
  };
}

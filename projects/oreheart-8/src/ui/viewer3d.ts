// 3D viewer for Grubnak (Round 7 Part B): drag to spin, wheel or pinch to zoom, text buttons play each animation.
import * as THREE from 'three';
import { loadGrubnak3d, makeGrubnak3d, GRUBNAK_ANIMS, G3D } from './grubnak3d';
import { h } from './app';

const LABEL: Record<string, string> = { idle: 'Idle', laugh: 'Laugh', point: 'Point', celebrate: 'Celebrate', surprised: 'Surprised', cast: 'Cast', hit: 'Hit', defeat: 'Defeat' };

/** Mounts the viewer inside `host` (no overlay of its own); resolves to a destroy function, or null when the 3D files are not shipped. */
export async function mountGrubnakViewer(host: HTMLElement, opts: { bare?: boolean } = {}): Promise<(() => void) | null> {
  const assets = await loadGrubnak3d();
  if (!assets) return null;
  const canvas = h('canvas', { class: 'viewer-canvas', 'data-grubnak-viewer': '', 'aria-label': 'Grubnak 3D model, drag to spin' }) as HTMLCanvasElement;
  const status = h('p', { class: 'viewer-status', role: 'status', 'aria-live': 'polite' }, 'Playing: Idle');
  const row = h('div', { class: 'viewer-anims', role: 'group', 'aria-label': 'Animations' });
  const ov = h('div', { class: 'viewer3d' + (opts.bare ? ' bare' : ''), role: 'group', 'aria-label': 'Grubnak 3D viewer', 'data-viewer3d': '' }, canvas, row, status);
  ov.addEventListener('click', (e) => e.stopPropagation());
  ov.addEventListener('pointerdown', (e) => e.stopPropagation());
  host.append(ov);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2a40, 1.5));
  const key = new THREE.DirectionalLight(0xfff0d0, 2.4); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9a6aff, 1.4); rim.position.set(-3, 2, -3); scene.add(rim);
  const g3d: G3D = makeGrubnak3d(assets);
  scene.add(g3d.group);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  const target = new THREE.Vector3(0, g3d.height * 0.5, 0);
  let az = 0.4, el = 0.15, dist = g3d.height * (opts.bare ? 1.9 : 2.6);
  const place = () => {
    camera.position.set(target.x + dist * Math.sin(az) * Math.cos(el), target.y + dist * Math.sin(el), target.z + dist * Math.cos(az) * Math.cos(el));
    camera.lookAt(target);
  };
  const size = () => {
    const w = canvas.clientWidth || 400, hh = canvas.clientHeight || 400;
    renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix();
  };

  const btns: HTMLElement[] = [];
  for (const k of GRUBNAK_ANIMS) {
    const b = h('button', { type: 'button', class: 'btn viewer-anim', 'data-anim': k, 'aria-pressed': String(k === 'idle'), onclick: () => {
      g3d.play(k as any); status.textContent = `Playing: ${LABEL[k]}`;
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      canvas.dataset.anim = k;
    } }, LABEL[k]);
    btns.push(b); row.append(b);
  }
  canvas.dataset.anim = 'idle';

  const pts = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = 0; });
  canvas.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 1) { az -= (e.clientX - p.x) * 0.01; el = Math.max(-0.3, Math.min(1.2, el + (e.clientY - p.y) * 0.008)); }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) dist = Math.max(g3d.height * 1.2, Math.min(g3d.height * 5, dist * (pinch / d)));
      pinch = d;
    }
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); dist = Math.max(g3d.height * 1.2, Math.min(g3d.height * 5, dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });

  let raf = 0, last = performance.now(), open = true;
  const frame = (t: number) => {
    if (!open) return;
    g3d.update(Math.min(0.1, (t - last) / 1000)); last = t;
    if (!pts.size) az += 0.0015;
    size(); place();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const emoter = opts.bare ? setInterval(() => g3d.play(Math.random() < 0.5 ? 'laugh' : 'point'), 7000 + Math.random() * 4000) : 0;
  const shut = () => { clearInterval(emoter as any); open = false; cancelAnimationFrame(raf); renderer.dispose(); ov.remove(); };
  return shut;
}

/** Round 9c: a close-up 3D viewer for any creature card (the board placeholder or finished figure): drag to spin, wheel to zoom, "Idle" button. */
export async function mountCreatureViewer(host: HTMLElement, card: any): Promise<(() => void) | null> {
  const { makeGoblin } = await import('./art');
  const canvas = h('canvas', { class: 'viewer-canvas', 'data-creature-viewer': '', 'aria-label': `${card.name} 3D model, drag to spin` }) as HTMLCanvasElement;
  const row = h('div', { class: 'viewer-anims', role: 'group', 'aria-label': 'Animations' });
  const ov = h('div', { class: 'viewer3d', role: 'region', 'aria-label': '3D model', 'data-viewer3d': '' }, canvas, row);
  ov.addEventListener('click', (e) => e.stopPropagation());
  ov.addEventListener('pointerdown', (e) => e.stopPropagation());
  host.append(ov);
  let renderer: THREE.WebGLRenderer | null = null;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { renderer = null; }
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2a40, 1.6));
  const key = new THREE.DirectionalLight(0xfff0d0, 2.4); key.position.set(2, 4, 3); scene.add(key);
  let fig: THREE.Group;
  if (card.faction === 'goblins') fig = makeGoblin(card.id, card, () => {}, true).group;
  else {
    fig = new THREE.Group();
    const col = card.faction === 'gnomes' ? 0x3fa9ff : 0xb45cff;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 })); body.position.y = 0.3;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8d3a8 })); head.position.y = 0.72;
    fig.add(body, head);
  }
  scene.add(fig);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  let az = 0.4, dist = 3.2;
  const idle = h('button', { type: 'button', class: 'btn viewer-anim', 'data-anim': 'idle', 'aria-pressed': 'true' }, 'Idle');
  row.append(idle);
  let drag: { x: number } | null = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX }; });
  canvas.addEventListener('pointermove', (e) => { if (drag) { az -= (e.clientX - drag.x) * 0.01; drag.x = e.clientX; } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); dist = Math.max(1.6, Math.min(8, dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
  let raf = 0, open = true;
  const frame = (t: number) => {
    if (!open) return;
    if (!drag) az += 0.006;
    fig.position.y = Math.sin(t / 700) * 0.01;
    const w = canvas.clientWidth || 400, hh = canvas.clientHeight || 400;
    if (renderer) { renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix(); camera.position.set(dist * Math.sin(az), 1.2, dist * Math.cos(az)); camera.lookAt(0, 0.6, 0); renderer.render(scene, camera); }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { open = false; cancelAnimationFrame(raf); renderer?.dispose(); ov.remove(); };
}

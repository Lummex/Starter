// Ken (Oct 30 playtest): move orders are drawn like a football play: a hand-drawn curved chalk line through the path squares,
// an X where the unit is going, and for a chase a hand-drawn circle around the target. Pure SVG markup, no game logic.
export interface Pt { x: number; y: number }
export interface OrderDrawing {
  uid: string;
  kind: 'move' | 'chase';
  /** screen points (board-relative): the unit's square first, then every path square's centre */
  pts: Pt[];
  /** the X (move) or the circled target's square centre (chase) */
  end: Pt;
  /** the size of one square on screen there (for line width, X size and the circle) */
  cw: number;
  ch: number;
  preview: boolean;
  blocked: boolean;
  /** Ken, Nov 1: a chase's next targets after the current one (numbered 2, 3, ...) */
  chain?: Pt[];
  /** Ken, Nov 1: a chase by a ranged unit ends in a little bow and arrow, by a melee unit in a little sword */
  ranged?: boolean;
}

/** A small seeded random generator, so a unit's line keeps the same wobble every redraw (no flicker while panning). */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}
const f = (n: number) => n.toFixed(1);

/** Catmull-Rom through the points as cubic Beziers (a smooth curve that still passes every square's centre). */
function smooth(p: Pt[], tension = 0.5): string {
  if (p.length < 2) return '';
  let d = `M${f(p[0].x)},${f(p[0].y)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1 = { x: p1.x + ((p2.x - p0.x) * tension) / 3, y: p1.y + ((p2.y - p0.y) * tension) / 3 };
    const c2 = { x: p2.x - ((p3.x - p1.x) * tension) / 3, y: p2.y - ((p3.y - p1.y) * tension) / 3 };
    d += ` C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(p2.x)},${f(p2.y)}`;
  }
  return d;
}

/** The route's control points: a little hand wobble on the inner points, and a gentle bow on short straight runs so it always curves. */
function routePoints(d: OrderDrawing, r: () => number): Pt[] {
  // drop repeated points (start square counted twice)
  const p: Pt[] = [];
  for (const q of d.pts) if (!p.length || Math.hypot(q.x - p[p.length - 1].x, q.y - p[p.length - 1].y) > 1) p.push({ ...q });
  const s = Math.min(d.cw, d.ch * 1.6);
  for (let i = 1; i < p.length - 1; i++) { p[i].x += (r() - 0.5) * s * 0.14; p[i].y += (r() - 0.5) * s * 0.1; }
  if (p.length === 2) p.splice(1, 0, { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
  // a gentle overall bow (like a coach's marker stroke), zero at both ends, so even a straight run reads as a curve
  const a = p[0], b = p[p.length - 1], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, bow = Math.min(L * 0.1, s * 0.7) * (r() < 0.5 ? -1 : 1);
  for (let i = 1; i < p.length - 1; i++) { const k = Math.sin((Math.PI * i) / (p.length - 1)) * bow; p[i].x += (-(b.y - a.y) / L) * k; p[i].y += ((b.x - a.x) / L) * k; }
  return p;
}

// Ken, Nov 1: the orders are drawn like a see-through dry-erase marker lying on the board: flowing, even-handed pen strokes that swell and ease
// (pressure) as the hand moves, and everything is drawn flat on the board and squashed by the board's own tilt (the cell's height / width), so
// the circles, the X, the sword and the bow lie on the ground in perspective. The arrow is one no-lift stroke (line, then back through the tip).
type V = { x: number; y: number };
const smoothstep = (a: number) => { const t = Math.max(0, Math.min(1, a)); return t * t * (3 - 2 * t); };
/** a dense Catmull-Rom polyline through the points (flat space) */
function dense(p: V[], per = 10): V[] {
  if (p.length < 2) return p.slice();
  const out: V[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push({ x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3), y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3) });
    }
  }
  out.push(p[p.length - 1]);
  return out;
}
/** a pen stroke along a flat-space polyline: a polygon whose width follows the hand (eases in and out, a little heavier mid-stroke), squashed onto the board */
function pen(poly: V[], w: number, k: number, ph: number, press = 0.2, lo = 0.3): string {
  const n = poly.length; if (n < 2) return '';
  const len: number[] = [0]; for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y));
  const L = len[n - 1] || 1, A: string[] = [], B: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[Math.max(0, i - 1)], b = poly[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1, t = len[i] / L;
    const wt = w * (lo + (1 - lo) * smoothstep(t / 0.1)) * (lo + (1 - lo) * smoothstep((1 - t) / 0.16)) * (1 + press * Math.sin(t * Math.PI * 1.6 + ph)) / 2;
    A.push(`${f(poly[i].x - (dy / m) * wt)},${f((poly[i].y + (dx / m) * wt) * k)}`); B.push(`${f(poly[i].x + (dy / m) * wt)},${f((poly[i].y - (dx / m) * wt) * k)}`);
  }
  return `M${A.join(' L')} L${B.reverse().join(' L')}Z`;
}
const line = (a: V, b: V, n = 8): V[] => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));

/** the small symbol past the arrow tip, drawn flat at c and s big: a cursive X, a sword (melee) or a bow and arrow (ranged) */
function symbolStrokes(kind: 'x' | 'sword' | 'bow', c: V, s: number): V[][] {
  const P = (u: number, v: number): V => ({ x: c.x + u * s, y: c.y + v * s });
  if (kind === 'x') return [
    dense([P(-1, -0.9), P(-0.35, -0.25), P(0.3, 0.4), P(1.05, 1.05), P(1.28, 0.5), P(1.12, -0.3), P(0.95, -1.05)]),
    dense([P(1.05, -1.12), P(0.45, -0.5), P(-0.2, 0.1), P(-0.8, 0.8), P(-1.5, 1.35)]),
  ];
  if (kind === 'sword') { // pointing up and to the right: grip, crossguard, chunky pointed blade
    const a = -1.1, ca = Math.cos(a), sa = Math.sin(a), Q = (u: number, v: number): V => ({ x: c.x + (ca * u - sa * v) * s * 0.85, y: c.y + (sa * u + ca * v) * s * 0.85 });
    return [line(Q(-0.4, 0), Q(0.7, 0)), line(Q(0.7, -1), Q(0.7, 1)), dense([Q(0.8, 0.4), Q(3, 0.5), Q(4, 0), Q(3, -0.5), Q(0.8, -0.4), Q(0.8, 0.4)], 6)];
  }
  const x = c.x - 0.3 * s; // a bow whose belly faces the target, the arrow nocked and flying the same way
  return [dense([{ x, y: c.y - 1.4 * s }, { x: x + 1.5 * s, y: c.y }, { x, y: c.y + 1.4 * s }]), line({ x, y: c.y + 1.4 * s }, { x: x - 0.4 * s, y: c.y }, 4), line({ x: x - 0.4 * s, y: c.y }, { x: x + 2.2 * s, y: c.y }), line({ x: x + 1.6 * s, y: c.y - 0.5 * s }, { x: x + 2.2 * s, y: c.y }, 4), line({ x: x + 2.2 * s, y: c.y }, { x: x + 1.6 * s, y: c.y + 0.5 * s }, 4)];
}

/** One order as an SVG group. */
export function orderSvg(d: OrderDrawing): string {
  const r = rng(d.uid + d.kind);
  const cw = d.cw, k = Math.max(0.3, Math.min(1, d.ch / d.cw)); // the board's tilt: squash on the ground
  const s = Math.min(cw, d.ch * 1.6);
  const w = Math.max(6, Math.min(15, s * 0.17));
  // Ken, Nov 1: green = a move, red = a melee attack, blue = a ranged attack (a blocked move is red)
  const ink = d.blocked ? '#ff6a58' : d.kind === 'move' ? '#46e05a' : d.ranged ? '#5b8dff' : '#ff4a3d', ph = r() * 6;
  const F = (p: Pt): V => ({ x: p.x, y: p.y / k }); // screen -> flat
  let out = '';
  let pts = d.pts.map(F);
  pts = pts.filter((q, i) => !i || Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y) > 1);
  if (pts.length === 2) pts.splice(1, 0, { x: (pts[0].x + pts[1].x) / 2 + (r() - 0.5) * s * 0.1, y: (pts[0].y + pts[1].y) / 2 + (r() - 0.5) * s * 0.1 });
  const E = F(d.end);
  let rx = 0, a0 = 0;
  if (d.kind === 'chase') {
    rx = cw * 0.5; a0 = r() * Math.PI * 2; // a circle on the ground (flat), squashed by the tilt
    const last = pts[pts.length - 1];
    if (pts.length >= 2 && Math.hypot(last.x - E.x, last.y - E.y) < 1) pts.pop();
    const from = pts[pts.length - 1] || E, dx = from.x - E.x, dy = from.y - E.y, L = Math.hypot(dx, dy) / rx;
    if (L > 1.05) pts.push({ x: E.x + dx / L, y: E.y + dy / L });
  }
  const route = dense(pts);
  const polys: string[] = [];
  if (route.length >= 2) {
    polys.push(pen(route, w, k, ph, 0.25));
    // the arrowhead: back out through the tip in one go (a V that crosses its own line), flat on the board
    const tip = route[route.length - 1], back = route[Math.max(0, route.length - 6)], ang = Math.atan2(tip.y - back.y, tip.x - back.x), hl = s * 0.4;
    // two long curved barbs sweeping back from the tip like a swoosh (not straight), tapering to sharp points; drawn in one go (barb in, barb out)
    const barb = (side: number): V[] => {
      const a2 = ang + side * 0.36, e = { x: tip.x - Math.cos(a2) * hl, y: tip.y - Math.sin(a2) * hl }, bend = -side * s * 0.13; // curved inward (toward the line), so the head stays sharp, not fat
      const m = { x: (e.x + tip.x) / 2 + Math.sin(ang) * bend, y: (e.y + tip.y) / 2 - Math.cos(ang) * bend };
      return dense([e, m, tip], 8);
    };
    polys.push(pen(barb(-1), w * 0.9, k, ph + 1, 0.12, 0.04), pen(barb(1).reverse(), w * 0.9, k, ph + 2, 0.12, 0.04));
    const kind: 'x' | 'sword' | 'bow' = d.kind === 'move' ? 'x' : d.ranged ? 'bow' : 'sword';
    const sz = (kind === 'x' ? 0.1 : 0.055) * s;
    const place = d.kind === 'move' ? { x: tip.x + Math.cos(ang) * s * 0.34 + Math.sin(ang) * s * 0.1, y: tip.y + Math.sin(ang) * s * 0.34 - Math.cos(ang) * s * 0.12 } : { x: E.x + rx * 1.0, y: E.y - rx * 0.95 };
    for (const st of symbolStrokes(kind, place, sz * 2.2)) polys.push(pen(st, kind === 'x' ? w * 0.85 : w * 0.62, k, ph + 3, 0.2));
  }
  if (d.kind === 'chase') {
    const loop: V[] = []; // a bit over one loop, slightly spiralling, like a quick hand-drawn circle
    for (let i = 0; i <= 30; i++) { const t = i / 30, a = a0 + t * (Math.PI * 2 + 0.75), g = 1 + 0.1 * t + 0.04 * Math.sin(3 * a + ph); loop.push({ x: E.x + Math.cos(a) * rx * g, y: E.y + Math.sin(a) * rx * g }); }
    polys.push(pen(loop, w * 0.9, k, ph + 4, 0.25));
  }
  out += polys.map((q, i) => `<path${d.kind === 'chase' && i === polys.length - 1 ? ' class="ord-circle"' : d.kind === 'move' && i === 3 ? ' class="ord-x"' : ''} d="${q}" fill="${ink}" fill-opacity=".72"/>`).join('');
  if (d.kind === 'chase') {
    const ry2 = Math.max(d.ch * 0.5, d.cw * 0.5 * k);
    const mark = (p: Pt, n: number) => `<g class="ord-num"><circle cx="${f(p.x)}" cy="${f(p.y - ry2 * 1.15)}" r="${f(s * 0.17)}" fill="#7a120a" stroke="#ffd9d2" stroke-width="1.5"/><text x="${f(p.x)}" y="${f(p.y - ry2 * 1.15 + s * 0.065)}" text-anchor="middle" font-size="${f(s * 0.2)}" font-weight="800" fill="#fff">${n}</text></g>`;
    if (d.chain && d.chain.length) {
      out += mark(d.end, 1);
      let from = d.end;
      d.chain.forEach((p, i) => { out += `<path class="ord-next" d="M${f(from.x)},${f(from.y)} L${f(p.x)},${f(p.y)}" fill="none" stroke="${ink}" stroke-opacity=".6" stroke-width="${f(w * 0.6)}" stroke-linecap="round" stroke-dasharray="7 7"/>` + mark(p, i + 2); from = p; });
    }
  }
  return `<g class="ord" data-uid="${d.uid}" data-kind="${d.kind}"${d.preview ? ' opacity=".85"' : ''}>${out}</g>`;
}

/** Ken, Nov 1: a chaser at rest only shows a small red ring (a marker circle on the ground) on its current target. */
export function restTargetSvg(p: Pt, cw: number, ch: number): string {
  const k = Math.max(0.3, Math.min(1, ch / cw)), r = cw * 0.4, pts: V[] = [], a0 = 0.6;
  for (let i = 0; i <= 28; i++) { const t = i / 28, a = a0 + t * (Math.PI * 2 + 0.6), g = 1 + 0.08 * t; pts.push({ x: p.x + Math.cos(a) * r * g, y: p.y / k + Math.sin(a) * r * g }); }
  return `<path class="ord-rest" d="${pen(pts, Math.max(3, cw * 0.07), k, 1.3, 0.2)}" fill="#ff4a3d" fill-opacity=".6"/>`;
}

/** Ken, Nov 1: a unit with no instruction yet wears a yellow highlighter question mark over its head (upright, not flat on the ground). */
export function questionSvg(p: Pt, cw: number, ch: number, uid: string): string {
  const r = rng(uid + 'q'), ph = r() * 6, s = Math.min(cw, ch * 1.6) * 0.3;
  const P = (u: number, v: number): V => ({ x: p.x + u * s, y: p.y - ch * 1.05 + v * s });
  const hook = dense([P(-0.62, -0.5), P(-0.5, -0.95), P(0, -1.15), P(0.52, -0.92), P(0.58, -0.4), P(0.2, 0.12), P(0.02, 0.45), P(0.02, 0.62)]);
  const dot: V[] = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2 + 0.4; dot.push({ x: p.x + 0.02 * s + Math.cos(a) * 0.13 * s, y: p.y - ch * 1.05 + 1.08 * s + Math.sin(a) * 0.13 * s }); }
  const w = s * 0.34;
  return `<g class="ord-q" data-uid="${uid}"><path d="${pen(hook, w, 1, ph, 0.12)}" fill="#ffe84a" fill-opacity=".62"/><path d="${pen(dot, w * 0.8, 1, ph + 1, 0.05)}" fill="#ffe84a" fill-opacity=".7"/></g>`;
}

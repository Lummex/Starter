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

/** Stroke the same path twice: a dark edge underneath, the chalk line on top. */
function chalk(path: string, w: number, color: string, extra = '') {
  return `<path d="${path}" fill="none" stroke="#0b0906" stroke-opacity=".82" stroke-width="${f(w + 3.6)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`
    + `<path d="${path}" fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
}

/** One order as an SVG group. */
export function orderSvg(d: OrderDrawing): string {
  const r = rng(d.uid + d.kind);
  const s = Math.min(d.cw, d.ch * 1.6);
  const w = Math.max(2.6, Math.min(7, s * 0.075));
  const ink = '#f7f2df', red = '#ff5a4a';
  const pts = routePoints(d, r);
  let out = '';
  if (d.kind === 'chase') {
    // the circle around the target: a little over one loop, slightly spiralling, so it reads as drawn by hand
    const rx = d.cw * 0.5, ry = Math.max(d.ch * 0.5, rx * 0.42), a0 = r() * Math.PI * 2, ph = r() * 6, loop: Pt[] = [];
    for (let k = 0; k <= 26; k++) {
      const t = k / 26, a = a0 + t * (Math.PI * 2 + 0.75), g = 1 + 0.1 * t + 0.05 * Math.sin(3 * a + ph);
      loop.push({ x: d.end.x + Math.cos(a) * rx * g, y: d.end.y + Math.sin(a) * ry * g });
    }
    // the route stops at the circle's edge
    const last = pts[pts.length - 1];
    if (pts.length >= 2 && Math.hypot(last.x - d.end.x, last.y - d.end.y) < 1) pts.pop();
    const from = pts[pts.length - 1] || d.end, dx = from.x - d.end.x, dy = from.y - d.end.y, L = Math.hypot(dx / rx, dy / ry);
    if (L > 1.05) pts.push({ x: d.end.x + dx / L, y: d.end.y + dy / L });
    if (pts.length >= 2) out += chalk(smooth(pts), w, ink);
    out += chalk(smooth(loop, 0.6), w, d.blocked ? red : ink, ' class="ord-circle"');
  } else {
    if (pts.length >= 2) out += chalk(smooth(pts), w, ink);
    // the X: two slightly bowed strokes
    const x = s * 0.2, b = s * 0.035, e = d.end, j = () => (r() - 0.5) * x * 0.18;
    const s1 = `M${f(e.x - x + j())},${f(e.y - x * 0.7 + j())} Q${f(e.x + b)},${f(e.y - b)} ${f(e.x + x + j())},${f(e.y + x * 0.7 + j())}`;
    const s2 = `M${f(e.x + x + j())},${f(e.y - x * 0.7 + j())} Q${f(e.x - b)},${f(e.y - b)} ${f(e.x - x + j())},${f(e.y + x * 0.7 + j())}`;
    out += chalk(s1 + ' ' + s2, w * 1.25, d.blocked ? red : ink, ' class="ord-x"');
  }
  return `<g class="ord" data-uid="${d.uid}" data-kind="${d.kind}"${d.preview ? ' opacity=".85"' : ''}>${out}</g>`;
}

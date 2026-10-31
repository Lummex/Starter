// Board geometry for the painted arena: the owner's four floor corners -> 13 x 7 squares by a perspective (homography)
// mapping (same math as the Arena Editor's drawGrid), plus the 3D camera that makes pieces stand on the painted floor.
import layout from '../content/arena-layout.json';

export type Pt = [number, number];
export type Mat3 = number[]; // row-major

export const ARENA_PIC = { w: 1672, h: 941 };
export const BG = { w: 1672, h: 941 };
/** board spaces: world x = col - 7, world z = row - 4 (cell centres); edges at +-6.5 and +-3.5 */
export const BOARD = { cols: 13, rows: 7 };

/** unit square (u right, v down) -> quad P (TL, TR, BR, BL); the editor's `homog` as a matrix. */
export function homographyMatrix(P: Pt[]): Mat3 {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = P;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}
export function applyH(m: Mat3, u: number, v: number): Pt {
  const w = m[6] * u + m[7] * v + m[8];
  return [(m[0] * u + m[1] * v + m[2]) / w, (m[3] * u + m[4] * v + m[5]) / w];
}
export const inverse3 = (m: Mat3): Mat3 => {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
};

/** The owner's corners in background-picture pixels (arena picture pixels -> background via centre/scale). */
export function cornersInBackground(l = layout): Pt[] {
  const { centerX, centerY, scale } = l.arena;
  return (l.boardCorners as Pt[]).map(([x, y]) => [centerX + (x - ARENA_PIC.w / 2) * scale, centerY + (y - ARENA_PIC.h / 2) * scale] as Pt);
}

export const boardHomography = (): Mat3 => homographyMatrix(cornersInBackground());
/** position on the floor in board spaces (x right, z toward the player) -> background pixels */
export function groundToPainting(H: Mat3, x: number, z: number): Pt {
  return applyH(H, (x + BOARD.cols / 2) / BOARD.cols, (z + BOARD.rows / 2) / BOARD.rows);
}
/** square (1-based row, col) -> centre and 4 corners (TL, TR, BR, BL) in background pixels */
export function cellGeometry(H: Mat3, row: number, col: number) {
  const u = (c: number) => c / BOARD.cols, v = (r: number) => r / BOARD.rows;
  const q: Pt[] = [[col - 1, row - 1], [col, row - 1], [col, row], [col - 1, row]].map(([c, r]) => applyH(H, u(c), v(r)) as Pt);
  return { center: applyH(H, u(col - 0.5), v(row - 0.5)), quad: q };
}

export interface Fit {
  /** 3 x 4 projection (row-major, columns x, y up, z toward the player, 1) from the world to background pixels (homogeneous); w = depth in spaces */
  P: number[];
  /** camera position in world space and its three.js axes (right, up, back), for lighting */
  pos: [number, number, number];
  right: [number, number, number];
  up: [number, number, number];
  back: [number, number, number];
  f: number;
}

type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

/**
 * Camera for the painted floor. The ground columns of P are the board homography itself, so every square lands exactly on the
 * painting; the height column comes from decomposing that homography (principal point at the picture centre, focal length from
 * the orthogonality of the two floor axes), so a piece of height 1 stands 1 space tall in correct perspective.
 */
export function fitCamera(H: Mat3): Fit {
  const px = BG.w / 2, py = BG.h / 2;
  const col = (u: V3): V3 => [H[0] * u[0] + H[1] * u[1] + H[2] * u[2], H[3] * u[0] + H[4] * u[1] + H[5] * u[2], H[6] * u[0] + H[7] * u[1] + H[8] * u[2]];
  let gx = col([1 / BOARD.cols, 0, 0]), gz = col([0, 1 / BOARD.rows, 0]), g1 = col([0.5, 0.5, 1]);
  const rel = (g: V3): V3 => [g[0] - px * g[2], g[1] - py * g[2], g[2]];
  let f2 = -(rel(gx)[0] * rel(gz)[0] + rel(gx)[1] * rel(gz)[1]) / (rel(gx)[2] * rel(gz)[2]);
  if (!(f2 > 1e4)) f2 = (BG.h / 2 / Math.tan((48 * Math.PI) / 360)) ** 2;
  const f = Math.sqrt(f2);
  const kin = (g: V3): V3 => { const r = rel(g); return [r[0] / f, r[1] / f, r[2]]; };
  // scale so the x axis is one space per unit; the sign puts the board in front of the camera
  let lam = 1 / len(kin(gx));
  if (g1[2] * lam < 0) lam = -lam;
  gx = scale(gx, lam); gz = scale(gz, lam); g1 = scale(g1, lam);
  const mx = kin(gx), mt = kin(g1);
  const rx = scale(mx, 1 / len(mx));
  const mz = kin(gz);
  let rz = mz.map((v, i) => v - dot(mz, rx) * rx[i]) as V3;
  rz = scale(rz, 1 / len(rz));
  const ry = cross(rz, rx);
  let cy: V3 = [f * ry[0] + px * ry[2], f * ry[1] + py * ry[2], ry[2]];
  // "up" must go up the picture
  const vOf = (c: V3) => (g1[1] + c[1]) / (g1[2] + c[2]);
  if (vOf(cy) > g1[1] / g1[2]) cy = scale(cy, -1);
  const P: number[] = [];
  for (let r = 0; r < 3; r++) P.push(gx[r], cy[r], gz[r], g1[r]);
  // pose: camera x right, y down, z forward; world -> camera rotation has columns rx, ry, rz and translation mt
  const C: V3 = [-dot(rx, mt), -dot(ry, mt), -dot(rz, mt)];
  const right: V3 = [rx[0], ry[0], rz[0]], down: V3 = [rx[1], ry[1], rz[1]], fwd: V3 = [rx[2], ry[2], rz[2]];
  return { P, pos: C, right, up: scale(down, -1), back: scale(fwd, -1), f };
}

/** project a world point (board spaces) to background pixels with a fit */
export function projectWorld(P: number[], x: number, y: number, z: number): Pt {
  const u = P[0] * x + P[1] * y + P[2] * z + P[3], v = P[4] * x + P[5] * y + P[6] * z + P[7], w = P[8] * x + P[9] * y + P[10] * z + P[11];
  return [u / w, v / w];
}

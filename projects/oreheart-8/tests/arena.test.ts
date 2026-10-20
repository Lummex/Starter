import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import layout from '../src/content/arena-layout.json';
import { boardHomography, cellGeometry, cornersInBackground, applyH, fitCamera, projectWorld, groundToPainting, BOARD } from '../src/ui/arena-geo';

const near = (a: number[], b: number[], eps = 0.01) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(eps));

describe('painted arena (round 8a)', () => {
  it('uses the owner files unchanged', () => {
    const owner = JSON.parse(fs.readFileSync('../../factory-design/design/references/skullfang-arena-layout.json', 'utf8'));
    expect(layout).toEqual(owner);
    expect(layout.effects.length).toBe(54);
    expect(layout.foregroundCutouts.length).toBe(2);
    for (const f of ['skullfang-arena.png', 'skullfang-swamp-background.jpg', 'skullfang-arena-layout.json']) expect(fs.existsSync('public/art/arena/' + f)).toBe(true);
  });
  it('maps the 13 x 7 squares onto the four floor corners (homography)', () => {
    const H = boardHomography(), C = cornersInBackground();
    near(applyH(H, 0, 0), C[0]); near(applyH(H, 1, 0), C[1]); near(applyH(H, 1, 1), C[2]); near(applyH(H, 0, 1), C[3]);
    // outer squares touch the corners; centres are inside
    near(cellGeometry(H, 1, 1).quad[0], C[0]); near(cellGeometry(H, 1, 13).quad[1], C[1]);
    near(cellGeometry(H, 7, 13).quad[2], C[2]); near(cellGeometry(H, 7, 1).quad[3], C[3]);
    const mid = cellGeometry(H, 4, 7).center;
    expect(mid[0]).toBeGreaterThan(700); expect(mid[0]).toBeLessThan(950);
    // squares shrink toward the far row (perspective)
    const w = (r: number) => Math.abs(cellGeometry(H, r, 7).quad[1][0] - cellGeometry(H, r, 7).quad[0][0]);
    expect(w(1)).toBeLessThan(w(7));
  });
  it('the 3D camera puts every floor point on the painted square', () => {
    const H = boardHomography(), fit = fitCamera(H);
    for (const [r, c] of [[1, 1], [1, 12], [7, 2], [4, 7], [7, 13]]) {
      const g = cellGeometry(H, r, c).center;
      near(projectWorld(fit.P, c - (BOARD.cols + 1) / 2, 0, r - (BOARD.rows + 1) / 2), g, 0.05);
      near(groundToPainting(H, c - 7, r - 4), g, 0.05);
    }
    // things stand upward on screen and the camera looks down from the player's side
    const base = projectWorld(fit.P, 0, 0, 0), top = projectWorld(fit.P, 0, 1.5, 0);
    expect(top[1]).toBeLessThan(base[1] - 40);
    expect(fit.pos[1]).toBeGreaterThan(3); expect(fit.pos[2]).toBeGreaterThan(0);
  });
  it('ships the Meshy crystal mine once', () => {
    const j = JSON.parse(fs.readFileSync('public/models/mine/mine.json', 'utf8'));
    expect(j.task).toBeTruthy();
    expect(fs.statSync('public/models/mine/crystal-mine.glb').size).toBeLessThan(4e6);
  });
});

"""Check pack clips on real units (the game's way: retarget by bone name at load, see ohrt.py).
Run with Blender's python (has numpy):  python packcheck.py PACK.glb UNITS_DIR OUT_DIR [clip,clip...]
UNITS_DIR holds plain (meshopt-free) unit GLBs; default units: goblin-grunt, gnome-cogger, dwarf-miner, the-great-steam-golem.
Writes OUT_DIR/check.json and OUT_DIR/<clip>.png (rows = units; 8 frames, front + side silhouettes;
red dot = right hand, red line = the way a held prop points).
Numbers are % of the unit's height:
  sink   = how far the lowest point goes below the unit's normal floor (its own Idle frame 0)
  lift   = how far the lowest point is ABOVE the floor at the clip's frame 0 (should be ~0)
  slide  = largest sideways drift of a planted foot (lowest foot) during the clip
  seam   = first vs last frame difference (loops should be ~0)
  wrist  = largest bend of a hand vs its forearm (deg); kneeRev = knee bent backwards (deg, should be 0)
"""
import sys, os, json, zlib, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import ohrt

UNITS = os.environ.get('UNITS', 'goblin-grunt,gnome-cogger,dwarf-miner,the-great-steam-golem').split(',')


def png(path, img):
    h, w, _ = img.shape
    raw = b''.join(b'\x00' + img[y].astype(np.uint8).tobytes() for y in range(h))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


def ang(a, b):
    return np.degrees(np.arccos(np.clip(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12), -1, 1)))


def main():
    pack, udir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out, exist_ok=True)
    P = ohrt.Glb(pack, mesh=False)
    want = sys.argv[4].split(',') if len(sys.argv) > 4 and sys.argv[4] else list(P.anims)
    units = [(u, ohrt.Glb(os.path.join(udir, u + '.glb'), sub=2)) for u in UNITS]
    res = {}
    rts = {u: ohrt.Retarget(P, g) for u, g in units}
    base = {}
    for u, g in units:
        W = g.world(*g.local_at(g.clip('Idle'), 0)); V = g.verts(W)
        base[u] = (V[:, 1].min(), V[:, 1].max() - V[:, 1].min())
    for clip in want:
        ch = P.clip(clip); dur = P.duration(clip); nf = ohrt.frames_of(dur)
        res[clip] = {'frames': nf}
        tiles = []
        for u, g in units:
            rt = rts[u]; floor, H = base[u]
            lows, feet, wr, er, kr = [], [], 0, 0, 0
            Vs = {}
            Wh0 = rt.Wt[g.byname['Hips']][:3, :3]
            pick = sorted(set([round(nf * k / 7) for k in range(8)]))
            for f in range(0, nf + 1):
                T, R, S = rt.pose(ch, f / 30); W = g.world(T, R, S)
                V = g.verts(W)
                lows.append(V[:, 1].min())
                if f in pick or f == 0 or f == nf: Vs[f] = (V, W)
                fl = [W[g.byname[n]][:3, 3] for n in ('LeftFoot', 'RightFoot')]
                feet.append(fl)
                for s in ('Left', 'Right'):
                    J = lambda n: W[g.byname[n]][:3, 3]
                    up, fo, ha = J(s + 'Arm'), J(s + 'ForeArm'), J(s + 'Hand')
                    # hand direction: hand local +Y axis (bone axis in glTF Meshy rigs) vs forearm direction
                    hd = W[g.byname[s + 'Hand']][:3, :3] @ np.array([0, 1, 0])
                    wr = max(wr, ang(ha - fo, hd))
                    th, kn, an = J(s + 'UpLeg'), J(s + 'Leg'), J(s + 'Foot')
                    fwd = W[g.byname['Hips']][:3, :3] @ np.linalg.inv(Wh0) @ np.array([0, 0, 1.0])
                    a_ = an - th; o_ = (kn - th) - a_ * np.dot(kn - th, a_) / np.dot(a_, a_)
                    bend = ang(kn - th, an - kn)
                    if bend > 15 and np.dot(o_, fwd) < -0.2 * np.linalg.norm(o_):
                        kr = max(kr, bend)
            lows = np.array(lows)
            sink = (floor - lows.min()) / H * 100
            lift0 = (lows[0] - floor) / H * 100
            # planted foot slide: per foot, frames where it is within 3% of height of its lowest point
            slide = 0
            feet = np.array(feet)  # f, 2, 3
            for k in range(2):
                y = feet[:, k, 1]; m = y < y.min() + 0.015 * H
                xz = feet[m][:, k][:, [0, 2]]
                if len(xz) > 1: slide = max(slide, np.linalg.norm(xz.max(0) - xz.min(0)) / H * 100)
            V0, VE = Vs[0][0], Vs[nf][0]
            seam = np.abs(VE - V0).max() / H * 100
            res[clip][u] = {'sink': round(sink, 1), 'lift0': round(lift0, 1), 'slide': round(slide, 1), 'seam': round(seam, 1),
                            'wrist': round(wr, 0), 'kneeRev': round(kr, 0)}
            # render tiles
            row = []
            for f in pick:
                V, W = Vs[f]
                for view in (0, 2):
                    row.append(tile(V, W, g, floor, H, view, view == 2))
            tiles.append(np.concatenate(row, 1))
        png(os.path.join(out, clip + '.png'), np.concatenate(tiles, 0))
        print(clip, json.dumps({u: res[clip][u] for u, _ in units}))
    json.dump(res, open(os.path.join(out, 'check.json'), 'w'), indent=1)


def tile(V, W, g, floor, H, axis, side):
    S = 170
    img = np.full((S, S, 3), (238, 236, 230) if not side else (226, 232, 238), np.uint8)
    c = H * 1.5
    def to_px(p):
        x = (p[..., axis] / c + 0.5) * S
        if axis == 0: x = S - x  # front view: character's right on screen left
        y = S - ((p[..., 1] - floor) / c * S + S * 0.12)
        return x.astype(int), y.astype(int)
    x, y = to_px(V)
    m = (x >= 0) & (x < S) & (y >= 0) & (y < S)
    for dx in (0, 1):
        for dy in (0, 1):
            yy, xx = np.clip(y[m] + dy, 0, S - 1), np.clip(x[m] + dx, 0, S - 1)
            img[yy, xx] = (60, 70, 90)
    fy = int(S - S * 0.12)
    img[fy, :] = (150, 150, 150)
    h = W[g.byname['RightHand']][:3, 3]; d = W[g.byname['RightHand']][:3, :3] @ np.array([0, 1, 0])
    d = d / np.linalg.norm(d) * H * 0.25
    for t in np.linspace(0, 1, 25):
        px, py = to_px(h + d * t)
        if 0 <= px < S and 0 <= py < S: img[py, px] = (220, 30, 30)
    px, py = to_px(h)
    img[max(0, py-1):py+2, max(0, px-1):px+2] = (220, 30, 30)
    img[:, -1] = (180, 180, 180)
    return img


if __name__ == '__main__':
    main()

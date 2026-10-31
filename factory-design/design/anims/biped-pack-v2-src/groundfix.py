"""Lift the pack's Hips so a clip never sinks into the floor on any test unit (game retarget, see ohrt.py).
python groundfix.py in.glb out.glb UNITS_DIR spec.json      spec: {"clip": "const"|"frame", ...}
const = one lift for the whole clip (walks, runs, idles: keeps the bob); frame = per-frame lift (lying, falls), smoothed.
Only the Hips translation output of those clips changes (same keys)."""
import sys, os, json, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import ohrt

src, dst, udir, specf = sys.argv[1:5]
spec = json.load(open(specf))
P = ohrt.Glb(src, mesh=False)
names = os.environ.get('UNITS', 'goblin-grunt,gnome-cogger,dwarf-miner,the-great-steam-golem').split(',')
units = [ohrt.Glb(os.path.join(udir, u + '.glb'), sub=3) for u in names]
rts = [ohrt.Retarget(P, g) for g in units]
base = []
for g in units:
    V = g.verts(g.world(*g.local_at(g.clip('Idle'), 0)))
    base.append((V[:, 1].min(), V[:, 1].max() - V[:, 1].min()))
hips = P.byname['Hips']
par = P.parent[hips]
Wp = P.world(P.T0, P.R0, P.S0)[par]
inv_par = np.linalg.inv(Wp[:3, :3])  # world -> hips parent space
margin = float(os.environ.get('MARGIN', '0.008'))  # fraction of unit height kept above the floor

j = P.j
blob = bytearray(P.BIN)
for an in j['animations']:
    mode = spec.get(an['name'])
    if not mode:
        continue
    ch = next(c for c in an['channels'] if c['target'].get('node') == hips and c['target']['path'] == 'translation')
    smp = an['samplers'][ch['sampler']]
    t = P.acc(smp['input'])[:, 0]
    chs = P.clip(an['name'])
    lift = np.zeros(len(t))
    for k, tt in enumerate(t):
        need = 0.0
        for g, rt, (floor, H) in zip(units, rts, base):
            V = g.verts(g.world(*rt.pose(chs, tt)))
            deficit = (floor + margin * H) - V[:, 1].min()
            need = max(need, deficit / rt.ratio)
        lift[k] = need if mode == 'contact' else max(0.0, need)
    if mode == 'const':
        lift[:] = lift.max()
    elif mode == 'contact':  # keep the lowest point on the floor every frame (light smoothing)
        lift = np.convolve(np.pad(lift, 1, mode='edge'), np.ones(3) / 3, mode='valid')
    else:  # per frame: widen then smooth so it eases in and out
        L = lift.copy()
        for k in range(len(L)):
            L[k] = lift[max(0, k - 4):k + 5].max()
        ker = np.ones(7) / 7
        lift = np.convolve(np.pad(L, 3, mode='edge'), ker, mode='valid')
    a = j['accessors'][smp['output']]; bv = j['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(bytes(blob[off:off + a['count'] * 12]), np.float32).reshape(-1, 3).copy()
    arr += (inv_par @ np.array([0, 1.0, 0]))[None, :] * lift[:, None]
    blob[off:off + a['count'] * 12] = arr.astype(np.float32).tobytes()
    print(an['name'], mode, 'lift %.3f..%.3f m' % (lift.min(), lift.max()))

b = open(src, 'rb').read(); L0 = struct.unpack('<I', b[12:16])[0]
head = b[:20 + L0 + 8]
open(dst, 'wb').write(head + bytes(blob))
print('wrote', dst)

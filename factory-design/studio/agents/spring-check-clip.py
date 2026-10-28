"""Spring clip checker (Oct 28): put glbtool.py (factory/blender-worker/blender_ops) next to this file. python3 -I spring-check-clip.py char.glb CLIP [step]; env DUMP=<frame> OUT=side.png (side point plot with floor line), JOINTS=<frame> (skin depth below each joint) -> per-frame lowest vertex, hips drift, loop seam."""
import sys, json, struct, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, glbtool
src, clip = sys.argv[1], sys.argv[2]; step = int(sys.argv[3]) if len(sys.argv) > 3 else 5
tmp = tempfile.mktemp(suffix='.glb'); glbtool.decompress(src, tmp, dequantize=True)
b = open(tmp, 'rb').read(); L = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20+L]); BIN = b[20+L+8:]
CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8, 5122: np.int16, 5120: np.int8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride', 0)
    if st and st != dt.itemsize*n:
        raw = np.frombuffer(BIN, np.uint8, a['count']*st, off).reshape(a['count'], st); arr = raw[:, :dt.itemsize*n].copy().view(dt).reshape(a['count'], n)
    else: arr = np.frombuffer(BIN, dt, a['count']*n, off).reshape(a['count'], n)
    arr = arr.astype(np.float64)
    if a.get('normalized'): arr = arr / {5121: 255, 5123: 65535, 5120: 127, 5122: 32767}.get(a['componentType'], 1)
    return arr
def q2m(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
nodes = j['nodes']; parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
T0 = {i: np.array(n.get('translation', [0, 0, 0]), float) for i, n in enumerate(nodes)}
R0 = {i: np.array(n.get('rotation', [0, 0, 0, 1]), float) for i, n in enumerate(nodes)}
S0 = {i: np.array(n.get('scale', [1, 1, 1]), float) for i, n in enumerate(nodes)}
an = next(a for a in j['animations'] if a['name'] == clip)
chans = []
for ch in an['channels']:
    s = an['samplers'][ch['sampler']]; t = acc(s['input'])[:, 0]; o = acc(s['output'])
    if s.get('interpolation') == 'CUBICSPLINE': o = o[1::3]
    chans.append((ch['target'].get('node'), ch['target']['path'], t, o))
tmax = max(c[2][-1] for c in chans)
def pose(tt):
    T = dict(T0); R = dict(R0); S = dict(S0)
    for nd, p, t, o in chans:
        if nd is None or p not in ('translation', 'rotation', 'scale'): continue
        k = np.searchsorted(t, tt); k0 = max(0, min(k-1, len(t)-1)); k1 = min(k, len(t)-1)
        f = 0 if k0 == k1 else (tt-t[k0])/(t[k1]-t[k0]); f = min(max(f, 0), 1)
        v = o[k0]*(1-f) + o[k1]*f
        if p == 'rotation':
            a, bq = o[k0], o[k1]
            if np.dot(a, bq) < 0: bq = -bq
            v = a*(1-f)+bq*f; v /= np.linalg.norm(v)
        {'translation': T, 'rotation': R, 'scale': S}[p][nd] = v
    W = {}
    def world(i):
        if i not in W:
            M = np.eye(4); M[:3, :3] = q2m(R[i])*S[i]; M[:3, 3] = T[i]
            W[i] = (world(parent[i]) if i in parent else np.eye(4)) @ M
        return W[i]
    return world
cn = next(i for i, n in enumerate(nodes) if 'skin' in n and 'mesh' in n)
skin = j['skins'][nodes[cn]['skin']]
prims = j['meshes'][nodes[cn]['mesh']]['primitives']
P = np.concatenate([acc(p['attributes']['POSITION']) for p in prims]); Jn = np.concatenate([acc(p['attributes']['JOINTS_0']) for p in prims]).astype(int)
Wt = np.concatenate([acc(p['attributes']['WEIGHTS_0']) for p in prims]); IBM = acc(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
sel = np.arange(0, len(P), 7); P, Jn, Wt = P[sel], Jn[sel], Wt[sel]; Ph = np.c_[P, np.ones(len(P))]
hips = next((jn for jn in skin['joints'] if 'hips' in (nodes[jn].get('name') or '').lower()), skin['joints'][0])
def verts(world):
    jm = np.array([world(jn) @ IBM[k] for k, jn in enumerate(skin['joints'])]); M = np.einsum('vk,vkij->vij', Wt, jm[Jn])
    return np.einsum('vij,vj->vi', M, Ph)[:, :3]
fr = int(round(tmax*30)); w0 = pose(0); V0 = verts(w0); floor = V0[:, 1].min(); H = V0[:, 1].max()-floor; h0 = w0(hips)[:3, 3]
print(f'{clip}: {fr} frames, height {H:.3f}, floor {floor:.3f}')
rows = []
for f in list(range(0, fr+1, step)) + ([fr] if fr % step else []):
    w = pose(f/30); V = verts(w); hp = w(hips)[:3, 3]
    rows.append((f, (V[:, 1].min()-floor)/H*100, np.linalg.norm((hp-h0)[[0, 2]])/H*100, (hp[1]-h0[1])/H*100))
    print(f'f{f:3d} lowest {rows[-1][1]:+6.2f}%  hipsXZ {rows[-1][2]:5.1f}%  hipsY {rows[-1][3]:+6.1f}%')
VE = verts(pose(fr/30)); print('loop seam (first vs last), % height:', round(np.abs(VE-V0).max()/H*100, 2))
print('worst below floor %:', round(min(r[1] for r in rows), 2), ' max hips XZ drift %:', round(max(r[2] for r in rows), 1))
if os.environ.get('DUMP'):
    f = int(os.environ['DUMP']); V = verts(pose(f/30))
    print('frame', f, 'y min/max', V[:,1].min(), V[:,1].max(), 'x', V[:,0].min(), V[:,0].max(), 'z', V[:,2].min(), V[:,2].max())
    import PIL.Image as I
    img = np.full((400, 400), 255, np.uint8)
    # side view (z horizontal, y vertical), floor line at y=0
    zs = ((V[:,2]+1.0)/2.0*399).clip(0,399).astype(int); ys = (399-(V[:,1]+0.6)/1.8*399).clip(0,399).astype(int)
    img[ys, zs] = 0; fy = int(399-(0+0.6)/1.8*399); img[fy, :] = 128
    I.fromarray(img).save(os.environ.get('OUT', 'side.png'))
if os.environ.get('JOINTS'):
    f = int(os.environ['JOINTS']); w = pose(f/30); V = verts(w)
    dom = Jn[np.arange(len(Jn)), Wt.argmax(1)]
    for k, jn in enumerate(skin['joints']):
        m = dom == k
        if not m.any(): continue
        jy = w(jn)[1, 3]; vmin = V[m, 1].min()
        print(f"{nodes[jn].get('name'):14s} joint y {jy/H*100:6.1f}%  lowest skin {vmin/H*100:6.1f}%  skin below joint {(jy-vmin)/H*100:5.1f}%")

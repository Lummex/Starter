#!/usr/bin/env python3
"""Spring's start-image renderer v2 (Oct 28): character + held items (no helpers), posed at frame 0 of a clip,
orthographic FRONT view only, grey wall + floor, 960x960.
Usage: spring-render2.py scene.glb clipname out.jpg
Renders: the skinned character node + named rigid meshes ("mesh_0"/"Mesh_0", Model Editor accessories) under the
first scene root. Skips: other scene roots ("Person 6 ft") and unnamed rigid meshes ("Solid part" box)."""
import sys, json, struct, io
import numpy as np
from PIL import Image

glb, clip, outp = sys.argv[1], sys.argv[2], sys.argv[3]
b = open(glb, 'rb').read()
L = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + L])
BIN = b[20 + L + 8:]
CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8, 5122: np.int16, 5120: np.int8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', 0)
    if stride and stride != dt.itemsize * n:
        raw = np.frombuffer(BIN, np.uint8, a['count'] * stride, off).reshape(a['count'], stride)
        arr = raw[:, :dt.itemsize * n].copy().view(dt).reshape(a['count'], n)
    else:
        arr = np.frombuffer(BIN, dt, a['count'] * n, off).reshape(a['count'], n)
    arr = arr.astype(np.float64)
    if a.get('normalized'):
        arr = arr / np.iinfo(CT[a['componentType']]).max
    return arr

def q2m(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                     [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])

nodes = j['nodes']
T = {i: list(n.get('translation', [0, 0, 0])) for i, n in enumerate(nodes)}
R = {i: list(n.get('rotation', [0, 0, 0, 1])) for i, n in enumerate(nodes)}
S = {i: list(n.get('scale', [1, 1, 1])) for i, n in enumerate(nodes)}
for i, n in enumerate(nodes):
    if 'matrix' in n:
        M = np.array(n['matrix']).reshape(4, 4).T
        T[i] = list(M[:3, 3]); sc = np.linalg.norm(M[:3, :3], axis=0); S[i] = list(sc)
        Rm = M[:3, :3] / sc
        w = np.sqrt(max(0, 1 + Rm[0, 0] + Rm[1, 1] + Rm[2, 2])) / 2
        R[i] = [(Rm[2, 1]-Rm[1, 2])/(4*w), (Rm[0, 2]-Rm[2, 0])/(4*w), (Rm[1, 0]-Rm[0, 1])/(4*w), w]
anim = next((a for a in j.get('animations', []) if a.get('name') == clip), None)
if clip != 'rest':
    assert anim, 'no clip ' + clip
    for ch in anim['channels']:
        smp = anim['samplers'][ch['sampler']]
        out = acc(smp['output'])
        v = list(out[0]) if smp.get('interpolation') != 'CUBICSPLINE' else list(out[1])
        p = ch['target']['path']; nd = ch['target'].get('node')
        if nd is None or p not in ('translation', 'rotation', 'scale'): continue
        {'translation': T, 'rotation': R, 'scale': S}[p][nd] = v

def local(i):
    M = np.eye(4); M[:3, :3] = q2m(R[i]) * np.array(S[i]); M[:3, 3] = T[i]; return M
parent = {}
for i, n in enumerate(nodes):
    for c in n.get('children', []): parent[c] = i
W = {}
def world(i):
    if i not in W: W[i] = (world(parent[i]) if i in parent else np.eye(4)) @ local(i)
    return W[i]
def root(i):
    while i in parent: i = parent[i]
    return i

main_root = j['scenes'][j.get('scene', 0)]['nodes'][0]
texcache = {}
def texture(mat):
    pbr = mat.get('pbrMetallicRoughness', {})
    fac = np.array(pbr.get('baseColorFactor', [1, 1, 1, 1])[:3])
    ti = pbr.get('baseColorTexture')
    if not ti: return None, fac, None
    src = j['textures'][ti['index']]['source']
    if src not in texcache:
        img = j['images'][src]; bv = j['bufferViews'][img['bufferView']]
        o = bv.get('byteOffset', 0)
        texcache[src] = np.asarray(Image.open(io.BytesIO(BIN[o:o + bv['byteLength']])).convert('RGB')).astype(np.float32) / 255
    tt = ti.get('extensions', {}).get('KHR_texture_transform')
    return texcache[src], fac, tt

parts = []  # (V, N, UV, IDX, tex, fac, tt)
for i, n in enumerate(nodes):
    if 'mesh' not in n or root(i) != main_root: continue
    is_char = 'skin' in n
    if not is_char and (n.get('name') or '').lower() != 'mesh_0': continue
    for prim in j['meshes'][n['mesh']]['primitives']:
        at = prim['attributes']
        P = acc(at['POSITION']); N = acc(at['NORMAL']) if 'NORMAL' in at else np.zeros_like(P) + [0, 0, 1]
        UV = acc(at['TEXCOORD_0']) if 'TEXCOORD_0' in at else np.zeros((len(P), 2))
        IDX = (acc(prim['indices']).astype(int) if 'indices' in prim else np.arange(len(P))).reshape(-1, 3)
        Ph = np.c_[P, np.ones(len(P))]
        if is_char:
            skin = j['skins'][n['skin']]
            Jn = acc(at['JOINTS_0']).astype(int); Wt = acc(at['WEIGHTS_0'])
            IBM = acc(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
            jm = np.array([world(jn) @ IBM[k] for k, jn in enumerate(skin['joints'])])
            M = np.einsum('vk,vkij->vij', Wt, jm[Jn])
            V = np.einsum('vij,vj->vi', M, Ph)[:, :3]
            Nn = np.einsum('vij,vj->vi', M[:, :3, :3], N)
        else:
            M = world(i)
            V = (Ph @ M.T)[:, :3]; Nn = N @ np.linalg.inv(M[:3, :3])
        Nn /= np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-9
        tex, fac, tt = texture(j['materials'][prim['material']]) if 'material' in prim else (None, np.array([.7, .7, .7]), None)
        if tt:
            off = np.array(tt.get('offset', [0, 0])); sc = np.array(tt.get('scale', [1, 1])); r = tt.get('rotation', 0)
            c, s = np.cos(r), np.sin(r)
            UV = (UV * sc) @ np.array([[c, s], [-s, c]]) + off
        parts.append((V, Nn, UV, IDX, tex, fac))
        print('part', i, n.get('name'), len(IDX), 'tris')

allV = np.concatenate([p[0] for p in parts])
lo, hi = allV.min(0), allV.max(0); h = hi[1] - lo[1]
Wd = Ht = 960; ss = 2
W2, H2 = Wd * ss, Ht * ss
scale = H2 * 0.80 / max(h, (hi[0] - lo[0]) * 0.95)
cx = (lo[0] + hi[0]) / 2
col = np.zeros((H2, W2, 3), np.float32); col[:] = np.array([0.54, 0.55, 0.58])
hz = int(H2 * 0.60); col[hz:] = np.array([0.46, 0.47, 0.50])
zb = np.full((H2, W2), -1e9)
L1 = np.array([0.4, 0.6, 0.7]); L1 /= np.linalg.norm(L1)
for V, n, UV, IDX, tex, fac in parts:
    sx = (V[:, 0] - cx) * scale + W2 / 2
    sy = H2 * 0.90 - (V[:, 1] - lo[1]) * scale
    sz = V[:, 2]
    for t in IDX:
        x = sx[t]; y = sy[t]
        x0, x1 = int(max(np.floor(x.min()), 0)), int(min(np.ceil(x.max()), W2 - 1))
        y0, y1 = int(max(np.floor(y.min()), 0)), int(min(np.ceil(y.max()), H2 - 1))
        if x1 < x0 or y1 < y0: continue
        d = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2])
        if abs(d) < 1e-12: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        w0 = ((y[1] - y[2]) * (gx - x[2]) + (x[2] - x[1]) * (gy - y[2])) / d
        w1 = ((y[2] - y[0]) * (gx - x[2]) + (x[0] - x[2]) * (gy - y[2])) / d
        w2 = 1 - w0 - w1
        m = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not m.any(): continue
        z = w0 * sz[t[0]] + w1 * sz[t[1]] + w2 * sz[t[2]]
        sub = zb[y0:y1 + 1, x0:x1 + 1]
        m &= z > sub
        if not m.any(): continue
        sub[m] = z[m]
        nn = w0[m, None] * n[t[0]] + w1[m, None] * n[t[1]] + w2[m, None] * n[t[2]]
        nn /= np.linalg.norm(nn, axis=1, keepdims=True) + 1e-9
        shade = 0.55 + 0.55 * np.abs(nn @ L1)
        if tex is not None:
            TH, TW = tex.shape[:2]
            uv = w0[m, None] * UV[t[0]] + w1[m, None] * UV[t[1]] + w2[m, None] * UV[t[2]]
            tx = np.clip((uv[:, 0] % 1) * TW, 0, TW - 1).astype(int); ty = np.clip((uv[:, 1] % 1) * TH, 0, TH - 1).astype(int)
            c = tex[ty, tx] * fac
        else:
            c = np.tile(fac, (m.sum(), 1))
        col[y0:y1 + 1, x0:x1 + 1][m] = np.clip(c * shade[:, None], 0, 1)
im = Image.fromarray((col * 255).astype(np.uint8)).resize((Wd, Ht), Image.LANCZOS)
im.save(outp, quality=92)
print('wrote', outp)

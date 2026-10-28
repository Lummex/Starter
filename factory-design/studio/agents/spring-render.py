#!/usr/bin/env python3
"""Tiny software renderer: goblin-bomber character only (no helpers), posed at frame 0 of a clip,
orthographic camera, front/side/back. Usage: render.py final.glb clipname outdir"""
import sys, json, struct, io
import numpy as np
from PIL import Image

glb, clip, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
b = open(glb, 'rb').read()
L = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + L])
bin_off = 20 + L + 8
BIN = b[bin_off:]
CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
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
anim = next((a for a in j.get('animations', []) if a.get('name') == clip), None)
if clip != 'rest':
    assert anim, 'no clip ' + clip
    for ch in anim['channels']:
        smp = anim['samplers'][ch['sampler']]
        out = acc(smp['output'])
        v = list(out[0]) if smp.get('interpolation') != 'CUBICSPLINE' else list(out[1])
        p = ch['target']['path']; nd = ch['target']['node']
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

# the character mesh (skinned) only
ci = next(i for i, n in enumerate(nodes) if 'skin' in n)
mesh = j['meshes'][nodes[ci]['mesh']]; skin = j['skins'][nodes[ci]['skin']]
prim = mesh['primitives'][0]; at = prim['attributes']
P = acc(at['POSITION']); N = acc(at['NORMAL']); UV = acc(at['TEXCOORD_0'])
J = acc(at['JOINTS_0']).astype(int); Wt = acc(at['WEIGHTS_0']); IDX = acc(prim['indices']).astype(int).reshape(-1, 3)
IBM = acc(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
jm = np.array([world(jn) @ IBM[k] for k, jn in enumerate(skin['joints'])])
Ph = np.c_[P, np.ones(len(P))]
skinM = np.einsum('vk,vkij->vij', Wt, jm[J])
V = np.einsum('vij,vj->vi', skinM, Ph)[:, :3]
Nn = np.einsum('vij,vj->vi', skinM[:, :3, :3], N); Nn /= np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-9

mat = j['materials'][prim['material']]
img = j['images'][j['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
bv = j['bufferViews'][img['bufferView']]
tex = np.asarray(Image.open(io.BytesIO(BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB')).astype(np.float32) / 255
TH, TW = tex.shape[:2]

def render(yaw_deg, path, Wd=960, Ht=960, ss=2):
    a = np.radians(yaw_deg)
    Ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    v = V @ Ry.T; n = Nn @ Ry.T
    lo, hi = V.min(0), V.max(0); h = hi[1] - lo[1]
    W2, H2 = Wd * ss, Ht * ss
    scale = H2 * 0.80 / h                       # character fills ~78% of frame height
    cx = (v[:, 0].min() + v[:, 0].max()) / 2
    sx = (v[:, 0] - cx) * scale + W2 / 2
    sy = H2 * 0.90 - (v[:, 1] - lo[1]) * scale  # feet near the bottom
    sz = v[:, 2]                                 # camera looks down -Z: bigger z = nearer
    # background: plain grey wall + slightly darker floor
    col = np.zeros((H2, W2, 3), np.float32); col[:] = np.array([0.54, 0.55, 0.58])
    hz = int(H2 * 0.60); col[hz:] = np.array([0.46, 0.47, 0.50])
    zb = np.full((H2, W2), -1e9)
    L1 = np.array([0.4, 0.6, 0.7]); L1 /= np.linalg.norm(L1)
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
        uv = w0[m, None] * UV[t[0]] + w1[m, None] * UV[t[1]] + w2[m, None] * UV[t[2]]
        tx = np.clip((uv[:, 0] % 1) * TW, 0, TW - 1).astype(int); ty = np.clip((uv[:, 1] % 1) * TH, 0, TH - 1).astype(int)
        nn = w0[m, None] * n[t[0]] + w1[m, None] * n[t[1]] + w2[m, None] * n[t[2]]
        nn /= np.linalg.norm(nn, axis=1, keepdims=True) + 1e-9
        lam = np.abs(nn @ L1)  # double-sided
        shade = 0.55 + 0.55 * lam
        col[y0:y1 + 1, x0:x1 + 1][m] = np.clip(tex[ty, tx] * shade[:, None], 0, 1)
    im = Image.fromarray((col * 255).astype(np.uint8)).resize((Wd, Ht), Image.LANCZOS)
    im.save(path, quality=92)

import os
os.makedirs(outdir, exist_ok=True)
for name, yaw in [('front', float(sys.argv[4]) if len(sys.argv) > 4 else 0)]:
    pass
base = float(sys.argv[4]) if len(sys.argv) > 4 else 0
for name, yaw in [('front', base), ('side', base + 90), ('back', base + 180)]:
    render(yaw, f'{outdir}/goblin-bomber--{name}.jpg')
    print('wrote', name)

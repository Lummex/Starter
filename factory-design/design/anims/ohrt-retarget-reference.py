"""Oreheart shared-clip retarget (reference implementation for the game) + checks.
Pure numpy on glTF nodes, so it does exactly what three.js will do with node names.
Method 'align' (default): per bone, target world rotation = D * C * Rt
  D  = source world rotation now * inverse(source world rest rotation)   (the source bone's change from rest)
  C  = fixed swing that turns the target bone's rest direction onto the source bone's rest direction (world, at rest);
       bones without a child (hands, toes, head_end, headfront) use their parent's C
  Rt = target world rest rotation
Hips: world offset from rest * (target leg length / source leg length).
Method 'delta': C = identity (old spring-retarget.py behaviour).
"""
import json, struct, os, sys
import numpy as np

CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8, 5122: np.int16, 5120: np.int8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def qmul(a, b):
    x1, y1, z1, w1 = a; x2, y2, z2, w2 = b
    return np.array([w1*x2 + x1*w2 + y1*z2 - z1*y2, w1*y2 - x1*z2 + y1*w2 + z1*x2,
                     w1*z2 + x1*y2 - y1*x2 + z1*w2, w1*w2 - x1*x2 - y1*y2 - z1*z2])


def qinv(q):
    return np.array([-q[0], -q[1], -q[2], q[3]]) / np.dot(q, q)


def q2m(q):
    x, y, z, w = q / np.linalg.norm(q)
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])


def m2q(m):
    t = np.trace(m)
    if t > 0:
        s = np.sqrt(t + 1) * 2; return np.array([(m[2, 1]-m[1, 2])/s, (m[0, 2]-m[2, 0])/s, (m[1, 0]-m[0, 1])/s, s/4])
    i = np.argmax(np.diag(m))
    if i == 0:
        s = np.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        return np.array([s/4, (m[0, 1]+m[1, 0])/s, (m[0, 2]+m[2, 0])/s, (m[2, 1]-m[1, 2])/s])
    if i == 1:
        s = np.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        return np.array([(m[0, 1]+m[1, 0])/s, s/4, (m[1, 2]+m[2, 1])/s, (m[0, 2]-m[2, 0])/s])
    s = np.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
    return np.array([(m[0, 2]+m[2, 0])/s, (m[1, 2]+m[2, 1])/s, s/4, (m[1, 0]-m[0, 1])/s])


def qfrom2(u, v):
    u = u / np.linalg.norm(u); v = v / np.linalg.norm(v); d = np.dot(u, v)
    if d < -0.999999:
        ax = np.cross([1, 0, 0], u)
        if np.linalg.norm(ax) < 1e-6: ax = np.cross([0, 1, 0], u)
        ax /= np.linalg.norm(ax); return np.array([*ax, 0.0])
    c = np.cross(u, v); q = np.array([*c, 1 + d]); return q / np.linalg.norm(q)


class Glb:
    def __init__(self, path, mesh=True, sub=7):
        b = open(path, 'rb').read(); L = struct.unpack('<I', b[12:16])[0]
        self.j = j = json.loads(b[20:20+L]); self.BIN = b[20+L+8:]
        self.nodes = j['nodes']
        self.parent = {c: i for i, n in enumerate(self.nodes) for c in n.get('children', [])}
        self.T0 = {i: np.array(n.get('translation', [0, 0, 0]), float) for i, n in enumerate(self.nodes)}
        self.R0 = {i: np.array(n.get('rotation', [0, 0, 0, 1]), float) for i, n in enumerate(self.nodes)}
        self.S0 = {i: np.array(n.get('scale', [1, 1, 1]), float) for i, n in enumerate(self.nodes)}
        self.skin = j['skins'][0] if j.get('skins') else None
        self.joints = self.skin['joints'] if self.skin else [i for i, n in enumerate(self.nodes) if n.get('name') == 'Hips']
        if not self.skin:  # pack without a skin: every named node under the armature
            self.joints = [i for i, n in enumerate(self.nodes) if 'mesh' not in n and n.get('name') not in (None, 'Armature')]
        self.byname = {self.nodes[i]['name']: i for i in self.joints}
        self.anims = {a['name']: a for a in j.get('animations', [])}
        self.mesh = None
        if mesh and self.skin:
            cn = [i for i, n in enumerate(self.nodes) if 'skin' in n and 'mesh' in n]
        if mesh and self.skin and cn:
            Ps, Js, Ws = [], [], []
            for c in cn:
                for p in j['meshes'][self.nodes[c]['mesh']]['primitives']:
                    Ps.append(self.acc(p['attributes']['POSITION'])); Js.append(self.acc(p['attributes']['JOINTS_0']).astype(int))
                    Ws.append(self.acc(p['attributes']['WEIGHTS_0']))
            P, Jn, Wt = np.concatenate(Ps), np.concatenate(Js), np.concatenate(Ws)
            sel = np.arange(0, len(P), sub)
            self.mesh = (np.c_[P[sel], np.ones(len(sel))], Jn[sel], Wt[sel])
            self.IBM = self.acc(self.skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)

    def acc(self, i):
        a = self.j['accessors'][i]; bv = self.j['bufferViews'][a['bufferView']]; dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride', 0)
        if st and st != dt.itemsize*n:
            raw = np.frombuffer(self.BIN, np.uint8, a['count']*st, off).reshape(a['count'], st)
            arr = raw[:, :dt.itemsize*n].copy().view(dt).reshape(a['count'], n)
        else:
            arr = np.frombuffer(self.BIN, dt, a['count']*n, off).reshape(a['count'], n)
        arr = arr.astype(np.float64)
        if a.get('normalized'):
            arr = arr / {5121: 255, 5123: 65535, 5120: 127, 5122: 32767}.get(a['componentType'], 1)
        return arr

    def clip(self, name):
        an = self.anims[name]; ch = []
        for c in an['channels']:
            s = an['samplers'][c['sampler']]; t = self.acc(s['input'])[:, 0]; o = self.acc(s['output'])
            if s.get('interpolation') == 'CUBICSPLINE': o = o[1::3]
            ch.append((c['target'].get('node'), c['target']['path'], t, o))
        return ch

    def duration(self, name):
        return max(c[2][-1] for c in self.clip(name))

    def local_at(self, ch, tt):
        T, R, S = dict(self.T0), dict(self.R0), dict(self.S0)
        for nd, p, t, o in ch or []:
            if nd is None or p not in ('translation', 'rotation', 'scale'): continue
            k = np.searchsorted(t, tt); k0 = max(0, min(k-1, len(t)-1)); k1 = min(k, len(t)-1)
            f = 0 if k0 == k1 else (tt-t[k0])/(t[k1]-t[k0]); f = min(max(f, 0), 1)
            if p == 'rotation':
                a, b = o[k0], o[k1].copy()
                if np.dot(a, b) < 0: b = -b
                v = a*(1-f)+b*f; v = v/np.linalg.norm(v)
            else:
                v = o[k0]*(1-f) + o[k1]*f
            {'translation': T, 'rotation': R, 'scale': S}[p][nd] = v
        return T, R, S

    def world(self, T, R, S):
        W = {}
        def w(i):
            if i not in W:
                M = np.eye(4); M[:3, :3] = q2m(R[i]) * S[i]; M[:3, 3] = T[i]
                W[i] = (w(self.parent[i]) if i in self.parent else np.eye(4)) @ M
            return W[i]
        for i in range(len(self.nodes)): w(i)
        return W

    def verts(self, W):
        Ph, Jn, Wt = self.mesh
        jm = np.array([W[jn] @ self.IBM[k] for k, jn in enumerate(self.skin['joints'])])
        M = np.einsum('vk,vkij->vij', Wt, jm[Jn])
        return np.einsum('vij,vj->vi', M, Ph)[:, :3]


def wrot(W, i):
    m = W[i][:3, :3]; s = np.linalg.norm(m, axis=0); return m2q(m / s)


CHILD = {'Hips': 'Spine02', 'Spine02': 'Spine01', 'Spine01': 'Spine', 'Spine': 'neck', 'neck': 'Head', 'Head': 'head_end',
         'LeftShoulder': 'LeftArm', 'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand',
         'RightShoulder': 'RightArm', 'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand',
         'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot', 'LeftFoot': 'LeftToeBase',
         'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot', 'RightFoot': 'RightToeBase'}
LEG = ['LeftUpLeg', 'LeftLeg', 'LeftFoot']


class Retarget:
    def __init__(self, src, tgt, method='align'):
        self.s, self.t = src, tgt
        self.Ws = src.world(src.T0, src.R0, src.S0); self.Wt = tgt.world(tgt.T0, tgt.R0, tgt.S0)
        self.names = [n for n in tgt.byname if n in src.byname]
        self.C = {}
        for n in self.names:
            si, ti = src.byname[n], tgt.byname[n]
            if method == 'align' and n in CHILD and CHILD[n] in src.byname and CHILD[n] in tgt.byname and n != 'Hips':
                ds = self.Ws[src.byname[CHILD[n]]][:3, 3] - self.Ws[si][:3, 3]
                dt = self.Wt[tgt.byname[CHILD[n]]][:3, 3] - self.Wt[ti][:3, 3]
                self.C[n] = qfrom2(dt, ds)
        for n in self.names:  # leaves take the parent's swing
            if n not in self.C:
                p = tgt.parent.get(tgt.byname[n]); pn = tgt.nodes[p].get('name') if p is not None else None
                self.C[n] = self.C.get(pn, np.array([0, 0, 0, 1.0]))
        def leg(g, W):
            return sum(np.linalg.norm(W[g.byname[CHILD[b]]][:3, 3] - W[g.byname[b]][:3, 3]) for b in LEG)
        self.ratio = leg(tgt, self.Wt) / leg(src, self.Ws)
        # order: parents first
        self.order = sorted(self.names, key=lambda n: self.depth(tgt, tgt.byname[n]))

    @staticmethod
    def depth(g, i):
        d = 0
        while i in g.parent: i = g.parent[i]; d += 1
        return d

    def pose(self, ch, tt):
        s, t = self.s, self.t
        Ts, Rs, Ss = s.local_at(ch, tt); W = s.world(Ts, Rs, Ss)
        T, R, S = dict(t.T0), dict(t.R0), dict(t.S0)
        want = {}
        for n in self.order:
            si, ti = s.byname[n], t.byname[n]
            D = qmul(wrot(W, si), qinv(wrot(self.Ws, si)))
            want[n] = qmul(qmul(D, self.C[n]), wrot(self.Wt, ti))
        Wt = t.world(T, R, S)  # rest worlds, parents of the skeleton (armature node) stay at rest
        for n in self.order:
            ti = t.byname[n]; p = t.parent.get(ti); pn = t.nodes[p].get('name') if p is not None else None
            pw = want[pn] if pn in want else wrot(Wt, p) if p is not None else np.array([0, 0, 0, 1.0])
            R[ti] = qmul(qinv(pw), want[n]); R[ti] /= np.linalg.norm(R[ti])
        hs, ht = s.byname['Hips'], t.byname['Hips']
        off = (W[hs][:3, 3] - self.Ws[hs][:3, 3]) * self.ratio
        p = t.parent.get(ht)
        P = Wt[p] if p is not None else np.eye(4)
        T[ht] = t.T0[ht] + np.linalg.inv(P[:3, :3]) @ off
        return T, R, S


def frames_of(dur, fps=30):
    return int(round(dur * fps))

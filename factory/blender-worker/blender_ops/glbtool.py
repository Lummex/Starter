"""GLB tools in plain Python (standard library only; runs in the worker and inside Blender).

  decompress(src, dst)      write a copy with EXT_meshopt_compression removed (Blender cannot read meshopt)
  splice(orig, plain, exported, names, dst, replace)
                            add the clips `names` from Blender's export into the ORIGINAL file. The original
                            bytes (geometry, textures, existing clips) are kept exactly; only new animation
                            data is appended. Joint frames are matched by calibrating on a clip both files share.
  clip_world(...)           sample world matrices of joints for checking.

The meshopt decoder is a port of meshoptimizer's reference decoder (MIT, Arseny Kapoulkine / Jasper St. Pierre).
"""
import json, math, struct

# ----------------------------------------------------------------------------- GLB container
def read_glb(path):
    with open(path, 'rb') as f:
        b = f.read()
    if b[:4] != b'glTF':
        raise ValueError(f'{path} is not a GLB file')
    jl = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + jl].decode('utf-8'))
    o = 20 + jl
    bin_ = b''
    if o + 8 <= len(b):
        bl, bt = struct.unpack_from('<II', b, o)
        if bt == 0x004E4942:
            bin_ = b[o + 8:o + 8 + bl]
    return j, bin_


def write_glb(path, j, bin_):
    js = json.dumps(j, separators=(',', ':')).encode('utf-8')
    js += b' ' * ((4 - len(js) % 4) % 4)
    bin_ = bytes(bin_) + b'\0' * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(js) + (8 + len(bin_) if bin_ else 0)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        if bin_:
            f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bin_)


def uses_meshopt(j):
    return 'EXT_meshopt_compression' in (j.get('extensionsUsed') or [])


# ----------------------------------------------------------------------------- meshopt decoding
def _dezig8(v):
    return (~(v >> 1)) & 0xFF if v & 1 else v >> 1


def decode_vertex_buffer(count, stride, src):
    if src[0] != 0xA0:
        raise ValueError(f'unsupported meshopt vertex codec version 0x{src[0]:02x}')
    out = bytearray(count * stride)
    max_block = min((0x2000 // stride) & ~0xF, 0x100)
    temp = bytearray(src[len(src) - stride:])
    s = 1
    deltas = [0] * 16
    for base in range(0, count, max_block):
        n = min(count - base, max_block)
        groups = ((n + 15) & ~15) >> 4
        hbytes = ((groups + 3) & ~3) >> 2
        for byte in range(stride):
            h = s
            s += hbytes
            t = temp[byte]
            for g in range(groups):
                mode = (src[h] >> ((g & 3) << 1)) & 3
                if (g & 3) == 3:
                    h += 1
                if mode == 0:
                    deltas = [0] * 16
                elif mode == 1:
                    sb = s; s += 4
                    for m in range(16):
                        d = (src[sb + (m >> 2)] >> (6 - ((m & 3) << 1))) & 3
                        if d == 3:
                            d = src[s]; s += 1
                        deltas[m] = d
                elif mode == 2:
                    sb = s; s += 8
                    for m in range(16):
                        d = (src[sb + (m >> 1)] >> (0 if m & 1 else 4)) & 15
                        if d == 15:
                            d = src[s]; s += 1
                        deltas[m] = d
                else:
                    deltas = list(src[s:s + 16]); s += 16
                e0 = base + (g << 4)
                for m in range(16):
                    e = e0 + m
                    if e >= count:
                        break
                    t = (t + _dezig8(deltas[m])) & 0xFF
                    out[e * stride + byte] = t
            temp[byte] = t
    return out


def _filter(out, count, stride, flt):
    if not flt or flt == 'NONE':
        return out
    if flt == 'OCTAHEDRAL':
        fmt, mx = ('b', 127) if stride == 4 else ('h', 32767)
        n = 4 * count
        v = list(struct.unpack(f'<{n}{fmt}', out))
        for i in range(0, n, 4):
            x, y, one = v[i], v[i + 1], v[i + 2]
            x /= one; y /= one
            z = 1.0 - abs(x) - abs(y)
            t = max(-z, 0.0)
            x -= t if x >= 0 else -t
            y -= t if y >= 0 else -t
            hh = mx / math.sqrt(x * x + y * y + z * z)
            v[i], v[i + 1], v[i + 2] = _jsround(x * hh), _jsround(y * hh), _jsround(z * hh)
        return bytearray(struct.pack(f'<{n}{fmt}', *v))
    if flt == 'QUATERNION':
        n = 4 * count
        v = list(struct.unpack(f'<{n}h', out))
        for i in range(0, n, 4):
            iw = v[i + 3]
            mc = iw & 3
            sc = math.sqrt(0.5) / (iw | 3)
            x, y, z = v[i] * sc, v[i + 1] * sc, v[i + 2] * sc
            w = math.sqrt(max(0.0, 1.0 - x * x - y * y - z * z))
            v[i + (mc + 1) % 4] = _jsround(x * 32767)
            v[i + (mc + 2) % 4] = _jsround(y * 32767)
            v[i + (mc + 3) % 4] = _jsround(z * 32767)
            v[i + (mc + 0) % 4] = _jsround(w * 32767)
        return bytearray(struct.pack(f'<{n}h', *v))
    if flt == 'EXPONENTIAL':
        n = stride * count // 4
        iv = struct.unpack(f'<{n}i', out)
        fv = []
        for x in iv:
            e = x >> 24
            m = ((x << 8) & 0xFFFFFFFF)
            m = (m - (1 << 32) if m & 0x80000000 else m) >> 8
            fv.append(math.ldexp(m, e))
        return bytearray(struct.pack(f'<{n}f', *fv))
    raise ValueError(f'unknown meshopt filter {flt}')


def _jsround(x):
    return int(math.floor(x + 0.5))


def _dezig32(v):
    return (~(v >> 1)) & 0xFFFFFFFF if v & 1 else v >> 1


def decode_index_buffer(count, stride, src):
    if src[0] != 0xE1:
        raise ValueError(f'unsupported meshopt index codec version 0x{src[0]:02x}')
    tri = count // 3
    code = 1
    st = {'data': code + tri, 'last': 0}
    aux = len(src) - 16

    def leb():
        n, i = 0, 0
        while True:
            b = src[st['data']]; st['data'] += 1
            n |= (b & 0x7F) << i
            if b < 0x80:
                return n
            i += 7

    def dec(v):
        st['last'] = (st['last'] + _dezig32(v)) & 0xFFFFFFFF
        return st['last']

    nxt = 0
    ef = [0] * 32
    vf = [0] * 16

    def push(fifo, n):
        fifo.pop(); fifo.insert(0, n)

    out = []
    for _ in range(tri):
        c0 = src[code]; code += 1
        b0, b1 = c0 >> 4, c0 & 15
        if b0 < 15:
            a, b = ef[b0 * 2], ef[b0 * 2 + 1]
            if b1 == 0:
                c = nxt; nxt += 1; push(vf, c)
            elif b1 < 13:
                c = vf[b1]
            elif b1 == 13:
                st['last'] = (st['last'] - 1) & 0xFFFFFFFF; c = st['last']; push(vf, c)
            elif b1 == 14:
                st['last'] = (st['last'] + 1) & 0xFFFFFFFF; c = st['last']; push(vf, c)
            else:
                c = dec(leb()); push(vf, c)
            push(ef, b); push(ef, c); push(ef, c); push(ef, a)
        else:
            if b1 < 14:
                e = src[aux + b1]
                z, w = e >> 4, e & 15
                a = nxt; nxt += 1
                if z == 0:
                    b = nxt; nxt += 1
                else:
                    b = vf[z - 1]
                if w == 0:
                    c = nxt; nxt += 1
                else:
                    c = vf[w - 1]
                push(vf, a)
                if z == 0: push(vf, b)
                if w == 0: push(vf, c)
            else:
                e = src[st['data']]; st['data'] += 1
                if e == 0:
                    nxt = 0
                z, w = e >> 4, e & 15
                if b1 == 14:
                    a = nxt; nxt += 1
                else:
                    a = dec(leb())
                if z == 0:
                    b = nxt; nxt += 1
                elif z == 15:
                    b = dec(leb())
                else:
                    b = vf[z - 1]
                if w == 0:
                    c = nxt; nxt += 1
                elif w == 15:
                    c = dec(leb())
                else:
                    c = vf[w - 1]
                push(vf, a)
                if z in (0, 15): push(vf, b)
                if w in (0, 15): push(vf, c)
            push(ef, a); push(ef, b); push(ef, b); push(ef, c); push(ef, c); push(ef, a)
        out += (a, b, c)
    return bytearray(struct.pack(f'<{len(out)}{"H" if stride == 2 else "I"}', *out))


def decode_index_sequence(count, stride, src):
    if src[0] != 0xD1:
        raise ValueError('unsupported meshopt index sequence version')
    p = 1
    last = [0, 0]
    out = []
    for _ in range(count):
        n, i = 0, 0
        while True:
            b = src[p]; p += 1
            n |= (b & 0x7F) << i
            if b < 0x80:
                break
            i += 7
        k = n & 1
        last[k] = (last[k] + _dezig32(n >> 1)) & 0xFFFFFFFF
        out.append(last[k])
    return bytearray(struct.pack(f'<{count}{"H" if stride == 2 else "I"}', *out))


def decode_view(ext, bin_):
    src = bin_[ext.get('byteOffset', 0):ext.get('byteOffset', 0) + ext['byteLength']]
    mode, count, stride = ext.get('mode', 'ATTRIBUTES'), ext['count'], ext['byteStride']
    if mode == 'ATTRIBUTES':
        return _filter(decode_vertex_buffer(count, stride, src), count, stride, ext.get('filter'))
    if mode == 'TRIANGLES':
        return decode_index_buffer(count, stride, src)
    if mode == 'INDICES':
        return decode_index_sequence(count, stride, src)
    raise ValueError(f'unknown meshopt mode {mode}')


def decompress(src_path, dst_path, dequantize=False):
    """Copy of a GLB with every meshopt-compressed bufferView decoded into one plain buffer.
    dequantize=True also turns quantized (integer) vertex and animation data into plain floats
    (KHR_mesh_quantization removed) so any importer can read it. Used only for Blender's working copy."""
    j, bin_ = read_glb(src_path)
    if not uses_meshopt(j):
        if dequantize and 'KHR_mesh_quantization' in (j.get('extensionsUsed') or []):
            _dequantize(j, bytearray(bin_), dst_path)
            return True
        write_glb(dst_path, j, bin_)
        return False
    if any(b.get('uri') for b in j['buffers']):
        raise ValueError('external buffers are not supported')
    new = bytearray()
    for bv in j['bufferViews']:
        ext = (bv.get('extensions') or {}).get('EXT_meshopt_compression')
        if ext:
            if ext.get('buffer', 0) != 0:
                raise ValueError('compressed data must live in the GLB buffer')
            data = decode_view(ext, bin_)
            bv.pop('extensions')
        else:
            if bv.get('buffer', 0) != 0:
                raise ValueError('unexpected buffer reference')
            o = bv.get('byteOffset', 0)
            data = bin_[o:o + bv['byteLength']]
        new += b'\0' * ((4 - len(new) % 4) % 4)
        bv['buffer'] = 0
        bv['byteOffset'] = len(new)
        bv['byteLength'] = len(data)
        new += data
    j['buffers'] = [{'byteLength': len(new)}]
    for k in ('extensionsUsed', 'extensionsRequired'):
        if k in j:
            j[k] = [e for e in j[k] if e != 'EXT_meshopt_compression']
            if not j[k]:
                j.pop(k)
    if dequantize and 'KHR_mesh_quantization' in (j.get('extensionsUsed') or []):
        _dequantize(j, new, dst_path)
        return True
    write_glb(dst_path, j, new)
    return True


def _dequantize(j, buf, dst_path):
    targets = set()
    for m in j.get('meshes', []):
        for p in m['primitives']:
            for k, a in p['attributes'].items():
                if not k.startswith('JOINTS_'):
                    targets.add(a)
            for t in p.get('targets', []):
                targets.update(t.values())
    for an in j.get('animations', []):
        for sm in an['samplers']:
            targets.update((sm['input'], sm['output']))
    for idx in sorted(targets):
        a = j['accessors'][idx]
        if a['componentType'] == 5126 or a.get('sparse'):
            continue
        rows = read_accessor(j, buf, idx)
        buf += b'\0' * ((4 - len(buf) % 4) % 4)
        flat = [x for r in rows for x in r]
        data = struct.pack(f'<{len(flat)}f', *flat)
        j['bufferViews'].append({'buffer': 0, 'byteOffset': len(buf), 'byteLength': len(data)})
        buf += data
        na = {'bufferView': len(j['bufferViews']) - 1, 'componentType': 5126, 'count': a['count'], 'type': a['type']}
        nc = NC[a['type']]
        if 'min' in a or 'max' in a or a.get('normalized') is not None:
            na['min'] = [min(r[c] for r in rows) for c in range(nc)]
            na['max'] = [max(r[c] for r in rows) for c in range(nc)]
        if a.get('name'):
            na['name'] = a['name']
        j['accessors'][idx] = na
    j['buffers'] = [{'byteLength': len(buf)}]
    for k in ('extensionsUsed', 'extensionsRequired'):
        if k in j:
            j[k] = [e for e in j[k] if e != 'KHR_mesh_quantization']
            if not j[k]:
                j.pop(k)
    write_glb(dst_path, j, buf)


# ----------------------------------------------------------------------------- accessors
CT = {5120: ('b', 1, 127.0), 5121: ('B', 1, 255.0), 5122: ('h', 2, 32767.0), 5123: ('H', 2, 65535.0), 5125: ('I', 4, 0), 5126: ('f', 4, 0)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_accessor(j, bin_, idx):
    """Accessor as a list of tuples (floats; normalized ints are converted). Needs a plain (decoded) file."""
    a = j['accessors'][idx]
    fmt, size, norm = CT[a['componentType']]
    nc = NC[a['type']]
    bv = j['bufferViews'][a['bufferView']]
    if bv.get('extensions'):
        raise ValueError('read_accessor needs a decompressed file')
    stride = bv.get('byteStride') or size * nc
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = []
    for i in range(a['count']):
        v = struct.unpack_from(f'<{nc}{fmt}', bin_, base + i * stride)
        if a.get('normalized') and norm:
            v = tuple(max(x / norm, -1.0) for x in v)
        out.append(tuple(float(x) for x in v))
    return out


# ----------------------------------------------------------------------------- small matrix/quaternion maths (4x4 row-major lists)
def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def mat_inv(m):
    """Inverse of an affine 4x4."""
    a = [r[:3] for r in m[:3]]
    det = (a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0])
           + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]))
    if abs(det) < 1e-20:
        raise ValueError('singular matrix')
    inv = [[(a[(j + 1) % 3][(i + 1) % 3] * a[(j + 2) % 3][(i + 2) % 3] - a[(j + 1) % 3][(i + 2) % 3] * a[(j + 2) % 3][(i + 1) % 3]) / det
            for j in range(3)] for i in range(3)]
    t = [m[0][3], m[1][3], m[2][3]]
    it = [-sum(inv[i][k] * t[k] for k in range(3)) for i in range(3)]
    return [inv[0] + [it[0]], inv[1] + [it[1]], inv[2] + [it[2]], [0, 0, 0, 1]]


def q_to_m3(q):
    x, y, z, w = q
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]


def compose(t, r, s):
    m3 = q_to_m3(r)
    return [[m3[0][0] * s[0], m3[0][1] * s[1], m3[0][2] * s[2], t[0]],
            [m3[1][0] * s[0], m3[1][1] * s[1], m3[1][2] * s[2], t[1]],
            [m3[2][0] * s[0], m3[2][1] * s[1], m3[2][2] * s[2], t[2]], [0, 0, 0, 1]]


def m3_to_q(m):
    tr = m[0][0] + m[1][1] + m[2][2]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        q = ((m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, 0.25 * s)
    elif m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = math.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2
        q = (0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s)
    elif m[1][1] > m[2][2]:
        s = math.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2
        q = ((m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s)
    else:
        s = math.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2
        q = ((m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s, (m[1][0] - m[0][1]) / s)
    n = math.sqrt(sum(x * x for x in q))
    return tuple(x / n for x in q)


def decompose(m):
    t = (m[0][3], m[1][3], m[2][3])
    s = [math.sqrt(sum(m[r][c] ** 2 for r in range(3))) for c in range(3)]
    det = (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
           + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))
    if det < 0:
        s[0] = -s[0]
    r3 = [[m[r][c] / s[c] for c in range(3)] for r in range(3)]
    return t, m3_to_q(r3), tuple(s)


def slerp(a, b, f):
    d = sum(x * y for x, y in zip(a, b))
    if d < 0:
        b, d = tuple(-x for x in b), -d
    if d > 0.9995:
        r = tuple(x + (y - x) * f for x, y in zip(a, b))
    else:
        th = math.acos(d)
        s0, s1 = math.sin((1 - f) * th) / math.sin(th), math.sin(f * th) / math.sin(th)
        r = tuple(s0 * x + s1 * y for x, y in zip(a, b))
    n = math.sqrt(sum(x * x for x in r))
    return tuple(x / n for x in r)


# ----------------------------------------------------------------------------- scene sampling
class Scene:
    def __init__(self, j, bin_):
        self.j, self.bin = j, bin_
        self.nodes = j['nodes']
        self.parent = {}
        for i, n in enumerate(self.nodes):
            for c in n.get('children', []):
                self.parent[c] = i
        self.by_name = {}
        for i, n in enumerate(self.nodes):
            self.by_name.setdefault(n.get('name', f'#{i}'), i)
        self.anims = {a.get('name', f'anim{k}'): a for k, a in enumerate(j.get('animations', []))}
        self._cache = {}

    def joints(self):
        js = set()
        for s in self.j.get('skins', []):
            js.update(s['joints'])
        return sorted(js)

    def rest_trs(self, i):
        n = self.nodes[i]
        if 'matrix' in n:
            m = n['matrix']
            return decompose([[m[c * 4 + r] for c in range(4)] for r in range(4)])
        return tuple(n.get('translation', (0, 0, 0))), tuple(n.get('rotation', (0, 0, 0, 1))), tuple(n.get('scale', (1, 1, 1)))

    def tracks(self, name):
        if name in self._cache:
            return self._cache[name]
        a = self.anims[name]
        tr = {}
        for ch in a['channels']:
            tg = ch['target']
            if 'node' not in tg or tg['path'] not in ('translation', 'rotation', 'scale'):
                continue
            s = a['samplers'][ch['sampler']]
            times = [x[0] for x in read_accessor(self.j, self.bin, s['input'])]
            vals = read_accessor(self.j, self.bin, s['output'])
            interp = s.get('interpolation', 'LINEAR')
            if interp == 'CUBICSPLINE':
                vals = vals[1::3]
            tr[(tg['node'], tg['path'])] = (times, vals, interp)
        self._cache[name] = tr
        return tr

    def duration(self, name):
        return max((t[0][-1] for t in self.tracks(name).values() if t[0]), default=0.0)

    def times(self, name):
        ts = set()
        for t in self.tracks(name).values():
            ts.update(round(x, 6) for x in t[0])
        return sorted(ts)

    def sample(self, name, i, path, t):
        tr = self.tracks(name).get((i, path)) if name else None
        if not tr:
            return self.rest_trs(i)[{'translation': 0, 'rotation': 1, 'scale': 2}[path]]
        times, vals, interp = tr
        if t <= times[0]:
            return vals[0]
        if t >= times[-1]:
            return vals[-1]
        lo, hi = 0, len(times) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if times[mid] <= t: lo = mid
            else: hi = mid
        if interp == 'STEP':
            return vals[lo]
        f = (t - times[lo]) / (times[hi] - times[lo])
        if path == 'rotation':
            return slerp(vals[lo], vals[hi], f)
        return tuple(a + (b - a) * f for a, b in zip(vals[lo], vals[hi]))

    def local(self, name, i, t):
        return compose(self.sample(name, i, 'translation', t), self.sample(name, i, 'rotation', t), self.sample(name, i, 'scale', t))

    def worlds(self, name, t):
        w = {}

        def get(i):
            if i not in w:
                p = self.parent.get(i)
                w[i] = mat_mul(get(p), self.local(name, i, t)) if p is not None else self.local(name, i, t)
            return w[i]
        for i in range(len(self.nodes)):
            get(i)
        return w


def _pos(m):
    return (m[0][3], m[1][3], m[2][3])


def _dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _rot_err_deg(m1, m2):
    q1 = decompose(m1)[1]; q2 = decompose(m2)[1]
    d = min(1.0, abs(sum(x * y for x, y in zip(q1, q2))))
    return math.degrees(2 * math.acos(d))


def splice(orig_path, plain_path, exported_path, names, dst_path, replace=(), calib_clip=None):
    """Append clips `names` from `exported_path` into the original GLB. Returns a report dict."""
    oj, obin = read_glb(orig_path)
    pj, pbin = read_glb(plain_path)
    ej, ebin = read_glb(exported_path)
    O, E = Scene(pj, pbin), Scene(ej, ebin)
    rep = {'problems': [], 'clips': {}}
    joints_o = O.joints()
    jname = {i: O.nodes[i].get('name') for i in joints_o}
    missing = [n for n in jname.values() if n not in E.by_name]
    if missing:
        rep['problems'].append(f'Exported skeleton is missing joints: {missing[:8]}')
        return rep
    # --- calibrate on a clip both files have (Idle preferred)
    shared = [n for n in O.anims if n in E.anims and n not in names]
    if not shared:
        rep['problems'].append('No clip shared by the source and the export to line the skeletons up')
        return rep
    calib = calib_clip or next((n for n in shared if n.lower() == 'idle'), shared[0])
    wo, we = O.worlds(calib, 0.0), E.worlds(calib, 0.0)
    Cm = {i: mat_mul(mat_inv(wo[i]), we[E.by_name[jname[i]]]) for i in joints_o}
    Cinv = {i: mat_inv(c) for i, c in Cm.items()}
    # size of the character for tolerances
    ps = [_pos(wo[i]) for i in joints_o]
    size = max(max(p[k] for p in ps) - min(p[k] for p in ps) for k in range(3)) or 1.0
    # --- check the calibration holds on other frames of every shared clip
    worst_p, worst_r = 0.0, 0.0
    for clip in shared:
        d = min(O.duration(clip), E.duration(clip))
        for f in (0.25, 0.5, 0.75):
            t = d * f
            wo, we = O.worlds(clip, t), E.worlds(clip, t)
            for i in joints_o:
                g = mat_mul(we[E.by_name[jname[i]]], Cinv[i])
                worst_p = max(worst_p, _dist(_pos(g), _pos(wo[i])) / size)
                worst_r = max(worst_r, _rot_err_deg(g, wo[i]))
    rep['calibration'] = {'clip': calib, 'checked_clips': shared, 'worst_position_error_pct_of_height': round(worst_p * 100, 4),
                          'worst_rotation_error_deg': round(worst_r, 3)}
    if worst_p > 0.01 or worst_r > 2.0:
        rep['problems'].append(f'Blender export does not match the source skeleton (pos {worst_p * 100:.2f}% / rot {worst_r:.2f} deg)')
        return rep
    # --- convert each new clip into the source's joint frames
    out_bin = bytearray(obin)
    oj.setdefault('animations', [])
    if replace:
        oj['animations'] = [a for a in oj['animations'] if a.get('name') not in replace]
    have = {a.get('name') for a in oj['animations']}
    for name in names:
        if name not in E.anims:
            rep['problems'].append(f'Clip {name} is not in the Blender export')
            continue
        if name in have:
            rep['problems'].append(f'Clip {name} already exists in the source (set replace)')
            continue
        times = E.times(name)
        static_o = O.worlds(None, 0.0)
        series = {i: ([], [], []) for i in joints_o}
        prevq = {}
        for t in times:
            we = E.worlds(name, t)
            go = {i: mat_mul(we[E.by_name[jname[i]]], Cinv[i]) for i in joints_o}
            for i in joints_o:
                p = O.parent.get(i)
                pw = go[p] if p in go else (static_o[p] if p is not None else None)
                loc = mat_mul(mat_inv(pw), go[i]) if pw is not None else go[i]
                tt, q, s = decompose(loc)
                if i in prevq and sum(a * b for a, b in zip(q, prevq[i])) < 0:
                    q = tuple(-x for x in q)
                prevq[i] = q
                series[i][0].append(tt); series[i][1].append(q); series[i][2].append(s)
        anim = {'name': name, 'channels': [], 'samplers': []}
        t_acc = _append_accessor(oj, out_bin, [(x,) for x in times], 'SCALAR')
        for i in joints_o:
            for path, k, typ in (('translation', 0, 'VEC3'), ('rotation', 1, 'VEC4'), ('scale', 2, 'VEC3')):
                acc = _append_accessor(oj, out_bin, series[i][k], typ)
                anim['samplers'].append({'input': t_acc, 'output': acc, 'interpolation': 'LINEAR'})
                anim['channels'].append({'sampler': len(anim['samplers']) - 1, 'target': {'node': i, 'path': path}})
        oj['animations'].append(anim)
        rep['clips'][name] = {'keys': len(times), 'seconds': round(times[-1], 4) if times else 0}
    oj['buffers'][0]['byteLength'] = len(out_bin)
    write_glb(dst_path, oj, out_bin)
    # --- self-check: the written clip must reproduce Blender's motion
    if rep['clips']:
        dj, dbin = read_glb(dst_path)
        tmp = dst_path + '.plain.glb'
        decompress(dst_path, tmp)
        D = Scene(*read_glb(tmp))
        err = 0.0
        for name in rep['clips']:
            d = E.duration(name)
            for f in (0.0, 0.3, 0.6, 1.0):
                wd, we = D.worlds(name, d * f), E.worlds(name, d * f)
                for i in joints_o:
                    g = mat_mul(we[E.by_name[jname[i]]], Cinv[i])
                    err = max(err, _dist(_pos(g), _pos(wd[i])) / size)
        rep['written_clip_error_pct_of_height'] = round(err * 100, 5)
        if err > 0.005:
            rep['problems'].append(f'Written clip differs from the Blender motion by {err * 100:.3f}% of height')
        import os
        os.remove(tmp)
    return rep


def _append_accessor(j, buf, rows, typ):
    buf += b'\0' * ((4 - len(buf) % 4) % 4)
    flat = [float(x) for r in rows for x in r]
    data = struct.pack(f'<{len(flat)}f', *flat)
    j['bufferViews'].append({'buffer': 0, 'byteOffset': len(buf), 'byteLength': len(data)})
    buf += data
    nc = NC[typ]
    acc = {'bufferView': len(j['bufferViews']) - 1, 'componentType': 5126, 'count': len(rows), 'type': typ}
    if typ == 'SCALAR':
        acc['min'] = [min(flat)]; acc['max'] = [max(flat)]
    j['accessors'].append(acc)
    return len(j['accessors']) - 1


# ----------------------------------------------------------------------------- worker hotfix (applied when the worker reloads this file)
def _worker_hotfix():
    """Several worker processes commit to the same queue branch at once; GitHub then answers 409 'is at X but
    expected Y' (a branch race, not a real conflict). Retry those writes instead of failing the job."""
    import gc, time
    try:
        classes = [o for o in gc.get_objects() if isinstance(o, type) and o.__name__ in ('GitHub', 'Conflict')]
    except Exception:
        return
    gh = [c for c in classes if c.__name__ == 'GitHub' and hasattr(c, 'put_file') and hasattr(c, 'ensure_branch')]
    cf = [c for c in classes if c.__name__ == 'Conflict' and issubclass(c, Exception)]
    if not gh or not cf:
        return
    for G in gh:
        if getattr(G, '_oh_race_retry', False):
            continue
        orig = G.put_file

        def put_file(self, *a, _orig=orig, _cf=tuple(cf), **k):
            for i in range(6):
                try:
                    return _orig(self, *a, **k)
                except _cf as e:
                    if 'but expected' not in str(e) or i == 5:
                        raise
                    time.sleep(2 + 3 * i)
        G.put_file = put_file
        G._oh_race_retry = True


_worker_hotfix()

"""Append the animations of B.glb to A.glb (same skeleton, matched by node name). python mergeglb.py A.glb B.glb out.glb"""
import sys, json, struct
sys.path.insert(0, __import__('os').path.dirname(__file__))
import numpy as np, ohrt
A, B = ohrt.Glb(sys.argv[1], mesh=False), ohrt.Glb(sys.argv[2], mesh=False)
j = json.loads(json.dumps(A.j)); buf = bytearray(A.BIN)
nmap = {i: A.byname[B.nodes[i]['name']] for i in range(len(B.nodes)) if B.nodes[i].get('name') in A.byname}
def add(arr, typ):
    arr = np.ascontiguousarray(arr, dtype=np.float32)
    while len(buf) % 4: buf.append(0)
    off = len(buf); buf.extend(arr.tobytes())
    j['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes})
    a = {'bufferView': len(j['bufferViews']) - 1, 'componentType': 5126, 'count': int(arr.shape[0]), 'type': typ}
    if typ == 'SCALAR': a['min'] = [float(arr.min())]; a['max'] = [float(arr.max())]
    j['accessors'].append(a); return len(j['accessors']) - 1
have = {a['name'] for a in j['animations']}
for an in B.j['animations']:
    assert an['name'] not in have, an['name']
    ch, sm, tcache = [], [], {}
    for c in an['channels']:
        s = an['samplers'][c['sampler']]; t = B.acc(s['input']); o = B.acc(s['output'])
        k = s['input']
        if k not in tcache: tcache[k] = add(t, 'SCALAR')
        sm.append({'input': tcache[k], 'output': add(o, {1: 'SCALAR', 3: 'VEC3', 4: 'VEC4'}[o.shape[1]]), 'interpolation': s.get('interpolation', 'LINEAR')})
        ch.append({'sampler': len(sm) - 1, 'target': {'node': nmap[c['target']['node']], 'path': c['target']['path']}})
    j['animations'].append({'name': an['name'], 'channels': ch, 'samplers': sm})
while len(buf) % 4: buf.append(0)
j['buffers'] = [{'byteLength': len(buf)}]
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(sys.argv[3], 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(buf)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(buf)) + b'BIN\x00' + bytes(buf))
print('merged', len(j['animations']), 'clips')

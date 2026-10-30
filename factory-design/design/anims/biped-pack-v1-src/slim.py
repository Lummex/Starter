"""Rewrite the pack GLB: keep rotation tracks for every bone, translation for Hips only, drop scale tracks,
drop the empty skin; nodes (rest pose) unchanged. Usage: python slim.py in.glb out.glb"""
import sys, json, struct
sys.path.insert(0, __import__('os').path.dirname(__file__))
import numpy as np
import ohrt

g = ohrt.Glb(sys.argv[1], mesh=False)
j = g.j
nodes = [dict(n) for n in j['nodes']]
hips = next(i for i, n in enumerate(nodes) if n.get('name') == 'Hips')
buf = bytearray(); views = []; accs = []
def add(arr, typ):
    arr = np.ascontiguousarray(arr, dtype=np.float32)
    while len(buf) % 4: buf.append(0)
    off = len(buf); buf.extend(arr.tobytes())
    views.append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes})
    a = {'bufferView': len(views) - 1, 'componentType': 5126, 'count': int(arr.shape[0]), 'type': typ}
    if typ == 'SCALAR':
        a['min'] = [float(arr.min())]; a['max'] = [float(arr.max())]
    accs.append(a); return len(accs) - 1
anims = []
for an in j['animations']:
    ch_out, smp = [], []
    times = {}
    for c in an['channels']:
        nd, path = c['target'].get('node'), c['target']['path']
        if path == 'scale' or (path == 'translation' and nd != hips):
            continue
        s = an['samplers'][c['sampler']]
        t = g.acc(s['input'])[:, 0]; o = g.acc(s['output'])
        key = t.tobytes()
        if key not in times: times[key] = add(t.reshape(-1, 1), 'SCALAR')
        oi = add(o, 'VEC4' if path == 'rotation' else 'VEC3')
        smp.append({'input': times[key], 'output': oi, 'interpolation': s.get('interpolation', 'LINEAR')})
        ch_out.append({'sampler': len(smp) - 1, 'target': {'node': nd, 'path': path}})
    anims.append({'name': an['name'], 'channels': ch_out, 'samplers': smp})
for n in nodes:
    n.pop('skin', None); n.pop('mesh', None)
out = {'asset': {'version': '2.0', 'generator': 'Oreheart Spring biped pack'}, 'scene': 0, 'scenes': j['scenes'], 'nodes': nodes,
       'animations': anims, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(buf)}],
       'extras': {'pack': 'biped-pack-v1', 'base': 'goblin-grunt Meshy rig, rest pose'}}
js = json.dumps(out, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
while len(buf) % 4: buf.append(0)
total = 12 + 8 + len(js) + 8 + len(buf)
open(sys.argv[2], 'wb').write(struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<I', len(js)) + b'JSON' + js
                             + struct.pack('<I', len(buf)) + b'BIN\x00' + bytes(buf))
print('wrote', sys.argv[2], total, 'bytes,', len(anims), 'clips')

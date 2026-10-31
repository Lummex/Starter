"""Build shared biped clips from anim scripts on the canonical rig and export a skeleton-only GLB.
Run: blender -b --factory-startup --python packbuild.py -- --rig RIG.glb --clips clips.json --anims DIR --out DIR [--render 1] [--only a,b]
clips.json: [{"name": "biped-idle-01", "loop": true, "frames": [60, 150], "return_to_idle": true, "feet_may_move": false}, ...]
Each clip's script is DIR/<name>.py with build(ctx) (same API as the Blender worker: anim_api.md).
Outputs: OUT/pack.glb (armature nodes + clips, no mesh), OUT/events.json, OUT/report.json, OUT/png/<clip>-NNN.png
"""
import json, os, sys
BOPS = os.environ['BOPS']
sys.path.insert(0, BOPS)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import common as C

src = open(os.path.join(BOPS, 'build_animation.py'), encoding='utf-8').read()
src = src.replace('\nmain()\n', '\n')
BA = {'__name__': 'build_animation_lib', '__file__': os.path.join(BOPS, 'build_animation.py')}
exec(compile(src, 'build_animation.py', 'exec'), BA)

a = C.args()
out = a['out']; os.makedirs(os.path.join(out, 'png'), exist_ok=True)
clips = json.load(open(a['clips'], encoding='utf-8'))
only = set(filter(None, a.get('only', '').split(',')))
if only:
    clips = [c for c in clips if c['name'] in only]
sc = C.clean_scene()
objs = C.import_glb(a['rig'])
arm = C.find_armature(objs)
meshes = C.skinned_meshes(arm)
stock = list(C.armature_actions(arm))
pose, idle = C.base_pose(arm)
table = C.bone_table(arm, pose)
insp = {'size': {'height': 0}}
lo, hi = C.world_bbox(meshes)
insp['size']['height'] = hi.z - lo.z
report = {'base_pose': idle, 'height_m': round(hi.z - lo.z, 4), 'clips': [], 'problems': [], 'notes': []}
events = {'fps': C.FPS, 'clips': {}}
built = []
for spec in clips:
    name = spec['name']
    ctx = BA['Ctx'](arm, pose, table, spec, insp, [])
    try:
        BA['run_script'](os.path.join(a['anims'], name + '.py'), ctx)
    except Exception as e:
        report['problems'].append(f'{name}.py error: {type(e).__name__}: {e}')
        continue
    if not ctx._keys:
        report['problems'].append(f'{name}.py made no keys'); continue
    act, L = BA['build_action'](arm, pose, name, ctx)
    BA['stash'](arm, act)
    stats, notes = BA['quality_checks'](arm, pose, act, L, ctx, spec)
    report['problems'] += [f'{name}: {p}' for p in ctx._problems]
    report['notes'] += [f'{name}: {n}' for n in notes]
    evs = sorted(ctx._events, key=lambda e: e['frame'])
    for e in evs:
        e['time'] = round(e['frame'] / C.FPS, 4)
    events['clips'][name] = {'frames': L, 'duration': round(L / C.FPS, 4), 'loop': bool(spec.get('loop')), 'events': evs}
    report['clips'].append({'name': name, 'frames': L, **stats})
    built.append((act, L))

if a.get('mix'):
    import mixret
    for spec in json.load(open(a['mix'], encoding='utf-8')):
        if only and spec['name'] not in only:
            continue
        try:
            act, L, info = mixret.retarget(arm, spec, sc)
        except Exception as e:
            report['problems'].append(f"{spec['name']} (mixamo) error: {type(e).__name__}: {e}")
            continue
        BA['stash'](arm, act)
        evs = [{'name': n, 'frame': int(f), 'time': round(int(f) / C.FPS, 4)} for n, f in spec.get('events', {}).items()]
        evs.sort(key=lambda e: e['frame'])
        events['clips'][spec['name']] = {'frames': L, 'duration': round(L / C.FPS, 4), 'loop': bool(spec.get('loop')),
                                         'events': evs, 'source': 'mixamo'}
        hy = info['hips_y']
        report['clips'].append({'name': spec['name'], 'frames': L, 'source': 'mixamo',
                                'hips_y_min': round(min(hy), 4), 'hips_y_min_frame': hy.index(min(hy))})
        built.append((act, L))

if a.get('render'):
    C.setup_render(int(a.get('res', 320)))
    pad = (hi - lo).length
    lo2 = lo.copy(); hi2 = hi.copy(); lo2.z -= 0.05 * pad; hi2.z += 0.3 * pad
    C.make_camera(lo2, hi2, float(a.get('yaw', 30)), 8, margin=1.6)
    for act, L in built:
        n = int(a.get('n', 8))
        for k in range(n):
            f = round(L * k / (n - 1))
            C.evaluate(arm, act, f)
            C.render_to(os.path.join(out, 'png', f'{act.name}-{f:03d}.png'))

# export: armature only, pack clips only
for act in stock:
    for tr in list(arm.animation_data.nla_tracks):
        if tr.strips and tr.strips[0].action == act:
            arm.animation_data.nla_tracks.remove(tr)
    bpy.data.actions.remove(act)
keep = {x[0].name for x in built}
for act in list(bpy.data.actions):
    if act.name not in keep:
        bpy.data.actions.remove(act)
for o in list(bpy.data.objects):
    if o != arm and o.type == 'ARMATURE':
        bpy.data.objects.remove(o, do_unlink=True)
ad = arm.animation_data
ad.action = None
ad.use_nla = True
bpy.context.view_layer.update()
for m in meshes:
    bpy.data.objects.remove(m, do_unlink=True)
for o in list(bpy.data.objects):
    if o != arm and o.type == 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)
BA['export'](os.path.join(out, 'pack.glb'), [arm])
C.write_json(os.path.join(out, 'events.json'), events)
C.write_json(os.path.join(out, 'report.json'), report)
print('PACK DONE', [x[0].name for x in built], 'problems', len(report['problems']))

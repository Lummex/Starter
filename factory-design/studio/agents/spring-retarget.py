"""Retarget one clip from a source biped GLB to a target biped GLB (same Meshy 24-bone rig).
Run: blender -b --factory-startup --python retarget.py -- --src s.glb --clip NAME --tgt t.glb --out DIR [--name NEW] [--compare CLIP] [--render 1] [--export 1]
Inputs must be meshopt-free (glbtool.decompress first).
Method: per frame, each bone's world rotation change from its rest pose on the source is applied to the
same bone of the target (rest-relative world deltas, so differing bone rolls do not matter). Hips movement
is scaled by the hip-height ratio. Nothing is written over the inputs.
"""
import sys, os, json, math
sys.path.insert(0, os.environ['BOPS'])
import bpy
from mathutils import Matrix, Quaternion, Vector
import common as C

a = C.args()
out = a['out']; os.makedirs(out, exist_ok=True)
sc = C.clean_scene()

def load(path, tag):
    objs = C.import_glb(path)
    arm = C.find_armature(objs)
    for o in objs:
        o.name = tag + '_' + o.name
    return objs, arm

s_objs, S = load(a['src'], 'S')
t_objs, T = load(a['tgt'], 'T')

def acts_of(arm):
    return {act.name.split('_S_')[0].split('_T_')[0]: act for act in C.armature_actions(arm)}

def find_act(arm, name):
    for act in C.armature_actions(arm):
        if act.name == name or act.name.startswith(name + '_') or act.name.split('|')[-1] == name:
            return act
    raise SystemExit('clip not found: %s in %s' % (name, [x.name for x in C.armature_actions(arm)]))

src_act = find_act(S, a['clip'])
f0, f1 = [int(round(x)) for x in src_act.frame_range]

def rest_world(arm):
    return {b.name: arm.matrix_world @ b.matrix_local for b in arm.data.bones}

RS, RT = rest_world(S), rest_world(T)
hip_s = RS['Hips'].translation.z - min(o.matrix_world.translation.z for o in [S])
hs = (RS['Hips'].translation - S.matrix_world.translation).z
ht = (RT['Hips'].translation - T.matrix_world.translation).z
ratio = ht / hs if hs else 1.0

order = []
def walk(b):
    order.append(b.name)
    for c in b.children:
        walk(c)
for b in T.data.bones:
    if b.parent is None:
        walk(b)

# new action on the target
name = a.get('name') or ('RT_' + a['clip'])

T.animation_data_create()
new = bpy.data.actions.new(name)
T.animation_data.action = new
for pb in T.pose.bones:
    pb.rotation_mode = 'QUATERNION'

C.set_action(S, src_act)
for f in range(f0, f1 + 1):
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    se = S.evaluated_get(dg)
    want = {}
    for n in order:
        if n not in se.pose.bones:
            continue
        Pw = se.matrix_world @ se.pose.bones[n].matrix
        D = Pw.to_quaternion() @ RS[n].to_quaternion().inverted()
        want[n] = (D @ RT[n].to_quaternion()).normalized()
    hip_off = ((se.matrix_world @ se.pose.bones['Hips'].matrix).translation - RS['Hips'].translation) * ratio
    TW = T.matrix_world.to_quaternion()
    for n in order:
        if n not in want:
            continue
        b = T.data.bones[n]; pb = T.pose.bones[n]
        Rr = RT[n].to_quaternion()
        if b.parent and b.parent.name in want:
            Rp = RT[b.parent.name].to_quaternion()
            local_rest = Rp.inverted() @ Rr
            basis = local_rest.inverted() @ want[b.parent.name].inverted() @ want[n]
        else:
            basis = Rr.inverted() @ want[n]
        pb.rotation_quaternion = basis
        pb.keyframe_insert('rotation_quaternion', frame=f)
        if n == 'Hips':
            pb.location = Rr.inverted() @ hip_off  # bone-rest space (unit scale rig)
            pb.keyframe_insert('location', frame=f)

res = {'clip': a['clip'], 'frames': [f0, f1], 'hip_ratio': round(ratio, 3), 'new': name}

def low_point(arm, f):
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    zs = []
    for o in C.skinned_meshes(arm):
        oe = o.evaluated_get(dg); m = oe.to_mesh()
        zs += [(oe.matrix_world @ v.co).z for v in m.vertices]
        oe.to_mesh_clear()
    return min(zs), max(zs)

# floor + foot drift check
lo0, hi0 = low_point(T, f0)
H = hi0 - lo0
lows = [low_point(T, f)[0] for f in range(f0, f1 + 1, 3)]
res['height'] = round(H, 3)
res['lowest_vs_start_pct'] = round((min(lows) - lo0) / H * 100, 1)
res['highest_low_vs_start_pct'] = round((max(lows) - lo0) / H * 100, 1)

if a.get('compare'):
    cmp_act = find_act(T, a['compare'])
    errs = []
    for f in range(f0, f1 + 1, 2):
        T.animation_data.action = new; sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get(); te = T.evaluated_get(dg)
        A = {n: (te.matrix_world @ te.pose.bones[n].matrix).to_quaternion() for n in order}
        T.animation_data.action = cmp_act; sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get(); te = T.evaluated_get(dg)
        Bq = {n: (te.matrix_world @ te.pose.bones[n].matrix).to_quaternion() for n in order}
        errs.append(sum(math.degrees(A[n].rotation_difference(Bq[n]).angle) for n in order) / len(order))
    T.animation_data.action = new
    res['compare_' + a['compare'] + '_mean_deg'] = round(sum(errs) / len(errs), 1)
    res['compare_max_frame_deg'] = round(max(errs), 1)

if a.get('render'):
    C.setup_render(360)
    for o in s_objs:
        o.location.x += 0 if o.parent else 0
    # place source to the left so both show in one picture
    S.location.x += max(H, 1) * 0.9 * (hs / ht if ht else 1)
    lo = Vector((-H * 1.5, -H, lo0)); hi = Vector((H * 1.5, H, lo0 + max(H, hs * 2.4)))
    C.make_camera(lo, hi, yaw_deg=0, pitch_deg=5, margin=1.0)
    n = 6
    for k in range(n):
        f = f0 + round((f1 - f0) * k / (n - 1))
        sc.frame_set(f)
        C.render_to(os.path.join(out, 'f%03d.png' % f))
    S.location.x -= max(H, 1) * 0.9 * (hs / ht if ht else 1)

if a.get('export'):
    for o in s_objs:
        bpy.data.objects.remove(o, do_unlink=True)

    keep = [o for o in bpy.data.objects if o.name.startswith('T_') and not C.is_helper(o)]
    import build_animation as BA
    BA.stash(T, new)
    BA.export(os.path.join(out, 'char.glb'), keep)
    res['exported'] = os.path.join(out, 'char.glb')

C.write_json(os.path.join(out, 'result.json'), res)
print('RESULT', json.dumps(res))

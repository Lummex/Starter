"""Mixamo FBX (skin-less) -> pack rig actions, inside Blender. Same 'align' retarget the game uses (see ohrt.py).
mix.json: [{"name": "biped-idle-11", "fbx": "path.fbx", "then": "path2.fbx" (optional, appended with a cross-fade),
            "trim": [f0, f1] (optional, frames of the first fbx), "speed": 1.0, "blend": 8, "loop": true,
            "start_from_base": false}]
"""
import math, os
import bpy
from mathutils import Matrix, Quaternion, Vector

MAP = {'Hips': 'Hips', 'Spine': 'Spine02', 'Spine1': 'Spine01', 'Spine2': 'Spine', 'Neck': 'neck', 'Head': 'Head',
       'HeadTop_End': 'head_end', 'LeftShoulder': 'LeftShoulder', 'LeftArm': 'LeftArm', 'LeftForeArm': 'LeftForeArm',
       'LeftHand': 'LeftHand', 'RightShoulder': 'RightShoulder', 'RightArm': 'RightArm', 'RightForeArm': 'RightForeArm',
       'RightHand': 'RightHand', 'LeftUpLeg': 'LeftUpLeg', 'LeftLeg': 'LeftLeg', 'LeftFoot': 'LeftFoot',
       'LeftToeBase': 'LeftToeBase', 'RightUpLeg': 'RightUpLeg', 'RightLeg': 'RightLeg', 'RightFoot': 'RightFoot',
       'RightToeBase': 'RightToeBase'}
CHILD = {'Hips': 'Spine02', 'Spine02': 'Spine01', 'Spine01': 'Spine', 'Spine': 'neck', 'neck': 'Head', 'Head': 'head_end',
         'LeftShoulder': 'LeftArm', 'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand',
         'RightShoulder': 'RightArm', 'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand',
         'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot', 'LeftFoot': 'LeftToeBase',
         'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot', 'RightFoot': 'RightToeBase'}
LEG = ['LeftUpLeg', 'LeftLeg', 'LeftFoot']


def _q(m):
    return m.to_3x3().normalized().to_quaternion()


def load_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=False)
    objs = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in objs if o.type == 'ARMATURE')
    act = arm.animation_data.action
    return objs, arm, act


def sample(arm, act, fr):
    """World rotations + positions per mixamo bone (our names) per frame."""
    sc = bpy.context.scene
    arm.animation_data.action = act
    name = {}
    for b in arm.pose.bones:
        short = b.name.split(':')[-1]
        if short in MAP:
            name[MAP[short]] = b.name
    out = []
    for f in fr:
        fi_ = int(f); sc.frame_set(fi_, subframe=f - fi_)
        mw = arm.matrix_world
        out.append({n: (_q(mw @ arm.pose.bones[s].matrix), (mw @ arm.pose.bones[s].head).copy()) for n, s in name.items()})
    return out, name


def rest_of(arm, name):
    mw = arm.matrix_world
    return {n: (_q(mw @ arm.data.bones[s].matrix_local), (mw @ arm.data.bones[s].head_local).copy()) for n, s in name.items()}


def blend_frames(a, b, k):
    out = a[:-k] if k else list(a)
    for i in range(k):
        t = (i + 1) / (k + 1); t = t * t * (3 - 2 * t)
        fa, fb = a[len(a) - k + i], b[i]
        out.append({n: (fa[n][0].slerp(fb[n][0], t), fa[n][1].lerp(fb[n][1], t)) for n in fa})
    return out + b[k:]


def retarget(T, spec, sc):
    """Build an action on pack armature T from a mixamo spec. Returns (action, frames, info)."""
    objs, M, act = load_fbx(spec['fbx'])
    f0, f1 = [int(round(x)) for x in act.frame_range]
    if spec.get('trim'):
        f0, f1 = spec['trim']
    spd = spec.get('speed', 1.0)
    frames, name = sample(M, act, [f0 + i * spd for i in range(int((f1 - f0) / spd) + 1)])
    RM = rest_of(M, name)
    if spec.get('then'):
        objs2, M2, act2 = load_fbx(spec['then'])
        g0, g1 = [int(round(x)) for x in act2.frame_range]
        sp2 = spec.get('speed2', spd)
        fr2, name2 = sample(M2, act2, [g0 + i * sp2 for i in range(int((g1 - g0) / sp2) + 1)])
        # express clip 2 relative to its own rest, then re-base onto clip 1's rest (same Mixamo body, so equal)
        frames = blend_frames(frames, fr2, spec.get('blend', 8))
        for o in objs2:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in objs:
        if o.type != 'ARMATURE':
            bpy.data.objects.remove(o, do_unlink=True)
    # pack rest
    mwT = T.matrix_world
    RT = {b.name: (_q(mwT @ b.matrix_local), (mwT @ b.head_local).copy()) for b in T.data.bones}
    C = {}
    for n in RT:
        if n in CHILD and n in RM and CHILD[n] in RM and n != 'Hips':
            dt = RT[CHILD[n]][1] - RT[n][1]; dm = RM[CHILD[n]][1] - RM[n][1]
            C[n] = dt.normalized().rotation_difference(dm.normalized())
    def par(n):
        p = T.data.bones[n].parent
        return p.name if p else None
    for n in RT:
        if n not in C:
            C[n] = C.get(par(n), Quaternion())
    legT = sum((RT[CHILD[b]][1] - RT[b][1]).length for b in LEG)
    legM = sum((RM[CHILD[b]][1] - RM[b][1]).length for b in LEG)
    ratio = legT / legM
    order = []
    def walk(b):
        order.append(b.name)
        for c in b.children:
            walk(c)
    for b in T.data.bones:
        if b.parent is None:
            walk(b)
    newact = bpy.data.actions.new(spec['name'])
    T.animation_data_create()
    T.animation_data.action = newact
    for pb in T.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    armq = mwT.to_quaternion()
    arm3inv = mwT.to_3x3().inverted()
    hips_y = []
    last = {}
    for fi, fr in enumerate(frames):
        want = {}
        for n in order:
            src = n if n in fr else ('Head' if n == 'headfront' else None)
            if src is None:
                continue
            D = fr[src][0] @ RM[src][0].inverted()
            want[n] = (D @ C[n] @ RT[n][0]).normalized()
            if n.endswith('Hand') and T.data.bones[n].parent and T.data.bones[n].parent.name in want:
                pn = T.data.bones[n].parent.name  # soften the wrist: halfway to "hand follows forearm"
                follow = (want[pn] @ RT[pn][0].inverted() @ RT[n][0]).normalized()
                want[n] = follow.slerp(want[n], spec.get('wrist', 0.5)).normalized()
        for n in order:
            if n not in want:
                continue
            b = T.data.bones[n]; pb = T.pose.bones[n]
            Rr = (armq.inverted() @ RT[n][0])  # armature-space rest
            wn = armq.inverted() @ want[n]
            if b.parent and b.parent.name in want:
                Rp = armq.inverted() @ RT[b.parent.name][0]
                wp = armq.inverted() @ want[b.parent.name]
                q = (Rp.inverted() @ Rr).inverted() @ wp.inverted() @ wn
            else:
                q = Rr.inverted() @ wn
            if n in last and last[n].dot(q) < 0:
                q = -q
            last[n] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=fi)
            if n == 'Hips':
                off = (fr['Hips'][1] - RM['Hips'][1]) * ratio
                if spec.get('strip_xz'):
                    off = Vector((0, 0, off.z))
                hips_y.append(off.z)
                pb.location = Rr.inverted() @ (arm3inv @ off)
                pb.keyframe_insert('location', frame=fi)
    for o in [M]:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        if a.users == 0 and a != newact:
            bpy.data.actions.remove(a)
    return newact, len(frames) - 1, {'hips_y': hips_y, 'ratio': ratio}

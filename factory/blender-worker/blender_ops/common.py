"""Shared helpers for the Blender-side scripts (run inside Blender: blender --background --python <op>.py -- args).

Character axes used everywhere in reports and in the animation API (metres):
    right   = the character's own right hand side
    up      = up
    forward = the way the character faces (game +Z; Blender -Y after glTF import)
A point is written as (right, up, forward).
"""
import json, math, os, sys
import bpy
from mathutils import Matrix, Quaternion, Vector

FPS = 30
# Blender world directions of the character axes (glTF +Z forward -> Blender -Y; right = -X).
W_RIGHT, W_UP, W_FORWARD = Vector((-1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))
AXES = {'right': W_RIGHT, 'up': W_UP, 'forward': W_FORWARD,
        'left': -W_RIGHT, 'down': -W_UP, 'back': -W_FORWARD}


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = {}
    i = 0
    while i < len(a):
        k = a[i].lstrip('-')
        out[k] = a[i + 1] if i + 1 < len(a) else ''
        i += 2
    return out


def write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=1)


def to_char(v):
    """Blender world vector -> (right, up, forward), rounded."""
    return [round(v.dot(W_RIGHT), 4), round(v.dot(W_UP), 4), round(v.dot(W_FORWARD), 4)]


def from_char(t):
    return W_RIGHT * t[0] + W_UP * t[1] + W_FORWARD * t[2]


def clean_scene():
    for o in list(bpy.data.objects):  # the default cube, camera and light
        bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.fps_base = 1.0
    return sc


def op_kwargs(op, wanted):
    """Keep only the options this Blender version's operator really has."""
    try:
        have = set(op.get_rna_type().properties.keys())
    except Exception:
        return wanted
    return {k: v for k, v in wanted.items() if k in have}


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def find_armature(objs=None):
    arms = [o for o in (objs or bpy.data.objects) if o.type == 'ARMATURE']
    if not arms:
        return None
    return max(arms, key=lambda o: len(o.data.bones))


def is_helper(o):
    """Objects the glTF importer adds for display only (bone shapes), not part of the model."""
    return (o.type == 'MESH' and o.name.startswith('Icosphere') and not o.vertex_groups
            and not any(m.type == 'ARMATURE' for m in o.modifiers) and len(o.data.vertices) <= 642)


def skinned_meshes(arm):
    out = []
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        if any(m.type == 'ARMATURE' and m.object == arm for m in o.modifiers) or o.parent == arm:
            out.append(o)
    return out


def action_fcurves(act):
    """All F-curves of an action, for both the old and the new (slotted, Blender 4.4+/5.x) action layout."""
    fcs = []
    try:
        for layer in act.layers:
            for strip in layer.strips:
                for bag in getattr(strip, 'channelbags', []):
                    fcs.extend(bag.fcurves)
    except AttributeError:
        pass
    if not fcs:
        try:
            fcs = list(act.fcurves)
        except AttributeError:
            pass
    return fcs


def action_bones(act):
    names = set()
    for fc in action_fcurves(act):
        p = fc.data_path
        if p.startswith('pose.bones["'):
            names.add(p.split('"')[1])
    return sorted(names)


def armature_actions(arm):
    """Actions that belong to this armature: the active one plus every NLA strip (how the glTF importer stores clips)."""
    acts = []
    ad = arm.animation_data
    if ad:
        if ad.action:
            acts.append(ad.action)
        for tr in ad.nla_tracks:
            for st in tr.strips:
                if st.action and st.action not in acts:
                    acts.append(st.action)
    bone_names = {b.name for b in arm.data.bones}
    for a in bpy.data.actions:  # clips the importer left unassigned
        if a not in acts and set(action_bones(a)) & bone_names:
            acts.append(a)
    return acts


def set_action(arm, act):
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = act
    if act is not None and hasattr(ad, 'action_slot') and getattr(act, 'slots', None):
        if ad.action_slot is None or ad.action_slot not in list(act.slots):
            try:
                ad.action_slot = act.slots[0]
            except Exception:
                pass


def evaluate(arm, act, frame):
    """Pose the armature with `act` at `frame` with NLA switched off."""
    ad = arm.animation_data or arm.animation_data_create()
    ad.use_nla = False
    set_action(arm, act)
    bpy.context.scene.frame_set(int(round(frame)))
    bpy.context.view_layer.update()


def pick_idle(acts):
    for want in ('idle',):
        for a in acts:
            if a.name.lower() == want:
                return a
        for a in acts:
            if want in a.name.lower():
                return a
    return acts[0] if acts else None


def base_pose(arm):
    """The pose new animations start from: frame 0 of the Idle clip (or the rest pose if there is none)."""
    acts = armature_actions(arm)
    idle = pick_idle(acts)
    if idle:
        evaluate(arm, idle, idle.frame_range[0])
    else:
        evaluate(arm, None, 0)
        for pb in arm.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
    mw = arm.matrix_world
    pose = {}
    for pb in arm.pose.bones:
        pose[pb.name] = {
            'basis': pb.matrix_basis.copy(),
            'matrix': pb.matrix.copy(),                         # armature space
            'frame': pb.matrix @ pb.matrix_basis.inverted(),    # parent pose x rest offset, armature space
            'head_a': pb.head.copy(), 'head_w': mw @ pb.head,
        }
    # glTF joints have no length, so Blender's bone tails are made up. The real "tip" of a bone is where its
    # child starts; a bone without children (hand, head, toe) gets a short tip along its parent's direction.
    for pb in arm.pose.bones:
        p = pose[pb.name]
        kids = [c for c in pb.children if (pose[c.name]['head_a'] - p['head_a']).length > 1e-6]
        if kids:
            # one child: its start; several (e.g. the top of the spine): the middle of them
            tip_a = sum((pose[c.name]['head_a'] for c in kids), Vector()) / len(kids)
        elif pb.parent is not None:
            seg = p['head_a'] - pose[pb.parent.name]['head_a']
            tip_a = p['head_a'] + (seg if seg.length > 1e-6 else Vector((0, 0, 0.01))) * 0.35
        else:
            tip_a = p['head_a'] + Vector((0, 0, 0.01))
        p['tip_a'] = tip_a
        p['tail_w'] = mw @ tip_a
        d = tip_a - p['head_a']
        p['dir_a'] = d.normalized() if d.length > 1e-9 else Vector((0, 0, 1))
    return pose, (idle.name if idle else None)


def bone_table(arm, pose):
    out = {}
    for b in arm.data.bones:
        p = pose[b.name]
        d = p['tail_w'] - p['head_w']
        out[b.name] = {'parent': b.parent.name if b.parent else None,
                       'children': [c.name for c in b.children],
                       'head': to_char(p['head_w']), 'tail': to_char(p['tail_w']),
                       'length': round(d.length, 4),
                       'points': to_char(d.normalized()) if d.length > 1e-6 else [0, 0, 0],
                       'deforms': b.use_deform}
    return out


def world_bbox(objs):
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        ev = o.evaluated_get(dg)
        for c in ev.bound_box:
            w = ev.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi


def char_dims(lo, hi):
    corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    cs = [to_char(c) for c in corners]
    mn = [min(c[i] for c in cs) for i in range(3)]
    mx = [max(c[i] for c in cs) for i in range(3)]
    return {'min': mn, 'max': mx, 'width': round(mx[0] - mn[0], 4), 'height': round(mx[1] - mn[1], 4), 'depth': round(mx[2] - mn[2], 4)}


BONE_WORDS = {
    'right': ['right', '_r', '.r', 'r_', ' r', 'rt'], 'left': ['left', '_l', '.l', 'l_', ' l', 'lt'],
    'hand': ['hand', 'wrist'], 'forearm': ['forearm', 'lowerarm', 'lower_arm', 'elbow'],
    'upperarm': ['upperarm', 'upper_arm', 'arm'], 'shoulder': ['shoulder', 'clavicle'],
    'spine': ['spine', 'chest', 'torso'], 'hips': ['hips', 'pelvis', 'root'], 'head': ['head'], 'neck': ['neck'],
    'thigh': ['upleg', 'thigh', 'upperleg'], 'shin': ['leg', 'calf', 'shin', 'knee'], 'foot': ['foot', 'ankle'],
}


def find_bone(names, query):
    """Exact name first, then a word search like 'right hand'."""
    if query in names:
        return query
    low = {n: n.lower() for n in names}
    for n in names:
        if low[n] == query.lower():
            return n
    words = query.lower().replace('_', ' ').split()
    best, score = None, 0
    for n in names:
        s = 0
        for w in words:
            alts = BONE_WORDS.get(w, [w])
            if any(a in low[n] for a in alts):
                s += 1
        if w_side_conflict(low[n], words):
            s -= 5
        if s > score or (s == score and best and len(n) < len(best)):
            best, score = n, s
    return best if score >= len(words) else None


def w_side_conflict(lname, words):
    if 'right' in words and ('left' in lname or lname.endswith(('_l', '.l', ' l')) or lname.startswith('l_')):
        return True
    if 'left' in words and ('right' in lname or lname.endswith(('_r', '.r', ' r')) or lname.startswith('r_')):
        return True
    return False


def setup_render(res=512):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_WORKBENCH'
    except TypeError:
        pass
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sh = sc.display.shading
    sh.light = 'STUDIO'
    try:
        sh.color_type = 'TEXTURE'
    except TypeError:
        sh.color_type = 'MATERIAL'
    sh.show_shadows = True
    sh.show_cavity = True
    try:
        sh.background_type = 'VIEWPORT'
        sh.background_color = (0.16, 0.17, 0.2)
    except (AttributeError, TypeError):
        pass
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.color = (0.16, 0.17, 0.2)


def make_camera(lo, hi, yaw_deg=35, pitch_deg=10, margin=1.5):
    """Orthographic camera in front of the character, turned yaw_deg toward its right side."""
    sc = bpy.context.scene
    center = (lo + hi) / 2
    size = max((hi - lo).length * 0.75, 0.01) * margin
    cam_data = bpy.data.cameras.new('PreviewCam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = size
    cam = bpy.data.objects.new('PreviewCam', cam_data)
    sc.collection.objects.link(cam)
    yaw, pitch = math.radians(yaw_deg), math.radians(pitch_deg)
    d = (W_FORWARD * math.cos(yaw) + W_RIGHT * math.sin(yaw)) * math.cos(pitch) + W_UP * math.sin(pitch)
    cam.location = center + d * size * 3
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cam_data.clip_end = size * 10
    sc.camera = cam
    return cam


def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

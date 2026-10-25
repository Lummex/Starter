"""Build new animation clips from the checked anims/<Name>.py scripts, render previews and export.

Outputs in --out:
    (--in is a decompressed copy Blender can read; --orig is the untouched original)
    char.glb            the ORIGINAL model file with the new clip(s) added (geometry and old clips byte-for-byte unchanged)
    events.json         gameplay events per clip (e.g. projectile_release), kept outside the model
    preview-weapon.glb  preview only: the character with the held prop attached to the hand
    preview-<Clip>-<frame>.png
    build-report.json   what was built, plus problems/notes for the revision round
    blender-export.glb  Blender's own export (used to splice the clip into char.glb; not used by the game)
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Matrix, Quaternion, Vector
import common as C
import glbtool

SAFE_MODULES = {'math', 'mathutils', 'random'}
SAFE_BUILTINS = {k: __builtins__[k] if isinstance(__builtins__, dict) else getattr(__builtins__, k) for k in (
    'abs', 'all', 'any', 'bool', 'dict', 'enumerate', 'float', 'int', 'isinstance', 'len', 'list', 'max', 'min',
    'print', 'range', 'reversed', 'round', 'set', 'sorted', 'str', 'sum', 'tuple', 'zip', 'ValueError', 'Exception')}


def safe_import(name, *a, **k):
    if name.split('.')[0] not in SAFE_MODULES:
        raise ImportError(f'import of {name} is not allowed')
    return __import__(name, *a, **k)


SAFE_BUILTINS['__import__'] = safe_import
INTERPS = {'BEZIER', 'LINEAR', 'CONSTANT'}


class Ctx:
    """The ONLY thing an animation script can touch. See ANIMATION-API.md."""

    def __init__(self, arm, pose, table, spec, insp, part_names):
        self._arm, self._pose = arm, pose
        self.bones = table
        self.fps = C.FPS
        self.height = insp.get('size', {}).get('height', 1.0)
        self.request = spec
        self.parts = list(part_names)
        self._len = None
        self._keys = {}      # frame -> bone -> dict
        self._events = []
        self._attach = []
        self._notes = []
        self._problems = []

    # --- lookup
    def bone(self, query):
        n = C.find_bone(list(self.bones), query)
        if not n:
            raise ValueError(f'No bone matches {query!r}. Bones: {", ".join(self.bones)}')
        return n

    def parent(self, bone):
        return self.bones[self.bone(bone)]['parent']

    def children(self, bone):
        return list(self.bones[self.bone(bone)]['children'])

    # --- building
    def length(self, frames):
        self._len = int(frames)

    def key(self, frame, bone, turn=None, aim=None, twist=0.0, move=None, interp='BEZIER'):
        b = self.bone(bone)
        frame = int(round(frame))
        interp = str(interp).upper()
        if interp not in INTERPS:
            raise ValueError(f'interp must be one of {sorted(INTERPS)}')
        for t in (turn or []):
            if len(t) != 2 or t[0] not in C.AXES:
                raise ValueError(f'turn entries look like ("right", 30); axes are {list(C.AXES)}')
        if aim is not None and (len(aim) != 3 or Vector(aim).length < 1e-6):
            raise ValueError('aim is a direction (right, up, forward), e.g. (0, 1, 0) for straight up')
        if move is not None and len(move) != 3:
            raise ValueError('move is (right, up, forward) in metres')
        self._keys.setdefault(frame, {})[b] = {'turn': [(t[0], float(t[1])) for t in (turn or [])],
                                                'aim': tuple(aim) if aim is not None else None,
                                                'twist': float(twist), 'move': tuple(move) if move is not None else None,
                                                'interp': interp}

    def event(self, frame, name, **data):
        if 'bone' in data:
            data['bone'] = self.bone(data['bone'])
        self._events.append({'frame': int(round(frame)), 'name': str(name), **{k: v for k, v in data.items() if isinstance(v, (str, int, float, bool, list))}})

    def attach(self, part, bone, length=None, offset=(0, 0, 0), turn=None, hide_at=None, show_at=None):
        if part not in self.parts:
            raise ValueError(f'Unknown part {part!r}; parts are {self.parts}')
        self._attach.append({'part': part, 'bone': self.bone(bone), 'length': length, 'offset': tuple(offset),
                             'turn': [(t[0], float(t[1])) for t in (turn or [])], 'hide_at': hide_at, 'show_at': show_at})

    def note(self, text):
        self._notes.append(str(text)[:500])


# ----------------------------------------------------------------------------- maths
def rot_world(arm, turn, aim, twist, pose_b):
    """The extra rotation (armature space) a key asks for, relative to the base pose."""
    arm_inv = arm.matrix_world.to_quaternion().inverted()
    O = pose_b['matrix'].to_quaternion()
    bone_dir = (O @ Vector((0, 1, 0))).normalized()
    R = Quaternion()
    if twist:
        R = Quaternion(bone_dir, math.radians(twist)) @ R
    if aim is not None:
        target = (arm_inv @ C.from_char(aim)).normalized()
        R = bone_dir.rotation_difference(target) @ R
    for ax, deg in turn:
        a = (arm_inv @ C.AXES[ax]).normalized()
        R = Quaternion(a, math.radians(deg)) @ R
    return R


def key_values(arm, pose_b, spec):
    basis = pose_b['basis']
    loc0, q0, s0 = basis.decompose()
    O = pose_b['matrix'].to_quaternion()
    R = rot_world(arm, spec['turn'], spec['aim'], spec['twist'], pose_b)
    q = q0 @ O.inverted() @ R @ O
    loc = loc0.copy()
    if spec['move'] is not None:
        d_arm = arm.matrix_world.to_3x3().inverted() @ C.from_char(spec['move'])
        loc = loc0 + pose_b['frame'].to_3x3().inverted() @ d_arm
    return loc, q.normalized(), s0


def run_script(path, ctx):
    with open(path, encoding='utf-8') as f:
        src = f.read()
    g = {'__builtins__': SAFE_BUILTINS, '__name__': 'anim'}
    exec(compile(src, path, 'exec'), g)
    if 'build' not in g:
        raise ValueError('no build(ctx)')
    g['build'](ctx)


def build_action(arm, pose, name, ctx):
    L = ctx._len
    frames = sorted(ctx._keys)
    if not L:
        L = (frames[-1] if frames else 30)
    keys = {f: dict(v) for f, v in ctx._keys.items() if 0 <= f <= L}
    dropped = [f for f in ctx._keys if f < 0 or f > L]
    if dropped:
        ctx._problems.append(f'Keys outside 0..{L} were ignored: frames {sorted(dropped)}')
    neutral = {'turn': [], 'aim': None, 'twist': 0.0, 'move': None, 'interp': 'BEZIER'}
    for f in (0, L):
        keys.setdefault(f, {})
        for b in pose:
            keys[f].setdefault(b, dict(neutral))
    old = bpy.data.actions.get(name)
    if old:
        old.name = name + '__replaced'
    act = bpy.data.actions.new(name)
    ad = arm.animation_data or arm.animation_data_create()
    ad.use_nla = False
    C.set_action(arm, act)
    pbs = arm.pose.bones
    last_q = {}
    interp_at = {}
    for f in sorted(keys):
        for b, spec in keys[f].items():
            pb = pbs[b]
            if pb.rotation_mode != 'QUATERNION':
                pb.rotation_mode = 'QUATERNION'
            loc, q, s = key_values(arm, pose[b], spec)
            if b in last_q and last_q[b].dot(q) < 0:
                q = -q
            last_q[b] = q
            pb.location, pb.rotation_quaternion, pb.scale = loc, q, s
            pb.keyframe_insert('location', frame=f, group=b)
            pb.keyframe_insert('rotation_quaternion', frame=f, group=b)
            if f in (0, L):
                pb.keyframe_insert('scale', frame=f, group=b)
            interp_at[(b, f)] = spec['interp']
    for fc in C.action_fcurves(act):
        if not fc.data_path.startswith('pose.bones["'):
            continue
        b = fc.data_path.split('"')[1]
        for kp in fc.keyframe_points:
            kp.interpolation = interp_at.get((b, int(round(kp.co[0]))), 'BEZIER')
            kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
        fc.update()
    return act, L


def stash(arm, act):
    ad = arm.animation_data
    tr = ad.nla_tracks.new()
    tr.name = act.name
    st = tr.strips.new(act.name, int(act.frame_range[0]), act)
    if hasattr(st, 'action_slot') and getattr(act, 'slots', None):
        try:
            st.action_slot = act.slots[0]
        except Exception:
            pass
    tr.mute = True


def import_part(path, name):
    objs = C.import_glb(path)
    meshes = [o for o in objs if o.type == 'MESH']
    lo, hi = C.world_bbox(meshes)
    root = bpy.data.objects.new(f'Prop_{name}', None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (lo + hi) / 2
    bpy.context.view_layer.update()
    for o in objs:
        if o.parent is None:
            mw = o.matrix_world.copy()
            o.parent = root
            o.matrix_world = mw
    return root, meshes, max((hi - lo).length, 1e-6) / math.sqrt(3) * 1.0, (hi - lo)


def place_part(arm, pose, at, part_info):
    root, meshes, _, dims = part_info
    biggest = max(dims.x, dims.y, dims.z, 1e-6)
    scale = (at['length'] / biggest) if at['length'] else 1.0
    pb = pose[at['bone']]
    R = Quaternion()
    for ax, deg in at['turn']:
        R = Quaternion(C.AXES[ax], math.radians(deg)) @ R
    loc = pb['tail_w'] + C.from_char(at['offset'])
    root.matrix_world = Matrix.LocRotScale(loc, R, Vector((scale, scale, scale)))
    bpy.context.view_layer.update()
    mw = root.matrix_world.copy()
    root.parent = arm
    root.parent_type = 'BONE'
    root.parent_bone = at['bone']
    bpy.context.view_layer.update()
    root.matrix_world = mw
    bpy.context.view_layer.update()
    return scale


def key_visibility(objs, frames_visible):
    """frames_visible: list of (frame, visible). Constant keys on hide_render/hide_viewport."""
    for o in objs:
        for f, vis in frames_visible:
            o.hide_render = not vis
            o.keyframe_insert('hide_render', frame=f)
        ad = o.animation_data
        if ad and ad.action:
            for fc in C.action_fcurves(ad.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'


def quality_checks(arm, pose, act, L, ctx, spec_anim):
    probs, notes = ctx._problems, list(ctx._notes)
    # requested length
    want = spec_anim.get('frames')
    if want and not (want[0] <= L <= want[1]):
        probs.append(f'Clip is {L} frames; the job asked for {want[0]}-{want[1]}')
    # required events
    have = {e['name'] for e in ctx._events}
    for ev in spec_anim.get('events', []):
        if ev['name'] not in have:
            probs.append(f'Required event {ev["name"]!r} was not added (use ctx.event)')
    for e in ctx._events:
        if not 0 <= e['frame'] <= L:
            probs.append(f'Event {e["name"]} at frame {e["frame"]} is outside 0..{L}')
    # returns to the base pose (unless it is meant to end elsewhere, e.g. a death)
    if spec_anim.get('return_to_idle', True):
        for b, spec in ctx._keys.get(L, {}).items():
            if spec['turn'] or spec['aim'] or spec['twist'] or spec['move']:
                probs.append(f'{b} is not back in the idle pose at the last frame ({L})')
    # speed and foot sliding, sampled every frame
    feet = [n for n in (C.find_bone(list(pose), 'left foot'), C.find_bone(list(pose), 'right foot')) if n]
    mw = arm.matrix_world
    prevq, foot0, fastest, drift = {}, {}, (0, None, None), 0.0
    for f in range(0, L + 1):
        C.evaluate(arm, act, f)
        for pb in arm.pose.bones:
            q = pb.matrix.to_quaternion()
            if pb.name in prevq:
                ang = math.degrees(prevq[pb.name].rotation_difference(q).angle)
                if ang > fastest[0]:
                    fastest = (ang, pb.name, f)
            prevq[pb.name] = q
        for n in feet:
            p = mw @ arm.pose.bones[n].head
            foot0.setdefault(n, p)
            drift = max(drift, (p - foot0[n]).length)
    if fastest[0] > 70:
        notes.append(f'Fastest move: {fastest[1]} turns {fastest[0]:.0f} degrees in one frame at frame {fastest[2]} (may look like a pop)')
    if drift > 0.08 * ctx.height and not spec_anim.get('feet_may_move'):
        probs.append(f'The feet slide by {drift:.3f} m ({drift / ctx.height * 100:.0f}% of height); keep them planted')
    return {'fastest_turn_per_frame_deg': round(fastest[0], 1), 'feet_drift_m': round(drift, 4)}, notes


def export(path, objs, extra=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    kw = C.op_kwargs(bpy.ops.export_scene.gltf, dict(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
        export_frame_range=False, export_anim_slide_to_zero=False, export_optimize_animation_size=False,
        export_reset_pose_bones=True, export_def_bones=False, export_skins=True, export_morph=True,
        export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
        export_draco_mesh_compression_enable=False, export_extras=False, export_anim_single_armature=True,
        **(extra or {})))
    bpy.ops.export_scene.gltf(**kw)


def main():
    a = C.args()
    out = a['out']
    with open(a['spec'], encoding='utf-8') as f:
        spec = json.load(f)
    parts = json.loads(a.get('parts') or '{}')
    job, insp = spec['job'], spec['inspection']
    sc = C.clean_scene()
    objs = C.import_glb(a['in'])
    arm = C.find_armature(objs)
    if not arm:
        raise SystemExit('No skeleton in the model')
    char_objs = [arm] + C.skinned_meshes(arm)
    pose, idle = C.base_pose(arm)
    table = C.bone_table(arm, pose)
    report = {'base_pose': f'{idle} frame 0' if idle else 'rest pose', 'fps': C.FPS, 'clips': [], 'problems': [], 'notes': []}
    events = {'asset_id': job['asset_id'], 'fps': C.FPS, 'clips': {}}
    built = []
    for anim in job['animations']:
        name = anim['name']
        ctx = Ctx(arm, pose, table, anim, insp, parts.keys())
        try:
            run_script(os.path.join(a['anims'], f'{name}.py'), ctx)
        except Exception as e:
            report['problems'].append(f'{name}.py stopped with an error: {type(e).__name__}: {e}')
            continue
        if not ctx._keys:
            report['problems'].append(f'{name}.py made no keys')
            continue
        act, L = build_action(arm, pose, name, ctx)
        stash(arm, act)
        stats, notes = quality_checks(arm, pose, act, L, ctx, anim)
        report['problems'] += [f'{name}: {p}' for p in ctx._problems]
        report['notes'] += [f'{name}: {n}' for n in notes]
        evs = sorted(ctx._events, key=lambda e: e['frame'])
        for e in evs:
            e['time'] = round(e['frame'] / C.FPS, 4)
        events['clips'][name] = {'frames': L, 'duration': round(L / C.FPS, 4), 'loop': bool(anim.get('loop', False)),
                                 'events': evs, 'attachments': [{k: at[k] for k in ('part', 'bone', 'hide_at', 'show_at')} for at in ctx._attach]}
        report['clips'].append({'name': name, 'frames': L, 'seconds': round(L / C.FPS, 3), 'key_frames': sorted(ctx._keys),
                                'bones_moved': sorted({b for fr in ctx._keys.values() for b, s in fr.items()}), 'events': evs, **stats})
        built.append((act, L, ctx))

    # ---- previews (with the held prop)
    C.setup_render(512)
    props = []
    imported = {}
    for act, L, ctx in built:
        for at in ctx._attach:
            if at['part'] not in imported:
                imported[at['part']] = import_part(parts[at['part']], at['part'])
            info = imported[at['part']]
            scale = place_part(arm, pose, at, info)
            vis = [(0, at['show_at'] is None)]
            if at['show_at'] is not None:
                vis.append((int(at['show_at']), True))
            if at['hide_at'] is not None:
                vis.append((int(at['hide_at']), False))
            key_visibility(info[1], sorted(vis))
            props.append(info)
            report['notes'].append(f'{act.name}: {at["part"]} held in {at["bone"]} at scale {scale:.3f}')
    lo, hi = C.world_bbox([o for o in char_objs if o.type == 'MESH'])
    C.make_camera(lo, hi, 35, 10, margin=2.0)
    for act, L, ctx in built:
        frames = sorted({0, L, *[e['frame'] for e in ctx._events], *[round(L * i / 6) for i in range(1, 6)]})
        for f in frames:
            C.evaluate(arm, act, f)
            sc.frame_set(f)
            C.render_to(os.path.join(out, f'preview-{act.name}-{f:03d}.png'))
    # ---- exports
    ad = arm.animation_data
    ad.action = None
    ad.use_nla = True
    for info in props:
        for o in info[1]:
            o.animation_data_clear()
            o.hide_render = False
    bpy.context.view_layer.update()
    if props:
        export(os.path.join(out, 'preview-weapon.glb'), char_objs + [p[0] for p in props] + [m for p in props for m in p[1]])
    exp_path = os.path.join(out, 'blender-export.glb')
    export(exp_path, char_objs)
    # ---- put the new clips into the ORIGINAL file (geometry and old clips untouched)
    names = [act.name for act, _, _ in built]
    if names:
        replace = [x['name'] for x in job['animations'] if x.get('replace')]
        sp = glbtool.splice(a.get('orig') or a['in'], a['in'], exp_path, names, os.path.join(out, 'char.glb'), replace=replace)
        report['splice'] = sp
        report['problems'] += sp.get('problems', [])
    with open(os.path.join(out, 'events.json'), 'w', encoding='utf-8') as f:
        json.dump(events, f, indent=1)
    C.write_json(os.path.join(out, 'build-report.json'), report)
    print('BUILD DONE', names, 'problems:', len(report['problems']))


main()

"""Inspect a character GLB: meshes, skin, skeleton, animations, size and facing. Writes JSON only; changes nothing."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import common as C


def main():
    a = C.args()
    C.clean_scene()
    objs = C.import_glb(a['in'])
    arm = C.find_armature(objs)
    rep = {'file': os.path.basename(a['in']), 'bytes': os.path.getsize(a['in']), 'blender': bpy.app.version_string,
           'fps': C.FPS, 'axes': 'points are (right, up, forward) in metres, character facing forward', 'warnings': []}
    meshes = [o for o in objs if o.type == 'MESH']
    rep['meshes'] = []
    for o in meshes:
        me = o.data
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        groups = {g.index: g.name for g in o.vertex_groups}
        unweighted, over = 0, 0
        for v in me.vertices:
            w = sum(g.weight for g in v.groups if g.group in groups)
            if w < 1e-4:
                unweighted += 1
            if len([g for g in v.groups if g.weight > 1e-4]) > 4:
                over += 1
        rep['meshes'].append({'name': o.name, 'vertices': len(me.vertices), 'triangles': tris,
                              'materials': [m.name for m in me.materials if m], 'uv_layers': len(me.uv_layers),
                              'skinned': any(m.type == 'ARMATURE' for m in o.modifiers), 'vertex_groups': len(groups),
                              'unweighted_vertices': unweighted, 'vertices_over_4_influences': over})
        if unweighted:
            rep['warnings'].append(f'{o.name}: {unweighted} vertices have no skin weight')
    if not arm:
        rep['armature'] = None
        rep['warnings'].append('No skeleton found: this model cannot be animated until it is rigged')
        rep['actions'] = []
        C.write_json(a['out'], rep)
        return
    acts = C.armature_actions(arm)
    rep['actions'] = []
    for act in acts:
        fr = act.frame_range
        rep['actions'].append({'name': act.name, 'frames': [round(fr[0], 2), round(fr[1], 2)],
                               'seconds': round((fr[1] - fr[0]) / C.FPS, 3), 'bones_animated': len(C.action_bones(act))})
    pose, idle = C.base_pose(arm)
    rep['base_pose'] = f'{idle} frame 0' if idle else 'rest pose (no Idle clip)'
    rep['armature'] = {'name': arm.name, 'bone_count': len(arm.data.bones),
                       'object_scale': [round(x, 4) for x in arm.matrix_world.to_scale()],
                       'rotation_modes': sorted({pb.rotation_mode for pb in arm.pose.bones}),
                       'bones': C.bone_table(arm, pose)}
    lo, hi = C.world_bbox(C.skinned_meshes(arm) or meshes)
    dims = C.char_dims(lo, hi)
    rep['size'] = dims
    rep['origin_at_feet'] = abs(dims['min'][1]) < 0.05 * max(dims['height'], 1e-6)
    if not rep['origin_at_feet']:
        rep['warnings'].append(f"Lowest point is at up={dims['min'][1]} (expected about 0: origin at the feet)")
    # Facing check: the toes should be in front of the ankles; the face/head usually slightly forward.
    names = list(pose.keys())
    feet = [n for n in (C.find_bone(names, 'left foot'), C.find_bone(names, 'right foot')) if n]
    toes = [n for n in names if 'toe' in n.lower()]
    if feet:
        f = rep['armature']['bones'][feet[0]]
        fwd = f['tail'][2] - f['head'][2]
        if toes:
            fwd = rep['armature']['bones'][toes[0]]['tail'][2] - f['head'][2]
        rep['facing_check'] = {'foot_points_forward_by': round(fwd, 4), 'facing_ok': fwd > 0}
        if fwd <= 0:
            rep['warnings'].append('The feet do not point forward (+Z in game). The model may face the wrong way.')
    rep['key_bones'] = {k: C.find_bone(names, k) for k in ('hips', 'spine', 'neck', 'head', 'right shoulder', 'right upperarm',
                                                           'right forearm', 'right hand', 'left shoulder', 'left upperarm',
                                                           'left forearm', 'left hand', 'right thigh', 'right shin', 'right foot',
                                                           'left thigh', 'left shin', 'left foot')}
    C.write_json(a['out'], rep)
    print('INSPECT OK', len(rep['meshes']), 'meshes', rep['armature']['bone_count'], 'bones', len(rep['actions']), 'actions')


main()

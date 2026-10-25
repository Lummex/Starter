"""Re-import the finished model in a clean Blender scene and check it. Also renders the new clips from the FINAL file.

--in            decompressed copy of the finished char.glb
--source-report inspection.json of the source model
--spec          job-spec.json
--out           validation.json
--renders       folder for final-<Clip>-<frame>.png
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import common as C


def main():
    a = C.args()
    with open(a['source-report'], encoding='utf-8') as f:
        src = json.load(f)
    with open(a['spec'], encoding='utf-8') as f:
        spec = json.load(f)
    probs, checks = [], {}
    C.clean_scene()
    objs = C.import_glb(a['in'])
    arm = C.find_armature(objs)
    if not arm:
        C.write_json(a['out'], {'ok': False, 'problems': ['No skeleton after re-import']})
        return
    meshes = [o for o in objs if o.type == 'MESH']
    checks['bones'] = len(arm.data.bones)
    if checks['bones'] != src['armature']['bone_count']:
        probs.append(f"Bone count changed: {src['armature']['bone_count']} -> {checks['bones']}")
    checks['mesh_vertices'] = sum(len(o.data.vertices) for o in meshes)
    src_verts = sum(m['vertices'] for m in src['meshes'])
    if checks['mesh_vertices'] != src_verts:
        probs.append(f'Mesh vertex count changed: {src_verts} -> {checks["mesh_vertices"]}')
    skinned = [o.name for o in meshes if any(m.type == 'ARMATURE' for m in o.modifiers)]
    checks['skinned_meshes'] = skinned
    if not skinned:
        probs.append('No mesh is skinned to the skeleton')
    acts = {act.name: act for act in C.armature_actions(arm)}
    checks['clips'] = {n: [round(x, 2) for x in act.frame_range] for n, act in acts.items()}
    for old in src['actions']:
        if old['name'] not in acts and not any(x['name'] == old['name'] and x.get('replace') for x in spec['job']['animations']):
            probs.append(f"Existing clip {old['name']} is missing")
        elif old['name'] in acts:
            fr = acts[old['name']].frame_range
            if abs((fr[1] - fr[0]) - (old['frames'][1] - old['frames'][0])) > 1.01:
                probs.append(f"Existing clip {old['name']} changed length")
    new = []
    for anim in spec['job']['animations']:
        act = acts.get(anim['name'])
        if not act:
            probs.append(f"New clip {anim['name']} is missing")
            continue
        new.append(act)
        if not C.action_bones(act):
            probs.append(f"New clip {anim['name']} has no bone animation")
    # renders from the final file
    if a.get('renders') and new:
        C.setup_render(384)
        C.base_pose(arm)
        lo, hi = C.world_bbox(meshes)
        C.make_camera(lo, hi, 35, 10, margin=2.0)
        for act in new:
            f0, f1 = act.frame_range
            for i in range(5):
                f = int(round(f0 + (f1 - f0) * i / 4))
                C.evaluate(arm, act, f)
                C.render_to(os.path.join(a['renders'], f'final-{act.name}-{f:03d}.png'))
    C.write_json(a['out'], {'ok': not probs, 'problems': probs, 'checks': checks, 'blender': bpy.app.version_string})
    print('VERIFY', 'OK' if not probs else 'PROBLEMS', probs)


main()

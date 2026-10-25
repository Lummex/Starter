"""Render still pictures of a character: the base pose (front 3/4 and side) or frames of one clip."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import common as C


def main():
    a = C.args()
    out = a['out']
    os.makedirs(out, exist_ok=True)
    C.clean_scene()
    objs = C.import_glb(a['in'])
    arm = C.find_armature(objs)
    meshes = [o for o in objs if o.type == 'MESH']
    C.setup_render(512)
    if arm:
        C.base_pose(arm)
    lo, hi = C.world_bbox(meshes)
    if not a.get('action'):
        C.make_camera(lo, hi, 35, 10)
        C.render_to(os.path.join(out, 'preview-rest.png'))
        cam = bpy.context.scene.camera
        bpy.data.objects.remove(cam, do_unlink=True)
        C.make_camera(lo, hi, 90, 5)
        C.render_to(os.path.join(out, 'preview-rest-side.png'))
        print('PREVIEW OK')
        return
    act = bpy.data.actions.get(a['action'])
    if not act or not arm:
        raise SystemExit(f"Clip {a['action']} not found")
    C.make_camera(lo, hi, 35, 10, margin=2.0)
    f0, f1 = act.frame_range
    for i in range(6):
        f = round(f0 + (f1 - f0) * i / 5)
        C.evaluate(arm, act, f)
        C.render_to(os.path.join(out, f'preview-{act.name}-{int(f):03d}.png'))
    print('PREVIEW OK')


main()

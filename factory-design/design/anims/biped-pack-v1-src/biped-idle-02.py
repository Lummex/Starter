import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# shifty: hunched, head darts side to side and holds, suspicious
def build(ctx):
    L = 96; ctx.length(L)
    for f in frames(L, 6):
        e = env(T * f / L)
        K(ctx, L, f, 'Spine01', turn=[('right', -7 * e)])
        K(ctx, L, f, 'Spine', turn=[('right', -4 * e)])
        K(ctx, L, f, 'LeftShoulder', turn=[('forward', 6 * e)])
        K(ctx, L, f, 'RightShoulder', turn=[('forward', -6 * e)])
        K(ctx, L, f, 'LeftForeArm', turn=[('right', 18 * e)])
        K(ctx, L, f, 'RightForeArm', turn=[('right', 18 * e)])
    seq = [(0, 0, 0), (8, 0, -6), (12, 32, -6), (15, 27, -6), (30, 27, -5), (34, -34, -6), (37, -29, -6),
           (52, -29, -5), (56, 14, -9), (59, 10, -9), (66, 10, -9), (69, -12, -9), (72, -9, -9), (84, -9, -6), (96, 0, 0)]
    for f, yaw, nod in seq:
        K(ctx, L, f, 'Head', turn=[('right', nod), ('up', yaw)])
        K(ctx, L, f, 'neck', turn=[('up', yaw * 0.3)])

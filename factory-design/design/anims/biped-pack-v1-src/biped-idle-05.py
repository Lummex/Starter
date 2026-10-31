import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# boxer: fists up, bouncing on the toes, little bob and weave
def build(ctx):
    L = 75; ctx.length(L)
    for f in frames(L, 3):
        t = T * f / L; e = env(t)
        hop = (1 - math.cos(5 * t)) / 2 * e
        w = math.sin(t) * e
        K(ctx, L, f, 'Hips', move=(0.004 * w, 0.011 * hop, 0))
        K(ctx, L, f, 'Spine02', turn=[('right', -6 * e + 2 * hop), ('up', 7 * w)])
        K(ctx, L, f, 'Head', turn=[('right', -6 * e - 3 * hop), ('forward', -4 * w)])
        K(ctx, L, f, 'LeftArm', turn=[('right', 40 * e), ('forward', 8 * e)])
        K(ctx, L, f, 'RightArm', turn=[('right', 36 * e), ('forward', -8 * e)])
        K(ctx, L, f, 'LeftForeArm', turn=[('right', 95 * e - 6 * hop)])
        K(ctx, L, f, 'RightForeArm', turn=[('right', 100 * e - 6 * hop)])

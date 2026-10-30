import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# fidgety: shifts weight foot to foot (feet stay put), fiddles hands, glances down
def build(ctx):
    L = 114; ctx.length(L)
    for f in frames(L, 3):
        t = T * f / L; w = math.sin(2 * t); c = (1 - math.cos(t)) / 2
        fid = math.sin(6 * t) * c
        K(ctx, L, f, 'Hips', move=(0.010 * w, 0, 0))
        K(ctx, L, f, 'Spine02', turn=[('forward', 5 * w), ('up', 3 * math.sin(t))])
        K(ctx, L, f, 'Head', turn=[('forward', -5 * w), ('right', -8 * c)])
        K(ctx, L, f, 'LeftArm', turn=[('right', 15 * c)])
        K(ctx, L, f, 'RightArm', turn=[('right', 15 * c)])
        K(ctx, L, f, 'LeftForeArm', turn=[('right', 35 * c + 8 * fid)])
        K(ctx, L, f, 'RightForeArm', turn=[('right', 35 * c - 8 * fid)])

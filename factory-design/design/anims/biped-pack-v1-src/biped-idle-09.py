import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# grumpy: arms folded-ish, leans back, impatient finger taps, slow head shake
def build(ctx):
    L = 126; ctx.length(L)
    for f in frames(L, 3):
        t = T * f / L; e = env(t)
        tap = max(0.0, math.sin(12 * t)) * e
        shake = math.sin(3 * t) * e * (1 if 40 < f < 100 else 0.25)
        K(ctx, L, f, 'Spine02', turn=[('right', 4 * e)])
        K(ctx, L, f, 'Head', turn=[('right', -9 * e), ('up', 9 * shake)])
        K(ctx, L, f, 'LeftArm', turn=[('right', 22 * e), ('forward', 10 * e)])
        K(ctx, L, f, 'RightArm', turn=[('right', 22 * e), ('forward', -10 * e)])
        K(ctx, L, f, 'LeftForeArm', turn=[('right', 95 * e), ('up', -45 * e)])
        K(ctx, L, f, 'RightForeArm', turn=[('right', 90 * e), ('up', 45 * e)])
        K(ctx, L, f, 'RightHand', turn=[('right', 18 * tap)])

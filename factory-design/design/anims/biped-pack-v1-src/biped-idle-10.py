import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# cocky: chest out, tosses head back smugly, little shoulder roll
def build(ctx):
    L = 105; ctx.length(L)
    for f in frames(L, 5):
        e = env(T * f / L)
        K(ctx, L, f, 'Spine02', turn=[('right', 4 * e), ('up', 5 * e)])
        K(ctx, L, f, 'LeftArm', turn=[('forward', 8 * e)])
        K(ctx, L, f, 'RightArm', turn=[('forward', -8 * e)])
    for f, p, y, r in [(0, 0, 0, 0), (12, 0, 4, 0), (20, -6, 6, 0), (25, 22, 12, 6), (28, 19, 10, 5), (48, 17, 10, 6),
                       (56, 5, -6, -3), (60, 8, -8, -6), (78, 8, -8, -6), (84, 2, 0, 0), (105, 0, 0, 0)]:
        K(ctx, L, f, 'Head', turn=[('right', p), ('up', y), ('forward', r)])
    for f, a in [(0, 0), (60, 0), (66, -14), (72, 4), (78, 0), (105, 0)]:
        K(ctx, L, f, 'RightShoulder', turn=[('forward', a)])
        K(ctx, L, f, 'LeftShoulder', turn=[('forward', -a * 0.6)])

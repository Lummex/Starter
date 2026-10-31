import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# wipe nose: quick sniff, swipe the back of the right wrist under the nose, little shake
def build(ctx):
    L = 54; ctx.length(L)
    for f, a, fo, sw, hd, hy in [(0, 0, 0, 0, 0, 0), (6, 0, 0, 0, 6, 0), (8, 0, 0, 0, 3, 0),
                                 (16, 1.0, 1.0, 0, 0, 0), (19, 1.0, 1.0, 0, 0, -6), (25, 1.0, 1.0, 1.0, -2, 8),
                                 (28, 1.0, 1.0, 1.1, -2, 9), (36, 0.3, 0.3, 0.6, 0, 0), (40, 0, 0.05, 0, 0, 0),
                                 (44, 0, 0, 0, -4, 0), (54, 0, 0, 0, 0, 0)]:
        K(ctx, L, f, 'RightArm', turn=[('right', 45 * a), ('forward', -18 * a + 10 * sw), ('up', 20 * a + 25 * sw)])
        K(ctx, L, f, 'RightForeArm', turn=[('right', 120 * fo)])
        K(ctx, L, f, 'Head', turn=[('right', hd), ('up', hy)])
    for f, x in [(0, 0), (40, 0), (42, 5), (44, -5), (46, 3), (48, 0), (54, 0)]:
        K(ctx, L, f, 'RightHand', turn=[('forward', x)])

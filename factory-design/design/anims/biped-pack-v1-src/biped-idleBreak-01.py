import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# big yawn and stretch: dip, arms shoot overhead, lean back with a shiver, flop down, settle
def build(ctx):
    L = 84; ctx.length(L)
    P = [  # f, spine02, spine01, head, armUp(0..1), fore
        (0, 0, 0, 0, 0, 0), (8, -6, -4, -8, 0, 10), (12, -7, -5, -10, 0, 12),
        (24, 7, 6, 20, 1.05, 15), (28, 9, 7, 22, 1.0, 12), (46, 9, 7, 22, 1.0, 12),
        (58, -5, -3, -6, 0.05, 20), (62, -3, -2, -4, -0.05, 12), (70, 1, 0, 2, 0, 4), (84, 0, 0, 0, 0, 0)]
    for f, s2, s1, hd, a, fo in P:
        K(ctx, L, f, 'Spine02', turn=[('right', s2)])
        K(ctx, L, f, 'Spine01', turn=[('right', s1)])
        K(ctx, L, f, 'Head', turn=[('right', hd)])
        K(ctx, L, f, 'LeftArm', turn=[('forward', 150 * a), ('right', 15 * a)])
        K(ctx, L, f, 'RightArm', turn=[('forward', -150 * a), ('right', 15 * a)])
        K(ctx, L, f, 'LeftForeArm', turn=[('right', fo)])
        K(ctx, L, f, 'RightForeArm', turn=[('right', fo)])
    for i, f in enumerate(range(30, 46, 2)):
        j = 3 if i % 2 else -3
        K(ctx, L, f, 'Spine01', turn=[('right', 7), ('up', j)])

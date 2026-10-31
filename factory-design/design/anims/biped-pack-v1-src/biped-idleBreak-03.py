import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# knuckle crack and arm stretch: arms push out in front, two pops, shoulder roll
def build(ctx):
    L = 72; ctx.length(L)
    for f, a, fo, hd, s in [(0, 0, 0, 0, 0), (8, 0.3, 60, -4, -2), (14, 0.7, 70, -6, -3),
                            (22, 1.0, 8, -2, -5), (26, 1.05, 0, 0, -5), (34, 1.0, 4, 0, -5), (38, 1.0, 4, 0, -5),
                            (46, 0.4, 30, 0, 2), (56, 0, 5, 0, 0), (72, 0, 0, 0, 0)]:
        if a >= 1:
            K(ctx, L, f, 'LeftArm', aim=(-0.12, 0.05 * (a - 1) * 20, 1))
            K(ctx, L, f, 'RightArm', aim=(0.12, 0.05 * (a - 1) * 20, 1))
        else:
            K(ctx, L, f, 'LeftArm', turn=[('right', 80 * a), ('up', -22 * a)])
            K(ctx, L, f, 'RightArm', turn=[('right', 80 * a), ('up', 22 * a)])
        K(ctx, L, f, 'LeftForeArm', turn=[('right', fo)])
        K(ctx, L, f, 'RightForeArm', turn=[('right', fo)])
        K(ctx, L, f, 'Head', turn=[('right', hd)])
        K(ctx, L, f, 'Spine02', turn=[('right', s)])
    for f, w in [(0, 0), (22, 0), (26, -35), (28, -45), (31, -30), (33, -45), (37, -40), (44, 0), (72, 0)]:
        K(ctx, L, f, 'LeftHand', turn=[('right', w)], interp='LINEAR')
        K(ctx, L, f, 'RightHand', turn=[('right', w)], interp='LINEAR')
    for f, r in [(0, 0), (48, 0), (54, 12), (60, -6), (66, 0), (72, 0)]:
        K(ctx, L, f, 'LeftShoulder', turn=[('forward', r), ('up', r * 0.5)])
        K(ctx, L, f, 'RightShoulder', turn=[('forward', -r), ('up', -r * 0.5)])

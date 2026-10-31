import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# suspicious look-around then shrug: crouch, slow peek left, snap right, then "eh?" shrug
def build(ctx):
    L = 78; ctx.length(L)
    for f, s, yaw, nod, sh, arm, fo, tilt in [
            (0, 0, 0, 0, 0, 0, 0, 0), (6, -6, 0, -6, 0, 0, 10, 0), (20, -8, 30, -6, 0, 0, 15, 0), (24, -8, 30, -6, 0, 0, 15, 0),
            (28, -8, -36, -6, 0, 0, 15, 0), (31, -8, -30, -6, 0, 0, 15, 0), (40, -8, -30, -6, 0, 0, 15, 0),
            (45, -2, 0, 0, 0, 0, 10, 0), (52, 4, 0, 6, 1.1, 1.05, 1, 12), (55, 4, 0, 5, 1.0, 1.0, 1, 10),
            (64, 4, 0, 5, 1.0, 1.0, 1, 10), (70, 0, 0, 0, 0, 0.1, 0.1, 0), (78, 0, 0, 0, 0, 0, 0, 0)]:
        K(ctx, L, f, 'Spine01', turn=[('right', s)])
        K(ctx, L, f, 'Head', turn=[('right', nod), ('up', yaw), ('forward', tilt)])
        K(ctx, L, f, 'LeftShoulder', turn=[('forward', 16 * sh)])
        K(ctx, L, f, 'RightShoulder', turn=[('forward', -16 * sh)])
        K(ctx, L, f, 'LeftArm', turn=[('forward', 22 * arm), ('right', 8 * arm)])
        K(ctx, L, f, 'RightArm', turn=[('forward', -22 * arm), ('right', 8 * arm)])
        if fo <= 1:
            K(ctx, L, f, 'LeftForeArm', turn=[('right', 70 * fo), ('up', -20 * fo)])
            K(ctx, L, f, 'RightForeArm', turn=[('right', 70 * fo), ('up', 20 * fo)])
        else:
            K(ctx, L, f, 'LeftForeArm', turn=[('right', fo)])
            K(ctx, L, f, 'RightForeArm', turn=[('right', fo)])

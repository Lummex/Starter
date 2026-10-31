import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# sleepy stretcher: slow lean back, shoulders roll up, head tilts back, settle
def build(ctx):
    L = 135; ctx.length(L)
    for f in frames(L, 5):
        t = T * f / L; s = (1 - math.cos(t)) / 2; s2 = s * s
        K(ctx, L, f, 'Spine02', turn=[('right', 6 * s2)])
        K(ctx, L, f, 'Spine01', turn=[('right', 5 * s2), ('forward', 2 * math.sin(2 * t))])
        K(ctx, L, f, 'Head', turn=[('right', 16 * s2), ('forward', -5 * s2)])
        K(ctx, L, f, 'LeftShoulder', turn=[('forward', 10 * s2)])
        K(ctx, L, f, 'RightShoulder', turn=[('forward', -10 * s2)])
        K(ctx, L, f, 'LeftArm', turn=[('forward', 22 * s2), ('right', -8 * s2)])
        K(ctx, L, f, 'RightArm', turn=[('forward', -22 * s2), ('right', -8 * s2)])
        K(ctx, L, f, 'LeftForeArm', turn=[('right', 25 * s2)])
        K(ctx, L, f, 'RightForeArm', turn=[('right', 25 * s2)])

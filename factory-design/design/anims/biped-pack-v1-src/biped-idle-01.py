import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# proud chest-out: slow deep breaths, chin up, shoulders back
def build(ctx):
    L = 150; ctx.length(L)
    for f in frames(L, 5):
        t = T * f / L; e = env(t); b = math.sin(2 * t) * e
        K(ctx, L, f, 'Spine02', turn=[('right', 3 * e + 1.5 * b)])
        K(ctx, L, f, 'Spine01', turn=[('right', 3 * e + 2 * b)])
        K(ctx, L, f, 'Head', turn=[('right', 10 * e - 2 * b), ('up', 4 * math.sin(t) * e)])
        K(ctx, L, f, 'LeftShoulder', turn=[('up', 6 * e), ('forward', 3 * b)])
        K(ctx, L, f, 'RightShoulder', turn=[('up', -6 * e), ('forward', -3 * b)])
        K(ctx, L, f, 'LeftArm', turn=[('forward', 9 * e + 2 * b)])
        K(ctx, L, f, 'RightArm', turn=[('forward', -9 * e - 2 * b)])

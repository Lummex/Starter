import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# bored slump: droopy posture, head lolls, one big sigh (chest up, shoulders up, then deflate)
def build(ctx):
    L = 180; ctx.length(L)
    def sigh(f):
        if f < 70 or f > 125: return 0.0
        return math.sin(math.pi * (f - 70) / 55) ** 2
    for f in frames(L, 5):
        t = T * f / L; e = env(t); s = sigh(f); loll = math.sin(t) * e
        K(ctx, L, f, 'Spine02', turn=[('right', -5 * e + 7 * s)])
        K(ctx, L, f, 'Spine01', turn=[('right', -6 * e + 5 * s)])
        K(ctx, L, f, 'Head', turn=[('right', -14 * e + 16 * s), ('forward', 7 * loll)])
        K(ctx, L, f, 'LeftShoulder', turn=[('forward', -5 * e + 12 * s)])
        K(ctx, L, f, 'RightShoulder', turn=[('forward', 5 * e - 12 * s)])
        K(ctx, L, f, 'LeftArm', turn=[('forward', -3 * e)])
        K(ctx, L, f, 'RightArm', turn=[('forward', 3 * e)])

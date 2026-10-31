import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# head-scratcher: puzzled, right hand comes up and scratches the top of the head
def build(ctx):
    L = 165; ctx.length(L)
    for f in frames(L, 5):
        e = env(T * f / L)
        K(ctx, L, f, 'Spine01', turn=[('forward', -3 * e)])
    def arm(f, k, s=0.0):
        K(ctx, L, f, 'RightArm', turn=[('forward', -70 * k), ('right', 25 * k)])
        K(ctx, L, f, 'RightForeArm', turn=[('right', 110 * k + s)])
        K(ctx, L, f, 'Head', turn=[('forward', 10 * k), ('right', -6 * k)])
    arm(0, 0); arm(25, 0); arm(40, 1.05); arm(44, 1.0)
    f = 47; sgn = 1
    while f <= 110:
        arm(f, 1.0, 9 * sgn); sgn = -sgn; f += 3
    arm(114, 1.0); arm(120, 1.0); arm(138, 0); arm(165, 0)

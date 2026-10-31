import math
T = 2 * math.pi
def frames(L, step):
    return list(range(0, L, step)) + [L]
def K(ctx, L, f, b, **kw):
    if f < L:
        ctx.key(f, b, **kw)
def env(t):
    return 1 - math.cos(t / 2) ** 8

# twitchy: tiny jerky tics of head and shoulders between nervous stillness
def build(ctx):
    L = 84; ctx.length(L)
    for f in frames(L, 6):
        e = env(T * f / L)
        K(ctx, L, f, 'Spine01', turn=[('right', -3 * e)])
    tics = {
        'Head': [(0, []), (10, []), (12, [('forward', 14)]), (14, [('forward', 11)]), (19, []),
                 (40, []), (42, [('up', 12)]), (44, [('up', -8)]), (46, [('up', 10)]), (50, []),
                 (64, []), (66, [('forward', -12), ('right', 6)]), (68, [('forward', -9), ('right', 4)]), (74, []), (84, [])],
        'RightShoulder': [(0, []), (22, []), (24, [('forward', -16)]), (26, [('forward', -12)]), (31, []),
                          (64, []), (66, [('forward', -8)]), (70, []), (84, [])],
        'LeftShoulder': [(0, []), (52, []), (54, [('forward', 15)]), (56, [('forward', 11)]), (60, []), (84, [])],
        'Spine': [(0, []), (22, []), (24, [('up', -5)]), (29, []), (52, []), (54, [('up', 5)]), (58, []), (84, [])],
    }
    for bone, ks in tics.items():
        for f, tr in ks:
            K(ctx, L, f, bone, turn=tr or [('up', 0)], interp='LINEAR')

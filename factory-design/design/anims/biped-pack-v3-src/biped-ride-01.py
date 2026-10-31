import math

DROP = 0.13   # hips drop when seated (m, pack rig ~1.0 m tall)

def seated(ctx, f, lean=12, bounce=0.0, lpush=0.0, rpush=0.0, head=0.0, interp='BEZIER', brace=0.0):
    # lean: upper body forward (deg); bounce: hips up (m); l/rpush: lever forward (0..1); brace: arms locked straighter
    ctx.key(f, 'Hips', move=(0, -DROP + bounce, -0.02 + 0.0015 * max(0, lean - 12)), turn=[('right', -8 - 0.35 * max(0, lean - 12))], interp=interp)
    ctx.key(f, 'Spine02', turn=[('right', -lean * 0.4)], interp=interp)
    ctx.key(f, 'Spine01', turn=[('right', -lean * 0.35)], interp=interp)
    ctx.key(f, 'Spine', turn=[('right', -lean * 0.25)], interp=interp)
    ctx.key(f, 'neck', turn=[('right', lean * 0.5 + head)], interp=interp)
    ctx.key(f, 'Head', turn=[('right', lean * 0.3 + head * 0.5)], interp=interp)
    for side, s, push in (('Left', -1, lpush), ('Right', 1, rpush)):
        # thighs forward, shins down to the footboard, feet flat forward
        ctx.key(f, side + 'UpLeg', aim=(s * 0.18, -0.12, 1.0), interp=interp)
        ctx.key(f, side + 'Leg', aim=(s * 0.05, -1.0, 0.25), interp=interp)
        ctx.key(f, side + 'Foot', aim=(0, -0.35, 1.0), interp=interp)
        # elbows out, fists on the levers in front at chest height
        reach = 0.75 + 0.25 * push + 0.15 * brace
        ctx.key(f, side + 'Arm', aim=(s * 0.45, -0.6 + 0.15 * brace, reach + 0.2), interp=interp)
        ctx.key(f, side + 'ForeArm', aim=(-s * 0.3, -0.05 - 0.15 * brace, 1.0), interp=interp)
        ctx.key(f, side + 'Hand', twist=s * -15, interp=interp)


def build(ctx):
    L = 72
    ctx.length(L)
    for f in range(0, L + 1, 6):
        b = 0.010 if (f // 6) % 2 else 0.0
        ph = 2 * math.pi * f / L
        lp = 0.5 + 0.5 * math.sin(ph)
        rp = 0.5 - 0.5 * math.sin(ph)
        seated(ctx, f, lean=12 + 2 * math.sin(2 * ph), bounce=b, lpush=lp, rpush=rp, head=3 * math.sin(4 * ph))


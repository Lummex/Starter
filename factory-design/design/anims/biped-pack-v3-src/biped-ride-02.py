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
    ctx.length(42)
    seated(ctx, 0, lean=12, lpush=0.5, rpush=0.5)
    seated(ctx, 6, lean=-6, lpush=0.2, rpush=0.2, head=-8, bounce=0.01)
    seated(ctx, 9, lean=-8, lpush=0.1, rpush=0.1, head=-10, bounce=0.012, interp="LINEAR")
    seated(ctx, 12, lean=46, lpush=1.0, rpush=1.0, head=18, brace=1.0, interp="LINEAR")
    ctx.event(12, "impact")
    seated(ctx, 15, lean=34, lpush=0.9, rpush=0.9, head=-6, brace=1.0, bounce=0.02)
    seated(ctx, 20, lean=40, lpush=0.95, rpush=0.95, head=8, brace=0.8)
    seated(ctx, 28, lean=16, lpush=0.6, rpush=0.6, head=-2)
    seated(ctx, 42, lean=12, lpush=0.5, rpush=0.5)


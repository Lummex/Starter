# --- shared leg helper (2-bone IK on the pack rig, written into each clip so every file stands alone) ---
import math
from mathutils import Vector, Quaternion

_AX = {'right': Vector((1, 0, 0)), 'up': Vector((0, 1, 0)), 'forward': Vector((0, 0, 1))}


def rq(axis, deg):
    """A rotation in (right, up, forward) maths that matches ctx.key(turn=[(axis, deg)])."""
    return Quaternion(_AX[axis], math.radians(-deg))


def as_turns(q):
    e = q.to_euler('XYZ')
    return [('right', -math.degrees(e.x)), ('up', -math.degrees(e.y)), ('forward', -math.degrees(e.z))]


def Legs(ctx):
    return {'ctx': ctx, 'P': {n: Vector(b['head']) for n, b in ctx.bones.items()}, 'mv': Vector(), 'rh': Quaternion()}


def base_ankle(self, side):
    return self['P'][side + 'Foot'].copy()


def leg_hips(self, f, move=(0, 0, 0), rot=None, interp='BEZIER'):
    """Key the hips (move in metres, rot = a rq(...) rotation) and remember them for the leg keys of frame f."""
    self['mv'], self['rh'] = Vector(move), (rot or Quaternion())
    self['ctx'].key(f, 'Hips', move=tuple(move), turn=as_turns(self['rh']), interp=interp)


def leg_key(self, f, side, ankle=None, pitch=0.0, yaw=0.0, interp='BEZIER'):
    """side 'Left'/'Right'; ankle = target ankle (right, up, forward); pitch > 0 = toe down (deg); yaw > 0 = toe turns left.
    Call leg_hips(legs, f, ...) first."""
    ctx, P = self['ctx'], self['P']
    up, lo, ft = side + 'UpLeg', side + 'Leg', side + 'Foot'
    H0, K0, A0 = P[up], P[lo], P[ft]
    Rh = self['rh']
    hip = P['Hips'] + self['mv'] + Rh @ (H0 - P['Hips'])
    L1, L2 = (K0 - H0).length, (A0 - K0).length
    d0 = (A0 - H0).normalized()
    pole = Rh @ ((K0 - H0) - d0 * (K0 - H0).dot(d0) + Vector((0, 0, 0.002)))
    A = Vector(ankle) if ankle is not None else A0
    d = A - hip
    self['over'] = max(self.get('over', 0.0), d.length - (L1 + L2) * 0.9995)
    dist = max(min(d.length, (L1 + L2) * 0.9995), abs(L1 - L2) + 1e-4)
    dn = d.normalized()
    p = pole - dn * pole.dot(dn)
    p.normalize()
    a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(L1 * L1 - a * a, 0.0))
    knee = hip + dn * a + p * h
    tdir, sdir = knee - hip, hip + dn * dist - knee
    bt, bs = (K0 - H0).normalized(), (A0 - K0).normalized()
    aim_t = Rh.inverted() @ tdir
    Rt = Rh @ bt.rotation_difference(aim_t)
    aim_s = Rt.inverted() @ sdir
    Rs = bs.rotation_difference(aim_s)
    D = Quaternion()
    if pitch:
        fd = (P[side + 'ToeBase'] - A0)
        fh = Vector((fd.x, 0, fd.z)).normalized()
        ax = fh.cross(Vector((0, 1, 0))).normalized()
        if (Quaternion(ax, 0.1) @ fd).y > fd.y:
            ax = -ax
        D = Quaternion(ax, math.radians(pitch))
    if yaw:
        D = rq('up', yaw) @ D
    Rf = (Rt @ Rs).inverted() @ D
    ctx.key(f, up, aim=tuple(aim_t), interp=interp)
    ctx.key(f, lo, aim=tuple(aim_s), interp=interp)
    ctx.key(f, ft, turn=as_turns(Rf), interp=interp)


def smooth(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def gait(legs, N, cycles, s, Ls, zc, lift, hip_fn, toeoff=25.0, toeup=12.0, liftshape=0.8, carry=0.5, wide=0.0, yaw_fn=None,
         phase0=0.0, reach=1.0):
    """Treadmill feet for a walk/run loop of N frames holding `cycles` full cycles (left + right step each).
    s = share of a cycle a foot is planted; Ls = how far a planted foot travels back (m); zc = middle of the stance
    (number or {'Left': z, 'Right': z}). hip_fn(phase) -> (move, rot); its height is only used while no foot is planted
    (an arc on top of the take-off/landing heights). While a foot is planted the hips ride on that leg at
    reach x its base-pose hip-to-ankle length (inverted pendulum), so the knee bend stays like the idle on every unit.
    Returns the planted-foot speed in m/s."""
    T = N / cycles / 30.0
    P = legs['P']
    frames = []
    for f in range(N + 1):
        ph = f * cycles / N + phase0
        mv, rot = hip_fn(ph % 1.0)
        feet, ys = {}, []
        for side, off, sg in (('Left', 0.0, -1), ('Right', 0.5, 1)):
            A0 = base_ankle(legs, side)
            u = (ph - off) % 1.0
            x = A0.x + sg * wide
            zs = zc[side] if isinstance(zc, dict) else zc
            if u < s:
                z = zs + Ls / 2 - Ls * (u / s)
                y, pitch = A0.y, 0.0
            else:
                q = (u - s) / (1 - s)
                m = -Ls * (1 - s) / s * carry
                h00, h10, h01, h11 = 2*q**3 - 3*q**2 + 1, q**3 - 2*q**2 + q, -2*q**3 + 3*q**2, q**3 - q**2
                z = h00 * (zs - Ls / 2) + h10 * m + h01 * (zs + Ls / 2) + h11 * m
                y = A0.y + lift * math.sin(math.pi * q ** liftshape)
                pitch = 2 * math.sin(math.pi * q) * (toeoff * (1 - q) - toeup * q)
            yw = yaw_fn(side, u) if yaw_fn else 0.0
            feet[side] = ((x, y, z), pitch, yw)
            if u < s:
                H0 = P[side + 'UpLeg']
                D0 = (A0 - H0).length * reach
                hj = P['Hips'] + Vector(mv) + rot @ (H0 - P['Hips'])
                dx, dz = x - hj.x, z - hj.z
                yj = y + math.sqrt(max(D0 * D0 - dx * dx - dz * dz, 1e-6))
                ys.append(mv[1] + (yj - hj.y))
        frames.append([list(mv), rot, feet, min(ys) if ys else None])
    # flight frames: blend the take-off and landing heights, plus the hip_fn arc
    n = len(frames) - 1
    have = [k for k in range(n) if frames[k][3] is not None]
    for k in range(n):
        if frames[k][3] is not None:
            frames[k][0][1] = frames[k][3]
            continue
        a = max([h for h in have if h < k] or [h - n for h in have if h - n < k])
        b = min([h for h in have if h > k] or [h + n for h in have if h + n > k])
        ya, yb = frames[a % n][3], frames[b % n][3]
        t = (k - a) / float(b - a)
        frames[k][0][1] = ya + (yb - ya) * t + frames[k][0][1]
    frames[n][0][1] = frames[0][0][1]
    for f, (mv, rot, feet, _) in enumerate(frames):
        leg_hips(legs, f, mv, rot)
        for side in ('Left', 'Right'):
            leg_key(legs, f, side, *feet[side])
    if legs.get('over', 0) > 0.001:
        legs['ctx'].note('legs over-stretched by %.3f m (feet may lift off the floor)' % legs['over'])
    return Ls / (s * T)


def hip_z(legs):
    P = legs['P']
    return {'Left': P['LeftUpLeg'].z, 'Right': P['RightUpLeg'].z}
# --- end helper ---


def curve(keys, f):
    """Smooth value at frame f through [(frame, value), ...] (eased between keys)."""
    if f <= keys[0][0]:
        return keys[0][1]
    for (fa, va), (fb, vb) in zip(keys, keys[1:]):
        if f <= fb:
            return va + (vb - va) * smooth((f - fa) / float(fb - fa))
    return keys[-1][1]


def plant(legs, N, hips_y, foot_y=None, hips_x=None, hips_rot=None, frames=None):
    """Key hips + both legs on every frame: feet stay on their base spots (lifted by foot_y(f) for hops)."""
    for f in (frames or range(N + 1)):
        mv = (hips_x(f) if hips_x else 0.0, hips_y(f), 0.0)
        leg_hips(legs, f, mv, hips_rot(f) if hips_rot else None)
        for side in ('Left', 'Right'):
            A = base_ankle(legs, side)
            if foot_y:
                A.y += foot_y(f, side)
            leg_key(legs, f, side, A)


def arm(ctx, f, side, upper, fore, interp='BEZIER'):
    """Point the upper arm and the forearm in these (right, up, forward) directions (relative to the chest's base pose)."""
    B = ctx.bones
    a, e, w = side + 'Arm', side + 'ForeArm', side + 'Hand'
    bu = (Vector(B[e]['head']) - Vector(B[a]['head'])).normalized()
    Ra = bu.rotation_difference(Vector(upper).normalized())
    ctx.key(f, a, aim=tuple(upper), interp=interp)
    ctx.key(f, e, aim=tuple(Ra.inverted() @ Vector(fore).normalized()), interp=interp)


# biped-walk-02: comic waddle / swagger. Short stiff-legged steps, toes out, the whole body rocks over each foot,
# chest puffed, elbows out, head bobbing the other way. Slower, bouncier rhythm than walk-01.
def build(ctx):
    N = 40                      # one full cycle, 1.33 s
    ctx.length(N)
    legs = Legs(ctx)
    s = 0.62
    Ls = 0.15
    zc = {k: v + 0.006 for k, v in hip_z(legs).items()}
    TAU = 2 * math.pi

    def hip(p):
        sn = math.sin(TAU * p)
        x = -0.026 * sn
        y = -0.008 - 0.006 * abs(math.sin(2 * TAU * p + 0.6))     # a little sink-and-bounce on each step
        return (x, y, 0.0), rq('forward', -8 * sn) @ rq('up', -4 * math.cos(TAU * p))

    def toes(side, u):
        return 12.0 if side == 'Left' else -12.0

    speed = gait(legs, N, 1, s, Ls, zc, 0.045, hip, toeoff=12, toeup=8, liftshape=0.9, carry=0.3, wide=0.012, yaw_fn=toes)
    ctx.note('rootSpeed %.4f m/s' % speed)

    sp, ch, nk, hd = ctx.bone('Spine02'), ctx.bone('Spine01'), ctx.bone('neck'), ctx.bone('Head')
    for f in range(0, N + 1, 2):
        p = f / N
        c, sn = math.cos(TAU * p), math.sin(TAU * p)
        lag = math.sin(TAU * p - 0.7)              # upper body follows the rock a few frames late
        ctx.key(f, sp, turn=[('right', 7), ('forward', 4 * lag), ('up', 6 * c)])      # chest puffed out
        ctx.key(f, ch, turn=[('right', 3), ('forward', 3 * lag)])
        ctx.key(f, nk, turn=[('forward', 6 * lag), ('up', -5 * c)])
        ctx.key(f, hd, turn=[('right', 6), ('forward', 5 * math.sin(TAU * p - 1.3))])  # chin up, head wobbles late
        # elbows out, little side-to-side arm swing (penguin swagger)
        ctx.key(f, ctx.bone('RightArm'), turn=[('right', 14 + 12 * c), ('forward', -24 - 8 * sn)])
        ctx.key(f, ctx.bone('LeftArm'), turn=[('right', 2 - 12 * c), ('forward', 24 - 8 * sn)])
        ctx.key(f, ctx.bone('RightForeArm'), turn=[('right', 30 + 8 * c)])
        ctx.key(f, ctx.bone('LeftForeArm'), turn=[('right', 26 - 8 * c)])
        ctx.key(f, ctx.bone('RightShoulder'), turn=[('forward', 4 * sn)])
        ctx.key(f, ctx.bone('LeftShoulder'), turn=[('forward', 4 * sn)])

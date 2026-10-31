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


# biped-lifted-01: dangling by the scruff. Hips stay put (the game lifts the unit); shoulders hunched up to the ears,
# legs paddling in the air with toes pointing down, arms flapping a little, head tilted with a sheepish sway.
def build(ctx):
    N = 54                      # 1.8 s loop
    ctx.length(N)
    TAU = 2 * math.pi
    for f in range(0, N + 1, 2):
        q = f / N
        k3 = math.sin(TAU * 3 * q)               # leg paddle (3 per loop)
        k3b = math.sin(TAU * 3 * q + math.pi)    # other leg, opposite
        a2, a2b = math.sin(TAU * 2 * q + 0.8), math.sin(TAU * 2 * q + 2.4)
        s1, c1 = math.sin(TAU * q), math.cos(TAU * q)
        # whole body swings gently like a pendulum
        ctx.key(f, 'Hips', turn=[('forward', 4 * s1), ('right', 3 * math.sin(TAU * 2 * q))])
        ctx.key(f, 'Spine02', turn=[('right', -4), ('forward', -2 * s1)])        # a little curled up
        ctx.key(f, 'Spine01', turn=[('right', -2)])
        ctx.key(f, 'neck', turn=[('right', 2), ('forward', 3 * c1)])
        ctx.key(f, 'Head', turn=[('right', 6), ('forward', 12 + 5 * c1), ('up', 6 * s1)])   # sheepish head tilt, face stays visible
        # shoulders hunched up (the scruff is pulled)
        ctx.key(f, 'RightShoulder', turn=[('forward', 16)])
        ctx.key(f, 'LeftShoulder', turn=[('forward', -16)])
        # arms flapping a bit, out from the body
        ctx.key(f, 'RightArm', turn=[('forward', -28 - 12 * a2), ('right', 18 + 14 * a2b)])
        ctx.key(f, 'LeftArm', turn=[('forward', 28 + 12 * a2b), ('right', 18 + 14 * a2)])
        ctx.key(f, 'RightForeArm', turn=[('right', 40 + 20 * a2b)])
        ctx.key(f, 'LeftForeArm', turn=[('right', 40 + 20 * a2)])
        # legs paddling (bicycle-ish), toes pointing down
        for side, k, kk in (('Left', k3, math.cos(TAU * 3 * q)), ('Right', k3b, -math.cos(TAU * 3 * q))):
            ctx.key(f, side + 'UpLeg', turn=[('right', 14 + 18 * k)])
            ctx.key(f, side + 'Leg', turn=[('right', -(30 + 22 * kk))])
            ctx.key(f, side + 'Foot', turn=[('right', -45 + 8 * k)])

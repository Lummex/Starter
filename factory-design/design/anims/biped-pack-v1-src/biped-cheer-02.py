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


# biped-cheer-02: silly happy dance. Both arms shoot up in a V, then the whole body wiggles side to side with
# hands waggling, head bopping, three little hops on the spot (biggest one = event "peak"), then arms drop and settle.
def build(ctx):
    N = 62
    ctx.length(N)
    legs = Legs(ctx)
    TAU = 2 * math.pi
    W0, W1 = 8, 46               # wiggle section
    def wig(f):                  # -1..1 side-to-side, 4 frames per beat side, eased in and out
        if f <= W0 or f >= W1:
            return 0.0
        env = min(1.0, (f - W0) / 4.0, (W1 - f) / 4.0)
        return env * math.sin(TAU * (f - W0) / 12.0)
    hy = [(0, 0), (5, -0.03), (7, -0.032), (11, 0.0), (13, -0.018), (16, 0.04), (19, -0.026), (22, -0.012),
          (26, -0.022), (29, 0.02), (32, -0.024), (36, -0.014), (39, 0.02), (42, -0.024), (47, -0.016), (52, -0.022), (62, 0)]
    fy = [(0, 0), (14, 0), (16, 0.045), (18.5, 0), (27.5, 0), (29, 0.022), (31, 0), (37.5, 0), (39, 0.022), (41, 0), (62, 0)]
    plant(legs, N, lambda f: curve(hy, f), lambda f, side: curve(fy, f),
          hips_x=lambda f: 0.012 * wig(f), hips_rot=lambda f: rq('forward', 6 * wig(f)) @ rq('up', 6 * wig(f - 2)),
          frames=range(1, N))
    ctx.event(16, 'peak')

    sp, ch, nk, hd = ctx.bone('Spine02'), ctx.bone('Spine01'), ctx.bone('neck'), ctx.bone('Head')
    # dip and gather
    ctx.key(5, sp, turn=[('right', -10)])
    ctx.key(5, hd, turn=[('right', -6)])
    arm(ctx, 5, 'Right', (0.5, -0.8, 0.3), (0.2, 0.2, 1.0))
    arm(ctx, 5, 'Left', (-0.5, -0.8, 0.3), (-0.2, 0.2, 1.0))
    # arms up in a V, then wiggle
    for f in range(9, W1 - 1, 2):
        w, wl = wig(f), wig(f - 2)          # arms and head follow the hips a little late
        ctx.key(f, sp, turn=[('right', 6), ('forward', -12 * w)])
        ctx.key(f, ch, turn=[('forward', -6 * wl)])
        ctx.key(f, nk, turn=[('forward', 10 * wl)])
        ctx.key(f, hd, turn=[('right', 10 + 4 * abs(wl)), ('forward', 12 * wig(f - 3))])
        arm(ctx, f, 'Right', (0.5 + 0.15 * wl, 0.85, 0.1), (0.25 + 0.55 * wl, 0.9, 0.15))
        arm(ctx, f, 'Left', (-0.5 + 0.15 * wl, 0.85, 0.1), (-0.25 + 0.55 * wl, 0.9, 0.15))
    # arms drop, little happy shrug, settle
    ctx.key(50, sp, turn=[('right', -4)])
    ctx.key(50, hd, turn=[('right', 6)])
    arm(ctx, 50, 'Right', (0.35, -0.9, 0.15), (0.2, -0.5, 0.8))
    arm(ctx, 50, 'Left', (-0.35, -0.9, 0.15), (-0.2, -0.5, 0.8))
    ctx.key(50, ctx.bone('RightShoulder'), turn=[('forward', 8)])
    ctx.key(50, ctx.bone('LeftShoulder'), turn=[('forward', -8)])

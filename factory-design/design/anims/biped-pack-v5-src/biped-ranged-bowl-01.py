# ---- shared pose helper (w3). Internal coords: (right, up, back) = right-handed.
import math
from mathutils import Vector, Quaternion, Matrix

AX = {'right': (1, 0, 0), 'left': (-1, 0, 0), 'up': (0, 1, 0), 'down': (0, -1, 0), 'back': (0, 0, 1), 'forward': (0, 0, -1)}
ORDER = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head',
         'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
         'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']


def V(t):
    return Vector((t[0], t[1], -t[2]))  # ruf -> rub


def Q(*turns):
    q = Quaternion()
    for ax, d in turns:
        q = Quaternion(Vector(AX[ax]), math.radians(d)) @ q
    return q


def frame(a, n):
    a = a.normalized(); n = (n - a * n.dot(a)).normalized(); c = a.cross(n)
    return Matrix((a, n, c)).transposed()


def rig(ctx):
    R = {'ctx': ctx, 'head': {}, 'par': {}}
    for n in ORDER:
        b = ctx.bones[n]
        R['head'][n] = V(b['head'])
        R['par'][n] = b['parent']
    for n in ('LeftHand', 'RightHand'):
        R['head'][n + '_tip'] = V(ctx.bones[n]['head']) + V(ctx.bones[n]['points']) * ctx.bones[n]['length']
    return R


def bdir(R, n):
    h = R['head']
    nxt = {'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand', 'LeftHand': 'LeftHand_tip',
           'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand', 'RightHand': 'RightHand_tip',
           'Spine02': 'Spine01', 'Spine01': 'Spine', 'Spine': 'neck', 'neck': 'Head',
           'LeftShoulder': 'LeftArm', 'RightShoulder': 'RightArm',
           'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot', 'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot',
           'LeftFoot': 'LeftToeBase', 'RightFoot': 'RightToeBase'}
    return (h[nxt[n]] - h[n]).normalized()


def to_turns(q):
    e = q.normalized().to_euler('XYZ')
    return [('right', math.degrees(e.x)), ('up', math.degrees(e.y)), ('back', math.degrees(e.z))]


def leg_ik(R, side, T, A, pole_hint, foot_w, Wpar):
    h = R['head']
    T0, K0, A0 = h[side + 'UpLeg'], h[side + 'Leg'], h[side + 'Foot']
    L1, L2 = (K0 - T0).length, (A0 - K0).length
    d = A - T; dl = d.length
    dl2 = min(max(dl, abs(L1 - L2) * 1.02 + 1e-4), (L1 + L2) * 0.998)
    u = d.normalized()
    a = (L1 * L1 - L2 * L2 + dl2 * dl2) / (2 * dl2)
    hh = math.sqrt(max(L1 * L1 - a * a, 0))
    v = pole_hint - u * pole_hint.dot(u)
    v.normalize()
    K = T + u * a + v * hh
    A2 = T + u * dl2
    n0 = (K0 - T0).cross(A0 - K0)
    n1 = (K - T).cross(A2 - K)
    if n1.length < 1e-6:
        n1 = n0
    Wt = (frame(K - T, n1) @ frame(K0 - T0, n0).inverted()).to_quaternion()
    Ws = (frame(A2 - K, n1) @ frame(A0 - K0, n0).inverted()).to_quaternion()
    return Wt, Ws, foot_w


def pose(R, f, hips_move=(0, 0, 0), hips=None, b=None, legs='plant', feet=None, interp='BEZIER'):
    """b: bone -> Quaternion (local FK delta, 'as if parents still') or ('W', quat world delta) or ('A', dir_ruf, twist) world aim
         or ('a', dir_ruf, twist) local aim.  legs: 'plant' (IK to base feet + feet offsets) or 'fk'.
       feet: {'Left': (offset_ruf, foot_world_quat, toe_local_quat)}"""
    ctx = R['ctx']; h = R['head']; b = b or {}; feet = feet or {}
    W = {}
    mv = V(hips_move)
    pos = {'Hips': h['Hips'] + mv}
    loc = {}
    hq = hips if hips is not None else Quaternion()
    for n in ORDER:
        p = R['par'][n]
        Wp = W[p] if p else Quaternion()
        if n != 'Hips':
            pos[n] = pos[p] + Wp @ (h[n] - h[p])
        spec = hq if n == 'Hips' else b.get(n)
        if legs == 'plant' and n[-5:] == 'UpLeg':
            side = n[:-5]
            off, fw, tq = feet.get(side, ((0, 0, 0), Quaternion(), Quaternion()))
            A = h[side + 'Foot'] + V(off)
            K0 = h[side + 'Leg']; T0 = h[n]
            pole = (K0 - (T0 + (h[side + 'Foot'] - T0) * 0.5))
            pole = W['Hips'] @ pole
            Wt, Ws, Wf = leg_ik(R, side, pos[n], A, pole, fw, Wp)
            loc[n] = Wp.inverted() @ Wt; W[n] = Wt
            loc[side + 'Leg'] = Wt.inverted() @ Ws; W[side + 'Leg'] = Ws
            loc[side + 'Foot'] = Ws.inverted() @ Wf; W[side + 'Foot'] = Wf
            loc[side + 'ToeBase'] = tq; W[side + 'ToeBase'] = Wf @ tq
            continue
        if n in loc:
            continue
        if spec is None:
            q = Quaternion()
        elif isinstance(spec, Quaternion):
            q = spec
        elif spec[0] == 'W':
            q = Wp.inverted() @ spec[1]
        elif spec[0] in ('A', 'a', 'H'):
            tgt = V(spec[1]).normalized()
            if spec[0] == 'H':
                tgt = W['Hips'] @ tgt
            if spec[0] in ('A', 'H'):
                tgt = Wp.inverted() @ tgt
            base = bdir(R, n)
            q = base.rotation_difference(tgt)
            if len(spec) > 2 and spec[2]:
                q = Quaternion(tgt, math.radians(spec[2])) @ q
        loc[n] = q; W[n] = Wp @ q
    R['pos'] = pos; R['W'] = W
    for n in ORDER:
        q = loc[n]
        if n == 'Hips':
            ctx.key(f, n, turn=to_turns(q), move=tuple(hips_move), interp=interp)
        else:
            ctx.key(f, n, turn=to_turns(q), interp=interp)
    return W


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def lerp3(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def T(*turns):
    return Q(*turns)


def pz(R, f, hm=(0, 0, 0), hq=None, sp=None, head=None, neck=None, ra=None, rf=None, rh=None, la=None, lf=None, lh=None,
       feet=None, legs='plant', extra=None, interp='BEZIER', mode='A'):
    # quick pose: sp = 3 local quats (Spine02, Spine01, Spine); arm dirs are world aims (mode A) or hips-frame (mode H)
    b = {}
    if sp:
        b['Spine02'], b['Spine01'], b['Spine'] = sp
    if head is not None: b['Head'] = head
    if neck is not None: b['neck'] = neck
    for k, v in (('RightArm', ra), ('RightForeArm', rf), ('LeftArm', la), ('LeftForeArm', lf)):
        if v is not None:
            b[k] = (mode, v, 0)
    if rh is not None: b['RightHand'] = rh
    if lh is not None: b['LeftHand'] = lh
    if extra: b.update(extra)
    return pose(R, f, hips_move=hm, hips=hq, b=b, legs=legs, feet=feet, interp=interp)


def tip(R, side='Right'):
    # world (right, up, back) of the hand tip after the last pose() call, and hand height above floor in % of height
    h = R['head']; n = side + 'Hand'
    p = R['pos'][n] + R['W'][n] @ (h[n + '_tip'] - h[n])
    return p


def floor_y(R):
    return min(R['head']['LeftToeBase'].y, R['head']['RightToeBase'].y, R['head']['LeftFoot'].y)
# ---- end helper


def build(ctx):
    # bowling throw: ball at chest, look down the lane, big backswing, deep crouch, underhand release at the floor,
    # arm-high follow-through, little hop, fist pump. Feet stay planted (except the straight-up hop).
    R = rig(ctx); ctx.length(62); H = ctx.height
    hand = ctx.bone('right hand')
    S = lambda x, y, z: (x * H, y * H, z * H)
    I = Quaternion()

    def P(f, hm, hq, sp, head, **kw):
        pz(R, f, S(*hm), hq, sp, head, **kw)
        t = tip(R)
        ctx.note('f%d hand tip y=%.3f (%.1f%% H) fwd=%.3f' % (f, t.y, t.y / H * 100, -t.z))

    hold = dict(ra=(0.25, -0.6, 0.5), rf=(-0.55, 0.35, 0.75), rh=T(('forward', 10)),
                la=(-0.25, -0.6, 0.5), lf=(0.55, 0.35, 0.75), lh=T(('forward', -10)))
    # 7: ball to the chest
    P(7, (0, -0.01, 0), T(), [T(('right', 3)), T(('right', 2)), T()], T(('right', -4)), **hold)
    # 12-18: the dramatic look down the lane (lean in, chin down, eyes up the lane)
    P(12, (0, -0.02, 0.005), T(('right', -4)), [T(('right', -6)), T(('right', -5)), T(('right', -3))], T(('right', 4)),
      ra=(0.25, -0.5, 0.6), rf=(-0.55, 0.45, 0.7), rh=T(('forward', 10)), la=(-0.25, -0.5, 0.6), lf=(0.55, 0.45, 0.7), lh=T(('forward', -10)))
    P(18, (0, -0.025, 0.006), T(('right', -5)), [T(('right', -7)), T(('right', -6)), T(('right', -3))], T(('right', 8), ('up', 4)),
      ra=(0.25, -0.48, 0.62), rf=(-0.55, 0.47, 0.7), rh=T(('forward', 10)), la=(-0.25, -0.48, 0.62), lf=(0.55, 0.47, 0.7), lh=T(('forward', -10)))
    ctx.event(18, 'windup')
    # 24-27: big backswing, right arm high behind, chest twists right, left arm forward for balance
    back = dict(rh=T(('right', 15)), la=(-0.35, 0.1, 0.93), lf=(-0.2, 0.25, 0.95))
    P(24, (0, -0.045, -0.012), T(('up', -10), ('right', -6)), [T(('up', -9), ('right', -9)), T(('up', -8), ('right', -8)), T(('up', -4), ('right', -4))],
      T(('right', 14), ('up', 8)), ra=(0.25, 0.5, -0.83), rf=(0.2, 0.55, -0.8), **back)
    P(27, (0, -0.05, -0.014), T(('up', -11), ('right', -7)), [T(('up', -10), ('right', -10)), T(('up', -9), ('right', -9)), T(('up', -5), ('right', -4))],
      T(('right', 16), ('up', 9)), ra=(0.25, 0.6, -0.76), rf=(0.2, 0.66, -0.72), **back)
    # 30: arm sweeps down past the leg
    P(30, (0, -0.07, 0.01), T(('up', -4), ('right', -10)), [T(('up', -3), ('right', -12)), T(('up', -3), ('right', -10)), T(('right', -6))],
      T(('right', 18)), ra=(0.15, -0.9, -0.4), rf=(0.12, -0.92, -0.3), rh=T(('right', 5)),
      la=(-0.7, 0.2, 0.4), lf=(-0.6, 0.3, 0.3), interp='LINEAR')
    # 33: RELEASE, deepest crouch, hand at its lowest, low in front near the floor
    low = dict(la=(-0.85, 0.25, -0.3), lf=(-0.8, 0.35, -0.2))
    P(33, (0, -0.14, 0.04), T(('up', 4), ('right', -20)), [T(('up', 3), ('right', -20)), T(('up', 2), ('right', -18)), T(('right', -10))],
      T(('right', 34)), ra=(0.1, -0.88, 0.46), rf=(0.05, -0.8, 0.6), rh=T(('right', -10)), **low)
    ctx.event(33, 'projectile_release', bone=hand)
    P(35, (0, -0.135, 0.04), T(('up', 5), ('right', -18)), [T(('up', 4), ('right', -18)), T(('up', 3), ('right', -16)), T(('right', -9))],
      T(('right', 32)), ra=(0.1, -0.5, 0.86), rf=(0.05, -0.35, 0.94), rh=T(('right', -10)), **low)
    # 40: showy follow-through, arm up high, body rising
    P(40, (0, -0.02, 0.012), T(('up', 4), ('right', 2)), [T(('up', 3), ('right', 5)), T(('right', 4)), T(('right', 2))],
      T(('right', 8)), ra=(0.15, 0.92, 0.36), rf=(0.12, 0.96, 0.25), rh=T(('right', -5)), la=(-0.75, -0.35, -0.2), lf=(-0.6, -0.5, 0.1))
    # 44: little hop (straight up)
    hop = {'Left': (S(0, 0.03, 0), I, T(('right', -15))), 'Right': (S(0, 0.03, 0), I, T(('right', -15)))}
    P(44, (0, 0.035, 0.005), T(('right', 3)), [T(('right', 6)), T(('right', 5)), T(('right', 3))], T(('right', 10)),
      ra=(0.3, 0.94, 0.15), rf=(0.15, 0.95, 0.25), rh=T(('right', -5)), la=(-0.8, -0.1, 0.0), lf=(-0.7, 0.0, 0.3), feet=hop)
    # 47: land, soak it
    P(47, (0, -0.04, 0.005), T(('right', -4)), [T(('right', -5)), T(('right', -4)), T()], T(('right', -2)),
      ra=(0.35, 0.3, 0.5), rf=(0.1, 0.8, 0.5), la=(-0.6, -0.5, 0.2), lf=(-0.4, -0.5, 0.5))
    # 50-54: fist pump "YESSS"
    pump = dict(ra=(0.4, -0.55, 0.3), rf=(0.05, 0.75, 0.65), rh=T(('right', 10)), la=(-0.4, -0.75, 0.2), lf=(-0.2, -0.6, 0.5))
    P(50, (0, -0.03, 0.0), T(('up', -6), ('right', -3)), [T(('up', -6), ('right', -6)), T(('up', -4), ('right', -5)), T(('right', -2))], T(('right', -10)), **pump)
    P(54, (0, -0.025, 0.0), T(('up', -5), ('right', -2)), [T(('up', -5), ('right', -5)), T(('up', -3), ('right', -4)), T(('right', -2))], T(('right', -6)), **pump)

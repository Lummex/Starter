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
    # staff cast: right hand/staff rises and circles, lean back, left hand forward spread; hold; THRUST; recoil wobble.
    R = rig(ctx); ctx.length(54); H = ctx.height
    hand = ctx.bone('right hand')
    S = lambda x, y, z: (x * H, y * H, z * H)
    lp = dict(la=(-0.25, 0.22, 0.95), lf=(-0.12, 0.3, 0.95), lh=T(('right', 15)))

    def P(f, hm, hq, sp, head, **kw):
        pz(R, f, S(*hm), hq, sp, head, **kw)

    ctx.event(4, 'windup')
    # 6: little dip, staff hand comes out to the side
    P(6, (0, -0.02, 0), T(), [T(('right', -3)), T(('right', -2)), T()], T(('right', -5)),
      ra=(0.55, -0.6, 0.3), rf=(0.45, -0.3, 0.7), la=(-0.35, -0.75, 0.3), lf=(-0.2, -0.5, 0.7))
    # 10-20: the circle (out, up-front, high, up-back), leaning back, left hand forward
    circ = [(10, (0.75, 0.25, 0.5), (0.55, 0.55, 0.6)), (13, (0.45, 0.75, 0.45), (0.3, 0.9, 0.3)),
            (16, (0.15, 0.95, 0.2), (0.0, 0.98, -0.15)), (19, (0.5, 0.8, -0.2), (0.35, 0.9, -0.2))]
    for i, (f, a, fa) in enumerate(circ):
        k = (i + 1) / 4.0
        P(f, (0, -0.01 * k, -0.01 * k), T(('right', 3 * k)), [T(('right', 4 * k), ('up', -4 * k)), T(('right', 5 * k), ('up', -3 * k)), T(('right', 3 * k))],
          T(('right', 6 * k), ('forward', 4 - 8 * k)), ra=a, rf=fa, rh=T(('forward', 10)), **lp)
    # 23-28: dramatic hold, staff high behind, leaning back, a tiny tremble
    hold = dict(ra=(0.35, 0.85, -0.35), rf=(0.2, 0.95, -0.25), rh=T(('right', 15)))
    P(23, (0, -0.015, -0.015), T(('right', 5)), [T(('right', 7), ('up', -7)), T(('right', 7), ('up', -6)), T(('right', 4))],
      T(('right', 8)), **hold, la=(-0.25, 0.25, 0.94), lf=(-0.12, 0.33, 0.94), lh=T(('right', 18)))
    P(28, (0, -0.017, -0.017), T(('right', 6)), [T(('right', 8), ('up', -8)), T(('right', 8), ('up', -7)), T(('right', 5))],
      T(('right', 9)), **hold, la=(-0.25, 0.27, 0.93), lf=(-0.12, 0.35, 0.93), lh=T(('right', 20)))
    # 31: THRUST, staff/hand forward at the target (spell leaves it), left hand snaps back
    thr = dict(la=(-0.6, -0.2, 0.25), lf=(-0.45, -0.35, 0.4), lh=T(('right', 5)))
    P(31, (0, -0.03, 0.025), T(('right', -6), ('up', 4)), [T(('right', -8), ('up', 5)), T(('right', -7), ('up', 4)), T(('right', -4))],
      T(('right', -2)), ra=(0.2, 0.32, 0.93), rf=(0.12, 0.28, 0.95), rh=T(('right', -8)), interp='LINEAR', **thr)
    ctx.event(31, 'projectile_release', bone=hand)
    P(33, (0, -0.035, 0.03), T(('right', -8), ('up', 5)), [T(('right', -10), ('up', 6)), T(('right', -8), ('up', 5)), T(('right', -5))],
      T(('right', -3)), ra=(0.2, 0.25, 0.95), rf=(0.12, 0.22, 0.97), rh=T(('right', -10)), **thr)
    # 37: recoil: kicked back, staff bounces up
    P(37, (0, -0.02, -0.012), T(('right', 4)), [T(('right', 6), ('forward', 3)), T(('right', 5)), T(('right', 3))],
      T(('right', 6), ('forward', -4)), ra=(0.25, 0.62, 0.74), rf=(0.15, 0.7, 0.7), rh=T(('right', 10)),
      la=(-0.6, -0.55, -0.2), lf=(-0.45, -0.6, 0.0))
    # 41/45: wobble, settling
    P(41, (0, -0.025, 0.008), T(('right', -2)), [T(('right', -3), ('forward', -3)), T(('right', -2)), T()],
      T(('right', -3), ('forward', 4)), ra=(0.3, 0.2, 0.85), rf=(0.2, 0.3, 0.9), rh=T(('right', -5)),
      la=(-0.5, -0.7, 0.0), lf=(-0.35, -0.7, 0.3))
    P(45, (0, -0.012, 0.0), T(('right', 1)), [T(('right', 1), ('forward', 2)), T(), T()],
      T(('right', 2), ('forward', -2)), ra=(0.35, -0.3, 0.6), rf=(0.3, -0.1, 0.9),
      la=(-0.4, -0.85, 0.1), lf=(-0.25, -0.75, 0.4))

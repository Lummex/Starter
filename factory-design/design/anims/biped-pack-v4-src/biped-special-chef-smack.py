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
# ---- end helper
def build(ctx):
    # Goblin Chef: cocky butt-wiggle with the spatula up, huge baseball wind-up, WHACK, spin-round follow-through, smug shoulder rest
    R = rig(ctx); ctx.length(58)
    hip_hand = dict(la=(-0.75, -0.55, -0.2), lf=(0.55, -0.55, 0.35))
    show = dict(ra=(0.5, -0.25, 0.55), rf=(0.05, 0.97, 0.15), rh=T(('forward', -10)))
    # waggle: spatula held up by the face, butt wiggles left-right, cocky head tilt
    for f, s in ((4, 1), (7, -1), (10, 1), (13, -1)):
        pz(R, f, (0.007 * s, -0.02, -0.005), T(('forward', 6 * s), ('up', 6 * s)),
           [T(('forward', -6 * s)), T(('forward', -5 * s)), T(('forward', -2 * s))], T(('forward', 10 * s), ('right', 6)),
           **dict(show, **hip_hand))
    ctx.event(15, 'windup')
    # wind-up: twist hard right, spatula cocked high behind the right shoulder, eyes on the target
    wind = dict(ra=(0.6, 0.6, -0.5), rf=(-0.1, 0.8, -0.6), rh=T(('right', 20)), la=(0.35, 0.05, 0.9), lf=(0.75, 0.25, 0.5))
    pz(R, 16, (0.0, -0.03, -0.01), T(('up', -5), ('right', 2)),
       [T(('up', -11), ('right', 2)), T(('up', -10), ('right', 2)), T(('up', -6))], T(('up', 18), ('right', 2)),
       ra=(0.65, 0.3, 0.1), rf=(0.0, 0.95, -0.25), rh=T(('right', 10)), la=(-0.2, -0.3, 0.9), lf=(0.4, 0.0, 0.9))
    pz(R, 19, (0.0, -0.04, -0.015), T(('up', -10), ('right', 4)),
       [T(('up', -21), ('right', 4)), T(('up', -21), ('right', 4)), T(('up', -12))], T(('up', 34), ('right', -4)), **wind)
    pz(R, 23, (0.0, -0.045, -0.018), T(('up', -11), ('right', 5)),
       [T(('up', -23), ('right', 5)), T(('up', -22), ('right', 5)), T(('up', -13))], T(('up', 36), ('right', -6)), **wind)
    # swing through (fast, linear)
    pz(R, 26, (0.0, -0.05, 0.0), T(('up', -12)), [T(('up', -6)), T(('up', -5)), T()], T(('up', 12)),
       ra=(0.95, 0.15, 0.25), rf=(0.75, 0.1, 0.65), rh=T(('right', 5)), la=(-0.5, -0.4, 0.6), lf=(-0.2, -0.3, 0.9), interp='LINEAR')
    # WHACK: arm straight out front, body leaning in
    hit = dict(ra=(0.25, 0.05, 1.0), rf=(0.05, 0.0, 1.0), rh=T(), la=(-0.8, -0.1, -0.3), lf=(-0.8, 0.2, -0.3))
    pz(R, 28, (0.0, -0.05, 0.01), T(('up', 8), ('right', -6)),
       [T(('up', 8), ('right', -6)), T(('up', 8), ('right', -4)), T(('up', 4))], T(('right', -6)), interp='LINEAR', **hit)
    ctx.event(28, 'hit')
    pz(R, 30, (0.0, -0.05, 0.011), T(('up', 10), ('right', -6)),
       [T(('up', 13), ('right', -6)), T(('up', 12), ('right', -4)), T(('up', 6))], T(('right', -8)), interp='LINEAR', **hit)
    # follow-through: spins round to his left, spatula wrapped behind the left shoulder
    ft = dict(ra=(-0.55, 0.45, 0.6), rf=(-0.75, 0.55, -0.3), rh=T(('right', 10)), la=(0.3, -0.3, -0.9), lf=(0.2, -0.2, -0.95))
    pz(R, 35, (-0.005, -0.035, 0.0), T(('up', 24), ('right', 2)),
       [T(('up', 28)), T(('up', 26)), T(('up', 14))], T(('up', 15), ('right', 6)), **ft)
    pz(R, 38, (-0.006, -0.034, 0.0), T(('up', 26), ('right', 3)),
       [T(('up', 30)), T(('up', 28)), T(('up', 16))], T(('up', 18), ('right', 8)), **ft)
    # smug: spatula resting on the shoulder, hand on hip, chin up, glance back at the target
    smug = dict(ra=(0.75, -0.35, 0.4), rf=(-0.35, 0.82, -0.35), rh=T(('right', 25)), **hip_hand)
    pz(R, 40, (-0.003, -0.015, -0.005), T(('up', 20), ('right', 3)),
       [T(('up', 11), ('right', 3)), T(('up', 14), ('right', 3)), T(('up', 6))], T(('up', 0), ('right', 12)),
       ra=(0.2, 0.3, 0.9), rf=(-0.3, 0.9, 0.3), rh=T(('right', 15)), la=(-0.6, -0.6, -0.4), lf=(0.3, -0.6, 0.4))
    pz(R, 43, (0.0, 0.01, -0.01), T(('up', 12), ('right', 4)),
       [T(('up', 9), ('right', 6)), T(('up', 6), ('right', 5)), T(('right', 2))], T(('up', -22), ('right', 18), ('forward', -8)), **smug)
    pz(R, 47, (0.0, 0.012, -0.01), T(('up', 12), ('right', 4)),
       [T(('up', 9), ('right', 7)), T(('up', 6), ('right', 6)), T(('right', 3))], T(('up', -24), ('right', 22), ('forward', -10)), **smug)
    pz(R, 50, (0.0, 0.008, -0.01), T(('up', 11), ('right', 3)),
       [T(('up', 5), ('right', 6)), T(('up', 4), ('right', 5)), T(('right', 2))], T(('up', -20), ('right', 14), ('forward', -6)), **smug)

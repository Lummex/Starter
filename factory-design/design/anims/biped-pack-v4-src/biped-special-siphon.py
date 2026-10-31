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
    # Soul Stone Siphoner: magic vacuum. Reach out palms forward, tug the 'rope of light' back 3x, GULP (chest puffs), pat belly
    R = rig(ctx); L = 72; ctx.length(L)
    ctx.event(2, 'windup')
    REACH = dict(ra=(0.25, 0.2, 1.0), rf=(0.15, 0.25, 1.0), rh=T(('right', 20)),
                 la=(-0.25, 0.2, 1.0), lf=(-0.15, 0.25, 1.0), lh=T(('right', 20)))
    PULL = dict(ra=(0.45, -0.55, 0.45), rf=(-0.2, 0.3, 0.95), rh=T(('right', 8)),
                la=(-0.45, -0.55, 0.45), lf=(0.2, 0.3, 0.95), lh=T(('right', 8)))
    # 1. reach out, lean in
    pz(R, 9, (0, -0.02, 0.015), T(('right', -4)), [T(('right', -10)), T(('right', -8)), T(('right', -2))], T(('right', -4)), **REACH)
    pz(R, 12, (0, -0.022, 0.017), T(('right', -5)), [T(('right', -11)), T(('right', -9)), T(('right', -2))], T(('right', -4)), **REACH)
    # 2. three tugs, each bigger
    for i, (fp, fr) in enumerate(((17, 22), (28, 33), (39, 0))):
        g = 1.0 + 0.35 * i
        pz(R, fp, (0, -0.03, -0.02 * g), T(('right', 5 * g)), [T(('right', 7 * g)), T(('right', 6 * g)), T(('right', 3 * g))],
           T(('right', -6)), interp='LINEAR', **PULL)
        pz(R, fp + 2, (0, -0.03, -0.022 * g), T(('right', 5.5 * g)), [T(('right', 8 * g)), T(('right', 6.5 * g)), T(('right', 3 * g))],
           T(('right', -8)), **PULL)
        if fr:
            pz(R, fr, (0, -0.025, 0.01), T(('right', -2)), [T(('right', -6)), T(('right', -5)), T()], T(('right', -2)), **REACH)
    # 3. final yank: hands slam to chest, GULP
    pz(R, 45, (0, -0.025, 0.0), T(('right', -2)), [T(('right', -6)), T(('right', -5)), T()], T(('right', -4)), **REACH)
    pz(R, 49, (0, -0.02, -0.03), T(('right', 6)), [T(('right', 12)), T(('right', 10)), T(('right', 6))], T(('right', -10)),
       ra=(0.4, -0.7, 0.4), rf=(-0.75, 0.3, 0.6), la=(-0.4, -0.7, 0.4), lf=(0.75, 0.3, 0.6), interp='LINEAR')
    ctx.event(49, 'siphon')
    # chest puffs, shoulders bounce
    for j, f in enumerate((52, 55, 58)):
        up = 12 if j % 2 == 0 else 2
        pz(R, f, (0, 0.012 if j % 2 == 0 else -0.005, -0.015), T(('right', 5)),
           [T(('right', 10)), T(('right', 9)), T(('right', 8))], T(('right', 14)),
           ra=(0.5, -0.75, 0.3), rf=(-0.6, 0.25, 0.75), la=(-0.5, -0.75, 0.3), lf=(0.6, 0.25, 0.75),
           extra={'LeftShoulder': T(('back', -up)), 'RightShoulder': T(('back', up))})
    # 4. pleased belly pat (right hand pats, left on hip), smug head tilt
    for k, f in enumerate((61, 64, 67)):
        d = 0.15 if k % 2 == 0 else -0.1
        pz(R, f, (0, -0.005, -0.005), T(('right', 2)), [T(('right', 4)), T(('right', 3)), T(('right', 2))],
           T(('right', 6), ('forward', 12)),
           ra=(0.35, -0.8, 0.45), rf=(-0.75, d, 0.65), la=(-0.65, -0.65, -0.1), lf=(0.6, -0.4, 0.2))

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
    # Rocket Rider: crouch, strike a match, light the fuse, gleeful hop into a straddling WHEEE ride pose (ends there)
    R = rig(ctx); L = 44; ctx.length(L)
    ctx.event(2, 'windup')
    la_ = dict(la=(-0.45, -0.6, 0.6), lf=(-0.2, -0.5, 0.85))
    # crouch, right hand down to strike the match
    pz(R, 6, (0, -0.06, 0.01), T(('right', -12)), [T(('right', -10)), T(('right', -6)), T()], T(('right', 6)),
       ra=(0.35, -0.75, 0.55), rf=(0.2, -0.85, 0.5), **la_)
    pz(R, 9, (0, -0.065, 0.012), T(('right', -14), ('up', -6)), [T(('right', -11), ('up', -4)), T(('right', -6)), T()], T(('right', 4)),
       ra=(0.2, -0.8, 0.6), rf=(-0.1, -0.85, 0.5), **la_)
    # SKRITCH: quick swipe out to the right
    pz(R, 11, (0, -0.06, 0.01), T(('right', -12), ('up', 6)), [T(('right', -10), ('up', 4)), T(('right', -6)), T()], T(('right', 6)),
       ra=(0.75, -0.55, 0.35), rf=(0.85, -0.3, 0.4), interp='LINEAR', **la_)
    # admire the lit match
    pz(R, 15, (0, -0.05, 0.0), T(('right', -6)), [T(('right', -6)), T(('right', -3)), T()], T(('right', 14), ('forward', 8)),
       ra=(0.4, -0.35, 0.8), rf=(-0.1, 0.7, 0.7), rh=T(('right', 15)), **la_)
    # reach down to the fuse in front
    fuse = dict(ra=(0.15, -0.6, 0.8), rf=(0.0, -0.75, 0.65), rh=T(('right', -10)), la=(-0.5, -0.55, 0.5), lf=(-0.3, -0.5, 0.8))
    pz(R, 19, (0, -0.075, 0.02), T(('right', -20)), [T(('right', -14)), T(('right', -10)), T(('right', -4))], T(('right', 10)), **fuse)
    pz(R, 22, (0, -0.078, 0.022), T(('right', -21)), [T(('right', -15)), T(('right', -10)), T(('right', -4))], T(('right', 12)), **fuse)
    # fizz! flinch back with a big grin, then load the hop
    pz(R, 25, (0, -0.05, -0.01), T(('right', 6)), [T(('right', 6)), T(('right', 4)), T()], T(('right', 12)),
       ra=(0.6, 0.0, 0.5), rf=(0.4, 0.6, 0.5), la=(-0.6, 0.0, 0.5), lf=(-0.4, 0.6, 0.5))
    pz(R, 28, (0, -0.09, 0.015), T(('right', -16)), [T(('right', -10)), T(('right', -6)), T()], T(('right', 8)),
       ra=(0.4, -0.6, -0.6), rf=(0.3, -0.7, -0.5), la=(-0.4, -0.6, -0.6), lf=(-0.3, -0.7, -0.5), interp='LINEAR')
    ctx.event(30, 'launch')
    # hop up, legs swing into the straddle
    straddle = {'LeftUpLeg': ('A', (-0.38, -0.12, 0.92), 0), 'LeftLeg': ('A', (-0.12, -0.92, -0.35), 0),
                'RightUpLeg': ('A', (0.38, -0.12, 0.92), 0), 'RightLeg': ('A', (0.12, -0.92, -0.35), 0)}
    tuck = {'LeftUpLeg': ('A', (-0.3, -0.2, 0.9), 0), 'LeftLeg': ('A', (-0.1, -0.85, -0.5), 0),
            'RightUpLeg': ('A', (0.3, -0.2, 0.9), 0), 'RightLeg': ('A', (0.1, -0.85, -0.5), 0)}
    wheee = dict(ra=(0.55, 0.82, 0.15), rf=(0.45, 0.88, 0.15), la=(-0.55, 0.82, 0.15), lf=(-0.45, 0.88, 0.15))
    pz(R, 30, (0, -0.02, 0.005), T(('right', -2)), [T(('right', 2)), T(('right', 1)), T()], T(('right', 10)),
       ra=(0.5, 0.4, 0.5), rf=(0.4, 0.7, 0.4), la=(-0.5, 0.4, 0.5), lf=(-0.4, 0.7, 0.4), interp='LINEAR')
    Fq = Quaternion()
    pz(R, 31, (0, 0.03, 0.003), T(('right', 0)), [T(('right', 3)), T(('right', 1)), T()], T(('right', 12)),
       feet={'Left': ((0, 0.03, 0), Fq, Fq), 'Right': ((0, 0.03, 0), Fq, Fq)},
       ra=(0.5, 0.55, 0.4), rf=(0.4, 0.78, 0.35), la=(-0.5, 0.55, 0.4), lf=(-0.4, 0.78, 0.35), interp='LINEAR')
    hang = {'LeftUpLeg': ('A', (-0.1, -0.97, 0.15), 0), 'LeftLeg': ('A', (-0.05, -0.97, -0.2), 0),
            'RightUpLeg': ('A', (0.1, -0.97, 0.15), 0), 'RightLeg': ('A', (0.05, -0.97, -0.2), 0),
            'LeftFoot': ('A', (0, -0.8, 0.6), 0), 'RightFoot': ('A', (0, -0.8, 0.6), 0)}
    pz(R, 32, (0, 0.095, 0), T(('right', 2)), [T(('right', 4)), T(('right', 2)), T()], T(('right', 14)),
       legs='fk', extra=hang, ra=(0.5, 0.7, 0.3), rf=(0.4, 0.85, 0.25), la=(-0.5, 0.7, 0.3), lf=(-0.4, 0.85, 0.25), interp='LINEAR')
    pz(R, 34, (0, 0.11, 0), T(('right', -4)), [T(('right', 6)), T(('right', 6)), T(('right', 2))], T(('right', 18)),
       legs='fk', extra=tuck, **wheee)
    pz(R, 37, (0, 0.06, 0), T(('right', -8)), [T(('right', 8)), T(('right', 6)), T(('right', 2))], T(('right', 22)),
       legs='fk', extra=straddle, **wheee)
    pz(R, 40, (0, 0.045, 0), T(('right', -6)), [T(('right', 6)), T(('right', 5)), T(('right', 2))], T(('right', 18)),
       legs='fk', extra=straddle, **wheee)
    pz(R, L, (0, 0.05, 0), T(('right', -6)), [T(('right', 6)), T(('right', 5)), T(('right', 2))], T(('right', 18)),
       legs='fk', extra=straddle, **wheee)

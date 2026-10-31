"""Unit voices (Brush, studio/voice-spec.json) -> public/audio/voice/ (the .ogg files that exist + manifest.json).

Run from projects/oreheart-8:  py -I tools/voice-manifest.py C:/Users/kentu/Documents/Oreheart
Re-run whenever Brush delivers new lines. The manifest lists every line in the spec; a line whose file is not there yet
plays the old grunt (the game logs it as 'fallback'). Names in the manifest are file names without .ogg.
"""
import json, os, shutil, sys

root = sys.argv[1] if len(sys.argv) > 1 else 'C:/Users/kentu/Documents/Oreheart'
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'public', 'audio', 'voice')
spec = json.load(open(os.path.join(root, 'studio', 'voice-spec.json'), encoding='utf-8'))
os.makedirs(out, exist_ok=True)
name = lambda p: os.path.splitext(os.path.basename(p))[0]
have, want = 0, set()

def take(p):
    global have
    n = name(p)
    want.add(n)
    src = os.path.join(root, p)
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(out, n + '.ogg')); have += 1
    return n

units = {}
for uid, u in spec['units'].items():
    e = {'voice': u['voice'], 'select': [take(p) for p in u.get('select') or []]}
    if u.get('special'): e['special'] = take(u['special'])
    if u.get('special_when'): e['special_when'] = u['special_when']
    units[uid] = e
voices = {}
for vid, v in spec['voices'].items():
    e = {'faction': v.get('faction'), 'hurt': [take(p) for p in v.get('hurt') or []]}
    for k in ('common', 'attack'):  # version 1 had a common select line and an attack shout per voice
        if v.get(k): e[k] = [take(p) for p in (v[k] if isinstance(v[k], list) else [v[k]])]
    voices[vid] = e
for f in os.listdir(out):  # drop files of lines no longer in the spec
    if f.endswith('.ogg') and f[:-4] not in want: os.remove(os.path.join(out, f))
present = sorted(f[:-4] for f in os.listdir(out) if f.endswith('.ogg'))
man = {'version': spec.get('version'), 'made_by': spec.get('made_by'), 'units': units, 'voices': voices, 'present': present}
old = os.path.join(out, 'manifest.json')  # keep the loudness gains (tools/voice-loudness.mjs) of lines that are still there; new lines need measuring
if os.path.exists(old):
    try:
        prev = json.load(open(old, encoding='utf-8'))
        if prev.get('gain'):
            man['gain'] = {**prev['gain'], 'lines': {k: g for k, g in prev['gain']['lines'].items() if k in want}}
            man['defective'] = [n for n in prev.get('defective', []) if n in want]
            man['present'] = [n for n in present if n not in man['defective']]
    except Exception: pass
json.dump(man, open(os.path.join(out, 'manifest.json'), 'w', encoding='utf-8', newline='\n'), indent=0, separators=(',', ':'))
lic = os.path.join(root, 'art', 'sound', 'LICENSES.md')
if os.path.exists(lic): shutil.copyfile(lic, os.path.join(out, 'LICENSES.md'))
print('lines', len(want), 'files present', have, '->', os.path.normpath(out))

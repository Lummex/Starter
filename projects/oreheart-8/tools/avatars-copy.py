"""Player avatars (Brush, art/avatars): copies every painted avatar into public/art/avatars/<id>.webp at 160 px (the plates show them at about 40 px)
and writes src/content/avatars.json: Brush's full planned list (id, race, label) with "shipped" true for the ones painted so far.
Run from projects/oreheart-8:  py -E -P tools/avatars-copy.py C:/Users/kentu/Documents/Oreheart
Re-run whenever Brush adds avatars: rivals keep their planned avatar and switch from a stand-in to their own picture automatically."""
import json, os, sys
from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else 'C:/Users/kentu/Documents/Oreheart'
src = os.path.join(root, 'art', 'avatars')
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'public', 'art', 'avatars')
os.makedirs(out, exist_ok=True)
plan = json.load(open(os.path.join(src, 'avatars.json'), encoding='utf-8'))
lst = []
for a in plan:
    f = os.path.join(src, a['file'])
    shipped = os.path.exists(f)
    if shipped:
        im = Image.open(f).convert('RGBA')
        im.thumbnail((160, 160), Image.LANCZOS)
        im.save(os.path.join(out, a['id'] + '.webp'), 'WEBP', quality=86, method=4)
    e = {'id': a['id'], 'race': a['race'], 'gender': a.get('gender', ''), 'label': a.get('label', a['id']), 'shipped': shipped}
    if a.get('mature'): e['mature'] = True; e['safe_fallback'] = a.get('safe_fallback', '')  # Ken, Nov 1: shown only to 16+ account owners; everyone else sees the stand-in (no wording about it anywhere)
    lst.append(e)
json.dump({'note': 'Brush\'s avatars (art/avatars/avatars.json); tools/avatars-copy.py', 'default': 'goblin-goggle-rogue', 'avatars': lst},
          open(os.path.join(here, '..', 'src', 'content', 'avatars.json'), 'w', encoding='utf-8', newline='\n'), indent=1)
print('avatars', len(lst), 'shipped', sum(a['shipped'] for a in lst))

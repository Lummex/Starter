"""Player avatars (Brush, art/avatars): copies every painted avatar into public/art/avatars/<id>.webp at up to 512 px
(the Online avatar picker and Profile show them big; the plates show them at about 40 px) and writes src/content/avatars.json:
Brush's full planned list (id, race, gender, label, plus "mature" / "safe_fallback" when Brush marks an avatar mature)
with "shipped" true for the ones painted so far. The same file feeds the plates (src/ui/avatars.ts) and the Online picker
(src/net/avatars.ts, src/net/mature.ts).
Run from projects/oreheart-8:  py -E -P tools/avatars-copy.py C:/Users/kentu/Documents/Oreheart
Re-run whenever Brush adds avatars: rivals keep their planned avatar and switch from a stand-in to their own picture automatically.
A brand-new id also needs the server's allowed list (settings avatar_cards, a Supabase migration) before players can pick it."""
import json, os, shutil, sys
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
        dst = os.path.join(out, a['id'] + '.webp')
        im = Image.open(f)
        if f.lower().endswith('.webp') and max(im.size) <= 512:
            im.close(); shutil.copyfile(f, dst)  # already game-ready: copy the bytes as they are
        else:
            im = im.convert('RGBA'); im.thumbnail((512, 512), Image.LANCZOS)
            im.save(dst, 'WEBP', quality=86, method=4)
    e = {'id': a['id'], 'race': a['race'], 'gender': a.get('gender', ''), 'label': a.get('label', a['id']), 'shipped': shipped}
    for k in ('mature', 'safe_fallback'):
        if k in a: e[k] = a[k]
    lst.append(e)
json.dump({'note': 'Brush\'s avatars (art/avatars/avatars.json); tools/avatars-copy.py', 'default': 'goblin-goggle-rogue', 'avatars': lst},
          open(os.path.join(here, '..', 'src', 'content', 'avatars.json'), 'w', encoding='utf-8', newline='\n'), indent=1)
print('avatars', len(lst), 'shipped', sum(a['shipped'] for a in lst))

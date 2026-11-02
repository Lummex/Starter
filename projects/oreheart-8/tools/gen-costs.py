"""Ken, Nov 1: writes every creature's cost and feet into cards.json from the formula in src/engine/cost.ts (same rules, same settings in
game-config.json), so the editors, the card texts and the GDD see the numbers the game uses. Only the "Cost N, Attack N, Health N, Movement N"
fragment of a card's longText is touched; hand-written texts stay. A card's costOverride (a number) wins over the formula; feet still follow
the formula cost. Run from projects/oreheart-8:  py -I tools/gen-costs.py [--dry]
"""
import io, json, math, re, sys
DRY = '--dry' in sys.argv
P = 'src/content/cards.json'
raw = io.open(P, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in raw else '\n'
cards = json.loads(raw)
cfg = json.load(io.open('src/content/game-config.json', encoding='utf-8'))
CF, FEET, WALL = cfg['costFormula'], cfg['feetByCost'], cfg['wallMove']

def miner(c): return c.get('role') in ('Gatherer', 'Smith')
def bonus(c):
    b = 0
    for a in c.get('abilities') or []:
        if a in CF['minerAbilities']: continue
        b = max(b, CF['bigBonus'] if a in CF['bigAbilities'] else CF['smallBonus'])
    return b
def formula(c):
    B = (c.get('attack') or 0) + (c.get('health') or 0) + bonus(c)
    r = math.ceil(B / 2) if B <= CF['halfUpTo'] else CF['overBase'] + CF['overPer'] * (B - CF['halfUpTo'])
    return max(CF['min'], min(CF['cap'], r))
def cost(c): return c['costOverride'] if c.get('costOverride') is not None else formula(c)
def feet(c):
    if miner(c): return FEET['miner']
    if c.get('wall'): return WALL
    f = formula(c)
    return FEET['upTo3'] if f <= 3 else FEET['upTo6'] if f <= 6 else FEET['else']

rows, changes, dist, total = [], [], {'1-3': 0, '4-6': 0, '7-12': 0}, 0
for c in cards:
    if c.get('type') != 'creature': continue
    if 'costOverride' not in c: c['costOverride'] = None
    nc, nf = cost(c), feet(c)
    if (c.get('cost'), c.get('move')) != (nc, nf): changes.append(f"{c['id']}: cost {c.get('cost')}->{nc}, move {c.get('move')}->{nf}")
    c['cost'], c['move'] = nc, nf
    for k in ('longText', 'text', 'shortText'):
        if c.get(k): c[k] = re.sub(r'Cost \d+, Attack \d+, Health \d+, Movement \d+', f"Cost {nc}, Attack {c['attack']}, Health {c['health']}, Movement {nf}", c[k])
    rows.append((c['faction'][:2], c['id'], c['name'], c['attack'], c['health'], bonus(c), nc, nf, 'ovr' if c.get('costOverride') is not None else '', 'wall' if c.get('wall') else ''))
    dist['1-3' if nc <= 3 else '4-6' if nc <= 6 else '7-12'] += 1; total += nc

print('fac id name atk hp bonus cost feet')
for r in rows: print(' '.join(str(x) for x in r))
print('DIST', dist, 'TOTAL', total, 'CHANGES', len(changes))
for ch in changes: print(' ', ch)
if not DRY:
    out = json.dumps(cards, indent=1, ensure_ascii=False)
    io.open(P, 'w', encoding='utf-8', newline='').write(out.replace('\n', nl) + nl)
    print('written', P)

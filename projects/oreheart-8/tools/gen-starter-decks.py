# Starter decks (Ken, Oct 31): four 60-card decks per faction, Miners at least a third of every deck.
# Run from projects/oreheart-8:  py -I tools/gen-starter-decks.py   -> writes src/content/starter-decks.json
# Ken's shapes (his words, a voice message):
#   A "Mine Rush":    75% Miners, 25% fighters                      -> 45 Miners, 15 fighters
#   B "Arcane Hoard": 50% Miners, 25% spells, 25% fighters          -> 30 Miners, 15 spells, 15 fighters
#   C "Expedition":   40% Miners, 15% spells, 10% Crystal, 35% fighters -> 24 Miners, 9 spells, 6 Crystal cards, 21 fighters
#   D "Warband":      "really well thought out and balanced and overpowered", at least 20 Miners (the default deck)
#   Ken, Oct 31 (later): "there's still not enough miners in the deck": the Warband now carries 30 Miners (half the deck), never under 28
# Only enabled cards, the copy limits (Rare / Ultra Rare / Collector max 3), at most 20 Crystal cards, faction spells only.
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
CARDS = {c['id']: c for c in json.load(open('src/content/cards.json', encoding='utf-8'))}
CFG = json.load(open('src/content/game-config.json', encoding='utf-8'))
BASIC = CFG['basicGatherers']
FNAME = {'goblins': 'Goblin', 'gnomes': 'Gnome', 'dwarves': 'Dwarf'}
FKEY = {'goblins': 'goblin', 'gnomes': 'gnome', 'dwarves': 'dwarf'}
STYLE_NAME = {'warband': 'Warband', 'mine-rush': 'Mine Rush', 'arcane-hoard': 'Arcane Hoard', 'expedition': 'Expedition'}
SHAPE = {'mine-rush': (45, 15, 0, 0), 'arcane-hoard': (30, 15, 15, 0), 'expedition': (24, 21, 9, 6), 'warband': (30, 20, 6, 4)}  # miners, fighters, spells, crystals

def is_miner(c):
    return c['type'] == 'creature' and (c['role'] in ('Gatherer', 'Smith') or c['id'] in BASIC.values())

# id: copies.  Order inside a deck does not matter (the match shuffles).
D = {
 'goblins': {
  'mine-rush':    {'goblin-scrounger': 33, 'goblin-smith-miner': 12,
                   'goblin-grunt': 5, 'goblin-sneak': 3, 'skullbasher-rusher': 3, 'goblin-slinger': 2, 'wolf-rider': 2},
  'arcane-hoard': {'goblin-scrounger': 22, 'goblin-smith-miner': 8,
                   'goblin-grunt': 4, 'goblin-sneak': 3, 'goblin-bomber': 2, 'goblin-slinger': 3, 'skullbasher-rusher': 3,
                   'venom-shiv': 5, 'tunnel-rush': 3, 'hold-it': 2, 'prospectors-prayer': 1, 'healing-light': 2, 'fizzle': 2},
  'expedition':   {'goblin-scrounger': 17, 'goblin-smith-miner': 7,
                   'goblin-grunt': 5, 'blastrat-sapper': 2, 'goblin-bomber': 2, 'goblin-sneak': 3, 'goblin-slinger': 3, 'skullbasher-rusher': 3, 'goblin-scrapper': 2, 'grubnaks-big-boss-troll': 1,
                   'venom-shiv': 3, 'tunnel-rush': 2, 'hold-it': 2, 'fizzle': 1, 'healing-light': 1,
                   'soul-shard': 2, 'crystal-cluster': 2, 'glowing-geode': 1, 'heart-of-the-fallen': 1},
  'warband':      {'goblin-scrounger': 22, 'goblin-smith-miner': 8,
                   'goblin-grunt': 5, 'goblin-sneak': 2, 'goblin-bomber': 2, 'goblin-slinger': 3, 'skullbasher-rusher': 3, 'shiv-rat': 1, 'goblin-scrapper': 1, 'grubnaks-big-boss-troll': 2, 'wolf-rider': 1,
                   'venom-shiv': 2, 'hold-it': 2, 'fizzle': 1, 'tunnel-rush': 1,
                   'crystal-cluster': 2, 'glowing-geode': 1, 'heart-of-the-fallen': 1},
 },
 'gnomes': {
  'mine-rush':    {'gnome-prospector': 33, 'gnome-smith-miner': 12,
                   'gearward-sentinel': 6, 'gnome-widget': 5, 'hexwright-apprentice': 4},
  'arcane-hoard': {'gnome-prospector': 22, 'gnome-smith-miner': 8,
                   'gearward-sentinel': 5, 'gnome-widget': 4, 'hexwright-apprentice': 3, 'spark-gnome': 3,
                   'fireball': 3, 'spell-snap': 2, 'meteor-strike': 2, 'healing-light': 3, 'fizzle': 3, 'prospectors-prayer': 2},
  'expedition':   {'gnome-prospector': 15, 'gnome-smith-miner': 6, 'overclocked-conduit': 3,
                   'gearward-sentinel': 6, 'gnome-widget': 5, 'hexwright-apprentice': 4, 'spark-gnome': 3, 'clockwork-beetle': 2, 'gnome-cogger': 1,
                   'fireball': 3, 'spell-snap': 2, 'meteor-strike': 1, 'fizzle': 2, 'healing-light': 1,
                   'soul-shard': 2, 'crystal-cluster': 2, 'glowing-geode': 1, 'heart-of-the-fallen': 1},
  'warband':      {'gnome-prospector': 24, 'gnome-smith-miner': 6,  # cheap Miners only: the 5-cost Aethervein slowed the gnome opening (sims, Oct 31)
                   'gearward-sentinel': 5, 'gnome-widget': 4, 'hexwright-apprentice': 3, 'spark-gnome': 2, 'clockwork-beetle': 1, 'gnome-cogger': 2,  # spell-heavier than the other Warbands: Knobbin's discount is the gnomes' edge (sims, Oct 31: 49/51 vs goblins)
                   'fireball': 3, 'meteor-strike': 2, 'spell-snap': 2, 'fizzle': 1, 'healing-light': 1,
                   'crystal-cluster': 2, 'glowing-geode': 1, 'heart-of-the-fallen': 1},
 },
 'dwarves': {
  # Ken (Oct 31): the Anvilsworn Miner (pickaxe) is the dwarves' basic Miner; the Riot Shield Bearer is a wall among the fighters, never the Miner core
  'mine-rush':    {'dwarf-smith-miner': 42, 'crystal-drunk-delver': 3,
                   'dwarf-miner': 3, 'dwarf-stoneback': 4, 'deepforge-crossbowman': 4, 'barrelback-courier': 2, 'shieldbeard': 2},
  'arcane-hoard': {'dwarf-smith-miner': 27, 'crystal-drunk-delver': 3,
                   'dwarf-miner': 3, 'dwarf-stoneback': 4, 'deepforge-crossbowman': 3, 'barrelback-courier': 2, 'oathbound-pikeman': 2, 'shieldbeard': 1,
                   'shield-bubble': 5, 'battle-cry': 3, 'second-wind': 2, 'healing-light': 2, 'fizzle': 2, 'prospectors-prayer': 1},
  'expedition':   {'dwarf-smith-miner': 21, 'crystal-drunk-delver': 3,
                   'dwarf-miner': 4, 'dwarf-stoneback': 4, 'deepforge-crossbowman': 4, 'barrelback-courier': 3, 'shieldbeard': 2, 'oathbound-pikeman': 1, 'grimhold-ravager': 2, 'rune-splitter': 1,
                   'shield-bubble': 3, 'battle-cry': 3, 'second-wind': 1, 'fizzle': 1, 'healing-light': 1,
                   'soul-shard': 2, 'crystal-cluster': 2, 'glowing-geode': 1, 'heart-of-the-fallen': 1},
  'warband':      {'dwarf-smith-miner': 27, 'crystal-drunk-delver': 3,
                   'dwarf-miner': 4, 'dwarf-stoneback': 4, 'deepforge-crossbowman': 4, 'barrelback-courier': 3, 'shieldbeard': 1, 'oathbound-pikeman': 1, 'grimhold-ravager': 2, 'rune-splitter': 1,
                   'battle-cry': 3, 'shield-bubble': 2, 'fizzle': 1,
                   'crystal-cluster': 2, 'glowing-geode': 1, 'heart-of-the-fallen': 1},
 },
}
ORDER = ['warband', 'mine-rush', 'arcane-hoard', 'expedition']  # the default (Warband) first: it is the first stack in the deck picker
# Optional: py -I tools/gen-starter-decks.py [out path] [overrides.json]   (overrides = {"<deck id>": {card id: copies, ...}}, used for balance experiments)
OUT = sys.argv[1] if len(sys.argv) > 1 else 'src/content/starter-decks.json'
if len(sys.argv) > 2:
    for deck_id, counts in json.load(open(sys.argv[2], encoding='utf-8')).items():
        fk, st = deck_id.split('-', 1); fac = {v: k for k, v in FKEY.items()}[fk]
        D[fac][st] = counts

out = {}
for fac in ['goblins', 'gnomes', 'dwarves']:
    for style in ORDER:
        counts = D[fac][style]
        cards = [cid for cid, n in counts.items() for _ in range(n)]
        miners = fighters = spells = crystals = 0
        for cid in cards:
            c = CARDS[cid]
            assert not c.get('disabled'), (fac, style, cid, 'disabled')
            assert c['type'] != 'spell' or c['faction'] in ('any', fac), (fac, style, cid, 'other faction spell')
            assert c['type'] == 'spell' or c['type'] == 'crystal' or c['faction'] in (fac, 'any'), (fac, style, cid, 'other faction creature')
            if c['type'] == 'spell': spells += 1
            elif c['type'] == 'crystal': crystals += 1
            elif is_miner(c): miners += 1
            else: fighters += 1
        for cid, n in counts.items():
            lim = CFG['copyLimits'].get(CARDS[cid]['rarity'])
            assert lim is None or n <= lim, (fac, style, cid, n, 'over copy limit', lim)
        assert len(cards) == 60, (fac, style, len(cards))
        shape = (30, 17, 9, 4) if (fac, style) == ('gnomes', 'warband') else SHAPE[style]  # the Gnome Warband trades 3 fighters for 3 spells (Knobbin's discount; sims, Oct 31)
        assert (miners, fighters, spells, crystals) == shape, (fac, style, (miners, fighters, spells, crystals), shape)
        assert crystals <= CFG['crystalCardLimit']
        assert counts.get(BASIC[fac], 0) >= 5, (fac, style, 'the engine\'s opening-hand rescue looks for the basic Miner')
        deck_id = f'{FKEY[fac]}-{style}'
        out[deck_id] = {'name': f'{FNAME[fac]} {STYLE_NAME[style]}', 'faction': fac, 'style': style, 'cards': cards, 'counts': counts}
        print(f'{deck_id:22} {out[deck_id]["name"]:22} miners {miners:2} fighters {fighters:2} spells {spells:2} crystals {crystals}')
json.dump(out, open(OUT, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('wrote', len(out), 'decks')

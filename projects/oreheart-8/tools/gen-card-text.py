import json
p='src/content/cards.json'
cards=json.load(open(p)); ab=json.load(open('src/content/abilities.json'))
S={'gather':'Miner: mines 2 crystals (1 at an enemy mine).','tunnel':'Can be summoned next to a mine when you are behind.','frenzy':'+1 Attack next to another Goblin.','ranged':'Ranged. Hits 2 spaces away; no strike back.','kaboom':'When defeated, 2 damage to adjacent enemies.','sneaky':'Enemies can\'t strike back at it.','haste':'Can act the turn it is played.','rally':'All your Goblins get +1 Attack.','fixit':'Each turn, adjacent allies get Shield 1.','armored':'Takes 1 less damage from each hit.','blink':'Once: swap places with any of your creatures.','flying':'Flies over other creatures.','overload':'Its hits also hurt enemies next to the target.','guard':'Guard. Adjacent enemies must attack it first.','rage':'+2 Attack while below half Health.','charge':'Charge. Moves and attacks in the same turn.','unbreakable':'Takes at most 3 damage from a hit.','heartyale':'Each turn, adjacent allies get +1 Health.','eaterGuzzler':'Extra Crystal cards you play hurt it for 2.','eaterConduit':'Extra Crystal cards freeze it and cost 1 Health.','eaterDelver':'Extra Crystal cards give it -1 Attack for good.','smith':'Smith Miner. Upgrades a creature: +1 Attack, +1 Health.','kaboom1':'When defeated, 1 damage to adjacent enemies.','junkBoost':'On your turn, adjacent Goblins get +1 Attack.','siphon':'Defeating a creature gives +1 Bank crystal.','glyphShield':'Gets Shield 1 at the start of your turn.'}
E_={'gather':'a Miner standing next to a mine mines it on your Action phase; the crystals fill your Flow for your next turn','tunnel':'with 1 mine to the enemy\'s 2, you can summon it onto an empty space beside a mine','frenzy':'two Goblins side by side both hit harder','ranged':'a Ranged creature hits an enemy 2 spaces away over a creature standing between them','kaboom':'a bomber is defeated between two enemies and both take damage','sneaky':'it attacks a Guard and takes no damage back','haste':'summon it and attack in the same turn','rally':'with Grubnak\'s Big Boss in play every other Goblin hits 1 harder','fixit':'a Tinker next to a Beetle gives the Beetle a Shield each turn','armored':'a 3-damage hit only deals 2','blink':'swap into a gap in your line to reach a distant enemy','flying':'it flies across a wall of enemy creatures','overload':'hitting a creature also hurts its neighbours','guard':'with a Guard beside the enemy creature, it must be attacked first','rage':'at half Health or less it hits twice as hard','charge':'walk up to an enemy and strike in the same turn','unbreakable':'a 5-damage Fireball only deals 3 to her','heartyale':'allies beside the Brewmaster survive an extra hit','eaterGuzzler':'play a second Crystal card in a turn and it takes 2 damage','eaterConduit':'play a second Crystal card and it loses 1 Health and cannot act','eaterDelver':'play a second Crystal card and it permanently loses 1 Attack','smith':'drag it onto your creature in Deploy for +1 Attack and +1 Health, or onto an empty back-row space to summon a Miner','kaboom1':'it is defeated beside two enemies and each takes 1 damage','junkBoost':'on your turn the Goblins beside the Shaman hit 1 harder','siphon':'it defeats a creature and your Bank grows by 1','glyphShield':'it starts every turn with a Shield 1'}
SP={'prospectors-prayer':('Spell. Gain 3 Flow while behind on mines.','Regular spell. You can cast it only while the enemy owns more mines than you. You gain 3 Flow crystals right away.','you own 1 mine, the enemy owns 2: cast it in Deploy to get 3 extra crystals this turn.'),
'tunnel-rush':('Spell. Move a creature next to a mine; it can still attack.','Regular spell, cast in your Deploy phase. Move one of your creatures to any empty space next to a crystal site; it can still attack this turn.','move a far-away Fighter beside the enemy\'s mine and strike at once.'),
'fireball':('Spell. 3 damage to a creature or Commander.','Regular spell, cast in your Deploy phase by your Commander. It deals 3 damage to one creature or to the enemy Commander.','cast it on a 3-Health creature to defeat it.'),
'battle-cry':('Spell. All your creatures get +1 Attack this turn.','Regular spell, cast in your Deploy phase. Every creature you control gets +1 Attack until the end of the turn.','cast it, then attack with three creatures for 1 extra damage each.'),
'meteor-strike':('Spell. 2 damage to everything in a 3×3 area.','Regular spell, cast in your Deploy phase. It deals 2 damage to every creature in a 3 x 3 area, yours included.','aim it at the middle of three enemy creatures.'),
'healing-light':('Instant. Heal one of your creatures by 3.','Instant: play it in your turn or when you respond. It heals one of your creatures by 3, up to its full Health.','a creature at 1 Health is hit by a Fireball: respond and heal it first.'),
'shield-bubble':('Instant. A creature takes no damage from the next hit.','Instant: play it in your turn or when you respond. One of your creatures takes no damage from the next hit this turn.','the enemy attacks your Shieldbeard: respond and the hit does nothing.'),
'second-wind':('Instant. Your Commander heals 4.','Instant: play it in your turn or when you respond. Your Commander heals 4 Health, up to the maximum.','at 15 Health, play it to be back at the full 20.'),
'fizzle':('Counterspell. Cancel a spell costing 3 or less.','Counterspell (Instant): play it when the enemy casts a spell that costs 3 or less. The spell is cancelled and the caster\'s card is lost.','the enemy casts a 3-cost Fireball: respond and it shatters.'),
'hold-it':('Counterspell. Send a creature being summoned back to hand.','Counterspell (Instant): play it when the enemy summons a creature. The summon is cancelled and the card goes back to their hand.','the enemy summons a big creature: stop it and they must pay again.'),
'spell-snap':('Counterspell. Cancel any enemy spell.','Counterspell (Instant): play it when the enemy casts any spell, whatever it costs. The spell is cancelled.','the enemy casts Meteor Strike: respond and it is cancelled.'),
'mirror-hex':('Counterspell. Cancel a spell, then cast a free copy.','Counterspell (Instant): play it when the enemy casts a spell. It is cancelled, and you cast a free copy of it yourself.','the enemy casts Fireball at you: cancel it and Fireball their Commander.')}
CR={'soul-shard':1,'crystal-cluster':2,'heart-of-the-fallen':4,'motherlode':3,'glowing-geode':0}
for c in cards:
    if c['type']=='creature':
        parts=[S[a] for a in c.get('abilities',[])]
        if c['id']=='goblin-scrounger' or (c['role']=='Gatherer' and 'gather' in c.get('abilities',[])):
            short='Miner: mines 2 crystals. +1 Health to a creature.'
            if 'tunnel' in c.get('abilities',[]): short='Miner: mines 2. Tunnel. +1 Health upgrade.'
        elif not parts: short='A plain fighter. Hits hard for its cost.' if False else 'Plain and sturdy. No tricks.'
        else: short=' '.join(parts)
        if len(short)>80 and len(parts)>1: short=' '.join(p.split('.')[0]+'.' if len(p)>40 else p for p in parts)
        long=[]
        role={'Gatherer':'Miner','Smith':'Smith Miner'}.get(c['role'],'Fighter')
        long.append(f"{role} creature. Cost {c['cost']}, Attack {c['attack']}, Health {c['health']}, Movement {c['move']}. Summon it in your Deploy phase onto an empty back-row space (the row in front once the back row is full).")
        if role!='Fighter': long.append('Miners can move or mine, but never attack. A Miner drag-played onto your own creature gives it +1 Health; a Smith Miner gives +1 Attack and +1 Health.' if role=='Miner' else 'A Smith Miner played onto one of your own creatures gives it +1 Attack and +1 Health, with no limit. On an empty back-row space it is summoned as a Miner.')
        for a in c.get('abilities',[]):
            t=ab[a]['text'].rstrip('.'); nm=ab[a]['name']
            long.append(f"{nm}: {t[0].lower()+t[1:]}.")
        ex=[E_[a] for a in c.get('abilities',[]) if a not in ('gather',)] or [E_['gather'] if 'gather' in c.get('abilities',[]) else 'send it forward to trade blows with the enemy']
        long.append('Example: '+ex[0][0].upper()+ex[0][1:]+'.')
        if 'ranged' in c.get('abilities',[]) and not any('Ranged' in x for x in long): long.insert(1,'Ranged.')
        c['shortText']=short; c['longText']=' '.join(long)
    elif c['type']=='spell':
        s,l,e=SP[c['id']]; c['shortText']=s; c['longText']=l+' Example: '+e[0].upper()+e[1:]
    else:
        n=CR[c['id']]
        if c['id']=='glowing-geode': s='Crystal card. +1 Flow every turn, for good.'; l='Crystal card: free, played at Instant speed (also while you respond), one per round. It places a small crystal by your Stronghold that gives +1 Flow at the start of each of your turns for the rest of the match. Unique: one copy per deck.'; e='play it on turn 2 and have 1 extra crystal on every later turn.'
        else:
            s=f'Crystal card. Free. +{n} to your Bank.'+(' Next creature costs 2 less.' if c['id']=='motherlode' else ''); l=f'Crystal card: free, played at Instant speed (also while you respond), one per round. It adds {n} crystal{"s" if n>1 else ""} to your Bank, which never runs out until spent.'+(' Your next creature this turn also costs 2 less.' if c['id']=='motherlode' else ''); e='play it just before a cost-5 creature when you have only 3 Flow.'
        c['shortText']=s; c['longText']=l+' Example: '+e[0].upper()+e[1:]
    c['text']=c['shortText']
    assert len(c['shortText'])<=80,(c['id'],len(c['shortText']),c['shortText'])
    assert 'Example:' in c['longText'] and len(c['longText'])>len(c['shortText'])
json.dump(cards,open(p,'w'),indent=1,ensure_ascii=False)

# Oreheart — Game Design Document

> **Factory build instructions:** Build this game exactly as specified in this document. It is the source of truth for all rules and numbers.
> Use the mockup image at design/oreheart-mockup.jpg for the screen LAYOUT (board in the middle, resources top-left, Move/Attack/Build buttons, End Turn button, hand of cards at the bottom), but make the look brighter, cuter and more cartoony as described under Art and style.
> Expand the 27 starter cards into a full set of about 80 original cards across the three factions plus spells, keeping the same number ranges and simplicity.
> Ignore the "Open questions" section for version 1.


Oct 13, 2026 · @Ken

## Overview

Oreheart is a cartoony fantasy strategy card game: two players gather Wood, Crystal and Iron from three resource sites, build walls, and battle creatures on a chess-like board. You win by destroying the enemy Stronghold or by building the richest kingdom.

- **Players:** you against a computer opponent (Easy, Normal, Hard). Online play against people may come later.
- **Audience:** kids, teens and adults. Easy to learn, hard to master: simple numbers, deep decisions.
- **Match length:** 10 minutes to an hour, chosen by game mode and shaped by player skill.
- **Platform:** Android phone, installed to the home screen (PWA), full screen, works offline, portrait layout. A Google Play version may come later.
- **The three layers of strategy:** deck building before the match; economy (gather, build, protect workers) and battle (positioning, arrows, flanking) during it.

## Art and style

Cartoony and kid-friendly: chunky rounded shapes, big expressive eyes, bright colors, bold outlines, in the spirit of colorful stylized fantasy games. Every character, name and design is original; nothing is borrowed from Pokémon, World of Warcraft or any other game.

- **Layout reference:** the mockup image (design/oreheart-mockup.jpg) sets the screen layout: enemy Stronghold at the top, yours at the bottom, three resource sites across the middle, resources in the top-left, Move / Attack / Build buttons, End Turn button, and your hand of cards along the bottom.
- **Mood:** brighter and cuter than the mockup's dark, gritty look.
- **Faction colors:** Wildwood green, Shimmerfolk purple-blue, Ironclad steel and red.
- **Card art (version 1):** designed frames, faction colors and symbols. Painted creature art can come later through an image-generator upgrade.
- **Animations:** attacks, knock-outs, walls being built and crumbling, resources being gathered.

## The board

The battlefield is a 7 × 7 grid of tiles, like a chessboard, with three resource sites across the middle row. The middle row reads slot, resource, slot, resource, slot, resource, slot. Each site has 8 gathering tiles around it, and neighboring sites share the column of tiles between them.

- **Rows 1–2 (top):** enemy home rows. The enemy Stronghold sits in the center of row 1.
- **Rows 3–5:** the resource zone. Row 4 holds 🌲 Forest (column 2), 💎 Crystal Mine (column 4) and ⛏️ Iron Mine (column 6). The sites themselves can't be stood on; every other tile in rows 3–5 is a gathering tile.
- **Shared tiles:** tiles in columns 3 and 5 touch two sites. A creature there chooses which one to gather from, which makes them the most valuable tiles on the board.
- **Rows 6–7 (bottom):** your home rows. Your Stronghold sits in the center of row 7.
- **Fairness:** both Strongholds are the same distance from every site.
- **Strongholds** take up one tile. A creature attacks a Stronghold from an adjacent tile, with an arrow pointing at it.

A 7 × 7 board keeps tiles big on a phone (about 50 pixels each) and puts the fight for resources only one step from each home zone.

```
Board (7 x 7), enemy at top, you at bottom
   col: 1 2 3 4 5 6 7
row 1:  . . . S . . .   <- enemy Stronghold (enemy home rows 1-2)
row 2:  . . . . . . .
row 3:  w w b c b i i   <- gathering tiles
row 4:  w W b C b I i   <- W = Forest, C = Crystal Mine, I = Iron Mine
row 5:  w w b c b i i   <- gathering tiles
row 6:  . . . . . . .
row 7:  . . . S . . .   <- your Stronghold (your home rows 6-7)
w/c/i = gathers from that site; b = shared tile, gathers from either neighbor
```

The middle row runs slot, Forest, slot, Crystal, slot, Iron, slot; the striped tiles between sites can gather from either neighbor.

## Resources and economy

Three resources pay for everything: Wood, Crystal and Iron. You start with a little, get a trickle each turn, and must gather the rest from the sites.

| Resource | Comes from | Pays for |
| --- | --- | --- |
| 🌲 Wood | Forest | Wildwood creatures, palisades, ballistas, Wooden Boots |
| 💎 Crystal | Crystal Mine | Shimmerfolk creatures, spells, palisade and creature crystal upgrades |
| ⛏️ Iron | Iron Mine | Ironclad creatures, Iron Armor, Iron Weapons, iron palisades |

- **Starting resources:** 2 Wood, 2 Crystal, 2 Iron.
- **Income:** your Stronghold gives +1 of each resource at the start of every turn.
- **Gathering:** a creature on one of a site's 8 gathering tiles can spend its action to Gather 1 of that resource. Worker creatures gather 2.
- **Shared sites:** both players can gather from the same site at once; whoever holds more gathering tiles gathers more.
- **Sites run dry:** each site holds a limited amount (15, 30 or 50 depending on game mode), shown on the board. When it's empty, it gives nothing.
- **No storage limit:** resources carry over from turn to turn.
- **Card costs** are 1–5 and mostly in the card's own faction resource, so on turn 1 you can afford about two small creatures.

## Factions

There are three factions, one per resource, and each plays differently. Decks can mix factions, but a mixed deck has to fight over more resource sites.

|  | 🌲 Wildwood | 💎 Shimmerfolk | ⛏️ Ironclad |
| --- | --- | --- | --- |
| Resource | Wood | Crystal | Iron |
| Theme | Forest critters, treants, elves, owls | Wizards, wisps, gem foxes, little dragons | Knights, orcs, dwarves, goblins, steam robots |
| Playstyle | Builders: walls, ballistas, slow and sturdy | Tricksters: spells, teleport, swap, flying | Fighters: armor, big hits, pushing forward |
| Strength | Best defense | Most surprising | Best in a straight fight |
| Weakness | Slow to attack | Low Defense | Expensive, slow to move |
| Worker | Beaver Builder | Gem Gnome | Goblin Miner |

**Type advantage:** a creature gets +1 Attack when it attacks the type it beats.

- ⛏️ Iron beats 🌲 Wood (axes chop trees)
- 🌲 Wood beats 💎 Crystal (roots crack crystal)
- 💎 Crystal beats ⛏️ Iron (magic melts armor)

## Cards

Every creature card shows just four things: cost, attack arrows, ⚔️ Attack and 🛡️ Defense. Numbers stay low so the math is easy for kids.

- **Cost:** 1–5 resources, shown top-left with resource icons (for example ⛏️2, or 🌲4 + ⛏️1).
- **Attack arrows:** up to 8 directions around the picture (up, down, left, right, diagonals). They show which neighboring tiles the creature can attack. A double arrow means ranged: it hits the first enemy up to 3 tiles away in that direction.
- **⚔️ Attack and 🛡️ Defense:** usually 1–4; legendaries reach 5 or 6.
- **Ability (optional):** one short line, such as Swift or Leap, on special cards only.

**Card types:**

1. **Creatures:** placed on the board; move, attack, gather.
2. **Spells (Crystal):** one-time effects, such as knocking out a weak creature, teleporting an ally, or freezing an enemy for a turn.
3. **Equipment** comes from the Forge (see Building and upgrades), not from cards. Structures are built with the Build button, not from cards.

**Rarity** (a colored gem on the card): Common (gray), Rare (blue), Epic (purple), Legendary (gold). Rarer cards are stronger or more unusual, never just bigger numbers.

**Deck rules:** 30 cards; at most 2 copies of a card, and 1 of each Legendary.

## Turns and actions

Each creature gets one action per turn: Move, Attack, Gather, Build or Turn. Choosing between them is the heart of the game.

**Setup:** shuffle your 30-card deck and draw 4 cards. Once, at the start, you may shuffle back any cards you don't want and redraw them. A coin flip decides who goes first; the second player gets +1 Crystal to even it out.

**Luck (the deck):** your deck is shuffled at the start of every match and you draw one card at a time, so you never know exactly what's coming next. Luck decides your options; skill decides what you do with them. Booster packs add a second layer of luck to what's in your collection.

**Each turn:**

1. **Draw** 1 card (maximum hand size 8).
2. **Collect** income: +1 Wood, +1 Crystal, +1 Iron.
3. **Play cards:** summon creatures onto empty tiles in your 2 home rows (facing the enemy), and cast spells.
4. **Act:** each of your creatures (and ballistas) may take one action. New creatures can't act on the turn they arrive unless they have Charge.
5. **End Turn.**

**Actions:**

| Action | What it does |
| --- | --- |
| Move | Step 1 tile up, down, left or right onto an empty tile |
| Attack | Hit an enemy creature, structure or Stronghold on a tile an arrow points at |
| Gather | On a gathering tile: take 1 resource from that site (Workers take 2) |
| Build | Build a palisade or ballista on an empty adjacent tile, or upgrade one |
| Turn | Rotate 90° left or right; the arrows rotate too |

**Movement abilities** (on special cards):

- **Swift:** moves 2 tiles.
- **Leap:** jumps over one creature or palisade.
- **Swap:** trades places with an adjacent creature, yours or the enemy's.
- **Teleport:** moves to any empty gathering tile (rare).
- **Flying:** moves over palisades (except Crystal and Golden ones).
- **Charge:** can act the turn it's summoned.

## Combat

One rule decides every fight: if the attacker's ⚔️ Attack is equal to or higher than the defender's 🛡️ Defense, the defender is knocked out. Otherwise it survives unharmed. There is no damage to track and no healing.

- **Arrows:** you can only attack a tile one of your arrows points at.
- **Strike back:** if the defender has an arrow pointing back at the attacker, it strikes back at the same moment (its Attack against the attacker's Defense). Both can be knocked out.
- **Flanking:** hit an enemy from a side with no arrow and it can't strike back. Covering your blind spots matters.
- **Type advantage:** +1 Attack when Iron attacks Wood, Wood attacks Crystal, or Crystal attacks Iron.
- **Gang up:** +1 Attack for each other friendly creature or ballista whose arrow also points at the same target.
- **Upgrades** (Iron Armor, Iron Weapon) add to the numbers.
- **Knocked out** creatures leave the board and go to the discard pile, losing any upgrades.
- **Strongholds:** an attack on a Stronghold always lands and removes hearts equal to the attacker's Attack.

**Example:** a Tin Knight (⚔️3, Iron) attacks a Mossy Turtle (🛡️4, Wood) from the turtle's blind side. Iron beats Wood, so the knight hits with 4. 4 is at least 4, so the turtle is knocked out, and with no arrow pointing back it can't strike back.

## Building and upgrades

Structures are built from Wood with the Build button, not from cards. Palisades block access to resources, and ballistas break palisades.

- **Where:** on an empty tile next to one of your creatures; it uses that creature's action. Builder creatures pay 1 Wood less.
- Palisades block movement and ranged arrows.

**Palisade tiers** (tap your palisade, then Upgrade):

| Tier | Cost | 🛡️ Defense | Bonus |
| --- | --- | --- | --- |
| 🪵 Wooden Palisade | 2 Wood (to build) | 2 | Blocks movement and ranged attacks |
| ⛏️ Iron Palisade | +2 Iron | 3 | Tougher |
| 💎 Crystal Palisade | +2 Crystal | 4 | Also blocks Flying and Teleport |
| 👑 Golden Palisade | +1 Wood, +1 Crystal, +1 Iron | 5 | Only ballistas can damage it |

**Ballista:** 3 Wood, ⚔️3, 🛡️2. It only attacks structures (palisades and enemy ballistas), with a double arrow reaching 3 tiles in the direction it faces. It can't move but can Turn. Creatures can knock it out.

**Creature upgrades (the Forge):** tap your creature, then Upgrade. Each creature can hold at most 2, and they're lost when it's knocked out.

| Upgrade | Cost | Effect |
| --- | --- | --- |
| Iron Armor | 2 Iron | 🛡️ +1 |
| Iron Weapon | 2 Iron | ⚔️ +1 |
| Crystal Charm | 2 Crystal | One more attack arrow (you pick the direction) |
| Wooden Boots | 2 Wood | Moves 1 extra tile |

Upgrading doesn't use the creature's action.

## Winning, losing and game modes

You win by destroying the enemy Stronghold or by being first to bank enough of every resource. You lose when the enemy does either first.

1. **Conquest:** knock the enemy Stronghold down to 0 hearts.
2. **Kingdom:** at the start of your turn, hold the target amount of each resource (Wood, Crystal and Iron).
3. **No stalemates:** when all three sites are empty, the player whose Stronghold has more hearts left wins; if tied, the player holding more total resources wins.
4. **Surrender:** you can give up at any time from the menu.

If your deck runs out, you keep playing with no new draws.

| Mode | Stronghold hearts | Each site holds | Kingdom target | Typical length |
| --- | --- | --- | --- | --- |
| Quick Battle | 5 | 15 | 10 of each | 10–15 min |
| Standard | 10 | 30 | 15 of each | 20–30 min |
| Epic War | 15 | 50 | 20 of each | 45–60 min |

## Starter card list

These 27 cards set the style and balance for the factory to build the full set from (about 80 cards). Arrows are written from the creature's point of view: F = forward, B = back, L = left, R = right, FL/FR/BL/BR = diagonals, and a doubled letter (FF) = ranged, up to 3 tiles.

**🌲 Wildwood**

| Card | Rarity | Cost | ⚔️ | 🛡️ | Arrows | Ability |
| --- | --- | --- | --- | --- | --- | --- |
| Beaver Builder | Common | 🌲1 | 1 | 1 | F | Worker; Builder |
| Acorn Sprout | Common | 🌲1 | 1 | 2 | F | — |
| Thornback Hedgehog | Common | 🌲2 | 2 | 2 | FL, FR, BL, BR | — |
| Mossy Turtle | Common | 🌲2 | 1 | 4 | F | — |
| Owl Ranger | Rare | 🌲3 | 2 | 2 | FF | Flying |
| Bramble Elf | Rare | 🌲3 | 3 | 2 | F, L, R | Swift |
| Barkbeard Treant | Epic | 🌲4 | 3 | 4 | F, L, R | Builder |
| Old Oakheart | Legendary | 🌲4 + ⛏️1 | 4 | 5 | F, B, L, R | Friendly palisades next to it get 🛡️ +1 |

**💎 Shimmerfolk**

| Card | Rarity | Cost | ⚔️ | 🛡️ | Arrows | Ability |
| --- | --- | --- | --- | --- | --- | --- |
| Gem Gnome | Common | 💎1 | 1 | 1 | F | Worker |
| Spark Wisp | Common | 💎1 | 2 | 1 | F | Flying |
| Prism Fox | Common | 💎2 | 3 | 1 | F, B | Swap |
| Glimmer Bat | Rare | 💎2 | 2 | 1 | FL, FR | Flying, Swift |
| Starcap Wizard | Rare | 💎3 | 3 | 2 | FF | — |
| Crystal Golemling | Epic | 💎3 + ⛏️1 | 2 | 4 | F, L, R | Leap |
| Prismatica, Rainbow Dragon | Legendary | 💎5 | 5 | 3 | All 8 | Flying |

**⛏️ Ironclad**

| Card | Rarity | Cost | ⚔️ | 🛡️ | Arrows | Ability |
| --- | --- | --- | --- | --- | --- | --- |
| Goblin Miner | Common | ⛏️1 | 1 | 1 | F | Worker |
| Tin Knight | Common | ⛏️2 | 3 | 2 | F, L, R | — |
| Grumble Orc | Common | ⛏️2 | 3 | 3 | F | — |
| Dwarf Smith | Rare | ⛏️2 + 🌲1 | 2 | 3 | F | Builder; Forge upgrades cost it 1 less |
| Cannon Crab | Rare | ⛏️3 | 3 | 3 | L, R, FF | — |
| Boar Rider | Epic | ⛏️4 | 4 | 3 | F, FL, FR | Charge, Swift |
| Sir Rivetbeard | Legendary | ⛏️5 | 5 | 5 | F, B, L, R | Friendly creatures next to him get ⚔️ +1 |

**💎 Spells** (one-time, then discarded)

| Card | Rarity | Cost | Effect |
| --- | --- | --- | --- |
| Zap | Common | 💎1 | Knock out an enemy creature with 🛡️1 |
| Frost Snap | Common | 💎2 | An enemy creature can't act next turn |
| Blink | Rare | 💎2 | Teleport one of your creatures to any empty tile |
| Rockfall | Rare | 💎2 + ⛏️1 | Knock out an enemy creature with 🛡️2 or less |
| Overgrowth | Epic | 💎2 + 🌲2 | Build a free Wooden Palisade on 2 empty tiles |

## Collection, opponent and screens

Players earn gold by winning, spend it on booster packs, and build decks from what they collect. All progress is saved on the phone.

**Collection**

- **Starter set:** a starter deck for each faction (30 cards each), so new players can try all three.
- **Gold per win:** Easy 10, Normal 20, Hard 35 (half for a loss, so nobody gets stuck).
- **Booster pack:** 50 gold for 5 random cards, at least one Rare or better, opened with a card-flip animation. Odds per card: Common 70%, Rare 22%, Epic 7%, Legendary 1%.
- **Deck builder:** save up to 5 decks; filter the collection by faction, rarity, type and cost.

**Computer opponent**

- **Easy:** for kids; makes obvious moves and some mistakes.
- **Normal:** sensible play: sends workers to safe sites, contests sites it's losing.
- **Hard:** uses flanking, ganging up, palisades and ballistas well, and protects its Stronghold.

**Helper features:** tapping a creature highlights where it can move (blue) and what it can hit (red), plus an optional hint button and undo for the current turn.

**Screens:** Main menu, Play (pick a deck, mode and difficulty), Collection, Deck Builder, Shop, How to Play (illustrated tutorial match), Settings (sound, music, reset progress).

**Open questions**

- [ ] Should a story campaign (a series of opponents across a map) come in version 1 or later?
- [ ] Daily rewards or quests?
- [ ] Sound effects and music style?
- [ ] Online play against other people (needs the back-office upgrade)?
- [ ] Painted card art (needs the image-generator upgrade)?

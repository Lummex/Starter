# Oreheart — Game Design Document

Oct 13, 2026 · @Ken

## Overview

Oreheart is a 3D comic-style fantasy card battle: Goblins, Gnomes and Dwarves fight over three resource sites, and you win by forcing the enemy Commander to retreat. Cards in your hand become 3D characters when played onto a painted battlefield.

- **Players:** you against a computer opponent (Easy, Normal, Hard) first; online player vs player comes in a later phase.
- **You are the Commander:** your avatar sits in your Stronghold, reacts to the battle with funny emotes, and casts all your spells. You have 20 health; lose it and you lose.
- **Audience:** kids, teens and adults. Easy to learn, hard to master.
- **Platform:** Android phone, installed to the home screen (PWA), full screen, offline, landscape (phone held sideways) for a wider view of the battlefield; it asks the player to rotate if the phone is upright. Also playable with a mouse on a computer.
- **Version 2 note:** this replaces the first design. Directional attack arrows, walls and ballistas, and the Kingdom win are gone.

## Lore: the Age of the Last Commanders

The great heroes of the world fought each other until almost none were left. The handful who survived are now far too precious, and far too fond of themselves, to risk a scratch, so they send hordes of dim-witted minions to fight for them over the crystals that hold the souls of the fallen.

**The Great Brawl.** Once, the land was full of mighty warriors: the bravest, smartest and buffest of every people. Each was sure they were the greatest who ever lived, so they spent centuries proving it on each other. By the end, almost all of them had fallen. Every army had sent its best and brightest to the front, so the folk left behind were... not the best and brightest. Generation after generation, the minions got a little dimmer.

**The Soul Crystals.** Where a mighty warrior fell, their soul hardened into glowing crystal. These Soul Crystals hold the power of every fallen hero, and whoever controls them can summon and command minions. The crystals glow in the color of the faith that claims them: green, blue or purple. That's why every battle is a fight over a crystal site.

**The Last Commanders.** A few great warriors survived and became Commanders. They know exactly how rare they are, so they never fight in person. They stand safely in their Strongholds, shout orders, cast spells from a distance, and take full credit for every win. They are vain, dramatic and completely convinced that every other Commander is trash.

**The Three Faiths.** Some Commanders were old friends who refused to fight each other, so they joined into three factions that behave like religions. Each faith believes it alone is destined to unite the world, and that everyone else must join it or be wiped out. Nobody can agree on which faith everyone should join, so the war goes on forever, fought by minions.

| Faith | Faction | Crystal | Believes | Motto |
| --- | --- | --- | --- | --- |
| The Shiny Horde | Goblins | Green | Whoever grabs the most shiny things is the chosen one | "Mine! Also mine!" |
| The Cogwork Congregation | Gnomes | Blue | The world is a machine, and gnomes hold the instruction manual | "Everything is fixable. Especially you." |
| The Order of the Anvil | Dwarves | Purple | Only the strong, the stubborn and the bearded deserve the crystals | "We were here first. Get off our rock." |

**Commanders never die, they retreat.** When a Commander drops to 0 Health, they don't die: in a perfectly timed panic they escape at the last second (a Goblin Boss shoots off on a rocket barrel, a Gnome Professor vanishes in a puff of steam, a Dwarf Thane dives down an escape tunnel), shouting that this was all part of the plan. That's how the match is won: force the enemy Commander to retreat.

**Trash talk.** Each faction has its own names for the others, playful and never truly nasty. They show up in taunts, voice lines and flavor text.

| Faction | Calls Goblins | Calls Gnomes | Calls Dwarves |
| --- | --- | --- | --- |
| Goblins | — | Gear-brains, Tick-tocks | Pink-butts, Beard-buckets |
| Gnomes | Green-skins, Swamp-sniffers | — | Rock-heads, Hairy Bricks |
| Dwarves | Stinkers, Greenies | Ankle-biters, Tinker-twits | — |

**How the tone flows from the lore:** Commanders take themselves deadly seriously; their minions are loyal, enthusiastic and not very bright. Every card name, flavor line and voice line should sound like a pompous Commander or a happy, clueless minion.

## Look and feel

Everything is 3D in a comic-book style, beautiful and polished, in the style of the mockup image, but in landscape: the battlefield fills the center of a wide screen, viewed at an angle like a tabletop, with the enemy's Stronghold at the far side and yours at the near side. Your hand fans along the bottom edge, the enemy's card backs along the top edge, your crystal counters and deck pile on the left, and the phase, timer, Done button and Commander Health on the right.

- **Battlefield:** a painted 3D sandbox scene (dirt, grass, rocks, and three giant glowing crystal formations). No visible checkerboard.
- **Cards become characters:** a card dragged onto the battlefield flips, glows and rises up as a 3D character standing on that spot.
- **Your hand:** cards fan out in a rainbow arc, like holding them. Unlimited hand size; swipe with a finger or scroll the mouse wheel to slide smoothly through the fan. The card under your finger lifts and enlarges.
- **Opponent's hand:** card backs fanned in a rainbow arc at the top of the screen, no hands shown.
- **Deck piles:** each player's deck is a visible stack of card backs whose height shrinks as cards are drawn.
- **Commanders:** the top half of each Commander pops out of their Stronghold. They react with emotes: cheering when their creatures land a hit, groaning when one dies, flinching and shaking a fist when hit, and casting spells with big gestures. Funny, but in a serious way.
- **Animations:** walking, attacking, damage numbers, defeats, spells flying out of the Commander, resources flowing into your counters.
- **Art plan:** build version 1 with simple placeholder 3D characters to prove the gameplay, then an art upgrade round with real 3D models or AI-painted art. All characters are original.

## Tone: deadly serious, completely ridiculous

Oreheart plays its tiny goblins, gnomes and dwarves as if this were the most epic war ever fought. The joke is how seriously everything takes itself; the game stays kid-friendly, with no gore.

- **Over-the-top drama:** slow-motion close-ups on big hits, thunder cracks and a heavy-metal guitar sting when a Collector card hits the field, a dramatic camera push-in on a two-inch goblin.
- **Grandiose names and flavor text:** cards and Commanders have absurdly heroic titles and solemn one-liners, for example "Goblin Scrounger, Taker of Shiny Things" or "He has never lost a fight he remembers."
- **Commanders are drama queens:** a dramatic gasp and a single heroic tear when a creature falls; fist-pumping victory roars over a 1-damage hit; outrage when hit ("HOW DARE YOU").
- **Epic announcer:** a movie-trailer voice-style caption for big moments ("THE CRYSTAL. HAS. FALLEN."), shown as bold comic-book text bursts.
- **Comic effects:** chunky "KA-BOOM!" and "CRUNCH!" text bursts, screen shake, sparkles, and dust clouds.
- **Still silly underneath:** defeated creatures poof away in a puff of smoke and stars, then wave goodbye.

## Controls and touch

You move creatures by picking them up and dragging them, with a finger or the mouse, and they react when you poke them.

- **Drag to move:** press and hold a creature and it's lifted into the air, legs dangling and wriggling. The spaces it can reach glow. Drag it there and let go: it drops with a little dust puff and a thud. Let go anywhere invalid and it floats back to where it was.
- **Drag to attack:** drag a creature onto an enemy it can reach and it charges in and attacks.
- **Drag cards from your hand** onto your back row to summon; the card flips and rises up as the 3D character.
- **Haptics:** a short vibration on pick-up, drop, hits and defeats (on phones that support it; can be turned off in Settings).
- **Tap to poke:** tapping a creature without dragging makes it react with a random personality animation: a victory dance, a flex, an angry stomp and shaking fist, a startled jump, a yawn. Poke it several times in a row and it gets increasingly annoyed. Each faction has its own style: Goblins cackle and rude-dance, Gnomes fiddle with gadgets, Dwarves stroke their beards and grumble.
- **Tap to inspect:** double-tap a creature (or tap a card in your hand) to see its card full size with stats and ability.

## The board

Under the painted ground is an invisible 7 × 7 grid of spaces. Players never see the grid; when you select a creature, the spaces it can move to or attack glow softly on the ground.

- **Rows 1–2 (top):** enemy home rows. The enemy summons on row 1, its back row (row 2 only when row 1 is full). The enemy Stronghold, with its Commander, stands at the center of row 1.
- **Rows 3–5:** the resource zone. Row 4 holds three resource sites at columns 2, 4 and 6. The sites can't be stood on.
- **Rows 6–7 (bottom):** your home rows. You summon on row 7, your back row (row 6 only when row 7 is full), so new minions always have to march forward. Your Stronghold stands at the center of row 7.
- **Spaces around a site:** the 8 spaces touching a site count toward controlling it. Spaces in columns 3 and 5 touch two sites and count for both.
- **Attacking a Stronghold:** a creature must stand on a space next to the enemy Stronghold to attack the Commander inside.

```
Board: invisible 7 x 7 grid (enemy at top, you at bottom)
   col: 1 2 3 4 5 6 7
row 1:  b b b S b b b   <- enemy Stronghold + Commander; b = enemy back row (enemy summons here)
row 2:  . . . . . . .   <- enemy summons here only when row 1 is full
row 3:  z z z z z z z   <- crystal zone
row 4:  z C z C z C z   <- C = crystal site (cannot be stood on)
row 5:  z z z z z z z   <- crystal zone
row 6:  . . . . . . .   <- you summon here only when row 7 is full
row 7:  b b b S b b b   <- your Stronghold + Commander; b = your back row (you summon here)
Columns 3 and 5 touch two sites and count for both.
```

The drawing shows the invisible spaces; in the game the ground is painted. Each site's crystals glow in the color of whoever controls it.

## Crystals and site control

The only resource is soul crystal (crystal for short), in three flashy colors: green for Goblins, blue for Gnomes, purple for Dwarves. You earn crystals by controlling the three crystal sites, and a site you control glows in your color and produces your crystals.

- **Control:** at the start of your turn, you control a site if you have more creatures on its 8 surrounding spaces than the enemy. Ties mean nobody controls it.
- **Switching color:** when you take control of a site, its crystals burst and regrow in your faction's color (you pick, if your deck mixes factions), with sparkles and light beams.
- **Income per turn:** each site you control gives 1 crystal, plus 2 more for each of your Gatherers next to it. Fighters count toward control but gather nothing extra.
- **Commander's trickle:** your Stronghold gives +1 crystal of your faction's color every turn, so you're never stuck.
- **Starting crystals:** 0. Your first turn's Stronghold trickle gives you 1 crystal: just enough for one weak (cost 1) troop. Both numbers are owner settings.
- **Endless sites:** sites never run out; they can be mined forever. Long games are ended by deck-out damage and sudden death instead.
- **Card costs:** creatures cost 1–7 crystals of their faction color; spells cost 4–12 crystals of any color.
- **Look:** big, glossy, glowing gems with bright neon-saturated colors, light rays and floating sparkles.

**Spread out or stack up.** Deciding where to send your minions is the core strategy: one Gatherer at each site to grab a little everywhere, or three creatures on one site to lock it down. Since a faction only needs its own color, holding just one site can be enough to win.

**Never locked out.** A player who loses every site early always has ways back in:

- **Underdog bonus:** if you control no sites at the start of your turn **and the enemy controls at least one**, your Stronghold gives +2 extra crystals that turn (on top of the normal +1). It never applies while nobody holds a site, so it doesn't speed up the opening.
- **Tunnelers:** each faction has Gatherer creatures with the Tunnel ability: when the enemy controls more sites than you, they can be summoned straight onto any empty space next to a crystal site instead of your back row.
- **Comeback spells:** cheap spells built to break a lockout (see Prospector's Prayer and Tunnel Rush in the spell list).
- **Ties freeze a site:** one creature sneaking in to tie the count is enough to stop the enemy's income from that site.

## Factions

Three factions, each paying with its own crystal color: Goblins use green, Gnomes use blue, Dwarves use purple. Decks can mix factions, but then you need crystals of several colors.

|  | Goblins | Gnomes | Dwarves |
| --- | --- | --- | --- |
| Crystal color | Green | Blue | Purple |
| Personality | Scrappy, sneaky, chaotic | Clever tinkerers and spark-mages | Tough, proud miners and warriors |
| Playstyle | Cheap swarms, explosions, tricks | Gadgets, shields, ranged sparks | Big health, heavy hits, holding ground |
| Strength | Numbers and speed of play | Support and surprises | Hard to kill |
| Weakness | Fragile | Weak in close combat | Expensive |
| Commander | Grubnak the Goblin Boss | Professor Sproingle | Thane Borgo Anvilbottom |

**Two kinds of creature in every faction:**

- **Gatherers:** strong at gathering (+2 crystals per turn next to a site you control), weak in a fight.
- **Fighters:** strong in a fight, gather nothing extra.

**Type advantage:** +1 Attack when Dwarves hit Goblins, Goblins hit Gnomes, or Gnomes hit Dwarves.

## Commanders

You pick your Commander before each match. Each faction has one starter Commander and more to unlock, and every Commander has one special ability that's always on. Commanders have 20 Health unless their ability says otherwise.

- **Unlocking:** extra Commanders come as very rare Commander cards in booster packs (their drop chance is in the owner's rarity settings file). Duplicate Commanders turn into shards, like duplicate cards.
- **Choosing:** a Commander screen shows all Commanders, locked ones as dark silhouettes. Your Commander sets your faction, appears in your Stronghold, and has its own emotes and voice lines.

| Commander | Faction | How you get it | Special ability |
| --- | --- | --- | --- |
| Grubnak the Goblin Boss | Goblins | Starter | Goblin creatures cost 1 less crystal (minimum 1) |
| Queen Skreeka the Shiny | Goblins | Booster pack | Gain 1 extra crystal whenever one of your creatures is defeated |
| Professor Sproingle | Gnomes | Starter | Your spells cost 1 less crystal (minimum 1) |
| Madame Sprocket | Gnomes | Booster pack | At the start of your turn, your creature with the lowest Health gets Shield 1 |
| Thane Borgo Anvilbottom | Dwarves | Starter | Your creatures get +1 Health |
| Old Grumblebeard the Unkillable | Dwarves | Booster pack | Your Commander starts with 25 Health instead of 20 |

The factory adds more unlockable Commanders over time in the same style.

## Cards

A creature card shows its cost, Attack, Health, movement and one special ability. Numbers stay low so the math is easy.

- **Cost:** 1–7 of the faction's resource, top-left.
- **⚔️ Attack** and **❤️ Health:** Attack 1–5, Health 2–6 (printed on the card; upgrades and abilities can raise it).
- **Movement:** 1 space per turn; Ultra Rare and Collector characters can move 2.
- **Role:** Gatherer or Fighter, shown by a pickaxe or sword badge.
- **Special ability:** every creature has one, in one short line.

**Card types:**

1. **Creatures:** played onto the battlefield, where they become 3D characters.
2. **Spells:** cast by your Commander, who launches them from the Stronghold (a fireball arcs out of his hands, a shield of light drops over a creature). Regular spells can be cast in any phase of your own turn. Instant spells (marked with a lightning bolt) can be cast at any time, even during the opponent's turn, for example to save a creature as it's attacked. Counterspells are Instants that cancel an enemy spell or summon as it happens.
3. **Crystal cards:** free to play, they give you bonus soul crystals of your faction's color to summon bigger minions and cast spells sooner. You can play only one Crystal card per turn, during your Deploy phase, unless a Crystal Eater creature lets you play more, at a price.

**Rarity** (a gem on the card): Common (gray), Uncommon (bronze), Rare (silver), Ultra Rare (gold), Collector (shimmering rainbow prism). The best cards are the hardest to get.

**Deck rules:** 50 cards (the owner can change this). Common and Uncommon cards have no copy limit; Rare, Ultra Rare and Collector cards are limited to 3 copies each. Especially powerful cards are marked Unique: you can have only one of that card on your battlefield at a time (extra copies wait in your hand). A deck can hold at most 10 Crystal cards in total, whatever their rarity.

**Starter decks** (one per faction, 50 cards): 40 creatures, 6 spells (including 1 counterspell, Fizzle) and 4 Crystal cards. Mostly Commons; the owner can change the mix in the settings file. The owner can change copy limits, the Crystal card limit and the Unique mark per card to balance the game. Before a match you pick your Commander (which sets your faction) and your deck.

## Turns and phases

Every turn runs through the same phases, each with its own timer (Deploy 30 seconds, Action 45 seconds to start; the owner can change each in the Owner Console). A burning rope creeps across the screen in the last 10 seconds of a phase; when it burns out, the phase ends automatically.

**Setup:** pick your Commander and deck. The deck is shuffled and you draw 5 cards; once, you may shuffle back any you don't want and redraw them. A coin flip decides who goes first; the first player skips their first draw, and the second player draws 1 extra card.

**Luck:** you draw one card at a time from a shuffled deck, so you never know exactly what's coming. Booster packs add luck to your collection. There is no other randomness.

**The phases of a turn:**

1. **Draw phase** (automatic): all your creatures heal back to full Health, you draw 1 card (no hand limit), and you collect crystals from your Stronghold and the sites you control.
2. **Deploy phase** (timed): drag creature cards onto empty spaces in your back row, play up to one Crystal card, upgrade creatures, and cast spells (Regular spells work in any phase of your turn, Instants at any time). If your back row is full, you can summon onto the row in front of it; if both are full, the card waits in your hand.
3. **Action phase** (timed): each of your creatures either **moves or attacks**, never both. Drag it to an empty space to move, or onto an enemy (or the enemy Stronghold) to attack. Creatures placed this turn can't act unless their ability says so.
4. **End phase** (automatic): end-of-turn abilities happen, then it's the other player's turn.

You can tap a "Done" button to finish a phase early.

**Responding with Instants:** when the opponent attacks one of your creatures or casts a spell, and you hold an Instant you can afford, a short "Respond?" window pops up (about 5 seconds; owner setting). Tap an Instant to cast it before the attack or spell resolves, or let the window close. You can also cast Instants freely during your own turn.

**Time bank (online):** each player also has a total time bank of about 10 minutes per match, so a match can't drag on forever. **Sudden death** (to be tuned after playtesting): after a set number of turns, both Commanders lose Health every turn, so skilled players can finish fast while close games still end. Both numbers are owner settings.

**Moving:** 1 space in any of the 8 directions (up, down, left, right, diagonal) onto an empty space. Ultra Rare and Collector characters can move 2. Creatures can't walk through each other.

**Running out of cards:** if your deck is empty when you draw, your Commander takes 1 damage instead, and 1 more each turn after.

## Combat

Attacks subtract Attack from Health; a creature at 0 Health is defeated. Every creature can attack in any direction: up, down, left, right or diagonal.

**Fights are simultaneous:** in melee, both creatures hit each other at the same time, so a defender strikes back even if the hit defeats it. A ⚔️1 ❤️2 beats a ⚔️1 ❤️1 and survives; two ⚔️1 ❤️1 creatures defeat each other.

- **Melee:** attack an enemy on any of the 8 spaces around you.
- **Ranged:** creatures with the Ranged ability can also hit an enemy (or the enemy Stronghold) exactly 2 spaces away in a straight or diagonal line, if nothing stands in between; they can still attack adjacent enemies in melee. Guard only affects melee attacks.
- **Strike back:** a creature hit in melee always strikes back with its own Attack, at the same moment, even if the hit defeats it. Ranged attacks get no strike back. Type advantage also applies to strike backs.
- **Creatures heal every turn:** a creature's damage lasts until the start of its owner's next turn, then it heals back to full. A ⚔️1 ❤️2 is always a ⚔️1 ❤️2 again on your next turn. Several of your creatures can still team up on one enemy in the same turn, and a creature hurt while attacking stays hurt through the opponent's turn. A damaged creature shows its current Health in red.
- **Commander damage stays:** the Commander never heals by itself; only cards that say so (like Second Wind) restore its Health, never above its starting Health.
- **Shield X:** the next X damage to that creature is blocked; a shield lasts until the start of your next turn.
- **Type advantage:** +1 Attack when Dwarves hit Goblins, Goblins hit Gnomes, or Gnomes hit Dwarves.
- **Attacking the Commander:** a creature next to the enemy Stronghold can attack the Commander, removing Health equal to its Attack. The Commander never strikes back.
- **Defeated creatures** go to the discard pile and lose any upgrades.

**Example:** a Dwarf Shieldbeard (⚔️2 ❤️4) attacks a Goblin Scrapper (⚔️2 ❤️3). Dwarves beat Goblins, so it hits for 3 and the Scrapper is defeated, but it strikes back at the same moment for 2. The Shieldbeard survives at ❤️2 and heals back to ❤️4 at the start of its owner's next turn.

## Upgrades

Upgrades are powerful but expensive, a big decision rather than a routine one. During your Deploy phase, tap one of your creatures on the battlefield, then Upgrade; it doesn't stop the creature from moving or attacking.

| Upgrade | Cost (your faction's resource) | Effect |
| --- | --- | --- |
| Sharpened Weapons | 6 | ⚔️ +1 |
| Heavy Armor | 6 | ❤️ +3 |
| Veteran | 10 | Moves 2 spaces |
| Champion's Crown | 15 | ⚔️ +2 and ❤️ +3 |

- **Limit:** 1 upgrade per creature.
- Upgrades show on the 3D character (a glinting blade, armor plates, a crown) and are lost when it's defeated.
- There are no walls or ballistas in this version.

## Winning and losing

The only way to win is to bring the enemy Commander from 20 Health to 0, which makes them flee the battlefield in a panic. You lose if your Commander is forced to retreat first. Commanders never die.

- Damage to a Commander comes from creatures standing next to their Stronghold and from spells.
- Running out of cards makes your Commander take damage each turn, so long stalemates end.
- You can surrender at any time from the menu.
- Win and loss scenes: the losing Commander makes a ridiculous last-second escape (rocket barrel, puff of steam, escape tunnel) while their Stronghold crumbles with a big comic "KA-BOOM", and the winner gloats.

## Starter card list

These 41 cards set the style and balance; the factory expands them into a Core Set of about 120 cards (about 35 per faction plus spells), giving plenty of variety to collect. Move 2 is reserved for Ultra Rare and Collector characters (and creatures with the Veteran upgrade). In the full set the factory also adds Uncommon cards.

**Goblins (green crystals)**

| Card | Rarity | Role | Cost | ⚔️ | ❤️ | Move | Ability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Goblin Scrounger | Common | Gatherer | 1 | 1 | 2 | 1 | Gathers +2 next to a site you control; Tunnel: can be summoned onto any empty space next to a crystal site |
| Goblin Scrapper | Common | Fighter | 2 | 2 | 3 | 1 | Frenzy: +1 Attack when next to another Goblin |
| Goblin Slinger | Common | Fighter | 2 | 1 | 2 | 1 | Ranged |
| Goblin Bomber | Rare | Fighter | 3 | 2 | 2 | 1 | Ka-boom: when defeated, deals 2 damage to all adjacent enemies |
| Goblin Sneak | Rare | Fighter | 3 | 3 | 2 | 1 | Sneaky: enemies can't strike back at it |
| Wolf Rider | Ultra Rare | Fighter | 4 | 3 | 4 | 2 | Can act the turn it's played |
| Grubnak's Big Boss Troll | Collector | Fighter | 6 | 5 | 6 | 2 | Unique. Rally: all your Goblins get +1 Attack |

**Gnomes (blue crystals)**

| Card | Rarity | Role | Cost | ⚔️ | ❤️ | Move | Ability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gnome Prospector | Common | Gatherer | 1 | 1 | 2 | 1 | Gathers +2 next to a site you control; Tunnel: can be summoned onto any empty space next to a crystal site |
| Gnome Tinker | Common | Fighter | 2 | 1 | 3 | 1 | Fix-it: at the start of your turn, each adjacent ally gets Shield 1 |
| Spark Gnome | Common | Fighter | 2 | 2 | 2 | 1 | Ranged |
| Clockwork Beetle | Rare | Fighter | 3 | 2 | 5 | 1 | Armored: takes 1 less damage from every hit |
| Gnome Illusionist | Rare | Fighter | 3 | 2 | 3 | 1 | Blink: once, swap places with any of your creatures |
| Gyrocopter Ace | Ultra Rare | Fighter | 4 | 3 | 3 | 2 | Flying: moves over other creatures; Ranged |
| The Great Steam Golem | Collector | Fighter | 7 | 5 | 6 | 2 | Unique. Overload: its attack also hits every enemy next to the target for 1 |

**Dwarves (purple crystals)**

| Card | Rarity | Role | Cost | ⚔️ | ❤️ | Move | Ability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dwarf Miner | Common | Gatherer | 1 | 1 | 3 | 1 | Gathers +2 next to a site you control; Tunnel: can be summoned onto any empty space next to a crystal site |
| Shieldbeard | Common | Fighter | 2 | 2 | 4 | 1 | Guard: adjacent enemies must attack it first |
| Axe Thrower | Common | Fighter | 2 | 2 | 3 | 1 | Ranged |
| Ironhammer Berserker | Rare | Fighter | 3 | 3 | 4 | 1 | Rage: +2 Attack while below half Health |
| Brewmaster | Rare | Fighter | 3 | 2 | 4 | 1 | Hearty Ale: at the start of your turn, each adjacent ally gets +1 Health until your next turn |
| Ram Rider | Ultra Rare | Fighter | 5 | 4 | 5 | 2 | Charge: can move and attack in the same turn |
| Queen Brunhilda Stonebeard | Collector | Fighter | 7 | 5 | 6 | 2 | Unique. Unbreakable: never takes more than 3 damage from one hit |

**Commander spells** (cast from your Stronghold; cost soul crystals of any color)

| Card | Rarity | Type | Cost (soul crystals) | Effect |
| --- | --- | --- | --- | --- |
| Prospector's Prayer | Common | Regular | 4 | Can only be cast if you control fewer sites than the enemy: gain 7 crystals of your faction's color (a net gain of 3) |
| Tunnel Rush | Uncommon | Regular | 4 | Move one of your creatures to any empty space next to a crystal site; it can still attack this turn |
| Fireball | Rare | Regular | 5 | 3 damage to one creature or the enemy Commander |
| Battle Cry | Rare | Regular | 7 | All your creatures get +1 Attack this turn |
| Meteor Strike | Ultra Rare | Regular | 12 | 2 damage to every creature in a 3 × 3 area |
| Healing Light | Common | Instant | 4 | Heal one of your creatures by 3 right now (useful during the enemy's turn, before your creatures heal) |
| Shield Bubble | Uncommon | Instant | 5 | Your creature takes no damage from the next hit this turn |
| Second Wind | Ultra Rare | Instant | 9 | Your Commander heals 4 |
| Fizzle | Uncommon | Counterspell | 5 | Cancel an enemy spell that costs 5 or less |
| Hold It! | Rare | Counterspell | 6 | Cancel an enemy creature as it's summoned; the card goes back to their hand |
| Spell Snap | Rare | Counterspell | 8 | Cancel any enemy spell |
| Mirror Hex | Ultra Rare | Counterspell | 11 | Cancel an enemy spell, then cast a free copy of it yourself |

**Crystal cards** (free to play; one per turn; at most 10 per deck)

| Card | Rarity | Effect |
| --- | --- | --- |
| Soul Shard | Common | Gain 1 crystal of your faction's color |
| Crystal Cluster | Uncommon | Gain 2 crystals of your faction's color |
| Glowing Geode | Rare | Place a small crystal beside your Stronghold: +1 crystal at the start of each of your turns for the rest of the match (Unique) |
| Heart of the Fallen | Ultra Rare | Gain 4 crystals of any colors you choose |
| Motherlode | Collector | Gain 3 crystals now, and your next creature this turn costs 2 less |

**Crystal Eaters** are creatures that let you break the one-per-turn rule: while one is on your battlefield, you may play extra Crystal cards in the same turn, but every extra card costs that creature something. The 10-per-deck limit still applies.

| Card | Faction | Rarity | Role | Cost | ⚔️ | ❤️ | Move | Ability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shard Guzzler | Goblins | Uncommon | Gatherer | 2 | 1 | 4 | 1 | Crystal Eater: each extra Crystal card you play this turn deals 2 damage to it |
| Overclocked Conduit | Gnomes | Rare | Gatherer | 3 | 1 | 4 | 1 | Crystal Eater: each extra Crystal card you play this turn means it can't move or attack until your next turn, and it takes 1 damage |
| Crystal-Drunk Delver | Dwarves | Rare | Gatherer | 3 | 2 | 5 | 1 | Crystal Eater: each extra Crystal card you play this turn gives it -1 Attack for the rest of the match |

If a Crystal Eater is defeated by its own drawback, its Commander gasps dramatically.

Spells are deliberately expensive: they're powerful Commander magic, so you have to hold enough sites to afford them. Counterspells are Instants that cancel what the opponent is doing as they do it, using the "Respond?" window. A countered spell or creature still costs its owner the crystals.

## Collection, rarity and screens

New players start with basic cards and some booster packs; better cards come from opening packs, and the best are rare. Rarity settings live in a file only the game's owner can change.

**Collection**

- **Starting collection:** a basic starter deck for each faction (Commons only) plus 5 free booster packs, opened right after the tutorial.
- **Gold:** earned by winning (Easy 10, Normal 20, Hard 35; half for a loss). No gold for matches that end before turn 5, except for the winner when the opponent surrenders; this stops gold farming, and the owner can change the turn number. Can also be bought with real money (later phase). Spent on booster packs and cosmetics.
- **Booster pack:** 50 gold for 12 random cards with a card-flip opening animation; rarer cards get a bigger, flashier reveal.
- **Deck builder:** save up to 5 decks; filter the collection by faction, rarity, role and cost.

**Owner-controlled rarity (back files, not in the game):** all rarity numbers live in one settings file in the code, for example `game-config.json`. Players can never see or change it. It holds:

- what each pack contains (starting values: 12 cards = 6 Common, 3 Uncommon, 3 Rare; about 1 Ultra Rare every 2–3 packs and 1 Collector card about every 20 packs, each replacing a Common, all random);
- how many cards per pack, and the pack price;
- which rarity each card is;
- gold rewards per win.

Once online play exists, the owner changes these in the Owner Console; until then, they're edited in the settings file.

**Computer opponent:** Easy (for kids; obvious moves, some mistakes), Normal (fights for sites sensibly), Hard (protects Gatherers, focuses fire, times spells well).

**Helper features:** selecting a creature makes its move and attack spaces glow; an optional hint button and undo for the last move (single-player only; online matches have no hints or undo).

**Screens:** Main menu, Play (pick Commander, deck and difficulty), Collection, Deck Builder, Shop (packs), Tutorial (a guided match), Rules (how to play, with pictures), Settings (sound, music, reset progress).

**Tutorial match:** offered the first time the game starts, and any time from the Tutorial button. A short, fixed match against a harmless opponent (same Commander and cards every time, no timers) where pop-up tips walk you through each step in order: summon a troop on your back row, march it forward, take a crystal site and watch it change color, spend crystals, fight an enemy (simultaneous hits, healing next turn), cast a spell, and finally attack the enemy Commander until they retreat. Each tip waits until you've done the step. It can be skipped and replayed.

## Built to grow: expansions, seasons and leagues

All of this is controlled only by the game's owner in the back-office files; players never add, edit or choose content, they only play what the owner has released. The game must be built so new content is added by editing data files, not by rebuilding the game's engine, which keeps future expansions quick and cheap.

- **Everything is data:** factions, crystal colors, Commanders, cards, abilities, packs and rarity all live in content files (one file per expansion). Adding a faction means adding its entry, its crystal color, its Commanders and its cards.
- **Expansion sets:** each expansion has a name, a symbol shown on its cards, its own booster pack design, and its own rarity settings. The owner decides when each expansion is released and which packs the Shop sells; players only see what's live. The first set is the Core Set.
- **New factions later:** the battlefield and crystal sites work with any number of faction colors (for example orcs in red, elves in gold).
- **Seasons:** the owner starts and ends each season (about 2–3 months) in the settings file; a season has a theme, a featured expansion, a season reward track (win matches to earn gold, packs and cosmetic items), and a special Commander you can earn.
- **Leagues (needs online play):** ranked leagues against real players (using the crystal ranks below) need the online "back-office" upgrade: accounts, a server and matchmaking. Version 1 includes a single-player Gauntlet: a ladder of increasingly tough computer Commanders with ranks and rewards.
- **Saved progress carries over:** collections, decks and unlocked Commanders stay when new content arrives.

## Accounts, player vs player and money

Oreheart is planned as an online player-vs-player game with cloud accounts and real-money booster packs, but it must never be pay-to-win. It's built in phases so each part can be tested before the next.

- **Server-ready rules:** all game rules live in one rules engine that can run on a server, so the server decides every move in online matches and nobody can cheat by hacking their phone.
- **Cloud accounts:** sign in once and your collection, decks, Commanders, gold, shards and progress are saved online and follow you to any phone.
- **Player vs player:** online matches against real people, with matchmaking by skill, then ranked leagues and seasons.
- **Real-money packs, not pay-to-win:**
  - every card can be earned for free by playing (gold, daily quests, season rewards);
  - paying only speeds up collecting; it never sells cards or power that free players can't get;
  - pack odds are shown to players in the Shop, as app stores and some countries require.
- **Duplicates and shards:** duplicate cards can be broken down into shards; shards buy more booster packs. Shard values per rarity live in the owner's settings file.
- **Later: card trading** between players, run entirely by the server (both players confirm, the server moves the cards) with anti-cheat checks and limits. Not in the first versions.

**Build phases:**

1. Single-player game vs computer, with the server-ready rules engine (first factory build).
2. Art and audio upgrade.
3. Cloud accounts and cloud saving.
4. Online player vs player, then leagues and seasons.
5. Real-money gold (packaged as a Google Play app with Google Play billing), after a legal check.
6. Card trading.

## Performance, effects and accessibility

- **Over-the-top effects:** lots of particles, glows, sparkles, light beams, screen shake and comic text bursts.
- **Target phones:** looks best on higher-end Android phones and must still run smoothly on a mid-range one.
- **Graphics setting:** High / Medium / Low in Settings; Low cuts particles and shadows.
- **Colorblind mode:** players can pick their own colors for each faction; it changes only their own screen. Each faction also has a symbol (Goblin skull, Gnome gear, Dwarf hammer) on cards, crystals and sites so color is never the only clue.

## Cosmetics, daily quests and taunts

Players collect show-off versions of cards and skins that look amazing but never change power, earn currency from daily quests, and can taunt their opponent with one tap.

**Currencies** (amounts and prices live in the owner's settings file):

| Currency | How you get it | What it buys |
| --- | --- | --- |
| Gold | Winning matches, daily quests, season rewards, or bought with real money | Booster packs, golden and animated cards, Commander skins, card backs |
| Shards | Breaking down duplicate cards and Commanders | Booster packs |

Gold is the only shop currency, so there's no confusion with the crystals gathered during a match.

**Golden and animated cards:** same stats as the normal card, made to show off.

- **Golden:** shiny gold frame and a shimmer sweep across the card.
- **Animated:** the art moves (flames flicker, crystals pulse, the character idles), with extra particles when played.
- They can drop rarely in packs (chance set in the settings file) or be bought with gold.

**Skins:** alternate looks for Commanders and creatures (for example a pirate Grubnak), plus card backs and Stronghold styles. Cosmetic only.

**Daily quests:** 3 new quests every day, each paying gold. Examples: "Win 2 matches with Goblins", "Defeat 10 creatures", "Control all 3 crystal sites at once". Unfinished quests stay for up to 3 days, and players can swap one quest per day.

**Taunts:** tap your Commander and a radial menu pops up with 6 taunts, for example a dramatic laugh, a flex, a slow clap, a "You dare?!", a dance and a thumbs-up. The Commander acts it out with a speech bubble. Taunts have a short cooldown so they can't be spammed, and any player can mute the opponent's taunts. Extra taunts can be earned or bought.

## Online play, ranks and safety

Online Oreheart has ranked and friendly matches, a crystal ranking ladder that keeps beginners away from veterans, and no text chat at all.

- **Ranked play:** matches against players of similar skill; winning raises your rank, losing lowers it.
- **Friendly matches:** challenge friends and family directly, outside ranked play; no rank changes.
- **Leaderboards:** top players overall, per season and among your friends.
- **Crystal ranks**, from dull to dazzling, each with 3 steps (III, II, I):

| Rank | Crystal |
| --- | --- |
| 1 | Dull Stone (cloudy gray) |
| 2 | White Crystal |
| 3 | Yellow Crystal |
| 4 | Red Crystal |
| 5 | Blue Crystal |
| 6 | Purple Crystal (top rank, the flashiest) |

- **Fair matchmaking:** a hidden skill rating pairs players of similar ability; brand-new players face other beginners or friendly bots for their first matches.
- **No text chat:** players communicate only through taunts and emotes.
- **Usernames** pass a bad-word filter; the owner edits the list of blocked words in the Owner Console. Players can block and report others.
- **Disconnects:** a disconnected player has 60 seconds to reconnect before losing the match.
- **Phone notifications:** "Your daily quests are ready!" and "A friend challenged you!"; players can turn them off.
- **Other game modes later**, for example a casual mode or special event rules, switched on by the owner.

## Owner Console

A simple, private admin website for the owner. No coding: everything is buttons, switches, sliders and text boxes, with a confirmation before anything goes live.

- **Packs and rarity:** each card's rarity (for example moving a card from Common to Rare), copy limits and the Unique mark; odds per rarity, chance of golden and animated cards, Commander drop chance, cards per pack, pack prices.
- **Economy:** gold and shard rewards, real-money gold bundle prices, daily quest rewards.
- **Timers:** length of each turn phase and the burning-rope warning.
- **Safety:** the blocked-words list for usernames; view reports and ban players.
- **Seasons and releases:** start and end seasons, choose the featured expansion, release expansions to the Shop.
- **Patch notes:** write balance notes that players see in the game.
- **Stats:** players today, this week and this month; revenue; most-played cards; win rate per card, Commander and faction.
- **Notifications:** send an announcement to all players.
- **Not in the console:** new cards and rules changes, which go through the factory.

**Before public launch (later):** privacy policy, terms of service, support email, age and parental-consent rules for young players, app store listing, and a friends-and-family beta test.

**Open questions**

- [ ] Sudden death: after how many turns, and how much damage per turn.
- [ ] Story campaign: version 1 or later?
- [ ] Sound and music style (decided with the art phase).

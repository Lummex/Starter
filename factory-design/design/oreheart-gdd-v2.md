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

Everything is 3D in a comic-book style, beautiful and polished, in the style of the mockup image, but in landscape (phone held sideways). The battlefield fills the **whole screen, edge to edge, with no black bars**, viewed at an angle like a tabletop and zoomed as large as possible so the game works on small phones. The enemy's Stronghold sits right at the top edge; yours sits at the bottom, just behind your hand cards and still visible. Everything else floats over the battlefield: your hand of large, readable cards fanned along the bottom (they slide down out of the way while you drag a card or creature), the enemy's card backs along the top, your crystal counters (with an income preview such as "+3 next turn") on the left, the phase name and Done button on the right, and each player's deck pile on their own right-hand side at full hand-card size (yours bottom-right, the enemy's top-left as seen from your side, with the enemy's card backs shifted right to make room). Each Commander's Health is a big glowing heart attached to their own Stronghold wall facing you (on the back wall of your Stronghold, on the front wall of the enemy's), never floating over a battlefield space; it shakes and pops red numbers when hit. Creature stat badges (Attack, Health, Movement) are always drawn on top of everything else on the battlefield, and a heart shrinks or slides along its wall rather than ever covering them. The current turn and phase are shown in the top-right corner as large, fancy comic-style text with a thick outline and soft glow, no box ("YOUR TURN / Deploy", "ENEMY TURN" in a different color).

- **Phase banners:** at the start of each turn and phase, a big comic-style banner pops up in the center ("YOUR TURN", "DEPLOY", "ACTION", "ENEMY TURN") for about 1.5 seconds, then fades. Phases skipped automatically show no banner; the turn and phase also stay shown in the top-right corner.
- **Creatures show their numbers:** every creature shows ⚔️ Attack, ❤️ Health and 👟 Movement in one **compact** pill tucked right under its feet, just above its ring (same readable number size, tight spacing, about half the old width).
- **Weapons show the type:** every 3D creature holds a big, comic-style weapon readable on a small phone: Miners a **mining pick**; Smith Miners a pick plus a smithing hammer (anvil on the back); Crystal Eaters a pick and a glowing crystal chunk; melee Fighters a **sword** in their faction's style (jagged cleaver-sword for Goblins, rune-blade for Gnomes, broadsword for Dwarves); Ranged creatures their ranged weapon (sling for Goblins, spark wand for Gnomes, crossbow or throwing axes for Dwarves); Guard creatures a sword and a big shield; riders and Charge creatures a lance on their mount; Flying creatures their gyro-machine; Collector creatures an oversized signature weapon.
- **Ready or done:** each creature stands on a ring. **Yellow** = it can still act this turn. Once it has moved, attacked or mined (or if it can't act yet because it was just summoned), the ring turns **dark grey** and the creature turns darker and duller (not grey); both reset at the start of its owner's turn. Miners summoned this turn stay bright, since they can still move or mine.
- **Hand tucked away:** your hand normally sits **half below the bottom edge** of the screen (only the top half of each card, with name and cost, shows), leaving the battlefield clear. Moving the mouse anywhere over the hand slides the whole fan up to full view; moving away tucks it back. On a phone, tap the hand strip to slide it up; you can also drag a card straight out of the tucked hand.
- **Hand cards pop out:** once the hand is up, the card under the mouse (or touched and held on a phone) pops up out of the fan, well above the others, and **doubles in size**, in front of everything, so its full text is easy to read; a card near a screen edge grows inward so it's never cut off. It shrinks back into the fan when you move off.
- **Short card text, tap for more:** each card prints a short, simple version of its ability that is still understandable on its own (for example "Ranged. Enemies can't strike back."), never cut off. Tapping the text on an enlarged or popped-up card opens a floating deeper explanation: the full rules, every keyword explained, when it can be played (Deploy, any time, as a response), what it counts as (role, faction, rarity, Unique), limits and a short example. Creatures on the battlefield show a small ability icon; tap a creature to see its card.
- **Card reveal:** whenever either player plays a card, it flies to the **center of the screen** and stays there, big, for about 1.5 seconds so both players can read it. Then a creature card drops onto its space and flips, glows and rises into the 3D creature; a spell turns into its effect; a Crystal card flies into the Bank crystal; a Miner upgrade flies onto its creature and sparkles gold. When the enemy plays something you can respond to, the reveal flows straight into the Respond pop-up. Settings: Card reveals Normal (1.5 s) or Fast (0.6 s); tap a reveal to skip it.
- **Spell effects:** every spell has its own visual. Searing Arcane Orb: a blazing arcane ball arcs from the caster's Stronghold, then a KA-BOOM burst. Starfall Cataclysm: a meteor crashes down with screen shake over the 3 × 3 area. Ironclad Bulwark: a clanking steel shield device unfolds over the creature. Field Bandage: bandages wrap the creature with a soft glow. Thunderhorn Blast: a huge steam war horn blasts and your creatures glow red. Emergency Repairs: gears and wrenches patch the Stronghold. Venom Shiv: a dagger flies in and the target turns sickly green with dripping poison bubbles. Rat-Tunnel Ambush: rats burrow and the creature pops out of a hole. Pickpocket!: a goblin hand snatches the summoned card away. Counterspells: the countered card shatters like glass with a burst. A comic callout appears over the caster's Stronghold, for example "SPROINGLE CASTS SEARING ARCANE ORB!". Commanders never attack; they only cast spells.
- **Ranged is easy to spot:** Ranged cards show a 🏹 icon next to Attack (and the word Ranged in the ability text); Ranged 3D figures carry a visible ranged weapon (sling, throwing axes, spark wand, crossbow) and show the 🏹 icon in their stats.
- **Pop-ups never pile up:** the "Are you sure?" pop-up sits on top, then the countdown, then phase banners (a banner waits until nothing else is showing).

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

Under the painted ground is an invisible grid **13 spaces wide and 7 deep**. Players never see the grid; when you select a creature, the spaces it can move to (blue), attack (red) or mine (a pickaxe glow on the mine) light up softly.

- **Rows 1–2 (far side):** enemy home rows. The enemy summons on row 1, its back row (row 2 only when row 1 is full). The enemy Stronghold, with its Commander, stands on row 1 in **column 12** (one empty space, column 13, beside it on the enemy's far right as you see it).
- **Rows 3–5:** the middle of the battlefield, where the **3 mines** are placed at random at the start of every match. Mines can't be stood on.
- **Rows 6–7 (near side):** your home rows. You summon on row 7, your back row (row 6 only when row 7 is full), so new minions always have to march forward. Your Stronghold stands on row 7 in **column 2** (one empty space, column 1, beside it on your left). The two Strongholds sit in opposite corners, so seen from your side your Commander is at the bottom-left and the enemy's at the top-right.
- **Random but fair mines:** the layout is always mirrored corner-to-corner between the two halves (a mine at row 3, column c always has a twin at row 5, column 14 − c; on row 4, column c pairs with column 14 − c), so both sides are equally close to the same mines: either one mine at the exact center (row 4, column 7) plus a mirrored pair on rows 3 and 5, or all three on row 4 (the center plus a mirrored pair). Mines are never in the home rows, never next to each other (at least 2 spaces apart) and never next to a Stronghold. The layout comes from the match's shuffle seed; the tutorial uses a fixed layout.
- **Spaces around a mine:** only the 8 spaces touching a mine count as being at it.
- **Attacking a Stronghold:** a creature must stand on a space next to the enemy Stronghold to attack the Commander inside (Ranged creatures can also hit it from 2 spaces away).

```
Board: invisible 13 x 7 grid (enemy at the far side, you at the near side) - one example mine layout
   col: 1 2 3 4 5 6 7 8 9 0 1 2 3
row 1:  b b b b b b b b b b b S b   <- enemy Stronghold + Commander (column 12); b = enemy back row
row 2:  . . . . . . . . . . . . .   <- enemy summons here only when row 1 is full
row 3:  . . . M . . . . . . . . .   <- M = mine (corner-mirrored pair: row 3 col 4 and row 5 col 10)
row 4:  . . . . . . M . . . . . .   <- one mine at the exact center
row 5:  . . . . . . . . . M . . .
row 6:  . . . . . . . . . . . . .   <- you summon here only when row 7 is full
row 7:  b S b b b b b b b b b b b   <- your Stronghold + Commander (column 2); b = your back row
```

The drawing shows the invisible spaces; in the game the ground is painted. Each mine's crystals glow in the color of the side with more creatures mining it (white on a tie or when nobody mines it).

## Crystals and site control: Crystal Flow

The only resource is **soul crystal** (crystal for short): one kind, shown in your faction's color (green for Goblins, blue for Gnomes, purple for Dwarves; in a mixed deck, your Commander's). Crystals come from **Crystal Flow**: your creatures **mine** at the three mines, and what they mine arrives at the start of your next turn.

- **Mining is an action:** in the Action phase, drag a creature that stands on one of the 8 spaces around a mine onto that mine. That is its action for the turn (instead of moving or attacking), and it shows a little pickaxe icon until your next turn. A creature between two mines mines the one you drag it onto.
- **You mine every turn:** a creature only makes crystals on turns when it spends its action mining. Each mining action makes **2 crystals for a Miner** and **1 for a Fighter**.
- **The pool resets, it doesn't stack:** at the start of your turn, your crystal pool is set to what your creatures mined on your previous turn. Crystals you don't spend stay available through the enemy's turn (for Instants and counterspells), and are replaced at the start of your next turn.
- **Cap:** your Flow can never go above **16** crystals. Owner setting.
- **Crystal Bank:** crystals from **Crystal cards** go into your **Bank**, which never resets and has no limit: Bank crystals stay until you spend them. The game always spends Flow first (it would vanish anyway) and Bank second. The top-left corner shows just two counters in your faction's color: a glowing **Flow** crystal ⛏️ and a **Bank** crystal with a little vault 🏦, each with its number. Flow and Bank are both usable on your turn and during the enemy's turn.
- **Savings:** when you end your own turn with **10 or more** unspent Flow, **1 crystal for every 10** moves from your Flow into your Bank (10–15 Flow saves 1; 16 saves 1), with a little "+1 banked" animation flying into the vault. Banked crystals are still usable during the enemy's turn, so nothing is lost. The amount (10) is an owner setting.
- **Mine color:** at the start of each turn, the player with **more creatures mining it** owns it, and it glows in that player's color (creatures that mined it on their owner's last turn and are still standing next to it; creatures merely standing nearby don't count). On a tie, or when nobody mines it, the mine is **neutral** (white). When a mine changes color, its crystals burst and regrow in the new color, with sparkles and light beams.
- **What a mining action pays:** at a mine your side owns, or a neutral one, a mining action pays the full amount (Miner 2, Fighter 1). At a mine the **enemy** owns, it pays **half**, rounded down (Miner 1, Fighter 0). Example: you have 1 Miner and the enemy has 2 Miners mining a mine, so the enemy owns it: the enemy gets 4, you get 1.
- **Paying:** every card simply costs soul crystals; there are no color requirements. The game spends Flow first, then Bank, and cards you can afford glow in your hand.
- **Tap a mine to mine:** in your Action phase, tapping a mine makes **every one of your ready Miners next to it** (basic, Smith or Crystal Eater) mine it at once; creatures that already moved, attacked or mined are skipped, and Fighters are never included (drag a Fighter onto the mine to mine with it). A mine where you have ready Miners shows a **big pickaxe** above it (about the size of a creature's head, easy to see on a small phone) that **keeps swinging down like it's striking rock**, with a little spark flash on each hit, plus the number of ready Miners ("×3"); it disappears once they've mined. This replaces the old soft pulse. **Press and hold** a mine (or hover with a mouse) to see who owns it and what it pays. There is no Mine All button.
- **Starting crystals:** 0. Turn 1 is always "send out a Miner" (see Free Miner below).
- **Income preview:** next to your crystal counters you always see next turn's Flow; each mine shows a ring in its owner's color and floating numbers for both sides (for example "+4 / +1"); press and hold a mine for its details.
- **Endless mines:** mines never run out. Long games are ended by deck-out damage and sudden death instead.
- **Card costs:** creatures cost 1–13 (see Cards for the formula); spells cost 1–7.
- **Look:** big, glossy, glowing gems with bright neon-saturated colors, light rays and floating sparkles.

**Spread out or stack up.** Deciding where to send your minions is the core strategy: Miners at every mine for a little of everything, or a crowd at one mine to own its color. Owning a mine doubles what your miners there make compared with mining at an enemy-owned one, and every turn each creature must choose: mine, move or fight.

**Never locked out.** A player who loses every mine early always has ways back in:

- **Underdog bonus:** if you own no mine at the start of your turn **and the enemy owns at least one**, you get +2 crystals that turn. It never applies while nobody holds a site, so it doesn't speed up the opening.
- **Miner swap:** once per turn, during your Deploy phase, if you have no Miner in your hand you can discard a card (or none, if your hand is empty) to take your cheapest basic Miner from your deck into your hand, for free. Crystal Eaters don't count as basic Miners.
- **Free Miner when broke:** if your Flow plus Bank can't pay for a basic Miner and you have no Miner on the battlefield, you can summon one basic Miner for free that turn.
- **Tunnelers:** each faction's basic Miner has the Tunnel ability (Smith Miners don't); it only works as a comeback, and otherwise every Miner is summoned on your back row like any creature: when the enemy owns more mines than you, they can be summoned straight onto any empty space next to a crystal site instead of your back row.
- **Comeback spells:** cheap spells built to break a lockout (see Desperate Plunder and Burrow Ambush in the spell list).
- **Ties neutralize a mine:** one creature sneaking in to tie the count turns the mine white, halving the enemy's income from it.

## Factions

Three factions, each with its own color: Goblins green, Gnomes blue, Dwarves purple. All cards cost the same soul crystals, so decks can mix factions freely.

|  | Goblins | Gnomes | Dwarves |
| --- | --- | --- | --- |
| Color | Green | Blue | Purple |
| Personality | Scrappy, sneaky, backstabbing poisoners | Clever, magical spellcasters | Tough, proud miners and mechanical engineers |
| Playstyle | Cheap swarms, explosions, poison and tricks | Magic, fireballs, counter-magic, ranged sparks | Big health, heavy hits, war machines, holding ground |
| Strength | Numbers and speed of play | Support and surprises | Hard to kill |
| Weakness | Fragile | Weak in close combat | Expensive |
| Commander | Grubnak Rotgut, King of the Junkpile | Archmagister Sproingle the Unfathomable | Thane Borgo Gravelgrim |

**Two kinds of creature in every faction:**

- **Miners:** strong at mining (2 crystals per mining action), no summoning sickness, weak in a fight.
- **Fighters:** strong in a fight; only 1 crystal per mining action.

**Type advantage:** +1 Attack when Dwarves hit Goblins, Goblins hit Gnomes, or Gnomes hit Dwarves.

## Commanders

You pick your Commander before each match. Each faction has one starter Commander and more to unlock, and every Commander has one special ability that's always on. Commanders have 20 Health unless their ability says otherwise.

- **Unlocking:** extra Commanders come as very rare Commander cards in booster packs (their drop chance is in the owner's rarity settings file). Duplicate Commanders turn into shards, like duplicate cards.
- **Choosing:** a Commander screen shows all Commanders, locked ones as dark silhouettes. There's no separate faction choice: your faction comes from the Commander you pick and the cards in your deck. Your Commander appears in your Stronghold, and has its own emotes and voice lines.

| Commander | Faction | How you get it | Special ability |
| --- | --- | --- | --- |
| Grubnak Rotgut, King of the Junkpile | Goblins | Starter | Goblin creatures cost 1 less crystal (minimum 1) |
| Queen Skreeka, Hoarder of Shinies | Goblins | Booster pack | Gain 1 crystal whenever one of your creatures is defeated (Flow cap still applies) |
| Archmagister Sproingle the Unfathomable | Gnomes | Starter | Your spells cost 1 less crystal (minimum 1) |
| Madame Sprocket, Mistress of Gears | Gnomes | Booster pack | At the start of your turn, your creature with the lowest Health gets Shield 1 |
| Thane Borgo Gravelgrim | Dwarves | Starter | Your creatures get +1 Health |
| Grumblebeard the Unkillable | Dwarves | Booster pack | Your Commander starts with 25 Health instead of 20 |

The factory adds more unlockable Commanders over time in the same style.

## Cards

A creature card shows its cost, Attack, Health, movement and one special ability. Numbers stay low so the math is easy.

- **Cost** (top-left, in the faction's crystals): Attack + Health, +1 for a small ability (Ranged, Guard, Frenzy, Armored and the like) and +2 for a big one (Flying, Charge, moving 2, acting the turn it's played, Collector powers). A 1/1 costs 1. Gathering and drawbacks add nothing. Example: a 2/2 costs 4, a 2/3 costs 5, a 3/4 costs 7.
- **⚔️ Attack** and **❤️ Health:** Attack 1–5, Health 2–6 (printed on the card; upgrades and abilities can raise it).
- **Movement:** 1 space per turn; Ultra Rare and Collector characters can move 2.
- **Role:** every card shows its role: **Miner** (⛏️ pickaxe badge, and the word Miner in the name of basic Miners), **Smith Miner** (⚒️ hammer-and-pickaxe badge and a gold "SMITH" banner) or **Fighter** (⚔️ sword badge). On the battlefield, Miners carry a big pickaxe and Smith Miners also a smithing hammer with a little anvil on their back; both show a ⛏️ icon in their floating stats.
- **Special ability:** every creature has one, in one short line.

**Card types:**

1. **Creatures:** played onto the battlefield, where they become 3D characters.
2. **Spells:** cast by your Commander, who launches them from the Stronghold (a fireball arcs out of his hands, a shield of light drops over a creature). Regular spells can be cast in any phase of your own turn. Instant spells (marked with a lightning bolt) can be cast at any time, even during the opponent's turn, for example to save a creature as it's attacked. Counterspells are Instants that cancel an enemy spell or summon as it happens.
3. **Crystal cards:** free to play, they put bonus soul crystals into your **Bank** (see Crystal Flow), where they stay until spent. They work at Instant speed: play them in your Deploy phase or during the enemy's turn in the Respond window, and the crystals are usable immediately. Playing a Crystal card never ends your turn or phase. You can play only one Crystal card between the start of your turn and the start of your next one, unless a Crystal Eater creature lets you play more, at a price.

**Rarity** (a gem on the card): Common (gray), Uncommon (bronze), Rare (silver), Ultra Rare (gold), Collector (shimmering rainbow prism). The best cards are the hardest to get.

**Deck rules:** **50 to 100 cards** (owner settings: minimum 50, maximum 100). Common and Uncommon cards have no copy limit; Rare, Ultra Rare and Collector cards are limited to 3 copies each. Especially powerful cards are marked Unique: you can have only one of that card on your battlefield at a time (extra copies wait in your hand). A deck can hold at most **20 Crystal cards** in total, whatever their rarity (owner setting).

**Starter decks** (three per faction, nine in total, **100 cards each**), named per faction (for example "Goblin Warband"). Every starter deck has **50 Miners: 30 of the faction's basic Miner and 20 of its Smith Miner**; the other 50 cards depend on the style (spells are that faction's own plus the shared ones):
- **Warband** (balanced): 38 Fighters, 7 spells (including counterspells) and 5 Crystal cards.
- **Arcane Hoard** (spells): 18 Fighters, 24 spells (including counterspells) and 8 Crystal cards.
- **The Horde** (no spells): 46 Fighters, no spells and 4 Crystal cards.

The computer opponent picks among them for variety. Fighters are mostly Commons, with plenty of cheap creatures so there's always something to play; the owner can change the mix in the settings file. The owner can change copy limits, the Crystal card limit and the Unique mark per card to balance the game. Before a match you pick your Commander and your deck.

## Turns and phases

Every turn runs through the same phases, each with a 50-second timer. For the first 40 seconds no timer is shown; then a big 10-to-0 countdown pops up in the center of the screen, and at 0 the game moves to the next phase (not the end of the whole turn). Both numbers are owner settings. The tutorial has no timer.

**Setup:** pick your Commander and deck. The deck is shuffled and you draw 5 cards. You may mulligan up to **3 times**: shuffle back any cards you don't want and redraw. The first mulligan is free; each later one gives you **1 card fewer** (so your opening hand can go 5 → 5 → 4 → 3). The cards are shown as real card images in one straight row; tap the ones to swap. A coin flip decides who goes first; the first player skips their first draw, and the second player draws 1 extra card.

**Luck:** you draw one card at a time from a shuffled deck, so you never know exactly what's coming. Booster packs add luck to your collection. There is no other randomness.

**The phases of a turn:**

1. **Draw phase** (automatic): all your creatures heal back to full Health, you draw 1 card (no hand limit), mine colors update, and your crystal pool resets to your Crystal Flow.
2. **Deploy phase** (timed): drag creature cards onto empty spaces in your back row, play Crystal cards and Smith upgrades, and cast spells (Regular spells work in any phase of your turn, Instants at any time). If your back row is full, you can summon onto the row in front of it; if both are full, the card waits in your hand.
3. **Action phase** (timed): each of your creatures does **one** thing: **move, attack or mine**. Drag it to an empty space to move, onto an enemy (or the enemy Stronghold) to attack, or onto a mine next to it to mine. Creatures placed this turn can't act unless their ability says so; **Miners have no summoning sickness**: they can move or mine (but not attack) the turn they're placed.
4. **End phase** (automatic): end-of-turn abilities happen, then it's the other player's turn.

You can tap a "Done" button to finish a phase early. If you still have something you could do, a center pop-up asks "Moves still available! Continue to the next phase?" with Continue and Go back, and names creatures that could still mine (for example "2 miners haven't mined"), since skipping mining costs crystals next turn. It can be turned off in Settings, and never appears when the timer runs out.

**Auto-skip:** if you have nothing you can do in a phase, the game moves on by itself after about half a second, with no click and no confirmation. In the Deploy phase that means no card you can both afford and place; **Spells, Instants, counterspells and Crystal cards never count as moves left**, even when you can afford them (so a hand of only spells still auto-skips); the Miner swap and cards with no legal space don't hold it up either. In the Action phase it means no creature can move, attack or mine. The "Moves still available" pop-up only appears when you press Done while you really could still play a creature card, move, attack or mine (never just because of spells). Auto-skip pauses during tutorial steps that wait for you.

**Responding with Instants:** when the opponent attacks one of your creatures or casts a spell or summons, and you hold a matching Instant or counterspell, a "Respond?" pop-up appears in the center for **12 seconds** (owner setting) with a visible shrinking countdown bar, and the game waits while it's open. It shows the enemy's card full size ("Enemy casts Infernal Orb at your Ironwall Shieldbeard") and the Instants and counterspells you can actually play right now. If one is only affordable together with a Crystal card from your hand, it offers both in one tap ("Soul Cluster + Snuff Out"). **The pop-up only appears when you can really play something** (affordable, counting a Crystal card in hand, and legal for this moment); otherwise there is no pop-up and no waiting at all. Tap one to cast it before the attack or spell resolves, or let the window close. You can also cast Instants freely during your own turn.

**Time bank (online):** each player also has a total time bank of about 10 minutes per match, so a match can't drag on forever. **Sudden death** (to be tuned after playtesting): after a set number of turns, both Commanders lose Health every turn, so skilled players can finish fast while close games still end. Both numbers are owner settings.

**Moving:** 1 space in any of the 8 directions (up, down, left, right, diagonal) onto an empty space. Ultra Rare and Collector characters can move 2. Creatures can't walk through each other.

**Swapping places:** instead of moving into an empty space, you can drag a creature onto one of **your own** creatures within its move range: they trade places. Only the dragged creature uses its action; the other one can still act. You can never swap with an enemy. Ally spaces you can swap with glow in a different color from empty spaces. (The Mirrorveil Illusionist's Blink is still special: it swaps with any of your creatures anywhere.)

**Running out of cards:** if your deck is empty when you draw, your Commander takes 1 damage instead, and 1 more each turn after.

## Combat

Attacks subtract Attack from Health; a creature at 0 Health is defeated. Every creature can attack in any direction: up, down, left, right or diagonal.

**Fights are simultaneous:** in melee, both creatures hit each other at the same time, so a defender strikes back even if the hit defeats it. A ⚔️1 ❤️2 beats a ⚔️1 ❤️1 and survives; two ⚔️1 ❤️1 creatures defeat each other.

- **Melee:** attack an enemy on any of the 8 spaces around you.
- **Ranged:** creatures with the Ranged ability can hit any enemy (or the enemy Commander) up to 2 spaces away in any direction, including the in-between angles, even over other creatures; adjacent enemies too. All enemies in range glow when you select it. Guard only affects melee attacks.
- **Strike back:** a creature hit in melee always strikes back with its own Attack, at the same moment, even if the hit defeats it. Ranged attacks get no strike back. Type advantage also applies to strike backs.
- **Creatures heal every turn:** a creature's damage lasts until the start of its owner's next turn, then it heals back to full. A ⚔️1 ❤️2 is always a ⚔️1 ❤️2 again on your next turn. Several of your creatures can still team up on one enemy in the same turn, and a creature hurt while attacking stays hurt through the opponent's turn. A damaged creature shows its current Health in red.
- **Commander damage stays:** the Commander never heals by itself; only cards that say so (like Last Stand) restore its Health, never above its starting Health.
- **Shield X:** the next X damage to that creature is blocked; a shield lasts until the start of your next turn.
- **Type advantage:** +1 Attack when Dwarves hit Goblins, Goblins hit Gnomes, or Gnomes hit Dwarves.
- **Attacking the Commander:** a creature next to the enemy Stronghold can attack the Commander, removing Health equal to its Attack. The Commander never strikes back.
- **Defeated creatures** go to the discard pile and lose any Smith upgrades.
- **Attack preview:** while you drag a creature onto an enemy (or the enemy Stronghold), before you let go, a small comic box shows the result: "You deal 3 / You take 2", with a 💀 over any creature that would be defeated, counting type advantage, Shield, Armored and other abilities. Letting go somewhere else cancels.

**Example:** a Dwarf Ironwall Shieldbeard (⚔️2 ❤️4) attacks a Gutripper Brawler (⚔️2 ❤️3). Dwarves beat Goblins, so it hits for 3 and the Brawler is defeated, but it strikes back at the same moment for 2. The Ironwall Shieldbeard survives at ❤️2 and heals back to ❤️4 at the start of its owner's next turn.

## Miner upgrades

Upgrading is done only by playing **Miner cards from your hand onto your own creatures**; there are no crystal-bought upgrades.

| Miner card played onto one of your creatures | Permanent upgrade |
| --- | --- |
| **Basic Miner** (Grubgrabber, Gemsinger, Stonebreaker) | **+1 Health** |
| **Smith Miner** (Scrapsmith, Arcsmith, Anvilsworn) | **+1 Attack and +1 Health** |

- **Played onto an empty space** in your back row, either card is summoned as a normal Miner instead (no summoning sickness, mines for 2).
- **Played onto one of your own creatures** (any Fighter or Miner, anywhere on the battlefield), it is not summoned: the creature gets the upgrade permanently (it also counts as part of its full Health when it heals) and the Miner card goes to the discard pile.
- You pay the card's normal cost either way. Upgrades stack with **no limit** (owner setting, to watch in playtests) and are lost when the creature is defeated.
- **The free Miner can never upgrade:** it is summoned straight onto the battlefield. A basic Miner pulled into your hand by the Miner swap can be used as an upgrade like any other.
- While you drag a Miner card, empty summon spaces glow blue and your creatures glow gold. Upgraded creatures show small gold pips for each upgrade.
- There are no walls or ballistas in this version.

## Winning and losing

The only way to win is to bring the enemy Commander from 20 Health to 0, which makes them flee the battlefield in a panic. You lose if your Commander is forced to retreat first. Commanders never die.

- Damage to a Commander comes from creatures standing next to their Stronghold and from spells.
- Running out of cards makes your Commander take damage each turn, so long stalemates end.
- You can surrender at any time from the menu.
- **Match-end screen:** after the win or loss scene, a summary shows crystals mined, creatures summoned and lost on each side, the number of turns, and an **MVP** (your creature that dealt the most damage), with big **Play again** (same Commander, deck and difficulty) and **Menu** buttons.
- Win and loss scenes: the losing Commander makes a ridiculous last-second escape (rocket barrel, puff of steam, escape tunnel) while their Stronghold crumbles with a big comic "KA-BOOM", and the winner gloats.

## Starter card list

These 65 cards set the style and balance; the factory expands them into a Core Set of about 120 cards (about 35 per faction plus spells), giving plenty of variety to collect. Move 2 is reserved for Ultra Rare and Collector characters. In the full set the factory also adds Uncommon cards.

**Goblins (green crystals)**

| Card | Rarity | Role | Cost | ⚔️ | ❤️ | Move | Ability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Grubgrabber Miner | Common | Miner | 1 | 1 | 1 | 1 | "Scrounger, Taker of Shiny Things." Mines for 2; play onto one of your creatures instead of summoning for a permanent +1 Health; Tunnel (comeback only) |
| Scrapsmith Miner | Common | Smith Miner | 2 | 1 | 1 | 1 | Smith: play it onto one of your creatures instead of summoning, and that creature permanently gets +1 Attack and +1 Health. Summoned, it's a normal Miner (mines for 2). No Tunnel |
| Gutripper Brawler | Common | Fighter | 6 | 2 | 3 | 1 | Frenzy: +1 Attack when next to another Goblin |
| Skullflinger | Common | Fighter | 4 | 1 | 2 | 1 | Ranged |
| Boomfist Lunatic | Rare | Fighter | 5 | 2 | 2 | 1 | Ka-boom: when defeated, deals 2 damage to all adjacent enemies |
| Backstab Weasel | Rare | Fighter | 6 | 3 | 2 | 1 | Sneaky: enemies can't strike back at it |
| Mangewolf Rider | Ultra Rare | Fighter | 9 | 3 | 4 | 2 | Can act the turn it's played |
| Gutcrusher the Troll Tyrant | Collector | Fighter | 13 | 5 | 6 | 2 | Unique. Rally: all your Goblins get +1 Attack |
| Snotskull Grunt | Common | Fighter | 3 | 2 | 1 | 1 | No special ability |
| Boneknocker | Common | Fighter | 3 | 1 | 2 | 1 | No special ability |
| Rotgut Grenadier | Common | Fighter | 5 | 2 | 2 | 1 | Ranged: attacks up to 2 spaces away |
| Shiv Rat | Common | Fighter | 4 | 2 | 1 | 1 | Sneaky: enemies can't strike back at it |
| Skullbasher Rusher | Uncommon | Fighter | 6 | 2 | 2 | 1 | Charge: can move and attack in the same turn |
| Junk Shaman | Uncommon | Fighter | 5 | 1 | 3 | 1 | At the start of your turn, adjacent Goblins get +1 Attack this turn |
| Blastrat Sapper | Uncommon | Fighter | 4 | 2 | 1 | 1 | Ka-boom: when defeated, deals 1 damage to all adjacent enemies |

**Gnomes (blue crystals)**

| Card | Rarity | Role | Cost | ⚔️ | ❤️ | Move | Ability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gemsinger Miner | Common | Miner | 1 | 1 | 1 | 1 | "Prospector of Profound Patience." Mines for 2; play onto one of your creatures instead of summoning for a permanent +1 Health; Tunnel (comeback only) |
| Arcsmith Miner | Common | Smith Miner | 2 | 1 | 1 | 1 | Smith: play it onto one of your creatures instead of summoning, and that creature permanently gets +1 Attack and +1 Health. Summoned, it's a normal Miner (mines for 2). No Tunnel |
| Aegis Tinkerer | Common | Fighter | 5 | 1 | 3 | 1 | Fix-it: at the start of your turn, each adjacent ally gets Shield 1 |
| Stormcaller Savant | Common | Fighter | 5 | 2 | 2 | 1 | Ranged |
| Iron Scarab Automaton | Rare | Fighter | 8 | 2 | 5 | 1 | Armored: takes 1 less damage from every hit |
| Mirrorveil Illusionist | Rare | Fighter | 6 | 2 | 3 | 1 | Blink: once, swap places with any of your creatures |
| Thunderwing Gyronaut | Ultra Rare | Fighter | 8 | 3 | 3 | 2 | Flying: moves over other creatures; Ranged |
| The Arcane Colossus | Collector | Fighter | 13 | 5 | 6 | 2 | Unique. Overload: its attack also hits every enemy next to the target for 1 |
| Voltwright | Common | Fighter | 3 | 2 | 1 | 1 | No special ability |
| Hexgear Adept | Common | Fighter | 3 | 1 | 2 | 1 | No special ability |
| Hexwright Apprentice | Common | Fighter | 4 | 1 | 2 | 1 | Ranged: attacks up to 2 spaces away |
| Gearward Sentinel | Common | Fighter | 6 | 1 | 4 | 1 | Guard: enemies next to it must attack it first |
| Runic Siphoner | Uncommon | Fighter | 5 | 2 | 2 | 1 | When it defeats a creature, put 1 crystal in your Bank |
| Phase Stalker | Uncommon | Fighter | 6 | 2 | 3 | 1 | Blink: once per match, swap places with any of your creatures |
| Glyphshield Warden | Uncommon | Fighter | 6 | 2 | 3 | 1 | At the start of your turn, it gets Shield 1 |

**Dwarves (purple crystals)**

| Card | Rarity | Role | Cost | ⚔️ | ❤️ | Move | Ability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stonebreaker Miner | Common | Miner | 1 | 1 | 1 | 1 | "Has never met a rock he respected." Mines for 2; play onto one of your creatures instead of summoning for a permanent +1 Health; Tunnel (comeback only) |
| Anvilsworn Miner | Common | Smith Miner | 2 | 1 | 1 | 1 | Smith: play it onto one of your creatures instead of summoning, and that creature permanently gets +1 Attack and +1 Health. Summoned, it's a normal Miner (mines for 2). No Tunnel |
| Ironwall Shieldbeard | Common | Fighter | 7 | 2 | 4 | 1 | Guard: adjacent enemies must attack it first |
| Grudge Hurler | Common | Fighter | 6 | 2 | 3 | 1 | Ranged |
| Bloodbeard Berserker | Rare | Fighter | 8 | 3 | 4 | 1 | Rage: +2 Attack while below half Health |
| Forgefire Brewlord | Rare | Fighter | 7 | 2 | 4 | 1 | Hearty Ale: at the start of your turn, each adjacent ally gets +1 Health until your next turn |
| Thunderhorn Ram Rider | Ultra Rare | Fighter | 11 | 4 | 5 | 2 | Charge: can move and attack in the same turn |
| Queen Brunhilda Ironheart, the Unbroken | Collector | Fighter | 13 | 5 | 6 | 2 | Unique. Unbreakable: never takes more than 3 damage from one hit |
| Ironjaw Raider | Common | Fighter | 3 | 2 | 1 | 1 | No special ability |
| Granite Oathkeeper | Common | Fighter | 3 | 1 | 2 | 1 | No special ability |
| Oathbound Pikeman | Common | Fighter | 6 | 2 | 3 | 1 | Guard: enemies next to it must attack it first |
| Deepforge Crossbowman | Common | Fighter | 5 | 2 | 2 | 1 | Ranged: attacks up to 2 spaces away |
| Barrelback Courier | Common | Fighter | 6 | 1 | 3 | 1 | Can act the turn it's played |
| Rune-Splitter | Uncommon | Fighter | 7 | 3 | 3 | 1 | Armored: takes 1 less damage from every hit |
| Grimhold Ravager | Uncommon | Fighter | 8 | 3 | 4 | 1 | Rage: +2 Attack while below half Health |

**Commander spells** (cast from your Stronghold; cost soul crystals)

**Faction spells:** each faction has three spells of its own, which can only be put in a deck (and cast) when your Commander belongs to that faction; three shared spells can be used by anyone. Goblins fight dirty (poison, ambushes, theft), Gnomes are the magic faction, Dwarves the mechanical one.

| Card | Faction | Rarity | Type | Cost (soul crystals) | Effect |
| --- | --- | --- | --- | --- | --- |
| Venom Shiv | Goblins | Uncommon | Regular | 2 | Poison an enemy creature: it takes 1 damage at the start of each of its owner's next 3 turns and can't heal during that time |
| Rat-Tunnel Ambush | Goblins | Uncommon | Regular | 2 | Move one of your creatures to any empty space next to a crystal site; it can still attack this turn |
| Pickpocket! | Goblins | Rare | Counterspell | 4 | Cancel an enemy creature as it's summoned; the card goes back to their hand |
| Searing Arcane Orb | Gnomes | Rare | Regular | 3 | 3 damage to one creature or the enemy Commander |
| Starfall Cataclysm | Gnomes | Ultra Rare | Regular | 7 | 2 damage to every creature in a 3 × 3 area |
| Unweave | Gnomes | Rare | Counterspell | 5 | Cancel any enemy spell |
| Ironclad Bulwark | Dwarves | Uncommon | Instant | 2 | Your creature takes no damage from the next hit this turn |
| Thunderhorn Blast | Dwarves | Rare | Regular | 4 | All your creatures get +1 Attack this turn |
| Emergency Repairs | Dwarves | Ultra Rare | Instant | 5 | Your Commander heals 4 |
| Field Bandage | Shared | Common | Instant | 2 | Heal one of your creatures by 3 right now (useful during the enemy's turn, before your creatures heal) |
| Snuff Out | Shared | Uncommon | Counterspell | 3 | Cancel an enemy spell that costs 3 or less |
| Desperate Plunder | Shared | Common | Regular | 1 | Can only be cast if the enemy owns more mines than you: gain 3 crystals of Flow this turn |

Hex Reversal (cancel an enemy spell, then cast a free copy) is set aside for a later card set.

**Crystal cards** (free to play; Instant speed; crystals go into your Bank; one per round; at most 20 per deck)

| Card | Rarity | Effect |
| --- | --- | --- |
| Soul Shard | Common | Gain 1 crystal (into your Bank) |
| Soul Cluster | Uncommon | Gain 2 crystals (into your Bank) |
| Wellspring Geode | Rare | Place a small crystal beside your Stronghold: +1 Flow every turn for the rest of the match (Unique) |
| Heart of the Fallen | Ultra Rare | Gain 4 crystals (into your Bank) |
| Motherlode | Collector | Gain 3 crystals now, and your next creature this turn costs 2 less |

**Crystal Eaters** are creatures that let you break the one-per-turn rule: while one is on your battlefield, you may play extra Crystal cards in the same turn, but every extra card costs that creature something. The 10-per-deck limit still applies.

| Card | Faction | Rarity | Role | Cost | ⚔️ | ❤️ | Move | Ability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shardguzzler the Bottomless | Goblins | Uncommon | Miner | 5 | 1 | 4 | 1 | Crystal Eater: each extra Crystal card you play this turn deals 2 damage to it |
| Overclocked Aethervein | Gnomes | Rare | Miner | 5 | 1 | 4 | 1 | Crystal Eater: each extra Crystal card you play this turn means it can't move or attack until your next turn, and it takes 1 damage |
| Gemdrunk Deepdelver | Dwarves | Rare | Miner | 7 | 2 | 5 | 1 | Crystal Eater: each extra Crystal card you play this turn gives it -1 Attack for the rest of the match |

If a Crystal Eater is defeated by its own drawback, its Commander gasps dramatically.

Spells are powerful Commander magic paid from your soul crystals. Because unspent crystals stay in your pool through the enemy's turn, saving crystals for an Instant or counterspell means not spending them on your own turn. Counterspells are Instants that cancel what the opponent is doing as they do it, using the "Respond?" window. A countered spell or creature still costs its owner the crystals.

## Collection, rarity and screens

New players start with basic cards and some booster packs; better cards come from opening packs, and the best are rare. Rarity settings live in a file only the game's owner can change.

**Collection**

- **Starting collection:** a basic starter deck for each faction (Commons only) plus 5 free booster packs, opened right after the tutorial.
- **Gold:** earned by winning (Easy 10, Normal 20, Hard 35; half for a loss). No gold for matches that end before turn 5, except for the winner when the opponent surrenders; this stops gold farming, and the owner can change the turn number. Can also be bought with real money (later phase). Spent on booster packs and cosmetics.
- **Booster pack:** 50 gold for 12 random cards with a card-flip opening animation; rarer cards get a bigger, flashier reveal.
- **Deck builder:** save up to 5 decks; filter the collection by faction, rarity, role and cost. **Testing version (now):** until packs and the Collection exist, every card is unlocked in unlimited supply; the builder enforces the deck rules (50–100 cards, copy limits, at most 20 Crystal cards, Unique), shows a live count of creatures, spells and Crystal cards, and saves decks on the device. Before each match you pick one of your decks or one of the starter decks.
- **How the deck builder looks:** the screen fills the whole window and scales live with it. The left side is a scrolling grid of **card pictures** (the real card faces, full text readable; a cards-per-row slider from 2 to 8); the right side, starting at the very top and left-aligned, shows the title, **your decks as a carousel of deck pictures** (drag left/right with the mouse or a finger; the centered deck is the one being edited; only your own decks, plus a "New deck" slot; starter decks are not here), the deck's name in large letters with a small count ("62 cards (50–100)"), the actions **Auto-fill**, **Save**, **Rename**, **New deck** and **Back** as plain clickable text, and the **deck list**. **Drag** a card onto the deck (the dragged card shows at its 3-per-row size), or **double-click** (double-tap) it, to add one copy; a single click/tap only enlarges the card. The deck list is sorted by cost, one line per card ("3 × Snotskull Grunt") with **+** and **−** (+ greys out at the copy limit; − at 0 removes the line). Above the list: counts of creatures, spells and Crystal cards, a small **cost bar chart** (how many cards at each cost), and any problems in red ("13 more cards needed", "Too many Crystal cards"). Auto-fill completes a part-built deck with sensible cards (Miners, a good cost curve, a few spells, Crystal cards up to 4). Starter decks can be copied into your own decks ("Copy to my decks") from the deck picker and then edited.
- **Cards are never stretched:** everywhere in the game, a card always keeps its exact shape and proportions; extra space goes between cards, never into widening them.
- **Lettering:** all text uses one free font, **Alegreya SC** (italic), in plain golden yellow with a thin dark outline; no metal or textured letters. Health numbers on hearts are white. Menu actions are plain text that glows on hover, not boxed buttons.

**Owner-controlled rarity (back files, not in the game):** all rarity numbers live in one settings file in the code, for example `game-config.json`. Players can never see or change it. It holds:

- what each pack contains (starting values: 12 cards = 6 Common, 3 Uncommon, 3 Rare; about 1 Ultra Rare every 2–3 packs and 1 Collector card about every 20 packs, each replacing a Common, all random);
- how many cards per pack, and the pack price;
- which rarity each card is;
- gold rewards per win.

Once online play exists, the owner changes these in the Owner Console; until then, they're edited in the settings file.

**Computer opponent:** Easy (for kids; obvious moves, some mistakes), Normal (fights for sites sensibly), Hard (protects Miners, focuses fire, times spells well).

**Helper features:** selecting a creature makes its move and attack spaces glow; a **Last turn** button (small, top-left) opens a short list, with mini card pictures, of everything the enemy did on its last turn ("Moved Shiv Rat", "Cast Infernal Orb on your Voltwright", "Mined at the middle mine: +4"), and tapping a line highlights that space; an optional hint button and undo for the last move (single-player only; online matches have no hints or undo).

**Commander and deck select (Play):** one screen, no dropdowns. At the top, the three Commanders as **big cards** side by side (portrait, name, faction, ability text); tap one to select it (it lifts and glows in its faction color). Below, your decks as a **sideways-scrolling row of card stacks** (swipe, mouse wheel or arrows): each looks like a small 3D pile of cards with the deck's **name on the top card**, its card count and ✔ (ready) or ⚠ (has a problem). The starter decks come first (each can be removed, restored in Settings, or copied to your own decks), then your saved decks, and a last stack "+ New Deck" opens the deck builder. Tap a stack to select it (it lifts up); illegal decks are greyed out and tapping one says what's wrong. Under the decks, three big **difficulty buttons**: Easy, Normal, Hard. A big **Fight!** button starts. The screen **remembers** your last Commander, deck and difficulty and starts with them selected.

**Screens:** Main menu, Play (pick Commander, deck and difficulty), Collection, Deck Builder, Shop (packs), Tutorial (a guided match), Rules (how to play, with pictures), Settings (sound, music, reset progress).

**Tutorial match:** offered the first time the game starts, and any time from the Tutorial button. A short, fixed match against a harmless opponent (same Commander, cards and mine layout every time, no timers) where pop-up tips walk you through each step in order: summon a Miner on your back row, march it next to a mine, drag it onto the mine to mine and watch the mine change color, **tap a mine to mine with all your ready Miners at once**, spend the crystals next turn (your Flow counter), play a Crystal card and see it go into your **Bank**, **upgrade a creature by playing a Miner card onto it**, swap two of your creatures, fight an enemy (with the attack preview; simultaneous hits, healing next turn), cast a spell, see **savings** (end a turn with 10+ Flow and 1 goes to the Bank), and finally attack the enemy Commander until they retreat. The tutorial must always teach the current rules: one soul crystal type, Flow and Bank, tap-to-mine, Miner upgrades and savings; nothing from older versions (no color payments, no Mine All button). Each tip waits until you've done the step. It can be skipped and replayed.

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

// Generates src/content/*.json from compact tables. Run: node scripts/gen-content.mjs
import { writeFileSync } from 'node:fs';
const out = (n, d) => writeFileSync(new URL(`../src/content/${n}.json`, import.meta.url), JSON.stringify(d, null, 1) + '\n');

out('factions', [
  { id: 'goblins', name: 'Goblins', faith: 'The Shiny Horde', crystal: 'green', symbol: 'skull', motto: 'Mine! Also mine!', beats: 'gnomes' },
  { id: 'gnomes', name: 'Gnomes', faith: 'The Cogwork Congregation', crystal: 'blue', symbol: 'gear', motto: 'Everything is fixable. Especially you.', beats: 'dwarves' },
  { id: 'dwarves', name: 'Dwarves', faith: 'The Order of the Anvil', crystal: 'purple', symbol: 'hammer', motto: 'We were here first. Get off our rock.', beats: 'goblins' },
]);
out('crystal-colors', [
  { id: 'green', hex: '#3ee06a', faction: 'goblins' },
  { id: 'blue', hex: '#3fa9ff', faction: 'gnomes' },
  { id: 'purple', hex: '#b45cff', faction: 'dwarves' },
  { id: 'neutral', hex: '#dfe3ea', faction: null },
]);
out('commanders', [
  { id: 'grubnak', name: 'Grubnak the Goblin Boss', faction: 'goblins', health: 20, abilityText: 'Goblin creatures cost 1 less crystal (minimum 1).', ability: { type: 'creatureDiscount', faction: 'goblins', amount: 1 }, blurb: 'Scrappy, sneaky, chaotic. Cheap swarms and explosions.' },
  { id: 'sproingle', name: 'Professor Sproingle', faction: 'gnomes', health: 20, abilityText: 'Your spells cost 1 less crystal (minimum 1).', ability: { type: 'spellDiscount', amount: 1 }, blurb: 'Clever tinkerers and spark-mages. Gadgets, healing and ranged sparks.' },
  { id: 'sprocket', name: 'Madame Sprocket', faction: 'gnomes', health: 20, playable: false, abilityText: 'At the start of your turn, your creature with the lowest Health gets Shield 1.', ability: { type: 'lowestShield', amount: 1 }, blurb: 'Not playable in phase 1a.' },
  { id: 'borgo', name: 'Thane Borgo Anvilbottom', faction: 'dwarves', health: 20, abilityText: 'Your creatures get +1 Health.', ability: { type: 'bonusHealth', amount: 1 }, blurb: 'Tough, proud miners. Big health, heavy hits, holding ground.' },
]);
out('abilities', {
  gather: { name: 'Gatherer', text: 'Gathers +2 next to a site you control.' },
  tunnel: { name: 'Tunnel', text: 'Can be summoned onto any empty space next to a crystal site.' },
  frenzy: { name: 'Frenzy', text: '+1 Attack when next to another Goblin.' },
  ranged: { name: 'Ranged', text: 'Also hits an enemy exactly 2 spaces away in a straight or diagonal line.' },
  kaboom: { name: 'Ka-boom', text: 'When defeated, deals 2 damage to all adjacent enemies.' },
  sneaky: { name: 'Sneaky', text: 'Enemies cannot strike back at it.' },
  haste: { name: 'Haste', text: 'Can act the turn it is played.' },
  rally: { name: 'Rally', text: 'All your Goblins get +1 Attack.' },
  fixit: { name: 'Fix-it', text: 'At the start of your turn, each adjacent ally gets Shield 1.' },
  armored: { name: 'Armored', text: 'Takes 1 less damage from every hit.' },
  blink: { name: 'Blink', text: 'Once, swap places with any of your creatures.' },
  flying: { name: 'Flying', text: 'Moves over other creatures.' },
  overload: { name: 'Overload', text: 'Its attack also hits every enemy next to the target for 1.' },
  guard: { name: 'Guard', text: 'Adjacent enemies must attack it first.' },
  rage: { name: 'Rage', text: '+2 Attack while below half Health.' },
  charge: { name: 'Charge', text: 'Can move and attack in the same turn.' },
  unbreakable: { name: 'Unbreakable', text: 'Never takes more than 3 damage from one hit.' },
  heartyale: { name: 'Hearty Ale', text: 'At the start of your turn, each adjacent ally gets +1 Health until your next turn.' },
  eaterGuzzler: { name: 'Crystal Eater', text: 'Each extra Crystal card you play this turn deals 2 damage to it.' },
  eaterConduit: { name: 'Crystal Eater', text: "Each extra Crystal card you play this turn means it can't move or attack until your next turn, and it loses 1 Health." },
  eaterDelver: { name: 'Crystal Eater', text: 'Each extra Crystal card you play this turn gives it -1 Attack for the rest of the match.' },
});

const text = (abs, abilities) => abs.map((a) => abilities[a]).join(' ');
// id,name,faction,rarity,role,cost,atk,hp,move,abilities,unique
const C = [
  ['goblin-scrounger', 'Goblin Scrounger', 'goblins', 'Common', 'Gatherer', 1, 1, 2, 1, ['gather', 'tunnel']],
  ['goblin-scrapper', 'Goblin Scrapper', 'goblins', 'Common', 'Fighter', 2, 2, 3, 1, ['frenzy']],
  ['goblin-slinger', 'Goblin Slinger', 'goblins', 'Common', 'Fighter', 2, 1, 2, 1, ['ranged']],
  ['goblin-bomber', 'Goblin Bomber', 'goblins', 'Rare', 'Fighter', 3, 2, 2, 1, ['kaboom']],
  ['goblin-sneak', 'Goblin Sneak', 'goblins', 'Rare', 'Fighter', 3, 3, 2, 1, ['sneaky']],
  ['wolf-rider', 'Wolf Rider', 'goblins', 'Ultra Rare', 'Fighter', 4, 3, 4, 2, ['haste']],
  ['grubnaks-big-boss-troll', "Grubnak's Big Boss Troll", 'goblins', 'Collector', 'Fighter', 6, 5, 6, 2, ['rally'], true],
  ['shard-guzzler', 'Shard Guzzler', 'goblins', 'Uncommon', 'Gatherer', 2, 1, 4, 1, ['eaterGuzzler']],
  ['gnome-prospector', 'Gnome Prospector', 'gnomes', 'Common', 'Gatherer', 1, 1, 2, 1, ['gather', 'tunnel']],
  ['gnome-tinker', 'Gnome Tinker', 'gnomes', 'Common', 'Fighter', 2, 1, 3, 1, ['fixit']],
  ['spark-gnome', 'Spark Gnome', 'gnomes', 'Common', 'Fighter', 2, 2, 2, 1, ['ranged']],
  ['clockwork-beetle', 'Clockwork Beetle', 'gnomes', 'Rare', 'Fighter', 3, 2, 5, 1, ['armored']],
  ['gnome-illusionist', 'Gnome Illusionist', 'gnomes', 'Rare', 'Fighter', 3, 2, 3, 1, ['blink']],
  ['gyrocopter-ace', 'Gyrocopter Ace', 'gnomes', 'Ultra Rare', 'Fighter', 4, 3, 3, 2, ['flying', 'ranged']],
  ['the-great-steam-golem', 'The Great Steam Golem', 'gnomes', 'Collector', 'Fighter', 7, 5, 6, 2, ['overload'], true],
  ['overclocked-conduit', 'Overclocked Conduit', 'gnomes', 'Rare', 'Gatherer', 3, 1, 4, 1, ['eaterConduit']],
  ['dwarf-miner', 'Dwarf Miner', 'dwarves', 'Common', 'Gatherer', 1, 1, 3, 1, ['gather', 'tunnel']],
  ['shieldbeard', 'Shieldbeard', 'dwarves', 'Common', 'Fighter', 2, 2, 4, 1, ['guard']],
  ['axe-thrower', 'Axe Thrower', 'dwarves', 'Common', 'Fighter', 2, 2, 3, 1, ['ranged']],
  ['ironhammer-berserker', 'Ironhammer Berserker', 'dwarves', 'Rare', 'Fighter', 3, 3, 4, 1, ['rage']],
  ['brewmaster', 'Brewmaster', 'dwarves', 'Rare', 'Fighter', 3, 2, 4, 1, ['heartyale']],
  ['ram-rider', 'Ram Rider', 'dwarves', 'Ultra Rare', 'Fighter', 5, 4, 5, 2, ['charge']],
  ['queen-brunhilda-stonebeard', 'Queen Brunhilda Stonebeard', 'dwarves', 'Collector', 'Fighter', 7, 5, 6, 2, ['unbreakable'], true],
  ['crystal-drunk-delver', 'Crystal-Drunk Delver', 'dwarves', 'Rare', 'Gatherer', 3, 2, 5, 1, ['eaterDelver']],
];
const abilities = JSON.parse((await import('node:fs')).readFileSync(new URL('../src/content/abilities.json', import.meta.url), 'utf8'));
const cards = C.map(([id, name, faction, rarity, role, cost, attack, health, move, ab, unique]) => ({
  id, name, type: 'creature', faction, rarity, role, cost, attack, health, move, abilities: ab, unique: !!unique,
  text: (unique ? 'Unique. ' : '') + ab.map((a) => `${abilities[a].name}: ${abilities[a].text}`).join(' '),
}));
// spells: id,name,rarity,kind,cost,effect,params,text
const S = [
  ['prospectors-prayer', "Prospector's Prayer", 'Common', 'regular', 4, 'gainCrystals', { amount: 7, needFewerSites: true }, 'Can only be cast if you control fewer sites than the enemy: gain 7 crystals of your faction color.'],
  ['tunnel-rush', 'Tunnel Rush', 'Uncommon', 'regular', 4, 'tunnelMove', {}, 'Move one of your creatures to any empty space next to a crystal site; it can still attack this turn.'],
  ['fireball', 'Fireball', 'Rare', 'regular', 5, 'damage', { amount: 3 }, '3 damage to one creature or the enemy Commander.'],
  ['battle-cry', 'Battle Cry', 'Rare', 'regular', 7, 'buffAttack', { amount: 1 }, 'All your creatures get +1 Attack this turn.'],
  ['meteor-strike', 'Meteor Strike', 'Ultra Rare', 'regular', 12, 'areaDamage', { amount: 2 }, '2 damage to every creature in a 3 x 3 area.'],
  ['healing-light', 'Healing Light', 'Common', 'instant', 4, 'heal', { amount: 3 }, 'Heal one of your creatures by 3.'],
  ['shield-bubble', 'Shield Bubble', 'Uncommon', 'instant', 5, 'shield', {}, 'Your creature takes no damage from the next hit this turn.'],
  ['second-wind', 'Second Wind', 'Ultra Rare', 'instant', 9, 'healCommander', { amount: 4 }, 'Your Commander heals 4.'],
  ['fizzle', 'Fizzle', 'Uncommon', 'counter', 5, 'cancelSpell', { maxCost: 5 }, 'Cancel an enemy spell that costs 5 or less.'],
  ['hold-it', 'Hold It!', 'Rare', 'counter', 6, 'cancelSummon', {}, "Cancel an enemy creature as it's summoned; the card goes back to their hand."],
  ['spell-snap', 'Spell Snap', 'Rare', 'counter', 8, 'cancelSpell', {}, 'Cancel any enemy spell.'],
  ['mirror-hex', 'Mirror Hex', 'Ultra Rare', 'counter', 11, 'mirror', {}, 'Cancel an enemy spell, then cast a free copy of it yourself.'],
];
for (const [id, name, rarity, kind, cost, effect, params, t] of S)
  cards.push({ id, name, type: 'spell', faction: 'any', rarity, spellKind: kind, cost, effect, params, text: (kind === 'regular' ? 'Regular spell. ' : kind === 'instant' ? 'Instant. ' : 'Counterspell (Instant). ') + t });
const K = [
  ['soul-shard', 'Soul Shard', 'Common', 'gain', { amount: 1 }, 'Gain 1 crystal of your faction color.'],
  ['crystal-cluster', 'Crystal Cluster', 'Uncommon', 'gain', { amount: 2 }, 'Gain 2 crystals of your faction color.'],
  ['glowing-geode', 'Glowing Geode', 'Rare', 'geode', {}, 'Place a small crystal beside your Stronghold: +1 crystal at the start of each of your turns for the rest of the match. Unique.', true],
  ['heart-of-the-fallen', 'Heart of the Fallen', 'Ultra Rare', 'chooseColors', { amount: 4 }, 'Gain 4 crystals of any colors you choose.'],
  ['motherlode', 'Motherlode', 'Collector', 'motherlode', { amount: 3, discount: 2 }, 'Gain 3 crystals now, and your next creature this turn costs 2 less.'],
];
for (const [id, name, rarity, effect, params, t, unique] of K)
  cards.push({ id, name, type: 'crystal', faction: 'any', rarity, cost: 0, effect, params, unique: !!unique, text: 'Crystal card (free, one per turn). ' + t });
out('cards', cards);

const slots = {
  goblins: { g: 'goblin-scrounger', a: 'goblin-scrapper', b: 'goblin-slinger', r1: 'goblin-bomber', r2: 'goblin-sneak', u: 'wolf-rider', c: 'grubnaks-big-boss-troll', e: 'shard-guzzler' },
  gnomes: { g: 'gnome-prospector', a: 'gnome-tinker', b: 'spark-gnome', r1: 'clockwork-beetle', r2: 'gnome-illusionist', u: 'gyrocopter-ace', c: 'the-great-steam-golem', e: 'overclocked-conduit' },
  dwarves: { g: 'dwarf-miner', a: 'shieldbeard', b: 'axe-thrower', r1: 'ironhammer-berserker', r2: 'brewmaster', u: 'ram-rider', c: 'queen-brunhilda-stonebeard', e: 'crystal-drunk-delver' },
};
const counts = { g: 10, a: 10, b: 9, r1: 3, r2: 3, u: 2, c: 1, e: 2 };
const shared = { fireball: 2, 'healing-light': 1, 'shield-bubble': 1, fizzle: 1, 'hold-it': 1, 'soul-shard': 2, 'crystal-cluster': 1, 'glowing-geode': 1 };
const decks = {};
const ids = Object.fromEntries(cards.map((c) => [c.id, c]));
for (const [f, m] of Object.entries(slots)) {
  const d = [];
  for (const [k, n] of Object.entries(counts)) for (let i = 0; i < n; i++) d.push(m[k]);
  for (const [id, n] of Object.entries(shared)) for (let i = 0; i < n; i++) d.push(id);
  decks[f] = d;
  if (d.length !== 50 || d.filter((id) => ids[id].type === 'creature').length !== 40) throw new Error(f + ' deck has ' + d.length);
}
out('starter-decks', decks);

out('game-config', {
  deployTimerSeconds: 30, actionTimerSeconds: 45, ropeWarningSeconds: 10, respondWindowSeconds: 5,
  startingCrystals: 0, strongholdIncome: 1, siteIncome: 1, gathererBonus: 2, underdogBonus: 2, geodeIncome: 1,
  deckSize: 50, starterDeckMix: { creatures: 40, spells: 6, crystals: 4 }, openingHandSize: 5, secondPlayerExtraCards: 1,
  copyLimits: { Common: null, Uncommon: null, Rare: 3, 'Ultra Rare': 3, Collector: 3 },
  crystalCardLimit: 10, commanderHealth: 20, deckOutDamage: 1,
  crystalCardsPerTurn: 1,
  upgradeCosts: { 'sharpened-weapons': 6, 'heavy-armor': 6, veteran: 10, 'champions-crown': 15 },
  upgrades: { 'sharpened-weapons': { name: 'Sharpened Weapons', attack: 1 }, 'heavy-armor': { name: 'Heavy Armor', maxHealth: 3, heal: 3 }, veteran: { name: 'Veteran', move: 2 }, 'champions-crown': { name: "Champion's Crown", attack: 2, maxHealth: 3, heal: 3 } },
  typeAdvantageBonus: 1, rageBonus: 2,  frenzyBonus: 1, rallyBonus: 1, kaboomDamage: 2, overloadDamage: 1,
  eaterGuzzlerDamage: 2, eaterConduitDamage: 1, eaterDelverPenalty: 1,
  boardSize: 7, sites: [[4, 2], [4, 4], [4, 6]], strongholds: { player: [7, 4], opponent: [1, 4] },
  backRow: { player: 7, opponent: 1 }, frontRow: { player: 6, opponent: 2 }, shieldFixit: 1, aleBonus: 1, sprocketShield: 1,
});
out('tutorial', {
  playerCommander: 'grubnak', opponentCommander: 'sproingle',
  setup: {
    firstPlayer: 'player',
    playerCrystals: { green: 1 }, opponentHealth: 6,
    playerHand: ['goblin-scrounger', 'goblin-scrapper', 'goblin-scrounger', 'soul-shard', 'fireball'],
    playerDeck: ['crystal-cluster', 'goblin-scrapper', 'soul-shard', 'goblin-slinger', 'crystal-cluster', 'goblin-scrapper', 'goblin-scrounger', 'soul-shard', 'goblin-slinger', 'goblin-scrapper', 'crystal-cluster', 'goblin-slinger', 'goblin-scrounger', 'goblin-scrapper', 'soul-shard', 'goblin-slinger', 'crystal-cluster', 'goblin-scrapper', 'goblin-scrounger', 'soul-shard'],
    opponentHand: [], opponentDeck: Array(20).fill('gnome-prospector'),
    board: [{ cardId: 'gnome-prospector', owner: 'opponent', row: 2, col: 6 }],
  },
  tips: {
    summon: 'Welcome! Drag a troop from your hand onto your back row (the bottom row, next to your Stronghold) to summon it. You have 1 crystal, enough for a cost-1 troop.',
    move: 'Nice! Now march it forward: next turn, press Done to reach the Action phase, then drag your troop to an empty space. Each troop either moves OR attacks.',
    capture: 'Walk next to a glowing crystal site in the middle. Have more troops around it than the enemy to take it, and watch it change to your color!',
    spend: 'Crystals are your money. Summon another troop or upgrade one by tapping it in the Deploy phase to spend them.',
    fight: 'Time to fight! In the Action phase drag a troop onto the enemy troop. Melee hits are simultaneous: both strike. Damage heals at the start of your next turn.',
    spell: 'Cast a spell! Drag Fireball from your hand onto an enemy (spells cost crystals of any color).',
    commander: 'Finally, move next to the enemy Stronghold and attack the Commander. Each hit removes health equal to the attacker\'s Attack. Make them retreat!',
    complete: 'Tutorial complete!',
  },
});
console.log('content written');

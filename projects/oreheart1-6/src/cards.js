// Card data: 80 cards (24 Wildwood, 24 Shimmerfolk, 24 Ironclad, 8 spells)
const RAR = { C: 'common', R: 'rare', E: 'epic', L: 'legendary' };
const FAC = { w: 'wildwood', s: 'shimmerfolk', i: 'ironclad', x: 'spell' };

export const slug = (n) => n.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '-');

function parseCost(s) {
  const cost = { wood: 0, crystal: 0, iron: 0 };
  const re = /([wci])(\d)/g;
  let m;
  while ((m = re.exec(s))) cost[{ w: 'wood', c: 'crystal', i: 'iron' }[m[1]]] += +m[2];
  return cost;
}

// name|rarity|cost|atk|def|arrows|ability|emoji
const RAW = {
  w: `Beaver Builder|C|w1|1|1|F|Worker; Builder|🦫
Acorn Sprout|C|w1|1|2|F||🌰
Thornback Hedgehog|C|w2|2|2|FL,FR,BL,BR||🦔
Mossy Turtle|C|w2|1|4|F||🐢
Owl Ranger|R|w3|2|2|FF|Flying|🦉
Bramble Elf|R|w3|3|2|F,L,R|Swift|🧝
Barkbeard Treant|E|w4|3|4|F,L,R|Builder|🌳
Old Oakheart|L|w4i1|4|5|F,B,L,R|Friendly palisades next to it get 🛡️ +1|🌲
Pine Cub|C|w1|1|1|F,B||🐻
Mushroom Scout|C|w1|2|1|F||🍄
Fern Frog|C|w1|1|1|F|Leap|🐸
Bark Beetle|C|w2|2|3|F||🪲
Hollow Squirrel|C|w2|2|2|F,B||🐿️
Twig Archer|C|w2|2|1|FF||🏹
Daisy Deer|C|w2|2|2|F|Swift|🦌
Root Rabbit|C|w2|1|3|F,L,R||🐰
Moonlit Owl|R|w3|3|2|F,B|Flying|🦅
Elf Warden|R|w3|2|3|F,L,R|Builder|🧝‍♀️
Vine Lasher|R|w3|3|2|F,B|Leap|🌿
Hickory Stag|R|w3|3|3|F|Swift|🦬
Grove Guardian|E|w4|4|4|F||🌴
Sunpetal Sage|E|w3c1|3|3|FF|Flying|🌻
Great Horned Owl|E|w4|3|3|F,FL,FR|Flying|🦉
Elderwood Titan|L|w5|5|6|F,L,R|Builder|🍃`,
  s: `Gem Gnome|C|c1|1|1|F|Worker|🧞
Spark Wisp|C|c1|2|1|F|Flying|✨
Prism Fox|C|c2|3|1|F,B|Swap|🦊
Glimmer Bat|R|c2|2|1|FL,FR|Flying; Swift|🦇
Starcap Wizard|R|c3|3|2|FF||🧙
Crystal Golemling|E|c3i1|2|4|F,L,R|Leap|🪨
Prismatica, Rainbow Dragon|L|c5|5|3|F,B,L,R,FL,FR,BL,BR|Flying|🐉
Dew Sprite|C|c1|1|1|F|Flying|🧚
Bubble Imp|C|c1|1|2|F||🫧
Moon Mouse|C|c1|2|1|F||🐭
Twinkle Newt|C|c2|2|2|F,B||🦎
Mirror Cat|C|c2|2|2|F|Swap|🐱
Wand Apprentice|C|c2|2|1|FF||🪄
Pebble Pup|C|c2|1|3|F,L,R||🐶
Cloud Lamb|C|c2|1|2|F|Flying|🐑
Glow Moth|C|c1|1|1|FL,FR|Flying|🦋
Ruby Gem Fox|R|c3|3|2|F,L,R||🦊
Portal Pixie|R|c2|2|1|F|Teleport|🧚‍♀️
Sky Wizard|R|c3|3|2|FF|Flying|🧙‍♀️
Ember Drakeling|R|c3|3|3|F,FL,FR||🐲
Aurora Wisp|E|c3|3|2|F,B,L,R|Flying|🌈
Cobalt Drake|E|c4|4|3|F|Flying|🦕
Orb Archmage|E|c4|3|3|FF|Swap|🔮
Celestia, Star Phoenix|L|c5|4|4|F,B,L,R,FL,FR|Flying|🔥`,
  i: `Goblin Miner|C|i1|1|1|F|Worker|👺
Tin Knight|C|i2|3|2|F,L,R||🗡️
Grumble Orc|C|i2|3|3|F||👹
Dwarf Smith|R|i2w1|2|3|F|Builder; Forge upgrades cost it 1 less|🔨
Cannon Crab|R|i3|3|3|L,R,FF||🦀
Boar Rider|E|i4|4|3|F,FL,FR|Charge; Swift|🐗
Sir Rivetbeard|L|i5|5|5|F,B,L,R|Friendly creatures next to him get ⚔️ +1|🧔
Cog Rat|C|i1|1|1|F||🐀
Bolt Bot|C|i1|1|2|F||🤖
Pot Helm Goblin|C|i1|2|1|F||🥘
Shield Squire|C|i2|1|3|F,L,R||🛡️
Spear Goblin|C|i2|2|1|FF||🔱
Brass Beetle|C|i2|2|3|F||🐞
Steam Puffer|C|i2|2|2|F,B||🚂
Rivet Recruit|C|i2|2|2|F,L,R||🔩
Axe Dwarf|C|i2|3|1|F||🪓
Mace Orc|R|i3|3|3|F,L,R||🏏
Gear Golem|R|i3|2|4|F||🦾
Siege Goblin|R|i3|3|2|FF||💣
Brawler Boar|R|i3|4|2|F||🐽
Steam Titan|E|i4|4|4|F||🏭
Warlord Orc|E|i4|4|3|F,L,R||👾
Forge Dwarf Lord|E|i4|3|4|F,L,R|Builder|⚒️
Grand Marshal Anvil|L|i5|6|3|F,FL,FR|Charge|🦏`,
  x: `Zap|C|c1||||Knock out an enemy creature with 🛡️1|⚡
Frost Snap|C|c2||||An enemy creature can't act next turn|❄️
Blink|R|c2||||Teleport one of your creatures to any empty tile|🌀
Rockfall|R|c2i1||||Knock out an enemy creature with 🛡️2 or less|🪨
Overgrowth|E|c2w2||||Build a free Wooden Palisade on 2 empty tiles|🌱
Wisp Rush|C|c1||||One of your creatures can act again|💨
Moonbeam|R|c3||||Knock out an enemy creature with 🛡️3 or less|🌙
Sparkle Boost|E|c3||||One of your creatures gets ⚔️ +1 and 🛡️ +1|🌟`,
};

export const cards = [];
for (const f of Object.keys(RAW)) {
  for (const line of RAW[f].split('\n')) {
    const p = line.split('|');
    const spell = f === 'x';
    cards.push({
      id: slug(p[0]),
      name: p[0],
      faction: FAC[f],
      type: spell ? 'spell' : 'creature',
      rarity: RAR[p[1]],
      cost: parseCost(p[2]),
      attack: spell ? null : +p[3],
      defense: spell ? null : +p[4],
      arrows: spell || !p[5] ? [] : p[5].split(','),
      ability: (p[6] || '').trim(),
      emoji: p[7],
    });
  }
}
export const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));

const mk = (plan) => {
  const ids = [];
  for (const [name, n] of plan) for (let k = 0; k < n; k++) ids.push(slug(name));
  return ids;
};
const two = (names) => names.map((n) => [n, 2]);

export const starterDecks = {
  wildwood: mk([
    ['Beaver Builder', 2], ['Acorn Sprout', 2], ['Thornback Hedgehog', 2], ['Mossy Turtle', 2],
    ['Owl Ranger', 1], ['Bramble Elf', 1], ['Barkbeard Treant', 1],
    ...two(['Pine Cub', 'Mushroom Scout', 'Fern Frog', 'Bark Beetle', 'Hollow Squirrel', 'Twig Archer', 'Daisy Deer', 'Root Rabbit']),
    ['Elf Warden', 1], ['Vine Lasher', 1], ['Hickory Stag', 1],
  ]),
  shimmerfolk: mk([
    ['Gem Gnome', 2], ['Spark Wisp', 2], ['Prism Fox', 2], ['Glimmer Bat', 1], ['Starcap Wizard', 1], ['Crystal Golemling', 1],
    ['Zap', 2], ['Frost Snap', 1], ['Blink', 1],
    ...two(['Dew Sprite', 'Bubble Imp', 'Moon Mouse', 'Twinkle Newt', 'Mirror Cat', 'Wand Apprentice', 'Pebble Pup', 'Cloud Lamb']),
    ['Ruby Gem Fox', 1],
  ]),
  ironclad: mk([
    ['Goblin Miner', 2], ['Tin Knight', 2], ['Grumble Orc', 2], ['Dwarf Smith', 1], ['Cannon Crab', 1], ['Boar Rider', 1],
    ...two(['Cog Rat', 'Bolt Bot', 'Pot Helm Goblin', 'Shield Squire', 'Spear Goblin', 'Brass Beetle', 'Steam Puffer', 'Rivet Recruit', 'Axe Dwarf']),
    ['Mace Orc', 1], ['Gear Golem', 1], ['Siege Goblin', 1],
  ]),
};
export const STARTER_NAMES = {
  wildwood: 'Wildwood Starter',
  shimmerfolk: 'Shimmerfolk Starter',
  ironclad: 'Ironclad Starter',
};

export function validateDeck(ids) {
  const errors = [];
  if (!Array.isArray(ids) || ids.length !== 30) errors.push('A deck needs exactly 30 cards.');
  const counts = {};
  for (const id of ids || []) {
    if (!cardById[id]) { errors.push(`Unknown card: ${id}`); continue; }
    counts[id] = (counts[id] || 0) + 1;
  }
  for (const [id, n] of Object.entries(counts)) {
    const c = cardById[id];
    const max = c.rarity === 'legendary' ? 1 : 2;
    if (n > max) errors.push(`Too many copies of ${c.name} (max ${max}).`);
  }
  return { valid: errors.length === 0, errors };
}

export const totalCost = (c) => c.cost.wood + c.cost.crystal + c.cost.iron;
export const costText = (cost) => {
  const parts = [];
  if (cost.wood) parts.push(`🌲${cost.wood}`);
  if (cost.crystal) parts.push(`💎${cost.crystal}`);
  if (cost.iron) parts.push(`⛏️${cost.iron}`);
  return parts.join(' ');
};
export const hasAbility = (card, word) => new RegExp(`\\b${word}\\b`).test(card.ability || '');

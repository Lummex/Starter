// One-off helper that writes src/content/card-art.json (edit prompts there afterwards).
import fs from 'node:fs';
const STYLE = 'dark fantasy trading card game character art, richly painted, stylized chunky proportions, dramatic rim lighting, glowing eyes and gems, moody toxic green glow, scrap-metal goblin look with rusty nails, patched leather, bottle caps and bones';
const TAIL = 'dark atmospheric background, no text, no letters, no logos, no watermark, original character';
const who = {
  'goblin-scrounger': 'a skinny hunched green goblin miner with huge ears, swinging a rusty pickaxe at glowing green crystals, grinning with pointy teeth',
  'goblin-scrapper': 'a snarling green goblin brawler in patched leather and a bottle-cap helmet, wielding a jagged scrap-metal sword, frenzied and ragged',
  'goblin-slinger': 'a cheeky green goblin slinging a skull from a sling made of rope and bones, tongue out',
  'goblin-bomber': 'a wild-eyed green goblin lunatic with a smoking bundle of barrel bombs strapped to his fists, singed eyebrows, maniacal grin',
  'goblin-sneak': 'a sneaky weasel-faced green goblin in a dark hood creeping with two tiny rusty daggers, sly grin',
  'wolf-rider': 'a fierce green goblin riding a mangy snarling wolf at a charge, holding a lance made of a rusty spear, spiked scrap armor',
  'grubnaks-big-boss-troll': 'a gigantic hulking troll tyrant in spiked scrap armor carrying an enormous club made of a tree trunk and rusty nails, small goblins cheering behind him',
  'shard-guzzler': 'a fat green goblin with a huge round belly glowing with swallowed crystal shards, holding a pickaxe and a crystal in his mouth, comically greedy',
  'goblin-grunt': 'a scruffy green goblin grunt with a dented bucket helmet and a crude wooden club, goofy determined face',
  'goblin-pebbler': 'a small green goblin holding a big bone club, with a bone necklace, dopey grin',
  'goblin-smith-miner': 'a green goblin blacksmith-miner with a soot-covered apron, a pickaxe and a hammer, sparks flying from an anvil made of scrap',
  'rotgut-grenadier': 'a green goblin throwing a bottle grenade with a burning rag fuse, goggles pushed up on his forehead, gleeful grin',
  'shiv-rat': 'a rat-like skinny green goblin with a tiny jagged shiv in his teeth, crouching in shadow, sneaky',
  'skullbasher-rusher': 'a muscular green goblin charging forward with a skull-shaped battering helmet, shouting, motion lines of dust',
  'junk-shaman': 'a green goblin shaman in a robe of rags with a staff topped by a glowing tin can and bones, junk floating around him, glowing green eyes',
  'blastrat-sapper': 'a green goblin sapper hugging a lit powder keg with a fuse, one eye twitching, a tiny pickaxe on his belt, nervous grin',
};
const out = Object.entries(who).map(([cardId, d]) => ({ cardId, file: `art/cards/${cardId}.webp`, prompt: `${STYLE}, ${d}, ${TAIL}` }));
fs.writeFileSync(new URL('../src/content/card-art.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');

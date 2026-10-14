// type: c creature, s spell, w structure. tuple: [name,type,cost,role,atk,hp,kw,fx,flavor]
export const FACTIONS = ['Fire', 'Frost', 'Forest', 'Shadow'];
export const SYMBOL = { Fire: '🔥', Frost: '❄️', Forest: '🍃', Shadow: '🌙' };
export const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'];
export const ROLES = ['Miner', 'Builder', 'Warrior', 'Guardian', 'Raider', 'Siege', 'Champion'];
export const TYPE_NAME = { c: 'Creature', s: 'Spell', w: 'Structure' };

const RAW = {
  Fire: {
    Common: [
      ['Ember Imp', 'c', 1, 'Warrior', 2, 1, [], null, 'Small, loud, and always hungry.'],
      ['Cinder Raider', 'c', 2, 'Raider', 3, 2, [], null, 'He rides in on the smoke of your last village.'],
      ['Spark Bolt', 's', 1, null, 0, 0, [], { k: 'dmg', n: 2 }, 'A flick of the wrist, a scream in the dark.'],
      ['Spiked Wall', 'w', 2, null, 0, 4, ['spiked'], null, 'Every stake was a lesson learned.'],
      ['Flame Slinger', 'c', 3, 'Warrior', 3, 4, [], null, 'Her sling never holds stone, only ember.'],
      ['Ash Barricade', 'w', 1, null, 0, 3, [], null, 'Burnt timber still stops a charge.'],
      ['Magma Crawler', 'c', 3, 'Siege', 3, 3, ['siege'], null, 'It eats walls and weeps molten tears.'],
      ['Scorch Brute', 'c', 4, 'Warrior', 5, 4, [], null, 'Not the brightest flame, but the hottest.'],
      ['Searing Gaze', 's', 3, null, 0, 0, [], { k: 'face', n: 3 }, 'The Stronghold remembers every glare.'],
      ['Ashen Pup', 'c', 1, 'Raider', 1, 2, [], null, 'Raised in the cinders, loyal to the spark.'],
    ],
    Rare: [
      ['Fire Whelp', 'c', 3, 'Raider', 3, 3, ['flying'], null, 'Small wings, enormous appetite.'],
      ['Lava Ram', 'c', 4, 'Siege', 4, 5, ['siege'], null, 'Gates are only suggestions.'],
      ['Fireball', 's', 4, null, 0, 0, [], { k: 'dmg', n: 5 }, 'Say the word. Watch the sky open.'],
      ['Inferno Rider', 'c', 3, 'Raider', 4, 2, ['charge'], null, 'Arrives before the echo of hooves.'],
      ['Forgefire Wall', 'w', 3, null, 0, 6, ['spiked'], null, 'Forged at the heart of the mountain.'],
    ],
    Epic: [
      ['Magma Colossus', 'c', 6, 'Siege', 7, 8, ['siege'], null, 'The mountain stood up and chose a side.'],
      ['Flamewave', 's', 4, null, 0, 0, [], { k: 'dmgAll', n: 2 }, 'A tide of fire with no shore.'],
      ['Drake Marauder', 'c', 5, 'Raider', 5, 4, ['flying', 'charge'], null, 'It strikes first and asks nothing.'],
    ],
    Legendary: [
      ['Pyrrhax the Ember Dragon', 'c', 8, 'Champion', 8, 7, ['flying', 'siege'], null, 'When Pyrrhax yawns, cities remember.'],
      ['Vulkar Emberlord', 'c', 6, 'Champion', 6, 6, ['charge', 'lifesteal'], null, 'Crowned in cinders, fed by fear.'],
    ],
  },
  Frost: {
    Common: [
      ['Rime Scout', 'c', 1, 'Warrior', 1, 3, [], null, 'Frostbite is just the cold saying hello.'],
      ['Frost Sentry', 'c', 2, 'Guardian', 1, 4, ['guardian'], null, 'He has not moved since the last thaw.'],
      ['Stone Wall', 'w', 2, null, 0, 5, [], null, 'Cold, grey, and utterly unimpressed.'],
      ['Flash Freeze', 's', 2, null, 0, 0, [], { k: 'freeze' }, 'Time slows to a crystalline crawl.'],
      ['Glacier Guard', 'c', 3, 'Guardian', 2, 5, ['guardian'], null, 'Patient as a glacier, and as heavy.'],
      ['Iron Gate', 'w', 3, null, 0, 4, ['gate'], null, 'Swings open for friends. Never for foes.'],
      ['Snow Wolf', 'c', 2, 'Raider', 2, 3, [], null, 'You hear the snow crunch. Then nothing.'],
      ['Frostmason', 'c', 2, 'Builder', 1, 3, [], null, 'Builds with ice, mortared by winter.'],
      ['Icicle Lance', 's', 3, null, 0, 0, [], { k: 'dmg', n: 3 }, 'A single shard, a single purpose.'],
      ['Hail Warrior', 'c', 4, 'Warrior', 4, 5, [], null, 'Marches through the storm he carries.'],
    ],
    Rare: [
      ['Rampart Captain', 'c', 4, 'Guardian', 3, 5, ['guardian', 'fortify'], null, 'Hold the line. Then hold it harder.'],
      ['Aegis Knight', 'c', 4, 'Guardian', 2, 4, ['guardian', 'shield'], null, 'Her shield has never met a scratch.'],
      ['Snow Owl', 'c', 3, 'Raider', 2, 3, ['flying'], null, 'Silent wings over a silent field.'],
      ['Permafrost Wall', 'w', 3, null, 0, 7, [], null, 'Older than the kingdom behind it.'],
      ['Deepfreeze', 's', 5, null, 0, 0, [], { k: 'freezeAll' }, 'The whole battlefield holds its breath.'],
    ],
    Epic: [
      ['Frozen Titan', 'c', 6, 'Guardian', 5, 9, ['guardian'], null, 'Winter, given a name and a fist.'],
      ["Winter's Embrace", 's', 4, null, 0, 0, [], { k: 'shieldAll' }, 'A cold hug that turns blades aside.'],
      ['Bastion Architect', 'c', 5, 'Builder', 3, 6, ['fortify'], null, 'Draws a fortress in the frost, then it stands.'],
    ],
    Legendary: [
      ['Glacius, the Everwinter', 'c', 8, 'Champion', 7, 8, ['guardian', 'shield'], null, 'He is the reason the lake never thaws.'],
      ['Queen Isolde of Rime', 'c', 6, 'Champion', 4, 7, ['guardian', 'fortify'], null, 'Her court is silent, her law is absolute.'],
    ],
  },
  Forest: {
    Common: [
      ['Pebble Digger', 'c', 1, 'Miner', 1, 2, [], null, 'Finds a gem in every shovelful. Mostly dirt.'],
      ['Sapling Builder', 'c', 2, 'Builder', 1, 3, [], null, 'Stacks logs like a squirrel stacks nuts.'],
      ['Wooden Palisade', 'w', 1, null, 0, 3, [], null, 'Sharpened on one end, hopeful on the other.'],
      ['Healing Moss', 's', 2, null, 0, 0, [], { k: 'heal', n: 4 }, 'Soft, green, and astonishingly effective.'],
      ['Thornback', 'c', 3, 'Warrior', 3, 4, [], null, 'Every thorn is a promise.'],
      ['Deep Miner', 'c', 3, 'Miner', 2, 3, [], null, 'Digs where the roots end.'],
      ['Watchtower', 'w', 2, null, 0, 3, ['watchtower'], null, 'Always one eye on the treeline.'],
      ['Verdant Growth', 's', 2, null, 0, 0, [], { k: 'buff', n: 2 }, 'Spring arrives early and angry.'],
      ['Briar Guard', 'c', 3, 'Guardian', 2, 5, ['guardian'], null, 'Wears the forest like armor.'],
      ['Rootwalker', 'c', 4, 'Warrior', 4, 5, [], null, 'Each step plants a grudge.'],
    ],
    Rare: [
      ['Vein Prospector', 'c', 3, 'Miner', 2, 4, [], null, 'He can smell silver through solid stone.'],
      ['Master Builder', 'c', 3, 'Builder', 2, 4, ['repair'], null, 'Knocks twice, then the wall mends itself.'],
      ['Thornhedge', 'w', 3, null, 0, 6, ['spiked'], null, 'A garden path that bites.'],
      ['Bountiful Harvest', 's', 3, null, 0, 0, [], { k: 'draw', n: 2 }, 'The earth gives, and gives again.'],
      ['Warden of Roots', 'c', 4, 'Guardian', 3, 6, ['guardian', 'repair'], null, 'Roots run deep, and so does his duty.'],
    ],
    Epic: [
      ['Elder Treant', 'c', 6, 'Guardian', 5, 9, ['guardian', 'fortify'], null, 'It has outlived three kingdoms and one flood.'],
      ['Primal Surge', 's', 3, null, 0, 0, [], { k: 'buff', n: 3 }, 'Life, unrestrained.'],
      ['Motherlode Golem', 'c', 5, 'Miner', 3, 7, ['shield'], null, 'Walking proof that the vein runs deep.'],
    ],
    Legendary: [
      ['Yggra, the World Root', 'c', 8, 'Champion', 6, 9, ['repair', 'fortify'], null, 'Every forest is merely her fingertip.'],
      ['Thalor Oakfather', 'c', 7, 'Champion', 6, 8, ['guardian', 'fortify'], null, 'First tree, first king, last wall.'],
    ],
  },
  Shadow: {
    Common: [
      ['Venomfang Spider', 'c', 1, 'Warrior', 1, 1, ['poison'], null, 'One bite is all the argument it needs.'],
      ['Night Prowler', 'c', 2, 'Raider', 3, 2, [], null, 'You never see the second step.'],
      ['Brute Shover', 'c', 3, 'Warrior', 3, 4, ['shove'], null, 'Not a fighter. A mover of problems.'],
      ['Dusk Wall', 'w', 2, null, 0, 4, [], null, 'It was not there a moment ago.'],
      ['Mind Trick', 's', 2, null, 0, 0, [], { k: 'bounce' }, 'Forget you were ever here.'],
      ['Whisper Thief', 'c', 1, 'Raider', 2, 1, [], null, 'Took your purse and your doubts.'],
      ['Cursed Sentinel', 'c', 3, 'Guardian', 2, 5, ['guardian'], null, 'Bound to a post, bitter about it.'],
      ['Cull', 's', 2, null, 0, 0, [], { k: 'cull' }, 'The wounded always fall first.'],
      ['Bone Barricade', 'w', 1, null, 0, 3, [], null, 'Someone had to be the foundation.'],
      ['Crypt Crawler', 'c', 3, 'Siege', 3, 3, ['siege'], null, 'It gnaws through anything that was once alive.'],
    ],
    Rare: [
      ['Nightblade Assassin', 'c', 3, 'Raider', 3, 2, ['poison'], null, 'The last thing you feel is a draft.'],
      ['Shade Wraith', 'c', 3, 'Raider', 2, 3, ['flying'], null, 'It drifts through walls and old promises.'],
      ['Gravestone Wall', 'w', 3, null, 0, 6, [], null, 'Names carved in, secrets buried behind.'],
      ['Drain Life', 's', 3, null, 0, 0, [], { k: 'drain', n: 3 }, 'What was yours is now mine.'],
      ['Void Shover', 'c', 4, 'Warrior', 3, 5, ['shove'], null, 'Pushes things off the edge of the world.'],
    ],
    Epic: [
      ['Soul Reaper', 'c', 5, 'Warrior', 4, 5, ['lifesteal', 'poison'], null, 'The harvest is always ready.'],
      ['Void Rend', 's', 5, null, 0, 0, [], { k: 'destroy' }, 'A tear in the world, and one less problem.'],
      ['Banshee Queen', 'c', 4, 'Raider', 3, 3, ['flying', 'poison'], null, 'Her scream ends arguments and lives.'],
    ],
    Legendary: [
      ['Morgrath, Lord of the Void', 'c', 8, 'Champion', 6, 8, ['poison', 'lifesteal', 'shove'], null, 'Even the dark flinches when he enters.'],
      ['Nyx, the Eclipse Dragon', 'c', 7, 'Champion', 6, 6, ['flying', 'lifesteal'], null, 'She swallowed the sun, and it was delicious.'],
    ],
  },
};

const KW_TEXT = {
  shield: 'Shield: prevents the first damage it would take.',
  poison: 'Poison: destroys any creature it damages.',
  flying: 'Flying: ignores Pass walls.',
  charge: 'Charge: can act the turn it is played.',
  lifesteal: 'Lifesteal: damage dealt heals your Stronghold.',
  shove: 'Shove: instead of attacking, push an enemy at this Mine to a neighboring Mine or back to its hand.',
  fortify: 'Fortify: when played, your other creatures and structures at this Mine gain +2 Health.',
  siege: 'Siege: deals double damage to structures.',
  repair: 'Repair: at your turn start, restore 2 Health to your damaged structures at this Mine.',
  prospector: 'Prospector: +1 Ore income while at a Mine you control.',
  guardian: 'Guardian: enemies here must attack Guardians first.',
  spiked: 'Spiked: deals 2 damage to any creature that attacks it.',
  watchtower: 'Watchtower: at the start of your turn, deals 1 damage to a random enemy creature at its Mine.',
  gate: 'Iron Gate: blocks enemies on this Pass; your creatures pass freely.',
};
const FX_TEXT = {
  dmg: (n) => `Deal ${n} damage to target enemy creature or structure.`,
  face: (n) => `Deal ${n} damage to the enemy Stronghold.`,
  dmgAll: (n) => `Deal ${n} damage to every enemy creature.`,
  heal: (n) => `Restore ${n} Health to your Stronghold.`,
  freeze: () => 'Target enemy creature cannot act during its next turn.',
  freezeAll: () => 'Enemy creatures cannot act during their next turn.',
  buff: (n) => `Target friendly creature gains +${n}/+${n}.`,
  draw: (n) => `Draw ${n} cards.`,
  bounce: () => 'Return target enemy creature to its owner\'s hand.',
  cull: () => 'Destroy target damaged enemy creature.',
  drain: (n) => `Deal ${n} damage to target enemy creature. Restore ${n} Health to your Stronghold.`,
  destroy: () => 'Destroy target enemy creature.',
  shieldAll: () => 'Your creatures gain Shield.',
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const CARDS = [];
export const STARTER = [];
for (const faction of FACTIONS) {
  for (const rarity of RARITIES) {
    RAW[faction][rarity].forEach((t, i) => {
      const [name, type, cost, role, atk, hp, kwIn, fx, flavor] = t;
      const kw = [...kwIn];
      if (role === 'Miner') kw.push('prospector');
      if (role === 'Siege' && !kw.includes('siege')) kw.push('siege');
      if (role === 'Guardian' && !kw.includes('guardian')) kw.push('guardian');
      const lines = kw.map((k) => KW_TEXT[k]);
      if (fx) lines.unshift(FX_TEXT[fx.k](fx.n));
      const card = { id: slug(name), name, type, cost, role, atk, hp, kw, fx, flavor, faction, rarity, text: lines.join(' ') || 'No special ability.' };
      if (name.includes('Dragon')) card.dragon = true;
      CARDS.push(card);
      if (rarity === 'Common' && i < 5) STARTER.push(card.id);
    });
  }
}
export const BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const STARTER_DECK = ['Fire', 'Frost', 'Forest'].flatMap((f) => CARDS.filter((c) => c.faction === f && STARTER.includes(c.id)).flatMap((c) => [c.id, c.id]));

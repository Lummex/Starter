// Player names on the match name plates (Ken, Oct 31: "where it says your commander's name, that's where I want the player name. And maybe the commander just
// underneath it real small ... go ahead and create fake AI players. So it'll look like you're playing a real player.")

/** Where your name comes from. Online Phase A plugs the signed-in username in with setPlayerNameProvider(); until then a locally saved name, else "Player". */
let provider: (() => string | null | undefined) | null = null;
export function setPlayerNameProvider(fn: (() => string | null | undefined) | null) { provider = fn; }
export function getPlayerName(): string {
  try {
    const p = provider?.();
    if (p && p.trim()) return p.trim().slice(0, 24);
  } catch { /* fall through */ }
  try {
    const s = localStorage.getItem('oreheart.playerName');
    if (s && s.trim()) return s.trim().slice(0, 24);
  } catch { /* storage blocked */ }
  return 'Player';
}
/** Saves a local name (used until accounts exist). An empty name goes back to "Player". */
export function setPlayerName(name: string) {
  try { if (name && name.trim()) localStorage.setItem('oreheart.playerName', name.trim().slice(0, 24)); else localStorage.removeItem('oreheart.playerName'); } catch { /* storage blocked */ }
}

/** Gamer-style names for the computer opponents: fun, fantasy-flavoured, kid-friendly, made up (no real people or brands). Grouped loosely by faction. */
export const AI_NAMES: Record<'goblins' | 'gnomes' | 'dwarves' | 'any', string[]> = {
  goblins: [
    'MossyKnuckles', 'Brakka_the_Bold', 'SnotRocket77', 'GrubbyGrin', 'ScrapKing_Zug', 'MudPuddle_Mike', 'Skabnose', 'RustyRizzbit', 'Gobbo_Gizmo', 'JunkpileJester',
    'WartyWarlord', 'Snikkit', 'BogBurper', 'Zogg_Smash', 'GreenGrumble', 'PotholePete', 'Krunchtooth', 'SwampStomper', 'Nibblez', 'TinCanTyrant',
    'Ratbag_Rex', 'SoggyBiscuit', 'Gubbins99', 'SkullfangFan', 'ToeJam_Grok', 'Mudlark_Mo', 'Grizzlegut', 'LootGoblin42', 'BurpaDurp', 'Snagglesnout',
    'Wiggit_the_Wise', 'StinkbugSam', 'Klonkers', 'RubbishRuler', 'Grotbag', 'SlopBucket', 'Zibzab', 'Pickpocket_Pip', 'NoggleNoggin', 'BigEarsBork',
    'Fungus_Fred', 'Gnashgob', 'Spudsy', 'SwampSnack', 'Grimbles',
  ],
  gnomes: [
    'GearGrinder42', 'SprocketSpark', 'TinkerTwinkle', 'WhirliGig', 'Cogsworth_Jr', 'FizzlePop', 'BoltBuddy', 'PuzzleBeard', 'Gizmo_Gadgetson', 'SteamyStanley',
    'ClickClackJack', 'Wobblewrench', 'SparkplugSue', 'Knobtwiddler', 'TickTockTilly', 'Dabbleton', 'Pipsqueak_Prime', 'GadgetGranny', 'Fizzbang', 'CleverClockwork',
    'Bimble_the_Bright', 'Widget_Wizard', 'ZapZapZinnia', 'Tinkerbolt', 'Springheel_Sid', 'Thingamajig', 'BubbleBrass', 'NiftyNoodle', 'Professor_Plink', 'Wigglegear',
    'Doohickey', 'Crankshaft_Kit', 'ShinyShimbles', 'Pocketwatch', 'Zizzle', 'Glimmerbolt', 'RotorRosie', 'Fiddlesticks9', 'CopperKettle', 'MiniMagnet',
    'Quibble', 'Gearlocke', 'Bimbalo', 'Ratchet_Rae', 'Twinklebolt',
  ],
  dwarves: [
    'IronBeard_Bjorn', 'StoneSoup', 'Grumblehammer', 'AnvilAndy', 'DeepDelver', 'Brundle_Braid', 'RockyRumbles', 'Thunderbelly', 'OreHoarder', 'Kragg_Kettleback',
    'MithrilMaggie', 'Boulderbash', 'PickaxePaddy', 'GruffGruntle', 'Tunnelvision', 'Hammerhand_Hilda', 'Coalcracker', 'Stonebrow', 'Bronzebottom', 'Gravelgut',
    'Mossbeard', 'Durnik_Deepdig', 'Flintspark', 'Granite_Gran', 'BigBoots_Borin', 'Rumblebrew', 'ShaftMaster', 'Cragjaw', 'Helmet_Hugo', 'Ironmole',
    'Grubbin_Goldseeker', 'Thane_Tumble', 'Pebblepounder', 'Oakenshins', 'Forgefire_Fenna', 'Rockbiter_Rolf', 'Torch_Tilda', 'Beardly', 'Gemcutter_Gus', 'Smeltdown',
    'KegRoller', 'Bramblebeard', 'Stoutheart', 'Muddy_Mattock', 'Hearthstone_Hal',
  ],
  any: [
    'Brave_Biscuit', 'CrystalCrusher', 'MinecartMayhem', 'PebbleThrower', 'CaptainCrumbs', 'NightOwl88', 'LuckyLantern', 'SirClonksalot', 'TheSneakyTurnip', 'MapleMoose',
    'PuddleJumper', 'ShardChaser', 'FrostyFrog', 'BananaBarbarian', 'Wanderwisp', 'HonkMaster', 'GlowWorm_Gwen', 'TurboTortoise', 'MightyMuffin', 'Sparkle_Knight',
    'DizzyDragonfly', 'WobblyWizard', 'CheeseQuest', 'RainbowRascal', 'Thimblethumb',
  ],
};

/** A believable opponent name for one match: usually from the opponent faction's list, sometimes from the shared one. `rand` is 0..1 (seeded in test pages). */
export function pickAiName(faction: string, rand: () => number = Math.random): string {
  const own = (AI_NAMES as any)[faction] as string[] | undefined;
  const list = own && rand() < 0.75 ? own : AI_NAMES.any.concat(own || []);
  return list[Math.floor(rand() * list.length) % list.length];
}

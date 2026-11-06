-- The 33 new cards (Ken approved the Nov 5 proposal; built on factory/issue-8 by Anvil, merged into pvp-nov2 on Nov 6: Mama Grubsnout,
-- Pox Doctor Ratsbane, Sooey! Hog Call, Wispmother Tallulah, Jinxmaster Wobblewick, Chain Lightning Lollapalooza, Engineer Cogsworth,
-- Forgemaster Hildegrim, Stand Fast, Lads! and the rest) join the server's catalog at their rarities: packs deal them, the Collection
-- and the Deck Builder own and use them, and the upgrade steps apply by rarity like any card. The 3 tokens (Piglet, Spark Wisp,
-- Clockwork Mule) appear in play only: never in the catalog, packs, collections or decks. Stonebreaker Miner is a cost-1 Gatherer,
-- so it joins the cheap-Miner slot of a pack (pack_miner_ids). Same card data as the game (cards.json): the generated block below.
-- Also here (Anvil-online follow-ups): admin_set_setting learns shop_badges, pack_bundles, pack_bundle_promises and ranked_ladder,
-- and the referee can ask whether a player owns a Commander copy at a tier (pvp_has_copy), for "fight as this copy" (Ken, Nov 6).

-- BEGIN GENERATED CARDS (supabase/scripts/make-cards-sql.mjs; do not edit by hand)
-- 99 cards from cards.json (98 can be dealt in packs; 3 tokens left out); content_version cards:c98d1af63d65.
insert into public.cards (id, name, type, faction, rarity, cost, in_packs, disabled, content_version) values
  ('axe-thrower', 'Grudge Hurler', 'creature', 'dwarves', 'Uncommon', 3, true, false, 'cards:c98d1af63d65'),
  ('bang-snap-imp', 'Bang-Snap Imp', 'creature', 'goblins', 'Common', 2, true, false, 'cards:c98d1af63d65'),
  ('barrelback-courier', 'Barrelback Courier', 'creature', 'dwarves', 'Common', 4, true, false, 'cards:c98d1af63d65'),
  ('battle-cry', 'Thunderhorn Blast', 'spell', 'dwarves', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('blastrat-sapper', 'SewerSlide Bomber', 'creature', 'goblins', 'Uncommon', 2, true, false, 'cards:c98d1af63d65'),
  ('bogwater-brewer', 'Bogwater Brewer', 'creature', 'goblins', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('brewmaster', 'Corpsman Brewlord', 'creature', 'dwarves', 'Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('chain-lightning', 'Chain Lightning Lollapalooza', 'spell', 'gnomes', 'Ultra Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('clockwork-beetle', 'Silver Scarab Automaton', 'creature', 'gnomes', 'Ultra Rare', 5, true, false, 'cards:c98d1af63d65'),
  ('crystal-cluster', 'Soul Cluster', 'crystal', 'any', 'Uncommon', 0, true, false, 'cards:c98d1af63d65'),
  ('crystal-drunk-delver', 'Gemdrunk Deepdelver', 'creature', 'dwarves', 'Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('deepforge-crossbowman', 'Marksmen Gunner', 'creature', 'dwarves', 'Uncommon', 3, true, false, 'cards:c98d1af63d65'),
  ('dwarf-miner', 'Riot Shield Bearer', 'creature', 'dwarves', 'Uncommon', 4, true, false, 'cards:c98d1af63d65'),
  ('dwarf-pickman', 'Ironjaw Big Back', 'creature', 'dwarves', 'Uncommon', 4, true, false, 'cards:c98d1af63d65'),
  ('dwarf-smith-miner', 'Anvilsworn Miner', 'creature', 'dwarves', 'Common', 1, true, false, 'cards:c98d1af63d65'),
  ('dwarf-stoneback', 'Granite Oathkeeper', 'creature', 'dwarves', 'Common', 3, true, false, 'cards:c98d1af63d65'),
  ('engineer-cogsworth', 'Engineer Cogsworth Hammerhand', 'creature', 'dwarves', 'Collector', 5, true, false, 'cards:c98d1af63d65'),
  ('fireball', 'Searing Arcane Orb', 'spell', 'gnomes', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('fizzle', 'Snuff Out', 'spell', 'any', 'Uncommon', 3, true, false, 'cards:c98d1af63d65'),
  ('fizzwick-fuse-lighter', 'Fizzwick the Fuse-Lighter', 'creature', 'goblins', 'Ultra Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('forgemaster-hildegrim', 'Forgemaster Hildegrim Ashbeard', 'creature', 'dwarves', 'Collector', 7, true, false, 'cards:c98d1af63d65'),
  ('gearward-sentinel', 'Gearward Sentinel', 'creature', 'gnomes', 'Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('glowing-geode', 'Wellspring Geode', 'crystal', 'any', 'Collector', 0, true, false, 'cards:c98d1af63d65'),
  ('glyphshield-warden', 'Glyphshield Warden', 'creature', 'gnomes', 'Uncommon', 3, true, false, 'cards:c98d1af63d65'),
  ('gnome-cogger', 'Voldawright', 'creature', 'gnomes', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('gnome-illusionist', 'Mirrorveil Illusionist', 'creature', 'gnomes', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('gnome-prospector', 'Gemsinger Miner', 'creature', 'gnomes', 'Common', 1, true, false, 'cards:c98d1af63d65'),
  ('gnome-smith-miner', 'Arcsmith Miner', 'creature', 'gnomes', 'Common', 1, true, false, 'cards:c98d1af63d65'),
  ('gnome-tinker', 'Aegis Tinkerer', 'creature', 'gnomes', 'Common', 3, true, false, 'cards:c98d1af63d65'),
  ('gnome-widget', 'Brawler Adept', 'creature', 'gnomes', 'Common', 2, true, false, 'cards:c98d1af63d65'),
  ('goblin-bomber', 'Bare Knuckle Lunatic', 'creature', 'goblins', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('goblin-grunt', 'Snotskull Grunt', 'creature', 'goblins', 'Common', 3, true, false, 'cards:c98d1af63d65'),
  ('goblin-pebbler', 'Boneknocker', 'creature', 'goblins', 'Common', 2, true, false, 'cards:c98d1af63d65'),
  ('goblin-scrapper', 'Bowler Brawler', 'creature', 'goblins', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('goblin-scrounger', 'Goblin Miner', 'creature', 'goblins', 'Common', 1, true, false, 'cards:c98d1af63d65'),
  ('goblin-slinger', 'Skullflinger', 'creature', 'goblins', 'Uncommon', 2, true, false, 'cards:c98d1af63d65'),
  ('goblin-smith-miner', 'Scrapsmith Miner', 'creature', 'goblins', 'Uncommon', 1, true, false, 'cards:c98d1af63d65'),
  ('goblin-sneak', 'Backstabbing Thief', 'creature', 'goblins', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('grease-gremlin', 'Grease Gremlin', 'creature', 'goblins', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('grimhold-ravager', 'Grimhold Ravager', 'creature', 'dwarves', 'Uncommon', 4, true, false, 'cards:c98d1af63d65'),
  ('grubnaks-big-boss-troll', 'Gronkowski Troll Tyrant', 'creature', 'goblins', 'Collector', 9, true, false, 'cards:c98d1af63d65'),
  ('grumble-drummer', 'Grumble Drummer', 'creature', 'dwarves', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('gyrocopter-ace', 'Thunderwing Gyronaut', 'creature', 'gnomes', 'Ultra Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('hammerhand-apprentice', 'Hammerhand Apprentice', 'creature', 'dwarves', 'Common', 2, true, false, 'cards:c98d1af63d65'),
  ('healing-light', 'Field Bandage', 'spell', 'any', 'Uncommon', 2, true, false, 'cards:c98d1af63d65'),
  ('heart-of-the-fallen', 'Heart of the Fallen', 'crystal', 'any', 'Ultra Rare', 0, true, false, 'cards:c98d1af63d65'),
  ('hex-cadet', 'Hex Cadet', 'creature', 'gnomes', 'Common', 2, true, false, 'cards:c98d1af63d65'),
  ('hexbolt-tinker', 'Hexbolt Tinker', 'creature', 'gnomes', 'Uncommon', 3, true, false, 'cards:c98d1af63d65'),
  ('hexfuse-battery-golem', 'Hexfuse Battery Golem', 'creature', 'gnomes', 'Ultra Rare', 5, true, false, 'cards:c98d1af63d65'),
  ('hexwright-apprentice', 'Hexslinger Apprentice', 'creature', 'gnomes', 'Uncommon', 2, true, false, 'cards:c98d1af63d65'),
  ('hold-it', 'Pickpocket!', 'spell', 'goblins', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('ironhammer-berserker', 'Bloodbeard Berserker', 'creature', 'dwarves', 'Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('jinxmaster-wobblewick', 'Grand Jinxmaster Wobblewick', 'creature', 'gnomes', 'Collector', 5, true, false, 'cards:c98d1af63d65'),
  ('junk-catapult-crew', 'Junk Catapult Crew', 'creature', 'goblins', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('junk-shaman', 'Junk Shaman', 'creature', 'goblins', 'Ultra Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('lens-grinder-lorelei', 'Lens Grinder Lorelei', 'creature', 'gnomes', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('mama-grubsnout', 'Mama Grubsnout, Brood Mother', 'creature', 'goblins', 'Collector', 7, true, false, 'cards:c98d1af63d65'),
  ('master-smith-durga', 'Master Smith Durga Ironthumb', 'creature', 'dwarves', 'Ultra Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('meteor-strike', 'Starfall Cataclysm', 'spell', 'gnomes', 'Collector', 6, true, false, 'cards:c98d1af63d65'),
  ('mirror-hex', 'Hex Reversal', 'spell', 'any', 'Ultra Rare', 7, false, true, 'cards:c98d1af63d65'),
  ('motherlode', 'Motherlode', 'crystal', 'any', 'Collector', 0, true, false, 'cards:c98d1af63d65'),
  ('mule-wrangler-nessa', 'Mule Wrangler Nessa', 'creature', 'dwarves', 'Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('oathbound-pikeman', 'Oathbound Overwatch', 'creature', 'dwarves', 'Ultra Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('overclocked-conduit', 'Overclocked Aethervein', 'creature', 'gnomes', 'Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('pebble-tosser', 'Pebble Tosser', 'creature', 'dwarves', 'Common', 2, true, false, 'cards:c98d1af63d65'),
  ('phase-stalker', 'Gnome Plow', 'creature', 'gnomes', 'Uncommon', 3, true, false, 'cards:c98d1af63d65'),
  ('pox-doctor-ratsbane', 'Pox Doctor Ratsbane', 'creature', 'goblins', 'Collector', 5, true, false, 'cards:c98d1af63d65'),
  ('prospectors-prayer', 'Desperate Plunder', 'spell', 'any', 'Rare', 0, true, false, 'cards:c98d1af63d65'),
  ('queen-brunhilda-stonebeard', 'Queen Brunhilda', 'creature', 'dwarves', 'Collector', 11, true, false, 'cards:c98d1af63d65'),
  ('ram-rider', 'Thunderhorn Ram Rider', 'creature', 'dwarves', 'Ultra Rare', 7, true, false, 'cards:c98d1af63d65'),
  ('ratchet-runt', 'Ratchet Runt', 'creature', 'gnomes', 'Common', 2, true, false, 'cards:c98d1af63d65'),
  ('rotgut-grenadier', 'Goblin Chef', 'creature', 'goblins', 'Uncommon', 3, true, false, 'cards:c98d1af63d65'),
  ('rune-scribe-nimbletoe', 'Rune-Scribe Nimbletoe', 'creature', 'gnomes', 'Ultra Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('rune-splitter', 'Door Splitter', 'creature', 'dwarves', 'Uncommon', 4, true, false, 'cards:c98d1af63d65'),
  ('runic-siphoner', 'Soul Stone Siphoner', 'creature', 'gnomes', 'Uncommon', 4, true, false, 'cards:c98d1af63d65'),
  ('runt-piglet', 'Runt Piglet', 'creature', 'goblins', 'Common', 1, true, false, 'cards:c98d1af63d65'),
  ('second-wind', 'Emergency Rations', 'spell', 'dwarves', 'Ultra Rare', 5, true, false, 'cards:c98d1af63d65'),
  ('shard-guzzler', 'Goblin Rocket Rider', 'creature', 'goblins', 'Ultra Rare', 3, true, false, 'cards:c98d1af63d65'),
  ('shield-bubble', 'Ironclad Bulwark', 'spell', 'dwarves', 'Uncommon', 2, true, false, 'cards:c98d1af63d65'),
  ('shield-cadet', 'Shield Cadet', 'creature', 'dwarves', 'Common', 2, true, false, 'cards:c98d1af63d65'),
  ('shieldbeard', 'Ironwall Shieldbeard', 'creature', 'dwarves', 'Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('shieldwall-sergeant-brasha', 'Shieldwall Sergeant Brasha', 'creature', 'dwarves', 'Ultra Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('shiv-rat', 'Shiv Rat', 'creature', 'goblins', 'Common', 2, true, false, 'cards:c98d1af63d65'),
  ('skullbasher-rusher', 'Skullbasher Rusher', 'creature', 'goblins', 'Uncommon', 3, true, false, 'cards:c98d1af63d65'),
  ('sludge-lobber', 'Sludge Lobber', 'creature', 'goblins', 'Common', 2, true, false, 'cards:c98d1af63d65'),
  ('snot-sergeant-gurk', 'Snot Sergeant Gurk', 'creature', 'goblins', 'Ultra Rare', 4, true, false, 'cards:c98d1af63d65'),
  ('sooey-hog-call', 'Sooey! Hog Call', 'spell', 'goblins', 'Collector', 5, true, false, 'cards:c98d1af63d65'),
  ('soul-shard', 'Soul Shard', 'crystal', 'any', 'Common', 0, true, false, 'cards:c98d1af63d65'),
  ('spark-caddy', 'Spark Caddy', 'creature', 'gnomes', 'Uncommon', 3, true, false, 'cards:c98d1af63d65'),
  ('spark-gnome', 'Stormcaller Savant', 'creature', 'gnomes', 'Uncommon', 3, true, false, 'cards:c98d1af63d65'),
  ('spell-snap', 'Unweave', 'spell', 'gnomes', 'Rare', 5, true, false, 'cards:c98d1af63d65'),
  ('stand-fast-lads', 'Stand Fast, Lads!', 'spell', 'dwarves', 'Collector', 6, true, false, 'cards:c98d1af63d65'),
  ('stonebreaker-miner', 'Stonebreaker Miner', 'creature', 'dwarves', 'Common', 1, true, false, 'cards:c98d1af63d65'),
  ('stray-spark-wisp', 'Stray Spark Wisp', 'creature', 'gnomes', 'Common', 1, true, false, 'cards:c98d1af63d65'),
  ('the-great-steam-golem', 'The Arcane Colossus', 'creature', 'gnomes', 'Collector', 9, true, false, 'cards:c98d1af63d65'),
  ('tunnel-rush', 'Rat-Tunnel Ambush', 'spell', 'goblins', 'Uncommon', 2, true, false, 'cards:c98d1af63d65'),
  ('venom-shiv', 'Venom Shiv', 'spell', 'goblins', 'Uncommon', 2, true, false, 'cards:c98d1af63d65'),
  ('wispmother-tallulah', 'Wispmother Tallulah', 'creature', 'gnomes', 'Collector', 5, true, false, 'cards:c98d1af63d65'),
  ('wolf-rider', 'Mangewolf Rider', 'creature', 'goblins', 'Ultra Rare', 5, true, false, 'cards:c98d1af63d65')
on conflict (id) do update set name = excluded.name, type = excluded.type, faction = excluded.faction,
  rarity = excluded.rarity, cost = excluded.cost, in_packs = excluded.in_packs, disabled = excluded.disabled,
  content_version = excluded.content_version;
-- the deck checks know every deck card id (settings card_ids), tokens left out
update public.settings set value = '["axe-thrower","bang-snap-imp","barrelback-courier","battle-cry","blastrat-sapper","bogwater-brewer","brewmaster","chain-lightning","clockwork-beetle","crystal-cluster","crystal-drunk-delver","deepforge-crossbowman","dwarf-miner","dwarf-pickman","dwarf-smith-miner","dwarf-stoneback","engineer-cogsworth","fireball","fizzle","fizzwick-fuse-lighter","forgemaster-hildegrim","gearward-sentinel","glowing-geode","glyphshield-warden","gnome-cogger","gnome-illusionist","gnome-prospector","gnome-smith-miner","gnome-tinker","gnome-widget","goblin-bomber","goblin-grunt","goblin-pebbler","goblin-scrapper","goblin-scrounger","goblin-slinger","goblin-smith-miner","goblin-sneak","grease-gremlin","grimhold-ravager","grubnaks-big-boss-troll","grumble-drummer","gyrocopter-ace","hammerhand-apprentice","healing-light","heart-of-the-fallen","hex-cadet","hexbolt-tinker","hexfuse-battery-golem","hexwright-apprentice","hold-it","ironhammer-berserker","jinxmaster-wobblewick","junk-catapult-crew","junk-shaman","lens-grinder-lorelei","mama-grubsnout","master-smith-durga","meteor-strike","mirror-hex","motherlode","mule-wrangler-nessa","oathbound-pikeman","overclocked-conduit","pebble-tosser","phase-stalker","pox-doctor-ratsbane","prospectors-prayer","queen-brunhilda-stonebeard","ram-rider","ratchet-runt","rotgut-grenadier","rune-scribe-nimbletoe","rune-splitter","runic-siphoner","runt-piglet","second-wind","shard-guzzler","shield-bubble","shield-cadet","shieldbeard","shieldwall-sergeant-brasha","shiv-rat","skullbasher-rusher","sludge-lobber","snot-sergeant-gurk","sooey-hog-call","soul-shard","spark-caddy","spark-gnome","spell-snap","stand-fast-lads","stonebreaker-miner","stray-spark-wisp","the-great-steam-golem","tunnel-rush","venom-shiv","wispmother-tallulah","wolf-rider"]'::jsonb, updated_at = now() where key = 'card_ids';
-- END GENERATED CARDS

-- the cheap-Miner slot: the cost-1 Gatherers and Smiths; Stonebreaker Miner (Dwarf, Common, cost 1 Gatherer) is one too
update public.settings set value = value || '["stonebreaker-miner"]'::jsonb, updated_at = now()
  where key = 'pack_miner_ids' and jsonb_typeof(value) = 'array' and not (value ? 'stonebreaker-miner');

-- ---------------------------------------------------------------------------
-- The referee asks whether a player owns a copy of a card at a tier (1 = Original): the Commander copy he asked to fight as
-- ---------------------------------------------------------------------------
create or replace function public.pvp_has_copy(p_user uuid, p_card text, p_tier integer) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_referee();
  return exists (select 1 from public.card_instances ci
                 where ci.owner_id = p_user and ci.card_id = p_card and ci.status = 'owned' and ci.tier = greatest(1, least(5, coalesce(p_tier, 1))));
end $$;
revoke all on function public.pvp_has_copy(uuid, text, integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.pvp_has_copy(uuid, text, integer) to service_role; end if;
end $$;

-- ---------------------------------------------------------------------------
-- admin_set_setting: the four keys that fell into the word-list branch get their own shapes
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_setting(p_key text, p_value jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  old jsonb := private.setting(p_key);
  v jsonb := p_value;
  bad text;
  lo integer; hi integer;
  sizes int[];
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if p_key is null or not (p_key = any (private.editable_settings())) then raise exception 'that setting can''t be changed here'; end if;
  select r.lo, r.hi into lo, hi from private.int_setting_range(p_key) r;
  if lo is not null then
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then raise exception 'must be a whole number'; end if;
    if (v #>> '{}')::numeric < lo or (v #>> '{}')::numeric > hi then raise exception 'must be % to %', lo, hi; end if;
    v := to_jsonb((v #>> '{}')::int);
  elsif p_key in ('region_counts', 'dashboard_counts') then
    if jsonb_typeof(v) <> 'boolean' then raise exception 'must be true or false'; end if;
  elsif p_key = 'regions' then
    -- a list of {id, name, edge, enabled}: id = letters, digits and dashes (2-20), name 1-30 characters, edge one Supabase offers, enabled true/false;
    -- ids unique, at least one enabled, at most 12
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < 1 or jsonb_array_length(v) > 12 then raise exception 'must be a list of 1 to 12 regions'; end if;
    select coalesce(x ->> 'id', '?') into bad from jsonb_array_elements(v) e(x)
      where jsonb_typeof(x) <> 'object' or not (x ->> 'id') ~ '^[a-z][a-z0-9-]{1,19}$' or coalesce(length(btrim(x ->> 'name')), 0) not between 1 and 30
         or not (x ->> 'edge') = any (private.edge_regions()) or jsonb_typeof(x -> 'enabled') <> 'boolean' limit 1;
    if found then raise exception 'each region needs an id (letters, digits, dashes), a name (1-30 characters), an edge Supabase offers and enabled true/false ("%")', bad; end if;
    if (select count(distinct x ->> 'id') from jsonb_array_elements(v) e(x)) <> jsonb_array_length(v) then raise exception 'two regions share an id'; end if;
    if not exists (select 1 from jsonb_array_elements(v) e(x) where (x ->> 'enabled')::boolean) then raise exception 'at least one region must be enabled'; end if;
    v := (select jsonb_agg(jsonb_build_object('id', x ->> 'id', 'name', btrim(x ->> 'name'), 'edge', x ->> 'edge', 'enabled', (x ->> 'enabled')::boolean)) from jsonb_array_elements(v) e(x));
  elsif p_key = 'upgrade_steps' then
    if jsonb_typeof(v) <> 'object' then raise exception 'must be an object: rarity -> four steps'; end if;
    select r.name into bad from public.rarities r where not (v ? r.name) limit 1;
    if found then raise exception 'every rarity needs its four steps (missing "%")', bad; end if;
    select k into bad from jsonb_each(v) e(k, x) where not exists (select 1 from public.rarities r where r.name = k) or jsonb_typeof(x) <> 'array' or jsonb_array_length(x) <> 4
      or exists (select 1 from jsonb_array_elements(x) y where jsonb_typeof(y) <> 'number' or (y #>> '{}')::numeric <> trunc((y #>> '{}')::numeric) or (y #>> '{}')::numeric < 1 or (y #>> '{}')::numeric > 10000) limit 1;
    if found then raise exception 'each rarity takes exactly four whole numbers from 1 to 10000 ("%")', bad; end if;
  elsif p_key in ('upgrade_drop_bp', 'upgrade_drop_tiers') then
    if jsonb_typeof(v) <> 'object' then raise exception 'must be an object of whole numbers'; end if;
    select k into bad from jsonb_each(v) e(k, x) where jsonb_typeof(x) <> 'number' or (x #>> '{}')::numeric <> trunc((x #>> '{}')::numeric) or (x #>> '{}')::numeric < 0 limit 1;
    if found then raise exception 'every value must be a whole number of 0 or more ("%")', bad; end if;
    if p_key = 'upgrade_drop_tiers' then
      if not (v ? '2' and v ? '3' and v ? '4' and v ? '5') or (select count(*) from jsonb_object_keys(v)) <> 4 then raise exception 'needs the four tiers 2, 3, 4 and 5'; end if;
      if (select sum((x #>> '{}')::int) from jsonb_each(v) e(k, x)) <> 10000 then raise exception 'the four tiers must add up to 10000'; end if;
    else
      select k into bad from jsonb_each(v) e(k, x) where not exists (select 1 from public.rarities r where r.name = k) or (x #>> '{}')::int > 10000 limit 1;
      if found then raise exception 'rarity names only, each 0 to 10000 ("%")', bad; end if;
    end if;
  elsif p_key = 'pvp_attack_mode' then
    if jsonb_typeof(v) <> 'string' or not (v #>> '{}') in ('armed', 'window') then raise exception 'must be "armed" or "window"'; end if;
  elsif p_key = 'pack_bundles' then
    -- Nov 6: a list of {size, bonus}: 1 to 12 bundles, size 1-999 (unique; the single pack, size 1, must stay), bonus 0-999, whole numbers
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < 1 or jsonb_array_length(v) > 12 then raise exception 'must be a list of 1 to 12 bundles'; end if;
    select left(x::text, 60) into bad from jsonb_array_elements(v) e(x)
      where jsonb_typeof(x) <> 'object' or jsonb_typeof(x -> 'size') <> 'number' or jsonb_typeof(x -> 'bonus') <> 'number' limit 1;
    if found then raise exception 'each bundle is {"size": n, "bonus": n} with whole numbers (%)', bad; end if;
    select left(x::text, 60) into bad from jsonb_array_elements(v) e(x)
      where (x ->> 'size')::numeric <> trunc((x ->> 'size')::numeric) or (x ->> 'bonus')::numeric <> trunc((x ->> 'bonus')::numeric)
         or (x ->> 'size')::numeric not between 1 and 999 or (x ->> 'bonus')::numeric not between 0 and 999 limit 1;
    if found then raise exception 'each bundle needs a size from 1 to 999 and a bonus from 0 to 999, whole numbers (%)', bad; end if;
    if (select count(distinct (x ->> 'size')::int) from jsonb_array_elements(v) e(x)) <> jsonb_array_length(v) then raise exception 'two bundles share a size'; end if;
    if not exists (select 1 from jsonb_array_elements(v) e(x) where (x ->> 'size')::int = 1) then raise exception 'the single pack (size 1) must stay in the list'; end if;
    v := (select jsonb_agg(jsonb_build_object('size', (x ->> 'size')::int, 'bonus', (x ->> 'bonus')::int) order by (x ->> 'size')::int) from jsonb_array_elements(v) e(x));
  elsif p_key = 'shop_badges' then
    -- Nov 6: {"best_value": size or null, "most_popular": size or null}: each a bundle size from pack_bundles, null = badge off
    if jsonb_typeof(v) <> 'object' then raise exception 'must be an object: best_value and most_popular, each a bundle size or null'; end if;
    select k into bad from jsonb_object_keys(v) k where k not in ('best_value', 'most_popular') limit 1;
    if found then raise exception 'unknown badge "%" (best_value and most_popular only)', bad; end if;
    select k into bad from jsonb_each(v) e(k, x) where jsonb_typeof(x) not in ('null', 'number') limit 1;
    if found then raise exception 'each badge is a bundle size or null ("%")', bad; end if;
    sizes := coalesce((select array_agg((b ->> 'size')::int) from jsonb_array_elements(coalesce(private.setting('pack_bundles'), '[]'::jsonb)) b), '{}'::int[]);
    select k into bad from jsonb_each(v) e(k, x) where jsonb_typeof(x) = 'number' and not ((x #>> '{}')::numeric = any (sizes::numeric[])) limit 1;
    if found then raise exception 'each badge is a bundle size from pack_bundles or null ("%")', bad; end if;
    v := jsonb_build_object('best_value', coalesce(v -> 'best_value', 'null'::jsonb), 'most_popular', coalesce(v -> 'most_popular', 'null'::jsonb));
  elsif p_key = 'pack_bundle_promises' then
    -- Nov 6: {"<size>": {upgraded_min_tier?: 2-5, legendary_unowned?: true/false, card_back?: a word}}, each key a bundle size from pack_bundles
    if jsonb_typeof(v) <> 'object' then raise exception 'must be an object: bundle size -> promises'; end if;
    sizes := coalesce((select array_agg((b ->> 'size')::int) from jsonb_array_elements(coalesce(private.setting('pack_bundles'), '[]'::jsonb)) b), '{}'::int[]);
    select k into bad from jsonb_each(v) e(k, x) where k !~ '^[0-9]{1,3}$' or jsonb_typeof(x) <> 'object' or not (case when k ~ '^[0-9]{1,3}$' then k::int = any (sizes) else false end) limit 1;
    if found then raise exception 'each key must be a bundle size from pack_bundles, with an object of promises ("%")', bad; end if;
    select k || '.' || pk into bad from jsonb_each(v) e(k, x), jsonb_each(x) p(pk, pv)
      where pk not in ('upgraded_min_tier', 'legendary_unowned', 'card_back')
         or (pk = 'upgraded_min_tier' and jsonb_typeof(pv) <> 'number')
         or (pk = 'legendary_unowned' and jsonb_typeof(pv) <> 'boolean')
         or (pk = 'card_back' and (jsonb_typeof(pv) <> 'string' or not (pv #>> '{}') ~ '^[a-z][a-z0-9-]{0,29}$')) limit 1;
    if found then raise exception 'promises are upgraded_min_tier (2-5), legendary_unowned (true/false) and card_back (a word) ("%")', bad; end if;
    select k || '.upgraded_min_tier' into bad from jsonb_each(v) e(k, x), jsonb_each(x) p(pk, pv)
      where pk = 'upgraded_min_tier' and not ((pv #>> '{}')::numeric in (2, 3, 4, 5)) limit 1;
    if found then raise exception 'upgraded_min_tier is 2, 3, 4 or 5 ("%")', bad; end if;
  elsif p_key = 'ranked_ladder' then
    -- Nov 6: a list of {name, min}: 1 to 20 ranks, names 1-20 characters and unique, mins whole numbers 0-10000, unique, the first at 0
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < 1 or jsonb_array_length(v) > 20 then raise exception 'must be a list of 1 to 20 ranks'; end if;
    select coalesce(x ->> 'name', '?') into bad from jsonb_array_elements(v) e(x)
      where jsonb_typeof(x) <> 'object' or coalesce(length(btrim(x ->> 'name')), 0) not between 1 and 20 or jsonb_typeof(x -> 'min') <> 'number' limit 1;
    if found then raise exception 'each rank needs a name (1-20 characters) and a whole-number min ("%")', bad; end if;
    select x ->> 'name' into bad from jsonb_array_elements(v) e(x)
      where (x ->> 'min')::numeric <> trunc((x ->> 'min')::numeric) or (x ->> 'min')::numeric not between 0 and 10000 limit 1;
    if found then raise exception 'each min is a whole number from 0 to 10000 ("%")', bad; end if;
    if (select count(distinct btrim(x ->> 'name')) from jsonb_array_elements(v) e(x)) <> jsonb_array_length(v) then raise exception 'two ranks share a name'; end if;
    if (select count(distinct (x ->> 'min')::int) from jsonb_array_elements(v) e(x)) <> jsonb_array_length(v) then raise exception 'two ranks share a min'; end if;
    if (select min((x ->> 'min')::int) from jsonb_array_elements(v) e(x)) <> 0 then raise exception 'the first rank must start at 0'; end if;
    v := (select jsonb_agg(jsonb_build_object('name', btrim(x ->> 'name'), 'min', (x ->> 'min')::int) order by (x ->> 'min')::int) from jsonb_array_elements(v) e(x));
  else
    if jsonb_typeof(v) <> 'array' then raise exception 'must be a list of words'; end if;
    select x into bad from jsonb_array_elements(v) e(x) where jsonb_typeof(x) <> 'string' limit 1;
    if found then raise exception 'every entry must be a word'; end if;
    v := coalesce((select jsonb_agg(distinct w order by w) from
                     (select lower(btrim(x #>> '{}')) w from jsonb_array_elements(v) e(x)) t where w <> ''), '[]'::jsonb);
    select w into bad from jsonb_array_elements_text(v) w where w !~ '^[a-z]{2,30}$' limit 1;
    if found then raise exception 'not allowed in the list: "%" (use 2-30 letters a-z only)', bad; end if;
    if jsonb_array_length(v) > 2000 then raise exception 'too many words (max 2000)'; end if;
  end if;
  insert into public.settings (key, value, updated_at) values (p_key, v, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  perform private.audit(aid, 'set_setting', null, jsonb_build_object('key', p_key, 'value', old), jsonb_build_object('key', p_key, 'value', v), p_reason);
  return v;
end $$;

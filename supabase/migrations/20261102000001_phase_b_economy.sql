-- Oreheart Online, Phase B (Nov 2): the server's copy of the cards, packs and pack opening,
-- deck ownership, match rewards and the new settings.
-- Same rules as Phase A: players READ their own rows and WRITE nothing directly; every change
-- goes through a function; private.ledger_apply() is the only way coins move and
-- private.card_grant() the only way cards are made.

-- ---------------------------------------------------------------------------
-- Crypto randomness for pack rolls. gen_random_uuid() is built into PostgreSQL and
-- draws from the server's strong random source (the same one pgcrypto uses); the first
-- eight hex digits of a version-4 uuid are 32 fully random bits. No extension needed,
-- so the local test database and the real Supabase behave the same.
-- ---------------------------------------------------------------------------

-- A uniform random whole number from 0 to p_n - 1.
-- (p_n is at most 10000 here, so the tiny modulo bias is of no concern.)
create function private.random_below(p_n integer) returns integer
language sql volatile set search_path = '' as $$
  select (((('x' || left(replace(gen_random_uuid()::text, '-', ''), 8))::bit(32))::bigint) % greatest(p_n, 1))::int
$$;

-- "Today" for daily limits, quests and caps: the UTC calendar day.
create function private.today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'utc')::date
$$;

create function private.day_start() returns timestamptz
language sql stable set search_path = '' as $$
  select (private.today()::timestamp) at time zone 'utc'
$$;

-- ---------------------------------------------------------------------------
-- The cards (a copy of projects/oreheart-8/src/content/cards.json) and the rarity tiers.
-- ---------------------------------------------------------------------------

create table public.rarities (
  name  text primary key,
  sort  integer not null unique,
  color text not null
);
insert into public.rarities (name, sort, color) values
  ('Common',     1, '#9aa3ad'),
  ('Uncommon',   2, '#cfd6dd'),
  ('Rare',       3, '#6fb7ff'),
  ('Ultra Rare', 4, '#b56cff'),
  ('Collector',  5, '#ff7ad9');

create table public.cards (
  id              text primary key check (id ~ '^[a-z0-9-]{1,64}$'),
  name            text not null,
  type            text not null check (type in ('creature', 'spell', 'crystal')),
  faction         text not null check (faction in ('goblins', 'gnomes', 'dwarves', 'any')),
  rarity          text not null references public.rarities (name),
  cost            integer not null default 0 check (cost >= 0),
  in_packs        boolean not null default false,
  disabled        boolean not null default false,
  content_version text not null
);
create index cards_pack_pool on public.cards (rarity, faction) where in_packs;

-- BEGIN GENERATED CARDS (supabase/scripts/make-cards-sql.mjs; do not edit by hand)
-- 66 cards from cards.json (60 can be dealt in packs); content_version cards:1dae61717708.
insert into public.cards (id, name, type, faction, rarity, cost, in_packs, disabled, content_version) values
  ('axe-thrower', 'Grudge Hurler', 'creature', 'dwarves', 'Common', 3, true, false, 'cards:1dae61717708'),
  ('barrelback-courier', 'Barrelback Courier', 'creature', 'dwarves', 'Common', 4, true, false, 'cards:1dae61717708'),
  ('battle-cry', 'Thunderhorn Blast', 'spell', 'dwarves', 'Rare', 3, true, false, 'cards:1dae61717708'),
  ('blastrat-sapper', 'SewerSlide Bomber', 'creature', 'goblins', 'Uncommon', 2, true, false, 'cards:1dae61717708'),
  ('brewmaster', 'Corpsman Brewlord', 'creature', 'dwarves', 'Rare', 4, true, false, 'cards:1dae61717708'),
  ('clockwork-beetle', 'Iron Scarab Automaton', 'creature', 'gnomes', 'Rare', 5, true, false, 'cards:1dae61717708'),
  ('crystal-cluster', 'Soul Cluster', 'crystal', 'any', 'Uncommon', 0, false, false, 'cards:1dae61717708'),
  ('crystal-drunk-delver', 'Gemdrunk Deepdelver', 'creature', 'dwarves', 'Rare', 4, true, false, 'cards:1dae61717708'),
  ('deepforge-crossbowman', 'Marksmen Gunner', 'creature', 'dwarves', 'Common', 3, true, false, 'cards:1dae61717708'),
  ('dwarf-miner', 'Riot Shield Bearer', 'creature', 'dwarves', 'Common', 4, true, false, 'cards:1dae61717708'),
  ('dwarf-pickman', 'Ironjaw Big Back', 'creature', 'dwarves', 'Common', 4, true, false, 'cards:1dae61717708'),
  ('dwarf-smith-miner', 'Anvilsworn Miner', 'creature', 'dwarves', 'Common', 1, true, false, 'cards:1dae61717708'),
  ('dwarf-stoneback', 'Granite Oathkeeper', 'creature', 'dwarves', 'Common', 3, true, false, 'cards:1dae61717708'),
  ('fireball', 'Searing Arcane Orb', 'spell', 'gnomes', 'Rare', 3, true, false, 'cards:1dae61717708'),
  ('fizzle', 'Snuff Out', 'spell', 'any', 'Uncommon', 3, true, false, 'cards:1dae61717708'),
  ('gearward-sentinel', 'Gearward Sentinel', 'creature', 'gnomes', 'Common', 4, true, false, 'cards:1dae61717708'),
  ('glowing-geode', 'Wellspring Geode', 'crystal', 'any', 'Collector', 0, false, false, 'cards:1dae61717708'),
  ('glyphshield-warden', 'Glyphshield Warden', 'creature', 'gnomes', 'Uncommon', 3, true, false, 'cards:1dae61717708'),
  ('gnome-cogger', 'Voldawright', 'creature', 'gnomes', 'Rare', 3, true, false, 'cards:1dae61717708'),
  ('gnome-illusionist', 'Mirrorveil Illusionist', 'creature', 'gnomes', 'Rare', 3, true, false, 'cards:1dae61717708'),
  ('gnome-prospector', 'Gemsinger Miner', 'creature', 'gnomes', 'Common', 1, true, false, 'cards:1dae61717708'),
  ('gnome-smith-miner', 'Arcsmith Miner', 'creature', 'gnomes', 'Common', 1, true, false, 'cards:1dae61717708'),
  ('gnome-tinker', 'Aegis Tinkerer', 'creature', 'gnomes', 'Common', 3, true, false, 'cards:1dae61717708'),
  ('gnome-widget', 'Brawler Adept', 'creature', 'gnomes', 'Common', 2, true, false, 'cards:1dae61717708'),
  ('goblin-bomber', 'Bare Knuckle Lunatic', 'creature', 'goblins', 'Rare', 3, true, false, 'cards:1dae61717708'),
  ('goblin-grunt', 'Snotskull Grunt', 'creature', 'goblins', 'Common', 3, true, false, 'cards:1dae61717708'),
  ('goblin-pebbler', 'Boneknocker', 'creature', 'goblins', 'Common', 2, true, false, 'cards:1dae61717708'),
  ('goblin-scrapper', 'Bowler Brawler', 'creature', 'goblins', 'Common', 3, true, false, 'cards:1dae61717708'),
  ('goblin-scrounger', 'Goblin Miner', 'creature', 'goblins', 'Common', 1, true, false, 'cards:1dae61717708'),
  ('goblin-slinger', 'Skullflinger', 'creature', 'goblins', 'Common', 2, true, false, 'cards:1dae61717708'),
  ('goblin-smith-miner', 'Scrapsmith Miner', 'creature', 'goblins', 'Uncommon', 1, true, false, 'cards:1dae61717708'),
  ('goblin-sneak', 'Backstabbing Thief', 'creature', 'goblins', 'Rare', 3, true, false, 'cards:1dae61717708'),
  ('grimhold-ravager', 'Grimhold Ravager', 'creature', 'dwarves', 'Uncommon', 4, true, false, 'cards:1dae61717708'),
  ('grubnaks-big-boss-troll', 'Gronkowski Troll Tyrant', 'creature', 'goblins', 'Collector', 9, true, false, 'cards:1dae61717708'),
  ('gyrocopter-ace', 'Thunderwing Gyronaut', 'creature', 'gnomes', 'Ultra Rare', 4, true, false, 'cards:1dae61717708'),
  ('healing-light', 'Field Bandage', 'spell', 'any', 'Common', 2, true, false, 'cards:1dae61717708'),
  ('heart-of-the-fallen', 'Heart of the Fallen', 'crystal', 'any', 'Ultra Rare', 0, false, false, 'cards:1dae61717708'),
  ('hexwright-apprentice', 'Hexslinger Apprentice', 'creature', 'gnomes', 'Common', 2, true, false, 'cards:1dae61717708'),
  ('hold-it', 'Pickpocket!', 'spell', 'goblins', 'Rare', 3, true, false, 'cards:1dae61717708'),
  ('ironhammer-berserker', 'Bloodbeard Berserker', 'creature', 'dwarves', 'Rare', 4, true, false, 'cards:1dae61717708'),
  ('junk-shaman', 'Junk Shaman', 'creature', 'goblins', 'Ultra Rare', 3, true, false, 'cards:1dae61717708'),
  ('meteor-strike', 'Starfall Cataclysm', 'spell', 'gnomes', 'Ultra Rare', 6, true, false, 'cards:1dae61717708'),
  ('mirror-hex', 'Hex Reversal', 'spell', 'any', 'Ultra Rare', 7, false, true, 'cards:1dae61717708'),
  ('motherlode', 'Motherlode', 'crystal', 'any', 'Collector', 0, false, false, 'cards:1dae61717708'),
  ('oathbound-pikeman', 'Oathbound Overwatch', 'creature', 'dwarves', 'Common', 3, true, false, 'cards:1dae61717708'),
  ('overclocked-conduit', 'Overclocked Aethervein', 'creature', 'gnomes', 'Rare', 3, true, false, 'cards:1dae61717708'),
  ('phase-stalker', 'Gnome Plow', 'creature', 'gnomes', 'Uncommon', 3, true, false, 'cards:1dae61717708'),
  ('prospectors-prayer', 'Desperate Plunder', 'spell', 'any', 'Rare', 0, true, false, 'cards:1dae61717708'),
  ('queen-brunhilda-stonebeard', 'Queen Brunhilda', 'creature', 'dwarves', 'Collector', 11, true, false, 'cards:1dae61717708'),
  ('ram-rider', 'Thunderhorn Ram Rider', 'creature', 'dwarves', 'Ultra Rare', 7, true, false, 'cards:1dae61717708'),
  ('rotgut-grenadier', 'Goblin Chef', 'creature', 'goblins', 'Common', 3, true, false, 'cards:1dae61717708'),
  ('rune-splitter', 'Door Splitter', 'creature', 'dwarves', 'Uncommon', 4, true, false, 'cards:1dae61717708'),
  ('runic-siphoner', 'Soul Stone Siphoner', 'creature', 'gnomes', 'Uncommon', 4, true, false, 'cards:1dae61717708'),
  ('second-wind', 'Emergency Rations', 'spell', 'dwarves', 'Ultra Rare', 5, true, false, 'cards:1dae61717708'),
  ('shard-guzzler', 'Goblin Rocket Rider', 'creature', 'goblins', 'Ultra Rare', 3, true, false, 'cards:1dae61717708'),
  ('shield-bubble', 'Ironclad Bulwark', 'spell', 'dwarves', 'Uncommon', 2, true, false, 'cards:1dae61717708'),
  ('shieldbeard', 'Ironwall Shieldbeard', 'creature', 'dwarves', 'Common', 4, true, false, 'cards:1dae61717708'),
  ('shiv-rat', 'Shiv Rat', 'creature', 'goblins', 'Common', 2, true, false, 'cards:1dae61717708'),
  ('skullbasher-rusher', 'Skullbasher Rusher', 'creature', 'goblins', 'Uncommon', 3, true, false, 'cards:1dae61717708'),
  ('soul-shard', 'Soul Shard', 'crystal', 'any', 'Common', 0, false, false, 'cards:1dae61717708'),
  ('spark-gnome', 'Stormcaller Savant', 'creature', 'gnomes', 'Common', 3, true, false, 'cards:1dae61717708'),
  ('spell-snap', 'Unweave', 'spell', 'gnomes', 'Rare', 5, true, false, 'cards:1dae61717708'),
  ('the-great-steam-golem', 'The Arcane Colossus', 'creature', 'gnomes', 'Collector', 9, true, false, 'cards:1dae61717708'),
  ('tunnel-rush', 'Rat-Tunnel Ambush', 'spell', 'goblins', 'Uncommon', 2, true, false, 'cards:1dae61717708'),
  ('venom-shiv', 'Venom Shiv', 'spell', 'goblins', 'Uncommon', 2, true, false, 'cards:1dae61717708'),
  ('wolf-rider', 'Mangewolf Rider', 'creature', 'goblins', 'Rare', 5, true, false, 'cards:1dae61717708')
on conflict (id) do update set name = excluded.name, type = excluded.type, faction = excluded.faction,
  rarity = excluded.rarity, cost = excluded.cost, in_packs = excluded.in_packs, disabled = excluded.disabled,
  content_version = excluded.content_version;
-- END GENERATED CARDS

-- ---------------------------------------------------------------------------
-- Packs
-- ---------------------------------------------------------------------------

create table public.pack_types (
  id           text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  name         text not null,
  blurb        text not null default '',
  price_coins  integer not null check (price_coins >= 0),
  active       boolean not null default true,
  faction      text check (faction is null or faction in ('goblins', 'gnomes', 'dwarves')),
  max_per_day  integer not null default 50 check (max_per_day >= 0),
  art          text,
  updated_by   uuid,
  updated_at   timestamptz not null default now()
);

-- Odds are basis points per rarity (10000 = 100 %) and must add up to exactly 10000.
create function private.odds_ok(p_odds jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p_odds is not null and jsonb_typeof(p_odds) = 'object'
     and not exists (select 1 from jsonb_each(p_odds) e(k, v)
                     where k not in ('Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Collector')
                        or jsonb_typeof(v) <> 'number'
                        or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric)
                        or (v #>> '{}')::numeric < 0)
     and coalesce((select sum((v #>> '{}')::numeric) from jsonb_each(p_odds) e(k, v)), 0) = 10000
$$;

create table public.pack_slots (
  pack_type text not null references public.pack_types (id) on delete cascade,
  slot_no   integer not null check (slot_no between 1 and 20),
  count     integer not null check (count between 1 and 20),
  odds      jsonb not null check (private.odds_ok(odds)),
  primary key (pack_type, slot_no)
);

-- Every pack ever opened. The result (as returned to the player) is kept so the same
-- idem_key returns the very same opening again.
create table public.pack_openings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  pack_type     text not null,
  price_paid    integer not null check (price_paid >= 0),
  free          boolean not null default false,
  odds_snapshot jsonb not null,
  cards         text[] not null,
  idem_key      text not null unique,
  result        jsonb not null,
  created_at    timestamptz not null default now()
);
create index pack_openings_user_day on public.pack_openings (user_id, created_at desc);
create trigger pack_openings_append_only before update or delete on public.pack_openings
  for each row execute function private.forbid_change();
create trigger pack_openings_no_truncate before truncate on public.pack_openings
  for each statement execute function private.forbid_change();

-- Free packs earned from quest streaks.
alter table public.wallets add column free_packs integer not null default 0 check (free_packs >= 0);

-- Default packs (admin-editable rows): 8 cards each, 100 coins, 50 a day.
insert into public.pack_types (id, name, blurb, price_coins, faction, max_per_day, art) values
  ('standard', 'Oreheart Pack',  'Eight cards from every corner of the mines.',          100, null,      50, '/art/packs/standard.webp'),
  ('goblin',   'Junkpile Pack',  'Eight cards of goblin mischief, plus a little of everything.', 100, 'goblins', 50, '/art/packs/goblin.webp'),
  ('gnome',    'Gizmo Pack',     'Eight cards of gnomish gadgetry, plus a little of everything.', 100, 'gnomes',  50, '/art/packs/gnome.webp'),
  ('dwarf',    'Deepforge Pack', 'Eight cards of dwarven iron, plus a little of everything.',  100, 'dwarves', 50, '/art/packs/dwarf.webp')
on conflict (id) do nothing;

insert into public.pack_slots (pack_type, slot_no, count, odds)
select p.id, s.slot_no, s.count, s.odds
from public.pack_types p
cross join (values
  (1, 5, '{"Common": 10000}'::jsonb),
  (2, 2, '{"Uncommon": 10000}'::jsonb),
  (3, 1, '{"Rare": 8500, "Ultra Rare": 1300, "Collector": 200}'::jsonb)) s(slot_no, count, odds)
where p.id in ('standard', 'goblin', 'gnome', 'dwarf')
on conflict (pack_type, slot_no) do nothing;

-- The cards a pack can deal for one rarity: that faction's cards plus neutral ones
-- (faction 'any'); the standard pack (faction null) deals every card that is in packs.
create function private.pack_pool(p_faction text, p_rarity text) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array(select c.id from public.cards c
                        where c.in_packs and c.rarity = p_rarity
                          and (p_faction is null or c.faction = p_faction or c.faction = 'any')
                        order by c.id), '{}'::text[])
$$;

-- Picks the rarity for one card from basis-point odds, then falls back to the next
-- lower rarity while the pool for it is empty. Returns the card id.
create function private.pack_roll_card(p_faction text, p_odds jsonb) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  roll integer := private.random_below(10000);
  acc integer := 0;
  rarity text;
  pool text[];
  r record;
begin
  for r in select e.k, (e.v #>> '{}')::int as bp from jsonb_each(p_odds) e(k, v)
           join public.rarities ra on ra.name = e.k order by ra.sort desc loop
    acc := acc + r.bp;
    if roll < acc then rarity := r.k; exit; end if;
  end loop;
  if rarity is null then raise exception 'pack odds do not add up'; end if;
  loop
    pool := private.pack_pool(p_faction, rarity);
    exit when cardinality(pool) > 0;
    select ra2.name into rarity from public.rarities ra1 join public.rarities ra2 on ra2.sort = ra1.sort - 1 where ra1.name = rarity;
    if rarity is null then raise exception 'no cards available for this pack'; end if;
  end loop;
  return pool[1 + private.random_below(cardinality(pool))];
end $$;

-- Buy and open one pack. One transaction, idempotent on (player, idem_key).
-- p_use_free: spend a free pack instead of coins.
create function public.open_pack(p_pack_type text, p_idem_key text, p_use_free boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  w public.wallets;
  pt public.pack_types;
  prior public.pack_openings;
  oid uuid := gen_random_uuid();
  owned text[];
  dealt text[] := '{}';
  card_rows jsonb := '[]'::jsonb;
  slots jsonb;
  s record;
  i integer;
  cid text;
  price integer := 0;
  use_free boolean := coalesce(p_use_free, false);
  opened_today bigint;
  result jsonb;
begin
  if p_idem_key is null or length(p_idem_key) not between 8 and 120 then raise exception 'idem_key required'; end if;
  -- The wallet lock serialises everything this player does with coins and packs.
  select * into w from public.wallets where user_id = uid for update;
  if not found then raise exception 'player has no wallet'; end if;
  select * into prior from public.pack_openings where idem_key = p_idem_key;
  if found then
    if prior.user_id <> uid then raise exception 'idem_key already used'; end if;
    return prior.result || jsonb_build_object('coins_after', w.coins, 'free_packs_after', w.free_packs, 'repeat', true);
  end if;
  select * into pt from public.pack_types where id = p_pack_type;
  if not found or not pt.active then raise exception 'That pack is not for sale.'; end if;
  select count(*) into opened_today from public.pack_openings
    where user_id = uid and pack_type = pt.id and created_at >= private.day_start();
  if opened_today >= pt.max_per_day then raise exception 'You have opened enough of those for today (% a day).', pt.max_per_day; end if;
  select coalesce(jsonb_agg(jsonb_build_object('slot_no', ps.slot_no, 'count', ps.count, 'odds', ps.odds) order by ps.slot_no), '[]'::jsonb)
    into slots from public.pack_slots ps where ps.pack_type = pt.id;
  if slots = '[]'::jsonb then raise exception 'That pack has no cards in it yet.'; end if;

  if use_free then
    if w.free_packs < 1 then raise exception 'You have no free pack.'; end if;
    update public.wallets set free_packs = free_packs - 1, updated_at = now() where user_id = uid;
  else
    price := pt.price_coins;
    if price > 0 then
      -- The only way coins move. Raises 'not enough coins' when the player can't pay.
      perform private.ledger_apply(uid, -price, 'pack_purchase', oid::text, 'pack:' || p_idem_key, null);
    end if;
  end if;

  owned := coalesce(array(select distinct ci.card_id from public.card_instances ci where ci.owner_id = uid and ci.status = 'owned'), '{}');
  for s in select (e ->> 'count')::int as count, e -> 'odds' as odds from jsonb_array_elements(slots) e loop
    for i in 1..s.count loop
      cid := private.pack_roll_card(pt.faction, s.odds);
      dealt := dealt || cid;
      card_rows := card_rows || jsonb_build_object(
        'card_id', cid,
        'rarity', (select c.rarity from public.cards c where c.id = cid),
        'is_new', not (cid = any (owned)));
      perform private.card_grant(uid, cid, 1, 'pack', oid::text, null);
    end loop;
  end loop;

  update public.player_stats set packs_opened = packs_opened + 1, coins_spent = coins_spent + price where user_id = uid;

  result := jsonb_build_object(
    'opening_id', oid, 'pack_type', pt.id, 'price_paid', price, 'free', use_free,
    'cards', card_rows, 'odds', slots);
  insert into public.pack_openings (id, user_id, pack_type, price_paid, free, odds_snapshot, cards, idem_key, result)
    values (oid, uid, pt.id, price, use_free, slots, dealt, p_idem_key, result);
  select * into w from public.wallets where user_id = uid;
  return result || jsonb_build_object('coins_after', w.coins, 'free_packs_after', w.free_packs, 'repeat', false);
end $$;

-- What the Shop shows: the active packs, how many of each this player opened today, coins, free packs.
create function public.shop_info() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return jsonb_build_object(
    'packs', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'blurb', p.blurb, 'price_coins', p.price_coins, 'faction', p.faction,
        'art', p.art, 'max_per_day', p.max_per_day,
        'opened_today', (select count(*) from public.pack_openings o
                         where o.user_id = uid and o.pack_type = p.id and o.created_at >= private.day_start()),
        'slots', coalesce((select jsonb_agg(jsonb_build_object('slot_no', s.slot_no, 'count', s.count, 'odds', s.odds) order by s.slot_no)
                           from public.pack_slots s where s.pack_type = p.id), '[]'::jsonb))
        order by (p.faction is null) desc, p.id)
      from public.pack_types p where p.active), '[]'::jsonb),
    'coins', (select coins from public.wallets where user_id = uid),
    'free_packs', (select free_packs from public.wallets where user_id = uid));
end $$;

-- ---------------------------------------------------------------------------
-- Deck ownership: a deck may not use more copies of a card than the player owns.
-- Crystal cards are exempt (free and unlimited, Ken).
-- ---------------------------------------------------------------------------

create or replace function private.deck_problem(p_name text, p_commander text, p_cards text[]) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  known text[] := private.setting_text_list('card_ids');
  uid uuid := auth.uid();
  bad text;
  short record;
begin
  if p_name is null or length(btrim(p_name)) not between 1 and 40 then return 'Deck name must be 1 to 40 characters.'; end if;
  if p_commander is not null and not (p_commander = any (private.setting_text_list('commander_ids'))) then
    return 'Unknown commander.';
  end if;
  if p_cards is null then return 'No cards.'; end if;
  if cardinality(p_cards) > coalesce((private.setting('deck_max_cards'))::int, 100) then return 'Too many cards.'; end if;
  select c into bad from unnest(p_cards) c where c is null or not (c = any (known)) limit 1;
  if found then return 'Unknown card: ' || coalesce(left(bad, 64), 'empty'); end if;
  if uid is not null then
    select u.card_id, u.n, coalesce(o.n, 0) as owned, coalesce(k.name, u.card_id) as name into short
    from (select c as card_id, count(*) as n from unnest(p_cards) c group by c) u
    left join public.cards k on k.id = u.card_id
    left join (select ci.card_id, count(*) as n from public.card_instances ci
               where ci.owner_id = uid and ci.status = 'owned' group by ci.card_id) o on o.card_id = u.card_id
    where coalesce(k.type, '') <> 'crystal' and u.n > coalesce(o.n, 0)
    order by u.card_id limit 1;
    if found then return 'you own ' || short.owned || ' of ' || short.name; end if;
  end if;
  return null;
end $$;

-- One-off repair: every profile that owns no card at all gets the starter collection
-- (older test accounts made before cards were given at sign-up).
do $$
declare p record; card record; n integer := 0;
begin
  for p in select pr.id from public.profiles pr
           where not exists (select 1 from public.card_instances ci where ci.owner_id = pr.id) loop
    for card in select key, value::int as k from jsonb_each_text(coalesce(private.setting('starter_collection'), '{}'::jsonb)) loop
      if card.k > 0 then perform private.card_grant(p.id, card.key, card.k, 'starter', 'repair-nov2', null); end if;
    end loop;
    n := n + 1;
  end loop;
  raise notice 'starter collection repaired for % profile(s)', n;
end $$;

-- ---------------------------------------------------------------------------
-- Settings for rewards, quests and the PvP clock (whole numbers; the back counter edits them).
-- ---------------------------------------------------------------------------

insert into public.settings (key, value) values
  ('pvp_win_coins', '25'::jsonb),
  ('pvp_loss_coins', '10'::jsonb),
  ('pvp_daily_coin_cap', '300'::jsonb),
  ('pvp_min_turns', '3'::jsonb),
  ('quest_reward_easy', '25'::jsonb),
  ('quest_reward_medium', '50'::jsonb),
  ('quest_reward_hard', '75'::jsonb),
  ('quest_streak_days', '7'::jsonb),
  ('pvp_phase_seconds', '120'::jsonb),
  ('pvp_bank_seconds', '60'::jsonb),
  ('pvp_respond_seconds', '12'::jsonb),
  ('pvp_timeouts_to_forfeit', '3'::jsonb),
  -- Shown in quest names ("Grubnak Rotgut's Day Out"); ids come from settings commander_ids.
  ('commander_names', '{"grubnak": "Grubnak Rotgut", "sproingle": "Knobbin the Gnomeificent", "borgo": "Thane Borgo"}'::jsonb)
on conflict (key) do nothing;

-- Whole-number settings and the range each one may take.
create function private.int_setting_range(p_key text) returns table (lo integer, hi integer)
language sql immutable set search_path = '' as $$
  select r.lo, r.hi from (values
    ('signup_bonus_coins',       0, 100000),
    ('max_decks',                1, 100),
    ('pvp_win_coins',            0, 10000),
    ('pvp_loss_coins',           0, 10000),
    ('pvp_daily_coin_cap',       0, 100000),
    ('pvp_min_turns',            0, 100),
    ('quest_reward_easy',        0, 10000),
    ('quest_reward_medium',      0, 10000),
    ('quest_reward_hard',        0, 10000),
    ('quest_streak_days',        1, 365),
    ('pvp_phase_seconds',       10, 3600),
    ('pvp_bank_seconds',         0, 3600),
    ('pvp_respond_seconds',      3, 600),
    ('pvp_timeouts_to_forfeit',  1, 20)) r(key, lo, hi)
  where r.key = p_key
$$;

create or replace function private.editable_settings() returns text[]
language sql immutable set search_path = '' as $$
  select array['signup_bonus_coins', 'max_decks', 'blocked_words', 'reserved_usernames', 'reserved_name_parts',
               'pvp_win_coins', 'pvp_loss_coins', 'pvp_daily_coin_cap', 'pvp_min_turns',
               'quest_reward_easy', 'quest_reward_medium', 'quest_reward_hard', 'quest_streak_days',
               'pvp_phase_seconds', 'pvp_bank_seconds', 'pvp_respond_seconds', 'pvp_timeouts_to_forfeit']
$$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  old jsonb := private.setting(p_key);
  v jsonb := p_value;
  bad text;
  lo integer; hi integer;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if p_key is null or not (p_key = any (private.editable_settings())) then raise exception 'that setting can''t be changed here'; end if;
  select r.lo, r.hi into lo, hi from private.int_setting_range(p_key) r;
  if lo is not null then
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then raise exception 'must be a whole number'; end if;
    if (v #>> '{}')::numeric < lo or (v #>> '{}')::numeric > hi then raise exception 'must be % to %', lo, hi; end if;
    v := to_jsonb((v #>> '{}')::int);
  else
    -- Word lists: letters only (compared after the name clean-up), 2-30 letters, no repeats, at most 2000.
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

-- ---------------------------------------------------------------------------
-- Match rewards and stats. The ledger gains the quest reward reason.
-- ---------------------------------------------------------------------------

alter table public.transactions drop constraint transactions_reason_check;
alter table public.transactions add constraint transactions_reason_check check (reason in
  ('signup_bonus','admin_grant','match_reward','pack_purchase','donation_reward','refund_reversal','quest_reward'));

-- One row per player and match: the record that a match was counted (stats) and what it paid.
create table public.match_rewards (
  match_id   uuid not null,
  user_id    uuid not null,
  won        boolean not null,
  turns      integer not null,
  coins      integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
create trigger match_rewards_append_only before update or delete on public.match_rewards
  for each row execute function private.forbid_change();

-- Counts one finished PvP match for a player ONCE (player_stats) and pays the win/loss coins
-- (ledger idem_key match:<match>:<user>), only when the match lasted pvp_min_turns turns and
-- today's match coins stay within pvp_daily_coin_cap (the part that still fits is paid).
-- Returns the coins paid; a repeat call returns 0 and changes nothing.
create function private.match_reward(p_user uuid, p_match uuid, p_won boolean, p_turns integer, p_commander text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  key text := 'match:' || p_match || ':' || p_user;
  reward integer := coalesce((private.setting(case when p_won then 'pvp_win_coins' else 'pvp_loss_coins' end))::int, 0);
  min_turns integer := coalesce((private.setting('pvp_min_turns'))::int, 3);
  cap integer := coalesce((private.setting('pvp_daily_coin_cap'))::int, 300);
  so_far integer;
  paid integer := 0;
  cmd text := nullif(btrim(coalesce(p_commander, '')), '');
begin
  if p_user is null or p_match is null then return 0; end if;
  perform 1 from public.wallets where user_id = p_user for update;
  if not found then return 0; end if;
  if exists (select 1 from public.match_rewards where match_id = p_match and user_id = p_user) then return 0; end if;
  update public.player_stats set
    games = games + 1,
    wins = wins + case when p_won then 1 else 0 end,
    losses = losses + case when p_won then 0 else 1 end,
    win_streak = case when p_won then win_streak + 1 else 0 end,
    best_streak = greatest(best_streak, case when p_won then win_streak + 1 else 0 end),
    turns_total = turns_total + greatest(coalesce(p_turns, 0), 0),
    last_match_at = now(),
    by_commander = case when cmd is null then by_commander else by_commander || jsonb_build_object(cmd, jsonb_build_object(
           'games', coalesce((by_commander -> cmd ->> 'games')::int, 0) + 1,
           'wins', coalesce((by_commander -> cmd ->> 'wins')::int, 0) + case when p_won then 1 else 0 end)) end
    where user_id = p_user;
  if coalesce(p_turns, 0) >= min_turns and reward > 0 then
    select coalesce(sum(delta), 0) into so_far from public.transactions
      where user_id = p_user and reason = 'match_reward' and created_at >= private.day_start();
    paid := greatest(least(reward, cap - so_far), 0);
  end if;
  if paid > 0 then
    perform private.ledger_apply(p_user, paid, 'match_reward', p_match::text, key, null);
    update public.player_stats set coins_earned = coins_earned + paid where user_id = p_user;
  end if;
  insert into public.match_rewards (match_id, user_id, won, turns, coins) values (p_match, p_user, p_won, coalesce(p_turns, 0), paid);
  return paid;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security for the new tables and functions.
-- ---------------------------------------------------------------------------

revoke all on public.rarities, public.cards, public.pack_types, public.pack_slots, public.pack_openings, public.match_rewards
  from public, anon, authenticated;
grant select on public.rarities, public.cards, public.pack_types, public.pack_slots, public.pack_openings, public.match_rewards to authenticated;

alter table public.rarities      enable row level security;
alter table public.cards         enable row level security;
alter table public.pack_types    enable row level security;
alter table public.pack_slots    enable row level security;
alter table public.pack_openings enable row level security;
alter table public.match_rewards enable row level security;

create policy all_rarities      on public.rarities      for select to authenticated using (true);
create policy all_cards         on public.cards         for select to authenticated using (true);
create policy active_packs      on public.pack_types    for select to authenticated using (active);
create policy all_pack_slots    on public.pack_slots    for select to authenticated using (true);
create policy own_pack_openings on public.pack_openings for select to authenticated using (user_id = (select auth.uid()));
create policy own_match_rewards on public.match_rewards for select to authenticated using (user_id = (select auth.uid()));

revoke all on function private.random_below(integer), private.today(), private.day_start(), private.odds_ok(jsonb),
  private.pack_pool(text, text), private.pack_roll_card(text, jsonb), private.int_setting_range(text),
  private.match_reward(uuid, uuid, boolean, integer, text) from public, anon, authenticated;
revoke all on function public.open_pack(text, text, boolean), public.shop_info() from public, anon, authenticated;
grant execute on function public.open_pack(text, text, boolean) to authenticated;
grant execute on function public.shop_info() to authenticated;

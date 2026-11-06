-- Packs v2 (Ken, Nov 5): "add the crystals into the card packs, and you not be able to use as many as you want ... 11 cards per
-- pack. And I want 3 of them to be minors. The low-end minors ... Crystals I want to be random, just like the other cards.
-- So the crystals have their rarities. So you put them in with their rarity Odds ... the same odds as the rarity they are with."
-- Ken's final layout (11 cards): 3 cheap low-end Miners, 4 Common, 2 Uncommon, 1 Rare (always), 1 Rare-or-better (the old
-- Rare slot's odds: Rare 85%, Ultra Rare 13%, top rarity 2%): "one rare, and one rare to collector. So meaning you're guaranteed
-- at least two rare cards". Price 100, the upgraded-card odds unchanged. Commanders (Grubnak, Knobbin, Borgo) join the pool at
-- Rare: everyone owns the three from the start ("you will start out with the commanders"), extra copies feed the upgrades.
-- Meteor Strike (Starfall Cataclysm) moves up to the top rarity (stored 'Collector', shown as Legendary). Crystal cards join the pool at their own rarity and are owned like any card: a saved deck may
-- only use the crystals the player owns (starter decks stay free to play, crystals and all). Every count is an admin setting.

-- crystals into the pool at their rarity
update public.cards set in_packs = true where type = 'crystal' and not disabled;

-- the Miner slot (slot 0) and its pool
alter table public.pack_slots drop constraint pack_slots_slot_no_check;
alter table public.pack_slots add constraint pack_slots_slot_no_check check (slot_no between 0 and 20);
alter table public.pack_slots add column pool text not null default 'any' check (pool in ('any', 'miners'));
insert into public.pack_slots (pack_type, slot_no, count, odds, pool)
  select p.id, 0, 3, '{"Common": 10000}'::jsonb, 'miners' from public.pack_types p where p.id in ('standard', 'goblin', 'gnome', 'dwarf')
on conflict (pack_type, slot_no) do nothing;
-- slot 1 deals 4 Commons now; slot 3 is the sure Rare; slot 4 takes over the old Rare-or-better odds
update public.pack_slots set count = 4 where slot_no = 1 and pack_type in ('standard', 'goblin', 'gnome', 'dwarf');
insert into public.pack_slots (pack_type, slot_no, count, odds, pool)
  select s.pack_type, 4, 1, s.odds, 'any' from public.pack_slots s where s.slot_no = 3 and s.pack_type in ('standard', 'goblin', 'gnome', 'dwarf')
on conflict (pack_type, slot_no) do nothing;
update public.pack_slots set odds = '{"Rare": 10000}'::jsonb where slot_no = 3 and pack_type in ('standard', 'goblin', 'gnome', 'dwarf');

-- the three starter Commanders as pack cards (Rare); the locked ones stay out
alter table public.cards drop constraint cards_type_check;
alter table public.cards add constraint cards_type_check check (type in ('creature', 'spell', 'crystal', 'commander'));
insert into public.cards (id, name, type, faction, rarity, cost, in_packs, disabled, content_version) values
  ('commander-grubnak', 'Grubnak Rotgut, Goblin King', 'commander', 'goblins', 'Rare', 0, true, false, 'cards:nov5-commanders'),
  ('commander-sproingle', 'Knobbin the Gnomeificent', 'commander', 'gnomes', 'Rare', 0, true, false, 'cards:nov5-commanders'),
  ('commander-borgo', 'Thane Borgo Gravelgrim', 'commander', 'dwarves', 'Rare', 0, true, false, 'cards:nov5-commanders')
on conflict (id) do update set name = excluded.name, type = excluded.type, faction = excluded.faction, rarity = excluded.rarity, in_packs = true, disabled = false;
-- Meteor Strike: top rarity
update public.cards set rarity = 'Collector' where id = 'meteor-strike';
-- everyone starts with the three Commanders (one copy each: for play; copies from packs are for upgrading)
update public.settings set value = '{"commander-grubnak": 1, "commander-sproingle": 1, "commander-borgo": 1}'::jsonb where key = 'starter_collection';
do $$
declare p record; c text; n integer := 0;
begin
  for p in select pr.id from public.profiles pr loop
    foreach c in array array['commander-grubnak', 'commander-sproingle', 'commander-borgo'] loop
      if not exists (select 1 from public.card_instances ci where ci.owner_id = p.id and ci.card_id = c and ci.status = 'owned') then
        perform private.card_grant(p.id, c, 1, 'starter', 'commanders-nov5', null); n := n + 1;
      end if;
    end loop;
  end loop;
  raise notice 'starter Commanders granted: % card(s)', n;
end $$;

-- settings: the counts (whole numbers) and which cards count as cheap low-end Miners (the five cost-1 Gatherers and Smiths)
insert into public.settings (key, value) values
  ('pack_miners', '3'::jsonb), ('pack_commons', '4'::jsonb), ('pack_uncommons', '2'::jsonb), ('pack_rare_sure', '1'::jsonb), ('pack_rares', '1'::jsonb),
  ('pack_miner_ids', '["goblin-scrounger", "goblin-smith-miner", "gnome-prospector", "gnome-smith-miner", "dwarf-smith-miner"]'::jsonb)
on conflict (key) do nothing;

create or replace function private.setting_range(p_key text) returns table (lo integer, hi integer)
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
    ('pvp_timeouts_to_forfeit',  1, 20),
    ('pvp_respond_min_seconds',  0, 10),
    ('pvp_abandon_seconds',     30, 86400),
    ('ranked_k',                 1, 200),
    ('ranked_window',           10, 5000),
    ('ranked_window_step',       0, 1000),
    ('pack_miners',              0, 10),
    ('pack_commons',             0, 20),
    ('pack_uncommons',           0, 20),
    ('pack_rare_sure',           0, 20),
    ('pack_rares',               0, 20)) r(key, lo, hi)
  where r.key = p_key
$$;

create or replace function private.editable_settings() returns text[]
language sql immutable set search_path = '' as $$
  select array['signup_bonus_coins', 'max_decks', 'blocked_words', 'reserved_usernames', 'reserved_name_parts',
               'pvp_win_coins', 'pvp_loss_coins', 'pvp_daily_coin_cap', 'pvp_min_turns',
               'quest_reward_easy', 'quest_reward_medium', 'quest_reward_hard', 'quest_streak_days',
               'pvp_phase_seconds', 'pvp_bank_seconds', 'pvp_respond_seconds', 'pvp_timeouts_to_forfeit',
               'pvp_respond_min_seconds', 'pvp_abandon_seconds', 'pvp_attack_mode',
               'upgrade_steps', 'upgrade_drop_bp', 'upgrade_drop_tiers',
               'ranked_k', 'ranked_window', 'ranked_window_step',
               'pack_miners', 'pack_commons', 'pack_uncommons', 'pack_rare_sure', 'pack_rares']
$$;

-- how many cards a slot deals: slot 0 Miners, 1 Commons, 2 Uncommons, 3 the sure Rare, 4 the Rare-or-better; any other slot keeps its row's count
create function private.slot_count(p_slot integer, p_row_count integer) returns integer
language sql stable set search_path = '' as $$
  select greatest(0, least(20, coalesce(case p_slot
    when 0 then (private.setting('pack_miners'))::int when 1 then (private.setting('pack_commons'))::int
    when 2 then (private.setting('pack_uncommons'))::int when 3 then (private.setting('pack_rare_sure'))::int
    when 4 then (private.setting('pack_rares'))::int end, p_row_count)))
$$;

-- the cheap low-end Miners a pack can deal: the setting's list, that faction's plus neutral ones (every one for the standard pack)
create function private.pack_pool_miners(p_faction text) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array(select c.id from public.cards c
                        where c.id = any (private.setting_text_list('pack_miner_ids')) and c.in_packs and not c.disabled
                          and (p_faction is null or c.faction = p_faction or c.faction = 'any')
                        order by c.id), '{}'::text[])
$$;
create function private.pack_roll_miner(p_faction text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare pool text[] := private.pack_pool_miners(p_faction);
begin
  if cardinality(pool) = 0 then pool := private.pack_pool_miners(null); end if;
  if cardinality(pool) = 0 then raise exception 'no Miner cards available for this pack'; end if;
  return pool[1 + private.random_below(cardinality(pool))];
end $$;

-- a saved deck may only use the crystals the player owns (the exemption of 20261102000001 is gone)
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
    where u.n > coalesce(o.n, 0)
    order by u.card_id limit 1;
    if found then return 'you own ' || short.owned || ' of ' || short.name; end if;
  end if;
  return null;
end $$;

create or replace function public.shop_info() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return jsonb_build_object(
    'packs', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'blurb', p.blurb, 'price_coins', p.price_coins, 'faction', p.faction,
        'art', p.art, 'max_per_day', p.max_per_day,
        'opened_today', (select count(*) from public.pack_openings o
                         where o.user_id = uid and o.pack_type = p.id and o.created_at >= private.day_start()),
        'slots', coalesce((select jsonb_agg(jsonb_build_object('slot_no', s.slot_no, 'count', private.slot_count(s.slot_no, s.count), 'odds', s.odds, 'pool', s.pool) order by s.slot_no)
                           from public.pack_slots s where s.pack_type = p.id and private.slot_count(s.slot_no, s.count) > 0), '[]'::jsonb))
        order by (p.faction is null) desc, p.id)
      from public.pack_types p where p.active), '[]'::jsonb),
    'coins', (select coins from public.wallets where user_id = uid),
    'free_packs', (select free_packs from public.wallets where user_id = uid));
end $$;

revoke all on function private.slot_count(integer, integer), private.pack_pool_miners(text), private.pack_roll_miner(text), private.setting_range(text), private.editable_settings() from public, anon, authenticated;

-- open_pack again with the Miner slot and the settings' counts (otherwise as in 20261105000001)
create or replace function public.open_pack(p_pack_type text, p_idem_key text, p_use_free boolean default false) returns jsonb
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
  tr smallint := 1;
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
  select coalesce(jsonb_agg(jsonb_build_object('slot_no', ps.slot_no, 'count', private.slot_count(ps.slot_no, ps.count), 'odds', ps.odds, 'pool', ps.pool) order by ps.slot_no), '[]'::jsonb)
    into slots from public.pack_slots ps where ps.pack_type = pt.id and private.slot_count(ps.slot_no, ps.count) > 0;
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
  for s in select (e ->> 'count')::int as count, e -> 'odds' as odds, e ->> 'pool' as pool from jsonb_array_elements(slots) e loop
    for i in 1..s.count loop
      cid := case when s.pool = 'miners' then private.pack_roll_miner(pt.faction) else private.pack_roll_card(pt.faction, s.odds) end; -- Nov 5: slot 0 deals cheap Miners
      dealt := dealt || cid;
      tr := private.roll_upgrade((select c.rarity from public.cards c where c.id = cid)); -- Nov 5: now and then an upgraded card, by rarity
      card_rows := card_rows || jsonb_build_object(
        'card_id', cid,
        'rarity', (select c.rarity from public.cards c where c.id = cid),
        'is_new', not (cid = any (owned)),
        'tier', tr);
      perform private.card_grant_tier(uid, cid, tr, 'pack', oid::text, null);
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

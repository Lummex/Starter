-- Pack bundles, My Packs, opening several at once, bundle guarantees and the bad-luck shield (Ken, Nov 5).
-- Ken: "I don't want individual packs. I want one pack ... And then when you click on the multiple packs, you can either open
-- them in the pack opening, you can open them one at a time, or give them a slider how many they want to open at one time."
-- Final design (Forge, Ken approved): bundles of 1 (100 coins), 6 (600), 24 (2,400 -> 27 packs, +3 free), 99 (9,900 -> 115 packs,
-- +16 free); every number an admin setting. Bought packs go to the stash (pack_bundles, counted in the ledger) and are opened
-- later, one at a time or several at once. Guarantees, applied on the server when a bundle's LAST pack is opened (natural
-- drops count; a top-up only when luck fell short): the 24-bundle one upgraded card at Overcharged or better; the 99-bundle
-- one upgraded card at the Radiant tier, one Legendary-rarity card the player did not own, and the chest card back.
-- Bad-luck shield: a player who opens pack_pity_limit (40) packs in a row without a Legendary gets one in that pack (the
-- Rare-or-better card becomes a Legendary); counted across every pack, reset whenever a Legendary drops.
-- No Mythic guarantee anywhere. Odds stay as shown; no fake timers or scarcity.

insert into public.settings (key, value) values
  ('pack_bundles', '[{"size": 1, "bonus": 0}, {"size": 6, "bonus": 0}, {"size": 24, "bonus": 3}, {"size": 99, "bonus": 16}]'::jsonb),
  ('pack_bundle_promises', '{"24": {"upgraded_min_tier": 3}, "99": {"upgraded_min_tier": 4, "legendary_unowned": true, "card_back": "chest"}}'::jsonb),
  ('pack_pity_limit', '40'::jsonb),
  ('pack_bundles_per_day', '20'::jsonb),
  ('shop_badges', '{"best_value": 99, "most_popular": null}'::jsonb)
on conflict (key) do nothing;

create or replace function private.editable_settings() returns text[]
language sql immutable set search_path = '' as $$
  select array['signup_bonus_coins', 'max_decks', 'blocked_words', 'reserved_usernames', 'reserved_name_parts',
               'pvp_win_coins', 'pvp_loss_coins', 'pvp_daily_coin_cap', 'pvp_min_turns',
               'quest_reward_easy', 'quest_reward_medium', 'quest_reward_hard', 'quest_streak_days',
               'pvp_phase_seconds', 'pvp_bank_seconds', 'pvp_respond_seconds', 'pvp_timeouts_to_forfeit',
               'pvp_respond_min_seconds', 'pvp_abandon_seconds', 'pvp_attack_mode',
               'upgrade_steps', 'upgrade_drop_bp', 'upgrade_drop_tiers',
               'ranked_k', 'ranked_window', 'ranked_window_step',
               'pack_miners', 'pack_commons', 'pack_uncommons', 'pack_rare_sure', 'pack_rares',
               'pack_bundles', 'pack_bundle_promises', 'pack_pity_limit', 'pack_bundles_per_day', 'shop_badges']
$$;
-- the whole-number settings' ranges, with the two new ones
alter function private.int_setting_range(text) rename to int_setting_range_v1;
create function private.int_setting_range(p_key text) returns table (lo integer, hi integer)
language sql immutable set search_path = '' as $$
  select r.lo, r.hi from private.int_setting_range_v1(p_key) r
  union all
  select v.lo, v.hi from (values ('pack_pity_limit', 1, 1000), ('pack_bundles_per_day', 1, 1000)) v(key, lo, hi) where v.key = p_key
$$;
revoke all on function private.int_setting_range(text), private.int_setting_range_v1(text), private.editable_settings() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- My Packs: every bundle bought (or given) and how many of its packs are still sealed
-- ---------------------------------------------------------------------------
create table public.pack_bundles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  pack_type   text not null references public.pack_types (id),
  size        integer not null check (size >= 1),
  bonus       integer not null default 0 check (bonus >= 0),
  packs_total integer not null check (packs_total >= 1),
  packs_left  integer not null check (packs_left >= 0),
  price_paid  integer not null default 0 check (price_paid >= 0),
  source      text not null default 'shop' check (source in ('shop', 'quest', 'admin')),
  promises    jsonb not null default '{}'::jsonb,   -- the guarantees this bundle carries
  progress    jsonb not null default '{}'::jsonb,   -- what its packs delivered so far (best_tier, new_legendary)
  idem_key    text unique,
  result      jsonb,                                -- the purchase result; later the top-up extras
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index pack_bundles_user_open on public.pack_bundles (user_id, pack_type, created_at) where packs_left > 0;
create index pack_bundles_user_day on public.pack_bundles (user_id, created_at desc);
revoke all on public.pack_bundles from public, anon, authenticated;
alter table public.pack_bundles enable row level security;

-- cosmetics a player unlocked (the chest card back for now)
create table public.player_cosmetics (
  user_id    uuid not null,
  kind       text not null check (kind in ('card_back')),
  item       text not null,
  ref        text,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item)
);
revoke all on public.player_cosmetics from public, anon, authenticated;
alter table public.player_cosmetics enable row level security;

alter table public.player_stats add column if not exists packs_since_legendary integer not null default 0;
alter table public.pack_openings add column if not exists bundle_id uuid;
alter table public.pack_openings add column if not exists extras jsonb;

-- a bundle's definition and promises from the settings
create function private.bundle_def(p_size integer) returns table (size integer, bonus integer)
language sql stable set search_path = '' as $$
  select (b ->> 'size')::int, coalesce((b ->> 'bonus')::int, 0)
  from jsonb_array_elements(coalesce(private.setting('pack_bundles'), '[{"size": 1, "bonus": 0}]'::jsonb)) b
  where (b ->> 'size')::int = p_size
$$;
create function private.bundle_promises(p_size integer) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(private.setting('pack_bundle_promises') -> p_size::text, '{}'::jsonb)
$$;
-- what is still sealed, per pack type, plus the free quest packs
create function private.stash_of(p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'packs', coalesce((select jsonb_object_agg(pack_type, n) from (select b.pack_type, sum(b.packs_left) as n from public.pack_bundles b where b.user_id = p_user and b.packs_left > 0 group by b.pack_type) x), '{}'::jsonb),
    'free', coalesce((select w.free_packs from public.wallets w where w.user_id = p_user), 0))
$$;

-- Deals ONE pack: rolls the slots, applies the bad-luck shield, grants the cards, and on a bundle's last pack tops up its
-- promises. Writes the pack_openings row and the stats. Returns the opening result (the open_pack shape, plus extras and
-- the bundle progress after this pack).
create function private.deal_pack(p_user uuid, p_pt public.pack_types, p_oid uuid, p_idem_key text, p_bundle uuid, p_price integer, p_free boolean, p_last boolean, p_promises jsonb, p_progress jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  owned text[];
  owned0 text[];
  dealt text[] := '{}';
  tiers smallint[] := '{}';
  card_rows jsonb := '[]'::jsonb;
  extras jsonb := '[]'::jsonb;
  slots jsonb;
  s record;
  i integer;
  cid text;
  tr smallint;
  rar text;
  since integer := coalesce((select ps.packs_since_legendary from public.player_stats ps where ps.user_id = p_user), 0);
  pity integer := greatest(1, coalesce((private.setting('pack_pity_limit'))::int, 40));
  has_leg boolean := false;
  pity_hit boolean := false;
  best_tier integer := greatest(1, coalesce((p_progress ->> 'best_tier')::int, 1));
  new_leg boolean := coalesce((p_progress ->> 'new_legendary')::boolean, false);
  want_tier integer; result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('slot_no', ps.slot_no, 'count', private.slot_count(ps.slot_no, ps.count), 'odds', ps.odds, 'pool', ps.pool) order by ps.slot_no), '[]'::jsonb)
    into slots from public.pack_slots ps where ps.pack_type = p_pt.id and private.slot_count(ps.slot_no, ps.count) > 0;
  if slots = '[]'::jsonb then raise exception 'That pack has no cards in it yet.'; end if;
  owned := coalesce(array(select distinct ci.card_id from public.card_instances ci where ci.owner_id = p_user and ci.status = 'owned'), '{}');
  owned0 := owned; -- is_new compares with what the player had BEFORE this pack (two copies in one pack are both new)
  -- 1. roll every slot
  for s in select (e ->> 'count')::int as count, e -> 'odds' as odds, e ->> 'pool' as pool from jsonb_array_elements(slots) e loop
    for i in 1..s.count loop
      cid := case when s.pool = 'miners' then private.pack_roll_miner(p_pt.faction) else private.pack_roll_card(p_pt.faction, s.odds) end;
      dealt := dealt || cid;
      tiers := tiers || private.roll_upgrade((select c.rarity from public.cards c where c.id = cid));
    end loop;
  end loop;
  has_leg := exists (select 1 from unnest(dealt) d join public.cards c on c.id = d where c.rarity = 'Collector');
  -- 2. the bad-luck shield: the pity-th pack without a Legendary gets one in its last (Rare-or-better) slot
  if not has_leg and since + 1 >= pity then
    cid := private.pack_roll_card(p_pt.faction, '{"Collector": 10000}'::jsonb);
    dealt[cardinality(dealt)] := cid;
    tiers[cardinality(tiers)] := private.roll_upgrade('Collector');
    has_leg := true; pity_hit := true;
  end if;
  -- 3. grant them
  for i in 1..cardinality(dealt) loop
    cid := dealt[i]; tr := tiers[i];
    rar := (select c.rarity from public.cards c where c.id = cid);
    card_rows := card_rows || jsonb_build_object('card_id', cid, 'rarity', rar, 'is_new', not (cid = any (owned0)), 'tier', tr, 'pity', pity_hit and i = cardinality(dealt));
    perform private.card_grant_tier(p_user, cid, tr, 'pack', p_oid::text, null);
    if tr > best_tier then best_tier := tr; end if;
    if rar = 'Collector' and not (cid = any (owned)) then new_leg := true; end if;
    if not (cid = any (owned)) then owned := owned || cid; end if;
  end loop;
  update public.player_stats set packs_opened = packs_opened + 1, coins_spent = coins_spent + p_price,
    packs_since_legendary = case when has_leg then 0 else packs_since_legendary + 1 end where user_id = p_user;
  -- 4. a bundle's last pack: the promises luck did not keep
  if p_last then
    want_tier := coalesce((p_promises ->> 'upgraded_min_tier')::int, 0);
    if want_tier > best_tier then
      cid := private.pack_roll_card(p_pt.faction, '{"Rare": 7800, "Ultra Rare": 2000, "Collector": 200}'::jsonb);
      rar := (select c.rarity from public.cards c where c.id = cid);
      perform private.card_grant_tier(p_user, cid, want_tier, 'reward', 'bundle:' || p_bundle::text, null);
      extras := extras || jsonb_build_object('card_id', cid, 'rarity', rar, 'is_new', not (cid = any (owned)), 'tier', want_tier, 'guarantee', 'upgraded');
      if not (cid = any (owned)) then owned := owned || cid; end if;
      best_tier := want_tier;
    end if;
    if coalesce((p_promises ->> 'legendary_unowned')::boolean, false) and not new_leg then
      select c.id into cid from public.cards c where c.in_packs and not c.disabled and c.rarity = 'Collector'
        and (p_pt.faction is null or c.faction = p_pt.faction or c.faction = 'any') and not (c.id = any (owned))
        order by private.random_below(1000000) limit 1;
      if cid is null then cid := private.pack_roll_card(p_pt.faction, '{"Collector": 10000}'::jsonb); end if;
      perform private.card_grant_tier(p_user, cid, 1, 'reward', 'bundle:' || p_bundle::text, null);
      extras := extras || jsonb_build_object('card_id', cid, 'rarity', 'Collector', 'is_new', not (cid = any (owned)), 'tier', 1, 'guarantee', 'legendary');
      new_leg := true;
    end if;
    if p_promises ? 'card_back' then
      insert into public.player_cosmetics (user_id, kind, item, ref) values (p_user, 'card_back', p_promises ->> 'card_back', 'bundle:' || p_bundle::text) on conflict do nothing;
      extras := extras || jsonb_build_object('guarantee', 'card_back', 'item', p_promises ->> 'card_back');
    end if;
  end if;
  result := jsonb_build_object('opening_id', p_oid, 'pack_type', p_pt.id, 'price_paid', p_price, 'free', p_free,
    'cards', card_rows, 'odds', slots, 'extras', extras, 'bundle_id', p_bundle, 'pity', pity_hit,
    'progress', jsonb_build_object('best_tier', best_tier, 'new_legendary', new_leg));
  insert into public.pack_openings (id, user_id, pack_type, price_paid, free, odds_snapshot, cards, idem_key, result, bundle_id, extras)
    values (p_oid, p_user, p_pt.id, p_price, p_free, slots, dealt, p_idem_key, result, p_bundle, case when extras = '[]'::jsonb then null else extras end);
  return result;
end $$;

-- Buy a bundle: pays once through the ledger, the packs go to My Packs. Idempotent on (player, idem_key).
create function public.buy_packs(p_pack_type text, p_size integer, p_idem_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  w public.wallets;
  pt public.pack_types;
  prior public.pack_bundles;
  def record;
  bid uuid := gen_random_uuid();
  price integer;
  today_n bigint;
  result jsonb;
begin
  if p_idem_key is null or length(p_idem_key) not between 8 and 120 then raise exception 'idem_key required'; end if;
  select * into w from public.wallets where user_id = uid for update;
  if not found then raise exception 'player has no wallet'; end if;
  select * into prior from public.pack_bundles where idem_key = p_idem_key;
  if found then
    if prior.user_id <> uid then raise exception 'idem_key already used'; end if;
    return prior.result || jsonb_build_object('coins_after', w.coins, 'stash', private.stash_of(uid), 'repeat', true);
  end if;
  select * into pt from public.pack_types where id = p_pack_type;
  if not found or not pt.active then raise exception 'That pack is not for sale.'; end if;
  select * into def from private.bundle_def(p_size);
  if not found then raise exception 'That bundle is not for sale.'; end if;
  select count(*) into today_n from public.pack_bundles b where b.user_id = uid and b.pack_type = pt.id and b.source = 'shop' and b.created_at >= private.day_start();
  if today_n >= greatest(1, coalesce((private.setting('pack_bundles_per_day'))::int, 20)) then raise exception 'You have bought enough of those for today.'; end if;
  price := pt.price_coins * def.size;
  if price > 0 then perform private.ledger_apply(uid, -price, 'pack_purchase', bid::text, 'bundle:' || p_idem_key, null); end if;
  result := jsonb_build_object('bundle_id', bid, 'pack_type', pt.id, 'size', def.size, 'bonus', def.bonus, 'packs', def.size + def.bonus,
    'price_paid', price, 'promises', private.bundle_promises(def.size));
  insert into public.pack_bundles (id, user_id, pack_type, size, bonus, packs_total, packs_left, price_paid, source, promises, idem_key, result)
    values (bid, uid, pt.id, def.size, def.bonus, def.size + def.bonus, def.size + def.bonus, price, 'shop', private.bundle_promises(def.size), p_idem_key, result);
  update public.player_stats set coins_spent = coins_spent + price where user_id = uid;
  select * into w from public.wallets where user_id = uid;
  return result || jsonb_build_object('coins_after', w.coins, 'stash', private.stash_of(uid), 'repeat', false);
end $$;

-- Open up to p_count sealed packs of one kind from My Packs (oldest bundle first, then the free quest packs).
-- One transaction; idempotent on (player, idem_key): the same key gives the very same openings again.
create function public.open_stash(p_pack_type text, p_count integer, p_idem_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  w public.wallets;
  pt public.pack_types;
  b public.pack_bundles;
  n integer := least(greatest(coalesce(p_count, 1), 1), 120);
  i integer := 0;
  res jsonb;
  openings jsonb := '[]'::jsonb;
  use_free boolean;
begin
  if p_idem_key is null or length(p_idem_key) not between 8 and 100 then raise exception 'idem_key required'; end if;
  select * into w from public.wallets where user_id = uid for update;
  if not found then raise exception 'player has no wallet'; end if;
  if exists (select 1 from public.pack_openings o where o.idem_key = p_idem_key || ':1') then
    if exists (select 1 from public.pack_openings o where o.idem_key = p_idem_key || ':1' and o.user_id <> uid) then raise exception 'idem_key already used'; end if;
    select coalesce(jsonb_agg(o.result order by o.created_at, o.idem_key), '[]'::jsonb) into openings from public.pack_openings o where o.user_id = uid and o.idem_key like p_idem_key || ':%';
    return jsonb_build_object('openings', openings, 'opened', jsonb_array_length(openings), 'coins_after', w.coins, 'free_packs_after', w.free_packs, 'stash', private.stash_of(uid), 'repeat', true);
  end if;
  select * into pt from public.pack_types where id = p_pack_type;
  if not found then raise exception 'That pack does not exist.'; end if;
  while i < n loop
    select * into b from public.pack_bundles pb where pb.user_id = uid and pb.pack_type = pt.id and pb.packs_left > 0 order by pb.created_at, pb.id for update limit 1;
    use_free := not found;
    if use_free then
      select * into w from public.wallets where user_id = uid;
      exit when w.free_packs < 1;
      update public.wallets set free_packs = free_packs - 1, updated_at = now() where user_id = uid;
    end if;
    i := i + 1;
    res := private.deal_pack(uid, pt, gen_random_uuid(), p_idem_key || ':' || i, case when use_free then null else b.id end, 0, use_free,
                             (not use_free) and b.packs_left = 1, case when use_free then '{}'::jsonb else b.promises end, case when use_free then '{}'::jsonb else b.progress end);
    if not use_free then
      update public.pack_bundles set packs_left = packs_left - 1, progress = res -> 'progress', updated_at = now(),
        result = case when b.packs_left = 1 then coalesce(result, '{}'::jsonb) || jsonb_build_object('extras', res -> 'extras') else result end
        where id = b.id;
    end if;
    openings := openings || res;
  end loop;
  if i = 0 then raise exception 'No sealed packs of that kind in My Packs.'; end if;
  select * into w from public.wallets where user_id = uid;
  return jsonb_build_object('openings', openings, 'opened', i, 'coins_after', w.coins, 'free_packs_after', w.free_packs, 'stash', private.stash_of(uid), 'repeat', false);
end $$;

-- open_pack (buy one and open it at once, or spend a free pack) now deals through deal_pack, so the bad-luck shield counts it too
create or replace function public.open_pack(p_pack_type text, p_idem_key text, p_use_free boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  w public.wallets;
  pt public.pack_types;
  prior public.pack_openings;
  oid uuid := gen_random_uuid();
  price integer := 0;
  use_free boolean := coalesce(p_use_free, false);
  opened_today bigint;
  result jsonb;
begin
  if p_idem_key is null or length(p_idem_key) not between 8 and 120 then raise exception 'idem_key required'; end if;
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
    where user_id = uid and pack_type = pt.id and bundle_id is null and created_at >= private.day_start();
  if opened_today >= pt.max_per_day then raise exception 'You have opened enough of those for today (% a day).', pt.max_per_day; end if;
  if use_free then
    if w.free_packs < 1 then raise exception 'You have no free pack.'; end if;
    update public.wallets set free_packs = free_packs - 1, updated_at = now() where user_id = uid;
  else
    price := pt.price_coins;
    if price > 0 then perform private.ledger_apply(uid, -price, 'pack_purchase', oid::text, 'pack:' || p_idem_key, null); end if;
  end if;
  result := private.deal_pack(uid, pt, oid, p_idem_key, null, price, use_free, false, '{}'::jsonb, '{}'::jsonb);
  select * into w from public.wallets where user_id = uid;
  return result || jsonb_build_object('coins_after', w.coins, 'free_packs_after', w.free_packs, 'repeat', false);
end $$;

-- shop_info: the bundles, My Packs, the bad-luck shield and the badges, next to the packs as before
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
    'bundles', coalesce((select jsonb_agg(jsonb_build_object('size', (b ->> 'size')::int, 'bonus', coalesce((b ->> 'bonus')::int, 0), 'promises', private.bundle_promises((b ->> 'size')::int)) order by (b ->> 'size')::int)
                         from jsonb_array_elements(coalesce(private.setting('pack_bundles'), '[]'::jsonb)) b), '[]'::jsonb),
    'stash', private.stash_of(uid),
    'pity', jsonb_build_object('limit', greatest(1, coalesce((private.setting('pack_pity_limit'))::int, 40)),
                               'since', coalesce((select ps.packs_since_legendary from public.player_stats ps where ps.user_id = uid), 0)),
    'badges', coalesce(private.setting('shop_badges'), '{}'::jsonb),
    'card_backs', coalesce((select jsonb_agg(c.item order by c.created_at) from public.player_cosmetics c where c.user_id = uid and c.kind = 'card_back'), '[]'::jsonb),
    'coins', (select coins from public.wallets where user_id = uid),
    'free_packs', (select free_packs from public.wallets where user_id = uid));
end $$;

revoke all on function public.buy_packs(text, integer, text), public.open_stash(text, integer, text) from public, anon;
grant execute on function public.buy_packs(text, integer, text), public.open_stash(text, integer, text) to authenticated;
revoke all on function private.bundle_def(integer), private.bundle_promises(integer), private.stash_of(uuid),
  private.deal_pack(uuid, public.pack_types, uuid, text, uuid, integer, boolean, boolean, jsonb, jsonb) from public, anon, authenticated;

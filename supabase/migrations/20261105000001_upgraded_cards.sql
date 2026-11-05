-- Upgraded cards (Ken, Nov 4: "the higher the rarity of the cards, the lower the chance of getting the new cards ... a low chance so
-- people get excited when they hit them ... It should be worth the amount of cards, so you can combine two enhanced cards of the same
-- together and it will equivalent the amount of cards to the next"). Looks and bragging rights only: a card's tier changes its picture
-- and its stars, never a number or a rule. Five tiers: 1 Original, 2 Enhanced, 3 Overcharged, 4 Legendary, 5 Mythic.
--
-- Worth: every card instance is worth the copies it stands for (1 to start). Combining spends other copies of the SAME card into one
-- card: their worth adds up, and the tier follows the worth thresholds (admin setting upgrade_thresholds, copies: 2 / 5 / 10 / 20).
-- Two Enhanced (worth 2 each) make one Enhanced worth 4, not an Overcharged (Ken). A pack can deal an upgraded card straight away
-- (upgrade_drop_bp, basis points by rarity: Common 2%, Uncommon 1%, Rare 0.5%, Ultra Rare 0.2%, Collector 0.05%; then
-- upgrade_drop_tiers: Enhanced 80%, Overcharged 15%, Legendary 4%, Mythic 1%); it arrives with that tier's worth.
-- Everything is append-only history: spent copies stay as rows (status 'combined'), and upgrade_events keeps every combine.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
alter table public.card_instances add column tier  smallint not null default 1 check (tier between 1 and 5);
alter table public.card_instances add column worth integer  not null default 1 check (worth >= 1);
alter table public.card_instances drop constraint card_instances_status_check;
alter table public.card_instances add constraint card_instances_status_check check (status in ('owned', 'destroyed', 'combined'));
create index card_instances_owner_tier on public.card_instances (owner_id, tier) where status = 'owned' and tier > 1;

alter table public.card_history drop constraint card_history_event_check;
alter table public.card_history add constraint card_history_event_check
  check (event in ('created', 'transferred', 'destroyed', 'admin_moved', 'upgraded', 'combined'));

create table public.upgrade_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  target_id    uuid not null references public.card_instances (id),
  card_id      text not null,
  source_ids   uuid[] not null,
  worth_before integer not null,
  worth_after  integer not null,
  tier_before  smallint not null,
  tier_after   smallint not null,
  idem_key     text not null unique,
  result       jsonb not null,
  created_at   timestamptz not null default now()
);
create index upgrade_events_user on public.upgrade_events (user_id, created_at desc);
alter table public.upgrade_events enable row level security;
revoke all on public.upgrade_events from anon, authenticated;
create trigger upgrade_events_append_only before update or delete on public.upgrade_events
  for each row execute function private.forbid_change();
create trigger upgrade_events_no_truncate before truncate on public.upgrade_events
  for each statement execute function private.forbid_change();

-- ---------------------------------------------------------------------------
-- Settings (admin-editable objects of whole numbers)
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('upgrade_thresholds', '{"2": 2, "3": 5, "4": 10, "5": 20}'::jsonb),
  ('upgrade_drop_bp',    '{"Common": 200, "Uncommon": 100, "Rare": 50, "Ultra Rare": 20, "Collector": 5}'::jsonb),
  ('upgrade_drop_tiers', '{"2": 8000, "3": 1500, "4": 400, "5": 100}'::jsonb)
on conflict (key) do nothing;

create or replace function private.editable_settings() returns text[]
language sql immutable set search_path = '' as $$
  select array['signup_bonus_coins', 'max_decks', 'blocked_words', 'reserved_usernames', 'reserved_name_parts',
               'pvp_win_coins', 'pvp_loss_coins', 'pvp_daily_coin_cap', 'pvp_min_turns',
               'quest_reward_easy', 'quest_reward_medium', 'quest_reward_hard', 'quest_streak_days',
               'pvp_phase_seconds', 'pvp_bank_seconds', 'pvp_respond_seconds', 'pvp_timeouts_to_forfeit',
               'pvp_respond_min_seconds', 'pvp_abandon_seconds', 'pvp_attack_mode',
               'upgrade_thresholds', 'upgrade_drop_bp', 'upgrade_drop_tiers']
$$;

-- The thresholds as read by the server (falls back to the defaults if the row is ever missing)
create function private.upgrade_thresholds() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(private.setting('upgrade_thresholds'), '{"2": 2, "3": 5, "4": 10, "5": 20}'::jsonb)
$$;
create function private.worth_of_tier(p_tier integer) returns integer
language sql stable set search_path = '' as $$
  select case when p_tier <= 1 then 1 else greatest(1, coalesce((private.upgrade_thresholds() ->> p_tier::text)::int, 1)) end
$$;
create function private.tier_of_worth(p_worth integer) returns smallint
language plpgsql stable set search_path = '' as $$
declare t integer;
begin
  for t in reverse 5..2 loop
    if p_worth >= private.worth_of_tier(t) then return t; end if;
  end loop;
  return 1;
end $$;

-- A pack card's roll for an upgrade: tier 1 nearly always; by rarity, now and then a higher tier (see the settings above)
create function private.roll_upgrade(p_rarity text) returns smallint
language plpgsql volatile set search_path = '' as $$
declare
  bp integer := coalesce((coalesce(private.setting('upgrade_drop_bp'), '{}'::jsonb) ->> p_rarity)::int, 0);
  tiers jsonb := coalesce(private.setting('upgrade_drop_tiers'), '{"2": 8000, "3": 1500, "4": 400, "5": 100}'::jsonb);
  roll integer; acc integer := 0; t integer;
begin
  if bp <= 0 or private.random_below(10000) >= bp then return 1; end if;
  roll := private.random_below(10000);
  for t in 2..5 loop
    acc := acc + coalesce((tiers ->> t::text)::int, 0);
    if roll < acc then return t; end if;
  end loop;
  return 2;
end $$;

-- One card instance at a tier (a pack drop); its worth is what that tier would have cost in copies
create function private.card_grant_tier(p_user uuid, p_card text, p_tier integer, p_origin text, p_ref text, p_by uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid; t integer := greatest(1, least(5, coalesce(p_tier, 1)));
begin
  insert into public.card_instances (card_id, owner_id, original_owner_id, origin, origin_ref, tier, worth)
    values (p_card, p_user, p_user, p_origin, p_ref, t, private.worth_of_tier(t)) returning id into cid;
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
    values (cid, 'created', null, p_user, p_origin || case when t > 1 then ' (tier ' || t || ')' else '' end, p_ref, p_by);
  return cid;
end $$;

-- ---------------------------------------------------------------------------
-- Combining: spend copies of the same card into one card (the player's own door)
-- ---------------------------------------------------------------------------
create function public.upgrade_card(p_target uuid, p_sources uuid[], p_idem_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  prior public.upgrade_events;
  t public.card_instances;
  srcs uuid[] := (select coalesce(array_agg(distinct s), '{}'::uuid[]) from unnest(coalesce(p_sources, '{}'::uuid[])) s where s is not null and s <> p_target);
  found_n integer; spent_worth integer; need integer; left_n integer;
  new_worth integer; new_tier smallint; eid uuid := gen_random_uuid(); result jsonb;
begin
  if p_idem_key is null or length(p_idem_key) not between 8 and 120 then raise exception 'idem_key required'; end if;
  -- the wallet lock serialises everything this player does with cards and coins
  perform 1 from public.wallets where user_id = uid for update;
  select * into prior from public.upgrade_events where idem_key = p_idem_key;
  if found then
    if prior.user_id <> uid then raise exception 'idem_key already used'; end if;
    return prior.result || jsonb_build_object('repeat', true);
  end if;
  if cardinality(srcs) < 1 then raise exception 'Pick at least one copy to combine.'; end if;
  if cardinality(srcs) > 50 then raise exception 'At most 50 copies at a time.'; end if;
  select * into t from public.card_instances where id = p_target and owner_id = uid and status = 'owned' for update;
  if not found then raise exception 'That card is not yours.'; end if;
  if t.tier >= 5 then raise exception 'That card is already Mythic.'; end if;
  perform 1 from public.card_instances where id = any (srcs) for update; -- lock the copies first (no aggregate with FOR UPDATE)
  select count(*), coalesce(sum(worth), 0) into found_n, spent_worth
    from public.card_instances where id = any (srcs) and owner_id = uid and status = 'owned' and card_id = t.card_id;
  if found_n <> cardinality(srcs) then raise exception 'Only your own copies of the same card can be combined.'; end if;
  -- never leave a deck short: keep as many owned copies as the biggest deck uses (and at least the card itself)
  need := greatest(1, coalesce((select max(n) from (select count(*) as n from public.decks d, unnest(d.cards) c where d.user_id = uid and c = t.card_id group by d.id) x), 0));
  left_n := (select count(*) from public.card_instances where owner_id = uid and status = 'owned' and card_id = t.card_id) - cardinality(srcs);
  if left_n < need then raise exception 'Keep % cop% of that card for your decks.', need, case when need = 1 then 'y' else 'ies' end; end if;
  new_worth := t.worth + spent_worth;
  new_tier := private.tier_of_worth(new_worth);
  update public.card_instances set worth = new_worth, tier = new_tier, updated_at = now() where id = t.id;
  update public.card_instances set status = 'combined', updated_at = now() where id = any (srcs);
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
    select s, 'combined', uid, null, 'combined into ' || t.id::text, eid::text, null from unnest(srcs) s;
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
    values (t.id, 'upgraded', uid, uid, format('worth %s -> %s, tier %s -> %s', t.worth, new_worth, t.tier, new_tier), eid::text, null);
  result := jsonb_build_object('event_id', eid, 'target', t.id, 'card_id', t.card_id, 'spent', cardinality(srcs),
    'worth_before', t.worth, 'worth_after', new_worth, 'tier_before', t.tier, 'tier_after', new_tier,
    'next_worth', case when new_tier < 5 then private.worth_of_tier(new_tier + 1) else null end);
  insert into public.upgrade_events (id, user_id, target_id, card_id, source_ids, worth_before, worth_after, tier_before, tier_after, idem_key, result)
    values (eid, uid, t.id, t.card_id, srcs, t.worth, new_worth, t.tier, new_tier, p_idem_key, result);
  return result || jsonb_build_object('repeat', false);
end $$;

-- What the Collection and the Upgrade screen read: the thresholds, and each card's best tier and copies
create function public.my_upgrade_info() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return jsonb_build_object(
    'thresholds', private.upgrade_thresholds(),
    'drop_bp', coalesce(private.setting('upgrade_drop_bp'), '{}'::jsonb),
    'drop_tiers', coalesce(private.setting('upgrade_drop_tiers'), '{}'::jsonb),
    'cards', coalesce((select jsonb_object_agg(card_id, jsonb_build_object('best', best, 'owned', owned, 'upgraded', upgraded))
                       from (select ci.card_id, max(ci.tier) as best, count(*) as owned, count(*) filter (where ci.tier > 1) as upgraded
                             from public.card_instances ci where ci.owner_id = uid and ci.status = 'owned' group by ci.card_id) x), '{}'::jsonb));
end $$;

-- Every owned copy of one card, for picking what to combine
create function public.my_card_copies(p_card text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', ci.id, 'tier', ci.tier, 'worth', ci.worth, 'since', ci.created_at) order by ci.tier desc, ci.worth desc, ci.created_at)
                   from public.card_instances ci where ci.owner_id = uid and ci.status = 'owned' and ci.card_id = p_card), '[]'::jsonb);
end $$;

revoke all on function public.upgrade_card(uuid, uuid[], text), public.my_upgrade_info(), public.my_card_copies(text) from public, anon;
grant execute on function public.upgrade_card(uuid, uuid[], text), public.my_upgrade_info(), public.my_card_copies(text) to authenticated;
revoke all on function private.editable_settings(), private.upgrade_thresholds(), private.worth_of_tier(integer), private.tier_of_worth(integer),
  private.roll_upgrade(text), private.card_grant_tier(uuid, text, integer, text, text, uuid) from public, anon, authenticated;

-- open_pack and admin_set_setting are re-created below with the upgrade roll and the new settings (generated from their earlier text)

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
  elsif p_key in ('upgrade_thresholds', 'upgrade_drop_bp', 'upgrade_drop_tiers') then
    -- Objects of whole numbers: thresholds are copies for tiers 2..5, rising; drop_bp is basis points by rarity (0..10000);
    -- drop_tiers is basis points for tiers 2..5 adding up to 10000.
    if jsonb_typeof(v) <> 'object' then raise exception 'must be an object of whole numbers'; end if;
    select k into bad from jsonb_each(v) e(k, x) where jsonb_typeof(x) <> 'number' or (x #>> '{}')::numeric <> trunc((x #>> '{}')::numeric) or (x #>> '{}')::numeric < 0 limit 1;
    if found then raise exception 'every value must be a whole number of 0 or more ("%")', bad; end if;
    if p_key = 'upgrade_thresholds' then
      if not (v ? '2' and v ? '3' and v ? '4' and v ? '5') or (select count(*) from jsonb_object_keys(v)) <> 4 then raise exception 'needs the four tiers 2, 3, 4 and 5'; end if;
      if not ((v ->> '2')::int >= 2 and (v ->> '3')::int > (v ->> '2')::int and (v ->> '4')::int > (v ->> '3')::int and (v ->> '5')::int > (v ->> '4')::int and (v ->> '5')::int <= 1000) then
        raise exception 'tiers must rise: 2 or more, then higher each tier, at most 1000'; end if;
    elsif p_key = 'upgrade_drop_tiers' then
      if not (v ? '2' and v ? '3' and v ? '4' and v ? '5') or (select count(*) from jsonb_object_keys(v)) <> 4 then raise exception 'needs the four tiers 2, 3, 4 and 5'; end if;
      if (select sum((x #>> '{}')::int) from jsonb_each(v) e(k, x)) <> 10000 then raise exception 'the four tiers must add up to 10000'; end if;
    else
      select k into bad from jsonb_each(v) e(k, x) where not exists (select 1 from public.rarities r where r.name = k) or (x #>> '{}')::int > 10000 limit 1;
      if found then raise exception 'rarity names only, each 0 to 10000 ("%")', bad; end if;
    end if;
  elsif p_key = 'pvp_attack_mode' then
    -- One word: 'armed' (counters set ahead of time fire by themselves, no Respond window on an attack) or 'window' (the old per-attack window)
    if jsonb_typeof(v) <> 'string' or not (v #>> '{}') in ('armed', 'window') then raise exception 'must be "armed" or "window"'; end if;
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

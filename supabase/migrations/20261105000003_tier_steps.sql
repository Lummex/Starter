-- Upgrade steps by rarity (Ken and Forge, Nov 5: "I don't think those are the exact numbers"; a Mythic should take about all the
-- copies from a lot of packs). The flat 2 / 5 / 10 / 20 of 20261105000001 becomes extra copies per step, by rarity:
--   Enhanced / Overcharged / Legendary / Mythic
--   Common      5 / 15 / 30 / 50       Uncommon  4 / 12 / 24 / 40       Rare  2 / 4 / 7 / 14
--   Ultra Rare  1 /  2 /  3 /  4       Collector 1 /  1 /  1 /  1
-- A card's worth is still the copies it stands for (itself + every copy spent into it); the tier is reached when the worth
-- is 1 + the steps so far (a Common is Enhanced at worth 6, Overcharged at 21, Legendary at 51, Mythic at 101; a Collector
-- at 2, 3, 4, 5). A dropped upgraded card arrives with that worth for its rarity. Admin-editable (upgrade_steps).

insert into public.settings (key, value) values
  ('upgrade_steps', '{"Common": [5, 15, 30, 50], "Uncommon": [4, 12, 24, 40], "Rare": [2, 4, 7, 14], "Ultra Rare": [1, 2, 3, 4], "Collector": [1, 1, 1, 1]}'::jsonb)
on conflict (key) do nothing;
delete from public.settings where key = 'upgrade_thresholds';

create or replace function private.editable_settings() returns text[]
language sql immutable set search_path = '' as $$
  select array['signup_bonus_coins', 'max_decks', 'blocked_words', 'reserved_usernames', 'reserved_name_parts',
               'pvp_win_coins', 'pvp_loss_coins', 'pvp_daily_coin_cap', 'pvp_min_turns',
               'quest_reward_easy', 'quest_reward_medium', 'quest_reward_hard', 'quest_streak_days',
               'pvp_phase_seconds', 'pvp_bank_seconds', 'pvp_respond_seconds', 'pvp_timeouts_to_forfeit',
               'pvp_respond_min_seconds', 'pvp_abandon_seconds', 'pvp_attack_mode',
               'upgrade_steps', 'upgrade_drop_bp', 'upgrade_drop_tiers',
               'ranked_k', 'ranked_window', 'ranked_window_step']
$$;

create or replace function private.upgrade_steps() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(private.setting('upgrade_steps'), '{"Common": [5, 15, 30, 50], "Uncommon": [4, 12, 24, 40], "Rare": [2, 4, 7, 14], "Ultra Rare": [1, 2, 3, 4], "Collector": [1, 1, 1, 1]}'::jsonb)
$$;
-- the steps for one rarity (an unknown rarity takes the Common ones)
create function private.steps_of(p_rarity text) returns integer[]
language sql stable set search_path = '' as $$
  select coalesce((select array_agg((x #>> '{}')::int order by o) from jsonb_array_elements(coalesce(private.upgrade_steps() -> p_rarity, private.upgrade_steps() -> 'Common')) with ordinality e(x, o)), array[5, 15, 30, 50])
$$;
-- worth needed for a tier: 1 + the steps so far
create or replace function private.worth_of_tier(p_tier integer, p_rarity text) returns integer
language sql stable set search_path = '' as $$
  select case when p_tier <= 1 then 1 else 1 + (select coalesce(sum(s), 0) from unnest((private.steps_of(p_rarity))[1:least(4, p_tier - 1)]) s) end
$$;
create or replace function private.tier_of_worth(p_worth integer, p_rarity text) returns smallint
language plpgsql stable set search_path = '' as $$
declare t integer;
begin
  for t in reverse 5..2 loop
    if p_worth >= private.worth_of_tier(t, p_rarity) then return t; end if;
  end loop;
  return 1;
end $$;
drop function private.worth_of_tier(integer);
drop function private.tier_of_worth(integer);
drop function private.upgrade_thresholds();

create or replace function private.card_grant_tier(p_user uuid, p_card text, p_tier integer, p_origin text, p_ref text, p_by uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid; t integer := greatest(1, least(5, coalesce(p_tier, 1))); rar text := (select c.rarity from public.cards c where c.id = p_card);
begin
  insert into public.card_instances (card_id, owner_id, original_owner_id, origin, origin_ref, tier, worth)
    values (p_card, p_user, p_user, p_origin, p_ref, t, private.worth_of_tier(t, rar)) returning id into cid;
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
    values (cid, 'created', null, p_user, p_origin || case when t > 1 then ' (tier ' || t || ')' else '' end, p_ref, p_by);
  return cid;
end $$;

create or replace function public.upgrade_card(p_target uuid, p_sources uuid[], p_idem_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  prior public.upgrade_events;
  t public.card_instances;
  rar text;
  srcs uuid[] := (select coalesce(array_agg(distinct s), '{}'::uuid[]) from unnest(coalesce(p_sources, '{}'::uuid[])) s where s is not null and s <> p_target);
  found_n integer; spent_worth integer; need integer; left_n integer;
  new_worth integer; new_tier smallint; eid uuid := gen_random_uuid(); result jsonb;
begin
  if p_idem_key is null or length(p_idem_key) not between 8 and 120 then raise exception 'idem_key required'; end if;
  perform 1 from public.wallets where user_id = uid for update;
  select * into prior from public.upgrade_events where idem_key = p_idem_key;
  if found then
    if prior.user_id <> uid then raise exception 'idem_key already used'; end if;
    return prior.result || jsonb_build_object('repeat', true);
  end if;
  if cardinality(srcs) < 1 then raise exception 'Pick at least one copy to combine.'; end if;
  if cardinality(srcs) > 200 then raise exception 'At most 200 copies at a time.'; end if;
  select * into t from public.card_instances where id = p_target and owner_id = uid and status = 'owned' for update;
  if not found then raise exception 'That card is not yours.'; end if;
  if t.tier >= 5 then raise exception 'That card is already Mythic.'; end if;
  rar := (select c.rarity from public.cards c where c.id = t.card_id);
  perform 1 from public.card_instances where id = any (srcs) for update;
  select count(*), coalesce(sum(worth), 0) into found_n, spent_worth
    from public.card_instances where id = any (srcs) and owner_id = uid and status = 'owned' and card_id = t.card_id;
  if found_n <> cardinality(srcs) then raise exception 'Only your own copies of the same card can be combined.'; end if;
  need := greatest(1, coalesce((select max(n) from (select count(*) as n from public.decks d, unnest(d.cards) c where d.user_id = uid and c = t.card_id group by d.id) x), 0));
  left_n := (select count(*) from public.card_instances where owner_id = uid and status = 'owned' and card_id = t.card_id) - cardinality(srcs);
  if left_n < need then raise exception 'Keep % cop% of that card for your decks.', need, case when need = 1 then 'y' else 'ies' end; end if;
  new_worth := t.worth + spent_worth;
  new_tier := private.tier_of_worth(new_worth, rar);
  update public.card_instances set worth = new_worth, tier = new_tier, updated_at = now() where id = t.id;
  update public.card_instances set status = 'combined', updated_at = now() where id = any (srcs);
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
    select s, 'combined', uid, null, 'combined into ' || t.id::text, eid::text, null from unnest(srcs) s;
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
    values (t.id, 'upgraded', uid, uid, format('worth %s -> %s, tier %s -> %s', t.worth, new_worth, t.tier, new_tier), eid::text, null);
  result := jsonb_build_object('event_id', eid, 'target', t.id, 'card_id', t.card_id, 'spent', cardinality(srcs),
    'worth_before', t.worth, 'worth_after', new_worth, 'tier_before', t.tier, 'tier_after', new_tier,
    'next_worth', case when new_tier < 5 then private.worth_of_tier(new_tier + 1, rar) else null end);
  insert into public.upgrade_events (id, user_id, target_id, card_id, source_ids, worth_before, worth_after, tier_before, tier_after, idem_key, result)
    values (eid, uid, t.id, t.card_id, srcs, t.worth, new_worth, t.tier, new_tier, p_idem_key, result);
  return result || jsonb_build_object('repeat', false);
end $$;

create or replace function public.my_upgrade_info() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return jsonb_build_object(
    'steps', private.upgrade_steps(),
    'drop_bp', coalesce(private.setting('upgrade_drop_bp'), '{}'::jsonb),
    'drop_tiers', coalesce(private.setting('upgrade_drop_tiers'), '{}'::jsonb),
    'cards', coalesce((select jsonb_object_agg(card_id, jsonb_build_object('best', best, 'owned', owned, 'upgraded', upgraded))
                       from (select ci.card_id, max(ci.tier) as best, count(*) as owned, count(*) filter (where ci.tier > 1) as upgraded
                             from public.card_instances ci where ci.owner_id = uid and ci.status = 'owned' group by ci.card_id) x), '{}'::jsonb));
end $$;

-- The referee asks for the best tier a player owns of each card in a deck, so a match can show them (both players see them)
create function public.pvp_tiers_of(p_user uuid, p_cards text[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_referee();
  return coalesce((select jsonb_object_agg(card_id, best) from (select ci.card_id, max(ci.tier) as best from public.card_instances ci
                   where ci.owner_id = p_user and ci.status = 'owned' and ci.tier > 1 and (p_cards is null or ci.card_id = any (p_cards)) group by ci.card_id) x), '{}'::jsonb);
end $$;
revoke all on function public.pvp_tiers_of(uuid, text[]) from public, anon, authenticated;
revoke all on function private.upgrade_steps(), private.steps_of(text), private.worth_of_tier(integer, text), private.tier_of_worth(integer, text), private.editable_settings() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.pvp_tiers_of(uuid, text[]) to service_role; end if;
end $$;

-- admin_set_setting again: upgrade_steps replaces upgrade_thresholds (otherwise as in 20261105000001)
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
  elsif p_key = 'upgrade_steps' then
    -- Extra copies per step by rarity: {"Common": [5, 15, 30, 50], ...}; every rarity, four whole numbers of 1 or more each
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

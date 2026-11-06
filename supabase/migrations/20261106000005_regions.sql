-- Server regions (Ken, Nov 5: "we need to add a server, so you can know the East Coast, West Coast, Central ... so players can log
-- into their servers. And also I'd like to show for now how many players are in their server playing. Or waiting in lobby.").
--
-- What a "region" is here (Forge's plan, checked): ONE database (East US) for everyone; a region is
--   1. its own matchmaking pool: Ranked / Unranked queues pair within the region, so two players in a region are close to each other;
--   2. the edge where the match function runs for that player (the game sends x-region; the function's database hops stay in East US);
--   3. a home for the live counts: online, playing, waiting in the queue.
-- Lag, plainly: the dice and the clocks live in the one database, so a West player's every move still crosses the country once
-- (~60-80 ms each way); the region pins the function next to the player, not the data. Per-region databases would be separate
-- Supabase projects with separate accounts and money, so they are not done here.
-- Small player base: nobody in your region after region_fallback_seconds (45) -> the game offers "Search all regions"; a player
-- who said yes pairs with anyone, and anyone pairs with them. Nobody is split into an empty queue without being told.

-- ---------------------------------------------------------------------------
-- Settings (admin-editable): the regions, the fallback time, the counts switch
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('regions', '[{"id": "us-east", "name": "US East", "edge": "us-east-1", "enabled": true},
                {"id": "us-central", "name": "US Central", "edge": "us-east-1", "enabled": true},
                {"id": "us-west", "name": "US West", "edge": "us-west-1", "enabled": true},
                {"id": "eu", "name": "Europe", "edge": "eu-west-1", "enabled": false}]'::jsonb),
  ('region_fallback_seconds', '45'::jsonb),
  ('region_counts', 'true'::jsonb)
on conflict (key) do nothing;
-- (US Central has no Supabase edge of its own; its calls run in East US, which is also where the database is.)

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
               'pack_bundles', 'pack_bundle_promises', 'pack_pity_limit', 'pack_bundles_per_day', 'shop_badges',
               'ranked_ladder', 'dashboard_counts',
               'regions', 'region_fallback_seconds', 'region_counts']
$$;

alter function private.int_setting_range(text) rename to int_setting_range_v2;
create function private.int_setting_range(p_key text) returns table (lo integer, hi integer)
language sql immutable set search_path = '' as $$
  select r.lo, r.hi from (select 'region_fallback_seconds' as key, 10 as lo, 600 as hi) r where r.key = p_key
  union all select v.lo, v.hi from private.int_setting_range_v2(p_key) v
$$;
revoke all on function private.int_setting_range(text), private.int_setting_range_v2(text), private.editable_settings() from public, anon, authenticated;

-- the edges Supabase offers for x-region (docs: Regional invocation)
create function private.edge_regions() returns text[]
language sql immutable set search_path = '' as $$
  select array['ap-northeast-1', 'ap-northeast-2', 'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ca-central-1', 'us-east-1', 'us-west-1', 'us-west-2',
               'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'sa-east-1']
$$;

-- the enabled regions, in order
create function private.regions_enabled() returns table (id text, name text, edge text)
language sql stable set search_path = '' as $$
  select r ->> 'id', r ->> 'name', r ->> 'edge'
  from jsonb_array_elements(coalesce(private.setting('regions'), '[]'::jsonb)) with ordinality x(r, n)
  where coalesce((r ->> 'enabled')::boolean, false)
  order by n
$$;
create function private.region_ok(p_region text) returns boolean
language sql stable set search_path = '' as $$ select exists (select 1 from private.regions_enabled() r where r.id = p_region) $$;
create function private.region_default() returns text
language sql stable set search_path = '' as $$ select r.id from private.regions_enabled() r limit 1 $$;
revoke all on function private.edge_regions(), private.regions_enabled(), private.region_ok(text), private.region_default() from public, anon, authenticated;

-- admin_set_setting: the same checks as before, plus the three new keys (and the true/false switches, which had no branch yet)
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

-- ---------------------------------------------------------------------------
-- Columns: the player's home region, the queue row's region (and "any region"), the match's region
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists region text check (region is null or region ~ '^[a-z][a-z0-9-]{1,19}$');
create index if not exists profiles_region_seen on public.profiles (region, last_seen_at desc);
alter table public.pvp_queue add column if not exists region text not null default 'us-east';
alter table public.pvp_queue add column if not exists any_region boolean not null default false;
create index if not exists pvp_queue_region on public.pvp_queue (region, mode, since);
alter table public.matches add column if not exists region text;
create index if not exists matches_region_active on public.matches (region) where status = 'active';

-- ---------------------------------------------------------------------------
-- Player doors
-- ---------------------------------------------------------------------------
-- the counts of one region: online (seen in the last 2 minutes), playing (in an active match), waiting (in the queue, polling)
create function private.region_counts(p_region text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'online', (select count(*) from public.profiles p where p.region = p_region and p.last_seen_at > now() - interval '2 minutes'),
    'playing', (select count(distinct u) from (select m.player_a as u from public.matches m where m.status = 'active' and m.region = p_region
                                               union all select m.player_b from public.matches m where m.status = 'active' and m.region = p_region) x),
    'waiting', (select count(*) from public.pvp_queue q where q.region = p_region and q.seen_at > now() - interval '15 seconds'))
$$;

-- The regions for the picker: each enabled region with its edge and (when the switch is on) its live counts; the caller's own
-- choice; the fallback time. Calling it is also the heartbeat: the caller counts as online for 2 minutes.
create function public.regions_info() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); counts boolean := coalesce((private.setting('region_counts'))::boolean, true);
begin
  update public.profiles set last_seen_at = now() where id = uid and last_seen_at < now() - interval '20 seconds';
  return jsonb_build_object(
    'regions', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'edge', r.edge) || case when counts then private.region_counts(r.id) else '{}'::jsonb end) from private.regions_enabled() r), '[]'::jsonb),
    'mine', (select p.region from public.profiles p where p.id = uid and private.region_ok(p.region)),
    'fallback_seconds', coalesce((private.setting('region_fallback_seconds'))::int, 45),
    'counts', counts);
end $$;

-- The player's choice of server (remembered on the account). Null clears it (back to "nearest"). Returns regions_info().
create function public.set_region(p_region text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  if p_region is not null and not private.region_ok(p_region) then raise exception 'That server is not open.'; end if;
  update public.profiles set region = p_region, last_seen_at = now() where id = uid;
  return public.regions_info();
end $$;
revoke all on function public.regions_info(), public.set_region(text), private.region_counts(text) from public, anon, authenticated;
grant execute on function public.regions_info(), public.set_region(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The queue by region (referee only)
-- ---------------------------------------------------------------------------
-- join (or poll) with a region; p_any = the player agreed to "Search all regions". A new region starts the wait again, "any" keeps it.
create function public.pvp_queue_join(p_user uuid, p_mode text, p_player jsonb, p_deck jsonb, p_want_avg boolean, p_region text, p_any boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.pvp_queue; reg text := p_region;
begin
  perform private.assert_referee();
  if p_mode not in ('ranked', 'unranked') then raise exception 'mode must be ranked or unranked'; end if;
  if reg is null or not private.region_ok(reg) then reg := private.region_default(); end if;
  delete from public.pvp_queue where seen_at < now() - interval '2 minutes';
  insert into public.pvp_queue (user_id, mode, player, deck, rating, region, any_region) values (p_user, p_mode, p_player, p_deck, private.rating_of(p_user), reg, coalesce(p_any, false))
  on conflict (user_id) do update set player = excluded.player, deck = excluded.deck, rating = excluded.rating, seen_at = now(),
    since = case when public.pvp_queue.mode = excluded.mode and public.pvp_queue.region = excluded.region then public.pvp_queue.since else now() end,
    mode = excluded.mode, region = excluded.region, any_region = excluded.any_region
  returning * into r;
  -- the player's home region follows the queue (so the counts and the next visit know it)
  update public.profiles set region = reg, last_seen_at = now() where id = p_user and (region is distinct from reg or last_seen_at < now() - interval '20 seconds');
  return jsonb_build_object('rating', r.rating, 'since', r.since, 'waited', extract(epoch from now() - r.since)::int, 'region', r.region, 'any', r.any_region,
    'others', (select count(*) from public.pvp_queue q where q.mode = r.mode and q.user_id <> r.user_id and q.seen_at > now() - interval '15 seconds' and (q.region = r.region or r.any_region or q.any_region)),
    'others_all', (select count(*) from public.pvp_queue q where q.mode = r.mode and q.user_id <> r.user_id and q.seen_at > now() - interval '15 seconds'),
    'fallback', coalesce((private.setting('region_fallback_seconds'))::int, 45))
    || case when coalesce(p_want_avg, false) then jsonb_build_object('avg_wait', private.avg_wait(p_mode),
         'pairings', (select count(*) from public.pvp_pairings where mode = p_mode and created_at > now() - interval '30 minutes')) else '{}'::jsonb end;
end $$;

-- pairs within the region, or across regions when either side agreed to search all of them; the match keeps seat a's region
create or replace function public.pvp_queue_pair(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.pvp_queue; o public.pvp_queue;
  win integer; waited integer;
begin
  perform private.assert_referee();
  select * into me from public.pvp_queue where user_id = p_user for update;
  if not found then return null; end if;
  waited := extract(epoch from now() - me.since)::int;
  win := coalesce((private.setting('ranked_window'))::int, 100) + coalesce((private.setting('ranked_window_step'))::int, 50) * (waited / 10);
  select q.* into o from public.pvp_queue q
    where q.mode = me.mode and q.user_id <> me.user_id and q.seen_at > now() - interval '15 seconds'
      and (q.region = me.region or me.any_region or q.any_region)
      and (me.mode <> 'ranked' or abs(q.rating - me.rating) <= win)
      and not exists (select 1 from public.matches m where m.status = 'active' and (m.player_a = q.user_id or m.player_b = q.user_id))
    order by (q.region = me.region) desc, q.since limit 1 for update skip locked;
  if not found then return null; end if;
  delete from public.pvp_queue where user_id in (me.user_id, o.user_id);
  insert into public.pvp_pairings (mode, waited_a, waited_b) values (me.mode, extract(epoch from now() - o.since)::int, waited);
  return jsonb_build_object('mode', me.mode, 'my_rating', me.rating, 'region', o.region, 'cross_region', o.region <> me.region,
    'other', jsonb_build_object('user_id', o.user_id, 'player', o.player, 'deck', o.deck, 'rating', o.rating, 'since', o.since, 'region', o.region));
end $$;

revoke all on function public.pvp_queue_join(uuid, text, jsonb, jsonb, boolean, text, boolean) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.pvp_queue_join(uuid, text, jsonb, jsonb, boolean, text, boolean) to service_role;
  end if;
end $$;

-- the admin player list says the home region too
comment on column public.profiles.region is 'Nov 6: the server region the player chose (or last queued in); null = nearest by ping';

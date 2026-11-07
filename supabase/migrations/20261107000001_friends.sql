-- Friends (Ken, Nov 7: "I'd also like a friends list and so you can save in quick play your friends in your friends list").
-- * Every player has a friend code (8 letters/digits, no look-alikes) besides the username; a request goes by either.
-- * Requests must be accepted (pending in / out); Remove; Block (a blocked player can't send requests, can't join your friend
--   code and isn't shown to you). Kid-safe: no free text anywhere, only names and avatars (usernames already pass the word filter).
-- * Status comes from the existing heartbeat (profiles.last_seen_at, the 30 s regions_info call): online = seen in the last
--   2 minutes, in a match = an active match. No per-second polling.
-- * Challenge: the inviter makes a friend code room as usual (mode friend or practice, the inviter's region), then
--   friend_invite tells the friend; the friend's Accept hands back the room code and the client joins it. Invites last 60 s.
-- * Admin: friends_max (default 100) and friend_invites_enabled; the player page lists friends and blocks and can remove one.
-- TEST database only.

-- ---------------------------------------------------------------------------
-- Friend codes
-- ---------------------------------------------------------------------------
create function private.new_friend_code() returns text
language plpgsql volatile set search_path = '' as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..8 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from public.profiles where friend_code = c);
  end loop;
  return c;
end $$;
alter table public.profiles add column if not exists friend_code text;
update public.profiles set friend_code = private.new_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set default private.new_friend_code();
alter table public.profiles alter column friend_code set not null;
alter table public.profiles add constraint profiles_friend_code_key unique (friend_code);
alter table public.profiles add constraint profiles_friend_code_check check (friend_code ~ '^[A-HJ-NP-Z2-9]{8}$');

-- ---------------------------------------------------------------------------
-- Tables (players never touch them directly; only the doors below)
-- ---------------------------------------------------------------------------
create table public.friendships (
  user_a       uuid not null references auth.users (id) on delete cascade,  -- the smaller id of the pair
  user_b       uuid not null references auth.users (id) on delete cascade,
  status       text not null check (status in ('pending', 'accepted')),
  requested_by uuid not null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);
create index friendships_b on public.friendships (user_b);
create index friendships_requester on public.friendships (requested_by, created_at desc);
revoke all on public.friendships from public, anon, authenticated;
alter table public.friendships enable row level security;

create table public.blocks (
  blocker    uuid not null references auth.users (id) on delete cascade,
  blocked    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index blocks_blocked on public.blocks (blocked);
revoke all on public.blocks from public, anon, authenticated;
alter table public.blocks enable row level security;

create table public.friend_invites (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  room_code  text not null,
  mode       text not null check (mode in ('friend', 'practice')),
  region     text,
  status     text not null default 'open' check (status in ('open', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 seconds',
  check (from_user <> to_user)
);
create index friend_invites_to on public.friend_invites (to_user, status, expires_at);
create index friend_invites_from on public.friend_invites (from_user, created_at desc);
revoke all on public.friend_invites from public, anon, authenticated;
alter table public.friend_invites enable row level security;
-- Realtime: a player may SEE the invites sent to or by them (nothing else, never write), so the pop-up arrives at once
grant select on public.friend_invites to authenticated;
create policy friend_invites_own on public.friend_invites for select to authenticated using (to_user = auth.uid() or from_user = auth.uid());
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then alter publication supabase_realtime add table public.friend_invites; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values ('friends_max', '100'::jsonb), ('friend_invites_enabled', 'true'::jsonb) on conflict (key) do nothing;

alter function private.int_setting_range(text) rename to int_setting_range_v3;
create function private.int_setting_range(p_key text) returns table (lo integer, hi integer)
language sql immutable set search_path = '' as $$
  select r.lo, r.hi from (select 'friends_max' as key, 1 as lo, 1000 as hi) r where r.key = p_key
  union all select v.lo, v.hi from private.int_setting_range_v3(p_key) v
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
               'pack_miners', 'pack_commons', 'pack_uncommons', 'pack_rare_sure', 'pack_rares',
               'pack_bundles', 'pack_bundle_promises', 'pack_pity_limit', 'pack_bundles_per_day', 'shop_badges',
               'ranked_ladder', 'dashboard_counts',
               'regions', 'region_fallback_seconds', 'region_counts',
               'oreshard_bundles', 'oreshards_enabled',
               'friends_max', 'friend_invites_enabled']
$$;
revoke all on function private.int_setting_range(text), private.int_setting_range_v3(text), private.editable_settings(), private.new_friend_code() from public, anon, authenticated;

-- admin_set_setting: friend_invites_enabled is a true/false key (the rest as in 20261106000007)
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
  elsif p_key in ('region_counts', 'dashboard_counts', 'oreshards_enabled', 'friend_invites_enabled') then
    if jsonb_typeof(v) <> 'boolean' then raise exception 'must be true or false'; end if;
  elsif p_key = 'oreshard_bundles' then
    -- Nov 6: a list of {id, name, usd_cents, oreshards, bonus_pct}: 1 to 8 bundles, ids = letters (2-20) and unique, names 1-40 characters,
    -- usd_cents 50-99999 (Stripe's minimum is 50 cents), oreshards 1-1000000, bonus_pct 0-100, whole numbers
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < 1 or jsonb_array_length(v) > 8 then raise exception 'must be a list of 1 to 8 bundles'; end if;
    select coalesce(x ->> 'id', '?') into bad from jsonb_array_elements(v) e(x)
      where jsonb_typeof(x) <> 'object' or not (x ->> 'id') ~ '^[a-z][a-z0-9-]{1,19}$' or coalesce(length(btrim(x ->> 'name')), 0) not between 1 and 40
         or jsonb_typeof(x -> 'usd_cents') <> 'number' or jsonb_typeof(x -> 'oreshards') <> 'number' or jsonb_typeof(x -> 'bonus_pct') <> 'number' limit 1;
    if found then raise exception 'each bundle needs an id (letters), a name (1-40 characters) and whole numbers usd_cents, oreshards and bonus_pct ("%")', bad; end if;
    select x ->> 'id' into bad from jsonb_array_elements(v) e(x)
      where (x ->> 'usd_cents')::numeric <> trunc((x ->> 'usd_cents')::numeric) or (x ->> 'oreshards')::numeric <> trunc((x ->> 'oreshards')::numeric)
         or (x ->> 'bonus_pct')::numeric <> trunc((x ->> 'bonus_pct')::numeric)
         or (x ->> 'usd_cents')::numeric not between 50 and 99999 or (x ->> 'oreshards')::numeric not between 1 and 1000000 or (x ->> 'bonus_pct')::numeric not between 0 and 100 limit 1;
    if found then raise exception 'usd_cents 50-99999, oreshards 1-1000000, bonus_pct 0-100, whole numbers ("%")', bad; end if;
    if (select count(distinct x ->> 'id') from jsonb_array_elements(v) e(x)) <> jsonb_array_length(v) then raise exception 'two bundles share an id'; end if;
    v := (select jsonb_agg(jsonb_build_object('id', x ->> 'id', 'name', btrim(x ->> 'name'), 'usd_cents', (x ->> 'usd_cents')::int, 'oreshards', (x ->> 'oreshards')::int, 'bonus_pct', (x ->> 'bonus_pct')::int)
                           order by (x ->> 'usd_cents')::int) from jsonb_array_elements(v) e(x));
  elsif p_key = 'regions' then
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

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker = p_a and blocked = p_b) or (blocker = p_b and blocked = p_a))
$$;
create function private.friend_count(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.friendships f where (f.user_a = p_user or f.user_b = p_user) and (f.status = 'accepted' or f.requested_by = p_user)
$$;
create function private.player_status(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.matches m where m.status = 'active' and p_user in (m.player_a, m.player_b)) then 'in_match'
              when (select last_seen_at from public.profiles where id = p_user) > now() - interval '2 minutes' then 'online'
              else 'offline' end
$$;
/** a player by username (any case) or friend code; null when none */
create function private.find_player(p_who text) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.id from public.profiles p where p.friend_code = upper(btrim(p_who)) limit 1),
    (select p.id from public.profiles p where lower(p.username) = lower(btrim(p_who)) limit 1))
$$;
create function private.friend_card(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar,
    'rating', coalesce((select r.rating from public.ratings r where r.user_id = p.id and r.season = private.season_now()), 1000),
    'rank', private.rank_name(coalesce((select r.rating from public.ratings r where r.user_id = p.id and r.season = private.season_now()), 1000)),
    'status', private.player_status(p.id))
  from public.profiles p where p.id = p_user
$$;
revoke all on function private.blocked_between(uuid, uuid), private.friend_count(uuid), private.player_status(uuid), private.find_player(text), private.friend_card(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Player doors
-- ---------------------------------------------------------------------------
/** Everything the Friends screen shows. Calling it is also a heartbeat (this player counts as online). */
create function public.friends_overview() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  update public.profiles set last_seen_at = now() where id = uid and last_seen_at < now() - interval '20 seconds';
  update public.friend_invites set status = 'expired' where status = 'open' and expires_at <= now() and (to_user = uid or from_user = uid);
  return jsonb_build_object(
    'code', (select friend_code from public.profiles where id = uid),
    'max', coalesce((private.setting('friends_max'))::int, 100),
    'invites_enabled', coalesce((private.setting('friend_invites_enabled'))::boolean, true),
    'friends', coalesce((select jsonb_agg(c order by (c ->> 'status') = 'offline', lower(c ->> 'username')) from
                         (select private.friend_card(case when f.user_a = uid then f.user_b else f.user_a end) || jsonb_build_object('since', f.accepted_at) c
                          from public.friendships f where f.status = 'accepted' and uid in (f.user_a, f.user_b)) x), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar, 'at', f.created_at) order by f.created_at desc)
                          from public.friendships f join public.profiles p on p.id = f.requested_by
                          where f.status = 'pending' and uid in (f.user_a, f.user_b) and f.requested_by <> uid), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar, 'at', f.created_at) order by f.created_at desc)
                          from public.friendships f join public.profiles p on p.id = case when f.user_a = uid then f.user_b else f.user_a end
                          where f.status = 'pending' and f.requested_by = uid), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username) order by lower(p.username))
                         from public.blocks b join public.profiles p on p.id = b.blocked where b.blocker = uid), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'from_id', i.from_user, 'from_name', p.username, 'from_avatar', p.avatar, 'mode', i.mode, 'region', i.region,
                                                           'expires_at', i.expires_at) order by i.created_at desc)
                         from public.friend_invites i join public.profiles p on p.id = i.from_user
                         where i.to_user = uid and i.status = 'open' and i.expires_at > now()), '[]'::jsonb),
    'sent', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'to_id', i.to_user, 'status', i.status, 'code', i.room_code) order by i.created_at desc)
                      from public.friend_invites i where i.from_user = uid and i.created_at > now() - interval '5 minutes'), '[]'::jsonb));
end $$;

/** Send a friend request by username or friend code (accepts at once if they had already asked you). */
create function public.friend_request(p_who text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); other uuid; a uuid; b uuid; f public.friendships; mx int := coalesce((private.setting('friends_max'))::int, 100);
begin
  if p_who is null or length(btrim(p_who)) not between 3 and 40 then raise exception 'Type a player''s name or friend code.'; end if;
  other := private.find_player(p_who);
  -- a block either way looks exactly like "no such player": the blocked player learns nothing
  if other is null or private.blocked_between(uid, other) then raise exception 'No player with that name or friend code.'; end if;
  if other = uid then raise exception 'That''s you!'; end if;
  a := least(uid, other); b := greatest(uid, other);
  select * into f from public.friendships where user_a = a and user_b = b for update;
  if found then
    if f.status = 'accepted' then return jsonb_build_object('ok', true, 'state', 'friends', 'id', other); end if;
    if f.requested_by = uid then return jsonb_build_object('ok', true, 'state', 'sent', 'id', other); end if;
    if private.friend_count(uid) >= mx then raise exception 'Your friends list is full (% friends).', mx; end if;
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = a and user_b = b;
    return jsonb_build_object('ok', true, 'state', 'friends', 'id', other);
  end if;
  if (select count(*) from public.friendships where requested_by = uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'That''s a lot of requests. Try again in a little while.';
  end if;
  if private.friend_count(uid) >= mx then raise exception 'Your friends list is full (% friends).', mx; end if;
  if (select count(*) from public.friendships x where (x.user_a = other or x.user_b = other) and x.status = 'accepted') >= mx then raise exception 'That player''s friends list is full.'; end if;
  insert into public.friendships (user_a, user_b, status, requested_by) values (a, b, 'pending', uid);
  return jsonb_build_object('ok', true, 'state', 'sent', 'id', other);
end $$;

/** Accept or decline a request someone sent you. */
create function public.friend_respond(p_user uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); mx int := coalesce((private.setting('friends_max'))::int, 100);
begin
  if not exists (select 1 from public.friendships where user_a = least(uid, p_user) and user_b = greatest(uid, p_user) and status = 'pending' and requested_by = p_user) then
    raise exception 'That request is gone.';
  end if;
  if coalesce(p_accept, false) then
    if private.friend_count(uid) >= mx then raise exception 'Your friends list is full (% friends).', mx; end if;
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = least(uid, p_user) and user_b = greatest(uid, p_user);
    return jsonb_build_object('ok', true, 'state', 'friends');
  end if;
  delete from public.friendships where user_a = least(uid, p_user) and user_b = greatest(uid, p_user);
  return jsonb_build_object('ok', true, 'state', 'declined');
end $$;

/** Remove a friend, or take back a request you sent. Open invites between you end too. */
create function public.friend_remove(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); n int;
begin
  delete from public.friendships where user_a = least(uid, p_user) and user_b = greatest(uid, p_user);
  get diagnostics n = row_count;
  update public.friend_invites set status = 'cancelled' where status = 'open' and ((from_user = uid and to_user = p_user) or (from_user = p_user and to_user = uid));
  return jsonb_build_object('ok', true, 'removed', n = 1);
end $$;

/** Block: no requests, no invites, no joining each other's friend codes; any friendship ends. */
create function public.friend_block(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  if p_user is null or p_user = uid or not exists (select 1 from public.profiles where id = p_user) then raise exception 'No such player.'; end if;
  insert into public.blocks (blocker, blocked) values (uid, p_user) on conflict do nothing;
  delete from public.friendships where user_a = least(uid, p_user) and user_b = greatest(uid, p_user);
  update public.friend_invites set status = 'cancelled' where status = 'open' and ((from_user = uid and to_user = p_user) or (from_user = p_user and to_user = uid));
  return jsonb_build_object('ok', true);
end $$;

create function public.friend_unblock(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  delete from public.blocks where blocker = uid and blocked = p_user;
  return jsonb_build_object('ok', true);
end $$;

/** Challenge an online friend: the inviter has just made a friend-code room; the friend gets a pop-up for 60 s. */
create function public.friend_invite(p_user uuid, p_code text, p_mode text, p_region text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); inv public.friend_invites;
begin
  if not coalesce((private.setting('friend_invites_enabled'))::boolean, true) then raise exception 'Challenges are switched off right now.'; end if;
  if p_mode not in ('friend', 'practice') then raise exception 'mode is friend or practice'; end if;
  if not exists (select 1 from public.friendships where user_a = least(uid, p_user) and user_b = greatest(uid, p_user) and status = 'accepted') or private.blocked_between(uid, p_user) then
    raise exception 'You can only challenge your friends.';
  end if;
  if not exists (select 1 from public.rooms r where r.code = p_code and r.host = uid and r.status = 'waiting' and r.guest is null and r.expires_at > now()) then
    raise exception 'Make a room first.';
  end if;
  if (select count(*) from public.friend_invites where from_user = uid and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'That''s a lot of challenges. Try again in a little while.';
  end if;
  update public.friend_invites set status = 'cancelled' where from_user = uid and to_user = p_user and status = 'open';
  insert into public.friend_invites (from_user, to_user, room_code, mode, region) values (uid, p_user, p_code, p_mode, left(p_region, 20)) returning * into inv;
  return jsonb_build_object('ok', true, 'id', inv.id, 'expires_at', inv.expires_at);
end $$;

/** The friend's answer: Accept hands back the room code to join; Decline closes it. */
create function public.friend_invite_respond(p_invite uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); inv public.friend_invites;
begin
  select * into inv from public.friend_invites where id = p_invite and to_user = uid for update;
  if not found then raise exception 'That challenge is gone.'; end if;
  if inv.status <> 'open' then raise exception 'That challenge was %.', case inv.status when 'cancelled' then 'called off' else inv.status end; end if;
  if inv.expires_at <= now() then update public.friend_invites set status = 'expired' where id = inv.id; raise exception 'That challenge has expired.'; end if;
  if private.blocked_between(uid, inv.from_user) then raise exception 'That challenge is gone.'; end if;
  update public.friend_invites set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end where id = inv.id;
  if coalesce(p_accept, false) then return jsonb_build_object('ok', true, 'code', inv.room_code, 'mode', inv.mode, 'region', inv.region); end if;
  return jsonb_build_object('ok', true, 'declined', true);
end $$;

/** The inviter calls a challenge off (Cancel on the code screen). */
create function public.friend_invite_cancel(p_invite uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  update public.friend_invites set status = 'cancelled' where id = p_invite and from_user = uid and status = 'open';
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Friend-code rooms: a blocked player can't join (either way)
-- ---------------------------------------------------------------------------
create or replace function public.claim_room(p_code text, p_guest uuid, p_guest_deck jsonb, p_match uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and coalesce(current_setting('role', true), '') not in ('service_role', 'postgres') then
    raise exception 'referee only' using errcode = '42501';
  end if;
  if exists (select 1 from public.rooms r where r.code = p_code and private.blocked_between(r.host, p_guest)) then
    raise exception 'You can''t join this player''s game.';
  end if;
  update public.rooms set guest = p_guest, guest_deck = p_guest_deck, status = 'started', match_id = p_match
    where code = p_code and status = 'waiting' and guest is null and expires_at > now();
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create function public.admin_friends(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return jsonb_build_object(
    'code', (select friend_code from public.profiles where id = p_user),
    'friends', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'status', f.status, 'requested_by', f.requested_by, 'since', coalesce(f.accepted_at, f.created_at)) order by lower(p.username))
                         from public.friendships f join public.profiles p on p.id = case when f.user_a = p_user then f.user_b else f.user_a end
                         where p_user in (f.user_a, f.user_b)), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'at', b.created_at)) from public.blocks b join public.profiles p on p.id = b.blocked where b.blocker = p_user), '[]'::jsonb),
    'blocked_by', (select count(*) from public.blocks b where b.blocked = p_user));
end $$;

create function public.admin_remove_friendship(p_user uuid, p_other uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.assert_admin(); f public.friendships;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  delete from public.friendships where user_a = least(p_user, p_other) and user_b = greatest(p_user, p_other) returning * into f;
  if f.user_a is null then raise exception 'They are not friends.'; end if;
  update public.friend_invites set status = 'cancelled' where status = 'open' and ((from_user = p_user and to_user = p_other) or (from_user = p_other and to_user = p_user));
  perform private.audit(aid, 'remove_friendship', p_user, to_jsonb(f), null, p_reason);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.friends_overview(), public.friend_request(text), public.friend_respond(uuid, boolean), public.friend_remove(uuid), public.friend_block(uuid),
  public.friend_unblock(uuid), public.friend_invite(uuid, text, text, text), public.friend_invite_respond(uuid, boolean), public.friend_invite_cancel(uuid),
  public.admin_friends(uuid), public.admin_remove_friendship(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.friends_overview(), public.friend_request(text), public.friend_respond(uuid, boolean), public.friend_remove(uuid), public.friend_block(uuid),
  public.friend_unblock(uuid), public.friend_invite(uuid, text, text, text), public.friend_invite_respond(uuid, boolean), public.friend_invite_cancel(uuid),
  public.admin_friends(uuid), public.admin_remove_friendship(uuid, uuid, text) to authenticated;

-- Match modes (Ken, Nov 4: "you're going to have to do a ranked match mode. And an unranked match mode. And a practice match mode").
-- Ranked: an open queue paired by rating (Elo, K from a setting, everyone starts at 1000), a season every quarter (Ken, Oct 28:
-- "a rank that goes up and down, quarterly season resets, and matchmaking by rank"), today's coin rewards and quests too.
-- Unranked: an open queue, no rating, today's coin rewards and quests. Friend codes stay as they are (unranked rewards).
-- Practice: a friend code marked practice, or the computer offline: no rating, no coins, no quests, so nothing can be farmed.
-- The queue and the ratings are the referee's (the match function with the service key); players read their rank through my_rank().

alter table public.matches drop constraint matches_mode_check;
alter table public.matches add constraint matches_mode_check check (mode in ('friend', 'ranked', 'casual', 'unranked', 'practice'));

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.pvp_queue (
  user_id   uuid primary key,
  mode      text not null check (mode in ('ranked', 'unranked')),
  player    jsonb not null,           -- {userId, username, avatar} as the referee shows it to the other player
  deck      jsonb not null,           -- the deck choice the player queued with (re-checked when the match starts)
  rating    integer not null default 1000,
  since     timestamptz not null default now(),   -- when the wait began (the window widens with it)
  seen_at   timestamptz not null default now()    -- the last poll; a browser that went away drops out of pairing
);
create index pvp_queue_mode on public.pvp_queue (mode, since);
alter table public.pvp_queue enable row level security;
revoke all on public.pvp_queue from anon, authenticated;

create table public.ratings (
  user_id    uuid not null,
  season     text not null,
  rating     integer not null default 1000,
  games      integer not null default 0,
  wins       integer not null default 0,
  losses     integer not null default 0,
  peak       integer not null default 1000,
  updated_at timestamptz not null default now(),
  primary key (user_id, season)
);
create index ratings_season_rating on public.ratings (season, rating desc);
alter table public.ratings enable row level security;
revoke all on public.ratings from anon, authenticated;

create table public.rating_events (
  id         bigint generated always as identity primary key,
  match_id   uuid not null,
  user_id    uuid not null,
  season     text not null,
  before     integer not null,
  after      integer not null,
  created_at timestamptz not null default now()
);
create index rating_events_user on public.rating_events (user_id, id desc);
alter table public.rating_events enable row level security;
revoke all on public.rating_events from anon, authenticated;
create trigger rating_events_append_only before update or delete on public.rating_events
  for each row execute function private.forbid_change();

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('ranked_k', '32'::jsonb),              -- Elo K: how far one match moves a rating
  ('ranked_window', '100'::jsonb),        -- pair players within this many rating points to start with
  ('ranked_window_step', '50'::jsonb)     -- ... plus this much for every 10 s waited
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
    ('ranked_window_step',       0, 1000)) r(key, lo, hi)
  where r.key = p_key
$$;

create or replace function private.editable_settings() returns text[]
language sql immutable set search_path = '' as $$
  select array['signup_bonus_coins', 'max_decks', 'blocked_words', 'reserved_usernames', 'reserved_name_parts',
               'pvp_win_coins', 'pvp_loss_coins', 'pvp_daily_coin_cap', 'pvp_min_turns',
               'quest_reward_easy', 'quest_reward_medium', 'quest_reward_hard', 'quest_streak_days',
               'pvp_phase_seconds', 'pvp_bank_seconds', 'pvp_respond_seconds', 'pvp_timeouts_to_forfeit',
               'pvp_respond_min_seconds', 'pvp_abandon_seconds', 'pvp_attack_mode',
               'upgrade_thresholds', 'upgrade_drop_bp', 'upgrade_drop_tiers',
               'ranked_k', 'ranked_window', 'ranked_window_step']
$$;

-- ---------------------------------------------------------------------------
-- Seasons and ratings
-- ---------------------------------------------------------------------------
create function private.season_now() returns text
language sql stable set search_path = '' as $$ select to_char(now(), 'YYYY') || '-Q' || extract(quarter from now())::int $$;

create function private.rating_of(p_user uuid) returns integer
language sql stable set search_path = '' as $$
  select coalesce((select r.rating from public.ratings r where r.user_id = p_user and r.season = private.season_now()), 1000)
$$;

create function private.rank_name(p_rating integer) returns text
language sql immutable set search_path = '' as $$
  select case when p_rating < 900 then 'Scrap' when p_rating < 1100 then 'Ore' when p_rating < 1300 then 'Crystal' when p_rating < 1500 then 'Gem' else 'Mythic' end
$$;

-- Elo for one finished ranked match. p_result: 'a', 'b' or 'tie'. Returns {a: {before, after}, b: {before, after}}.
create function private.rating_apply(p_match uuid, p_a uuid, p_b uuid, p_result text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ssn text := private.season_now();
  k integer := greatest(1, coalesce((private.setting('ranked_k'))::int, 32));
  ra integer; rb integer; ea numeric; sa numeric; da integer; na integer; nb integer;
begin
  if exists (select 1 from public.rating_events where match_id = p_match) then
    return (select jsonb_build_object('a', jsonb_build_object('before', max(before) filter (where user_id = p_a), 'after', max(after) filter (where user_id = p_a)),
                                      'b', jsonb_build_object('before', max(before) filter (where user_id = p_b), 'after', max(after) filter (where user_id = p_b)))
            from public.rating_events where match_id = p_match);
  end if;
  insert into public.ratings (user_id, season) values (p_a, ssn), (p_b, ssn) on conflict do nothing;
  select rating into ra from public.ratings where user_id = p_a and season = ssn for update;
  select rating into rb from public.ratings where user_id = p_b and season = ssn for update;
  ea := 1 / (1 + power(10, (rb - ra) / 400.0));
  sa := case p_result when 'a' then 1 when 'b' then 0 else 0.5 end;
  da := round(k * (sa - ea));
  na := greatest(0, ra + da); nb := greatest(0, rb - da);
  update public.ratings set rating = na, games = games + 1, wins = wins + case when p_result = 'a' then 1 else 0 end,
    losses = losses + case when p_result = 'b' then 1 else 0 end, peak = greatest(peak, na), updated_at = now() where user_id = p_a and season = ssn;
  update public.ratings set rating = nb, games = games + 1, wins = wins + case when p_result = 'b' then 1 else 0 end,
    losses = losses + case when p_result = 'a' then 1 else 0 end, peak = greatest(peak, nb), updated_at = now() where user_id = p_b and season = ssn;
  insert into public.rating_events (match_id, user_id, season, before, after) values (p_match, p_a, ssn, ra, na), (p_match, p_b, ssn, rb, nb);
  return jsonb_build_object('a', jsonb_build_object('before', ra, 'after', na), 'b', jsonb_build_object('before', rb, 'after', nb));
end $$;

-- The player's own rank this season (and the season's name)
create function public.my_rank() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); r public.ratings;
begin
  select * into r from public.ratings where user_id = uid and season = private.season_now();
  return jsonb_build_object('season', private.season_now(), 'rating', coalesce(r.rating, 1000), 'name', private.rank_name(coalesce(r.rating, 1000)),
    'games', coalesce(r.games, 0), 'wins', coalesce(r.wins, 0), 'losses', coalesce(r.losses, 0), 'peak', coalesce(r.peak, 1000),
    'place', case when r.user_id is null then null else (select count(*) + 1 from public.ratings x where x.season = private.season_now() and x.rating > r.rating) end);
end $$;
revoke all on function public.my_rank() from public, anon;
grant execute on function public.my_rank() to authenticated;

-- ---------------------------------------------------------------------------
-- The queue (referee only)
-- ---------------------------------------------------------------------------
create function private.assert_referee() returns void
language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and coalesce(current_setting('role', true), '') not in ('service_role', 'postgres')
     and not coalesce((select rolsuper from pg_roles where rolname = session_user), false) then -- the local test copy runs as its owner
    raise exception 'referee only' using errcode = '42501';
  end if;
end $$;

-- Joins (or refreshes) the queue. The same mode keeps the wait time; a new mode starts it again.
create function public.pvp_queue_join(p_user uuid, p_mode text, p_player jsonb, p_deck jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.pvp_queue;
begin
  perform private.assert_referee();
  if p_mode not in ('ranked', 'unranked') then raise exception 'mode must be ranked or unranked'; end if;
  delete from public.pvp_queue where seen_at < now() - interval '2 minutes'; -- browsers that went away
  insert into public.pvp_queue (user_id, mode, player, deck, rating) values (p_user, p_mode, p_player, p_deck, private.rating_of(p_user))
  on conflict (user_id) do update set player = excluded.player, deck = excluded.deck, rating = excluded.rating, seen_at = now(),
    since = case when public.pvp_queue.mode = excluded.mode then public.pvp_queue.since else now() end, mode = excluded.mode
  returning * into r;
  return jsonb_build_object('rating', r.rating, 'since', r.since, 'waited', extract(epoch from now() - r.since)::int,
    'others', (select count(*) from public.pvp_queue q where q.mode = r.mode and q.user_id <> r.user_id));
end $$;

create function public.pvp_queue_leave(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_referee();
  delete from public.pvp_queue where user_id = p_user;
end $$;

-- Pairs the caller with the longest-waiting live player of the same mode (ranked: within the rating window, which widens
-- with the caller's wait). Both rows go in one statement, so no third player can take either. Null when nobody fits.
create function public.pvp_queue_pair(p_user uuid) returns jsonb
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
      and (me.mode <> 'ranked' or abs(q.rating - me.rating) <= win)
      and not exists (select 1 from public.matches m where m.status = 'active' and (m.player_a = q.user_id or m.player_b = q.user_id))
    order by q.since limit 1 for update skip locked;
  if not found then return null; end if;
  delete from public.pvp_queue where user_id in (me.user_id, o.user_id);
  return jsonb_build_object('mode', me.mode, 'my_rating', me.rating,
    'other', jsonb_build_object('user_id', o.user_id, 'player', o.player, 'deck', o.deck, 'rating', o.rating, 'since', o.since));
end $$;

-- One player's rank for the referee (the function has no player token)
create function public.pvp_rank_of(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.ratings;
begin
  perform private.assert_referee();
  select * into r from public.ratings where user_id = p_user and season = private.season_now();
  return jsonb_build_object('season', private.season_now(), 'rating', coalesce(r.rating, 1000), 'name', private.rank_name(coalesce(r.rating, 1000)),
    'games', coalesce(r.games, 0), 'wins', coalesce(r.wins, 0), 'losses', coalesce(r.losses, 0), 'peak', coalesce(r.peak, 1000));
end $$;

revoke all on function public.pvp_queue_join(uuid, text, jsonb, jsonb), public.pvp_queue_leave(uuid), public.pvp_queue_pair(uuid), public.pvp_rank_of(uuid) from public, anon, authenticated;
revoke all on function private.season_now(), private.rating_of(uuid), private.rank_name(integer), private.rating_apply(uuid, uuid, uuid, text), private.assert_referee(),
  private.setting_range(text), private.editable_settings() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.pvp_queue_join(uuid, text, jsonb, jsonb), public.pvp_queue_leave(uuid), public.pvp_queue_pair(uuid), public.pvp_rank_of(uuid) to service_role;
    grant all on public.pvp_queue, public.ratings, public.rating_events to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- pvp_finish by mode: practice pays and counts nothing; ranked also moves the ratings (as in 20261102000003 otherwise)
-- ---------------------------------------------------------------------------
create or replace function private.pvp_finish(p_match uuid, p_winner uuid, p_result text, p_end_reason text, p_turns integer,
                                              p_summary_a jsonb, p_summary_b jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.matches;
  paid_a integer := 0; paid_b integer := 0;
  done_a jsonb := '[]'::jsonb; done_b jsonb := '[]'::jsonb;
  rating jsonb := null;
begin
  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'match not found'; end if;
  if m.status = 'finished' then
    return jsonb_build_object('finished', false, 'repeat', true);
  end if;
  update public.matches
    set status = 'finished', winner = p_winner, result = p_result, end_reason = p_end_reason,
        turns = coalesce(p_turns, (m.state ->> 'turn')::int, 0), ended_at = now(), updated_at = now()
    where id = p_match;
  if m.mode = 'practice' then
    -- Practice (Ken): no rank, no coins, no quests; nothing to farm. The match itself stays on record.
    return jsonb_build_object('finished', true, 'repeat', false, 'mode', 'practice',
      'a', jsonb_build_object('user_id', m.player_a, 'coins', 0, 'quests_done', '[]'::jsonb),
      'b', jsonb_build_object('user_id', m.player_b, 'coins', 0, 'quests_done', '[]'::jsonb));
  end if;
  paid_a := private.match_reward(m.player_a, m.id, p_winner = m.player_a, p_turns, p_summary_a ->> 'commander');
  paid_b := private.match_reward(m.player_b, m.id, p_winner = m.player_b, p_turns, p_summary_b ->> 'commander');
  if m.mode = 'ranked' then
    begin
      rating := private.rating_apply(m.id, m.player_a, m.player_b, case when p_winner = m.player_a then 'a' when p_winner = m.player_b then 'b' else 'tie' end);
    exception when others then raise warning 'rating skipped for match %: %', m.id, sqlerrm; end;
  end if;
  -- Quest counting must never stop a match from finishing: a problem is noted, not raised.
  if p_summary_a is not null then
    begin
      done_a := private.quest_progress(m.player_a, p_summary_a || jsonb_build_object('won', p_winner = m.player_a, 'turns', coalesce(p_turns, 0)), 'match:' || m.id);
    exception when others then raise warning 'quest progress (a) skipped for match %: %', m.id, sqlerrm; end;
  end if;
  if p_summary_b is not null then
    begin
      done_b := private.quest_progress(m.player_b, p_summary_b || jsonb_build_object('won', p_winner = m.player_b, 'turns', coalesce(p_turns, 0)), 'match:' || m.id);
    exception when others then raise warning 'quest progress (b) skipped for match %: %', m.id, sqlerrm; end;
  end if;
  return jsonb_build_object('finished', true, 'repeat', false, 'mode', m.mode,
    'a', jsonb_build_object('user_id', m.player_a, 'coins', paid_a, 'quests_done', done_a, 'rating', rating -> 'a'),
    'b', jsonb_build_object('user_id', m.player_b, 'coins', paid_b, 'quests_done', done_b, 'rating', rating -> 'b'));
end $$;

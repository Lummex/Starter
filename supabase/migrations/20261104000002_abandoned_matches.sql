-- Abandoned matches (Ken, Nov 4: "I logged back into the game that we were playing, and it's still going. So if both players
-- disconnect, it should just drop the game and give them both a loss."). When BOTH players have been away for
-- pvp_abandon_seconds (admin setting, 120 to start), a sweeper in the database ends the match with no browser present: both
-- get a loss, nobody gets coins, quests or streaks (nothing to farm), and the records stay. Coming back before the time
-- cancels it, because every call a player makes to the match function leaves a mark here. One player gone keeps the
-- clock and forfeit rules of the referee.

-- ---------------------------------------------------------------------------
-- Presence: the last moment each player's browser talked to the match function about this match.
-- ---------------------------------------------------------------------------
create table public.match_presence (
  match_id   uuid not null references public.matches (id) on delete cascade,
  user_id    uuid not null,
  seen_at    timestamptz not null default now(),
  primary key (match_id, user_id)
);
alter table public.match_presence enable row level security;
revoke all on public.match_presence from anon, authenticated;

create function public.pvp_seen(p_match uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- the referee only (the match function's service key); a player's own token has no way in
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'referee only' using errcode = '42501'; end if;
  insert into public.match_presence (match_id, user_id, seen_at)
    select p_match, u.id, now() from (select (auth.jwt() -> 'app' ->> 'user')::uuid as id) u where u.id is not null
  on conflict (match_id, user_id) do update set seen_at = excluded.seen_at;
end $$;
revoke all on function public.pvp_seen(uuid) from public, anon, authenticated;

-- The function can't put the player into its service-role JWT, so it says who it is calling for:
create or replace function public.pvp_seen(p_match uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'referee only' using errcode = '42501'; end if;
  if not exists (select 1 from public.matches m where m.id = p_match and (m.player_a = p_user or m.player_b = p_user)) then return; end if;
  insert into public.match_presence (match_id, user_id, seen_at) values (p_match, p_user, now())
  on conflict (match_id, user_id) do update set seen_at = excluded.seen_at;
end $$;
revoke all on function public.pvp_seen(uuid, uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.pvp_seen(uuid, uuid) to service_role;
    grant all on public.match_presence to service_role;
  end if;
end $$;
drop function public.pvp_seen(uuid);

-- ---------------------------------------------------------------------------
-- The setting (admin-editable, one number)
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values ('pvp_abandon_seconds', '120'::jsonb) on conflict (key) do nothing;

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
    ('pvp_abandon_seconds',     30, 86400)) r(key, lo, hi)
  where r.key = p_key
$$;

create or replace function private.editable_settings() returns text[]
language sql immutable set search_path = '' as $$
  select array['signup_bonus_coins', 'max_decks', 'blocked_words', 'reserved_usernames', 'reserved_name_parts',
               'pvp_win_coins', 'pvp_loss_coins', 'pvp_daily_coin_cap', 'pvp_min_turns',
               'quest_reward_easy', 'quest_reward_medium', 'quest_reward_hard', 'quest_streak_days',
               'pvp_phase_seconds', 'pvp_bank_seconds', 'pvp_respond_seconds', 'pvp_timeouts_to_forfeit',
               'pvp_respond_min_seconds', 'pvp_abandon_seconds']
$$;

-- ---------------------------------------------------------------------------
-- Ending a match as abandoned: both lose, nothing is paid or counted for quests
-- ---------------------------------------------------------------------------
create function private.pvp_abandon(p_match uuid, p_why text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare m public.matches; v record;
begin
  select * into m from public.matches where id = p_match for update;
  if not found or m.status <> 'active' then return false; end if;
  update public.matches
    set status = 'finished', winner = null, result = 'tie', end_reason = 'abandoned',
        turns = coalesce((m.state ->> 'turn')::int, 0), ended_at = now(), updated_at = now(),
        clock = '{}'::jsonb,
        -- the referee's own flag, so the match function never tries to pay this one out later
        state = m.state || jsonb_build_object('status', 'finished', 'rewarded', true, 'endedAt', (extract(epoch from now()) * 1000)::bigint,
                                              'result', jsonb_build_object('winner', null, 'reason', 'abandoned'))
    where id = p_match;
  -- a loss for both, no coins, no quests, no streak change
  update public.player_stats set games = games + 1, losses = losses + 1, abandons = abandons + 1, win_streak = 0
    where user_id in (m.player_a, m.player_b);
  -- what a returning browser sees: the match is over, nobody won
  for v in select * from public.match_views where match_id = p_match loop
    update public.match_views
      set seq = v.seq + 1, deadline = null, updated_at = now(), events = '[{"type":"abandoned"}]'::jsonb,
          view = v.view || jsonb_build_object('seq', v.seq + 1, 'status', 'over', 'deadline', null, 'respondDeadline', null,
                                              'result', jsonb_build_object('won', false, 'reason', 'abandoned'))
      where match_id = v.match_id and user_id = v.user_id;
  end loop;
  insert into public.match_moves (match_id, seq, user_id, action, ok, error, ms)
    values (p_match, m.seq, m.player_a, jsonb_build_object('type', 'abandoned', 'why', p_why), true, null, 0);
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- The sweeper: runs every minute (pg_cron). A match is abandoned when both players have been away for the setting's time.
-- "Away" = no call to the match function about this match since then (match_presence), or, for a match older than the
-- presence table, no move at all. Guard against punishing people for OUR outage: when the sweeper itself has not run for
-- more than 3 minutes (the database or cron was down), that run only takes note and ends nothing; and nothing is ended
-- while not a single player of any active match has been seen in the last window (every browser silent = the server
-- was unreachable, not the players gone).
-- ---------------------------------------------------------------------------
create table private.sweeper_runs (name text primary key, last_run timestamptz not null, note text);

create function private.sweep_abandoned() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  secs integer := greatest(30, coalesce((private.setting('pvp_abandon_seconds'))::int, 120));
  prev timestamptz; n integer := 0; r record;
begin
  select last_run into prev from private.sweeper_runs where name = 'abandoned';
  insert into private.sweeper_runs (name, last_run) values ('abandoned', now())
    on conflict (name) do update set last_run = excluded.last_run;
  if prev is not null and now() - prev > interval '3 minutes' then
    update private.sweeper_runs set note = 'gap of ' || (now() - prev)::text || ' at ' || now()::text where name = 'abandoned';
    return 0; -- we were away, not the players: this run ends nothing
  end if;
  if exists (select 1 from public.matches where status = 'active')
     and not exists (select 1 from public.match_presence p join public.matches m on m.id = p.match_id
                     where m.status = 'active' and p.seen_at > now() - make_interval(secs => secs)) then
    return 0; -- nobody anywhere has been heard from: more likely us than them
  end if;
  for r in
    select m.id from public.matches m
    where m.status = 'active'
      and m.updated_at < now() - make_interval(secs => secs)
      and m.created_at < now() - make_interval(secs => secs)
      and not exists (select 1 from public.match_presence p where p.match_id = m.id and p.seen_at > now() - make_interval(secs => secs))
  loop
    if private.pvp_abandon(r.id, 'both players away for ' || secs || ' s') then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Every minute. Quiet when pg_cron is not there (local test copies).
do $$ begin
  begin
    create extension if not exists pg_cron;
  exception when others then raise notice 'pvp sweeper schedule skipped: pg_cron unavailable (%)', sqlerrm; return; end;
  begin
    perform cron.unschedule('pvp-abandoned') where exists (select 1 from cron.job where jobname = 'pvp-abandoned');
    perform cron.schedule('pvp-abandoned', '* * * * *', 'select private.sweep_abandoned()');
  exception when others then raise notice 'pvp sweeper schedule skipped (%)', sqlerrm; end;
end $$;

-- Admin: what the sweeper did lately, and a way to look at one stuck match
create or replace function public.admin_pvp_sweeper() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return jsonb_build_object(
    'last_run', (select last_run from private.sweeper_runs where name = 'abandoned'),
    'note', (select note from private.sweeper_runs where name = 'abandoned'),
    'abandon_seconds', private.setting('pvp_abandon_seconds'),
    'active', (select count(*) from public.matches where status = 'active'),
    'abandoned_today', (select count(*) from public.matches where end_reason = 'abandoned' and ended_at >= private.day_start()));
end $$;
revoke all on function public.admin_pvp_sweeper() from public, anon;
grant execute on function public.admin_pvp_sweeper() to authenticated;

-- The private schema is for the referee and the sweeper only (as the earlier migrations do for every private function)
revoke all on function private.setting_range(text), private.editable_settings(), private.pvp_abandon(uuid, text), private.sweep_abandoned() from public, anon, authenticated;

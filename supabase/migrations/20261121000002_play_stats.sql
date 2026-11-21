-- Games played and time played in the Back Counter (Ken, Nov 21: "Can you add to the back counter how many games they played and
-- how many hours they played?").
-- * Games: PvP from public.matches (every finished match is there: Ranked, Unranked, Friend codes incl. practice codes).
--   Vs-computer: the game already reports each finished signed-in match (3+ turns) through quest_report(); from now on that
--   report also keeps one small row in public.ai_games (won or lost). Older reports (quest_reports, since Nov 2) are copied in
--   with the result unknown.
-- * Time: the 30-second "I'm here" heartbeat (regions_info) adds the time since the player's previous beat to ONE running
--   total per player (public.play_time). A gap over 90 s starts a new session and adds nothing. No row per beat.
-- * Only admin doors (admin + 2-step) read any of it; players can read none of these tables.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.play_time (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  seconds    bigint not null default 0 check (seconds >= 0),
  last_beat  timestamptz not null default now(),
  since      timestamptz not null default now()
);
create index if not exists play_time_seconds on public.play_time (seconds desc);

create table if not exists public.ai_games (
  user_id    uuid not null references auth.users (id) on delete cascade,
  ref        text not null,
  won        boolean,              -- null: an older report from before Nov 21 (the result was not kept)
  turns      integer,
  created_at timestamptz not null default now(),
  primary key (user_id, ref)
);
create index if not exists ai_games_user on public.ai_games (user_id, created_at desc);

revoke all on public.play_time, public.ai_games from public, anon, authenticated;
alter table public.play_time enable row level security;
alter table public.ai_games enable row level security;
-- (no policies: nobody but the server's own functions reads or writes them)

-- the vs-computer matches already reported (Nov 2 on), result unknown
insert into public.ai_games (user_id, ref, won, turns, created_at)
  select r.user_id, r.ref, null, null, r.created_at from public.quest_reports r
  where exists (select 1 from auth.users u where u.id = r.user_id)
  on conflict do nothing;

-- ---------------------------------------------------------------------------
-- The heartbeat adds time
-- ---------------------------------------------------------------------------
create or replace function private.note_play(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.play_time as t (user_id) values (p_user)
  on conflict (user_id) do update set
    seconds = t.seconds + case when now() - t.last_beat <= interval '90 seconds' and now() > t.last_beat
                               then floor(extract(epoch from (now() - t.last_beat)))::bigint else 0 end,
    last_beat = now();
$$;

create or replace function public.regions_info(p_here text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); counts boolean := coalesce((private.setting('region_counts'))::boolean, true);
        here text := case when p_here is not null and private.region_ok(p_here) then p_here else null end;
begin
  if here is not null then
    update public.profiles set last_seen_at = now(), seen_region = here
      where id = uid and (seen_region is distinct from here or last_seen_at < now() - interval '20 seconds');
  else
    update public.profiles set last_seen_at = now() where id = uid and last_seen_at < now() - interval '20 seconds';
  end if;
  perform private.note_play(uid); -- Nov 21: time played
  return jsonb_build_object(
    'regions', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'edge', r.edge) || case when counts then private.region_counts(r.id) else '{}'::jsonb end) from private.regions_enabled() r), '[]'::jsonb),
    'mine', (select p.region from public.profiles p where p.id = uid and private.region_ok(p.region)),
    'fallback_seconds', coalesce((private.setting('region_fallback_seconds'))::int, 45),
    'counts', counts);
end $$;

-- ---------------------------------------------------------------------------
-- The vs-computer report also keeps the game (same checks as before; one row per match reference)
-- ---------------------------------------------------------------------------
create or replace function public.quest_report(p_summary jsonb, p_ref text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  done_now jsonb;
begin
  if p_ref is null or p_ref !~ '^practice:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'bad match reference';
  end if;
  if p_summary is null or jsonb_typeof(p_summary) <> 'object' then raise exception 'bad match summary'; end if;
  -- Serialise this player's reports (the wallet row is the per-player lock everywhere).
  perform 1 from public.wallets where user_id = uid for update;
  if (select count(*) from public.quest_reports r where r.user_id = uid and r.created_at >= private.day_start()) >= 20 then
    raise exception 'Enough battles counted for today; quests pick up again tomorrow.';
  end if;
  insert into public.ai_games (user_id, ref, won, turns) values (uid, p_ref,
    case when jsonb_typeof(p_summary -> 'won') = 'boolean' then (p_summary ->> 'won')::boolean end,
    case when jsonb_typeof(p_summary -> 'turns') = 'number' then least(greatest((p_summary ->> 'turns')::numeric, 0), 1000)::int end)
    on conflict do nothing;
  done_now := private.quest_progress(uid, p_summary, p_ref);
  return public.my_quests() || jsonb_build_object('just_done', done_now);
end $$;

-- ---------------------------------------------------------------------------
-- Admin doors
-- ---------------------------------------------------------------------------
-- one player's games: { ranked|unranked|friend|computer: {games, wins, losses}, total } (friend = friend and practice codes)
create or replace function private.player_games(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with pvp as (
    select case when m.mode in ('ranked', 'unranked') then m.mode else 'friend' end as kind,
           count(*) as games,
           count(*) filter (where m.winner = p_user) as wins,
           count(*) filter (where m.winner is not null and m.winner <> p_user) as losses
    from public.matches m
    where m.status = 'finished' and p_user in (m.player_a, m.player_b)
    group by 1),
  ai as (
    select count(*) as games, count(*) filter (where a.won) as wins, count(*) filter (where a.won = false) as losses
    from public.ai_games a where a.user_id = p_user)
  select jsonb_build_object(
    'ranked',   jsonb_build_object('games', coalesce((select games from pvp where kind = 'ranked'), 0), 'wins', coalesce((select wins from pvp where kind = 'ranked'), 0), 'losses', coalesce((select losses from pvp where kind = 'ranked'), 0)),
    'unranked', jsonb_build_object('games', coalesce((select games from pvp where kind = 'unranked'), 0), 'wins', coalesce((select wins from pvp where kind = 'unranked'), 0), 'losses', coalesce((select losses from pvp where kind = 'unranked'), 0)),
    'friend',   jsonb_build_object('games', coalesce((select games from pvp where kind = 'friend'), 0), 'wins', coalesce((select wins from pvp where kind = 'friend'), 0), 'losses', coalesce((select losses from pvp where kind = 'friend'), 0)),
    'computer', (select jsonb_build_object('games', games, 'wins', wins, 'losses', losses) from ai),
    'total', coalesce((select sum(games) from pvp), 0) + (select games from ai))
$$;

-- the player page: games by mode, time played, and since when each is counted
create or replace function public.admin_player_play(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'no such player'; end if;
  return jsonb_build_object(
    'games', private.player_games(p_user),
    'seconds', coalesce((select t.seconds from public.play_time t where t.user_id = p_user), 0),
    'last_beat', (select t.last_beat from public.play_time t where t.user_id = p_user),
    'time_since', (select min(t.since) from public.play_time t),
    'pvp_since', (select min(m.created_at) from public.matches m),
    'computer_since', (select min(a.created_at) from public.ai_games a),
    'computer_results_since', (select min(a.created_at) from public.ai_games a where a.won is not null));
end $$;

-- the Players list gains games and time played, and a sort: new (joined), seen (last seen), games, time
drop function if exists public.admin_list_players(text, int, int);
create function public.admin_list_players(p_search text default '', p_page int default 1, p_page_size int default 25, p_sort text default 'new')
returns table (id uuid, username text, email text, created_at timestamptz, last_seen_at timestamptz,
               coins integer, money_spent_cents bigint, banned boolean, ban_expires_at timestamptz,
               age_group text, consent_status text, is_admin boolean, total bigint,
               games bigint, play_seconds bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := lower(btrim(coalesce(p_search, '')));
  sz int := least(greatest(coalesce(p_page_size, 25), 1), 100);
  pg int := greatest(coalesce(p_page, 1), 1);
  srt text := case when p_sort in ('new', 'seen', 'games', 'time') then p_sort else 'new' end;
begin
  perform private.assert_admin();
  return query
    select x.id, x.username, x.email, x.created_at, x.last_seen_at, x.coins, x.money_spent_cents, x.banned, x.ban_expires_at,
           x.age_group, x.consent_status, x.is_admin, x.total, x.games, x.play_seconds
    from (
      select p.id, p.username, u.email::text as email, p.created_at, p.last_seen_at, w.coins,
             coalesce(s.money_spent_cents, 0)::bigint as money_spent_cents,
             b.id is not null as banned, b.expires_at as ban_expires_at, p.age_group, p.consent_status,
             exists (select 1 from public.roles r where r.user_id = p.id and r.role = 'admin') as is_admin,
             count(*) over () as total,
             ((select count(*) from public.matches m where m.status = 'finished' and p.id in (m.player_a, m.player_b))
               + (select count(*) from public.ai_games a where a.user_id = p.id))::bigint as games,
             coalesce(t.seconds, 0)::bigint as play_seconds
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.wallets w on w.user_id = p.id
      left join public.player_stats s on s.user_id = p.id
      left join public.play_time t on t.user_id = p.id
      left join lateral (select bb.id, bb.expires_at from public.bans bb
                         where bb.user_id = p.id and bb.lifted_at is null and (bb.expires_at is null or bb.expires_at > now())
                         order by bb.created_at desc limit 1) b on true
      where q = '' or position(q in lower(p.username)) > 0 or position(q in lower(coalesce(u.email::text, ''))) > 0
    ) x
    order by case when srt = 'seen' then x.last_seen_at end desc nulls last,
             case when srt = 'games' then x.games end desc nulls last,
             case when srt = 'time' then x.play_seconds end desc nulls last,
             x.created_at desc
    limit sz offset (pg - 1) * sz;
end $$;

revoke all on function private.note_play(uuid), private.player_games(uuid) from public, anon, authenticated;
revoke all on function public.regions_info(text), public.quest_report(jsonb, text), public.admin_player_play(uuid),
  public.admin_list_players(text, int, int, text) from public, anon, authenticated;
grant execute on function public.regions_info(text), public.quest_report(jsonb, text), public.admin_player_play(uuid),
  public.admin_list_players(text, int, int, text) to authenticated;

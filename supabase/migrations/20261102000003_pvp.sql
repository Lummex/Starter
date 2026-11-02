-- Oreheart Online, Phase C (Nov 2): friend-code PvP tables.
-- The "match" Edge Function is the referee: it writes rooms, matches, match_views and
-- match_moves with the service role. Players only READ: their rooms, a slice of their
-- matches (never the hidden state), their own view of a match, and the moves of their
-- finished matches. The one thing a player may ask the database directly is pvp_gate()
-- (am I allowed to play?) and my_active_match().

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A six-letter code a host makes and a friend joins (no I or O, so codes read cleanly).
create table public.rooms (
  code        text primary key check (code ~ '^[A-HJ-NP-Z]{6}$'),
  host        uuid not null,
  guest       uuid,
  host_deck   jsonb not null,
  guest_deck  jsonb,
  status      text not null default 'waiting' check (status in ('waiting', 'started', 'cancelled', 'expired')),
  match_id    uuid,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 minutes'
);
create index rooms_host on public.rooms (host, created_at desc);
create index rooms_guest on public.rooms (guest, created_at desc);

-- The whole truth of a match. "state" (both hands, both decks, the dice) is for the referee only.
create table public.matches (
  id              uuid primary key default gen_random_uuid(),
  mode            text not null default 'friend' check (mode in ('friend', 'ranked', 'casual')),
  room_code       text,
  player_a        uuid not null,
  player_b        uuid not null,
  state           jsonb not null,
  seq             integer not null default 0,
  status          text not null default 'active' check (status in ('active', 'finished')),
  clock           jsonb not null default '{}'::jsonb,
  winner          uuid,
  result          text check (result is null or result in ('a', 'b', 'tie')),
  end_reason      text check (end_reason is null or end_reason in ('win', 'surrender', 'timeout', 'abandoned')),
  turns           integer,
  engine_version  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  ended_at        timestamptz,
  check (player_a <> player_b)
);
create index matches_player_a on public.matches (player_a, status, created_at desc);
create index matches_player_b on public.matches (player_b, status, created_at desc);

-- What one player is allowed to see of a match, written by the referee after every
-- accepted action (Realtime delivers the row to that player).
create table public.match_views (
  match_id    uuid not null references public.matches (id) on delete cascade,
  user_id     uuid not null,
  side        text not null check (side in ('a', 'b')),
  seq         integer not null default 0,
  view        jsonb not null,
  events      jsonb not null default '[]'::jsonb,
  deadline    timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index match_views_user on public.match_views (user_id, updated_at desc);

-- Every action a player sent, accepted or refused (the match's own record).
create table public.match_moves (
  id          bigint generated always as identity primary key,
  match_id    uuid not null references public.matches (id) on delete cascade,
  seq         integer not null,
  user_id     uuid not null,
  action      jsonb not null,
  ok          boolean not null,
  error       text,
  ms          integer,
  created_at  timestamptz not null default now()
);
create index match_moves_match on public.match_moves (match_id, id);
create trigger match_moves_append_only before update or delete on public.match_moves
  for each row execute function private.forbid_change();

-- The part of a match a player may know. Runs with the owner's rights (players have no
-- grant on matches at all), filtered to the caller's own matches; never shows "state".
create view public.my_matches with (security_barrier = true) as
  select m.id, m.mode, m.room_code, m.player_a, m.player_b, m.seq, m.status, m.winner, m.result, m.end_reason,
         m.turns, m.created_at, m.ended_at
  from public.matches m
  where m.player_a = (select auth.uid()) or m.player_b = (select auth.uid());

-- ---------------------------------------------------------------------------
-- Player doors
-- ---------------------------------------------------------------------------

-- The referee calls this AS THE PLAYER (their JWT) before creating or joining a room:
-- it refuses banned and not-yet-approved accounts, and names the player.
create function public.pvp_gate() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return (select jsonb_build_object('user_id', p.id, 'username', p.username, 'avatar', p.avatar) from public.profiles p where p.id = uid);
end $$;

-- The match this player should return to (newest active one), or null.
create function public.my_active_match() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return (select m.id from public.matches m where m.status = 'active' and (m.player_a = uid or m.player_b = uid)
          order by m.created_at desc limit 1);
end $$;

-- ---------------------------------------------------------------------------
-- Finishing a match (referee only)
-- ---------------------------------------------------------------------------

-- Marks the match finished, counts it for both players (coins + stats, once) and feeds
-- both quest summaries (ref match:<id>). A second call does nothing. Returns what was paid.
create function private.pvp_finish(p_match uuid, p_winner uuid, p_result text, p_end_reason text, p_turns integer,
                                   p_summary_a jsonb, p_summary_b jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.matches;
  paid_a integer := 0; paid_b integer := 0;
  done_a jsonb := '[]'::jsonb; done_b jsonb := '[]'::jsonb;
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
  paid_a := private.match_reward(m.player_a, m.id, p_winner = m.player_a, p_turns, p_summary_a ->> 'commander');
  paid_b := private.match_reward(m.player_b, m.id, p_winner = m.player_b, p_turns, p_summary_b ->> 'commander');
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
  return jsonb_build_object('finished', true, 'repeat', false,
    'a', jsonb_build_object('user_id', m.player_a, 'coins', paid_a, 'quests_done', done_a),
    'b', jsonb_build_object('user_id', m.player_b, 'coins', paid_b, 'quests_done', done_b));
end $$;

-- The door the Edge Function uses (the API only reaches the public schema). Service role only
-- (the JWT's role claim, i.e. request.jwt.claims ->> 'role'): a player's JWT is refused even if
-- a grant ever slipped through. No trigger touches matches, so the referee's
-- "update ... where id = ? and seq = ?" compare-and-swap is exact.
create function public.pvp_finish(p_match uuid, p_winner uuid, p_result text, p_end_reason text, p_turns integer,
                                  p_summary_a jsonb, p_summary_b jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and current_user not in ('service_role', 'postgres') then
    raise exception 'referee only' using errcode = '42501';
  end if;
  return private.pvp_finish(p_match, p_winner, p_result, p_end_reason, p_turns, p_summary_a, p_summary_b);
end $$;

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------

revoke all on public.rooms, public.matches, public.match_views, public.match_moves, public.my_matches from public, anon, authenticated;
-- matches: NO grant to players at all (the state must stay with the referee).
grant select on public.rooms, public.match_views, public.match_moves, public.my_matches to authenticated;

alter table public.rooms       enable row level security;
alter table public.matches     enable row level security;
alter table public.match_views enable row level security;
alter table public.match_moves enable row level security;

create policy own_rooms on public.rooms for select to authenticated
  using (host = (select auth.uid()) or guest = (select auth.uid()));
create policy own_match_views on public.match_views for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_finished_match_moves on public.match_moves for select to authenticated
  using (exists (select 1 from public.my_matches v where v.id = match_id and v.status = 'finished'));
-- matches: RLS on, no policy = nobody but the referee (service role, which bypasses RLS).

revoke all on function private.pvp_finish(uuid, uuid, text, text, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.pvp_gate(), public.my_active_match(),
  public.pvp_finish(uuid, uuid, text, text, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.pvp_gate() to authenticated;
grant execute on function public.my_active_match() to authenticated;

-- The referee's role exists only on real Supabase; the local test database has none.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.rooms, public.matches, public.match_views, public.match_moves to service_role;
    grant select on public.settings, public.profiles to service_role;
    grant usage, select on all sequences in schema public to service_role;
    grant execute on function public.pvp_finish(uuid, uuid, text, text, integer, jsonb, jsonb) to service_role;
  end if;
end $$;

-- Realtime: players get their own match_views rows pushed (filtered by RLS). Only real Supabase has the publication.
do $$ begin
  alter publication supabase_realtime add table public.match_views;
exception when others then
  raise notice 'realtime publication skipped: %', sqlerrm;
end $$;

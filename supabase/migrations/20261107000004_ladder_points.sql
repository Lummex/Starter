-- Ranked starts at Stone (Ken, Nov 7: "you start out with a high rank, not the lowest rank ... I started out as like a Sapphire Tier 3.
-- You got to start at zero ... start all the way at the stone one").
--
-- Two numbers now, like most ranked games:
--   * rating  - the hidden Elo (starts 1000). Matchmaking only; never shown.
--   * points  - the visible ladder points (start 0 = Stone III). The rank, the leaderboard, the Friends charm and the Match End show these.
-- Each ranked game moves the points toward a target set by the Elo (1200 + 6 x (Elo - 1000), 0..3000):
--   win  +clamp(20 + 4% of (target - points), 10, 60)
--   loss -clamp(20 - 4% of (target - points), 5, 40)
--   tie   clamp(2% of (target - points), -10, 10)
-- So a new player climbs fast out of Stone (+60 / -5 at first), an average player (Elo ~1000) settles around Sapphire after
-- roughly 50 games, a strong one (Elo ~1200) around Diamond, and Oreheart needs Elo ~1250+. Points never go below 0.
-- The ladder thresholds (admin setting ranked_ladder) move to the points scale: 300 points a step, 100 a division.
-- Existing accounts re-map: points = least(target, 25 x games played), so a brand-new account sits at Stone III.
-- Seasons: ratings are per season, so points start at 0 again every quarter. Safe for the real database.

alter table public.ratings add column if not exists points integer not null default 0 check (points >= 0);
alter table public.ratings add column if not exists peak_points integer not null default 0;
alter table public.rating_events add column if not exists points_before integer;
alter table public.rating_events add column if not exists points_after integer;
create index if not exists ratings_season_points on public.ratings (season, points desc);

-- rating_events is append-only; the new columns are filled on insert only.

insert into public.settings (key, value) values
  ('ranked_ladder', '[{"name": "Stone", "min": 0}, {"name": "Copper", "min": 300}, {"name": "Iron", "min": 600}, {"name": "Silver", "min": 900}, {"name": "Sapphire", "min": 1200}, {"name": "Emerald", "min": 1500}, {"name": "Ruby", "min": 1800}, {"name": "Amethyst", "min": 2100}, {"name": "Diamond", "min": 2400}, {"name": "Oreheart", "min": 2700}]'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

/** the points an Elo rating pulls toward */
create or replace function private.points_target(p_rating integer) returns integer
language sql immutable set search_path = '' as $$ select least(3000, greatest(0, 1200 + 6 * (coalesce(p_rating, 1000) - 1000))) $$;

/** the points change for one ranked game: p_score 1 = win, 0 = loss, 0.5 = tie */
create or replace function private.points_delta(p_points integer, p_rating integer, p_score numeric) returns integer
language sql immutable set search_path = '' as $$
  select case
    when p_score >= 1 then least(60, greatest(10, round(20 + 0.04 * (private.points_target(p_rating) - p_points))))::int
    when p_score <= 0 then -least(40, greatest(5, round(20 - 0.04 * (private.points_target(p_rating) - p_points))))::int
    else least(10, greatest(-10, round(0.02 * (private.points_target(p_rating) - p_points))))::int end
$$;

-- re-map the accounts that already played (real and TEST)
update public.ratings set points = least(private.points_target(rating), 25 * games), peak_points = least(private.points_target(rating), 25 * games) where points = 0 and games > 0;

-- Elo (hidden) and points (shown) for one finished ranked match. Returns {a: {before, after}, b: {before, after}} in POINTS
-- (what the Match End shows), plus elo_before / elo_after.
create or replace function private.rating_apply(p_match uuid, p_a uuid, p_b uuid, p_result text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ssn text := private.season_now();
  k integer := greatest(1, coalesce((private.setting('ranked_k'))::int, 32));
  ra integer; rb integer; pa integer; pb integer; ea numeric; sa numeric; da integer; na integer; nb integer; npa integer; npb integer;
begin
  if exists (select 1 from public.rating_events where match_id = p_match) then
    return (select jsonb_build_object(
      'a', jsonb_build_object('before', coalesce(max(points_before) filter (where user_id = p_a), max(before) filter (where user_id = p_a)), 'after', coalesce(max(points_after) filter (where user_id = p_a), max(after) filter (where user_id = p_a)),
                              'elo_before', max(before) filter (where user_id = p_a), 'elo_after', max(after) filter (where user_id = p_a)),
      'b', jsonb_build_object('before', coalesce(max(points_before) filter (where user_id = p_b), max(before) filter (where user_id = p_b)), 'after', coalesce(max(points_after) filter (where user_id = p_b), max(after) filter (where user_id = p_b)),
                              'elo_before', max(before) filter (where user_id = p_b), 'elo_after', max(after) filter (where user_id = p_b)))
            from public.rating_events where match_id = p_match);
  end if;
  insert into public.ratings (user_id, season) values (p_a, ssn), (p_b, ssn) on conflict do nothing;
  select rating, points into ra, pa from public.ratings where user_id = p_a and season = ssn for update;
  select rating, points into rb, pb from public.ratings where user_id = p_b and season = ssn for update;
  ea := 1 / (1 + power(10, (rb - ra) / 400.0));
  sa := case p_result when 'a' then 1 when 'b' then 0 else 0.5 end;
  da := round(k * (sa - ea));
  na := greatest(0, ra + da); nb := greatest(0, rb - da);
  npa := greatest(0, pa + private.points_delta(pa, na, sa)); npb := greatest(0, pb + private.points_delta(pb, nb, 1 - sa));
  update public.ratings set rating = na, points = npa, peak_points = greatest(peak_points, npa), games = games + 1, wins = wins + case when p_result = 'a' then 1 else 0 end,
    losses = losses + case when p_result = 'b' then 1 else 0 end, peak = greatest(peak, na), updated_at = now() where user_id = p_a and season = ssn;
  update public.ratings set rating = nb, points = npb, peak_points = greatest(peak_points, npb), games = games + 1, wins = wins + case when p_result = 'b' then 1 else 0 end,
    losses = losses + case when p_result = 'a' then 1 else 0 end, peak = greatest(peak, nb), updated_at = now() where user_id = p_b and season = ssn;
  insert into public.rating_events (match_id, user_id, season, before, after, points_before, points_after) values (p_match, p_a, ssn, ra, na, pa, npa), (p_match, p_b, ssn, rb, nb, pb, npb);
  return jsonb_build_object('a', jsonb_build_object('before', pa, 'after', npa, 'elo_before', ra, 'elo_after', na), 'b', jsonb_build_object('before', pb, 'after', npb, 'elo_before', rb, 'elo_after', nb));
end $$;

-- the rank cards: 'rating' is now the visible points (the Elo stays hidden); place = order by points
create or replace function public.pvp_rank_of(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.ratings; pts integer; place bigint;
begin
  perform private.assert_referee();
  select * into r from public.ratings where user_id = p_user and season = private.season_now();
  pts := coalesce(r.points, 0);
  select count(*) + 1 into place from public.ratings x where x.season = private.season_now() and x.games > 0 and (x.points > pts or (x.points = pts and x.user_id < p_user));
  return jsonb_build_object('season', private.season_now(), 'season_end', private.season_end(), 'rating', pts, 'name', private.rank_name(pts),
    'games', coalesce(r.games, 0), 'wins', coalesce(r.wins, 0), 'losses', coalesce(r.losses, 0), 'peak', coalesce(r.peak_points, 0),
    'place', case when coalesce(r.games, 0) > 0 then place else null end, 'rank', private.rank_of(pts),
    'ladder', coalesce(private.setting('ranked_ladder'), '[]'::jsonb));
end $$;

create or replace function public.my_rank() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); r public.ratings; pts integer; place bigint; total bigint;
begin
  select * into r from public.ratings where user_id = uid and season = private.season_now();
  pts := coalesce(r.points, 0);
  select count(*) + 1 into place from public.ratings x where x.season = private.season_now() and x.games > 0 and (x.points > pts or (x.points = pts and x.user_id < uid));
  select count(*) into total from public.ratings x where x.season = private.season_now() and x.games > 0;
  return jsonb_build_object('season', private.season_now(), 'season_end', private.season_end(), 'rating', pts, 'name', private.rank_name(pts),
    'games', coalesce(r.games, 0), 'wins', coalesce(r.wins, 0), 'losses', coalesce(r.losses, 0), 'peak', coalesce(r.peak_points, 0),
    'place', case when coalesce(r.games, 0) > 0 then place else null end, 'players', total, 'rank', private.rank_of(pts),
    'ladder', coalesce(private.setting('ranked_ladder'), '[]'::jsonb));
end $$;

create or replace function public.leaderboard(p_limit integer default 10) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); lim integer := least(greatest(coalesce(p_limit, 10), 1), 100); me jsonb;
begin
  me := public.my_rank();
  return jsonb_build_object(
    'season', private.season_now(), 'season_end', private.season_end(),
    'top', coalesce((select jsonb_agg(jsonb_build_object('place', row_number, 'user_id', user_id, 'username', username, 'avatar', avatar, 'rating', points, 'label', private.rank_name(points), 'wins', wins, 'losses', losses, 'games', games, 'me', user_id = uid) order by row_number)
                     from (select row_number() over (order by r.points desc, r.user_id) as row_number, r.user_id, p.username, p.avatar, r.points, r.wins, r.losses, r.games
                           from public.ratings r join public.profiles p on p.id = r.user_id
                           where r.season = private.season_now() and r.games > 0 order by r.points desc, r.user_id limit lim) x), '[]'::jsonb),
    'me', me,
    'players', me -> 'players',
    'shares', coalesce((select jsonb_object_agg(name, n) from (select private.rank_of(r.points) ->> 'name' as name, count(*) as n from public.ratings r where r.season = private.season_now() and r.games > 0 group by 1) s), '{}'::jsonb));
end $$;

create or replace function private.friend_card(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar,
    'rating', coalesce((select r.points from public.ratings r where r.user_id = p.id and r.season = private.season_now()), 0),
    'rank', private.rank_name(coalesce((select r.points from public.ratings r where r.user_id = p.id and r.season = private.season_now()), 0)),
    'status', private.player_status(p.id))
  from public.profiles p where p.id = p_user
$$;

revoke all on function private.points_target(integer), private.points_delta(integer, integer, numeric), private.rating_apply(uuid, uuid, uuid, text), private.friend_card(uuid) from public, anon, authenticated;
revoke all on function public.pvp_rank_of(uuid) from public, anon, authenticated; -- the referee door keeps its service_role grant (create or replace keeps grants)
revoke all on function public.my_rank(), public.leaderboard(integer) from public, anon;
grant execute on function public.my_rank(), public.leaderboard(integer) to authenticated;

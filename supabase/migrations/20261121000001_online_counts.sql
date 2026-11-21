-- Online counts fix (Ken, Nov 21: "I'm logged in and it's not showing anybody ... it's not showing the people online").
-- The bug: a region's "online" count only counted accounts whose home region (profiles.region) was that region, and the home
-- region is saved only when a player picks a server or joins a queue. Everyone on "nearest" had none, so two players looking at
-- the lobby both saw "0 online". Now the heartbeat (regions_info, every 30 s) also tells the server where the player is playing
-- (their choice, else the nearest by ping): profiles.seen_region. The counts use it (else the home region).
-- The home region (the player's choice) is unchanged: the heartbeat never writes it.

alter table public.profiles add column if not exists seen_region text check (seen_region is null or seen_region ~ '^[a-z][a-z0-9-]{1,19}$');
create index if not exists profiles_seen_region_seen on public.profiles (seen_region, last_seen_at desc);

-- the counts of one region: online = seen in the last 2 minutes and playing there now (else their home region)
create or replace function private.region_counts(p_region text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'online', (select count(*) from public.profiles p where coalesce(p.seen_region, p.region) = p_region and p.last_seen_at > now() - interval '2 minutes'),
    'playing', (select count(distinct u) from (select m.player_a as u from public.matches m where m.status = 'active' and m.region = p_region
                                               union all select m.player_b from public.matches m where m.status = 'active' and m.region = p_region) x),
    'waiting', (select count(*) from public.pvp_queue q where q.region = p_region and q.seen_at > now() - interval '15 seconds'))
$$;

-- regions_info gains an optional "where I am" (an older game sends nothing and keeps working)
drop function if exists public.regions_info();
create function public.regions_info(p_here text default null) returns jsonb
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
  return jsonb_build_object(
    'regions', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'edge', r.edge) || case when counts then private.region_counts(r.id) else '{}'::jsonb end) from private.regions_enabled() r), '[]'::jsonb),
    'mine', (select p.region from public.profiles p where p.id = uid and private.region_ok(p.region)),
    'fallback_seconds', coalesce((private.setting('region_fallback_seconds'))::int, 45),
    'counts', counts);
end $$;

-- choosing a server also moves the player's "where I am" there at once
create or replace function public.set_region(p_region text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  if p_region is not null and not private.region_ok(p_region) then raise exception 'That server is not open.'; end if;
  update public.profiles set region = p_region, seen_region = coalesce(p_region, seen_region), last_seen_at = now() where id = uid;
  return public.regions_info(p_region);
end $$;

revoke all on function public.regions_info(text), public.set_region(text), private.region_counts(text) from public, anon, authenticated;
grant execute on function public.regions_info(text), public.set_region(text) to authenticated;

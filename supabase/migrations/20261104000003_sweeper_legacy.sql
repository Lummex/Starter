-- Abandoned-match sweeper, second look (Nov 4): a match older than the presence marks has none at all. The guard "nobody
-- in any active match has been heard from, so it is probably our outage" must only count when there ARE marks to miss;
-- with no marks anywhere there is nothing to compare, and a mark-less match whose last move is older than the limit ends.
create or replace function private.sweep_abandoned() returns integer
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
  if exists (select 1 from public.match_presence p join public.matches m on m.id = p.match_id where m.status = 'active')
     and not exists (select 1 from public.match_presence p join public.matches m on m.id = p.match_id
                     where m.status = 'active' and p.seen_at > now() - make_interval(secs => secs)) then
    return 0; -- marks exist but every one is stale: more likely us than them
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
revoke all on function private.sweep_abandoned() from public, anon, authenticated;

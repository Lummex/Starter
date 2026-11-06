-- Queue wait times (Ken, Nov 5: "a connection timer so you can see what the connection time is and give them an average wait
-- time ... what the average wait time is at the moment"). Every pairing records how long each of the two waited; the average
-- over the last 20 pairings of that mode within 30 minutes is handed back to a player who asks while searching. Fewer than
-- 3 pairings = "not enough players yet" (null).

create table public.pvp_pairings (
  id         bigint generated always as identity primary key,
  mode       text not null check (mode in ('ranked', 'unranked')),
  waited_a   integer not null,   -- seconds the longer wait took (seat a)
  waited_b   integer not null,   -- seconds the newcomer waited (seat b)
  created_at timestamptz not null default now()
);
create index pvp_pairings_mode_time on public.pvp_pairings (mode, created_at desc);
alter table public.pvp_pairings enable row level security;
revoke all on public.pvp_pairings from anon, authenticated;

-- seconds, or null when there is too little to say
create function private.avg_wait(p_mode text) returns integer
language sql stable set search_path = '' as $$
  select case when count(*) >= 3 then round(avg((waited_a + waited_b) / 2.0))::int else null end
  from (select waited_a, waited_b from public.pvp_pairings where mode = p_mode and created_at > now() - interval '30 minutes' order by created_at desc limit 20) x
$$;

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
      and (me.mode <> 'ranked' or abs(q.rating - me.rating) <= win)
      and not exists (select 1 from public.matches m where m.status = 'active' and (m.player_a = q.user_id or m.player_b = q.user_id))
    order by q.since limit 1 for update skip locked;
  if not found then return null; end if;
  delete from public.pvp_queue where user_id in (me.user_id, o.user_id);
  insert into public.pvp_pairings (mode, waited_a, waited_b) values (me.mode, extract(epoch from now() - o.since)::int, waited);
  return jsonb_build_object('mode', me.mode, 'my_rating', me.rating,
    'other', jsonb_build_object('user_id', o.user_id, 'player', o.player, 'deck', o.deck, 'rating', o.rating, 'since', o.since));
end $$;

-- the join (and every poll) can ask for the average on the side
create function public.pvp_queue_join(p_user uuid, p_mode text, p_player jsonb, p_deck jsonb, p_want_avg boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb := public.pvp_queue_join(p_user, p_mode, p_player, p_deck);
begin
  if coalesce(p_want_avg, false) then
    r := r || jsonb_build_object('avg_wait', private.avg_wait(p_mode),
      'pairings', (select count(*) from public.pvp_pairings where mode = p_mode and created_at > now() - interval '30 minutes'));
  end if;
  return r;
end $$;

revoke all on function public.pvp_queue_join(uuid, text, jsonb, jsonb, boolean), private.avg_wait(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.pvp_queue_join(uuid, text, jsonb, jsonb, boolean) to service_role;
    grant all on public.pvp_pairings to service_role;
  end if;
end $$;

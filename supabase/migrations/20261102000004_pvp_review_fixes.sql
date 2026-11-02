-- Nov 2 security review fixes (Anvil):
-- 1. Players could read the whole deck list (host_deck / guest_deck) of a room through the API. Now they see only the
--    plain columns of their own rooms; the deck lists stay with the referee (service role).
-- 2. public.pvp_finish: inside a SECURITY DEFINER function current_user is the function owner, so the old
--    "current_user not in (...)" clause never refused anyone. The door is the JWT role claim (service_role) or, for the
--    local test run, the current role setting. EXECUTE stays revoked from players as well (belt and braces).
-- 3. A room is claimed only once: status 'waiting' -> 'started' happens through claim_room(), which refuses a second guest.

revoke select on public.rooms from authenticated;
grant select (code, host, guest, status, match_id, created_at, expires_at) on public.rooms to authenticated;

create or replace function public.pvp_finish(p_match uuid, p_winner uuid, p_result text, p_end_reason text, p_turns integer,
                                             p_summary_a jsonb, p_summary_b jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and coalesce(current_setting('role', true), '') not in ('service_role', 'postgres') then
    raise exception 'referee only' using errcode = '42501';
  end if;
  return private.pvp_finish(p_match, p_winner, p_result, p_end_reason, p_turns, p_summary_a, p_summary_b);
end $$;
revoke all on function public.pvp_finish(uuid, uuid, text, text, integer, jsonb, jsonb) from public, anon, authenticated;

-- The referee claims a waiting room for one guest in one statement (no second guest can win the race).
create or replace function public.claim_room(p_code text, p_guest uuid, p_guest_deck jsonb, p_match uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and coalesce(current_setting('role', true), '') not in ('service_role', 'postgres') then
    raise exception 'referee only' using errcode = '42501';
  end if;
  update public.rooms set guest = p_guest, guest_deck = p_guest_deck, status = 'started', match_id = p_match
    where code = p_code and status = 'waiting' and guest is null and expires_at > now();
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.claim_room(text, uuid, jsonb, uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_room(text, uuid, jsonb, uuid) to service_role;
  end if;
end $$;

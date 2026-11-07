-- Oreheart Online: Friends (requests, remove, block, challenges, admin). LOCAL database only, one transaction, rolled back.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_e_friends.test.sql
-- Own ids (fa00…) and names with no reserved part. Every door is called in its own statement, then checked (with the values seen).

\ir _helpers.sql

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('fa000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'pal9@test.local', '{"username":"Pal_Keeper"}', now()),
  ('fa000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pal1@test.local', '{"username":"Pal_Ann"}', now()),
  ('fa000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pal2@test.local', '{"username":"Pal_Ben"}', now()),
  ('fa000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pal3@test.local', '{"username":"Pal_Cat"}', now()),
  ('fa000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'pal4@test.local', '{"username":"Pal_Dan"}', now());
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'pal9@test.local';

\set A1 '''fa000000-0000-4000-8000-000000000009'''
\set U1 '''fa000000-0000-4000-8000-000000000001'''
\set U2 '''fa000000-0000-4000-8000-000000000002'''
\set U3 '''fa000000-0000-4000-8000-000000000003'''
\set U4 '''fa000000-0000-4000-8000-000000000004'''

create function pg_temp.fr_text() returns text language sql as $$
  select coalesce((select jsonb_agg(jsonb_build_array(f.user_a, f.user_b, f.status, f.requested_by)) from public.friendships f where f.user_a::text like 'fa000000%')::text, '[]') $$;

-- ========== 1. Friend codes ==========
select pg_temp.ok('every player has a friend code (8 letters/digits, no look-alikes), all different',
  (select bool_and(friend_code ~ '^[A-HJ-NP-Z2-9]{8}$') and count(distinct friend_code) = count(*) from public.profiles),
  (select string_agg(friend_code, ',') from public.profiles where id::text like 'fa000000%'));
create temp table ov1 as select pg_temp.json_as(:U1, 'aal1', 'select public.friends_overview()') as j;
select pg_temp.ok('friends_overview: my code, no friends yet, the max (100) and challenges on',
  (select j ->> 'code' = (select friend_code from public.profiles where id = :U1) and j -> 'friends' = '[]'::jsonb and (j ->> 'max')::int = 100 and (j ->> 'invites_enabled')::boolean from ov1), (select j::text from ov1));
select pg_temp.refused('anon cannot open the friends list', null, 'aal1', 'select public.friends_overview()', 'permission denied');

-- ========== 2. Requests ==========
create temp table r1 as select pg_temp.json_as(:U1, 'aal1', $q$ select public.friend_request('pal_ben') $q$) as j;
select pg_temp.ok('a request by username (any case) is sent and waits', (select j ->> 'state' = 'sent' from r1) and pg_temp.fr_text() like '%pending%', format('%s %s', (select j::text from r1), pg_temp.fr_text()));
create temp table r1b as select pg_temp.json_as(:U1, 'aal1', $q$ select public.friend_request('Pal_Ben') $q$) as j;
select pg_temp.ok('asking again changes nothing (still sent)', (select j ->> 'state' = 'sent' from r1b) and (select count(*) from public.friendships where requested_by = :U1) = 1, (select j::text from r1b));
create temp table ob as select pg_temp.json_as(:U2, 'aal1', 'select public.friends_overview()') as j;
select pg_temp.ok('Ben sees Ann''s request coming in; Ann sees it going out',
  (select jsonb_array_length(j -> 'incoming') = 1 and j -> 'incoming' -> 0 ->> 'username' = 'Pal_Ann' from ob)
  and (select jsonb_array_length(j -> 'outgoing') = 1 from pg_temp.json_as(:U1, 'aal1', 'select public.friends_overview()') j), (select j::text from ob));
create temp table a1 as select pg_temp.json_as(:U2, 'aal1', format('select public.friend_respond(%L, true)', :U1)) as j;
create temp table ov2 as select pg_temp.json_as(:U1, 'aal1', 'select public.friends_overview()') as j;
select pg_temp.ok('Ben accepts: both are friends, with name, rank and status',
  (select j ->> 'state' = 'friends' from a1) and (select jsonb_array_length(j -> 'friends') = 1 and j -> 'friends' -> 0 ->> 'username' = 'Pal_Ben' and j -> 'friends' -> 0 ? 'rank' and j -> 'friends' -> 0 ->> 'status' in ('online', 'offline') from ov2),
  format('%s %s', (select j::text from a1), (select j::text from ov2)));
create temp table r2 as select pg_temp.json_as(:U1, 'aal1', format('select public.friend_request(%L)', (select friend_code from public.profiles where id = :U3))) as j;
select pg_temp.ok('a request by friend code works too', (select j ->> 'state' = 'sent' from r2), (select j::text from r2));
create temp table r3 as select pg_temp.json_as(:U3, 'aal1', $q$ select public.friend_request('Pal_Ann') $q$) as j;
select pg_temp.ok('when the other player had already asked, your request accepts it at once', (select j ->> 'state' = 'friends' from r3) and (select count(*) from public.friendships where status = 'accepted' and :U1 in (user_a, user_b)) = 2, format('%s %s', (select j::text from r3), pg_temp.fr_text()));
create temp table r4 as select pg_temp.json_as(:U4, 'aal1', $q$ select public.friend_request('Pal_Ann') $q$) as j;
create temp table d4 as select pg_temp.json_as(:U1, 'aal1', format('select public.friend_respond(%L, false)', :U4)) as j;
select pg_temp.ok('a declined request disappears', (select j ->> 'state' = 'declined' from d4) and not exists (select 1 from public.friendships where requested_by = :U4), format('%s %s', (select j::text from d4), pg_temp.fr_text()));
select pg_temp.refused('you can''t friend yourself', :U1, 'aal1', $q$ select public.friend_request('Pal_Ann') $q$, 'you');
select pg_temp.refused('an unknown name is refused in plain words', :U1, 'aal1', $q$ select public.friend_request('Nobody_Here_99') $q$, 'No player with that name');
select pg_temp.refused('players cannot read the friendships table', :U1, 'aal1', 'select * from public.friendships', 'permission denied');
select pg_temp.refused('players cannot write the friendships table', :U4, 'aal1', format('insert into public.friendships (user_a, user_b, status, requested_by) values (%L, %L, ''accepted'', %L)', :U1, :U4, :U4), 'permission denied');

-- ========== 3. Remove and block ==========
create temp table rm as select pg_temp.json_as(:U3, 'aal1', format('select public.friend_remove(%L)', :U1)) as j;
select pg_temp.ok('remove ends the friendship', (select (j ->> 'removed')::boolean from rm) and not exists (select 1 from public.friendships where user_a = least(:U1::uuid, :U3::uuid) and user_b = greatest(:U1::uuid, :U3::uuid)), (select j::text from rm));
create temp table bk as select pg_temp.json_as(:U1, 'aal1', format('select public.friend_block(%L)', :U4)) as j;
select pg_temp.ok('block records it and shows it in my list', (select j ->> 'ok' = 'true' from bk) and exists (select 1 from public.blocks where blocker = :U1 and blocked = :U4)
  and (select j -> 'blocked' -> 0 ->> 'username' = 'Pal_Dan' from pg_temp.json_as(:U1, 'aal1', 'select public.friends_overview()') j), (select j::text from bk));
select pg_temp.refused('a blocked player can''t send me a request (it looks like no such player)', :U4, 'aal1', $q$ select public.friend_request('Pal_Ann') $q$, 'No player with that name');
select pg_temp.refused('... nor by my friend code', :U4, 'aal1', format('select public.friend_request(%L)', (select friend_code from public.profiles where id = :U1)), 'No player with that name');
select pg_temp.refused('and I can''t send one to them while I block them', :U1, 'aal1', $q$ select public.friend_request('Pal_Dan') $q$, 'No player with that name');
select pg_temp.refused('players cannot read the blocks table', :U4, 'aal1', 'select * from public.blocks', 'permission denied');

-- ========== 4. Challenges ==========
-- Ann makes a friend-code room (as the match function does) and challenges Ben
insert into public.rooms (code, host, host_deck) values ('FRNDAB', :U1, '{"player": {}, "deck": {}}');
insert into public.rooms (code, host, host_deck) values ('FRNDCD', :U2, '{"player": {}, "deck": {}}');
create temp table iv as select pg_temp.json_as(:U1, 'aal1', format('select public.friend_invite(%L, %L, %L, %L)', :U2, 'FRNDAB', 'friend', 'us-east')) as j;
select pg_temp.ok('a challenge to a friend is sent with a 60-second clock', (select j ->> 'ok' = 'true' and (j ->> 'expires_at')::timestamptz between now() + interval '55 seconds' and now() + interval '65 seconds' from iv), (select j::text from iv));
create temp table ob2 as select pg_temp.json_as(:U2, 'aal1', 'select public.friends_overview()') as j;
select pg_temp.ok('Ben sees the challenge (from Ann, friend mode, her region) and no room code yet',
  (select jsonb_array_length(j -> 'invites') = 1 and j -> 'invites' -> 0 ->> 'from_name' = 'Pal_Ann' and j -> 'invites' -> 0 ->> 'mode' = 'friend' and j -> 'invites' -> 0 ->> 'region' = 'us-east'
          and not (j -> 'invites' -> 0 ? 'code') from ob2), (select j::text from ob2));
select pg_temp.ok('Realtime rule: Ben can see his own invite row, Cat cannot see it',
  pg_temp.count_as(:U2, 'aal1', 'select * from public.friend_invites') = 1 and pg_temp.count_as(:U3, 'aal1', 'select * from public.friend_invites') = 0,
  format('ben=%s cat=%s', pg_temp.count_as(:U2, 'aal1', 'select * from public.friend_invites'), pg_temp.count_as(:U3, 'aal1', 'select * from public.friend_invites')));
select pg_temp.refused('players cannot change an invite row directly', :U2, 'aal1', 'update public.friend_invites set status = ''accepted''', 'permission denied');
create temp table ac as select pg_temp.json_as(:U2, 'aal1', format('select public.friend_invite_respond(%L, true)', (select j ->> 'id' from iv))) as j;
select pg_temp.ok('Ben accepts: he gets the room code to join, the invite is closed', (select j ->> 'code' = 'FRNDAB' from ac) and (select status from public.friend_invites where id = (select (j ->> 'id')::uuid from iv)) = 'accepted', (select j::text from ac));
select pg_temp.refused('the same challenge can''t be used twice', :U2, 'aal1', format('select public.friend_invite_respond(%L, true)', (select j ->> 'id' from iv)), 'was accepted');
select pg_temp.refused('only friends can be challenged', :U1, 'aal1', format('select public.friend_invite(%L, %L, %L, %L)', :U3, 'FRNDAB', 'friend', 'us-east'), 'only challenge your friends');
select pg_temp.refused('a challenge needs your own open room', :U1, 'aal1', format('select public.friend_invite(%L, %L, %L, %L)', :U2, 'FRNDCD', 'friend', 'us-east'), 'Make a room first');
create temp table iv2 as select pg_temp.json_as(:U1, 'aal1', format('select public.friend_invite(%L, %L, %L, %L)', :U2, 'FRNDAB', 'practice', 'us-west')) as j;
update public.friend_invites set expires_at = now() - interval '1 second' where id = (select (j ->> 'id')::uuid from iv2);
select pg_temp.refused('an expired challenge is refused', :U2, 'aal1', format('select public.friend_invite_respond(%L, true)', (select j ->> 'id' from iv2)), 'expired');
create temp table iv3 as select pg_temp.json_as(:U1, 'aal1', format('select public.friend_invite(%L, %L, %L, %L)', :U2, 'FRNDAB', 'friend', 'us-east')) as j;
create temp table dc as select pg_temp.json_as(:U2, 'aal1', format('select public.friend_invite_respond(%L, false)', (select j ->> 'id' from iv3))) as j;
select pg_temp.ok('a declined challenge gives no code', (select (j ->> 'declined')::boolean and not (j ? 'code') from dc), (select j::text from dc));
update public.settings set value = 'false'::jsonb where key = 'friend_invites_enabled';
select pg_temp.refused('with challenges switched off nobody can send one', :U1, 'aal1', format('select public.friend_invite(%L, %L, %L, %L)', :U2, 'FRNDAB', 'friend', 'us-east'), 'switched off');
update public.settings set value = 'true'::jsonb where key = 'friend_invites_enabled';

-- ========== 5. Friend-code rooms and blocks ==========
insert into public.rooms (code, host, host_deck) values ('BLKEDX', :U1, '{"player": {}, "deck": {}}');
create temp table cb (err text);
select set_config('request.jwt.claims', '{"role":"service_role"}', true); -- the referee's claim, as the match function makes it
do $$ begin
  begin perform public.claim_room('BLKEDX', 'fa000000-0000-4000-8000-000000000004', '{}'::jsonb, gen_random_uuid()); insert into cb values ('joined');
  exception when others then insert into cb values (sqlerrm); end;
end $$;
select pg_temp.ok('a player Ann blocked can''t join her friend code (the referee''s claim is refused)', (select err from cb) like '%can''t join this player%', (select err from cb));
create temp table cr as select public.claim_room('BLKEDX', :U3, '{}'::jsonb, gen_random_uuid()) as a;
select set_config('request.jwt.claims', '', true);
select pg_temp.ok('... anyone else still can', (select a from cr), (select a::text from cr));
create temp table ub as select pg_temp.json_as(:U1, 'aal1', format('select public.friend_unblock(%L)', :U4)) as j;
select pg_temp.ok('unblock lifts it', not exists (select 1 from public.blocks where blocker = :U1 and blocked = :U4), (select j::text from ub));

-- ========== 6. The list limit ==========
update public.settings set value = '2'::jsonb where key = 'friends_max';
create temp table r5 as select pg_temp.json_as(:U1, 'aal1', $q$ select public.friend_request('Pal_Cat') $q$) as j;
select pg_temp.refused('a full friends list refuses more', :U1, 'aal1', $q$ select public.friend_request('Pal_Dan') $q$, 'list is full');
update public.settings set value = '100'::jsonb where key = 'friends_max';

-- ========== 7. Admin ==========
create temp table af as select pg_temp.json_as(:A1, 'aal2', format('select public.admin_friends(%L)', :U1)) as j;
select pg_temp.ok('admin_friends: Ken sees a player''s code, friends (with state) and blocks',
  (select j ->> 'code' = (select friend_code from public.profiles where id = :U1) and exists (select 1 from jsonb_array_elements(j -> 'friends') e(x) where x ->> 'username' = 'Pal_Ben' and x ->> 'status' = 'accepted') from af), (select j::text from af));
create temp table arm as select pg_temp.json_as(:A1, 'aal2', format('select public.admin_remove_friendship(%L, %L, %L)', :U1, :U2, 'test: report from a parent')) as j;
select pg_temp.ok('admin removes a friendship with a reason, and it is audited',
  (select j ->> 'ok' = 'true' from arm) and not exists (select 1 from public.friendships where user_a = least(:U1::uuid, :U2::uuid) and user_b = greatest(:U1::uuid, :U2::uuid))
  and exists (select 1 from public.admin_audit where action = 'remove_friendship' and target_user = :U1), (select j::text from arm));
select pg_temp.refused('a player cannot open admin_friends', :U1, 'aal1', format('select public.admin_friends(%L)', :U2), 'admin');
select pg_temp.works('admin can set friends_max', :A1, 'aal2', $q$ select public.admin_set_setting('friends_max', '150', 'test: more friends') $q$);
select pg_temp.refused('friends_max stays in 1-1000', :A1, 'aal2', $q$ select public.admin_set_setting('friends_max', '5000', 'test') $q$, 'must be 1 to 1000');
select pg_temp.works('admin can switch challenges off and on', :A1, 'aal2', $q$ select public.admin_set_setting('friend_invites_enabled', 'false', 'test: off'), public.admin_set_setting('friend_invites_enabled', 'true', 'test: on') $q$);

-- ========== 8. Locks ==========
select pg_temp.ok('RLS is on for the friends tables; players may only SELECT invites (their own, by policy) and nothing else',
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('friendships', 'blocks', 'friend_invites'))
  and not exists (select 1 from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name in ('friendships', 'blocks', 'friend_invites') and g.grantee in ('anon', 'authenticated')
                  and not (g.table_name = 'friend_invites' and g.grantee = 'authenticated' and g.privilege_type = 'SELECT')),
  (select string_agg(g.grantee || ':' || g.privilege_type || ':' || g.table_name, ', ') from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name in ('friendships', 'blocks', 'friend_invites') and g.grantee in ('anon', 'authenticated')));

select n, case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by n;
do $$ declare f int := (select count(*) from results where not ok); t int := (select count(*) from results);
begin
  raise notice '% of % checks passed', t - f, t;
  if f > 0 then raise exception '% check(s) FAILED', f; end if;
end $$;
rollback;

-- Oreheart Online, Phase C: PvP tables (rooms, matches, match_views, match_moves), the player
-- doors pvp_gate / my_active_match and the referee's pvp_finish.
-- Run against a LOCAL database only (supabase start, or the local shim), never the real project:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_bc_pvp.test.sql
-- One transaction, rolled back at the end. Exits non-zero if any check fails.

\ir _helpers.sql

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('c0000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'v1@test.local', '{"username":"Side_A"}', now()),
  ('c0000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'v2@test.local', '{"username":"Side_B"}', now()),
  ('c0000000-0000-4000-8000-000000000023', 'authenticated', 'authenticated', 'v3@test.local', '{"username":"Nosy_Parker"}', now()),
  ('c0000000-0000-4000-8000-000000000024', 'authenticated', 'authenticated', 'v4@test.local', '{"username":"Banned_Bob"}', now());
update public.profiles set avatar = 'goblin-scrounger' where id = 'c0000000-0000-4000-8000-000000000021';
insert into public.bans (user_id, reason) values ('c0000000-0000-4000-8000-000000000024', 'test ban');

\set PA '''c0000000-0000-4000-8000-000000000021'''
\set PB '''c0000000-0000-4000-8000-000000000022'''
\set PC '''c0000000-0000-4000-8000-000000000023'''
\set PD '''c0000000-0000-4000-8000-000000000024'''
\set M1 '''22222222-0000-4000-8000-000000000001'''

-- ---------- the referee (database owner here; the service role on Supabase) sets up a match ----------
insert into public.rooms (code, host, guest, host_deck, guest_deck, status, match_id)
  values ('ABCDEF', :PA, :PB, '{"commander": "grubnak"}', '{"commander": "borgo"}', 'started', :M1);
insert into public.rooms (code, host, host_deck) values ('GHJKLM', :PC, '{"commander": "sproingle"}');
insert into public.matches (id, room_code, player_a, player_b, state, seq, engine_version)
  values (:M1, 'ABCDEF', :PA, :PB, '{"turn": 1, "secret": "both hands and decks live here", "priority": "player"}', 3, 'test');
insert into public.match_views (match_id, user_id, side, seq, view, events, deadline) values
  (:M1, :PA, 'a', 3, '{"mySide": "a", "state": {"turn": 1}}', '[]', now() + interval '2 minutes'),
  (:M1, :PB, 'b', 3, '{"mySide": "b", "state": {"turn": 1}}', '[]', now() + interval '2 minutes');
insert into public.match_moves (match_id, seq, user_id, action, ok, error, ms) values
  (:M1, 1, :PA, '{"type": "done"}', true, null, 12),
  (:M1, 2, :PB, '{"type": "done"}', true, null, 9),
  (:M1, 2, :PA, '{"type": "done"}', false, 'not your turn', 3);

-- ========== 1. Rooms ==========
select pg_temp.ok('room code rule: 6 capital letters without I or O',
  (select count(*) from (values ('ABCDEI'), ('ABCDE'), ('abcdef'), ('ABCDO1'), ('ABCDEFG')) v(c) where not (v.c ~ '^[A-HJ-NP-Z]{6}$')) = 5
  and 'GHJKLM' ~ '^[A-HJ-NP-Z]{6}$');
do $$ declare err text;
begin
  begin insert into public.rooms (code, host, host_deck) values ('ABCDIO', 'c0000000-0000-4000-8000-000000000023', '{}'); exception when others then err := sqlerrm; end;
  perform pg_temp.ok('rooms: a code with I or O is refused by the table', err is not null, coalesce(err, 'accepted'));
end $$;
select pg_temp.ok('host and guest see their room; a third player does not',
  pg_temp.count_as(:PA, 'aal1', $q$ select * from public.rooms where code = 'ABCDEF' $q$) = 1
  and pg_temp.count_as(:PB, 'aal1', $q$ select * from public.rooms where code = 'ABCDEF' $q$) = 1
  and pg_temp.count_as(:PC, 'aal1', $q$ select * from public.rooms where code = 'ABCDEF' $q$) = 0
  and pg_temp.count_as(:PC, 'aal1', $q$ select * from public.rooms $q$) = 1);
select pg_temp.refused('player cannot make a room directly', :PA, 'aal1', $q$ insert into public.rooms (code, host, host_deck) values ('ZZZZZZ', 'c0000000-0000-4000-8000-000000000021', '{}') $q$);
select pg_temp.refused('player cannot join a room directly', :PC, 'aal1', $q$ update public.rooms set guest = 'c0000000-0000-4000-8000-000000000023' $q$);

-- ========== 2. matches: the state is for the referee only ==========
select pg_temp.refused('player A cannot read matches.state', :PA, 'aal1', $q$ select state from public.matches $q$);
select pg_temp.refused('player A cannot read matches at all', :PA, 'aal1', $q$ select * from public.matches $q$);
select pg_temp.refused('player A cannot read matches.state even with 2-step login', :PA, 'aal2', $q$ select state from public.matches $q$);
select pg_temp.refused('player B cannot read matches.state', :PB, 'aal1', $q$ select state from public.matches where id = '22222222-0000-4000-8000-000000000001' $q$);
select pg_temp.refused('anon cannot read matches', null, null, $q$ select * from public.matches $q$);
select pg_temp.refused('player cannot change a match', :PA, 'aal1', $q$ update public.matches set winner = 'c0000000-0000-4000-8000-000000000021' $q$);
select pg_temp.refused('player cannot insert a match', :PA, 'aal1',
  $q$ insert into public.matches (player_a, player_b, state) values ('c0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000022', '{}') $q$);
select pg_temp.ok('matches: no grant of any kind to anon or players',
  not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'matches'
              and grantee in ('anon', 'authenticated', 'PUBLIC')));
select pg_temp.ok('my_matches: both players see their match, a third player sees nothing',
  pg_temp.count_as(:PA, 'aal1', 'select * from public.my_matches') = 1
  and pg_temp.count_as(:PB, 'aal1', 'select * from public.my_matches') = 1
  and pg_temp.count_as(:PC, 'aal1', 'select * from public.my_matches') = 0
  and pg_temp.count_as(null, null, 'select * from public.my_matches') = -1);
select pg_temp.ok('my_matches: shows the agreed columns and no state or clock',
  (select array_agg(column_name::text order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'my_matches')
  = array['created_at', 'end_reason', 'ended_at', 'id', 'mode', 'player_a', 'player_b', 'result', 'room_code', 'seq', 'status', 'turns', 'winner']);
select pg_temp.ok('my_matches: the row carries the right seq and status',
  (select (j ->> 'seq')::int = 3 and j ->> 'status' = 'active' and j ->> 'room_code' = 'ABCDEF'
   from pg_temp.json_as(:PA, 'aal1', 'select to_jsonb(m) from public.my_matches m limit 1') j));

-- ========== 3. match_views: each player sees only their own ==========
select pg_temp.ok('match_views: A sees A''s view only, B sees B''s only, C sees nothing',
  pg_temp.count_as(:PA, 'aal1', 'select * from public.match_views') = 1
  and pg_temp.count_as(:PA, 'aal1', $q$ select * from public.match_views where user_id = 'c0000000-0000-4000-8000-000000000022' $q$) = 0
  and pg_temp.count_as(:PB, 'aal1', $q$ select * from public.match_views where side = 'b' $q$) = 1
  and pg_temp.count_as(:PB, 'aal1', $q$ select * from public.match_views where side = 'a' $q$) = 0
  and pg_temp.count_as(:PC, 'aal1', 'select * from public.match_views') = 0);
select pg_temp.refused('player cannot update match_views (own row)', :PA, 'aal1',
  $q$ update public.match_views set view = '{"hacked": true}' where user_id = 'c0000000-0000-4000-8000-000000000021' $q$);
select pg_temp.refused('player cannot update match_views (any row)', :PA, 'aal2', $q$ update public.match_views set seq = 99 $q$);
select pg_temp.refused('player cannot insert match_views', :PA, 'aal1',
  $q$ insert into public.match_views (match_id, user_id, side, view) values ('22222222-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000023', 'a', '{}') $q$);
select pg_temp.refused('player cannot delete match_views', :PA, 'aal1', $q$ delete from public.match_views $q$);
select pg_temp.ok('match_views still intact after those attempts', (select count(*) from public.match_views where match_id = :M1) = 2
  and (select view ->> 'mySide' from public.match_views where match_id = :M1 and user_id = :PA) = 'a');

-- ========== 4. match_moves: only of finished matches ==========
select pg_temp.ok('match_moves: hidden while the match is active',
  pg_temp.count_as(:PA, 'aal1', 'select * from public.match_moves') = 0 and pg_temp.count_as(:PB, 'aal1', 'select * from public.match_moves') = 0);
select pg_temp.refused('player cannot write moves', :PA, 'aal1',
  $q$ insert into public.match_moves (match_id, seq, user_id, action, ok) values ('22222222-0000-4000-8000-000000000001', 9, 'c0000000-0000-4000-8000-000000000021', '{}', true) $q$);
do $$ declare err text;
begin
  begin update public.match_moves set ok = true where ok = false; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('match_moves are append-only even for the database owner', err like '%append-only%', coalesce(err, 'updated'));
end $$;

-- ========== 5. pvp_gate and my_active_match ==========
select pg_temp.ok('pvp_gate: returns user_id, username, avatar for a player in good standing',
  pg_temp.json_as(:PA, 'aal1', 'select public.pvp_gate()') = jsonb_build_object('user_id', 'c0000000-0000-4000-8000-000000000021', 'username', 'Side_A', 'avatar', 'goblin-scrounger'),
  pg_temp.json_as(:PA, 'aal1', 'select public.pvp_gate()')::text);
select pg_temp.refused('pvp_gate: a banned player is refused', :PD, 'aal1', 'select public.pvp_gate()', 'banned');
select pg_temp.refused('pvp_gate needs a login', null, null, 'select public.pvp_gate()');
update public.profiles set consent_status = 'pending', age_group = 'under_13' where id = :PC;
select pg_temp.refused('pvp_gate: an under-13 without parent approval is refused', :PC, 'aal1', 'select public.pvp_gate()', 'parent');
update public.profiles set consent_status = 'not_needed', age_group = '13_plus' where id = :PC;
select pg_temp.ok('my_active_match: A and B get the match, C gets null',
  (pg_temp.json_as(:PA, 'aal1', $q$ select coalesce(to_jsonb(public.my_active_match()), 'null'::jsonb) $q$) #>> '{}') = '22222222-0000-4000-8000-000000000001'
  and (pg_temp.json_as(:PB, 'aal1', $q$ select coalesce(to_jsonb(public.my_active_match()), 'null'::jsonb) $q$) #>> '{}') = '22222222-0000-4000-8000-000000000001'
  and pg_temp.json_as(:PC, 'aal1', $q$ select coalesce(to_jsonb(public.my_active_match()), 'null'::jsonb) $q$) = 'null'::jsonb);

-- ========== 6. pvp_finish ==========
select pg_temp.refused('players cannot call private.pvp_finish', :PA, 'aal1',
  $q$ select private.pvp_finish('22222222-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000021', 'a', 'win', 9, null, null) $q$);
select pg_temp.refused('players cannot call the referee door public.pvp_finish', :PA, 'aal2',
  $q$ select public.pvp_finish('22222222-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000021', 'a', 'win', 9, null, null) $q$);
select pg_temp.refused('anon cannot call the referee door', null, null,
  $q$ select public.pvp_finish('22222222-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000021', 'a', 'win', 9, null, null) $q$);
select pg_temp.ok('match still active after the refused calls', (select status from public.matches where id = :M1) = 'active');

do $$
declare
  m uuid := '22222222-0000-4000-8000-000000000001';
  a uuid := 'c0000000-0000-4000-8000-000000000021';
  b uuid := 'c0000000-0000-4000-8000-000000000022';
  sa jsonb := '{"commander": "grubnak", "creaturesPlayed": 6, "hitsLanded": 7, "unitsDefeated": 2, "commanderDamage": 20}';
  sb jsonb := '{"commander": "borgo", "creaturesPlayed": 5, "hitsLanded": 3, "hitsBlocked": 2}';
  r1 jsonb; r2 jsonb; r3 jsonb; m2 uuid;
  coins_a int := (select coins from public.wallets where user_id = a);
  coins_b int := (select coins from public.wallets where user_id = b);
begin
  r1 := public.pvp_finish(m, a, 'a', 'win', 9, sa, sb);
  perform pg_temp.ok('pvp_finish: marks the match finished with winner, result, reason, turns, ended_at',
    (select status = 'finished' and winner = a and result = 'a' and end_reason = 'win' and turns = 9 and ended_at is not null from public.matches where id = m)
    and (r1 ->> 'finished')::boolean, r1::text);
  -- (a dealt quest may finish too and pay its own reward; that is counted separately)
  perform pg_temp.ok('pvp_finish: pays 25 to the winner and 10 to the loser, once each',
    (select coins from public.wallets where user_id = a) = coins_a + 25 + (select coalesce(sum(delta), 0) from public.transactions where user_id = a and reason = 'quest_reward')
    and (select coins from public.wallets where user_id = b) = coins_b + 10 + (select coalesce(sum(delta), 0) from public.transactions where user_id = b and reason = 'quest_reward')
    and (select sum(delta) from public.transactions where reason = 'match_reward' and user_id = a) = 25
    and (select sum(delta) from public.transactions where reason = 'match_reward' and user_id = b) = 10
    and (select count(*) from public.transactions where reason = 'match_reward' and ref = m::text) = 2
    and (r1 -> 'a' ->> 'coins')::int = 25 and (r1 -> 'b' ->> 'coins')::int = 10, r1::text);
  perform pg_temp.ok('pvp_finish: stats for both (A 1 win with grubnak, B 1 loss with borgo)',
    (select games = 1 and wins = 1 and (by_commander -> 'grubnak' ->> 'wins')::int = 1 from public.player_stats where user_id = a)
    and (select games = 1 and losses = 1 and (by_commander -> 'borgo' ->> 'games')::int = 1 from public.player_stats where user_id = b));
  perform pg_temp.ok('pvp_finish: both quest summaries were counted under ref match:<id> (and quests were dealt)',
    (select count(*) from public.quest_reports where ref = 'match:' || m) = 2
    and (select count(*) from public.player_quests where user_id = a) = 3
    and (select count(*) from public.player_quests where user_id = b) = 3
    and jsonb_typeof(r1 -> 'a' -> 'quests_done') = 'array');
  perform pg_temp.ok('pvp_finish: the winner''s "wins" quests moved, the loser''s did not (if dealt)',
    not exists (select 1 from public.player_quests pq join public.quest_defs q on q.id = pq.quest_id
                where pq.user_id = b and q.kind in ('wins', 'wins_with') and pq.progress > 0)
    and not exists (select 1 from public.player_quests pq join public.quest_defs q on q.id = pq.quest_id
                    where pq.user_id = a and q.kind = 'battles' and pq.progress <> 1));
  r2 := public.pvp_finish(m, b, 'b', 'surrender', 9, sa, sb);
  perform pg_temp.ok('pvp_finish twice: the second call changes nothing and pays nothing',
    (r2 ->> 'repeat')::boolean and not (r2 ->> 'finished')::boolean
    and (select winner = a and result = 'a' and end_reason = 'win' from public.matches where id = m)
    and (select sum(delta) from public.transactions where reason = 'match_reward' and user_id = a) = 25
    and (select sum(delta) from public.transactions where reason = 'match_reward' and user_id = b) = 10
    and (select count(*) from public.transactions where reason = 'quest_reward' and user_id in (a, b))
        = (select count(*) from public.player_quests where user_id in (a, b) and paid_tx is not null)
    and (select count(*) from public.transactions where reason = 'match_reward' and ref = m::text) = 2
    and (select count(*) from public.quest_reports where ref = 'match:' || m) = 2
    and (select games from public.player_stats where user_id = a) = 1, r2::text);
  insert into public.matches (player_a, player_b, state, status) values (a, b, '{}', 'active') returning id into m2;
  r3 := public.pvp_finish(m2, a, 'a', 'timeout', 5, null, null);
  perform pg_temp.ok('pvp_finish: a null summary (abandoned match) still finishes and pays',
    (r3 ->> 'finished')::boolean and (r3 -> 'a' ->> 'coins')::int = 25 and r3 -> 'a' -> 'quests_done' = '[]'::jsonb
    and (select status = 'finished' and end_reason = 'timeout' from public.matches where id = m2), r3::text);
end $$;
select pg_temp.ok('my_active_match: null for A once the match is finished',
  pg_temp.json_as(:PA, 'aal1', $q$ select coalesce(to_jsonb(public.my_active_match()), 'null'::jsonb) $q$) = 'null'::jsonb);
select pg_temp.ok('match_moves: visible to both players once finished (3 moves), not to a third player',
  pg_temp.count_as(:PA, 'aal1', $q$ select * from public.match_moves where match_id = '22222222-0000-4000-8000-000000000001' $q$) = 3
  and pg_temp.count_as(:PB, 'aal1', $q$ select * from public.match_moves where match_id = '22222222-0000-4000-8000-000000000001' $q$) = 3
  and pg_temp.count_as(:PC, 'aal1', 'select * from public.match_moves') = 0);
select pg_temp.ok('my_matches: shows the result now',
  (select j ->> 'status' = 'finished' and j ->> 'result' = 'a' and j ->> 'winner' = 'c0000000-0000-4000-8000-000000000021'
   from pg_temp.json_as(:PB, 'aal1', $q$ select to_jsonb(m) from public.my_matches m where id = '22222222-0000-4000-8000-000000000001' $q$) j));
do $$ declare err text;
begin
  begin perform private.pvp_finish(gen_random_uuid(), null, 'a', 'win', 5, null, null); exception when others then err := sqlerrm; end;
  perform pg_temp.ok('pvp_finish: an unknown match is refused', err like '%match not found%', coalesce(err, 'accepted'));
end $$;

-- ========== 7. Whole-database checks ==========
select pg_temp.ok('every new PvP table has row level security on',
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('rooms', 'matches', 'match_views', 'match_moves')));
select pg_temp.ok('no table in public lets anon or players insert, update or delete',
  not exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
                and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')));
select pg_temp.ok('anon can run only the Phase A public doors (nothing new)',
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute'))
   = array['contact_submit', 'parent_consent_info', 'parent_give_consent', 'parent_revoke_consent', 'server_info', 'username_available']);
select pg_temp.ok('no private function can be run by players or anon',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'private' and (has_function_privilege('anon', p.oid, 'execute')
                                               or has_function_privilege('authenticated', p.oid, 'execute'))));
select pg_temp.ok('every security definer function pins search_path',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('public', 'private') and p.prosecdef
                and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')));

-- ---------- report ----------
\set QUIET off
select n, case when ok then 'PASS' else 'FAIL' end as result, name, case when ok then '' else detail end as detail
from results order by n;
do $$ declare f int := (select count(*) from results where not ok); t int := (select count(*) from results);
begin
  raise notice '% of % checks passed', t - f, t;
  if f > 0 then raise exception '% check(s) FAILED', f; end if;
end $$;
rollback;

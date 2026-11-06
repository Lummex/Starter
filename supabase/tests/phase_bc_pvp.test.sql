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
  pg_temp.count_as(:PA, 'aal1', $q$ select code, status from public.rooms where code = 'ABCDEF' $q$) = 1
  and pg_temp.count_as(:PB, 'aal1', $q$ select code, status from public.rooms where code = 'ABCDEF' $q$) = 1
  and pg_temp.count_as(:PC, 'aal1', $q$ select code, status from public.rooms where code = 'ABCDEF' $q$) = 0
  and pg_temp.count_as(:PC, 'aal1', $q$ select code, status from public.rooms $q$) = 1);
-- Nov 2 review fix: the deck lists in a room are the referee's; a player (even the host) cannot read them through the API
select pg_temp.refused('rooms: deck lists are not readable by players', :PA, 'aal1', $q$ select host_deck from public.rooms where code = 'ABCDEF' $q$, 'permission denied');
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
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true); r1 := public.pvp_finish(m, a, 'a', 'win', 9, sa, sb);
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
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true); r2 := public.pvp_finish(m, b, 'b', 'surrender', 9, sa, sb);
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
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true); r3 := public.pvp_finish(m2, a, 'a', 'timeout', 5, null, null);
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
-- ========== Abandoned matches (Nov 4) ==========
\set M2 '''22222222-0000-4000-8000-0000000000aa'''
\set M3 '''22222222-0000-4000-8000-0000000000bb'''
insert into public.matches (id, player_a, player_b, state, seq, engine_version, created_at, updated_at)
  values (:M2, :PC, :PD, '{"turn": 4}', 9, 'test', now() - interval '20 minutes', now() - interval '10 minutes'),
         (:M3, :PA, :PB, '{"turn": 2}', 5, 'test', now() - interval '20 minutes', now() - interval '10 minutes');
insert into public.match_views (match_id, user_id, side, seq, view, events, deadline) values
  (:M2, :PC, 'a', 9, '{"mySide": "a", "status": "active", "state": {"turn": 4}}', '[]', now() + interval '2 minutes'),
  (:M2, :PD, 'b', 9, '{"mySide": "b", "status": "active", "state": {"turn": 4}}', '[]', now() + interval '2 minutes');
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.pvp_seen(:M2, :PC); select public.pvp_seen(:M2, :PD); select public.pvp_seen(:M3, :PA); select public.pvp_seen(:M3, :PB);
select set_config('request.jwt.claims', '', true);
select pg_temp.refused('pvp_seen: a player cannot mark presence themselves', :PC, 'aal1', $q$ select public.pvp_seen('22222222-0000-4000-8000-0000000000aa', 'c0000000-0000-4000-8000-000000000023') $q$);
update public.match_presence set seen_at = now() - interval '5 minutes' where match_id = :M2; -- both of M2 gone 5 min
update public.match_presence set seen_at = now() - interval '5 minutes' where match_id = :M3 and user_id = :PA; -- M3: only A gone
create temp table sw1 as select private.sweep_abandoned() as n; -- its own statement: a check in the same statement would read the matches as they were before
select pg_temp.ok('sweeper: first ever run ends the match both players left, and leaves the one with a player still here',
  (select n from sw1) = 1
  and (select status || '/' || end_reason || '/' || result from public.matches where id = :M2) = 'finished/abandoned/tie'
  and (select status from public.matches where id = :M3) = 'active');
select pg_temp.ok('abandoned: both get a loss and an abandon, no coins, no quest, streak reset',
  (select bool_and(losses = 1 and abandons = 1 and games = 1 and win_streak = 0) from public.player_stats where user_id in (:PC, :PD))
  and not exists (select 1 from public.match_rewards where match_id = :M2)
  and not exists (select 1 from public.transactions where ref = '22222222-0000-4000-8000-0000000000aa'));
select pg_temp.ok('abandoned: a returning browser sees the match over with nobody winning',
  (select bool_and(seq = 10 and (view ->> 'status') = 'over' and (view -> 'result' ->> 'reason') = 'abandoned' and (view -> 'result' ->> 'won') = 'false' and deadline is null)
   from public.match_views where match_id = :M2)
  and (select (state ->> 'rewarded')::boolean and (state -> 'result' ->> 'reason') = 'abandoned' from public.matches where id = :M2));
select pg_temp.ok('abandoned: the match function will not pay it out (pvp_finish says repeat)',
  (private.pvp_finish(:M2, null, 'tie', 'abandoned', 4, '{}', '{}') ->> 'repeat') = 'true');
update public.match_presence set seen_at = now() - interval '5 minutes' where match_id = :M3; -- now B gone too
update private.sweeper_runs set last_run = now() - interval '10 minutes' where name = 'abandoned';
create temp table sw2 as select private.sweep_abandoned() as n;
select pg_temp.ok('sweeper: after a gap in its own runs (our outage) it ends nothing that time',
  (select n from sw2) = 0 and (select status from public.matches where id = :M3) = 'active'
  and (select note from private.sweeper_runs where name = 'abandoned') like 'gap of%');
create temp table sw3 as select private.sweep_abandoned() as n;
select pg_temp.ok('sweeper: when not one player of any active match has been heard from, it ends nothing (server unreachable, not players gone)',
  (select n from sw3) = 0 and (select status from public.matches where id = :M3) = 'active');
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.matches (id, player_a, player_b, state, seq, engine_version) values ('22222222-0000-4000-8000-000000000004', :PC, :PD, '{"turn": 1}', 1, 'test'); -- a live match elsewhere
select public.pvp_seen('22222222-0000-4000-8000-000000000004', :PC); -- someone, somewhere, is here
select set_config('request.jwt.claims', '', true);
create temp table sw4 as select private.sweep_abandoned() as n;
select pg_temp.ok('sweeper: the next run ends the match both players left',
  (select n from sw4) = 1 and (select end_reason from public.matches where id = :M3) = 'abandoned');
-- a match from before the presence marks existed (none at all) still ends once its last move is old enough
insert into public.matches (id, player_a, player_b, state, seq, engine_version, created_at, updated_at)
  values ('22222222-0000-4000-8000-000000000005', :PA, :PB, '{"turn": 13}', 40, 'test', now() - interval '2 days', now() - interval '2 days');
delete from public.match_presence where match_id = '22222222-0000-4000-8000-000000000004'; -- no marks anywhere now (the other active match is fresh and mark-less too)
create temp table sw5 as select private.sweep_abandoned() as n;
select pg_temp.ok('sweeper: a mark-less match from before the marks ends by its last move; a fresh mark-less match does not',
  (select n from sw5) = 1 and (select end_reason from public.matches where id = '22222222-0000-4000-8000-000000000005') = 'abandoned'
  and (select status from public.matches where id = '22222222-0000-4000-8000-000000000004') = 'active');
update public.settings set value = '600' where key = 'pvp_abandon_seconds';
select pg_temp.ok('the wait is one admin setting (pvp_abandon_seconds)',
  private.setting('pvp_abandon_seconds') = '600'::jsonb and 'pvp_abandon_seconds' = any (private.editable_settings()));
update public.settings set value = '120' where key = 'pvp_abandon_seconds';

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

-- ========== Modes (Nov 5): ranked queue + Elo, unranked queue, practice pays nothing ==========
select pg_temp.ok('modes: settings, the season name, the rank names',
  (private.setting('ranked_k'))::int = 32 and private.season_now() ~ '^\d{4}-Q[1-4]$'
  and private.rank_name(899) = 'Iron I' and private.rank_name(1000) = 'Sapphire III' and private.rank_name(1299) = 'Ruby I' and private.rank_name(1300) = 'Amethyst III' and private.rank_name(1500) = 'Oreheart' -- the 10-step ladder (Forge, Nov 5)
  and 'ranked_k' = any (private.editable_settings()));
select pg_temp.refused('queue: players cannot call the referee doors', :PA, 'aal1', $q$ select public.pvp_queue_pair('c0000000-0000-4000-8000-000000000021') $q$);
select pg_temp.refused('queue: players cannot read the queue table', :PA, 'aal1', 'select * from public.pvp_queue');
-- (each join is its own statement: inside one SELECT the planner may run the pair before the join)
create temp table qj1 as select public.pvp_queue_join(:PA, 'ranked', '{"userId": "c0000000-0000-4000-8000-000000000021", "username": "Side_A", "avatar": null}', '{"commander": "grubnak", "deckId": "goblin-warband", "cards": null}') as j;
select pg_temp.ok('queue: joining ranked gives rating 1000 and nobody else waiting', (select (j ->> 'rating')::int = 1000 and (j ->> 'others')::int = 0 and (j ->> 'waited')::int = 0 from qj1), (select j::text from qj1));
select pg_temp.ok('queue: pairing alone finds no one', public.pvp_queue_pair(:PA) is null);
select pg_temp.ok('queue: the row waits', (select count(*) from public.pvp_queue) = 1);
select public.pvp_queue_join(:PB, 'ranked', '{"userId": "c0000000-0000-4000-8000-000000000022", "username": "Side_B", "avatar": null}', '{"commander": "borgo", "deckId": "dwarf-warband", "cards": null}');
create temp table qp1 as select public.pvp_queue_pair(:PB) as j;
select pg_temp.ok('queue: a second ranked player is paired with the first (the longer wait)',
  (select j ->> 'mode' = 'ranked' and (j ->> 'my_rating')::int = 1000 and (j -> 'other' ->> 'user_id')::uuid = :PA and j -> 'other' -> 'player' ->> 'username' = 'Side_A' and j -> 'other' -> 'deck' ->> 'commander' = 'grubnak' from qp1), (select j::text from qp1));
select pg_temp.ok('queue: both rows go', (select count(*) from public.pvp_queue) = 0);
select public.pvp_queue_join(:PA, 'ranked', '{"userId": "c0000000-0000-4000-8000-000000000021"}', '{"commander": "grubnak"}');
select public.pvp_queue_join(:PB, 'ranked', '{"userId": "c0000000-0000-4000-8000-000000000022"}', '{"commander": "borgo"}');
update public.pvp_queue set rating = 1300 where user_id = :PA;
select pg_temp.ok('queue: ranked never pairs across the rating window (1300 vs 1000)', public.pvp_queue_pair(:PB) is null and (select count(*) from public.pvp_queue) = 2);
update public.pvp_queue set since = now() - interval '50 seconds' where user_id = :PB;
create temp table qp2 as select public.pvp_queue_pair(:PB) as j;
select pg_temp.ok('queue: ... until the wait widens it (50 s: window 350)', (select (j -> 'other' ->> 'rating')::int = 1300 from qp2) and (select count(*) from public.pvp_queue) = 0, (select coalesce(j::text, 'null') from qp2));
select public.pvp_queue_join(:PA, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000021"}', '{"commander": "grubnak"}');
update public.pvp_queue set seen_at = now() - interval '20 seconds', rating = 1300 where user_id = :PA;
select public.pvp_queue_join(:PB, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000022"}', '{"commander": "borgo"}');
select pg_temp.ok('queue: a browser that stopped polling (seen 20 s ago) is not paired', public.pvp_queue_pair(:PB) is null);
update public.pvp_queue set seen_at = now() where user_id = :PA;
create temp table qp3 as select public.pvp_queue_pair(:PB) as j;
select pg_temp.ok('queue: back, it is paired at once; unranked ignores the ratings (1300 vs 1000)', (select (j -> 'other' ->> 'user_id')::uuid = :PA from qp3) and (select count(*) from public.pvp_queue) = 0, (select coalesce(j::text, 'null') from qp3));
select public.pvp_queue_join(:PC, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000023"}', '{"commander": "grubnak"}');
select public.pvp_queue_leave(:PC);
select pg_temp.ok('queue: leave empties the row', (select count(*) from public.pvp_queue) = 0);
insert into public.matches (id, mode, player_a, player_b, state, seq, status, engine_version)
  values ('22222222-0000-4000-8000-0000000000ee', 'unranked', :PA, :PD, '{"turn": 1}', 1, 'active', 'test');
select public.pvp_queue_join(:PA, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000021"}', '{"commander": "grubnak"}');
select public.pvp_queue_join(:PC, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000023"}', '{"commander": "grubnak"}');
select pg_temp.ok('queue: a player already in an active match is never paired', public.pvp_queue_pair(:PC) is null);
update public.matches set status = 'finished', ended_at = now() where id = '22222222-0000-4000-8000-0000000000ee';
select public.pvp_queue_leave(:PA); select public.pvp_queue_leave(:PC);
-- wait times (Nov 5): pairings are recorded; the average needs three of them
delete from public.pvp_pairings; -- the queue checks above made some; start clean here
select pg_temp.ok('wait: no pairings yet, the average is null and the join says so when asked',
  private.avg_wait('unranked') is null
  and (select j ? 'avg_wait' and j -> 'avg_wait' = 'null'::jsonb and (j ->> 'pairings')::int = 0 from public.pvp_queue_join(:PA, 'unranked', '{"userId": "x"}', '{"commander": "grubnak"}', true) j)
  and (select not (j ? 'avg_wait') from public.pvp_queue_join(:PA, 'unranked', '{"userId": "x"}', '{"commander": "grubnak"}', false) j));
select public.pvp_queue_leave(:PA);
insert into public.pvp_pairings (mode, waited_a, waited_b) values ('unranked', 60, 20), ('unranked', 100, 40), ('ranked', 10, 10);
select pg_temp.ok('wait: two pairings are still too few', private.avg_wait('unranked') is null);
insert into public.pvp_pairings (mode, waited_a, waited_b) values ('unranked', 60, 20);
select pg_temp.ok('wait: a third makes an average (~50 s); ranked still has too few', private.avg_wait('unranked') = 50 and private.avg_wait('ranked') is null);
select public.pvp_queue_join(:PA, 'unranked', '{"userId": "a"}', '{"commander": "grubnak"}');
select public.pvp_queue_join(:PC, 'unranked', '{"userId": "c"}', '{"commander": "grubnak"}');
create temp table qp9 as select public.pvp_queue_pair(:PC) as j;
select pg_temp.ok('wait: a real pairing records both waits', (select j is not null from qp9) and (select count(*) from public.pvp_pairings where mode = 'unranked') = 4, (select coalesce(j::text, 'null') from qp9));
-- a ranked match between A and B, A wins: Elo moves 16 each way (K 32, equal ratings)
insert into public.matches (id, mode, player_a, player_b, state, seq, status, engine_version)
  values ('22222222-0000-4000-8000-0000000000cc', 'ranked', :PA, :PB, '{"turn": 7}', 40, 'active', 'test');
create temp table fin2 as select private.pvp_finish('22222222-0000-4000-8000-0000000000cc', :PA, 'a', 'win', 7, '{"commander": "grubnak", "turns": 7}', '{"commander": "borgo", "turns": 7}') as j;
select pg_temp.ok('ranked finish: coins as usual, ratings 1016 / 984, rating_events for both, the result says so',
  (select (j ->> 'finished')::boolean and j ->> 'mode' = 'ranked' and (j -> 'a' -> 'rating' ->> 'before')::int = 1000 and (j -> 'a' -> 'rating' ->> 'after')::int = 1016
          and (j -> 'b' -> 'rating' ->> 'after')::int = 984 and (j -> 'a' ->> 'coins')::int > 0 from fin2)
  and (select rating = 1016 and games = 1 and wins = 1 and peak = 1016 from public.ratings where user_id = :PA and season = private.season_now())
  and (select rating = 984 and games = 1 and losses = 1 and peak = 1000 from public.ratings where user_id = :PB and season = private.season_now())
  and (select count(*) from public.rating_events where match_id = '22222222-0000-4000-8000-0000000000cc') = 2,
  (select j::text from fin2));
select pg_temp.ok('ranked finish: the same match again moves nothing',
  (select not (j ->> 'finished')::boolean from private.pvp_finish('22222222-0000-4000-8000-0000000000cc', :PA, 'a', 'win', 7, null, null) j)
  and (select rating from public.ratings where user_id = :PA and season = private.season_now()) = 1016);
select pg_temp.ok('my_rank: Side A sees 1016 Sapphire III, first place; Side C (never ranked) sees 1000 and no place',
  (select (r ->> 'rating')::int = 1016 and r ->> 'name' = 'Sapphire III' and r -> 'rank' ->> 'division' = 'III' and (r -> 'rank' ->> 'next')::int = 1100 and jsonb_array_length(r -> 'ladder') = 10 and r ? 'season_end' and (r ->> 'place')::int = 1 and (r ->> 'wins')::int = 1 from pg_temp.json_as(:PA, 'aal1', 'select public.my_rank()') r)
  and (select (r ->> 'rating')::int = 1000 and r -> 'place' = 'null'::jsonb from pg_temp.json_as(:PC, 'aal1', 'select public.my_rank()') r),
  (select r::text from pg_temp.json_as(:PA, 'aal1', 'select public.my_rank()') r));
select pg_temp.refused('my_rank needs a login', null, null, 'select public.my_rank()');
-- a practice match: nothing paid, nothing counted
insert into public.matches (id, mode, player_a, player_b, state, seq, status, engine_version)
  values ('22222222-0000-4000-8000-0000000000dd', 'practice', :PA, :PB, '{"turn": 9}', 50, 'active', 'test');
create temp table stat0 as select user_id, games, coins_earned from public.player_stats where user_id in (:PA, :PB);
create temp table fin3 as select private.pvp_finish('22222222-0000-4000-8000-0000000000dd', :PA, 'a', 'win', 9, '{"commander": "grubnak", "turns": 9}', '{"commander": "borgo", "turns": 9}') as j;
select pg_temp.ok('practice finish: the match ends, 0 coins, no match_rewards, no quest, no rating change, stats untouched',
  (select (j ->> 'finished')::boolean and j ->> 'mode' = 'practice' and (j -> 'a' ->> 'coins')::int = 0 and (j -> 'b' ->> 'coins')::int = 0 from fin3)
  and (select status = 'finished' and winner = :PA from public.matches where id = '22222222-0000-4000-8000-0000000000dd')
  and not exists (select 1 from public.match_rewards where match_id = '22222222-0000-4000-8000-0000000000dd')
  and not exists (select 1 from public.rating_events where match_id = '22222222-0000-4000-8000-0000000000dd')
  and (select rating from public.ratings where user_id = :PA and season = private.season_now()) = 1016
  and coalesce((select bool_and(s.games = p.games and s.coins_earned = p.coins_earned) from stat0 s join public.player_stats p on p.user_id = s.user_id), true),
  (select j::text from fin3) || ' stats0=' || (select count(*) from stat0) || ' rewards=' || (select count(*) from public.match_rewards where match_id = '22222222-0000-4000-8000-0000000000dd'));

-- ---------- report ----------
\set QUIET off
-- ========== Nov 6: the Dashboard: leaderboard and What's New ==========
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where id = :PC and not exists (select 1 from public.roles r where r.user_id = :PC and r.role = 'admin'); -- Side C becomes the admin for these checks
select pg_temp.ok('leaderboard: Side A on top with its name and label, the caller flagged, the shares by step, the season end',
  (select jsonb_array_length(j -> 'top') >= 1 and j -> 'top' -> 0 ->> 'label' = 'Sapphire III' and (j -> 'top' -> 0 ->> 'me')::boolean and (j -> 'top' -> 0 ->> 'place')::int = 1
          and (j -> 'me' ->> 'rating')::int = 1016 and (j -> 'shares' ->> 'Sapphire')::int >= 1 and j ? 'season_end'
   from pg_temp.json_as(:PA, 'aal1', 'select public.leaderboard(10)') j),
  (select j::text from pg_temp.json_as(:PA, 'aal1', 'select public.leaderboard(10)') j));
select pg_temp.refused('leaderboard needs a login', null, null, 'select public.leaderboard(10)');
select pg_temp.ok('news_feed: the seeded patch notes, two placeholder events and one news line',
  (select jsonb_array_length(j -> 'patch') >= 2 and j -> 'patch' -> 0 ->> 'title' like 'Patch 0.9.5%' and jsonb_array_length(j -> 'events') = 2 and j -> 'events' -> 0 ->> 'action' in ('join', 'remind') and jsonb_array_length(j -> 'news') >= 1
   from pg_temp.json_as(:PA, 'aal1', 'select public.news_feed()') j),
  (select j::text from pg_temp.json_as(:PA, 'aal1', 'select public.news_feed()') j));
select pg_temp.refused('news_feed needs a login', null, null, 'select public.news_feed()');
select pg_temp.refused('news: a player cannot write posts', :PA, 'aal1', $q$ select public.admin_news_set(null, 'news', 'Hacked', null, '[]', null, null, true, 0, 'because') $q$);
select pg_temp.works('news: an admin adds a post', :PC, 'aal2', $q$ select public.admin_news_set(null, 'news', 'Server note', 'today', '["Line one"]', null, null, true, 9, 'test post') $q$);
select pg_temp.ok('news: the new post leads the news list and the audit row is there',
  (select j -> 'news' -> 0 ->> 'title' = 'Server note' from pg_temp.json_as(:PA, 'aal1', 'select public.news_feed()') j)
  and (select count(*) from public.admin_audit where action = 'news_set' and reason = 'test post') = 1);
select pg_temp.refused('news: players cannot read the table directly', :PA, 'aal1', 'select * from public.news_posts', 'permission denied');


-- ========== Regions (Nov 6): US East / Central / West pools, the counts, "Search all regions", the admin settings ==========
select public.pvp_queue_leave(:PA); select public.pvp_queue_leave(:PB); select public.pvp_queue_leave(:PC);
select pg_temp.ok('regions: the three US regions are enabled and editable, Europe is off, fallback 45 s, counts on',
  (select array_agg(r.id order by r.id) from private.regions_enabled() r) = array['us-central', 'us-east', 'us-west']
  and (select r.edge from private.regions_enabled() r where r.id = 'us-west') = 'us-west-1'
  and not private.region_ok('eu') and private.region_default() = 'us-east'
  and (private.setting('region_fallback_seconds'))::int = 45 and (private.setting('region_counts'))::boolean
  and 'regions' = any (private.editable_settings()) and 'region_fallback_seconds' = any (private.editable_settings()) and 'region_counts' = any (private.editable_settings()));
select pg_temp.refused('regions: an anonymous caller cannot read regions_info', null, 'aal1', 'select public.regions_info()');
create temp table ri1 as select pg_temp.json_as(:PA, 'aal1', 'select public.regions_info()') as j;
select pg_temp.ok('regions: a player sees the enabled regions with counts, no choice yet, the fallback time',
  (select jsonb_array_length(j -> 'regions') = 3 and j -> 'mine' = 'null'::jsonb and (j ->> 'fallback_seconds')::int = 45 and (j ->> 'counts')::boolean
          and j -> 'regions' -> 0 ->> 'id' = 'us-east' and (j -> 'regions' -> 0 ? 'online') and (j -> 'regions' -> 0 ? 'playing') and (j -> 'regions' -> 0 ? 'waiting') from ri1), (select j::text from ri1));
select pg_temp.refused('regions: a closed region cannot be chosen', :PA, 'aal1', $q$ select public.set_region('eu') $q$, 'not open');
select pg_temp.refused('regions: a made-up region cannot be chosen', :PA, 'aal1', $q$ select public.set_region('moon') $q$, 'not open');
create temp table ri2 as select pg_temp.json_as(:PA, 'aal1', $q$ select public.set_region('us-west') $q$) as j;
select pg_temp.ok('regions: choosing US West is remembered on the account and counts the player as online there',
  (select j ->> 'mine' = 'us-west' and (select x ->> 'online' from jsonb_array_elements(j -> 'regions') x where x ->> 'id' = 'us-west')::int = 1 from ri2)
  and (select region from public.profiles where id = :PA) = 'us-west', (select j::text from ri2));
select pg_temp.works('regions: null clears the choice (back to nearest by ping)', :PA, 'aal1', $q$ select public.set_region(null) $q$);
select pg_temp.ok('regions: ... and the profile forgets it', (select region is null from public.profiles where id = :PA));
-- the queue is per region
select public.pvp_queue_join(:PA, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000021"}', '{"commander": "grubnak"}', false, 'us-west', false);
create temp table rq1 as select public.pvp_queue_join(:PB, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000022"}', '{"commander": "borgo"}', false, 'us-east', false) as j;
select pg_temp.ok('regions: a join says its region, the others near (0: Side A is in the West) and the others everywhere (1), and the fallback time',
  (select j ->> 'region' = 'us-east' and (j ->> 'others')::int = 0 and (j ->> 'others_all')::int = 1 and (j ->> 'fallback')::int = 45 and not (j ->> 'any')::boolean from rq1), (select j::text from rq1));
select pg_temp.ok('regions: queuing sets the home region on the profile', (select region from public.profiles where id = :PB) = 'us-east' and (select region from public.profiles where id = :PA) = 'us-west');
select pg_temp.ok('regions: East and West never meet by themselves', public.pvp_queue_pair(:PB) is null and public.pvp_queue_pair(:PA) is null and (select count(*) from public.pvp_queue) = 2);
create temp table ri3 as select pg_temp.json_as(:PC, 'aal1', 'select public.regions_info()') as j;
select pg_temp.ok('regions: the counts say one waiting in the East and one in the West',
  (select (select x ->> 'waiting' from jsonb_array_elements(j -> 'regions') x where x ->> 'id' = 'us-east')::int = 1 and (select x ->> 'waiting' from jsonb_array_elements(j -> 'regions') x where x ->> 'id' = 'us-west')::int = 1 from ri3), (select j::text from ri3));
-- "Search all regions": Side B agrees, and is paired with Side A in the West
create temp table rq2 as select public.pvp_queue_join(:PB, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000022"}', '{"commander": "borgo"}', false, 'us-east', true) as j;
select pg_temp.ok('regions: after agreeing to search all regions the others near count everyone (1) and the wait is kept', (select (j ->> 'others')::int = 1 and (j ->> 'any')::boolean and (j ->> 'waited')::int >= 0 from rq2), (select j::text from rq2));
create temp table rp1 as select public.pvp_queue_pair(:PB) as j;
select pg_temp.ok('regions: ... and the pairing crosses regions (the match keeps seat a''s region, the West)',
  (select (j -> 'other' ->> 'user_id')::uuid = :PA and j ->> 'region' = 'us-west' and (j ->> 'cross_region')::boolean from rp1) and (select count(*) from public.pvp_queue) = 0, (select coalesce(j::text, 'null') from rp1));
-- the other way round: the one who waits in a region can be found by someone searching all regions
select public.pvp_queue_join(:PA, 'ranked', '{"userId": "c0000000-0000-4000-8000-000000000021"}', '{"commander": "grubnak"}', false, 'us-central', true);
select public.pvp_queue_join(:PB, 'ranked', '{"userId": "c0000000-0000-4000-8000-000000000022"}', '{"commander": "borgo"}', false, 'us-west', false);
create temp table rp2 as select public.pvp_queue_pair(:PB) as j;
select pg_temp.ok('regions: a player searching all regions is found by one who stayed in their own', (select (j -> 'other' ->> 'user_id')::uuid = :PA and j ->> 'region' = 'us-central' from rp2), (select coalesce(j::text, 'null') from rp2));
update public.matches set status = 'finished', ended_at = now() where id = '22222222-0000-4000-8000-000000000004'; -- Side C's old live match: a player in a match never pairs
-- the same region comes first
select public.pvp_queue_join(:PA, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000021"}', '{"commander": "grubnak"}', false, 'us-west', true);
update public.pvp_queue set since = now() - interval '30 seconds' where user_id = :PA;
select public.pvp_queue_join(:PC, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000023"}', '{"commander": "grubnak"}', false, 'us-east', false);
select public.pvp_queue_join(:PB, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000022"}', '{"commander": "borgo"}', false, 'us-east', true);
create temp table rp3 as select public.pvp_queue_pair(:PB) as j;
select pg_temp.ok('regions: a searcher of all regions still takes the one in their own region first (Side C, East) over the longer wait elsewhere', (select (j -> 'other' ->> 'user_id')::uuid = :PC and not (j ->> 'cross_region')::boolean from rp3), (select coalesce(j::text, 'null') from rp3));
select public.pvp_queue_leave(:PA);
-- an unknown region falls back to the default (an older game that sends none)
create temp table rq3 as select public.pvp_queue_join(:PA, 'unranked', '{"userId": "c0000000-0000-4000-8000-000000000021"}', '{"commander": "grubnak"}', false, 'moon', false) as j;
select pg_temp.ok('regions: a region the list does not have becomes the default (US East)', (select j ->> 'region' = 'us-east' from rq3), (select j::text from rq3));
select public.pvp_queue_leave(:PA);
-- playing counts: an active match in the West
insert into public.matches (id, mode, region, player_a, player_b, state, seq, status, engine_version)
  values ('22222222-0000-4000-8000-0000000000af', 'unranked', 'us-west', :PA, :PB, '{"turn": 1}', 1, 'active', 'test');
create temp table ri4 as select pg_temp.json_as(:PC, 'aal1', 'select public.regions_info()') as j;
select pg_temp.ok('regions: an active match counts two players playing in its region', (select (select x ->> 'playing' from jsonb_array_elements(j -> 'regions') x where x ->> 'id' = 'us-west')::int = 2 from ri4), (select j::text from ri4));
update public.matches set status = 'finished', ended_at = now() where id = '22222222-0000-4000-8000-0000000000af';
-- admin settings (Side C is the admin from the news checks above)
select pg_temp.refused('regions: a player cannot change the region list', :PA, 'aal2', $q$ select public.admin_set_setting('regions', '[{"id": "x", "name": "X", "edge": "us-east-1", "enabled": true}]', 'test') $q$, 'not admin');
select pg_temp.refused('regions: an edge Supabase does not offer is refused', :PC, 'aal2', $q$ select public.admin_set_setting('regions', '[{"id": "mars", "name": "Mars", "edge": "mars-1", "enabled": true}]', 'test') $q$, 'edge');
select pg_temp.refused('regions: two regions with one id are refused', :PC, 'aal2', $q$ select public.admin_set_setting('regions', '[{"id": "aa", "name": "A", "edge": "us-east-1", "enabled": true}, {"id": "aa", "name": "B", "edge": "us-west-1", "enabled": true}]', 'test') $q$, 'share');
select pg_temp.refused('regions: a list with nothing enabled is refused', :PC, 'aal2', $q$ select public.admin_set_setting('regions', '[{"id": "aa", "name": "A", "edge": "us-east-1", "enabled": false}]', 'test') $q$, 'enabled');
select pg_temp.works('regions: the admin opens Europe', :PC, 'aal2', $q$ select public.admin_set_setting('regions', '[{"id": "us-east", "name": "US East", "edge": "us-east-1", "enabled": true}, {"id": "us-central", "name": "US Central", "edge": "us-east-1", "enabled": true}, {"id": "us-west", "name": "US West", "edge": "us-west-1", "enabled": true}, {"id": "eu", "name": "Europe", "edge": "eu-west-1", "enabled": true}]', 'EU players asked') $q$);
select pg_temp.ok('regions: ... and Europe can be chosen now', private.region_ok('eu') and pg_temp.json_as(:PA, 'aal1', $q$ select public.set_region('eu') $q$) ->> 'mine' = 'eu');
select pg_temp.refused('regions: the fallback time must be 10 to 600 s', :PC, 'aal2', $q$ select public.admin_set_setting('region_fallback_seconds', '5', 'test') $q$, '10 to 600');
select pg_temp.works('regions: the admin sets the fallback to 90 s', :PC, 'aal2', $q$ select public.admin_set_setting('region_fallback_seconds', '90', 'test') $q$);
select pg_temp.refused('regions: the counts switch takes only true or false', :PC, 'aal2', $q$ select public.admin_set_setting('region_counts', '"yes"', 'test') $q$, 'true or false');
select pg_temp.works('regions: the admin turns the counts off', :PC, 'aal2', $q$ select public.admin_set_setting('region_counts', 'false', 'test') $q$);
create temp table ri5 as select pg_temp.json_as(:PA, 'aal1', 'select public.regions_info()') as j;
select pg_temp.ok('regions: with the counts off the regions come without numbers and the fallback reads 90', (select not (j -> 'regions' -> 0 ? 'online') and not (j ->> 'counts')::boolean and (j ->> 'fallback_seconds')::int = 90 from ri5), (select j::text from ri5));
select pg_temp.ok('regions: the dashboard counts switch is a true/false setting too (it had no shape check before)', pg_temp.json_as(:PC, 'aal2', $q$ select public.admin_set_setting('dashboard_counts', 'false', 'test') $q$) = 'false'::jsonb);
select pg_temp.ok('regions: every admin change is in the audit', (select count(*) from public.admin_audit where action = 'set_setting' and (after ->> 'key') in ('regions', 'region_fallback_seconds', 'region_counts')) >= 3);

select n, case when ok then 'PASS' else 'FAIL' end as result, name, case when ok then '' else detail end as detail
from results order by n;

do $$ declare f int := (select count(*) from results where not ok); t int := (select count(*) from results);
begin
  raise notice '% of % checks passed', t - f, t;
  if f > 0 then raise exception '% check(s) FAILED', f; end if;
end $$;
rollback;

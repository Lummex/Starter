-- Oreheart Online, Phase B: daily quests.
-- Run against a LOCAL database only (supabase start, or the local shim), never the real project:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_bc_quests.test.sql
-- One transaction, rolled back at the end. Exits non-zero if any check fails.

\ir _helpers.sql

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('c0000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'q1@test.local', '{"username":"Quest_Goer"}', now()),
  ('c0000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'q2@test.local', '{"username":"Quest_Rookie"}', now()),
  ('c0000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'q3@test.local', '{"username":"Quest_Busy"}', now());

\set P1 '''c0000000-0000-4000-8000-000000000011'''
\set P2 '''c0000000-0000-4000-8000-000000000012'''
\set P3 '''c0000000-0000-4000-8000-000000000013'''

-- ========== 1. The catalogue ==========
select pg_temp.ok('quest_defs: 14 quests, 4 easy, 6 medium, 4 hard, all active',
  (select count(*) filter (where tier = 'easy') = 4 and count(*) filter (where tier = 'medium') = 6
          and count(*) filter (where tier = 'hard') = 4 and bool_and(active) from public.quest_defs));
select pg_temp.ok('quest_fill: [Commander] and [Faction] are filled from the dealt params',
  private.quest_fill('[Commander]''s Day Out', '{"commander": "grubnak"}') = 'Grubnak Rotgut''s Day Out'
  and private.quest_fill('Play 10 [Faction] cards.', '{"faction": "dwarves"}') = 'Play 10 Dwarf cards.'
  and private.quest_fill('[Commander] rules', '{"commander": "someone-new"}') = 'Someone-New rules');
select pg_temp.ok('quest_cap_summary: the per-report caps hold (hits 1000 -> 200, creatures 99 -> 60, miner mines 500 -> 120, turns 90 -> 60)',
  (select (c ->> 'hitsLanded')::int = 200 and (c ->> 'creaturesPlayed')::int = 60 and (c ->> 'minerMines')::int = 120 and (c ->> 'turns')::int = 60
          and (c ->> 'battles')::int = 1 and (c ->> 'wins')::int = 1 and (c -> 'cardsByFaction' ->> 'goblins')::int = 60
   from private.quest_cap_summary('{"turns": 90, "won": true, "hitsLanded": 1000, "creaturesPlayed": 99, "minerMines": 500, "cardsByFaction": {"goblins": 500}}') c));
select pg_temp.ok('quest_cap_summary: a lost match counts 0 wins; missing numbers are 0; negatives are 0',
  (select (c ->> 'wins')::int = 0 and (c ->> 'hitsLanded')::int = 0 and (c ->> 'unitsDefeated')::int = 0
   from private.quest_cap_summary('{"turns": 5, "won": false, "unitsDefeated": -4}') c));

-- ========== 2. my_quests deals today's three ==========
create temp table mq1 as select pg_temp.json_as(:P1, 'aal1', 'select public.my_quests()') as j;
select pg_temp.ok('my_quests: shape {quests, reroll_left, streak_days, free_packs, today}',
  (select jsonb_typeof(j -> 'quests') = 'array' and (j ->> 'reroll_left')::int = 1 and (j ->> 'streak_days')::int = 0
          and (j ->> 'free_packs')::int = 0 and (j ->> 'today')::date = private.today() and (j ->> 'streak_goal')::int = 7 from mq1),
  (select j::text from mq1));
select pg_temp.ok('my_quests: 3 quests dealt today, one per tier, none done, expiring in 3 days, names filled in',
  (select jsonb_array_length(j -> 'quests') = 3
          and (select array_agg(q ->> 'tier' order by q ->> 'tier') from jsonb_array_elements(j -> 'quests') q) = array['easy', 'hard', 'medium']
          and (select bool_and(not (q ->> 'done')::boolean and (q ->> 'progress')::int = 0 and (q ->> 'target')::int >= 1
                               and (q ->> 'expires_on')::date = private.today() + 3
                               and q ->> 'name' not like '%[%' and q ->> 'text' not like '%[%'
                               and (q ->> 'reward')::int = case q ->> 'tier' when 'easy' then 25 when 'medium' then 50 else 75 end)
               from jsonb_array_elements(j -> 'quests') q)
   from mq1), (select j::text from mq1));
select pg_temp.ok('my_quests: calling again deals nothing new',
  (select jsonb_array_length(j -> 'quests') from pg_temp.json_as(:P1, 'aal1', 'select public.my_quests()') j) = 3
  and (select count(*) from public.player_quests where user_id = :P1) = 3);
select pg_temp.ok('player sees own player_quests rows only',
  pg_temp.count_as(:P1, 'aal1', 'select * from public.player_quests') = 3
  and pg_temp.count_as(:P2, 'aal1', $q$ select * from public.player_quests where user_id = 'c0000000-0000-4000-8000-000000000011' $q$) = 0);
select pg_temp.refused('my_quests needs a login', null, null, 'select public.my_quests()');

-- Make P1's three quests predictable (the database owner may; players can't).
update public.player_quests set quest_id = 'pick-a-fight',  params = '{}', target = 2 where user_id = :P1 and quest_id in (select id from public.quest_defs where tier = 'easy');
update public.player_quests set quest_id = 'winner-winner', params = '{}', target = 2 where user_id = :P1 and quest_id in (select id from public.quest_defs where tier = 'medium');
update public.player_quests set quest_id = 'hat-trick',     params = '{}', target = 3 where user_id = :P1 and quest_id in (select id from public.quest_defs where tier = 'hard');

-- ========== 3. quest_progress pays each quest once ==========
do $$
declare
  u uuid := 'c0000000-0000-4000-8000-000000000011';
  win jsonb := '{"turns": 9, "won": true, "commander": "grubnak", "creaturesPlayed": 3, "hitsLanded": 4}';
  d1 jsonb; d2 jsonb; d3 jsonb; err text;
  pq record;
begin
  d1 := private.quest_progress(u, win, 'practice:00000000-0000-4000-8000-000000000001');
  perform pg_temp.ok('report 1 (a win): nothing finished yet, progress 1/2, 1/2, 1/3',
    d1 = '[]'::jsonb
    and (select array_agg(progress order by quest_id) from public.player_quests where user_id = u) = array[1, 1, 1], d1::text);
  d2 := private.quest_progress(u, win, 'practice:00000000-0000-4000-8000-000000000002');
  perform pg_temp.ok('report 2: Pick a Fight and Winner Winner are done and paid (25 + 50), Hat Trick at 2/3',
    jsonb_array_length(d2) = 2
    and (select count(*) from public.player_quests where user_id = u and done_at is not null and paid_tx is not null) = 2
    and (select progress from public.player_quests where user_id = u and quest_id = 'hat-trick') = 2
    and (select count(*) from public.transactions where user_id = u and reason = 'quest_reward') = 2
    and (select sum(delta) from public.transactions where user_id = u and reason = 'quest_reward') = 75
    and (select bool_and(t.idem_key = 'quest:' || q.id and t.ref = q.id::text) from public.player_quests q join public.transactions t on t.id = q.paid_tx where q.user_id = u),
    d2::text);
  perform pg_temp.ok('report 2: just_done carries name, tier and reward',
    (select bool_and(x ? 'id' and x ? 'name' and x ? 'tier' and (x ->> 'reward')::int in (25, 50)) from jsonb_array_elements(d2) x), d2::text);
  perform pg_temp.ok('streak: not all three done yet, so no streak',
    (select coalesce(days, 0) from public.quest_streaks where user_id = u) = 0);
  d3 := private.quest_progress(u, win, 'practice:00000000-0000-4000-8000-000000000003');
  perform pg_temp.ok('report 3: Hat Trick done (75); the two earlier quests are NOT paid again',
    jsonb_array_length(d3) = 1 and d3 -> 0 ->> 'quest_id' = 'hat-trick'
    and (select count(*) from public.transactions where user_id = u and reason = 'quest_reward') = 3
    and (select sum(delta) from public.transactions where user_id = u and reason = 'quest_reward') = 150
    and (select coins from public.wallets where user_id = u) = 650, d3::text); -- 500 signup + 150 quests
  perform pg_temp.ok('streak: all three of today''s quests done -> 1 day, no free pack yet (goal 7)',
    (select days = 1 and last_day = private.today() from public.quest_streaks where user_id = u)
    and (select free_packs from public.wallets where user_id = u) = 0);
  -- a 4th report with yet another ref: everything is done, nothing is paid twice
  d1 := private.quest_progress(u, win, 'practice:00000000-0000-4000-8000-000000000004');
  perform pg_temp.ok('report 4: nothing left to finish, nothing paid again, streak still 1',
    d1 = '[]'::jsonb and (select count(*) from public.transactions where user_id = u and reason = 'quest_reward') = 3
    and (select days from public.quest_streaks where user_id = u) = 1);
  begin
    perform private.quest_progress(u, win, 'practice:00000000-0000-4000-8000-000000000001');
  exception when others then err := sqlerrm; end;
  perform pg_temp.ok('the same ref twice is refused', err like '%already counted%', coalesce(err, 'accepted'));
  perform pg_temp.ok('quest_reports: one row per ref', (select count(*) from public.quest_reports where user_id = u) = 4);
end $$;

-- ========== 4. Short matches and caps ==========
create temp table short1 as select private.quest_progress(:P2, '{"turns": 2, "won": true, "hitsLanded": 50}', 'practice:00000000-0000-4000-8000-000000000011') as d;
select pg_temp.ok('P2 gets quests dealt by the first report even without my_quests',
  (select d from short1) = '[]'::jsonb and (select count(*) from public.player_quests where user_id = :P2) = 3);
select pg_temp.ok('a match under 3 turns counts nothing (all progress still 0)',
  (select bool_and(progress = 0) from public.player_quests where user_id = :P2));
update public.player_quests set quest_id = 'thwack', params = '{}', target = 10 where user_id = :P2 and quest_id in (select id from public.quest_defs where tier = 'easy');
update public.player_quests set quest_id = 'mine-all-mine', params = '{}', target = 3 where user_id = :P2 and quest_id in (select id from public.quest_defs where tier = 'hard');
update public.player_quests set quest_id = 'faction-pride', params = '{"faction": "gnomes"}', target = 10 where user_id = :P2 and quest_id in (select id from public.quest_defs where tier = 'medium');
select private.quest_progress(:P2, '{"turns": 5, "won": false, "hitsLanded": 4, "mineHoldTurns": 2, "cardsByFaction": {"gnomes": 3, "goblins": 9}}', 'practice:00000000-0000-4000-8000-000000000012');
select private.quest_progress(:P2, '{"turns": 5, "won": false, "hitsLanded": 3, "mineHoldTurns": 1, "cardsByFaction": {"gnomes": 2}}', 'practice:00000000-0000-4000-8000-000000000013');
select pg_temp.ok('kinds: hits add up (7), faction cards count only the quest''s faction (5), mine hold keeps the best run (2, not 3)',
  (select progress from public.player_quests where user_id = :P2 and quest_id = 'thwack') = 7
  and (select progress from public.player_quests where user_id = :P2 and quest_id = 'faction-pride') = 5
  and (select progress from public.player_quests where user_id = :P2 and quest_id = 'mine-all-mine') = 2);
create temp table big1 as select private.quest_progress(:P2, '{"turns": 5, "won": false, "hitsLanded": 999}', 'practice:00000000-0000-4000-8000-000000000014') as d;
select pg_temp.ok('progress never passes the target (hits 999 -> 10/10, done)',
  (select jsonb_array_length(d) from big1) = 1
  and (select progress = 10 and done_at is not null from public.player_quests where user_id = :P2 and quest_id = 'thwack'));

-- ========== 5. quest_report (the player's door) ==========
select pg_temp.refused('quest_report: ref must be practice:<uuid>', :P3, 'aal1',
  $q$ select public.quest_report('{"turns": 5, "won": true}', 'match:00000000-0000-4000-8000-000000000001') $q$, 'bad match reference');
select pg_temp.refused('quest_report: summary must be an object', :P3, 'aal1',
  $q$ select public.quest_report('[1,2]', 'practice:00000000-0000-4000-8000-000000000021') $q$, 'bad match summary');
select pg_temp.refused('quest_report needs a login', null, null,
  $q$ select public.quest_report('{"turns": 5}', 'practice:00000000-0000-4000-8000-000000000021') $q$);
create temp table qr1 as select pg_temp.json_as(:P3, 'aal1',
  $q$ select public.quest_report('{"turns": 6, "won": true, "commander": "borgo", "creaturesPlayed": 4}', 'practice:00000000-0000-4000-8000-000000000021') $q$) as j;
select pg_temp.ok('quest_report: returns the Quests screen plus just_done',
  (select jsonb_array_length(j -> 'quests') = 3 and j ? 'just_done' and jsonb_typeof(j -> 'just_done') = 'array' and j ? 'streak_days' from qr1),
  (select j::text from qr1));
select pg_temp.refused('quest_report: the same ref twice is refused', :P3, 'aal1',
  $q$ select public.quest_report('{"turns": 6, "won": true}', 'practice:00000000-0000-4000-8000-000000000021') $q$, 'already counted');
do $$ declare i int; r jsonb; last jsonb;
begin
  for i in 2..20 loop
    r := pg_temp.json_as('c0000000-0000-4000-8000-000000000013', 'aal1',
      format($q$ select public.quest_report('{"turns": 6, "won": true}', %L) $q$, 'practice:00000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0')));
    if r ? 'error' then perform pg_temp.ok('quest_report ' || i || ' of 20 should work', false, r ->> 'error'); return; end if;
  end loop;
  last := pg_temp.json_as('c0000000-0000-4000-8000-000000000013', 'aal1',
      $q$ select public.quest_report('{"turns": 6, "won": true}', 'practice:00000000-0000-4000-8000-000000000099') $q$);
  perform pg_temp.ok('quest_report: 20 reports a day are fine, the 21st is refused', last ->> 'error' like '%Enough battles%', coalesce(last ->> 'error', 'accepted'));
end $$;

-- ========== 6. Reroll ==========
select pg_temp.refused('reroll: a finished quest cannot be swapped', :P1, 'aal1',
  format($q$ select public.quest_reroll(%L) $q$, (select id from public.player_quests where user_id = :P1 and quest_id = 'pick-a-fight')), 'already done');
select pg_temp.refused('reroll: someone else''s quest is not found', :P2, 'aal1',
  format($q$ select public.quest_reroll(%L) $q$, (select id from public.player_quests where user_id = :P1 and quest_id = 'hat-trick')), 'not found');
create temp table rr as select (select id from public.player_quests where user_id = :P2 and quest_id = 'faction-pride') as old_id;
create temp table rr1 as select pg_temp.json_as(:P2, 'aal1', format($q$ select public.quest_reroll(%L) $q$, (select old_id from rr))) as j;
select pg_temp.ok('reroll: the quest is replaced by another medium one; the old row stays, marked rerolled; reroll_left 0',
  (select rerolled from public.player_quests where id = (select old_id from rr))
  and (select count(*) from public.player_quests where user_id = :P2 and not rerolled) = 3
  and (select count(*) from public.player_quests where user_id = :P2) = 4
  and (select q.tier from public.player_quests pq join public.quest_defs q on q.id = pq.quest_id
       where pq.user_id = :P2 and not pq.rerolled and pq.dealt_on = private.today() and pq.id <> (select old_id from rr)
         and q.tier = 'medium') = 'medium'
  and (select quest_id from public.player_quests where user_id = :P2 and not rerolled and id in
         (select pq.id from public.player_quests pq join public.quest_defs q on q.id = pq.quest_id where q.tier = 'medium' and pq.user_id = :P2 and not pq.rerolled)) <> 'faction-pride'
  and (select (j ->> 'reroll_left')::int = 0 and jsonb_array_length(j -> 'quests') = 3 from rr1),
  (select j::text from rr1));
select pg_temp.refused('reroll: only once a day', :P2, 'aal1',
  format($q$ select public.quest_reroll(%L) $q$, (select id from public.player_quests where user_id = :P2 and quest_id = 'mine-all-mine')), 'already swapped');

-- ========== 7. Streak free pack ==========
update public.settings set value = '2' where key = 'quest_streak_days';
-- P3's quests: make them all finish with one more win using Grubnak and a 7-cost card
update public.player_quests set quest_id = 'pick-a-fight', params = '{}', target = 2, progress = 1 where user_id = :P3 and quest_id in (select id from public.quest_defs where tier = 'easy');
update public.player_quests set quest_id = 'big-spender', params = '{}', target = 1 where user_id = :P3 and quest_id in (select id from public.quest_defs where tier = 'medium');
update public.player_quests set quest_id = 'crown-jewels', params = '{"commander": "grubnak"}', target = 1 where user_id = :P3 and quest_id in (select id from public.quest_defs where tier = 'hard');
insert into public.quest_streaks (user_id) values (:P3) on conflict (user_id) do nothing; -- the row may not exist yet (it depends on earlier random deals)
update public.quest_streaks set days = 1, last_day = private.today() - 1 where user_id = :P3;
select private.quest_progress(:P3, '{"turns": 8, "won": true, "commander": "grubnak", "cost7Plays": 1}', 'practice:00000000-0000-4000-8000-000000000031');
select pg_temp.ok('streak: yesterday 1 + today all done = 2 days = quest_streak_days -> one free pack',
  (select days = 2 and last_day = private.today() from public.quest_streaks where user_id = :P3)
  and (select free_packs from public.wallets where user_id = :P3) = 1
  and (select count(*) from public.player_quests where user_id = :P3 and done_at is null and not rerolled) = 0);
select pg_temp.ok('my_quests shows the streak and the free pack',
  (select (j ->> 'streak_days')::int = 2 and (j ->> 'free_packs')::int = 1 and (j ->> 'streak_goal')::int = 2
          and (select bool_and((q ->> 'done')::boolean) from jsonb_array_elements(j -> 'quests') q)
   from pg_temp.json_as(:P3, 'aal1', 'select public.my_quests()') j));
update public.settings set value = '7' where key = 'quest_streak_days';
-- A missed day starts the streak over at 1.
update public.quest_streaks set days = 5, last_day = private.today() - 3 where user_id = :P1;
update public.player_quests set done_at = null, paid_tx = null, progress = 1 where user_id = :P1 and quest_id = 'pick-a-fight';
select private.quest_progress(:P1, '{"turns": 8, "won": true}', 'practice:00000000-0000-4000-8000-000000000005');
select pg_temp.ok('streak: a missed day starts over at 1',
  (select days = 1 and last_day = private.today() from public.quest_streaks where user_id = :P1));

-- ========== 8. Expiry ==========
-- (the rerolled-in medium quest may be any medium one, so these rows are found by id, not quest_id)
create temp table exp_rows as
  with a as (insert into public.player_quests (user_id, quest_id, params, dealt_on, target, expires_on)
               values (:P2, 'bonk-collector', '{}', private.today() - 5, 8, private.today() - 2) returning id),
       b as (insert into public.player_quests (user_id, quest_id, params, dealt_on, target, expires_on)
               values (:P2, 'shield-wall', '{}', private.today() - 2, 5, private.today() + 1) returning id)
  select (select id from a) as expired_id, (select id from b) as older_id;
select pg_temp.ok('my_quests: an expired quest is hidden, an older open one still shows (4 quests)',
  (select jsonb_array_length(j -> 'quests') = 4
          and not exists (select 1 from jsonb_array_elements(j -> 'quests') q where (q ->> 'id')::uuid = (select expired_id from exp_rows))
          and exists (select 1 from jsonb_array_elements(j -> 'quests') q where (q ->> 'id')::uuid = (select older_id from exp_rows))
   from pg_temp.json_as(:P2, 'aal1', 'select public.my_quests()') j));
select private.quest_progress(:P2, '{"turns": 5, "won": false, "hitsBlocked": 2, "unitsDefeated": 3}', 'practice:00000000-0000-4000-8000-000000000015');
select pg_temp.ok('progress reaches the older open quest but not the expired one',
  (select progress from public.player_quests where id = (select older_id from exp_rows)) = 2
  and (select progress from public.player_quests where id = (select expired_id from exp_rows)) = 0);

-- ========== 9. Players can't touch quest tables directly ==========
select pg_temp.refused('player cannot deal themself quests', :P1, 'aal1',
  $q$ insert into public.player_quests (user_id, quest_id, dealt_on, target, expires_on) values ('c0000000-0000-4000-8000-000000000011', 'hat-trick', current_date, 1, current_date) $q$);
select pg_temp.refused('player cannot bump progress', :P1, 'aal1', $q$ update public.player_quests set progress = 99 $q$);
select pg_temp.refused('player cannot read quest_reports', :P1, 'aal1', $q$ select * from public.quest_reports $q$);
select pg_temp.refused('player cannot change their streak', :P1, 'aal1', $q$ update public.quest_streaks set days = 99 $q$);
select pg_temp.refused('player cannot call quest_progress', :P1, 'aal1',
  $q$ select private.quest_progress('c0000000-0000-4000-8000-000000000011', '{"turns": 9, "won": true}', 'practice:00000000-0000-4000-8000-000000000077') $q$);
select pg_temp.refused('player cannot change the quest catalogue', :P1, 'aal2', $q$ update public.quest_defs set target = 1 $q$);
select pg_temp.ok('player can read the active quest catalogue', pg_temp.count_as(:P1, 'aal1', 'select * from public.quest_defs') = 14);
do $$ declare err text;
begin
  begin update public.quest_reports set ref = 'x' where user_id = 'c0000000-0000-4000-8000-000000000011'; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('quest_reports are append-only even for the database owner', err like '%append-only%', coalesce(err, 'updated'));
end $$;
select pg_temp.ok('no private function can be run by players or anon',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'private' and (has_function_privilege('anon', p.oid, 'execute')
                                               or has_function_privilege('authenticated', p.oid, 'execute'))));

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

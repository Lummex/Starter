-- Oreheart Online: feedback, the beta welcome and card backs (the Founder back). LOCAL database only, one transaction, rolled back.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_g_feedback_beta.test.sql
-- Own ids (fb00…) and names with no reserved part. Every door is called in its own statement, then checked (with the values seen).

\ir _helpers.sql

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('fb000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'fbk@test.local', '{"username":"Fb_Keeper"}', now()),
  ('fb000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'fb1@test.local', '{"username":"Bug_Hunter"}', now()),
  ('fb000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'fb2@test.local', '{"username":"Beta_Tess"}', now());
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'fbk@test.local';

\set A1 '''fb000000-0000-4000-8000-000000000009'''
\set U1 '''fb000000-0000-4000-8000-000000000001'''
\set U2 '''fb000000-0000-4000-8000-000000000002'''

-- ========== 1. The beta welcome and the Founder back ==========
select pg_temp.ok('beta_mode is a setting and starts on', (private.setting('beta_mode'))::boolean, private.setting('beta_mode')::text);
create temp table c0 as select pg_temp.json_as(:U1, 'aal1', 'select public.my_cosmetics()') as j;
select pg_temp.ok('a new account owns only the default back before its first sign-in, and wears it',
  (select j ->> 'equipped' = 'default' and jsonb_array_length(j -> 'card_backs') = 1 and j -> 'card_backs' -> 0 ->> 'item' = 'default' from c0), (select j::text from c0));
create temp table w1 as select pg_temp.json_as(:U1, 'aal1', 'select public.beta_welcome()') as j;
select pg_temp.ok('the first beta_welcome says show it, with the Founder reward',
  (select (j ->> 'show')::boolean and (j ->> 'beta')::boolean and j ->> 'reward' = 'founder' from w1), (select j::text from w1));
create temp table w2 as select pg_temp.json_as(:U1, 'aal1', 'select public.beta_welcome()') as j;
select pg_temp.ok('the welcome shows only once, and the back is granted only once',
  (select not (j ->> 'show')::boolean from w2) and (select count(*) from public.player_cosmetics where user_id = :U1 and item = 'founder') = 1, (select j::text from w2));
create temp table c1 as select pg_temp.json_as(:U1, 'aal1', 'select public.my_cosmetics()') as j;
select pg_temp.ok('my_cosmetics lists default and founder',
  (select exists (select 1 from jsonb_array_elements(j -> 'card_backs') e(x) where x ->> 'item' = 'founder' and x ->> 'ref' = 'beta') from c1), (select j::text from c1));
create temp table e1 as select pg_temp.json_as(:U1, 'aal1', $q$ select public.set_card_back('founder') $q$) as j;
select pg_temp.ok('equipping the Founder back works and is stored', (select j ->> 'equipped' = 'founder' from e1) and (select card_back from public.profiles where id = :U1) = 'founder', (select j::text from e1));
select pg_temp.refused('a back you don''t own can''t be equipped', :U1, 'aal1', $q$ select public.set_card_back('chest') $q$, 'don''t have that card back');
create temp table g1 as select pg_temp.json_as(:U1, 'aal1', 'select public.pvp_gate()') as j;
select pg_temp.ok('the PvP gate carries the equipped back to the referee (the opponent sees it)', (select j ->> 'card_back' = 'founder' from g1), (select j::text from g1));
create temp table e2 as select pg_temp.json_as(:U1, 'aal1', $q$ select public.set_card_back('default') $q$) as j;
select pg_temp.ok('back to the default', (select card_back from public.profiles where id = :U1) is null, (select j::text from e2));
select pg_temp.refused('players cannot write cosmetics themselves', :U2, 'aal1', format('insert into public.player_cosmetics (user_id, kind, item) values (%L, ''card_back'', ''founder'')', :U2), 'permission denied');
update public.settings set value = 'false'::jsonb where key = 'beta_mode';
create temp table w3 as select pg_temp.json_as(:U2, 'aal1', 'select public.beta_welcome()') as j;
select pg_temp.ok('with beta_mode off: no welcome and no Founder back', (select not (j ->> 'show')::boolean and not (j ->> 'beta')::boolean from w3)
  and not exists (select 1 from public.player_cosmetics where user_id = :U2 and item = 'founder'), (select j::text from w3));
update public.settings set value = 'true'::jsonb where key = 'beta_mode';

-- ========== 2. Feedback ==========
create temp table f1 as select pg_temp.json_as(:U1, 'aal1', $q$ select public.submit_feedback('bug', 'The shiv rat walked through a wall', 'data:image/jpeg;base64,AAAA', '{"build": "index-x.js", "screen": "match", "match": "m1"}') $q$) as j;
select pg_temp.ok('a bug report is saved with its screenshot and what the game knew',
  (select (j ->> 'ok')::boolean from f1) and exists (select 1 from public.feedback where user_id = :U1 and kind = 'bug' and screenshot like 'data:image/jpeg%' and meta ->> 'screen' = 'match' and status = 'new'),
  (select j::text from f1));
create temp table f2 as select pg_temp.json_as(:U1, 'aal1', $q$ select public.submit_feedback('idea', 'This shit is good, more goblins', null, '{}') $q$) as j;
select pg_temp.ok('blocked words are masked, never refused', (select message from public.feedback where user_id = :U1 and kind = 'idea') = 'This **** is good, more goblins',
  (select message from public.feedback where user_id = :U1 and kind = 'idea'));
select pg_temp.refused('the kind must be Bug, Idea or Other', :U1, 'aal1', $q$ select public.submit_feedback('rant', 'hello there', null, '{}') $q$, 'Pick Bug, Idea or Other');
select pg_temp.refused('too short is refused', :U1, 'aal1', $q$ select public.submit_feedback('bug', 'x', null, '{}') $q$, 'a little more');
select pg_temp.refused('over 1000 characters is refused', :U1, 'aal1', format('select public.submit_feedback(''bug'', %L, null, ''{}'')', repeat('a', 1001)), 'under 1000');
select pg_temp.refused('a screenshot that is not an image is refused', :U1, 'aal1', $q$ select public.submit_feedback('bug', 'see the picture', 'javascript:alert(1)', '{}') $q$, 'screenshot');
select pg_temp.refused('anon cannot send feedback', null, 'aal1', $q$ select public.submit_feedback('bug', 'hello there', null, '{}') $q$, 'permission denied');
select pg_temp.ok('a player reads only their own reports', pg_temp.count_as(:U1, 'aal1', 'select * from public.feedback') = 2 and pg_temp.count_as(:U2, 'aal1', 'select * from public.feedback') = 0,
  format('u1=%s u2=%s', pg_temp.count_as(:U1, 'aal1', 'select * from public.feedback'), pg_temp.count_as(:U2, 'aal1', 'select * from public.feedback')));
select pg_temp.refused('players cannot write the feedback table directly', :U2, 'aal1', format('insert into public.feedback (user_id, kind, message) values (%L, ''bug'', ''hello'')', :U2), 'permission denied');
create temp table mf as select pg_temp.json_as(:U1, 'aal1', 'select public.my_feedback()') as j;
select pg_temp.ok('my_feedback lists my two reports, newest first', (select jsonb_array_length(j) = 2 and j -> 0 ->> 'kind' = 'idea' from mf), (select j::text from mf));
-- the daily limit: 8 more is 10 in all, the 11th is refused
do $$ begin for i in 1..8 loop perform pg_temp.json_as('fb000000-0000-4000-8000-000000000001', 'aal1', format('select public.submit_feedback(''other'', %L, null, ''{}'')', 'note number ' || i)); end loop; end $$;
select pg_temp.refused('the 11th report of the day is refused kindly', :U1, 'aal1', $q$ select public.submit_feedback('bug', 'one more thing', null, '{}') $q$, 'plenty for today');

-- ========== 3. Admin ==========
create temp table af as select pg_temp.json_as(:A1, 'aal2', $q$ select public.admin_feedback('new', 'bug', 1, 50) $q$) as j;
select pg_temp.ok('admin_feedback: the New bugs with the player''s name and a screenshot flag (the picture itself is fetched on its own)',
  (select (j ->> 'total')::int = 1 and j -> 'rows' -> 0 ->> 'username' = 'Bug_Hunter' and (j -> 'rows' -> 0 ->> 'has_screenshot')::boolean and not (j -> 'rows' -> 0 ? 'screenshot') from af), (select j::text from af));
create temp table sc as select pg_temp.json_as(:A1, 'aal2', format('select to_jsonb(public.admin_feedback_screenshot(%s))', (select j -> 'rows' -> 0 ->> 'id' from af))) as j;
select pg_temp.ok('admin_feedback_screenshot returns the picture', (select j #>> '{}' like 'data:image/jpeg%' from sc), (select left(j::text, 60) from sc));
create temp table st as select pg_temp.json_as(:A1, 'aal2', format('select public.admin_feedback_set(%s, ''fixed'', ''walls fixed in the next build'')', (select j -> 'rows' -> 0 ->> 'id' from af))) as j;
select pg_temp.ok('Ken marks it Fixed with a note; it is audited and the player sees the new status',
  (select (j ->> 'ok')::boolean from st) and exists (select 1 from public.admin_audit where action = 'feedback_status' and target_user = :U1)
  and (select x ->> 'status' from pg_temp.json_as(:U1, 'aal1', 'select public.my_feedback()') j2, jsonb_array_elements(j2) e(x) where x ->> 'kind' = 'bug' limit 1) = 'fixed', (select j::text from st));
select pg_temp.refused('the status must be one of the four', :A1, 'aal2', format('select public.admin_feedback_set(%s, ''maybe'', null)', (select j -> 'rows' -> 0 ->> 'id' from af)), 'new, seen, fixed or wontfix');
select pg_temp.refused('a player cannot open the Feedback list', :U1, 'aal1', $q$ select public.admin_feedback('', '', 1, 50) $q$, 'admin');
select pg_temp.works('admin can switch beta_mode off and on', :A1, 'aal2', $q$ select public.admin_set_setting('beta_mode', 'false', 'test: off'), public.admin_set_setting('beta_mode', 'true', 'test: on') $q$);
select pg_temp.refused('beta_mode takes only true or false', :A1, 'aal2', $q$ select public.admin_set_setting('beta_mode', '"yes"', 'test') $q$, 'true or false');

select n, case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by n;
do $$ declare f int := (select count(*) from results where not ok); t int := (select count(*) from results);
begin
  raise notice '% of % checks passed', t - f, t;
  if f > 0 then raise exception '% check(s) FAILED', f; end if;
end $$;
rollback;

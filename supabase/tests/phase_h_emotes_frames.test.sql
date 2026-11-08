-- Oreheart Online: emotes, avatar frames, Founder avatars, the Producer frame (Nov 7). LOCAL database only, one transaction, rolled back.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_h_emotes_frames.test.sql
-- Own ids (e7…). Every door is called in its own statement, then checked (with the values seen).

\ir _helpers.sql
-- Nov 7 (migration 12): new players start with 2800 coins (7 packs); this file's arithmetic was written for 500, so it pins 500 here (rolled back)
update public.settings set value = '500'::jsonb where key = 'signup_bonus_coins';

-- Nov 7 (migration 11): live prices are 400 coins a pack, 1 Oreshard = 4 coins, quests 75/125/200. The arithmetic in this file was
-- written for 100 / 1 / 25-50-75, so it pins those here (inside this file's rolled-back transaction); phase_d checks the live values.
update public.pack_types set price_coins = 100 where price_coins = 400;
update public.settings set value = '1'::jsonb where key = 'oreshard_pack_rate';
update public.settings set value = '25'::jsonb where key = 'quest_reward_easy';
update public.settings set value = '50'::jsonb where key = 'quest_reward_medium';
update public.settings set value = '75'::jsonb where key = 'quest_reward_hard';

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('e7000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'e7k@test.local', '{"username":"Em_Keeper"}', now()),
  ('e7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'e71@test.local', '{"username":"Emo_Ellie"}', now()),
  ('e7000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'e72@test.local', '{"username":"Frame_Fred"}', now());
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'e7k@test.local';

\set A1 '''e7000000-0000-4000-8000-000000000009'''
\set U1 '''e7000000-0000-4000-8000-000000000001'''
\set U2 '''e7000000-0000-4000-8000-000000000002'''

-- ========== 1. Emotes ==========
create temp table m1 as select pg_temp.json_as(:U1, 'aal1', 'select public.my_emotes()') as j;
select pg_temp.ok('a new player owns the ten free emotes and has the default wheel',
  (select jsonb_array_length(j -> 'owned') = 10 and jsonb_array_length(j -> 'wheel') between 6 and 8 from m1), (select j::text from m1));
select pg_temp.refused('the wheel takes at most 8', :U1, 'aal1',
  $q$ select public.set_emote_wheel(array['free-starter/hello','free-starter/good-game','free-starter/oops','free-starter/wow','free-starter/friends','free-starter/thinking','free-starter/your-turn','free-starter/nice','free-starter/yes']) $q$, 'Up to 8');
create temp table pk as select (select id from public.emote_packs where not free order by sort limit 1) as pack,
  (select e.id from public.emotes e join public.emote_packs p on p.id = e.pack where not p.free order by p.sort, e.sort limit 1) as one;
select pg_temp.refused('an emote you don''t own can''t go on the wheel', :U1, 'aal1', format('select public.set_emote_wheel(array[%L])', (select one from pk)), 'don''t have that emote');
create temp table sh1 as select pg_temp.json_as(:U1, 'aal1', 'select public.emote_shop()') as j;
select pg_temp.ok('the shop lists the free set and three packs for sale',
  (select jsonb_array_length(j -> 'packs') = 4 and (select count(*) from jsonb_array_elements(j -> 'packs') e(x) where not (x ->> 'free')::boolean and (x ->> 'price_coins')::int > 0) = 3 from sh1), (select left(j::text, 300) from sh1));
select private.ledger_apply(:U1, 5000, 'admin_grant', 'test', 'test-e7-coins-u1', null);
create temp table b1 as select pg_temp.json_as(:U1, 'aal1', format('select public.buy_emote(''emote'', %L, ''coins'', ''emo-buy-0001'')', (select one from pk))) as j;
select pg_temp.ok('buying one emote with coins: paid once, owned',
  (select (j ->> 'ok')::boolean and j ->> 'paid_with' = 'coins' from b1) and exists (select 1 from public.player_cosmetics where user_id = :U1 and kind = 'emote' and item = (select one from pk))
  and (select count(*) from public.transactions where user_id = :U1 and reason = 'cosmetic') = 1, (select j::text from b1));
create temp table b2 as select pg_temp.json_as(:U1, 'aal1', format('select public.buy_emote(''emote'', %L, ''coins'', ''emo-buy-0001'')', (select one from pk))) as j;
select pg_temp.ok('the same click twice is one purchase', (select (j ->> 'repeat')::boolean from b2) and (select count(*) from public.transactions where user_id = :U1 and reason = 'cosmetic') = 1, (select j::text from b2));
select pg_temp.refused('an emote you own can''t be bought again', :U1, 'aal1', format('select public.buy_emote(''emote'', %L, ''coins'', ''emo-buy-0002'')', (select one from pk)), 'already have');
select pg_temp.refused('the free set is not for sale', :U1, 'aal1', $q$ select public.buy_emote('pack', 'free-starter', 'coins', 'emo-buy-0003') $q$, 'not for sale');
select pg_temp.refused('no Oreshards, no pack', :U1, 'aal1', format('select public.buy_emote(''pack'', %L, ''oreshards'', ''emo-buy-0004'')', (select pack from pk)), 'Not enough Oreshards');
select private.oreshard_apply(:U1, 1000, 'admin_grant', 'test', 'test-e7-shards-u1');
create temp table b3 as select pg_temp.json_as(:U1, 'aal1', format('select public.buy_emote(''pack'', %L, ''oreshards'', ''emo-buy-0005'')', (select pack from pk))) as j;
select pg_temp.ok('a pack for Oreshards gives the rest of the pack',
  (select j ->> 'paid_with' = 'oreshards' from b3) and (select count(*) from public.player_cosmetics c join public.emotes e on e.id = c.item where c.user_id = :U1 and c.kind = 'emote' and e.pack = (select pack from pk))
     = (select count(*) from public.emotes where pack = (select pack from pk) and enabled), (select j::text from b3));
create temp table w1 as select pg_temp.json_as(:U1, 'aal1', format('select public.set_emote_wheel(array[''free-starter/hello'', %L])', (select one from pk))) as j;
select pg_temp.ok('a bought emote can go on the wheel', (select profiles.emote_wheel from public.profiles where id = :U1) = array['free-starter/hello', (select one from pk)], (select j::text from w1));
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
create temp table ref1 as select public.pvp_emote_ok(:U1, (select one from pk)) as a, public.pvp_emote_ok(:U2, (select one from pk)) as b, public.pvp_emote_ok(:U2, 'free-starter/yes') as c;
select set_config('request.jwt.claims', '', true);
select pg_temp.ok('the referee asks: Ellie owns it, Fred does not, everyone has the free ones', (select a and not b and c from ref1), (select format('%s %s %s', a, b, c) from ref1));
select pg_temp.refused('a player cannot use the referee door', :U2, 'aal1', $q$ select public.pvp_emote_ok('e7000000-0000-4000-8000-000000000002', 'free-starter/yes') $q$, 'permission denied');
select pg_temp.refused('players cannot write cosmetics themselves', :U2, 'aal1', format('insert into public.player_cosmetics (user_id, kind, item) values (%L, ''emote'', %L)', :U2, (select one from pk)), 'permission denied');

-- ========== 2. Frames ==========
create temp table f0 as select pg_temp.json_as(:U2, 'aal1', 'select public.my_frames()') as j;
select pg_temp.ok('the frames list shows the six store frames, never Founder or Producer to a new player',
  (select jsonb_array_length(j -> 'frames') = 6 and not exists (select 1 from jsonb_array_elements(j -> 'frames') e(x) where x ->> 'kind' <> 'store') and j -> 'equipped' = 'null'::jsonb from f0), (select left(j::text, 300) from f0));
select pg_temp.refused('a frame you don''t own can''t be worn', :U2, 'aal1', $q$ select public.set_frame('skullfang') $q$, 'don''t have that frame');
select pg_temp.refused('the Producer frame is never for sale', :U2, 'aal1', $q$ select public.buy_frame('producer', 'coins', 'frame-buy-0001') $q$, 'not for sale');
select pg_temp.refused('the Founder frame is never for sale', :U2, 'aal1', $q$ select public.buy_frame('founder', 'oreshards', 'frame-buy-0002') $q$, 'not for sale');
select private.ledger_apply(:U2, 5000, 'admin_grant', 'test', 'test-e7-coins-u2', null);
create temp table fb as select pg_temp.json_as(:U2, 'aal1', $q$ select public.buy_frame('skullfang', 'coins', 'frame-buy-0003') $q$) as j;
create temp table fw as select pg_temp.json_as(:U2, 'aal1', $q$ select public.set_frame('skullfang') $q$) as j;
select pg_temp.ok('buy a frame with coins and wear it', (select (j ->> 'ok')::boolean from fb) and (select frame from public.profiles where id = :U2) = 'skullfang', (select j::text from fb));
create temp table g1 as select pg_temp.json_as(:U2, 'aal1', 'select public.pvp_gate()') as j;
select pg_temp.ok('the PvP gate carries the frame (the opponent sees it)', (select j ->> 'frame' = 'skullfang' and j ? 'title' from g1), (select j::text from g1));
create temp table fn as select pg_temp.json_as(:U2, 'aal1', $q$ select public.set_frame(null) $q$) as j;
select pg_temp.ok('taking the frame off', (select frame from public.profiles where id = :U2) is null, (select j::text from fn));

-- ========== 3. Founder avatars and the beta welcome ==========
select pg_temp.refused('a Founder avatar needs the beta reward', :U2, 'aal1', $q$ select public.set_avatar('founder-latino-girl') $q$);
create temp table bw as select pg_temp.json_as(:U2, 'aal1', 'select public.beta_welcome()') as j;
select pg_temp.ok('the beta welcome gives the Founder back, frame and 32 avatars',
  (select (j ->> 'show')::boolean and jsonb_array_length(j -> 'avatars') = 32 from bw)
  and (select count(*) from public.player_cosmetics where user_id = :U2 and kind = 'avatar') = 32
  and exists (select 1 from public.player_cosmetics where user_id = :U2 and kind = 'frame' and item = 'founder')
  and exists (select 1 from public.player_cosmetics where user_id = :U2 and kind = 'card_back' and item = 'founder'), (select left(j::text, 200) from bw));
select pg_temp.works('now a Founder avatar can be worn', :U2, 'aal1', $q$ select public.set_avatar('founder-latino-girl') $q$);
select pg_temp.works('and the Founder frame', :U2, 'aal1', $q$ select public.set_frame('founder') $q$);

-- ========== 4. Admin: prices and grants (Producer) ==========
select pg_temp.works('admin sets an emote pack price', :A1, 'aal2', format('select public.admin_set_cosmetic_price(''emote_pack'', %L, 900, 450, true, ''test: price'')', (select pack from pk)));
select pg_temp.ok('the new price is stored and audited', (select price_coins = 900 and price_oreshards = 450 from public.emote_packs where id = (select pack from pk))
  and exists (select 1 from public.admin_audit where action = 'set_cosmetic_price'), 'pack price');
select pg_temp.refused('the Producer frame can''t get a price', :A1, 'aal2', $q$ select public.admin_set_cosmetic_price('frame', 'producer', 10, null, true, 'test') $q$, 'can''t be sold');
select pg_temp.refused('the free emotes can''t get a price', :A1, 'aal2', $q$ select public.admin_set_cosmetic_price('emote_pack', 'free-starter', 10, null, true, 'test') $q$, 'can''t be sold');
select pg_temp.refused('players can''t grant cosmetics', :U1, 'aal1', format('select public.admin_grant_cosmetic(%L, ''frame'', ''producer'', ''Producer'', ''test'')', :U1));
create temp table gr as select pg_temp.json_as(:A1, 'aal2', format('select public.admin_grant_cosmetic(%L, ''frame'', ''producer'', ''Producer'', ''test: producer'')', :U1)) as j;
select pg_temp.ok('admin grants the Producer frame and title; the avatar is untouched',
  exists (select 1 from public.player_cosmetics where user_id = :U1 and kind = 'frame' and item = 'producer' and ref = 'admin')
  and (select title from public.profiles where id = :U1) = 'Producer'
  and exists (select 1 from public.admin_audit where action = 'grant_cosmetic' and target_user = :U1::uuid), (select j::text from gr));
create temp table ac as select pg_temp.json_as(:A1, 'aal2', 'select public.admin_cosmetics()') as j;
select pg_temp.ok('admin_cosmetics lists packs, emotes and the eight frames', (select jsonb_array_length(j -> 'frames') = 8 and jsonb_array_length(j -> 'emote_packs') = 4 from ac), (select left(j::text, 200) from ac));

select n, case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by n;
do $$ declare f int := (select count(*) from results where not ok); t int := (select count(*) from results);
begin
  raise notice '% of % checks passed', t - f, t;
  if f > 0 then raise exception '% check(s) FAILED', f; end if;
end $$;
rollback;

-- Oreheart Online, Phase A: database tests.
-- Run against a LOCAL database only (supabase start, or the local shim), never the real project:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_a_security.test.sql
-- Everything happens in one transaction that is rolled back at the end.
-- Players are simulated exactly like the API does it: role "authenticated"
-- plus JWT claims in request.jwt.claims (sub = user id, aal = aal1 / aal2).
-- Exits with an error (non-zero) if any check fails.

\ir _helpers.sql

-- ---------- test accounts (fixed ids) ----------
-- A1 = Ken's admin, A2 = second admin (banned later), P1/P2 = players, N = sign-up without a username
insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'boss@test.local',   '{"username":"CounterKeeper"}', now()),
  ('a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'boss2@test.local',  '{"username":"SecondKeeper"}', now()),
  ('b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'p1@test.local',     '{"username":"Player_One"}', now()),
  ('b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'p2@test.local',     '{"username":"PlayerTwo"}', now()),
  ('b0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'nouser@test.local', '{}', now());
-- The one SQL line Ken runs (same shape as in ken-setup-steps.md):
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'boss@test.local';
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'boss2@test.local';

\set A1 '''a0000000-0000-4000-8000-000000000001'''
\set P1 '''b0000000-0000-4000-8000-000000000001'''
\set P2 '''b0000000-0000-4000-8000-000000000002'''
\set BONUS '(select (value)::int from public.settings where key = ''signup_bonus_coins'')'

-- ========== 1. Sign-up trigger ==========
select pg_temp.ok('signup: profile made with the chosen username',
  (select username from public.profiles where id = :P1) = 'Player_One');
select pg_temp.ok('signup: wallet holds the signup coins (setting signup_bonus_coins)',
  (select coins from public.wallets where user_id = :P1) = :BONUS);
select pg_temp.ok('signup: one signup_bonus ledger row',
  (select count(*) from public.transactions where user_id = :P1 and reason = 'signup_bonus' and balance_after = delta) = 1);
select pg_temp.ok('signup: one card instance per starter card (359 cards, 60 kinds)',
  (select count(*) from public.card_instances where owner_id = :P1)
    = (select sum(v::int) from jsonb_each_text((select value from public.settings where key = 'starter_collection')) as e(k, v))
  and (select count(distinct card_id) from public.card_instances where owner_id = :P1)
    = (select count(*) from jsonb_object_keys((select value from public.settings where key = 'starter_collection'))));
select pg_temp.ok('signup: every card has its own id, origin starter, first owner = this player',
  (select count(distinct id) = count(*) and bool_and(origin = 'starter' and original_owner_id = :P1 and status = 'owned')
   from public.card_instances where owner_id = :P1));
select pg_temp.ok('signup: one "created" history row per card',
  (select count(*) from public.card_history h join public.card_instances c on c.id = h.card_instance_id
   where c.owner_id = :P1 and h.event = 'created' and h.to_user = :P1)
  = (select count(*) from public.card_instances where owner_id = :P1));
select pg_temp.ok('signup: every starter deck can be built (my_collection counts)',
  (select count(*) from jsonb_each_text((select value from public.settings where key = 'starter_collection')) e(k, v)
   left join pg_temp.collection_of(:P1) c on c.card_id = e.k
   where coalesce(c.count, 0) < e.v::int) = 0);
select pg_temp.ok('signup: 13+ player needs no parent consent',
  (select age_group = '13_plus' and consent_status = 'not_needed' from public.profiles where id = :P1));
select pg_temp.ok('signup: empty player_stats row',
  exists (select 1 from public.player_stats where user_id = :P1 and games = 0));
select pg_temp.ok('signup: no username sent -> player_xxxxxxxx',
  (select username from public.profiles where id = 'b0000000-0000-4000-8000-000000000003') ~ '^player_[0-9a-f]{8}$');

-- Bad usernames stop the sign-up itself.
do $$
declare
  bad text[] := array['ab', 'way_too_long_name_17', 'has space', 'Grubnak', 'GRUBNAK', 'xxAdminxx', 'Oreheart_Fan',
                      'sh1tlord', 'F_u_c_k', 'player_one', 'PLAYERTWO'];
  nm text; err text;
begin
  foreach nm in array bad loop
    err := null;
    begin
      insert into auth.users (id, aud, role, email, raw_user_meta_data)
        values (gen_random_uuid(), 'authenticated', 'authenticated', 'bad_' || md5(nm) || '@test.local', jsonb_build_object('username', nm));
    exception when others then err := sqlerrm;
    end;
    perform pg_temp.ok('signup refused for username "' || nm || '"', err ilike 'username:%', coalesce(err, 'was accepted'));
  end loop;
end $$;

select pg_temp.ok('username_available works for anon (sign-up form) and says taken',
  pg_temp.json_as(null, null, $q$ select public.username_available('PLAYER_ONE') $q$) ->> 'problem' = 'That name is taken.');
select pg_temp.ok('username_available ok for a free name',
  (pg_temp.json_as(null, null, $q$ select public.username_available('Mossy_Gnome') $q$) ->> 'ok')::boolean);

-- ========== 2. A normal player calling the API directly can't change anything ==========
select pg_temp.refused('player cannot set own coins', :P1, 'aal1',
  $q$ update public.wallets set coins = 999999 where user_id = 'b0000000-0000-4000-8000-000000000001' $q$);
select pg_temp.refused('player cannot set own coins even with 2-step', :P1, 'aal2',
  $q$ update public.wallets set coins = 999999 $q$);
select pg_temp.refused('player cannot add a wallet row', :P1, 'aal1',
  $q$ insert into public.wallets (user_id, coins) values ('b0000000-0000-4000-8000-000000000001', 5) $q$);
select pg_temp.refused('player cannot write ledger rows', :P1, 'aal1',
  $q$ insert into public.transactions (user_id, delta, reason, idem_key, balance_after)
      values ('b0000000-0000-4000-8000-000000000001', 1000, 'admin_grant', 'hack-12345', 1300) $q$);
select pg_temp.refused('player cannot delete ledger rows', :P1, 'aal1',
  $q$ delete from public.transactions $q$);
select pg_temp.refused('player cannot call the coin function', :P1, 'aal1',
  $q$ select private.ledger_apply('b0000000-0000-4000-8000-000000000001', 1000, 'admin_grant', null, 'hack-123456', null) $q$);
select pg_temp.refused('player cannot grant coins (admin door)', :P1, 'aal2',
  $q$ select public.admin_grant_coins('b0000000-0000-4000-8000-000000000001', 1000, 'free money', 'hack-1234567') $q$, 'not admin');
select pg_temp.refused('player cannot make themself admin', :P1, 'aal2',
  $q$ insert into public.roles (user_id, role) values ('b0000000-0000-4000-8000-000000000001', 'admin') $q$);
select pg_temp.refused('player cannot read roles', :P1, 'aal1',
  $q$ select * from public.roles $q$);
select pg_temp.refused('player cannot change roles', :P1, 'aal2',
  $q$ update public.roles set user_id = 'b0000000-0000-4000-8000-000000000001' $q$);
select pg_temp.refused('player cannot call assert_admin', :P1, 'aal2',
  $q$ select private.assert_admin() $q$);
select pg_temp.refused('player cannot rename themself directly', :P1, 'aal1',
  $q$ update public.profiles set username = 'Grubnak' $q$);
select pg_temp.refused('player cannot set own flags', :P1, 'aal1',
  $q$ update public.profiles set flags = '{"early_adopter":true}' $q$);
select pg_temp.refused('player cannot read card instances (back end only)', :P1, 'aal1',
  $q$ select * from public.card_instances $q$);
select pg_temp.refused('player cannot read card history', :P1, 'aal1',
  $q$ select * from public.card_history $q$);
select pg_temp.refused('player cannot take another player''s card', :P1, 'aal2',
  $q$ update public.card_instances set owner_id = 'b0000000-0000-4000-8000-000000000001' $q$);
select pg_temp.refused('player cannot make cards', :P1, 'aal1',
  $q$ insert into public.card_instances (card_id, owner_id, original_owner_id, origin)
      values ('fizzle', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'starter') $q$);
select pg_temp.refused('player cannot write card history', :P1, 'aal1',
  $q$ insert into public.card_history (card_instance_id, event, to_user)
      select id, 'transferred', 'b0000000-0000-4000-8000-000000000001' from public.card_instances limit 1 $q$);
select pg_temp.refused('player cannot call the card transfer function', :P1, 'aal1',
  $q$ select private.card_transfer(gen_random_uuid(), null, 'b0000000-0000-4000-8000-000000000001', 'gift me', null, null) $q$);
select pg_temp.refused('player cannot call the card grant function', :P1, 'aal1',
  $q$ select private.card_grant('b0000000-0000-4000-8000-000000000001', 'fizzle', 50, 'admin_grant', null, null) $q$);
select pg_temp.refused('player cannot read parent consents / email outbox', :P1, 'aal1',
  $q$ select * from public.parental_consents union all select null from public.email_outbox $q$);
select pg_temp.refused('player cannot set own consent status', :P1, 'aal1',
  $q$ update public.profiles set consent_status = 'approved' $q$);
select pg_temp.refused('player cannot set money spent / stats', :P1, 'aal1',
  $q$ update public.player_stats set money_spent_cents = 100000 $q$);
select pg_temp.refused('player cannot write ratings', :P1, 'aal1',
  $q$ insert into public.player_ratings (user_id, season_id) values ('b0000000-0000-4000-8000-000000000001', '2027-Q1') $q$);
select pg_temp.refused('player cannot write a deck directly', :P1, 'aal1',
  $q$ insert into public.decks (user_id, name, cards) values ('b0000000-0000-4000-8000-000000000001', 'x', '{}') $q$);
select pg_temp.refused('player cannot write bans', :P1, 'aal1',
  $q$ insert into public.bans (user_id, reason) values ('b0000000-0000-4000-8000-000000000002', 'mean') $q$);
select pg_temp.refused('player cannot read the audit table', :P1, 'aal2',
  $q$ select * from public.admin_audit $q$);
select pg_temp.refused('player cannot write the audit table', :P1, 'aal2',
  $q$ insert into public.admin_audit (admin_id, action, reason) values ('b0000000-0000-4000-8000-000000000001', 'x', 'xyz') $q$);
select pg_temp.refused('player cannot read settings', :P1, 'aal1',
  $q$ select * from public.settings $q$);
select pg_temp.refused('player cannot change settings', :P1, 'aal1',
  $q$ update public.settings set value = '99999' where key = 'signup_bonus_coins' $q$);

-- P2 saves a deck, P1 tries to touch it.
select pg_temp.works('player 2 saves a deck through save_deck', :P2, 'aal1',
  $q$ select public.save_deck(null, 'Two''s Deck', 'borgo', array['dwarf-miner','dwarf-miner','fizzle']) $q$);
select pg_temp.refused('player cannot edit another player''s deck directly', :P1, 'aal1',
  $q$ update public.decks set name = 'mine now' where user_id = 'b0000000-0000-4000-8000-000000000002' $q$);
select pg_temp.refused('player cannot delete another player''s deck directly', :P1, 'aal1',
  $q$ delete from public.decks where user_id = 'b0000000-0000-4000-8000-000000000002' $q$);
do $$ declare did uuid := (select id from public.decks where user_id = 'b0000000-0000-4000-8000-000000000002' limit 1);
begin
  perform pg_temp.refused('player cannot overwrite another player''s deck via save_deck', 'b0000000-0000-4000-8000-000000000001', 'aal1',
    format($q$ select public.save_deck(%L, 'stolen', null, array['fizzle']) $q$, did), 'deck not found');
  perform pg_temp.refused('player cannot delete another player''s deck via delete_deck', 'b0000000-0000-4000-8000-000000000001', 'aal1',
    format($q$ select public.delete_deck(%L) $q$, did), 'deck not found');
end $$;
select pg_temp.ok('player 2''s deck is untouched',
  (select name from public.decks where user_id = :P2) = 'Two''s Deck');
select pg_temp.ok('nobody''s coins changed',
  (select coins from public.wallets where user_id = :P2) = :BONUS and (select coins from public.wallets where user_id = :P1) = :BONUS);
select pg_temp.ok('nobody became admin', (select count(*) from public.roles) = 2);

-- Reading: own rows only.
select pg_temp.ok('player sees only own profile', pg_temp.count_as(:P1, 'aal1', 'select * from public.profiles') = 1);
select pg_temp.ok('player sees no other player''s decks', pg_temp.count_as(:P1, 'aal1',
  $q$ select * from public.decks where user_id = 'b0000000-0000-4000-8000-000000000002' $q$) = 0);
select pg_temp.ok('player sees only own wallet', pg_temp.count_as(:P1, 'aal1', 'select * from public.wallets') = 1);
select pg_temp.ok('player sees only own ledger', pg_temp.count_as(:P1, 'aal1',
  $q$ select * from public.transactions where user_id <> 'b0000000-0000-4000-8000-000000000001' $q$) = 0);
select pg_temp.ok('my_collection gives the player''s own counts (60 kinds) and no card ids',
  (select count(*) from pg_temp.collection_of(:P1)) = 60
  and (select sum(count) from pg_temp.collection_of(:P1)) = (select count(*) from public.card_instances where owner_id = :P1));
select pg_temp.ok('anon cannot call my_collection', pg_temp.count_as(null, null, 'select * from public.my_collection()') = -1);
select pg_temp.ok('player cannot read emails (auth.users)', pg_temp.count_as(:P1, 'aal1', 'select * from auth.users') <= 0);
select pg_temp.ok('anon reads nothing: profiles', pg_temp.count_as(null, null, 'select * from public.profiles') = -1);
select pg_temp.ok('anon reads nothing: wallets', pg_temp.count_as(null, null, 'select * from public.wallets') = -1);
select pg_temp.ok('anon reads nothing: decks', pg_temp.count_as(null, null, 'select * from public.decks') = -1);
select pg_temp.refused('anon cannot call my_status', null, null, $q$ select public.my_status() $q$);
select pg_temp.refused('anon cannot save decks', null, null, $q$ select public.save_deck(null, 'x', null, '{}') $q$);
select pg_temp.refused('anon cannot list players', null, null, $q$ select * from public.admin_list_players('', 1, 25) $q$);

-- ========== 3. Player doors work and check their input ==========
select pg_temp.ok('my_status gives username, coins, needs_avatar, not banned',
  (select s ->> 'username' = 'Player_One' and (s ->> 'needs_avatar')::boolean and not (s ->> 'banned')::boolean
          and (s ->> 'coins')::int = :BONUS
   from pg_temp.json_as(:P1, 'aal1', 'select public.my_status()') s));
select pg_temp.works('set_avatar accepts card art', :P1, 'aal1', $q$ select public.set_avatar('goblin-scrounger') $q$);
select pg_temp.refused('set_avatar refuses anything else', :P1, 'aal1', $q$ select public.set_avatar('../../evil') $q$);
select pg_temp.ok('avatar stored', (select avatar from public.profiles where id = :P1) = 'goblin-scrounger');

select pg_temp.works('save_deck: new deck', :P1, 'aal1',
  $q$ select public.save_deck(null, 'Junk Rush', 'grubnak', array['goblin-scrounger','goblin-scrounger','fizzle']) $q$);
do $$ declare did uuid := (select id from public.decks where user_id = 'b0000000-0000-4000-8000-000000000001' and name = 'Junk Rush');
begin
  perform pg_temp.works('save_deck: update own deck', 'b0000000-0000-4000-8000-000000000001', 'aal1',
    format($q$ select public.save_deck(%L, 'Junk Rush 2', 'grubnak', array['goblin-scrounger']) $q$, did));
end $$;
select pg_temp.ok('save_deck: update kept one deck with the new name',
  (select count(*) from public.decks where user_id = :P1) = 1
  and exists (select 1 from public.decks where user_id = :P1 and name = 'Junk Rush 2'));
select pg_temp.refused('save_deck: unknown card refused', :P1, 'aal1',
  $q$ select public.save_deck(null, 'Fake', null, array['super-dragon-9000']) $q$, 'Unknown card');
select pg_temp.refused('save_deck: unknown commander refused', :P1, 'aal1',
  $q$ select public.save_deck(null, 'Fake', 'emperor', array['fizzle']) $q$, 'Unknown commander');
select pg_temp.refused('save_deck: more than 100 cards refused', :P1, 'aal1',
  $q$ select public.save_deck(null, 'Huge', null, array_fill('fizzle'::text, array[101])) $q$, 'Too many cards');
select pg_temp.refused('save_deck: empty name refused', :P1, 'aal1',
  $q$ select public.save_deck(null, '   ', null, array['fizzle']) $q$, 'Deck name');
do $$ begin
  for i in 1..29 loop
    perform pg_temp.act_as('b0000000-0000-4000-8000-000000000001', 'aal1');
    perform public.save_deck(null, 'Deck ' || i, null, array['fizzle']);
    perform pg_temp.back();
  end loop;
end $$;
select pg_temp.refused('save_deck: deck 31 refused (max 30)', :P1, 'aal1',
  $q$ select public.save_deck(null, 'One too many', null, array['fizzle']) $q$, 'at most 30');

-- One-time import of local decks (P2 already has 1 deck).
select pg_temp.ok('import_local_decks: good decks in, bad ones skipped with a reason',
  (select (r ->> 'imported')::int = 2 and jsonb_array_length(r -> 'skipped') = 2
   from pg_temp.json_as(:P2, 'aal1', $q$ select public.import_local_decks(
     '[{"name":"Old Gnomes","commander":"sproingle","cards":["gnome-prospector","fizzle"]},
       {"name":"Old Dwarves","cards":["dwarf-miner"]},
       {"name":"Cheater","cards":["not-a-card"]},
       {"name":"","cards":["fizzle"]}]'::jsonb) $q$) r));
select pg_temp.ok('imported decks are marked "imported"',
  (select count(*) from public.decks where user_id = :P2 and source = 'imported') = 2);
select pg_temp.refused('import_local_decks runs only once', :P2, 'aal1',
  $q$ select public.import_local_decks('[{"name":"Again","cards":["fizzle"]}]'::jsonb) $q$, 'already imported');

-- ========== 4. Admin doors: role + 2-step + reason + audit ==========
select pg_temp.refused('admin without 2-step (aal1) refused: list', :A1, 'aal1',
  $q$ select * from public.admin_list_players('', 1, 25) $q$, '2-step');
select pg_temp.refused('admin without 2-step (aal1) refused: grant', :A1, 'aal1',
  $q$ select public.admin_grant_coins('b0000000-0000-4000-8000-000000000001', 10, 'test grant', 'idem-aal1-0001') $q$, '2-step');
select pg_temp.refused('admin without 2-step (aal1) refused: ban', :A1, 'aal1',
  $q$ select public.admin_ban('b0000000-0000-4000-8000-000000000001', 'test ban', null) $q$, '2-step');
select pg_temp.refused('admin without 2-step (aal1) refused: audit log', :A1, 'aal1',
  $q$ select * from public.admin_audit_log(1, 50, null) $q$, '2-step');
select pg_temp.refused('non-admin WITH 2-step refused: list', :P1, 'aal2',
  $q$ select * from public.admin_list_players('', 1, 25) $q$, 'not admin');
select pg_temp.refused('non-admin WITH 2-step refused: player page', :P1, 'aal2',
  $q$ select public.admin_player_detail('b0000000-0000-4000-8000-000000000002') $q$, 'not admin');
select pg_temp.refused('non-admin WITH 2-step refused: audit log', :P1, 'aal2',
  $q$ select * from public.admin_audit_log(1, 50, null) $q$, 'not admin');
select pg_temp.refused('non-admin WITH 2-step refused: ban', :P1, 'aal2',
  $q$ select public.admin_ban('b0000000-0000-4000-8000-000000000002', 'i do not like you', null) $q$, 'not admin');
select pg_temp.refused('non-admin WITH 2-step refused: unban', :P1, 'aal2',
  $q$ select public.admin_unban('b0000000-0000-4000-8000-000000000001', 'let me out') $q$, 'not admin');
select pg_temp.ok('am_i_admin: true for admin, false for player',
  (pg_temp.json_as(:A1, 'aal1', 'select public.am_i_admin()') ->> 'admin')::boolean
  and not (pg_temp.json_as(:P1, 'aal2', 'select public.am_i_admin()') ->> 'admin')::boolean);

select pg_temp.ok('admin (aal2) lists all players',
  pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_list_players('', 1, 100) $q$) = (select count(*) from public.profiles));
select pg_temp.ok('admin search by username and by email',
  pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_list_players('player_o', 1, 25) $q$) = 1
  and pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_list_players('p2@test', 1, 25) $q$) = 1);
select pg_temp.ok('admin paging: page 2 of size 2 gives 2 rows',
  pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_list_players('', 2, 2) $q$) = 2);
select pg_temp.ok('admin player page: email, decks, coin history',
  (select d ->> 'email' = 'p2@test.local' and jsonb_array_length(d -> 'decks') = 3 and jsonb_array_length(d -> 'transactions') = 1
   from pg_temp.json_as(:A1, 'aal2', $q$ select public.admin_player_detail('b0000000-0000-4000-8000-000000000002') $q$) d));

-- Grant coins
select pg_temp.refused('grant needs a reason', :A1, 'aal2',
  $q$ select public.admin_grant_coins('b0000000-0000-4000-8000-000000000001', 50, '  ', 'idem-grant-0001') $q$, 'reason');
select pg_temp.refused('grant of 0 refused', :A1, 'aal2',
  $q$ select public.admin_grant_coins('b0000000-0000-4000-8000-000000000001', 0, 'nothing', 'idem-grant-0002') $q$, 'amount');
select pg_temp.works('grant 50 coins with a reason', :A1, 'aal2',
  $q$ select public.admin_grant_coins('b0000000-0000-4000-8000-000000000001', 50, 'tournament prize', 'idem-grant-0003') $q$);
select pg_temp.works('same click sent twice (same idem key)', :A1, 'aal2',
  $q$ select public.admin_grant_coins('b0000000-0000-4000-8000-000000000001', 50, 'tournament prize', 'idem-grant-0003') $q$);
select pg_temp.ok('coins went up by 50 exactly once',
  (select coins from public.wallets where user_id = :P1) = :BONUS + 50);
select pg_temp.ok('grant audit row has before/after coins, admin and reason',
  (select count(*) from public.admin_audit where action = 'grant_coins' and target_user = :P1
     and admin_id = :A1 and reason = 'tournament prize'
     and (before ->> 'coins')::int + 50 = (after ->> 'coins')::int) = 1);
select pg_temp.refused('taking more coins than the player has is refused', :A1, 'aal2',
  $q$ select public.admin_grant_coins('b0000000-0000-4000-8000-000000000001', -100000, 'oops', 'idem-grant-0004') $q$, 'not enough coins');

-- Ban / unban
select pg_temp.refused('ban needs a reason', :A1, 'aal2',
  $q$ select public.admin_ban('b0000000-0000-4000-8000-000000000001', '', null) $q$, 'reason');
select pg_temp.refused('admin cannot ban themself', :A1, 'aal2',
  $q$ select public.admin_ban('a0000000-0000-4000-8000-000000000001', 'testing', null) $q$, 'yourself');
select pg_temp.refused('ban end date in the past refused', :A1, 'aal2',
  $q$ select public.admin_ban('b0000000-0000-4000-8000-000000000001', 'rude chat', now() - interval '1 day') $q$, 'future');
select pg_temp.works('ban player 1 for 7 days', :A1, 'aal2',
  $q$ select public.admin_ban('b0000000-0000-4000-8000-000000000001', 'rude chat', now() + interval '7 days') $q$);
select pg_temp.refused('banned player cannot save a deck', :P1, 'aal1',
  $q$ select public.save_deck(null, 'Sneaky', null, array['fizzle']) $q$, 'banned until');
select pg_temp.refused('banned player cannot delete a deck', :P1, 'aal1',
  $q$ select public.delete_deck((select id from public.decks limit 1)) $q$, 'banned until');
select pg_temp.refused('banned player cannot change avatar', :P1, 'aal1',
  $q$ select public.set_avatar('fizzle') $q$, 'banned until');
select pg_temp.ok('banned player''s my_status shows banned + end date',
  (select (s ->> 'banned')::boolean and (s ->> 'ban_expires_at') is not null
   from pg_temp.json_as(:P1, 'aal1', 'select public.my_status()') s));
select pg_temp.ok('banned player can read own ban row (for the message)',
  pg_temp.count_as(:P1, 'aal1', 'select * from public.bans') = 1);
select pg_temp.ok('admin list shows the ban',
  pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_list_players('player_one', 1, 25) where banned $q$) = 1);
select pg_temp.ok('ban audit row: before = not banned, after = the ban',
  (select count(*) from public.admin_audit where action = 'ban' and target_user = :P1
     and before = '{"banned": false}'::jsonb and after ->> 'reason' = 'rude chat') = 1);
select pg_temp.refused('admin cannot ban another admin', :A1, 'aal2',
  $q$ select public.admin_ban('a0000000-0000-4000-8000-000000000002', 'testing', null) $q$, 'admins');
select pg_temp.refused('unban needs a reason', :A1, 'aal2',
  $q$ select public.admin_unban('b0000000-0000-4000-8000-000000000001', null) $q$, 'reason');
select pg_temp.works('unban player 1', :A1, 'aal2',
  $q$ select public.admin_unban('b0000000-0000-4000-8000-000000000001', 'said sorry') $q$);
select pg_temp.ok('unban audit row: before = active ban, after = lifted',
  (select count(*) from public.admin_audit where action = 'unban' and target_user = :P1
     and before ->> 'lifted_at' is null and after ->> 'lifted_at' is not null and reason = 'said sorry') = 1);
select pg_temp.ok('ban history kept after unban', (select count(*) from public.bans where user_id = :P1) = 1);
select pg_temp.works('unbanned player can save again', :P1, 'aal1',
  $q$ select public.delete_deck((select id from public.decks where name = 'Deck 1' and user_id = 'b0000000-0000-4000-8000-000000000001')),
            public.save_deck(null, 'Back again', null, array['fizzle']) $q$);
-- An expired ban no longer blocks.
insert into public.bans (user_id, reason, created_at, expires_at)
  values (:P2, 'old ban', now() - interval '10 days', now() - interval '3 days');
select pg_temp.works('expired ban does not block', :P2, 'aal1',
  $q$ select public.save_deck(null, 'After old ban', null, array['fizzle']) $q$);
-- A banned admin loses the admin doors.
insert into public.bans (user_id, reason) values ('a0000000-0000-4000-8000-000000000002', 'lost phone, locked for safety');
select pg_temp.refused('banned admin is refused', 'a0000000-0000-4000-8000-000000000002', 'aal2',
  $q$ select * from public.admin_list_players('', 1, 25) $q$, 'not admin');

select pg_temp.ok('audit log page shows every grant, ban and unban (3)',
  pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_audit_log(1, 50, null) $q$) = 3);
select pg_temp.ok('audit log filter by player',
  pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_audit_log(1, 50, 'b0000000-0000-4000-8000-000000000002') $q$) = 0
  and pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_audit_log(1, 50, 'b0000000-0000-4000-8000-000000000001') $q$) = 3);

-- ========== 4b. Card tracing (ids, first owner, history; ready for trading) ==========
do $$ declare cid uuid := (select id from public.card_instances where owner_id = 'b0000000-0000-4000-8000-000000000001' and card_id = 'fizzle' order by id limit 1);
       err text;
begin
  -- A trade, done by the server (players can't call this).
  perform private.card_transfer(cid, 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'trade test', 'trade:1', null);
  begin
    perform private.card_transfer(cid, 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'double spend', 'trade:2', null);
  exception when others then err := sqlerrm;
  end;
  perform pg_temp.ok('a card can''t be traded twice by its old owner', err ilike '%not owned by the sender%', coalesce(err, 'moved again!'));
  perform private.card_transfer(cid, 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'trade test 2', 'trade:3', null);
end $$;
select pg_temp.ok('traded card: new owner, first owner kept',
  (select owner_id = 'b0000000-0000-4000-8000-000000000003' and original_owner_id = :P1 and origin = 'starter'
   from public.card_instances where id = (select card_instance_id from public.card_history where ref = 'trade:1')));
select pg_temp.ok('admin card lookup: full history (created + 2 trades) with names',
  (select jsonb_array_length(r -> 'history') = 3 and r ->> 'original_owner_name' = 'Player_One'
          and r -> 'history' -> 1 ->> 'from_name' = 'Player_One' and r -> 'history' -> 1 ->> 'to_name' = 'PlayerTwo'
          and r -> 'history' -> 2 ->> 'to_user' = 'b0000000-0000-4000-8000-000000000003'
   from pg_temp.json_as(:A1, 'aal2', format('select public.admin_card_lookup(%L)',
          (select card_instance_id from public.card_history where ref = 'trade:1'))) r));
select pg_temp.ok('admin player cards: lists a player''s card ids, filter by card',
  pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_player_cards('b0000000-0000-4000-8000-000000000001', 'fizzle', 1, 500) $q$)
    = (select count(*) from public.card_instances where owner_id = :P1 and card_id = 'fizzle')
  and pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_player_cards('b0000000-0000-4000-8000-000000000003', null, 1, 500) where original_owner_id <> 'b0000000-0000-4000-8000-000000000003' $q$) = 1);
select pg_temp.refused('non-admin cannot look up a card', :P1, 'aal2',
  $q$ select public.admin_card_lookup(gen_random_uuid()) $q$, 'not admin');
select pg_temp.refused('admin without 2-step cannot look up a card', :A1, 'aal1',
  $q$ select public.admin_card_lookup(gen_random_uuid()) $q$, '2-step');

-- ========== 4c. Rename + editable word lists + settings ==========
select pg_temp.refused('rename needs a reason', :A1, 'aal2',
  $q$ select public.admin_rename_player('b0000000-0000-4000-8000-000000000002', 'Mossy_Gnome', '') $q$, 'reason');
select pg_temp.refused('rename to a taken name refused', :A1, 'aal2',
  $q$ select public.admin_rename_player('b0000000-0000-4000-8000-000000000002', 'PLAYER_ONE', 'test') $q$, 'taken');
select pg_temp.refused('rename to a reserved name refused', :A1, 'aal2',
  $q$ select public.admin_rename_player('b0000000-0000-4000-8000-000000000002', 'Grubnak', 'test') $q$, 'reserved');
select pg_temp.refused('player cannot rename anyone via the admin door', :P2, 'aal2',
  $q$ select public.admin_rename_player('b0000000-0000-4000-8000-000000000002', 'Mossy_Gnome', 'mine') $q$, 'not admin');
select pg_temp.works('admin renames player 2 with a reason', :A1, 'aal2',
  $q$ select public.admin_rename_player('b0000000-0000-4000-8000-000000000002', 'Mossy_Gnome', 'old name was rude') $q$);
select pg_temp.ok('rename stored + audit row before/after',
  (select username from public.profiles where id = :P2) = 'Mossy_Gnome'
  and (select count(*) from public.admin_audit where action = 'rename' and target_user = :P2
         and before ->> 'username' = 'PlayerTwo' and after ->> 'username' = 'Mossy_Gnome' and reason = 'old name was rude') = 1);
select pg_temp.ok('a rename keeps the same player id (decks and cards follow)',
  (select count(*) from public.decks where user_id = :P2) = 4
  and pg_temp.json_as(:P2, 'aal1', 'select public.my_status()') ->> 'username' = 'Mossy_Gnome');

select pg_temp.ok('"Bogwart" is allowed before the list changes',
  (pg_temp.json_as(null, null, $q$ select public.username_available('Bogwart_King') $q$) ->> 'ok')::boolean);
select pg_temp.refused('word list: non-admin refused', :P1, 'aal2',
  $q$ select public.admin_set_setting('blocked_words', '["bogwart"]', 'test') $q$, 'not admin');
select pg_temp.refused('word list: admin without 2-step refused', :A1, 'aal1',
  $q$ select public.admin_set_setting('blocked_words', '["bogwart"]', 'test') $q$, '2-step');
select pg_temp.refused('word list: entries with spaces/digits refused', :A1, 'aal2',
  $q$ select public.admin_set_setting('blocked_words', '["fine", "bad word 2"]', 'test') $q$, 'not allowed');
select pg_temp.refused('word list: needs a reason', :A1, 'aal2',
  $q$ select public.admin_set_setting('blocked_words', '["bogwart"]', null) $q$, 'reason');
select pg_temp.works('word list: admin adds "Bogwart" (keeps the old words)', :A1, 'aal2',
  format($q$ select public.admin_set_setting('blocked_words', %L::jsonb || '["  BogWart "]'::jsonb, 'kids complained') $q$,
         (select value::text from public.settings where key = 'blocked_words')));
select pg_temp.ok('word list: new word blocks names at once, stored cleaned (lowercase, trimmed)',
  pg_temp.json_as(null, null, $q$ select public.username_available('Bogwart_King') $q$) ->> 'problem' = 'Please pick a different name.'
  and (select value ? 'bogwart' from public.settings where key = 'blocked_words'));
select pg_temp.ok('word list: change is audited with before/after',
  (select count(*) from public.admin_audit where action = 'set_setting' and after ->> 'key' = 'blocked_words'
     and not (before -> 'value') ? 'bogwart' and (after -> 'value') ? 'bogwart') = 1);
select pg_temp.ok('admin_get_settings shows the editable settings + server kind (read-only)',
  (select r ? 'signup_bonus_coins' and r ? 'blocked_words' and (r -> 'server_kind' ->> 'read_only')::boolean
   from pg_temp.json_as(:A1, 'aal2', 'select public.admin_get_settings()') r));
select pg_temp.refused('sign-up coins must be a whole number 0-100000', :A1, 'aal2',
  $q$ select public.admin_set_setting('signup_bonus_coins', '-5', 'test') $q$, '0 to 100000');
select pg_temp.works('admin changes sign-up coins to 250', :A1, 'aal2',
  $q$ select public.admin_set_setting('signup_bonus_coins', '250', 'pack prices decided') $q$);
insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('b0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'p4@test.local', '{"username":"LateJoiner"}', now());
select pg_temp.ok('a new player gets the new sign-up coins (250)',
  (select coins from public.wallets where user_id = 'b0000000-0000-4000-8000-000000000004') = 250);
select pg_temp.refused('server kind can''t be changed from the back counter', :A1, 'aal2',
  $q$ select public.admin_set_setting('server_kind', '"production"', 'sneaky') $q$, 'can''t be changed');
select pg_temp.refused('unknown settings can''t be changed', :A1, 'aal2',
  $q$ select public.admin_set_setting('card_ids', '[]', 'oops') $q$, 'can''t be changed');
-- ========== 4d. Test vs production server ==========
select pg_temp.ok('a fresh database says it is a TEST server (anyone can ask)',
  pg_temp.json_as(null, null, 'select public.server_info()') ->> 'server_kind' = 'test');
update public.settings set value = '"production"' where key = 'server_kind';   -- Ken's one line on the real project
select pg_temp.ok('after Ken''s line it says production',
  pg_temp.json_as(null, null, 'select public.server_info()') ->> 'server_kind' = 'production');
update public.settings set value = '"test"' where key = 'server_kind';

-- ========== 4e. Money spent (filled in Phase D) ==========
select pg_temp.ok('admin list and player page show money spent (0 for now)',
  (select bool_and(money_spent_cents = 0) from public.player_stats)
  and pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_list_players('', 1, 100) where money_spent_cents = 0 $q$) = (select count(*) from public.profiles)
  and (pg_temp.json_as(:A1, 'aal2', $q$ select public.admin_player_detail('b0000000-0000-4000-8000-000000000001') $q$) ->> 'money_spent_cents')::int = 0);

-- ========== 4f. Under-13 players: nothing online until a parent approves ==========
\set KID '''c0000000-0000-4000-8000-000000000001'''
insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('c0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'parent@test.local', '{"username":"TinyTinker","age_group":"under_13"}', now()),
  ('c0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'parent2@test.local', '{"username":"SmallSprocket","age_group":"under_13"}', now());
create temp table kid_tokens as
  select user_id, kind, payload ->> 'token' as token from public.email_outbox where kind = 'parent_consent_request';
grant select on kid_tokens to public;
select pg_temp.ok('under-13 sign-up: account waits for a parent, cards still made',
  (select age_group = 'under_13' and consent_status = 'pending' from public.profiles where id = :KID)
  and (select count(*) from public.card_instances where owner_id = :KID) > 0);
select pg_temp.ok('under-13 sign-up: consent request email queued to the parent (account email), token not stored in clear',
  (select count(*) from public.email_outbox where user_id = :KID and kind = 'parent_consent_request' and to_email = 'parent@test.local') = 1
  and (select request_token_hash = private.sha((select token from kid_tokens where user_id = :KID)) and status = 'pending'
       from public.parental_consents where user_id = :KID)
  and not exists (select 1 from public.parental_consents where request_token_hash = (select token from kid_tokens where user_id = :KID)));
select pg_temp.ok('under-13: my_status says waiting for a parent',
  pg_temp.json_as(:KID, 'aal1', 'select public.my_status()') ->> 'consent_status' = 'pending');
select pg_temp.refused('under-13 before approval: cannot save a deck', :KID, 'aal1',
  $q$ select public.save_deck(null, 'x', null, array['fizzle']) $q$, 'waiting for a parent');
select pg_temp.refused('under-13 before approval: cannot set an avatar', :KID, 'aal1',
  $q$ select public.set_avatar('fizzle') $q$, 'waiting for a parent');
select pg_temp.refused('under-13: the child cannot approve themself without the email link', :KID, 'aal1',
  $q$ select public.parent_give_consent('0000000000000000000000000000000000000000000000000000000000000000', true) $q$, 'not valid');
select pg_temp.refused('under-13: can''t resend more than once per 10 minutes', :KID, 'aal1',
  $q$ select public.resend_parent_consent() $q$, 'wait');
select pg_temp.ok('consent page info shows only the username',
  (select r ->> 'status' = 'pending' and r ->> 'username' = 'TinyTinker' and not r ? 'parent_email'
   from pg_temp.json_as(null, null, format('select public.parent_consent_info(%L)', (select token from kid_tokens where user_id = :KID))) r));
select pg_temp.refused('parent must tick "I agree"', null, null,
  format($q$ select public.parent_give_consent(%L, false) $q$, (select token from kid_tokens where user_id = 'c0000000-0000-4000-8000-000000000001')), 'consent not given');
select pg_temp.works('parent approves from the email link (no login needed)', null, null,
  format($q$ select public.parent_give_consent(%L, true) $q$, (select token from kid_tokens where user_id = 'c0000000-0000-4000-8000-000000000001')));
select pg_temp.ok('approved: status, time, event and the "plus" confirmation email with a withdraw link',
  (select status = 'approved' and approved_at is not null and request_token_hash is null and revoke_token_hash is not null
   from public.parental_consents where user_id = :KID)
  and (select consent_status from public.profiles where id = :KID) = 'approved'
  and exists (select 1 from public.consent_events where user_id = :KID and event = 'approved')
  and (select count(*) from public.email_outbox where user_id = :KID and kind = 'parent_consent_confirmed' and payload ? 'revoke_token') = 1);
select pg_temp.refused('the approval link works only once', null, null,
  format($q$ select public.parent_give_consent(%L, true) $q$, (select token from kid_tokens where user_id = 'c0000000-0000-4000-8000-000000000001')), 'not valid');
select pg_temp.works('approved child can save a deck', :KID, 'aal1',
  $q$ select public.save_deck(null, 'Hi I am Sam Smith from Ohio', 'grubnak', array['fizzle']) $q$);
select pg_temp.ok('under-13 decks get plain names (no free text kept)',
  (select array_agg(name) from public.decks where user_id = :KID) = array['Deck 1']);
select pg_temp.works('parent withdraws from the confirmation email', null, null,
  format($q$ select public.parent_revoke_consent(%L) $q$,
         (select payload ->> 'revoke_token' from public.email_outbox where user_id = 'c0000000-0000-4000-8000-000000000001' and kind = 'parent_consent_confirmed')));
select pg_temp.refused('after withdrawal the child can''t save', :KID, 'aal1',
  $q$ select public.save_deck(null, 'x', null, array['fizzle']) $q$, 'withdrew');
select pg_temp.ok('withdrawal: event + email to parent',
  exists (select 1 from public.consent_events where user_id = :KID and event = 'revoked')
  and exists (select 1 from public.email_outbox where user_id = :KID and kind = 'parent_consent_revoked'));
-- Second child: an expired link, then a resend.
update public.parental_consents set request_expires_at = now() - interval '1 minute', request_sent_at = now() - interval '8 days'
  where user_id = 'c0000000-0000-4000-8000-000000000002';
select pg_temp.refused('an expired link is refused', null, null,
  format($q$ select public.parent_give_consent(%L, true) $q$, (select token from kid_tokens where user_id = 'c0000000-0000-4000-8000-000000000002')), 'expired');
select pg_temp.works('child sends the parent email again', 'c0000000-0000-4000-8000-000000000002', 'aal1',
  $q$ select public.resend_parent_consent() $q$);
select pg_temp.ok('resend: new token works, old one doesn''t',
  (select count(*) from public.email_outbox where user_id = 'c0000000-0000-4000-8000-000000000002' and kind = 'parent_consent_request') = 2
  and pg_temp.json_as(null, null, format('select public.parent_consent_info(%L)', (select token from kid_tokens where user_id = 'c0000000-0000-4000-8000-000000000002'))) ->> 'status' = 'invalid'
  and pg_temp.json_as(null, null, format('select public.parent_consent_info(%L)',
        (select payload ->> 'token' from public.email_outbox where user_id = 'c0000000-0000-4000-8000-000000000002' and kind = 'parent_consent_request' order by id desc limit 1))) ->> 'status' = 'pending');
select pg_temp.ok('admin list shows age group and consent state',
  pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_list_players('', 1, 100) where age_group = 'under_13' and
       ((username = 'TinyTinker' and consent_status = 'revoked') or (username = 'SmallSprocket' and consent_status = 'pending')) $q$) = 2);
select pg_temp.ok('admin player page shows consent status, parent email and events (never the tokens)',
  (select r -> 'consent' ->> 'status' = 'pending' and r -> 'consent' ->> 'parent_email' = 'parent2@test.local'
          and jsonb_array_length(r -> 'consent_events') = 2 and not (r -> 'consent') ? 'request_token_hash' and position('token' in r::text) = 0
   from pg_temp.json_as(:A1, 'aal2', $q$ select public.admin_player_detail('c0000000-0000-4000-8000-000000000002') $q$) r));
select pg_temp.works('admin withdraws an approval with a reason (parent asked by email)', :A1, 'aal2',
  $q$ select public.admin_revoke_consent('c0000000-0000-4000-8000-000000000002', 'parent emailed support') $q$);
select pg_temp.ok('admin withdrawal is audited and blocks the account',
  (select consent_status from public.profiles where id = 'c0000000-0000-4000-8000-000000000002') = 'revoked'
  and (select count(*) from public.admin_audit where action = 'revoke_consent' and target_user = 'c0000000-0000-4000-8000-000000000002') = 1);
select pg_temp.refused('players can''t read consent events', :KID, 'aal1', $q$ select * from public.consent_events $q$);

-- ========== 4g. Contact us form + back counter Inbox (no personal email) ==========
select pg_temp.works('a parent sends a Contact us message without logging in', null, null,
  $q$ select public.contact_submit('delete_account', 'Please delete my son''s account TinyTinker.', ' Parent@Test.Local ', 'A parent', 'TinyTinker') $q$);
select pg_temp.works('a logged-in player sends a message', :P1, 'aal1',
  $q$ select public.contact_submit('problem', 'My deck did not save after the match.') $q$);
select pg_temp.refused('message too short is refused', null, null,
  $q$ select public.contact_submit('question', 'hi') $q$, 'check the form');
select pg_temp.refused('bad reply email is refused', null, null,
  $q$ select public.contact_submit('question', 'How do packs work?', 'not-an-email') $q$, 'check the form');
select pg_temp.refused('unknown topic is refused', null, null,
  $q$ select public.contact_submit('spam', 'Buy cheap gold now!!') $q$, 'check the form');
select pg_temp.ok('message stored cleaned, with sender account when logged in',
  (select reply_email = 'parent@test.local' and user_id is null and status = 'new' from public.contact_messages where topic = 'delete_account')
  and (select user_id = :P1 from public.contact_messages where topic = 'problem'));
select pg_temp.refused('players can''t read Contact us messages', :P1, 'aal2', $q$ select * from public.contact_messages $q$);
select pg_temp.refused('anon can''t read Contact us messages', null, null, $q$ select * from public.contact_messages $q$);
select pg_temp.refused('players can''t change or hide messages', :P1, 'aal1', $q$ update public.contact_messages set status = 'handled' $q$);
select pg_temp.refused('non-admin can''t open the Inbox', :P1, 'aal2', $q$ select * from public.admin_inbox('new', 1, 50) $q$, 'not admin');
select pg_temp.refused('admin without 2-step can''t open the Inbox', :A1, 'aal1', $q$ select * from public.admin_inbox('new', 1, 50) $q$, '2-step');
select pg_temp.ok('admin Inbox lists new messages with the player''s name',
  pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_inbox('new', 1, 50) $q$) = 2
  and pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_inbox('new', 1, 50) where username = 'Player_One' $q$) = 1);
select pg_temp.refused('marking handled needs a note', :A1, 'aal2',
  format($q$ select public.admin_inbox_mark(%s, 'handled', '') $q$, (select id from public.contact_messages where topic = 'delete_account')), 'reason');
select pg_temp.refused('a reply can''t go to a message without a reply address', :A1, 'aal2',
  format($q$ select public.admin_inbox_mark(%s, 'handled', 'answered', 'Thanks!') $q$, (select id from public.contact_messages where topic = 'problem')), 'no reply address');
select pg_temp.works('admin answers the parent from the no-reply address and marks it handled', :A1, 'aal2',
  format($q$ select public.admin_inbox_mark(%s, 'handled', 'account deleted, replied by email', 'Done: the account and its data are deleted.') $q$, (select id from public.contact_messages where topic = 'delete_account')));
select pg_temp.ok('the reply is queued for the email sender to the parent''s reply address (not Ken''s email)',
  (select count(*) from public.email_outbox where kind = 'contact_reply' and to_email = 'parent@test.local'
     and payload ->> 'reply' = 'Done: the account and its data are deleted.') = 1);
select pg_temp.ok('handled: status, who, when, note; audited',
  (select status = 'handled' and handled_by = :A1 and handled_at is not null and handled_note = 'account deleted, replied by email'
   from public.contact_messages where topic = 'delete_account')
  and (select count(*) from public.admin_audit where action = 'inbox_handled' and reason = 'account deleted, replied by email') = 1
  and pg_temp.count_as(:A1, 'aal2', $q$ select * from public.admin_inbox('new', 1, 50) $q$) = 1);
do $$ begin
  perform set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', true);
  for i in 1..5 loop
    perform pg_temp.act_as(null, null);
    perform public.contact_submit('question', 'Flood message number ' || i);
    perform pg_temp.back();
  end loop;
end $$;
select pg_temp.refused('more than 5 messages an hour from one address are refused', null, null,
  $q$ select public.contact_submit('question', 'Flood message number 6') $q$, 'too many');
select set_config('request.headers', '', true);

-- ========== 5. Append-only, even for the database owner ==========
do $$ declare err text; begin
  begin update public.transactions set delta = 1; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('ledger rows cannot be edited (even by the owner)', err ilike '%append-only%', coalesce(err, 'edited!'));
  err := null;
  begin delete from public.admin_audit; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('audit rows cannot be deleted (even by the owner)', err ilike '%append-only%', coalesce(err, 'deleted!'));
  err := null;
  begin delete from public.bans; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('ban history cannot be deleted (even by the owner)', err ilike '%append-only%', coalesce(err, 'deleted!'));
  err := null;
  begin update public.card_history set to_user = null; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('card history cannot be edited (even by the owner)', err ilike '%append-only%', coalesce(err, 'edited!'));
  err := null;
  begin delete from public.card_instances; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('cards cannot be deleted (even by the owner)', err ilike '%append-only%', coalesce(err, 'deleted!'));
  err := null;
  begin delete from public.consent_events; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('consent events cannot be deleted (even by the owner)', err ilike '%append-only%', coalesce(err, 'deleted!'));
  err := null;
  begin delete from public.parental_consents; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('consent records cannot be deleted (even by the owner)', err ilike '%append-only%', coalesce(err, 'deleted!'));
  err := null;
  begin delete from public.contact_messages; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('Contact us messages cannot be deleted (even by the owner)', err ilike '%append-only%', coalesce(err, 'deleted!'));
end $$;

-- ========== 6. Whole-schema guards (catch future mistakes) ==========
select pg_temp.ok('RLS is on for every table in public',
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  coalesce((select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity), ''));
select pg_temp.ok('players/anon have no write privilege on any public table',
  not exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
                and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')),
  coalesce((select string_agg(grantee || ':' || privilege_type || ':' || table_name, ', ') from information_schema.role_table_grants
            where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
              and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')), ''));
select pg_temp.ok('anon can run only the sign-up check, server info, the Contact us form and the parent consent links',
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute'))
   = array['contact_submit', 'parent_consent_info', 'parent_give_consent', 'parent_revoke_consent', 'server_info', 'username_available'],
  coalesce((select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), ''));
select pg_temp.ok('no private function can be run by players or anon',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'private' and (has_function_privilege('anon', p.oid, 'execute')
                                               or has_function_privilege('authenticated', p.oid, 'execute'))));
select pg_temp.ok('every admin_* function calls assert_admin',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname like 'admin\_%' and p.prosrc not like '%private.assert_admin()%'));
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

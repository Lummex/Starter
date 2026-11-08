-- Oreheart Online, Phase D: Oreshards (the premium currency, Stripe). LOCAL database only, one transaction, rolled back.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_d_oreshards.test.sql
-- The webhook's doors (oreshard_credit / oreshard_reverse / stripe_event_begin) are called here the way the function calls them (service role);
-- the player doors as players. No Stripe is reached: the session and payment ids are made up in Stripe's shape.
-- Own ids (f000…) and names: seed.sql holds the d000… users, and names with a reserved part (admin…) are refused at sign-up.

\ir _helpers.sql

-- Nov 7 (Ken): the live economy, before this file pins the older numbers for its arithmetic
select pg_temp.ok('Nov 7: packs cost 400 coins, 1 Oreshard = 4 coins (pack rate 0.25), daily quests 75 / 125 / 200',
  not exists (select 1 from public.pack_types where price_coins = 100) and exists (select 1 from public.pack_types where price_coins = 400)
  and (private.setting('oreshard_pack_rate'))::numeric = 0.25
  and (private.setting('quest_reward_easy'))::int = 75 and (private.setting('quest_reward_medium'))::int = 125 and (private.setting('quest_reward_hard'))::int = 200,
  (select string_agg(id || '=' || price_coins, ',') from public.pack_types) || ' rate ' || private.setting('oreshard_pack_rate')::text);

-- Nov 7 (migration 11): live prices are 400 coins a pack, 1 Oreshard = 4 coins, quests 75/125/200. The arithmetic in this file was
-- written for 100 / 1 / 25-50-75, so it pins those here (inside this file's rolled-back transaction); phase_d checks the live values.
update public.pack_types set price_coins = 100 where price_coins = 400;
update public.settings set value = '1'::jsonb where key = 'oreshard_pack_rate';
update public.settings set value = '25'::jsonb where key = 'quest_reward_easy';
update public.settings set value = '50'::jsonb where key = 'quest_reward_medium';
update public.settings set value = '75'::jsonb where key = 'quest_reward_hard';

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('f0000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'shardkeeper@test.local', '{"username":"ShardKeeper"}', now()),
  ('f0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'd1@test.local', '{"username":"Shard_Buyer"}', now()),
  ('f0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'd2@test.local', '{"username":"Little_Kid","age_group":"under_13"}', now()),
  ('f0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'd3@test.local', '{"username":"Refund_Rita"}', now());
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'shardkeeper@test.local';
update public.profiles set eula_version = (private.setting('eula_version') #>> '{}') where id in ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003');

\set A1 '''f0000000-0000-4000-8000-000000000009'''
\set P1 '''f0000000-0000-4000-8000-000000000001'''
\set K1 '''f0000000-0000-4000-8000-000000000002'''
\set P3 '''f0000000-0000-4000-8000-000000000003'''

-- a purchase row and a player's money, as text, for the details
create function pg_temp.purchase_text(p_session text) returns text language sql as $$
  select coalesce((select to_jsonb(p)::text from public.purchases p where p.stripe_session_id = p_session), 'no purchase with session ' || p_session) $$;
create function pg_temp.wallet_text(p_user uuid) returns text language sql as $$
  select format('oreshards=%s coins=%s money=%s ledger=%s', (select oreshards from public.oreshard_wallets where user_id = p_user), (select coins from public.wallets where user_id = p_user),
                (select money_spent_cents from public.player_stats where user_id = p_user),
                (select jsonb_agg(jsonb_build_array(l.delta, l.reason, l.amount_cents, l.balance_after) order by l.id) from public.oreshard_ledger l where l.user_id = p_user)) $$;

-- ========== 1. Settings and the page ==========
select pg_temp.ok('oreshards: the six bundles (Ken, Nov 7: $0.99 to $99.99) and the shop is on',
  (select jsonb_agg(jsonb_build_array(x ->> 'id', (x ->> 'usd_cents')::int, (x ->> 'oreshards')::int, (x ->> 'bonus_pct')::int)) from jsonb_array_elements(private.setting('oreshard_bundles')) e(x))
    = '[["pouch",99,100,0],["sack",499,550,10],["chest",999,1200,20],["hoard",1999,2600,30],["vault",4999,7000,40],["mountain",9999,15000,50]]'::jsonb
  and (private.setting('oreshards_enabled'))::boolean, private.setting('oreshard_bundles')::text);
create temp table m1 as select pg_temp.json_as(:P1, 'aal1', 'select public.my_oreshards()') as j;
select pg_temp.ok('my_oreshards: a new player has 0 Oreshards, may buy, sees the bundles and no purchases',
  (select (j ->> 'oreshards')::int = 0 and (j ->> 'can_buy')::boolean and jsonb_array_length(j -> 'bundles') = 6 and (j ->> 'pack_rate')::numeric = 1 and j -> 'purchases' = '[]'::jsonb from m1), (select j::text from m1));
select pg_temp.refused('anon cannot ask my_oreshards', null, 'aal1', 'select public.my_oreshards()', 'permission denied');

-- ========== 2. Who may buy ==========
create temp table mk as select pg_temp.json_as(:K1, 'aal1', 'select public.my_oreshards()') as j;
select pg_temp.ok('an under-13 account without an approved parent cannot buy (the page says why)',
  (select not (j ->> 'can_buy')::boolean and j ->> 'blocked' like 'A parent must approve%' from mk), (select j::text from mk));
select pg_temp.refused('... and the checkout door refuses it', :K1, 'aal1', $q$ select public.oreshard_checkout_start('pouch') $q$, 'parent must approve');
update public.profiles set consent_status = 'approved', eula_version = (private.setting('eula_version') #>> '{}') where id = :K1;
create temp table mk2 as select pg_temp.json_as(:K1, 'aal1', 'select public.my_oreshards()') as j;
select pg_temp.ok('... with an approved parent the same account may buy', (select (j ->> 'can_buy')::boolean from mk2), (select j::text from mk2));
update public.settings set value = 'false'::jsonb where key = 'oreshards_enabled';
select pg_temp.refused('the admin switch oreshards_enabled = false closes the shop', :P1, 'aal1', $q$ select public.oreshard_checkout_start('pouch') $q$, 'not on sale');
update public.settings set value = 'true'::jsonb where key = 'oreshards_enabled';
select pg_temp.refused('an unknown bundle is refused', :P1, 'aal1', $q$ select public.oreshard_checkout_start('bucket') $q$, 'not for sale');

-- ========== 3. A purchase: start (as the player), link and credit (as the webhook) ==========
create temp table st1 as select pg_temp.json_as(:P1, 'aal1', $q$ select public.oreshard_checkout_start('chest') $q$) as j;
select pg_temp.ok('checkout_start: a created purchase row with the bundle''s price and Oreshards, the player''s name and email for Stripe',
  (select (j -> 'bundle' ->> 'usd_cents')::int = 999 and (j -> 'bundle' ->> 'oreshards')::int = 1200 and j ->> 'username' = 'Shard_Buyer' and j ->> 'email' = 'd1@test.local'
          and exists (select 1 from public.purchases p where p.id = (j ->> 'purchase_id')::uuid and p.status = 'created' and p.amount_cents = 999 and p.oreshards = 1200 and p.stripe_session_id is null)
   from st1), (select j::text from st1));
select pg_temp.refused('players cannot read the purchases table', :P1, 'aal1', 'select * from public.purchases', 'permission denied');
select pg_temp.refused('players cannot read the Oreshard ledger', :P1, 'aal1', 'select * from public.oreshard_ledger', 'permission denied');
select pg_temp.refused('players cannot call the webhook''s credit door', :P1, 'aal1', $q$ select public.oreshard_credit('cs_test_a1b2c3d4e5', 'pi_1234567890', 999, 'usd', null, 'evt_1234567890') $q$, 'permission denied');
select pg_temp.refused('players cannot link a session to a purchase', :P1, 'aal1', $q$ select public.oreshard_checkout_link((select (j ->> 'purchase_id')::uuid from st1), 'cs_test_a1b2c3d4e5', 'cus_x') $q$, 'permission denied');
create temp table l1 as select public.oreshard_checkout_link((select (j ->> 'purchase_id')::uuid from st1), 'cs_test_a1b2c3d4e5f6', 'cus_test_buyer') as a;
create temp table l2 as select public.oreshard_checkout_link((select (j ->> 'purchase_id')::uuid from st1), 'cs_test_other_000001', 'cus_test_buyer') as b;
select pg_temp.ok('checkout_link (referee): the session id and customer are stored once; a second link is refused',
  (select a from l1) and not (select b from l2) and (select stripe_customer_id from public.profiles where id = :P1) = 'cus_test_buyer',
  format('first=%s second=%s profile_customer=%s %s', (select a from l1), (select b from l2), (select stripe_customer_id from public.profiles where id = :P1), pg_temp.purchase_text('cs_test_a1b2c3d4e5f6')));
create temp table eb1 as select public.stripe_event_begin('evt_test_000000001', 'checkout.session.completed') as a;
create temp table eb2 as select public.stripe_event_begin('evt_test_000000001', 'checkout.session.completed') as a;
select pg_temp.ok('stripe_event_begin: a new event id is recorded (true); the same id again is a repeat (false)', (select a from eb1) and not (select a from eb2), format('first=%s second=%s', (select a from eb1), (select a from eb2)));
select pg_temp.refused('anon cannot record Stripe events', null, 'aal1', $q$ select public.stripe_event_begin('evt_test_anon_000001', 'x') $q$, 'permission denied');
create temp table c1 as select public.oreshard_credit('cs_test_a1b2c3d4e5f6', 'pi_test_00000000001', 999, 'usd', 'cus_test_buyer', 'evt_test_000000001') as r;
select pg_temp.ok('credit: a paid session credits exactly its Oreshards, marks the purchase paid, keeps the payment intent and adds the money to money spent',
  (select r ->> 'ok' = 'true' and r ->> 'repeat' = 'false' and (r ->> 'oreshards')::int = 1200 and (r ->> 'balance')::int = 1200 from c1)
  and (select status = 'paid' and stripe_payment_intent = 'pi_test_00000000001' and credited_at is not null from public.purchases where stripe_session_id = 'cs_test_a1b2c3d4e5f6')
  and (select oreshards from public.oreshard_wallets where user_id = :P1) = 1200
  and (select money_spent_cents from public.player_stats where user_id = :P1) = 999
  and (select count(*) from public.oreshard_ledger where user_id = :P1 and reason = 'purchase' and delta = 1200 and amount_cents = 999) = 1
  and (select result ->> 'credited' from public.stripe_events where id = 'evt_test_000000001') = '1200',
  format('credit=%s event=%s %s %s', (select r::text from c1), (select result::text from public.stripe_events where id = 'evt_test_000000001'), pg_temp.purchase_text('cs_test_a1b2c3d4e5f6'), pg_temp.wallet_text(:P1)));
create temp table c2 as select public.oreshard_credit('cs_test_a1b2c3d4e5f6', 'pi_test_00000000001', 999, 'usd', null, 'evt_test_000000002') as r;
select pg_temp.ok('credit again for the same session (a repeated delivery) credits nothing more',
  (select r ->> 'repeat' = 'true' from c2) and (select oreshards from public.oreshard_wallets where user_id = :P1) = 1200 and (select count(*) from public.oreshard_ledger where user_id = :P1) = 1,
  format('credit=%s %s', (select r::text from c2), pg_temp.wallet_text(:P1)));
select pg_temp.ok('credit for an unknown session credits nothing', (select r ->> 'ok' = 'false' from public.oreshard_credit('cs_test_nobody_here_x', null, 199, 'usd', null, 'evt_test_000000003') r));
-- a second purchase whose paid amount does not match (a tampered or foreign session)
create temp table st2 as select pg_temp.json_as(:P1, 'aal1', $q$ select public.oreshard_checkout_start('pouch') $q$) as j;
create temp table l3 as select public.oreshard_checkout_link((select (j ->> 'purchase_id')::uuid from st2), 'cs_test_pouch_000001', 'cus_test_buyer') as a;
create temp table c3 as select public.oreshard_credit('cs_test_pouch_000001', 'pi_test_00000000002', 100, 'usd', null, 'evt_test_000000004') as r;
select pg_temp.ok('credit refuses a paid amount that does not match the purchase (nothing credited)',
  (select r ->> 'ok' = 'false' and r ->> 'error' like 'amount mismatch%' from c3)
  and (select status from public.purchases where stripe_session_id = 'cs_test_pouch_000001') = 'created'
  and (select oreshards from public.oreshard_wallets where user_id = :P1) = 1200,
  format('link=%s credit=%s %s', (select a from l3), (select r::text from c3), pg_temp.purchase_text('cs_test_pouch_000001')));
create temp table f1 as select public.oreshard_fail('cs_test_pouch_000001') as a;
select pg_temp.ok('a delayed payment that failed closes the purchase as failed', (select a from f1) and (select status from public.purchases where stripe_session_id = 'cs_test_pouch_000001') = 'failed',
  format('fail=%s %s', (select a from f1), pg_temp.purchase_text('cs_test_pouch_000001')));
create temp table m2 as select pg_temp.json_as(:P1, 'aal1', 'select public.my_oreshards()') as j;
select pg_temp.ok('my_oreshards after the purchase: 1200 Oreshards, the paid purchase listed with its receipt, the failed one too, no created ones',
  (select (j ->> 'oreshards')::int = 1200 and jsonb_array_length(j -> 'purchases') = 2
          and exists (select 1 from jsonb_array_elements(j -> 'purchases') e(x) where x ->> 'status' = 'paid' and x ->> 'receipt' = 'cs_test_a1b2c3d4e5f6' and (x ->> 'amount_cents')::int = 999)
   from m2), (select j::text from m2));

-- ========== 4. Converting to coins, one way ==========
create temp table v1 as select pg_temp.json_as(:P1, 'aal1', $q$ select public.oreshards_to_coins(300, 'conv-test-0001') $q$) as r;
select pg_temp.ok('oreshards_to_coins: 300 Oreshards become 300 Coins (ledger rows on both sides, same idem key)',
  (select (r ->> 'converted')::int = 300 and (r ->> 'oreshards')::int = 900 from v1)
  and (select coins from public.wallets where user_id = :P1) = (select balance_after from public.transactions where user_id = :P1 and reason = 'oreshard_convert' and delta = 300)
  and (select oreshards from public.oreshard_wallets where user_id = :P1) = 900,
  format('convert=%s %s tx=%s', (select r::text from v1), pg_temp.wallet_text(:P1), (select jsonb_agg(jsonb_build_array(t.delta, t.reason, t.balance_after)) from public.transactions t where t.user_id = :P1)));
create temp table v2 as select pg_temp.json_as(:P1, 'aal1', $q$ select public.oreshards_to_coins(300, 'conv-test-0001') $q$) as r;
select pg_temp.ok('the same conversion sent twice (same idem key) happens once',
  (select (r ->> 'oreshards')::int = 900 from v2) and (select count(*) from public.transactions where user_id = :P1 and reason = 'oreshard_convert') = 1,
  format('convert=%s %s', (select r::text from v2), pg_temp.wallet_text(:P1)));
select pg_temp.refused('more Oreshards than owned is refused', :P1, 'aal1', $q$ select public.oreshards_to_coins(5000, 'conv-test-0002') $q$, 'not enough Oreshards');
select pg_temp.refused('zero or negative is refused', :P1, 'aal1', $q$ select public.oreshards_to_coins(0, 'conv-test-0003') $q$, 'How many');
select pg_temp.ok('there is no door from Coins to Oreshards', not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.proname ~ 'coins_to_oreshards'));

-- ========== 5. Refunds and chargebacks ==========
create temp table st3 as select pg_temp.json_as(:P3, 'aal1', $q$ select public.oreshard_checkout_start('sack') $q$) as j;
create temp table l4 as select public.oreshard_checkout_link((select (j ->> 'purchase_id')::uuid from st3), 'cs_test_rita_000001', 'cus_test_rita') as a;
create temp table e1 as select public.stripe_event_begin('evt_test_rita_00001', 'checkout.session.completed') as a;
create temp table c4 as select public.oreshard_credit('cs_test_rita_000001', 'pi_test_rita_000001', 499, 'usd', 'cus_test_rita', 'evt_test_rita_00001') as r;
-- Rita spends some first, so the refund leaves her below zero
create temp table v3 as select pg_temp.json_as(:P3, 'aal1', $q$ select public.oreshards_to_coins(400, 'conv-rita-0001') $q$) as r;
select pg_temp.ok('Rita: a paid Sack (550) and 400 turned into Coins leave 150',
  (select oreshards from public.oreshard_wallets where user_id = :P3) = 150,
  format('start=%s link=%s credit=%s convert=%s %s', (select j::text from st3), (select a from l4), (select r::text from c4), (select r::text from v3), pg_temp.wallet_text(:P3)));
create temp table e2 as select public.stripe_event_begin('evt_test_rita_00002', 'charge.refunded') as a;
create temp table r1 as select public.oreshard_reverse('pi_test_rita_000001', 'refund', 499, 'evt_test_rita_00002') as r;
select pg_temp.ok('refund: the Oreshards go back out (the balance may go below zero), the purchase is refunded, money spent comes down, the account is flagged',
  (select r ->> 'ok' = 'true' and (r ->> 'oreshards')::int = -550 and (r ->> 'balance')::int = -400 from r1)
  and (select status = 'refunded' and reversed_at is not null from public.purchases where stripe_session_id = 'cs_test_rita_000001')
  and (select money_spent_cents from public.player_stats where user_id = :P3) = 0
  and (select flags -> 'payment_review' ->> 'kind' from public.profiles where id = :P3) = 'refund'
  and (select count(*) from public.oreshard_ledger where user_id = :P3 and reason = 'reversal' and delta = -550 and amount_cents = -499) = 1,
  format('reverse=%s flags=%s %s %s', (select r::text from r1), (select flags::text from public.profiles where id = :P3), pg_temp.purchase_text('cs_test_rita_000001'), pg_temp.wallet_text(:P3)));
create temp table r2 as select public.oreshard_reverse('pi_test_rita_000001', 'refund', 499, 'evt_test_rita_00003') as r;
select pg_temp.ok('the same refund again changes nothing', (select r ->> 'repeat' = 'true' from r2) and (select oreshards from public.oreshard_wallets where user_id = :P3) = -400,
  format('reverse=%s %s', (select r::text from r2), pg_temp.wallet_text(:P3)));
select pg_temp.refused('below zero, nothing can be spent until the balance is back', :P3, 'aal1', $q$ select public.oreshards_to_coins(1, 'conv-rita-0002') $q$, 'owes Oreshards');
create temp table m3 as select pg_temp.json_as(:P3, 'aal1', 'select public.my_oreshards()') as j;
select pg_temp.ok('my_oreshards shows the negative balance and the refunded purchase',
  (select (j ->> 'oreshards')::int = -400 and exists (select 1 from jsonb_array_elements(j -> 'purchases') e(x) where x ->> 'status' = 'refunded') from m3), (select j::text from m3));
create temp table r3 as select public.oreshard_reverse('pi_test_rita_000001', 'dispute', 499, 'evt_test_rita_00004') as r;
select pg_temp.ok('a chargeback after a refund only changes the mark to disputed',
  (select r ->> 'repeat' = 'true' from r3) and (select status from public.purchases where stripe_session_id = 'cs_test_rita_000001') = 'disputed',
  format('reverse=%s %s', (select r::text from r3), pg_temp.purchase_text('cs_test_rita_000001')));
select pg_temp.ok('a reversal for an unknown payment does nothing', (select r ->> 'ok' = 'false' from public.oreshard_reverse('pi_test_nobody_0001', 'refund', 1, 'evt_test_rita_00005') r));
select pg_temp.refused('anon cannot reverse a purchase', null, 'aal1', $q$ select public.oreshard_reverse('pi_test_rita_000001', 'refund', 1, 'evt_test_rita_00006') $q$, 'permission denied');
create temp table fg1 as select public.stripe_event_begin('evt_test_forget_0001', 'charge.refunded') as a;
create temp table fg2 as select public.stripe_event_forget('evt_test_forget_0001') as a;
create temp table fg3 as select public.stripe_event_begin('evt_test_forget_0001', 'charge.refunded') as a;
create temp table fg4 as select public.stripe_event_forget('evt_test_rita_00001') as a;
select pg_temp.ok('stripe_event_forget: an event whose handler failed (no result) is forgotten so the retry is handled; a handled one stays',
  (select a from fg1) and (select a from fg2) and (select a from fg3) and not (select a from fg4),
  format('begin=%s forget=%s again=%s handled_forget=%s', (select a from fg1), (select a from fg2), (select a from fg3), (select a from fg4)));

-- ========== 6. Admin ==========
create temp table ad as select pg_temp.json_as(:A1, 'aal2', format('select public.admin_oreshards(%L)', :P3)) as j;
select pg_temp.ok('admin_oreshards: Ken sees the balance, money spent, the purchases with their Stripe ids and the review flag',
  (select (j ->> 'oreshards')::int = -400 and jsonb_array_length(j -> 'purchases') = 1 and j -> 'purchases' -> 0 ->> 'session' = 'cs_test_rita_000001' and j -> 'review' ->> 'kind' = 'refund' from ad), (select j::text from ad));
select pg_temp.refused('a player cannot open admin_oreshards', :P1, 'aal1', format('select public.admin_oreshards(%L)', :P3), 'admin');
create temp table ad2 as select pg_temp.json_as(:A1, 'aal2', format('select public.admin_player_detail(%L)', :P1)) as j;
select pg_temp.ok('admin_player_detail money spent follows the purchases (999 for the buyer)', (select (j ->> 'money_spent_cents')::int = 999 from ad2), (select j ->> 'money_spent_cents' from ad2));
select pg_temp.works('admin can change the bundles (admin-editable prices)', :A1, 'aal2',
  $q$ select public.admin_set_setting('oreshard_bundles', '[{"id": "pouch", "name": "Pouch of Oreshards", "usd_cents": 249, "oreshards": 200, "bonus_pct": 0}, {"id": "sack", "name": "Sack of Oreshards", "usd_cents": 499, "oreshards": 550, "bonus_pct": 10}, {"id": "chest", "name": "Chest of Oreshards", "usd_cents": 999, "oreshards": 1200, "bonus_pct": 20}, {"id": "hoard", "name": "Hoard of Oreshards", "usd_cents": 1999, "oreshards": 2600, "bonus_pct": 30}]', 'test: pouch 2.49') $q$);
select pg_temp.ok('... and the page sells at the new price', (select (x ->> 'usd_cents')::int = 249 from jsonb_array_elements(private.setting('oreshard_bundles')) e(x) where x ->> 'id' = 'pouch'));
select pg_temp.refused('a bundle under Stripe''s 50-cent minimum is refused', :A1, 'aal2', $q$ select public.admin_set_setting('oreshard_bundles', '[{"id": "tiny", "name": "Tiny", "usd_cents": 10, "oreshards": 5, "bonus_pct": 0}]', 'test') $q$, '50-99999');
select pg_temp.refused('two bundles with one id are refused', :A1, 'aal2', $q$ select public.admin_set_setting('oreshard_bundles', '[{"id": "pouch", "name": "A", "usd_cents": 199, "oreshards": 200, "bonus_pct": 0}, {"id": "pouch", "name": "B", "usd_cents": 299, "oreshards": 300, "bonus_pct": 0}]', 'test') $q$, 'share an id');
select pg_temp.works('admin can switch the shop off and on', :A1, 'aal2', $q$ select public.admin_set_setting('oreshards_enabled', 'false', 'test: off'), public.admin_set_setting('oreshards_enabled', 'true', 'test: on') $q$);
select pg_temp.refused('oreshards_enabled takes only true or false', :A1, 'aal2', $q$ select public.admin_set_setting('oreshards_enabled', '"yes"', 'test') $q$, 'true or false');

-- ========== 6b. Nov 7: packs paid in Oreshards (Ken: "so they can actually buy packs") ==========
select private.oreshard_apply(:P1, 5000, 'admin_grant', 'test', 'test-grant-packs-aaaaaaaa');
create temp table ob0 as select (select oreshards from public.oreshard_wallets where user_id = :P1) as s, (select coins from public.wallets where user_id = :P1) as c;
create temp table ob1 as select pg_temp.json_as(:P1, 'aal1', $q$ select public.buy_packs('standard', 6, 'ob-aaaaaaaa-0006', 'oreshards') $q$) as j;
select pg_temp.ok('buy_packs in Oreshards: the 6-bundle costs 600 Oreshards (rate 1), no coins, 6 sealed packs, a pack ledger row',
  (select j ->> 'paid_with' = 'oreshards' and (j ->> 'oreshards_paid')::int = 600 and (j ->> 'price_paid')::int = 0 and (j ->> 'packs')::int = 6 from ob1)
  and (select oreshards from public.oreshard_wallets where user_id = :P1) = (select s - 600 from ob0)
  and (select coins from public.wallets where user_id = :P1) = (select c from ob0)
  and exists (select 1 from public.oreshard_ledger where user_id = :P1 and reason = 'pack' and delta = -600),
  (select j::text from ob1));
select pg_temp.ok('buy_packs in Oreshards: the same key again charges nothing twice',
  (select (j ->> 'repeat')::boolean from pg_temp.json_as(:P1, 'aal1', $q$ select public.buy_packs('standard', 6, 'ob-aaaaaaaa-0006', 'oreshards') $q$) j)
  and (select oreshards from public.oreshard_wallets where user_id = :P1) = (select s - 600 from ob0));
select pg_temp.refused('buy_packs in Oreshards: not enough Oreshards is refused', :P1, 'aal1', $q$ select public.buy_packs('standard', 99, 'ob-aaaaaaaa-0099', 'oreshards') $q$, 'Not enough Oreshards');
select pg_temp.refused('buy_packs: only coins or Oreshards', :P1, 'aal1', $q$ select public.buy_packs('standard', 1, 'ob-aaaaaaaa-0001', 'gold') $q$, 'coins or Oreshards');
select pg_temp.works('admin can set oreshard_pack_rate', :A1, 'aal2', $q$ select public.admin_set_setting('oreshard_pack_rate', '1', 'test: rate') $q$);
select pg_temp.refused('oreshard_pack_rate is 0.1 to 100', :A1, 'aal2', $q$ select public.admin_set_setting('oreshard_pack_rate', '0', 'test') $q$, '0.1 to 100');

-- ========== 7. Locks ==========
select pg_temp.ok('RLS is on for the Oreshard tables and players have no privilege on them',
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('oreshard_wallets', 'oreshard_ledger', 'purchases', 'stripe_events'))
  and not exists (select 1 from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name in ('oreshard_wallets', 'oreshard_ledger', 'purchases', 'stripe_events') and g.grantee in ('anon', 'authenticated')));

-- ========== Nov 7: 1 Oreshard = 4 coins (Ken) ==========
update public.settings set value = '0.25'::jsonb where key = 'oreshard_pack_rate';
select private.oreshard_apply(:P1, 10, 'admin_grant', 'test', 'test-quarter-rate');
create temp table q4 as select (select coins from public.wallets where user_id = :P1) as c0;
create temp table q4b as select pg_temp.json_as(:P1, 'aal1', $q$ select public.oreshards_to_coins(10, 'conv-quarter-0001') $q$) as j;
select pg_temp.ok('at the live rate 10 Oreshards become 40 coins', (select (j ->> 'coins_got')::int = 40 and (j ->> 'coins_per_oreshard')::int = 4 from q4b)
  and (select coins from public.wallets where user_id = :P1) = (select c0 from q4) + 40, (select j::text from q4b));
select n, case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by n;
do $$ declare f int := (select count(*) from results where not ok); t int := (select count(*) from results);
begin
  raise notice '% of % checks passed', t - f, t;
  if f > 0 then raise exception '% check(s) FAILED', f; end if;
end $$;
rollback;

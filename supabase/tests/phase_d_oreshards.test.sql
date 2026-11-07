-- Oreheart Online, Phase D: Oreshards (the premium currency, Stripe). LOCAL database only, one transaction, rolled back.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_d_oreshards.test.sql
-- The webhook's doors (oreshard_credit / oreshard_reverse / stripe_event_begin) are called here the way the function calls them (service role);
-- the player doors as players. No Stripe is reached: the session and payment ids are made up in Stripe's shape.

\ir _helpers.sql

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('d0000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'shardadmin@test.local', '{"username":"ShardAdmin"}', now()),
  ('d0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'd1@test.local', '{"username":"Shard_Buyer"}', now()),
  ('d0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'd2@test.local', '{"username":"Little_Kid","age_group":"under_13"}', now()),
  ('d0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'd3@test.local', '{"username":"Refund_Rita"}', now());
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'shardadmin@test.local';
update public.profiles set eula_version = (private.setting('eula_version') #>> '{}') where id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003');

\set A1 '''d0000000-0000-4000-8000-000000000009'''
\set P1 '''d0000000-0000-4000-8000-000000000001'''
\set K1 '''d0000000-0000-4000-8000-000000000002'''
\set P3 '''d0000000-0000-4000-8000-000000000003'''

-- ========== 1. Settings and the page ==========
select pg_temp.ok('oreshards: the four bundles are the plan''s (Pouch 199/200, Sack 499/550, Chest 999/1200, Hoard 1999/2600) and the shop is on',
  (select jsonb_agg(jsonb_build_array(x ->> 'id', (x ->> 'usd_cents')::int, (x ->> 'oreshards')::int, (x ->> 'bonus_pct')::int)) from jsonb_array_elements(private.setting('oreshard_bundles')) e(x))
    = '[["pouch",199,200,0],["sack",499,550,10],["chest",999,1200,20],["hoard",1999,2600,30]]'::jsonb
  and (private.setting('oreshards_enabled'))::boolean);
select pg_temp.ok('my_oreshards: a new player has 0 Oreshards, may buy, sees the bundles and no purchases',
  (select (j ->> 'oreshards')::int = 0 and (j ->> 'can_buy')::boolean and jsonb_array_length(j -> 'bundles') = 4 and j -> 'purchases' = '[]'::jsonb
   from pg_temp.json_as(:P1, 'aal1', 'select public.my_oreshards()') j));
select pg_temp.refused('anon cannot ask my_oreshards', null, 'aal1', 'select public.my_oreshards()', 'not logged in');

-- ========== 2. Who may buy ==========
select pg_temp.ok('an under-13 account without an approved parent cannot buy (the page says why)',
  (select not (j ->> 'can_buy')::boolean and j ->> 'blocked' like 'A parent must approve%' from pg_temp.json_as(:K1, 'aal1', 'select public.my_oreshards()') j));
select pg_temp.refused('... and the checkout door refuses it', :K1, 'aal1', $q$ select public.oreshard_checkout_start('pouch') $q$, 'parent must approve');
update public.profiles set consent_status = 'approved', eula_version = (private.setting('eula_version') #>> '{}') where id = :K1;
select pg_temp.ok('... with an approved parent the same account may buy',
  (select (j ->> 'can_buy')::boolean from pg_temp.json_as(:K1, 'aal1', 'select public.my_oreshards()') j));
update public.settings set value = 'false'::jsonb where key = 'oreshards_enabled';
select pg_temp.refused('the admin switch oreshards_enabled = false closes the shop', :P1, 'aal1', $q$ select public.oreshard_checkout_start('pouch') $q$, 'not on sale');
update public.settings set value = 'true'::jsonb where key = 'oreshards_enabled';
select pg_temp.refused('an unknown bundle is refused', :P1, 'aal1', $q$ select public.oreshard_checkout_start('bucket') $q$, 'not for sale');

-- ========== 3. A purchase: start (as the player), link and credit (as the webhook) ==========
create temp table st1 as select pg_temp.json_as(:P1, 'aal1', $q$ select public.oreshard_checkout_start('chest') $q$) as j;
select pg_temp.ok('checkout_start: a created purchase row with the bundle''s price and Oreshards, the player''s name and email for Stripe',
  (select (j -> 'bundle' ->> 'usd_cents')::int = 999 and (j -> 'bundle' ->> 'oreshards')::int = 1200 and j ->> 'username' = 'Shard_Buyer' and j ->> 'email' = 'd1@test.local'
          and exists (select 1 from public.purchases p where p.id = (j ->> 'purchase_id')::uuid and p.status = 'created' and p.amount_cents = 999 and p.oreshards = 1200 and p.stripe_session_id is null)
   from st1));
select pg_temp.refused('players cannot read the purchases table', :P1, 'aal1', 'select * from public.purchases', 'permission denied');
select pg_temp.refused('players cannot read the Oreshard ledger', :P1, 'aal1', 'select * from public.oreshard_ledger', 'permission denied');
select pg_temp.refused('players cannot call the webhook''s credit door', :P1, 'aal1', $q$ select public.oreshard_credit('cs_test_a1b2c3d4e5', 'pi_1234567890', 999, 'usd', null, 'evt_1234567890') $q$, 'permission denied');
select pg_temp.refused('players cannot link a session to a purchase', :P1, 'aal1', $q$ select public.oreshard_checkout_link((select (j ->> 'purchase_id')::uuid from st1), 'cs_test_a1b2c3d4e5', 'cus_x') $q$, 'permission denied');
select pg_temp.ok('checkout_link (referee): the session id and customer are stored once; a second link is refused',
  public.oreshard_checkout_link((select (j ->> 'purchase_id')::uuid from st1), 'cs_test_a1b2c3d4e5f6', 'cus_test_buyer')
  and not public.oreshard_checkout_link((select (j ->> 'purchase_id')::uuid from st1), 'cs_test_other', 'cus_test_buyer')
  and (select stripe_customer_id from public.profiles where id = :P1) = 'cus_test_buyer');
select pg_temp.ok('stripe_event_begin: a new event id is recorded (true); the same id again is a repeat (false)',
  public.stripe_event_begin('evt_test_000000001', 'checkout.session.completed') and not public.stripe_event_begin('evt_test_000000001', 'checkout.session.completed'));
select pg_temp.refused('stripe_event_begin refuses an id not in Stripe''s shape', null, 'aal1', $q$ select public.stripe_event_begin('hello', 'x') $q$, 'bad event id');
select pg_temp.ok('credit: a paid session credits exactly its Oreshards, marks the purchase paid, keeps the payment intent and adds the money to money spent',
  (select r ->> 'ok' = 'true' and r ->> 'repeat' = 'false' and (r ->> 'oreshards')::int = 1200 and (r ->> 'balance')::int = 1200
   from public.oreshard_credit('cs_test_a1b2c3d4e5f6', 'pi_test_00000000001', 999, 'usd', 'cus_test_buyer', 'evt_test_000000001') r)
  and (select status = 'paid' and stripe_payment_intent = 'pi_test_00000000001' and credited_at is not null from public.purchases where stripe_session_id = 'cs_test_a1b2c3d4e5f6')
  and (select oreshards from public.oreshard_wallets where user_id = :P1) = 1200
  and (select money_spent_cents from public.player_stats where user_id = :P1) = 999
  and (select count(*) from public.oreshard_ledger where user_id = :P1 and reason = 'purchase' and delta = 1200 and amount_cents = 999) = 1
  and (select result ->> 'credited' from public.stripe_events where id = 'evt_test_000000001') = '1200');
select pg_temp.ok('credit again for the same session (a repeated delivery) credits nothing more',
  (select r ->> 'repeat' = 'true' from public.oreshard_credit('cs_test_a1b2c3d4e5f6', 'pi_test_00000000001', 999, 'usd', null, 'evt_test_000000002') r)
  and (select oreshards from public.oreshard_wallets where user_id = :P1) = 1200
  and (select count(*) from public.oreshard_ledger where user_id = :P1) = 1);
select pg_temp.ok('credit for an unknown session credits nothing', (select r ->> 'ok' = 'false' from public.oreshard_credit('cs_test_nobody_here_x', null, 199, 'usd', null, 'evt_test_000000003') r));
-- a second purchase whose paid amount does not match (a tampered or foreign session)
create temp table st2 as select pg_temp.json_as(:P1, 'aal1', $q$ select public.oreshard_checkout_start('pouch') $q$) as j;
select public.oreshard_checkout_link((select (j ->> 'purchase_id')::uuid from st2), 'cs_test_pouch_000001', 'cus_test_buyer');
select pg_temp.ok('credit refuses a paid amount that does not match the purchase (nothing credited)',
  (select r ->> 'ok' = 'false' and r ->> 'error' like 'amount mismatch%' from public.oreshard_credit('cs_test_pouch_000001', 'pi_test_00000000002', 100, 'usd', null, 'evt_test_000000004') r)
  and (select status from public.purchases where stripe_session_id = 'cs_test_pouch_000001') = 'created'
  and (select oreshards from public.oreshard_wallets where user_id = :P1) = 1200);
select pg_temp.ok('a delayed payment that failed closes the purchase as failed', public.oreshard_fail('cs_test_pouch_000001') and (select status from public.purchases where stripe_session_id = 'cs_test_pouch_000001') = 'failed');
select pg_temp.ok('my_oreshards after the purchase: 1200 Oreshards, the paid purchase listed with its receipt, the failed one too, no created ones',
  (select (j ->> 'oreshards')::int = 1200 and jsonb_array_length(j -> 'purchases') = 2
          and exists (select 1 from jsonb_array_elements(j -> 'purchases') e(x) where x ->> 'status' = 'paid' and x ->> 'receipt' = 'cs_test_a1b2c3d4e5f6' and (x ->> 'amount_cents')::int = 999)
   from pg_temp.json_as(:P1, 'aal1', 'select public.my_oreshards()') j));

-- ========== 4. Converting to coins, one way ==========
select pg_temp.ok('oreshards_to_coins: 300 Oreshards become 300 Coins (ledger rows on both sides, same idem key)',
  (select (r ->> 'converted')::int = 300 and (r ->> 'oreshards')::int = 900 from pg_temp.json_as(:P1, 'aal1', $q$ select public.oreshards_to_coins(300, 'conv-test-0001') $q$) r)
  and (select coins from public.wallets where user_id = :P1) = (select balance_after from public.transactions where user_id = :P1 and reason = 'oreshard_convert' and delta = 300)
  and (select oreshards from public.oreshard_wallets where user_id = :P1) = 900);
select pg_temp.ok('the same conversion sent twice (same idem key) happens once',
  (select (r ->> 'oreshards')::int = 900 from pg_temp.json_as(:P1, 'aal1', $q$ select public.oreshards_to_coins(300, 'conv-test-0001') $q$) r)
  and (select count(*) from public.transactions where user_id = :P1 and reason = 'oreshard_convert') = 1);
select pg_temp.refused('more Oreshards than owned is refused', :P1, 'aal1', $q$ select public.oreshards_to_coins(5000, 'conv-test-0002') $q$, 'not enough Oreshards');
select pg_temp.refused('zero or negative is refused', :P1, 'aal1', $q$ select public.oreshards_to_coins(0, 'conv-test-0003') $q$, 'How many');
select pg_temp.ok('there is no door from Coins to Oreshards', not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.proname ~ 'coins_to_oreshards'));

-- ========== 5. Refunds and chargebacks ==========
create temp table st3 as select pg_temp.json_as(:P3, 'aal1', $q$ select public.oreshard_checkout_start('sack') $q$) as j;
select public.oreshard_checkout_link((select (j ->> 'purchase_id')::uuid from st3), 'cs_test_rita_000001', 'cus_test_rita');
select public.stripe_event_begin('evt_test_rita_00001', 'checkout.session.completed');
select public.oreshard_credit('cs_test_rita_000001', 'pi_test_rita_000001', 499, 'usd', 'cus_test_rita', 'evt_test_rita_00001');
-- Rita spends some first, so the refund leaves her below zero
select pg_temp.json_as(:P3, 'aal1', $q$ select public.oreshards_to_coins(400, 'conv-rita-0001') $q$);
select public.stripe_event_begin('evt_test_rita_00002', 'charge.refunded');
select pg_temp.ok('refund: the Oreshards go back out (the balance may go below zero), the purchase is refunded, money spent comes down, the account is flagged',
  (select r ->> 'ok' = 'true' and (r ->> 'oreshards')::int = -550 and (r ->> 'balance')::int = -400 from public.oreshard_reverse('pi_test_rita_000001', 'refund', 499, 'evt_test_rita_00002') r)
  and (select status = 'refunded' and reversed_at is not null from public.purchases where stripe_session_id = 'cs_test_rita_000001')
  and (select money_spent_cents from public.player_stats where user_id = :P3) = 0
  and (select flags -> 'payment_review' ->> 'kind' from public.profiles where id = :P3) = 'refund'
  and (select count(*) from public.oreshard_ledger where user_id = :P3 and reason = 'reversal' and delta = -550 and amount_cents = -499) = 1);
select pg_temp.ok('the same refund again changes nothing', (select r ->> 'repeat' = 'true' from public.oreshard_reverse('pi_test_rita_000001', 'refund', 499, 'evt_test_rita_00003') r)
  and (select oreshards from public.oreshard_wallets where user_id = :P3) = -400);
select pg_temp.refused('below zero, nothing can be spent until the balance is back', :P3, 'aal1', $q$ select public.oreshards_to_coins(1, 'conv-rita-0002') $q$, 'owes Oreshards');
select pg_temp.ok('my_oreshards shows the negative balance and the refunded purchase',
  (select (j ->> 'oreshards')::int = -400 and exists (select 1 from jsonb_array_elements(j -> 'purchases') e(x) where x ->> 'status' = 'refunded') from pg_temp.json_as(:P3, 'aal1', 'select public.my_oreshards()') j));
select pg_temp.ok('a chargeback after a refund only changes the mark to disputed',
  (select r ->> 'repeat' = 'true' from public.oreshard_reverse('pi_test_rita_000001', 'dispute', 499, 'evt_test_rita_00004') r)
  and (select status from public.purchases where stripe_session_id = 'cs_test_rita_000001') = 'disputed');
select pg_temp.ok('a reversal for an unknown payment does nothing', (select r ->> 'ok' = 'false' from public.oreshard_reverse('pi_test_nobody_0001', 'refund', 1, 'evt_test_rita_00005') r));
select pg_temp.refused('a reversal kind must be refund or dispute', null, 'aal1', $q$ select public.oreshard_reverse('pi_test_rita_000001', 'oops', 1, 'evt_test_rita_00006') $q$, 'refund or dispute');
select pg_temp.ok('stripe_event_forget: an event whose handler failed (no result) is forgotten so the retry is handled; a handled one stays',
  public.stripe_event_begin('evt_test_forget_0001', 'charge.refunded') and public.stripe_event_forget('evt_test_forget_0001') and public.stripe_event_begin('evt_test_forget_0001', 'charge.refunded')
  and not public.stripe_event_forget('evt_test_rita_00001'));

-- ========== 6. Admin ==========
select pg_temp.ok('admin_oreshards: Ken sees the balance, money spent, the purchases with their Stripe ids and the review flag',
  (select (j ->> 'oreshards')::int = -400 and jsonb_array_length(j -> 'purchases') = 1 and j -> 'purchases' -> 0 ->> 'session' = 'cs_test_rita_000001' and j -> 'review' ->> 'kind' = 'refund'
   from pg_temp.json_as(:A1, 'aal2', format('select public.admin_oreshards(%L)', :P3)) j));
select pg_temp.refused('a player cannot open admin_oreshards', :P1, 'aal1', format('select public.admin_oreshards(%L)', :P3), 'admin');
select pg_temp.ok('admin_player_detail money spent follows the purchases (999 for the buyer)',
  (select (j ->> 'money_spent_cents')::int = 999 from pg_temp.json_as(:A1, 'aal2', format('select public.admin_player_detail(%L)', :P1)) j));
select pg_temp.works('admin can change the bundles (admin-editable prices)', :A1, 'aal2',
  $q$ select public.admin_set_setting('oreshard_bundles', '[{"id": "pouch", "name": "Pouch of Oreshards", "usd_cents": 249, "oreshards": 200, "bonus_pct": 0}, {"id": "sack", "name": "Sack of Oreshards", "usd_cents": 499, "oreshards": 550, "bonus_pct": 10}, {"id": "chest", "name": "Chest of Oreshards", "usd_cents": 999, "oreshards": 1200, "bonus_pct": 20}, {"id": "hoard", "name": "Hoard of Oreshards", "usd_cents": 1999, "oreshards": 2600, "bonus_pct": 30}]', 'test: pouch 2.49') $q$);
select pg_temp.ok('... and the page sells at the new price', (select (x ->> 'usd_cents')::int = 249 from jsonb_array_elements(private.setting('oreshard_bundles')) e(x) where x ->> 'id' = 'pouch'));
select pg_temp.refused('a bundle under Stripe''s 50-cent minimum is refused', :A1, 'aal2', $q$ select public.admin_set_setting('oreshard_bundles', '[{"id": "tiny", "name": "Tiny", "usd_cents": 10, "oreshards": 5, "bonus_pct": 0}]', 'test') $q$, '50-99999');
select pg_temp.refused('two bundles with one id are refused', :A1, 'aal2', $q$ select public.admin_set_setting('oreshard_bundles', '[{"id": "pouch", "name": "A", "usd_cents": 199, "oreshards": 200, "bonus_pct": 0}, {"id": "pouch", "name": "B", "usd_cents": 299, "oreshards": 300, "bonus_pct": 0}]', 'test') $q$, 'share an id');
select pg_temp.works('admin can switch the shop off and on', :A1, 'aal2', $q$ select public.admin_set_setting('oreshards_enabled', 'false', 'test: off'), public.admin_set_setting('oreshards_enabled', 'true', 'test: on') $q$);
select pg_temp.refused('oreshards_enabled takes only true or false', :A1, 'aal2', $q$ select public.admin_set_setting('oreshards_enabled', '"yes"', 'test') $q$, 'true or false');

-- ========== 7. Locks ==========
select pg_temp.ok('RLS is on for the Oreshard tables and players have no privilege on them',
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('oreshard_wallets', 'oreshard_ledger', 'purchases', 'stripe_events'))
  and not exists (select 1 from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name in ('oreshard_wallets', 'oreshard_ledger', 'purchases', 'stripe_events') and g.grantee in ('anon', 'authenticated')));

select n, case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by n;
do $$ declare f int := (select count(*) from results where not ok); t int := (select count(*) from results);
begin
  raise notice '% of % checks passed', t - f, t;
  if f > 0 then raise exception '% check(s) FAILED', f; end if;
end $$;
rollback;

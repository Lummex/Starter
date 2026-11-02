-- Oreheart Online, Phase B: cards, packs, deck ownership, settings and match rewards.
-- Run against a LOCAL database only (supabase start, or the local shim), never the real project:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_bc_economy.test.sql
-- Everything happens in one transaction that is rolled back at the end. Players are simulated
-- like the API does it (role authenticated + JWT claims). Exits non-zero if any check fails.

\ir _helpers.sql

-- ---------- test accounts (fixed ids) ----------
insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('c0000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'shopkeeper@test.local', '{"username":"ShopKeeper"}', now()),
  ('c0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'e1@test.local', '{"username":"Pack_Ripper"}', now()),
  ('c0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'e2@test.local', '{"username":"Coin_Short"}', now()),
  ('c0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'e3@test.local', '{"username":"Odds_Counter"}', now());
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'shopkeeper@test.local';

\set A1 '''c0000000-0000-4000-8000-000000000009'''
\set P1 '''c0000000-0000-4000-8000-000000000001'''
\set P2 '''c0000000-0000-4000-8000-000000000002'''
\set P3 '''c0000000-0000-4000-8000-000000000003'''

-- ========== 1. The cards copy and the rarity tiers ==========
select pg_temp.ok('cards: 66 cards copied from cards.json',
  (select count(*) from public.cards) = 66);
select pg_temp.ok('cards: every card id is also in settings card_ids',
  not exists (select 1 from public.cards c where not (c.id = any (private.setting_text_list('card_ids')))));
select pg_temp.ok('cards: crystals and disabled cards are never in packs; every other card is',
  (select bool_and(in_packs = (type in ('creature', 'spell') and not disabled)) from public.cards)
  and (select count(*) from public.cards where in_packs) = 60);
select pg_temp.ok('rarities: the 5 tiers in order',
  (select array_agg(name order by sort) from public.rarities) = array['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Collector']);
select pg_temp.ok('player can read cards and rarities',
  pg_temp.count_as(:P1, 'aal1', 'select * from public.cards') = 66 and pg_temp.count_as(:P1, 'aal1', 'select * from public.rarities') = 5);

-- ========== 2. Pack odds ==========
do $$ declare err text;
begin
  begin
    insert into public.pack_slots (pack_type, slot_no, count, odds) values ('standard', 9, 1, '{"Common": 9999}');
  exception when others then err := sqlerrm; end;
  perform pg_temp.ok('odds that add up to 9999 are refused', err is not null, coalesce(err, 'accepted'));
  err := null;
  begin
    insert into public.pack_slots (pack_type, slot_no, count, odds) values ('standard', 9, 1, '{"Common": 5000, "Shiny": 5000}');
  exception when others then err := sqlerrm; end;
  perform pg_temp.ok('odds with an unknown rarity are refused', err is not null, coalesce(err, 'accepted'));
  err := null;
  begin
    insert into public.pack_slots (pack_type, slot_no, count, odds) values ('standard', 9, 1, '{"Common": 9000, "Rare": 1000}');
    delete from public.pack_slots where pack_type = 'standard' and slot_no = 9;
  exception when others then err := sqlerrm; end;
  perform pg_temp.ok('odds that add up to 10000 are accepted', err is null, coalesce(err, ''));
end $$;
select pg_temp.ok('4 default packs, each 8 cards (5 Common, 2 Uncommon, 1 Rare or better), 100 coins, 50 a day',
  (select count(*) from public.pack_types where active and price_coins = 100 and max_per_day = 50) = 4
  and (select count(*) from (select pack_type, sum(count) n from public.pack_slots group by pack_type having sum(count) = 8) x) = 4
  and (select bool_and(odds = '{"Rare": 8500, "Ultra Rare": 1300, "Collector": 200}'::jsonb) from public.pack_slots where slot_no = 3));

-- ========== 3. shop_info ==========
select pg_temp.ok('shop_info: 4 packs, coins 300, no free packs, nothing opened today, odds sum 10000 per slot',
  (select jsonb_array_length(j -> 'packs') = 4 and (j ->> 'coins')::int = 300 and (j ->> 'free_packs')::int = 0
          and (select bool_and((p ->> 'opened_today')::int = 0 and jsonb_array_length(p -> 'slots') = 3) from jsonb_array_elements(j -> 'packs') p)
          and (select bool_and((select sum((v #>> '{}')::int) from jsonb_each(s -> 'odds') e(k, v)) = 10000)
               from jsonb_array_elements(j -> 'packs') p, jsonb_array_elements(p -> 'slots') s)
          and j -> 'packs' -> 0 ->> 'id' = 'standard'
   from pg_temp.json_as(:P1, 'aal1', 'select public.shop_info()') j),
  pg_temp.json_as(:P1, 'aal1', 'select public.shop_info()')::text);
select pg_temp.refused('shop_info needs a login', null, null, 'select public.shop_info()');

-- ========== 4. Opening a pack ==========
create temp table o1 as select pg_temp.json_as(:P1, 'aal1', $q$ select public.open_pack('standard', 'k1-aaaaaaaa-1111', false) $q$) as j;
select pg_temp.ok('open_pack: returns the contract shape',
  (select j ? 'opening_id' and j ->> 'pack_type' = 'standard' and (j ->> 'price_paid')::int = 100 and (j ->> 'free')::boolean = false
          and jsonb_array_length(j -> 'cards') = 8 and (j ->> 'coins_after')::int = 200 and (j ->> 'free_packs_after')::int = 0
          and jsonb_array_length(j -> 'odds') = 3
          and (select bool_and(c ? 'card_id' and c ? 'rarity' and jsonb_typeof(c -> 'is_new') = 'boolean') from jsonb_array_elements(j -> 'cards') c)
   from o1), (select j::text from o1));
select pg_temp.ok('open_pack: 5 Common, 2 Uncommon, then one Rare or better, in slot order',
  (select (select array_agg(c ->> 'rarity' order by o) from jsonb_array_elements(j -> 'cards') with ordinality x(c, o) where o <= 7)
            = array['Common', 'Common', 'Common', 'Common', 'Common', 'Uncommon', 'Uncommon']
          and (j -> 'cards' -> 7 ->> 'rarity') in ('Rare', 'Ultra Rare', 'Collector')
   from o1));
select pg_temp.ok('open_pack: every dealt card is a real pack card and the rarity matches the cards table',
  (select bool_and(k.in_packs and k.rarity = c ->> 'rarity') from o1, jsonb_array_elements(j -> 'cards') c join public.cards k on k.id = c ->> 'card_id'));
select pg_temp.ok('open_pack: is_new is true exactly for cards the player did not own before (the starter collection)',
  (select bool_and((c ->> 'is_new')::boolean = not ((select value from public.settings where key = 'starter_collection') ? (c ->> 'card_id')))
   from o1, jsonb_array_elements(j -> 'cards') c));
select pg_temp.ok('open_pack: 8 card instances made through card_grant (origin pack, ref = opening id, own ids, history rows)',
  (select count(*) from public.card_instances ci where ci.owner_id = :P1 and ci.origin = 'pack' and ci.origin_ref = (select j ->> 'opening_id' from o1)) = 8
  and (select count(*) from public.card_history h join public.card_instances ci on ci.id = h.card_instance_id
       where ci.owner_id = :P1 and ci.origin = 'pack' and h.event = 'created') = 8);
select pg_temp.ok('open_pack: one pack_purchase ledger row of -100, balance 200',
  (select count(*) from public.transactions where user_id = :P1 and reason = 'pack_purchase') = 1
  and (select delta = -100 and balance_after = 200 from public.transactions where user_id = :P1 and reason = 'pack_purchase'));
select pg_temp.ok('open_pack: one pack_openings row with the odds snapshot and the 8 card ids',
  (select count(*) from public.pack_openings where user_id = :P1) = 1
  and (select cardinality(cards) = 8 and jsonb_array_length(odds_snapshot) = 3 and price_paid = 100 and not free from public.pack_openings where user_id = :P1));
select pg_temp.ok('open_pack: player_stats packs_opened 1, coins_spent 100',
  (select packs_opened = 1 and coins_spent = 100 from public.player_stats where user_id = :P1));
select pg_temp.ok('shop_info: opened_today is 1 for the standard pack now',
  (select (p ->> 'opened_today')::int from pg_temp.json_as(:P1, 'aal1', 'select public.shop_info()') j, jsonb_array_elements(j -> 'packs') p where p ->> 'id' = 'standard') = 1);

-- ========== 5. Idempotency: the same key 10 times = one charge ==========
do $$ declare i int; r jsonb; first jsonb := (select j from o1);
begin
  for i in 1..10 loop
    r := pg_temp.json_as('c0000000-0000-4000-8000-000000000001', 'aal1', $q$ select public.open_pack('standard', 'k1-aaaaaaaa-1111', false) $q$);
    if r ->> 'opening_id' <> first ->> 'opening_id' or r -> 'cards' <> first -> 'cards' or (r ->> 'coins_after')::int <> 200 then
      perform pg_temp.ok('idem: repeat ' || i || ' returned a different opening', false, r::text);
      return;
    end if;
  end loop;
  perform pg_temp.ok('idem: the same idem_key 10 times returns the same opening, same cards, coins still 200', true);
end $$;
select pg_temp.ok('idem: still one opening, one charge, 8 pack cards',
  (select count(*) from public.pack_openings where user_id = :P1) = 1
  and (select count(*) from public.transactions where user_id = :P1 and reason = 'pack_purchase') = 1
  and (select coins from public.wallets where user_id = :P1) = 200
  and (select count(*) from public.card_instances where owner_id = :P1 and origin = 'pack') = 8);
select pg_temp.refused('idem: another player cannot reuse my idem_key', :P2, 'aal1',
  $q$ select public.open_pack('standard', 'k1-aaaaaaaa-1111', false) $q$, 'already used');
select pg_temp.refused('open_pack: a short idem_key is refused', :P1, 'aal1', $q$ select public.open_pack('standard', 'short', false) $q$, 'idem_key');

-- ========== 6. Coins can't go below zero ==========
select private.ledger_apply(:P2, -150, 'admin_grant', 'test', 'test-setup-p2-150', null);
select pg_temp.works('150 coins: the first 100-coin pack opens', :P2, 'aal1', $q$ select public.open_pack('standard', 'k2-bbbbbbbb-0001', false) $q$);
select pg_temp.refused('150 coins: the second 100-coin pack is refused (not enough coins)', :P2, 'aal1',
  $q$ select public.open_pack('standard', 'k2-bbbbbbbb-0002', false) $q$, 'not enough coins');
select pg_temp.ok('150 coins: exactly one opening, 50 coins left, no cards from the refused one',
  (select count(*) from public.pack_openings where user_id = :P2) = 1
  and (select coins from public.wallets where user_id = :P2) = 50
  and (select count(*) from public.card_instances where owner_id = :P2 and origin = 'pack') = 8);

-- ========== 7. Daily limit, inactive pack, free packs ==========
update public.pack_types set max_per_day = 1 where id = 'goblin';
select pg_temp.works('daily limit: first Junkpile pack of the day opens', :P1, 'aal1', $q$ select public.open_pack('goblin', 'k1-gggggggg-0001', false) $q$);
select pg_temp.refused('daily limit: the second is refused when max_per_day = 1', :P1, 'aal1',
  $q$ select public.open_pack('goblin', 'k1-gggggggg-0002', false) $q$, 'enough');
update public.pack_types set max_per_day = 50 where id = 'goblin';
select pg_temp.ok('faction pack: every card is of that faction or neutral',
  (select bool_and(k.faction in ('goblins', 'any')) from public.pack_openings o, unnest(o.cards) c join public.cards k on k.id = c
   where o.user_id = :P1 and o.pack_type = 'goblin'));
update public.pack_types set active = false where id = 'dwarf';
select pg_temp.refused('inactive pack is not for sale', :P1, 'aal1', $q$ select public.open_pack('dwarf', 'k1-dddddddd-0001', false) $q$, 'not for sale');
select pg_temp.ok('inactive pack is hidden from the shop',
  (select jsonb_array_length(j -> 'packs') from pg_temp.json_as(:P1, 'aal1', 'select public.shop_info()') j) = 3);
update public.pack_types set active = true where id = 'dwarf';
select pg_temp.refused('unknown pack is refused', :P1, 'aal1', $q$ select public.open_pack('mystery', 'k1-mmmmmmmm-0001', false) $q$, 'not for sale');

update public.wallets set free_packs = 1 where user_id = :P2;
select pg_temp.ok('free pack: opens without coins, free = true, price_paid 0, free_packs_after 0',
  (select (j ->> 'free')::boolean and (j ->> 'price_paid')::int = 0 and (j ->> 'coins_after')::int = 50 and (j ->> 'free_packs_after')::int = 0
          and jsonb_array_length(j -> 'cards') = 8
   from pg_temp.json_as(:P2, 'aal1', $q$ select public.open_pack('standard', 'k2-ffffffff-0001', true) $q$) j));
select pg_temp.ok('free pack: no ledger row, the opening says free',
  (select count(*) from public.transactions where user_id = :P2 and reason = 'pack_purchase') = 1
  and (select count(*) from public.pack_openings where user_id = :P2 and free) = 1);
select pg_temp.refused('free pack: none left -> refused', :P2, 'aal1', $q$ select public.open_pack('standard', 'k2-ffffffff-0002', true) $q$, 'no free pack');

-- ========== 8. Odds spread: 1,000 openings ==========
select private.ledger_apply(:P3, 100000, 'admin_grant', 'test', 'test-setup-p3-100k', null);
update public.pack_types set max_per_day = 100000 where id = 'standard';
do $$ declare i int; r jsonb;
begin
  for i in 1..1000 loop
    r := pg_temp.json_as('c0000000-0000-4000-8000-000000000003', 'aal1',
           format($q$ select public.open_pack('standard', %L, false) $q$, 'k3-spread-' || lpad(i::text, 6, '0')));
    if r ? 'error' then perform pg_temp.ok('spread: opening ' || i || ' failed', false, r ->> 'error'); return; end if;
  end loop;
  perform pg_temp.ok('spread: 1,000 openings went through', true);
end $$;
update public.pack_types set max_per_day = 50 where id = 'standard';
create temp table spread as
  select k.rarity, count(*) n from public.pack_openings o, unnest(o.cards) with ordinality u(c, pos) join public.cards k on k.id = u.c
  where o.user_id = 'c0000000-0000-4000-8000-000000000003' and pos = 8 group by k.rarity;
select pg_temp.ok('spread: 1,000 openings cost 100,000 coins and made 8,000 cards',
  (select coins from public.wallets where user_id = :P3) = 300
  and (select count(*) from public.card_instances where owner_id = :P3 and origin = 'pack') = 8000
  and (select count(*) from public.pack_openings where user_id = :P3) = 1000);
select pg_temp.ok('spread: the rare slot gave Rare 850 +/- 60 times',
  coalesce((select n from spread where rarity = 'Rare'), 0) between 790 and 910,
  (select string_agg(rarity || '=' || n, ', ') from spread));
select pg_temp.ok('spread: Ultra Rare about 130 (70..200) and Collector about 20 (3..50); nothing below Rare in that slot',
  coalesce((select n from spread where rarity = 'Ultra Rare'), 0) between 70 and 200
  and coalesce((select n from spread where rarity = 'Collector'), 0) between 3 and 50
  and not exists (select 1 from spread where rarity in ('Common', 'Uncommon')),
  (select string_agg(rarity || '=' || n, ', ') from spread));
select pg_temp.ok('spread: slots 1-5 always Common, 6-7 always Uncommon',
  (select bool_and(case when pos <= 5 then k.rarity = 'Common' when pos <= 7 then k.rarity = 'Uncommon' else true end)
   from public.pack_openings o, unnest(o.cards) with ordinality u(c, pos) join public.cards k on k.id = u.c where o.user_id = :P3));
select pg_temp.ok('spread: every pack card came up at least once in 8,000 draws (no card is unreachable)',
  not exists (select 1 from public.cards k where k.in_packs
              and not exists (select 1 from public.card_instances ci where ci.owner_id = :P3 and ci.card_id = k.id)));
select pg_temp.ok('random_below stays inside 0..n-1 over 2,000 draws',
  (select bool_and(private.random_below(7) between 0 and 6) from generate_series(1, 2000)));

-- ========== 9. Fallback to the next lower rarity ==========
insert into public.pack_types (id, name, price_coins, faction, max_per_day) values ('testfb', 'Fallback Test', 0, 'dwarves', 1000);
insert into public.pack_slots (pack_type, slot_no, count, odds) values ('testfb', 1, 1, '{"Collector": 10000}');
update public.cards set in_packs = false where faction = 'dwarves' and rarity = 'Collector';
select pg_temp.ok('fallback: a Collector slot with no Collector card in the pool deals an Ultra Rare',
  (select j -> 'cards' -> 0 ->> 'rarity' from pg_temp.json_as(:P1, 'aal1', $q$ select public.open_pack('testfb', 'k1-fallback-0001', false) $q$) j) = 'Ultra Rare');
update public.cards set in_packs = false where faction in ('dwarves', 'any') and rarity in ('Ultra Rare', 'Rare', 'Uncommon');
select pg_temp.ok('fallback: ... all the way down to Common when nothing else is left',
  (select j -> 'cards' -> 0 ->> 'rarity' from pg_temp.json_as(:P1, 'aal1', $q$ select public.open_pack('testfb', 'k1-fallback-0002', false) $q$) j) = 'Common');
update public.cards set in_packs = (type in ('creature', 'spell') and not disabled);
select pg_temp.ok('a free (0 coin) pack makes no ledger row',
  (select count(*) from public.transactions where user_id = :P1 and reason = 'pack_purchase' and ref in
     (select id::text from public.pack_openings where pack_type = 'testfb')) = 0);

-- ========== 10. Deck ownership ==========
-- (packs opened above may have added copies, so the owned count is read first)
create temp table wolves as
  select count(*)::int as n from public.card_instances where owner_id = :P1 and card_id = 'wolf-rider' and status = 'owned';
select pg_temp.refused('deck: more copies than owned is refused (one more wolf-rider than owned)', :P1, 'aal1',
  format($q$ select public.save_deck(null, 'Wolf Pack', 'grubnak', array(select 'wolf-rider' from generate_series(1, %s))) $q$, (select n + 1 from wolves)),
  format('you own %s of Mangewolf Rider', (select n from wolves)));
select pg_temp.works('deck: exactly as many copies as owned is fine (4 goblin-grunt)', :P1, 'aal1',
  $q$ select public.save_deck(null, 'Grunts', 'grubnak', array['goblin-grunt','goblin-grunt','goblin-grunt','goblin-grunt']) $q$);
select pg_temp.works('deck: crystals are unlimited (50 soul-shard, owns 4)', :P1, 'aal1',
  $q$ select public.save_deck(null, 'Shards', 'grubnak', array(select 'soul-shard' from generate_series(1, 50))) $q$);
select pg_temp.ok('deck: the three starter decks still build for a new player (all cards owned)',
  pg_temp.json_as(:P1, 'aal1', $q$ select public.import_local_decks('[{"name":"Starter","commander":"grubnak","cards":["goblin-scrounger","goblin-scrounger","fizzle"]}]'::jsonb) $q$) ->> 'imported' = '1');
select pg_temp.ok('deck: import skips a deck with more copies than owned (61 copies of a 2-copy starter card)',
  (pg_temp.json_as(:P2, 'aal1', $q$ select public.import_local_decks(jsonb_build_array(jsonb_build_object('name', 'Too Many', 'commander', 'grubnak',
      'cards', (select jsonb_agg('wolf-rider'::text) from generate_series(1, 61))))) $q$) -> 'skipped' -> 0 ->> 'problem') like 'you own % of Mangewolf Rider',
  pg_temp.json_as(:P2, 'aal1', $q$ select public.import_local_decks('[]'::jsonb) $q$)::text);

-- ========== 11. Players can't touch the economy tables directly ==========
select pg_temp.refused('player cannot write pack_openings', :P1, 'aal1',
  $q$ insert into public.pack_openings (user_id, pack_type, price_paid, odds_snapshot, cards, idem_key, result)
      values ('c0000000-0000-4000-8000-000000000001', 'standard', 0, '[]', '{}', 'hack-hack-hack', '{}') $q$);
select pg_temp.refused('player cannot change pack_openings', :P1, 'aal1', $q$ update public.pack_openings set price_paid = 0 $q$);
select pg_temp.refused('player cannot delete pack_openings', :P1, 'aal1', $q$ delete from public.pack_openings $q$);
select pg_temp.refused('player cannot change pack prices', :P1, 'aal2', $q$ update public.pack_types set price_coins = 0 $q$);
select pg_temp.refused('player cannot change pack odds', :P1, 'aal2', $q$ update public.pack_slots set odds = '{"Collector": 10000}' $q$);
select pg_temp.refused('player cannot change the cards table', :P1, 'aal2', $q$ update public.cards set rarity = 'Collector' $q$);
select pg_temp.refused('player cannot give themself free packs', :P1, 'aal1', $q$ update public.wallets set free_packs = 99 $q$);
select pg_temp.refused('player cannot roll cards directly', :P1, 'aal1', $q$ select private.pack_roll_card(null, '{"Collector": 10000}') $q$);
select pg_temp.refused('player cannot call random_below', :P1, 'aal1', $q$ select private.random_below(10) $q$);
select pg_temp.refused('player cannot call match_reward', :P1, 'aal1', $q$ select private.match_reward('c0000000-0000-4000-8000-000000000001', gen_random_uuid(), true, 9) $q$);
select pg_temp.ok('player sees only their own pack openings',
  pg_temp.count_as(:P1, 'aal1', 'select * from public.pack_openings') = (select count(*) from public.pack_openings where user_id = :P1)
  and pg_temp.count_as(:P1, 'aal1', $q$ select * from public.pack_openings where user_id = 'c0000000-0000-4000-8000-000000000003' $q$) = 0);
do $$ declare err text;
begin
  begin update public.pack_openings set price_paid = 1 where user_id = 'c0000000-0000-4000-8000-000000000001'; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('pack_openings are append-only even for the database owner', err like '%append-only%', coalesce(err, 'updated'));
  err := null;
  begin delete from public.pack_openings where user_id = 'c0000000-0000-4000-8000-000000000001'; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('pack_openings cannot be deleted even by the database owner', err like '%append-only%', coalesce(err, 'deleted'));
  err := null;
  begin update public.transactions set delta = 0 where user_id = 'c0000000-0000-4000-8000-000000000001'; exception when others then err := sqlerrm; end;
  perform pg_temp.ok('transactions are still append-only', err like '%append-only%', coalesce(err, 'updated'));
end $$;

-- ========== 12. Settings ==========
select pg_temp.ok('settings: the Phase B/C keys exist with their defaults',
  (select jsonb_object_agg(key, value) from public.settings where key like 'pvp_%' or key like 'quest_%')
  = '{"pvp_win_coins":25,"pvp_loss_coins":10,"pvp_daily_coin_cap":300,"pvp_min_turns":3,"quest_reward_easy":25,"quest_reward_medium":50,
      "quest_reward_hard":75,"quest_streak_days":7,"pvp_phase_seconds":120,"pvp_bank_seconds":60,"pvp_respond_seconds":12,"pvp_timeouts_to_forfeit":3}'::jsonb);
select pg_temp.works('admin can set pvp_win_coins', :A1, 'aal2', $q$ select public.admin_set_setting('pvp_win_coins', '30', 'test: raise the win reward') $q$);
select pg_temp.ok('... and it is stored and audited',
  private.setting('pvp_win_coins') = '30'::jsonb
  and exists (select 1 from public.admin_audit where action = 'set_setting' and after ->> 'key' = 'pvp_win_coins'));
select pg_temp.refused('setting must be a whole number', :A1, 'aal2', $q$ select public.admin_set_setting('pvp_win_coins', '10.5', 'test') $q$, 'whole number');
select pg_temp.refused('setting outside its range is refused (pvp_respond_seconds 1)', :A1, 'aal2',
  $q$ select public.admin_set_setting('pvp_respond_seconds', '1', 'test') $q$, 'must be 3 to 600');
select pg_temp.refused('setting outside its range is refused (quest_streak_days 0)', :A1, 'aal2',
  $q$ select public.admin_set_setting('quest_streak_days', '0', 'test') $q$, 'must be 1 to 365');
select pg_temp.refused('the old word-list rules still apply', :A1, 'aal2', $q$ select public.admin_set_setting('blocked_words', '["x1"]', 'test') $q$, 'not allowed');
select pg_temp.refused('commander_names is not editable in the back counter', :A1, 'aal2', $q$ select public.admin_set_setting('commander_names', '{}', 'test') $q$, 'can''t be changed');
select pg_temp.ok('admin_get_settings lists the new keys',
  (pg_temp.json_as(:A1, 'aal2', 'select public.admin_get_settings()') ? 'pvp_phase_seconds'));
select pg_temp.refused('a player cannot set pvp_win_coins', :P1, 'aal2', $q$ select public.admin_set_setting('pvp_win_coins', '9999', 'me') $q$, 'not admin');
update public.settings set value = '25' where key = 'pvp_win_coins';

-- ========== 13. match_reward ==========
-- (calls and checks in order inside one block: in a plain SELECT the sub-queries would run first)
do $$
declare
  u uuid := 'c0000000-0000-4000-8000-000000000001';
  r1 int; r2 int; r3 int; r4 int; r5 int; r6 int;
  st public.player_stats;
begin
  r1 := private.match_reward(u, '11111111-0000-4000-8000-000000000001', true, 5, 'grubnak');
  r2 := private.match_reward(u, '11111111-0000-4000-8000-000000000001', true, 5, 'grubnak');
  perform pg_temp.ok('match_reward: a 5-turn win pays 25 once (second call 0, one ledger row with idem match:<match>:<user>)',
    r1 = 25 and r2 = 0
    and (select count(*) from public.transactions where user_id = u and reason = 'match_reward') = 1
    and (select idem_key from public.transactions where user_id = u and reason = 'match_reward')
        = 'match:11111111-0000-4000-8000-000000000001:c0000000-0000-4000-8000-000000000001',
    format('paid %s then %s', r1, r2));
  select * into st from public.player_stats where user_id = u;
  perform pg_temp.ok('match_reward: stats counted once (games 1, wins 1, by_commander grubnak, last_match_at set)',
    st.games = 1 and st.wins = 1 and st.losses = 0 and st.win_streak = 1 and st.last_match_at is not null and st.coins_earned = 25
    and (st.by_commander -> 'grubnak' ->> 'games')::int = 1 and (st.by_commander -> 'grubnak' ->> 'wins')::int = 1, st::text);
  r3 := private.match_reward(u, '11111111-0000-4000-8000-000000000002', false, 4, 'borgo');
  select * into st from public.player_stats where user_id = u;
  perform pg_temp.ok('match_reward: a loss pays 10 and ends the win streak', r3 = 10 and st.losses = 1 and st.win_streak = 0, format('paid %s', r3));
  r4 := private.match_reward(u, '11111111-0000-4000-8000-000000000003', true, 2, 'grubnak');
  select * into st from public.player_stats where user_id = u;
  perform pg_temp.ok('match_reward: a 2-turn match pays nothing but still counts as a game',
    r4 = 0 and st.games = 3 and (select count(*) from public.transactions where user_id = u and reason = 'match_reward') = 2, format('paid %s', r4));
  update public.settings set value = '50' where key = 'pvp_daily_coin_cap';
  r5 := private.match_reward(u, '11111111-0000-4000-8000-000000000004', true, 6, 'grubnak');
  r6 := private.match_reward(u, '11111111-0000-4000-8000-000000000005', true, 6, 'grubnak');
  perform pg_temp.ok('match_reward: the daily cap (50) pays only what still fits: 15, then 0',
    r5 = 15 and r6 = 0 and (select sum(delta) from public.transactions where user_id = u and reason = 'match_reward') = 50,
    format('paid %s then %s', r5, r6));
  update public.settings set value = '300' where key = 'pvp_daily_coin_cap';
end $$;
select pg_temp.ok('match_rewards rows: one per match and player, readable by that player only',
  (select count(*) from public.match_rewards where user_id = :P1) = 5
  and pg_temp.count_as(:P1, 'aal1', 'select * from public.match_rewards') = 5
  and pg_temp.count_as(:P2, 'aal1', 'select * from public.match_rewards') = 0);

-- ========== 14. The old whole-database checks still hold ==========
select pg_temp.ok('no table in public lets anon or players insert, update or delete',
  not exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
                and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')));
select pg_temp.ok('every new table has row level security on',
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('cards', 'rarities', 'pack_types', 'pack_slots', 'pack_openings', 'match_rewards')));
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

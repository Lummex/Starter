-- Zero start (Ken, Nov 4): a new player owns NO cards and gets 500 coins. The three starter decks stay playable for
-- everyone (they are the game's own lists, never owned cards), but can't be edited, and deck building uses owned
-- cards only, so the first deck of your own comes from packs.
--   "you have the starter decks that you can't edit, that's all you can play with until you buy cards. So you should
--    start with 0 cards ... it shows 300 credits for free when you get the game, let's make that 500 credits."
-- Both numbers stay admin-editable settings; this only changes their values.

update public.settings set value = '500'::jsonb where key = 'signup_bonus_coins';
update public.settings set value = '{}'::jsonb where key = 'starter_collection';

-- TEST project only (server_kind = 'test'): accounts made under the old rule show the new one, so Ken need not remake
-- his. Every starter card is withdrawn, not deleted: the instance row stays with owner null and status 'destroyed',
-- and the append-only history gets a 'destroyed' row saying why. Every wallet gets the 200 coins the new bonus adds,
-- as a normal ledger row. On the real project nothing here runs (no server_kind row, or not 'test').
do $$
declare n integer := 0; w record;
begin
  if (select value #>> '{}' from public.settings where key = 'server_kind') is distinct from 'test' then
    raise notice 'zero start: not the test project, no account changed';
    return;
  end if;
  with gone as (
    update public.card_instances ci
       set owner_id = null, status = 'destroyed', updated_at = now()
     where ci.origin = 'starter' and ci.status = 'owned' and ci.owner_id is not null
    returning ci.id, ci.original_owner_id
  )
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
  select gone.id, 'destroyed', gone.original_owner_id, null, 'starter_withdrawn', 'zero-start-nov4', null from gone;
  get diagnostics n = row_count;
  raise notice 'zero start: % starter cards withdrawn', n;
  for w in select user_id from public.wallets loop
    perform private.ledger_apply(w.user_id, 200, 'admin_grant', 'zero-start-nov4', 'zero-start-nov4:' || w.user_id, null);
  end loop;
end $$;

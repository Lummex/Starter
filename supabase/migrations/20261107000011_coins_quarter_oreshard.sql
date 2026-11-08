-- Nov 7 (Ken: "raise it to 400 coins a pack, and then 1 shard equals 4 coins ... adjust the quest daily quest points accordingly";
-- "eight packs in a week sound good"). Production-safe: plain updates and one function replaced, re-runnable.
--  * Packs cost 400 coins (were 100). Their Oreshard price = coins x oreshard_pack_rate = 400 x 0.25 = 100 Oreshards (unchanged).
--  * 1 Oreshard = 4 coins: Oreshards -> Coins now gives 1 / oreshard_pack_rate coins per Oreshard (4), so the two rates always agree.
--  * Daily quests 75 / 125 / 200 = 400 coins = one pack a day; with the weekly streak pack that is 8 packs a week.
--  * PvP coins and the signup coins are not changed here (admin settings).
update public.pack_types set price_coins = 400 where price_coins = 100;
update public.settings set value = '0.25'::jsonb, updated_at = now() where key = 'oreshard_pack_rate';
update public.settings set value = '75'::jsonb, updated_at = now() where key = 'quest_reward_easy';
update public.settings set value = '125'::jsonb, updated_at = now() where key = 'quest_reward_medium';
update public.settings set value = '200'::jsonb, updated_at = now() where key = 'quest_reward_hard';

create or replace function public.oreshards_to_coins(p_n integer, p_idem_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); bal integer; l public.oreshard_ledger; t public.transactions; b public.bans;
  per integer := greatest(1, round(1 / greatest(0.01, coalesce((private.setting('oreshard_pack_rate'))::numeric, 1)))::int); -- coins per Oreshard (4 at 0.25)
begin
  if uid is null then raise exception 'not logged in' using errcode = '28000'; end if;
  b := private.active_ban(uid);
  if b.id is not null then raise exception 'This account is banned.'; end if;
  if p_n is null or p_n < 1 or p_n > 1000000 then raise exception 'How many Oreshards? (1 or more)'; end if;
  if p_idem_key is null or p_idem_key !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'bad idem_key'; end if;
  bal := coalesce((select oreshards from public.oreshard_wallets where user_id = uid), 0);
  if bal < 0 then raise exception 'This account owes Oreshards from a refund; nothing can be spent until it is back to zero.'; end if;
  if bal < p_n then raise exception 'not enough Oreshards (has %)', bal; end if;
  l := private.oreshard_apply(uid, -p_n, 'convert', 'coins', 'conv:' || p_idem_key);
  t := private.ledger_apply(uid, p_n * per, 'oreshard_convert', 'oreshards', 'conv:' || p_idem_key, uid);
  return jsonb_build_object('oreshards', l.balance_after, 'coins', t.balance_after, 'converted', p_n, 'coins_got', p_n * per, 'coins_per_oreshard', per);
end $$;
revoke all on function public.oreshards_to_coins(integer, text) from public, anon;
grant execute on function public.oreshards_to_coins(integer, text) to authenticated;

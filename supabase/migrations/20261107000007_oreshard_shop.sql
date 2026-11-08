-- Real money to packs (Ken, Nov 7: "they can purchase the currency, the real cash currency, so they can actually buy packs" and "$1 to $100").
-- * The Oreshard ladder, admin-editable: $0.99 = 100, $4.99 = 550, $9.99 = 1,200, $19.99 = 2,600, $49.99 = 7,000, $99.99 = 15,000
--   (bonus 0/10/20/30/40/50%). The $99.99 roughly buys the 99 chest (9,900).
-- * Pack bundles can be paid in Oreshards directly: price = the coin price x oreshard_pack_rate (admin setting, 1 by default).
-- * Converting Oreshards to coins stays (1:1, one way). Sleeves already sell for Oreshards. Safe for the real database.

update public.settings set value = '[{"id": "pouch", "name": "Pinch of Oreshards", "usd_cents": 99, "oreshards": 100, "bonus_pct": 0},
  {"id": "sack", "name": "Sack of Oreshards", "usd_cents": 499, "oreshards": 550, "bonus_pct": 10},
  {"id": "chest", "name": "Chest of Oreshards", "usd_cents": 999, "oreshards": 1200, "bonus_pct": 20},
  {"id": "hoard", "name": "Hoard of Oreshards", "usd_cents": 1999, "oreshards": 2600, "bonus_pct": 30},
  {"id": "vault", "name": "Vault of Oreshards", "usd_cents": 4999, "oreshards": 7000, "bonus_pct": 40},
  {"id": "mountain", "name": "Mountain of Oreshards", "usd_cents": 9999, "oreshards": 15000, "bonus_pct": 50}]'::jsonb, updated_at = now()
  where key = 'oreshard_bundles';
insert into public.settings (key, value) values ('oreshard_pack_rate', '1'::jsonb) on conflict (key) do nothing;

alter table public.oreshard_ledger drop constraint if exists oreshard_ledger_reason_check;
alter table public.oreshard_ledger add constraint oreshard_ledger_reason_check check (reason in ('purchase', 'reversal', 'convert', 'admin_grant', 'sleeve', 'pack'));

create or replace function private.editable_settings() returns text[]
language sql immutable set search_path = '' as $$
  select array['signup_bonus_coins', 'max_decks', 'blocked_words', 'reserved_usernames', 'reserved_name_parts',
               'pvp_win_coins', 'pvp_loss_coins', 'pvp_daily_coin_cap', 'pvp_min_turns',
               'quest_reward_easy', 'quest_reward_medium', 'quest_reward_hard', 'quest_streak_days',
               'pvp_phase_seconds', 'pvp_bank_seconds', 'pvp_respond_seconds', 'pvp_timeouts_to_forfeit',
               'pvp_respond_min_seconds', 'pvp_abandon_seconds', 'pvp_attack_mode',
               'upgrade_steps', 'upgrade_drop_bp', 'upgrade_drop_tiers',
               'ranked_k', 'ranked_window', 'ranked_window_step',
               'pack_miners', 'pack_commons', 'pack_uncommons', 'pack_rare_sure', 'pack_rares',
               'pack_bundles', 'pack_bundle_promises', 'pack_pity_limit', 'pack_bundles_per_day', 'shop_badges',
               'ranked_ladder', 'dashboard_counts',
               'regions', 'region_fallback_seconds', 'region_counts',
               'oreshard_bundles', 'oreshards_enabled', 'oreshard_pack_rate',
               'friends_max', 'friend_invites_enabled',
               'beta_mode']
$$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  old jsonb := private.setting(p_key);
  v jsonb := p_value;
  bad text;
  lo integer; hi integer;
  sizes int[];
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if p_key is null or not (p_key = any (private.editable_settings())) then raise exception 'that setting can''t be changed here'; end if;
  select r.lo, r.hi into lo, hi from private.int_setting_range(p_key) r;
  if lo is not null then
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then raise exception 'must be a whole number'; end if;
    if (v #>> '{}')::numeric < lo or (v #>> '{}')::numeric > hi then raise exception 'must be % to %', lo, hi; end if;
    v := to_jsonb((v #>> '{}')::int);
  elsif p_key in ('region_counts', 'dashboard_counts', 'oreshards_enabled', 'friend_invites_enabled', 'beta_mode') then
    if jsonb_typeof(v) <> 'boolean' then raise exception 'must be true or false'; end if;
  elsif p_key = 'oreshard_pack_rate' then
    -- Nov 7: Oreshards per coin of a pack's price when a player pays for packs with Oreshards (1 = the same number)
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0.1 or (v #>> '{}')::numeric > 100 then raise exception 'oreshard_pack_rate is a number from 0.1 to 100'; end if;
  elsif p_key = 'oreshard_bundles' then
    -- Nov 6: a list of {id, name, usd_cents, oreshards, bonus_pct}: 1 to 8 bundles, ids = letters (2-20) and unique, names 1-40 characters,
    -- usd_cents 50-99999 (Stripe's minimum is 50 cents), oreshards 1-1000000, bonus_pct 0-100, whole numbers
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < 1 or jsonb_array_length(v) > 8 then raise exception 'must be a list of 1 to 8 bundles'; end if;
    select coalesce(x ->> 'id', '?') into bad from jsonb_array_elements(v) e(x)
      where jsonb_typeof(x) <> 'object' or not (x ->> 'id') ~ '^[a-z][a-z0-9-]{1,19}$' or coalesce(length(btrim(x ->> 'name')), 0) not between 1 and 40
         or jsonb_typeof(x -> 'usd_cents') <> 'number' or jsonb_typeof(x -> 'oreshards') <> 'number' or jsonb_typeof(x -> 'bonus_pct') <> 'number' limit 1;
    if found then raise exception 'each bundle needs an id (letters), a name (1-40 characters) and whole numbers usd_cents, oreshards and bonus_pct ("%")', bad; end if;
    select x ->> 'id' into bad from jsonb_array_elements(v) e(x)
      where (x ->> 'usd_cents')::numeric <> trunc((x ->> 'usd_cents')::numeric) or (x ->> 'oreshards')::numeric <> trunc((x ->> 'oreshards')::numeric)
         or (x ->> 'bonus_pct')::numeric <> trunc((x ->> 'bonus_pct')::numeric)
         or (x ->> 'usd_cents')::numeric not between 50 and 99999 or (x ->> 'oreshards')::numeric not between 1 and 1000000 or (x ->> 'bonus_pct')::numeric not between 0 and 100 limit 1;
    if found then raise exception 'usd_cents 50-99999, oreshards 1-1000000, bonus_pct 0-100, whole numbers ("%")', bad; end if;
    if (select count(distinct x ->> 'id') from jsonb_array_elements(v) e(x)) <> jsonb_array_length(v) then raise exception 'two bundles share an id'; end if;
    v := (select jsonb_agg(jsonb_build_object('id', x ->> 'id', 'name', btrim(x ->> 'name'), 'usd_cents', (x ->> 'usd_cents')::int, 'oreshards', (x ->> 'oreshards')::int, 'bonus_pct', (x ->> 'bonus_pct')::int)
                           order by (x ->> 'usd_cents')::int) from jsonb_array_elements(v) e(x));
  elsif p_key = 'regions' then
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < 1 or jsonb_array_length(v) > 12 then raise exception 'must be a list of 1 to 12 regions'; end if;
    select coalesce(x ->> 'id', '?') into bad from jsonb_array_elements(v) e(x)
      where jsonb_typeof(x) <> 'object' or not (x ->> 'id') ~ '^[a-z][a-z0-9-]{1,19}$' or coalesce(length(btrim(x ->> 'name')), 0) not between 1 and 30
         or not (x ->> 'edge') = any (private.edge_regions()) or jsonb_typeof(x -> 'enabled') <> 'boolean' limit 1;
    if found then raise exception 'each region needs an id (letters, digits, dashes), a name (1-30 characters), an edge Supabase offers and enabled true/false ("%")', bad; end if;
    if (select count(distinct x ->> 'id') from jsonb_array_elements(v) e(x)) <> jsonb_array_length(v) then raise exception 'two regions share an id'; end if;
    if not exists (select 1 from jsonb_array_elements(v) e(x) where (x ->> 'enabled')::boolean) then raise exception 'at least one region must be enabled'; end if;
    v := (select jsonb_agg(jsonb_build_object('id', x ->> 'id', 'name', btrim(x ->> 'name'), 'edge', x ->> 'edge', 'enabled', (x ->> 'enabled')::boolean)) from jsonb_array_elements(v) e(x));
  elsif p_key = 'upgrade_steps' then
    if jsonb_typeof(v) <> 'object' then raise exception 'must be an object: rarity -> four steps'; end if;
    select r.name into bad from public.rarities r where not (v ? r.name) limit 1;
    if found then raise exception 'every rarity needs its four steps (missing "%")', bad; end if;
    select k into bad from jsonb_each(v) e(k, x) where not exists (select 1 from public.rarities r where r.name = k) or jsonb_typeof(x) <> 'array' or jsonb_array_length(x) <> 4
      or exists (select 1 from jsonb_array_elements(x) y where jsonb_typeof(y) <> 'number' or (y #>> '{}')::numeric <> trunc((y #>> '{}')::numeric) or (y #>> '{}')::numeric < 1 or (y #>> '{}')::numeric > 10000) limit 1;
    if found then raise exception 'each rarity takes exactly four whole numbers from 1 to 10000 ("%")', bad; end if;
  elsif p_key in ('upgrade_drop_bp', 'upgrade_drop_tiers') then
    if jsonb_typeof(v) <> 'object' then raise exception 'must be an object of whole numbers'; end if;
    select k into bad from jsonb_each(v) e(k, x) where jsonb_typeof(x) <> 'number' or (x #>> '{}')::numeric <> trunc((x #>> '{}')::numeric) or (x #>> '{}')::numeric < 0 limit 1;
    if found then raise exception 'every value must be a whole number of 0 or more ("%")', bad; end if;
    if p_key = 'upgrade_drop_tiers' then
      if not (v ? '2' and v ? '3' and v ? '4' and v ? '5') or (select count(*) from jsonb_object_keys(v)) <> 4 then raise exception 'needs the four tiers 2, 3, 4 and 5'; end if;
      if (select sum((x #>> '{}')::int) from jsonb_each(v) e(k, x)) <> 10000 then raise exception 'the four tiers must add up to 10000'; end if;
    else
      select k into bad from jsonb_each(v) e(k, x) where not exists (select 1 from public.rarities r where r.name = k) or (x #>> '{}')::int > 10000 limit 1;
      if found then raise exception 'rarity names only, each 0 to 10000 ("%")', bad; end if;
    end if;
  elsif p_key = 'pvp_attack_mode' then
    if jsonb_typeof(v) <> 'string' or not (v #>> '{}') in ('armed', 'window') then raise exception 'must be "armed" or "window"'; end if;
  elsif p_key = 'pack_bundles' then
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < 1 or jsonb_array_length(v) > 12 then raise exception 'must be a list of 1 to 12 bundles'; end if;
    select left(x::text, 60) into bad from jsonb_array_elements(v) e(x)
      where jsonb_typeof(x) <> 'object' or jsonb_typeof(x -> 'size') <> 'number' or jsonb_typeof(x -> 'bonus') <> 'number' limit 1;
    if found then raise exception 'each bundle is {"size": n, "bonus": n} with whole numbers (%)', bad; end if;
    select left(x::text, 60) into bad from jsonb_array_elements(v) e(x)
      where (x ->> 'size')::numeric <> trunc((x ->> 'size')::numeric) or (x ->> 'bonus')::numeric <> trunc((x ->> 'bonus')::numeric)
         or (x ->> 'size')::numeric not between 1 and 999 or (x ->> 'bonus')::numeric not between 0 and 999 limit 1;
    if found then raise exception 'each bundle needs a size from 1 to 999 and a bonus from 0 to 999, whole numbers (%)', bad; end if;
    if (select count(distinct (x ->> 'size')::int) from jsonb_array_elements(v) e(x)) <> jsonb_array_length(v) then raise exception 'two bundles share a size'; end if;
    if not exists (select 1 from jsonb_array_elements(v) e(x) where (x ->> 'size')::int = 1) then raise exception 'the single pack (size 1) must stay in the list'; end if;
    v := (select jsonb_agg(jsonb_build_object('size', (x ->> 'size')::int, 'bonus', (x ->> 'bonus')::int) order by (x ->> 'size')::int) from jsonb_array_elements(v) e(x));
  elsif p_key = 'shop_badges' then
    if jsonb_typeof(v) <> 'object' then raise exception 'must be an object: best_value and most_popular, each a bundle size or null'; end if;
    select k into bad from jsonb_object_keys(v) k where k not in ('best_value', 'most_popular') limit 1;
    if found then raise exception 'unknown badge "%" (best_value and most_popular only)', bad; end if;
    select k into bad from jsonb_each(v) e(k, x) where jsonb_typeof(x) not in ('null', 'number') limit 1;
    if found then raise exception 'each badge is a bundle size or null ("%")', bad; end if;
    sizes := coalesce((select array_agg((b ->> 'size')::int) from jsonb_array_elements(coalesce(private.setting('pack_bundles'), '[]'::jsonb)) b), '{}'::int[]);
    select k into bad from jsonb_each(v) e(k, x) where jsonb_typeof(x) = 'number' and not ((x #>> '{}')::numeric = any (sizes::numeric[])) limit 1;
    if found then raise exception 'each badge is a bundle size from pack_bundles or null ("%")', bad; end if;
    v := jsonb_build_object('best_value', coalesce(v -> 'best_value', 'null'::jsonb), 'most_popular', coalesce(v -> 'most_popular', 'null'::jsonb));
  elsif p_key = 'pack_bundle_promises' then
    if jsonb_typeof(v) <> 'object' then raise exception 'must be an object: bundle size -> promises'; end if;
    sizes := coalesce((select array_agg((b ->> 'size')::int) from jsonb_array_elements(coalesce(private.setting('pack_bundles'), '[]'::jsonb)) b), '{}'::int[]);
    select k into bad from jsonb_each(v) e(k, x) where k !~ '^[0-9]{1,3}$' or jsonb_typeof(x) <> 'object' or not (case when k ~ '^[0-9]{1,3}$' then k::int = any (sizes) else false end) limit 1;
    if found then raise exception 'each key must be a bundle size from pack_bundles, with an object of promises ("%")', bad; end if;
    select k || '.' || pk into bad from jsonb_each(v) e(k, x), jsonb_each(x) p(pk, pv)
      where pk not in ('upgraded_min_tier', 'legendary_unowned', 'card_back', 'legendary_min')
         or (pk = 'legendary_min' and (jsonb_typeof(pv) <> 'number' or (pv #>> '{}')::numeric not between 0 and 50))
         or (pk = 'upgraded_min_tier' and jsonb_typeof(pv) <> 'number')
         or (pk = 'legendary_unowned' and jsonb_typeof(pv) <> 'boolean')
         or (pk = 'card_back' and (jsonb_typeof(pv) <> 'string' or not (pv #>> '{}') ~ '^[a-z][a-z0-9-]{0,29}$')) limit 1;
    if found then raise exception 'promises are upgraded_min_tier (2-5), legendary_min (0-50), legendary_unowned (true/false) and card_back (a word) ("%")', bad; end if;
    select k || '.upgraded_min_tier' into bad from jsonb_each(v) e(k, x), jsonb_each(x) p(pk, pv)
      where pk = 'upgraded_min_tier' and not ((pv #>> '{}')::numeric in (2, 3, 4, 5)) limit 1;
    if found then raise exception 'upgraded_min_tier is 2, 3, 4 or 5 ("%")', bad; end if;
  elsif p_key = 'ranked_ladder' then
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < 1 or jsonb_array_length(v) > 20 then raise exception 'must be a list of 1 to 20 ranks'; end if;
    select coalesce(x ->> 'name', '?') into bad from jsonb_array_elements(v) e(x)
      where jsonb_typeof(x) <> 'object' or coalesce(length(btrim(x ->> 'name')), 0) not between 1 and 20 or jsonb_typeof(x -> 'min') <> 'number' limit 1;
    if found then raise exception 'each rank needs a name (1-20 characters) and a whole-number min ("%")', bad; end if;
    select x ->> 'name' into bad from jsonb_array_elements(v) e(x)
      where (x ->> 'min')::numeric <> trunc((x ->> 'min')::numeric) or (x ->> 'min')::numeric not between 0 and 10000 limit 1;
    if found then raise exception 'each min is a whole number from 0 to 10000 ("%")', bad; end if;
    if (select count(distinct btrim(x ->> 'name')) from jsonb_array_elements(v) e(x)) <> jsonb_array_length(v) then raise exception 'two ranks share a name'; end if;
    if (select count(distinct (x ->> 'min')::int) from jsonb_array_elements(v) e(x)) <> jsonb_array_length(v) then raise exception 'two ranks share a min'; end if;
    if (select min((x ->> 'min')::int) from jsonb_array_elements(v) e(x)) <> 0 then raise exception 'the first rank must start at 0'; end if;
    v := (select jsonb_agg(jsonb_build_object('name', btrim(x ->> 'name'), 'min', (x ->> 'min')::int) order by (x ->> 'min')::int) from jsonb_array_elements(v) e(x));
  else
    if jsonb_typeof(v) <> 'array' then raise exception 'must be a list of words'; end if;
    select x into bad from jsonb_array_elements(v) e(x) where jsonb_typeof(x) <> 'string' limit 1;
    if found then raise exception 'every entry must be a word'; end if;
    v := coalesce((select jsonb_agg(distinct w order by w) from
                     (select lower(btrim(x #>> '{}')) w from jsonb_array_elements(v) e(x)) t where w <> ''), '[]'::jsonb);
    select w into bad from jsonb_array_elements_text(v) w where w !~ '^[a-z]{2,30}$' limit 1;
    if found then raise exception 'not allowed in the list: "%" (use 2-30 letters a-z only)', bad; end if;
    if jsonb_array_length(v) > 2000 then raise exception 'too many words (max 2000)'; end if;
  end if;
  insert into public.settings (key, value, updated_at) values (p_key, v, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  perform private.audit(aid, 'set_setting', null, jsonb_build_object('key', p_key, 'value', old), jsonb_build_object('key', p_key, 'value', v), p_reason);
  return v;
end $$;

create or replace function public.my_oreshards() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); blocked text;
begin
  if uid is null then raise exception 'not logged in' using errcode = '28000'; end if;
  blocked := private.oreshard_buy_block(uid);
  return jsonb_build_object(
    'oreshards', coalesce((select oreshards from public.oreshard_wallets where user_id = uid), 0),
    'coins', coalesce((select coins from public.wallets where user_id = uid), 0),
    'enabled', coalesce((private.setting('oreshards_enabled'))::boolean, false),
    'can_buy', blocked = '',
    'blocked', blocked,
    'bundles', coalesce(private.setting('oreshard_bundles'), '[]'::jsonb),
    'pack_rate', coalesce((private.setting('oreshard_pack_rate'))::numeric, 1),
    'purchases', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'bundle', p.bundle_name, 'oreshards', p.oreshards, 'amount_cents', p.amount_cents,
                                                             'currency', p.currency, 'status', p.status, 'at', p.created_at, 'receipt', p.stripe_session_id) order by p.created_at desc)
                           from (select * from public.purchases where user_id = uid and status <> 'created' order by created_at desc limit 20) p), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('delta', l.delta, 'reason', l.reason, 'at', l.created_at, 'balance_after', l.balance_after) order by l.id desc)
                         from (select * from public.oreshard_ledger where user_id = uid order by id desc limit 20) l), '[]'::jsonb));
end $$;

-- buy_packs learns to take Oreshards (p_pay 'oreshards'); coins stay the default
drop function if exists public.buy_packs(text, integer, text);
create function public.buy_packs(p_pack_type text, p_size integer, p_idem_key text, p_pay text default 'coins') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  w public.wallets;
  pt public.pack_types;
  prior public.pack_bundles;
  def record;
  bid uuid := gen_random_uuid();
  price integer;
  shards integer := 0;
  bal integer;
  pay text := coalesce(p_pay, 'coins');
  today_n bigint;
  result jsonb;
begin
  if p_idem_key is null or length(p_idem_key) not between 8 and 120 then raise exception 'idem_key required'; end if;
  if pay not in ('coins', 'oreshards') then raise exception 'Pay with coins or Oreshards.'; end if;
  select * into w from public.wallets where user_id = uid for update;
  if not found then raise exception 'player has no wallet'; end if;
  select * into prior from public.pack_bundles where idem_key = p_idem_key;
  if found then
    if prior.user_id <> uid then raise exception 'idem_key already used'; end if;
    return prior.result || jsonb_build_object('coins_after', w.coins, 'oreshards_after', coalesce((select oreshards from public.oreshard_wallets where user_id = uid), 0), 'stash', private.stash_of(uid), 'repeat', true);
  end if;
  select * into pt from public.pack_types where id = p_pack_type;
  if not found or not pt.active then raise exception 'That pack is not for sale.'; end if;
  select * into def from private.bundle_def(p_size);
  if not found then raise exception 'That bundle is not for sale.'; end if;
  select count(*) into today_n from public.pack_bundles b where b.user_id = uid and b.pack_type = pt.id and b.source = 'shop' and b.created_at >= private.day_start();
  if today_n >= greatest(1, coalesce((private.setting('pack_bundles_per_day'))::int, 20)) then raise exception 'You have bought enough of those for today.'; end if;
  price := pt.price_coins * def.size;
  if pay = 'oreshards' then
    shards := ceil(price * coalesce((private.setting('oreshard_pack_rate'))::numeric, 1))::int;
    perform 1 from public.oreshard_wallets where user_id = uid for update;
    bal := coalesce((select oreshards from public.oreshard_wallets where user_id = uid), 0);
    if bal < 0 then raise exception 'This account owes Oreshards from a refund; nothing can be spent until it is back to zero.'; end if;
    if bal < shards then raise exception 'Not enough Oreshards (this costs %, you have %).', shards, bal; end if;
    if shards > 0 then perform private.oreshard_apply(uid, -shards, 'pack', bid::text, 'pack:' || p_idem_key); end if;
    price := 0;
  elsif price > 0 then
    perform private.ledger_apply(uid, -price, 'pack_purchase', bid::text, 'bundle:' || p_idem_key, null);
  end if;
  result := jsonb_build_object('bundle_id', bid, 'pack_type', pt.id, 'size', def.size, 'bonus', def.bonus, 'packs', def.size + def.bonus,
    'price_paid', price, 'paid_with', pay, 'oreshards_paid', shards, 'promises', private.bundle_promises(def.size));
  insert into public.pack_bundles (id, user_id, pack_type, size, bonus, packs_total, packs_left, price_paid, source, promises, idem_key, result)
    values (bid, uid, pt.id, def.size, def.bonus, def.size + def.bonus, def.size + def.bonus, price, 'shop', private.bundle_promises(def.size), p_idem_key, result);
  update public.player_stats set coins_spent = coins_spent + price where user_id = uid;
  select * into w from public.wallets where user_id = uid;
  return result || jsonb_build_object('coins_after', w.coins, 'oreshards_after', coalesce((select oreshards from public.oreshard_wallets where user_id = uid), 0), 'stash', private.stash_of(uid), 'repeat', false);
end $$;
revoke all on function public.buy_packs(text, integer, text, text) from public, anon;
grant execute on function public.buy_packs(text, integer, text, text) to authenticated;

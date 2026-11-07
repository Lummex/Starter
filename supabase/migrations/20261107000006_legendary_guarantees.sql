-- Legendary guarantees (Ken, Nov 7; final numbers): "every 20 packs at least one legendary, the 24-pack bundle should have 2, so the
-- 99 chest should have 10" -- one of the chest's 10 a Legendary the player does not own yet. Guarantees do NOT stack: natural drops and
-- the bad-luck shield count toward a bundle's minimum; a bundle pack is forced to carry one only when the packs left are just enough to
-- reach it (so they spread over the last packs, one per pack). All admin settings (pack_pity_limit, pack_bundle_promises.legendary_min).
-- Bundles bought before keep the promises they were sold with. Safe for the real database.

update public.settings set value = '20'::jsonb, updated_at = now() where key = 'pack_pity_limit';
-- nobody is owed a double: the counters carry over, capped one short of the new limit
update public.player_stats set packs_since_legendary = least(packs_since_legendary, 19) where packs_since_legendary > 19;
update public.settings set value = jsonb_set(jsonb_set(value, '{24}', coalesce(value -> '24', '{}'::jsonb) || '{"legendary_min": 2}'::jsonb, true),
                                             '{99}', coalesce(value -> '99', '{}'::jsonb) || '{"legendary_min": 10, "legendary_unowned": true}'::jsonb, true),
                       updated_at = now()
  where key = 'pack_bundle_promises';

create or replace function private.deal_pack(p_user uuid, p_pt public.pack_types, p_oid uuid, p_idem_key text, p_bundle uuid, p_price integer, p_free boolean, p_last boolean, p_promises jsonb, p_progress jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  owned text[];
  owned0 text[];
  dealt text[] := '{}';
  tiers smallint[] := '{}';
  card_rows jsonb := '[]'::jsonb;
  extras jsonb := '[]'::jsonb;
  slots jsonb;
  s record;
  i integer;
  cid text;
  tr smallint;
  rar text;
  since integer := coalesce((select ps.packs_since_legendary from public.player_stats ps where ps.user_id = p_user), 0);
  pity integer := greatest(1, coalesce((private.setting('pack_pity_limit'))::int, 40));
  has_leg boolean := false;
  pity_hit boolean := false;
  best_tier integer := greatest(1, coalesce((p_progress ->> 'best_tier')::int, 1));
  new_leg boolean := coalesce((p_progress ->> 'new_legendary')::boolean, false);
  legs integer := greatest(0, coalesce((p_progress ->> 'legendaries')::int, 0)); -- Nov 7: Legendaries this bundle has given so far
  leg_min integer := greatest(0, coalesce((p_promises ->> 'legendary_min')::int, 0));
  left_now integer := 1; leg_here integer; forced boolean := false;
  want_tier integer; result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('slot_no', ps.slot_no, 'count', private.slot_count(ps.slot_no, ps.count), 'odds', ps.odds, 'pool', ps.pool) order by ps.slot_no), '[]'::jsonb)
    into slots from public.pack_slots ps where ps.pack_type = p_pt.id and private.slot_count(ps.slot_no, ps.count) > 0;
  if slots = '[]'::jsonb then raise exception 'That pack has no cards in it yet.'; end if;
  owned := coalesce(array(select distinct ci.card_id from public.card_instances ci where ci.owner_id = p_user and ci.status = 'owned'), '{}');
  owned0 := owned; -- is_new compares with what the player had BEFORE this pack (two copies in one pack are both new)
  -- 1. roll every slot
  for s in select (e ->> 'count')::int as count, e -> 'odds' as odds, e ->> 'pool' as pool from jsonb_array_elements(slots) e loop
    for i in 1..s.count loop
      cid := case when s.pool = 'miners' then private.pack_roll_miner(p_pt.faction) else private.pack_roll_card(p_pt.faction, s.odds) end;
      dealt := dealt || cid;
      tiers := tiers || private.roll_upgrade((select c.rarity from public.cards c where c.id = cid));
    end loop;
  end loop;
  has_leg := exists (select 1 from unnest(dealt) d join public.cards c on c.id = d where c.rarity = 'Collector');
  -- 2. the bad-luck shield: the pity-th pack without a Legendary gets one in its last (Rare-or-better) slot
  if not has_leg and since + 1 >= pity then
    cid := private.pack_roll_card(p_pt.faction, '{"Collector": 10000}'::jsonb);
    dealt[cardinality(dealt)] := cid;
    tiers[cardinality(tiers)] := private.roll_upgrade('Collector');
    has_leg := true; pity_hit := true;
  end if;
  -- 2b. Nov 7 (Ken: the 24-pack bundle guarantees 2 Legendaries, the 99 chest 10, one of them new to you; no stacking): natural and
  -- shield drops count; a bundle pack is forced to carry one only when the packs left are just enough to reach the minimum, so the
  -- guarantee spreads one per pack over the last packs and never lands all in one pack.
  if p_bundle is not null and leg_min > 0 then
    left_now := greatest(1, coalesce((select pb.packs_left from public.pack_bundles pb where pb.id = p_bundle), 1));
    leg_here := (select count(*) from unnest(dealt) d join public.cards c on c.id = d where c.rarity = 'Collector');
    if leg_here = 0 and leg_min - legs > left_now - 1 then
      cid := null;
      if coalesce((p_promises ->> 'legendary_unowned')::boolean, false) and not new_leg then
        select c.id into cid from public.cards c where c.in_packs and not c.disabled and c.rarity = 'Collector'
          and (p_pt.faction is null or c.faction = p_pt.faction or c.faction = 'any') and not (c.id = any (owned))
          order by private.random_below(1000000) limit 1;
      end if;
      if cid is null then cid := private.pack_roll_card(p_pt.faction, '{"Collector": 10000}'::jsonb); end if;
      dealt[cardinality(dealt)] := cid;
      tiers[cardinality(tiers)] := private.roll_upgrade('Collector');
      has_leg := true; forced := true;
    end if;
  end if;
  legs := legs + (select count(*) from unnest(dealt) d join public.cards c on c.id = d where c.rarity = 'Collector');
  -- 3. grant them
  for i in 1..cardinality(dealt) loop
    cid := dealt[i]; tr := tiers[i];
    rar := (select c.rarity from public.cards c where c.id = cid);
    card_rows := card_rows || jsonb_build_object('card_id', cid, 'rarity', rar, 'is_new', not (cid = any (owned0)), 'tier', tr, 'pity', pity_hit and i = cardinality(dealt), 'guarantee', case when forced and i = cardinality(dealt) then 'legendary' end);
    perform private.card_grant_tier(p_user, cid, tr, 'pack', p_oid::text, null);
    if tr > best_tier then best_tier := tr; end if;
    if rar = 'Collector' and not (cid = any (owned)) then new_leg := true; end if;
    if not (cid = any (owned)) then owned := owned || cid; end if;
  end loop;
  update public.player_stats set packs_opened = packs_opened + 1, coins_spent = coins_spent + p_price,
    packs_since_legendary = case when has_leg then 0 else packs_since_legendary + 1 end where user_id = p_user;
  -- 4. a bundle's last pack: the promises luck did not keep
  if p_last then
    want_tier := coalesce((p_promises ->> 'upgraded_min_tier')::int, 0);
    if want_tier > best_tier then
      cid := private.pack_roll_card(p_pt.faction, '{"Rare": 7800, "Ultra Rare": 2000, "Collector": 200}'::jsonb);
      rar := (select c.rarity from public.cards c where c.id = cid);
      perform private.card_grant_tier(p_user, cid, want_tier, 'reward', 'bundle:' || p_bundle::text, null);
      extras := extras || jsonb_build_object('card_id', cid, 'rarity', rar, 'is_new', not (cid = any (owned)), 'tier', want_tier, 'guarantee', 'upgraded');
      if not (cid = any (owned)) then owned := owned || cid; end if;
      best_tier := want_tier;
    end if;
    if coalesce((p_promises ->> 'legendary_unowned')::boolean, false) and not new_leg then
      select c.id into cid from public.cards c where c.in_packs and not c.disabled and c.rarity = 'Collector'
        and (p_pt.faction is null or c.faction = p_pt.faction or c.faction = 'any') and not (c.id = any (owned))
        order by private.random_below(1000000) limit 1;
      if cid is null then cid := private.pack_roll_card(p_pt.faction, '{"Collector": 10000}'::jsonb); end if;
      perform private.card_grant_tier(p_user, cid, 1, 'reward', 'bundle:' || p_bundle::text, null);
      extras := extras || jsonb_build_object('card_id', cid, 'rarity', 'Collector', 'is_new', not (cid = any (owned)), 'tier', 1, 'guarantee', 'legendary');
      new_leg := true;
    end if;
    if p_promises ? 'card_back' then
      insert into public.player_cosmetics (user_id, kind, item, ref) values (p_user, 'card_back', p_promises ->> 'card_back', 'bundle:' || p_bundle::text) on conflict do nothing;
      extras := extras || jsonb_build_object('guarantee', 'card_back', 'item', p_promises ->> 'card_back');
    end if;
  end if;
  result := jsonb_build_object('opening_id', p_oid, 'pack_type', p_pt.id, 'price_paid', p_price, 'free', p_free,
    'cards', card_rows, 'odds', slots, 'extras', extras, 'bundle_id', p_bundle, 'pity', pity_hit,
    'progress', jsonb_build_object('best_tier', best_tier, 'new_legendary', new_leg, 'legendaries', legs));
  insert into public.pack_openings (id, user_id, pack_type, price_paid, free, odds_snapshot, cards, idem_key, result, bundle_id, extras)
    values (p_oid, p_user, p_pt.id, p_price, p_free, slots, dealt, p_idem_key, result, p_bundle, case when extras = '[]'::jsonb then null else extras end);
  return result;
end $$;
revoke all on function private.deal_pack(uuid, public.pack_types, uuid, text, uuid, integer, boolean, boolean, jsonb, jsonb) from public, anon, authenticated;

-- admin_set_setting: pack_bundle_promises also takes legendary_min (0-50)
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

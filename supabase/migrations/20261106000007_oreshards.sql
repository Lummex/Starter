-- Oreshards (Ken, Nov 6: "let's get started" on Stripe): the premium currency, bought with real money through Stripe-hosted Checkout,
-- credited ONLY by the Stripe webhook (checkout.session.completed / async_payment_succeeded with payment_status paid), exactly once per
-- Checkout Session; refunds and chargebacks take the Oreshards back (the only way a balance goes below zero; a negative balance blocks
-- spending until it is back to zero, and a dispute flags the account for Ken). One-way conversion: 1 Oreshard = 1 Coin, never back.
-- Bundles (studio/specs/currency-store-plan.md, admin-editable): Pouch $1.99 = 200, Sack $4.99 = 550, Chest $9.99 = 1,200, Hoard $19.99 = 2,600.
-- Under-13 accounts cannot buy without an approved parent (the Online design); TEST database and the Stripe SANDBOX only; nothing live.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.oreshard_wallets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  oreshards  integer not null default 0,              -- may go below zero only through a reversal (refund / chargeback)
  updated_at timestamptz not null default now()
);
revoke all on public.oreshard_wallets from public, anon, authenticated;
alter table public.oreshard_wallets enable row level security;

-- Append-only Oreshard ledger: every change is a new row, never an edit.
create table public.oreshard_ledger (
  id            bigint generated always as identity primary key,
  user_id       uuid not null,
  delta         integer not null check (delta <> 0),
  reason        text not null check (reason in ('purchase', 'reversal', 'convert', 'admin_grant')),
  ref           text,
  amount_cents  integer,                                -- the money side (US cents) for purchases and reversals
  currency      text,
  idem_key      text not null unique,
  balance_after integer not null,
  created_at    timestamptz not null default now()
);
create index oreshard_ledger_user on public.oreshard_ledger (user_id, id desc);
revoke all on public.oreshard_ledger from public, anon, authenticated;
alter table public.oreshard_ledger enable row level security;

-- One row per Checkout Session the game asked Stripe for. Only the referee (the functions, service role) writes here.
create table public.purchases (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  bundle_id             text not null,
  bundle_name           text not null,
  oreshards             integer not null check (oreshards > 0),
  amount_cents          integer not null check (amount_cents > 0),
  currency              text not null default 'usd',
  stripe_session_id     text unique,
  stripe_payment_intent text,
  stripe_customer_id    text,
  status                text not null default 'created' check (status in ('created', 'paid', 'failed', 'refunded', 'disputed')),
  credited_at           timestamptz,
  reversed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index purchases_user on public.purchases (user_id, created_at desc);
create index purchases_payment_intent on public.purchases (stripe_payment_intent) where stripe_payment_intent is not null;
revoke all on public.purchases from public, anon, authenticated;
alter table public.purchases enable row level security;

-- Every Stripe event the webhook handled, by Stripe's event id: a repeated delivery is skipped.
create table public.stripe_events (
  id         text primary key,
  type       text not null,
  handled_at timestamptz not null default now(),
  result     jsonb
);
revoke all on public.stripe_events from public, anon, authenticated;
alter table public.stripe_events enable row level security;

alter table public.profiles add column if not exists stripe_customer_id text;

-- ---------------------------------------------------------------------------
-- Settings: the bundles (admin-editable) and the on/off switch
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('oreshard_bundles', '[{"id": "pouch", "name": "Pouch of Oreshards", "usd_cents": 199, "oreshards": 200, "bonus_pct": 0},
                        {"id": "sack", "name": "Sack of Oreshards", "usd_cents": 499, "oreshards": 550, "bonus_pct": 10},
                        {"id": "chest", "name": "Chest of Oreshards", "usd_cents": 999, "oreshards": 1200, "bonus_pct": 20},
                        {"id": "hoard", "name": "Hoard of Oreshards", "usd_cents": 1999, "oreshards": 2600, "bonus_pct": 30}]'::jsonb),
  ('oreshards_enabled', 'true'::jsonb)
on conflict (key) do nothing;

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
               'oreshard_bundles', 'oreshards_enabled']
$$;

-- admin_set_setting: the two Oreshard keys get their shapes (the rest as in 20261106000006)
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
  elsif p_key in ('region_counts', 'dashboard_counts', 'oreshards_enabled') then
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
      where pk not in ('upgraded_min_tier', 'legendary_unowned', 'card_back')
         or (pk = 'upgraded_min_tier' and jsonb_typeof(pv) <> 'number')
         or (pk = 'legendary_unowned' and jsonb_typeof(pv) <> 'boolean')
         or (pk = 'card_back' and (jsonb_typeof(pv) <> 'string' or not (pv #>> '{}') ~ '^[a-z][a-z0-9-]{0,29}$')) limit 1;
    if found then raise exception 'promises are upgraded_min_tier (2-5), legendary_unowned (true/false) and card_back (a word) ("%")', bad; end if;
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

-- the coin ledger learns the conversion reason
alter table public.transactions drop constraint transactions_reason_check;
alter table public.transactions add constraint transactions_reason_check check (reason in
  ('signup_bonus', 'admin_grant', 'match_reward', 'pack_purchase', 'donation_reward', 'refund_reversal', 'quest_reward', 'oreshard_convert'));

-- ---------------------------------------------------------------------------
-- The Oreshard ledger (private: only the doors below move a balance)
-- ---------------------------------------------------------------------------
create function private.oreshard_apply(p_user uuid, p_delta integer, p_reason text, p_ref text, p_idem_key text,
                                       p_amount_cents integer default null, p_currency text default null, p_allow_negative boolean default false)
returns public.oreshard_ledger
language plpgsql security definer set search_path = '' as $$
declare
  bal integer;
  t public.oreshard_ledger;
begin
  if p_idem_key is null or length(p_idem_key) < 8 then raise exception 'idem_key required'; end if;
  insert into public.oreshard_wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  select oreshards into bal from public.oreshard_wallets where user_id = p_user for update;
  select * into t from public.oreshard_ledger where idem_key = p_idem_key;
  if found then
    if t.user_id <> p_user or t.delta <> p_delta then raise exception 'idem_key already used for another change'; end if;
    return t;
  end if;
  if bal + p_delta < 0 and not p_allow_negative then raise exception 'not enough Oreshards (has %)', bal; end if;
  update public.oreshard_wallets set oreshards = bal + p_delta, updated_at = now() where user_id = p_user;
  insert into public.oreshard_ledger (user_id, delta, reason, ref, amount_cents, currency, idem_key, balance_after)
  values (p_user, p_delta, p_reason, p_ref, p_amount_cents, p_currency, p_idem_key, bal + p_delta)
  returning * into t;
  return t;
end $$;

create function private.oreshard_bundle(p_id text) returns jsonb
language sql stable set search_path = '' as $$
  select x from jsonb_array_elements(coalesce(private.setting('oreshard_bundles'), '[]'::jsonb)) e(x) where x ->> 'id' = p_id limit 1
$$;

/** Can this player buy right now? '' when yes, else the reason in plain words. */
create function private.oreshard_buy_block(p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles; b public.bans;
begin
  if not coalesce((private.setting('oreshards_enabled'))::boolean, false) then return 'Oreshards are not on sale right now.'; end if;
  select * into p from public.profiles where id = p_user;
  if not found then return 'No profile.'; end if;
  b := private.active_ban(p_user);
  if b.id is not null then return 'This account is banned.'; end if;
  if p.age_group = 'under_13' and p.consent_status <> 'approved' then return 'A parent must approve this account before it can buy anything.'; end if;
  if p.eula_version is distinct from (private.setting('eula_version') #>> '{}') then return 'Please read and accept the agreement first.'; end if;
  return '';
end $$;

-- ---------------------------------------------------------------------------
-- Player doors
-- ---------------------------------------------------------------------------
/** The Buy Oreshards page: balance, the bundles for sale, whether this player may buy, the last purchases. */
create function public.my_oreshards() returns jsonb
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
    'purchases', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'bundle', p.bundle_name, 'oreshards', p.oreshards, 'amount_cents', p.amount_cents,
                                                             'currency', p.currency, 'status', p.status, 'at', p.created_at, 'receipt', p.stripe_session_id) order by p.created_at desc)
                           from (select * from public.purchases where user_id = uid and status <> 'created' order by created_at desc limit 20) p), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('delta', l.delta, 'reason', l.reason, 'at', l.created_at, 'balance_after', l.balance_after) order by l.id desc)
                         from (select * from public.oreshard_ledger where user_id = uid order by id desc limit 20) l), '[]'::jsonb));
end $$;

/** Step 1 of a purchase, as the player: the checks, then a 'created' purchase row the function turns into a Checkout Session. */
create function public.oreshard_checkout_start(p_bundle text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); blocked text; b jsonb; pr public.purchases; p public.profiles; em text;
begin
  if uid is null then raise exception 'not logged in' using errcode = '28000'; end if;
  blocked := private.oreshard_buy_block(uid);
  if blocked <> '' then raise exception '%', blocked; end if;
  b := private.oreshard_bundle(p_bundle);
  if b is null then raise exception 'That bundle is not for sale.'; end if;
  -- no pile-up of unpaid sessions: at most 10 open ones in the last hour
  if (select count(*) from public.purchases where user_id = uid and status = 'created' and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many unfinished purchases. Please wait a little.';
  end if;
  select * into p from public.profiles where id = uid;
  select email into em from auth.users where id = uid;
  insert into public.purchases (user_id, bundle_id, bundle_name, oreshards, amount_cents, currency)
    values (uid, b ->> 'id', b ->> 'name', (b ->> 'oreshards')::int, (b ->> 'usd_cents')::int, 'usd') returning * into pr;
  return jsonb_build_object('purchase_id', pr.id, 'bundle', b, 'username', p.username, 'email', em, 'stripe_customer_id', p.stripe_customer_id);
end $$;

/** One-way: Oreshards into Coins, 1 for 1 (Ken). Never back. Refused while the balance is below zero (a reversal is owed). */
create function public.oreshards_to_coins(p_n integer, p_idem_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); bal integer; l public.oreshard_ledger; t public.transactions; b public.bans;
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
  t := private.ledger_apply(uid, p_n, 'oreshard_convert', 'oreshards', 'conv:' || p_idem_key, uid);
  return jsonb_build_object('oreshards', l.balance_after, 'coins', t.balance_after, 'converted', p_n);
end $$;

-- ---------------------------------------------------------------------------
-- Referee doors (the functions, service role only)
-- ---------------------------------------------------------------------------
/** Step 2: the Checkout Session exists; remember its id (and the Stripe customer) on the purchase. */
create function public.oreshard_checkout_link(p_purchase uuid, p_session text, p_customer text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare pr public.purchases;
begin
  perform private.assert_referee();
  select * into pr from public.purchases where id = p_purchase for update;
  if not found or pr.status <> 'created' or pr.stripe_session_id is not null then return false; end if;
  update public.purchases set stripe_session_id = p_session, stripe_customer_id = p_customer, updated_at = now() where id = p_purchase;
  if p_customer is not null then update public.profiles set stripe_customer_id = p_customer where id = pr.user_id and stripe_customer_id is null; end if;
  return true;
end $$;

/** Has this Stripe event been handled before? Records it when not (true = go ahead). */
create function public.stripe_event_begin(p_event_id text, p_type text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_referee();
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]{8,64}$' then raise exception 'bad event id'; end if;
  insert into public.stripe_events (id, type) values (p_event_id, p_type) on conflict (id) do nothing;
  return found;
end $$;

/** The handler failed after recording the event: forget it, so Stripe's retry is handled instead of skipped. */
create function public.stripe_event_forget(p_event_id text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_referee();
  delete from public.stripe_events where id = p_event_id and result is null;
  return found;
end $$;

/** The webhook's credit: a PAID Checkout Session credits its purchase exactly once (idem key = the session id). */
create function public.oreshard_credit(p_session text, p_payment_intent text, p_amount_cents integer, p_currency text, p_customer text, p_event_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pr public.purchases; l public.oreshard_ledger;
begin
  perform private.assert_referee();
  if p_session is null or p_session !~ '^cs_[A-Za-z0-9_]{8,200}$' then raise exception 'bad session id'; end if;
  select * into pr from public.purchases where stripe_session_id = p_session for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown session'); end if;
  if pr.status = 'paid' then return jsonb_build_object('ok', true, 'repeat', true, 'oreshards', pr.oreshards); end if;
  if pr.status in ('refunded', 'disputed') then return jsonb_build_object('ok', true, 'repeat', true, 'status', pr.status); end if;
  if p_amount_cents is not null and (p_amount_cents <> pr.amount_cents or lower(coalesce(p_currency, 'usd')) <> pr.currency) then
    return jsonb_build_object('ok', false, 'error', format('amount mismatch: paid %s %s, expected %s %s', p_amount_cents, p_currency, pr.amount_cents, pr.currency));
  end if;
  l := private.oreshard_apply(pr.user_id, pr.oreshards, 'purchase', pr.bundle_id, 'stripe:' || p_session, pr.amount_cents, pr.currency);
  update public.purchases set status = 'paid', stripe_payment_intent = coalesce(p_payment_intent, stripe_payment_intent), stripe_customer_id = coalesce(p_customer, stripe_customer_id),
    credited_at = now(), updated_at = now() where id = pr.id;
  insert into public.player_stats (user_id, money_spent_cents) values (pr.user_id, pr.amount_cents)
    on conflict (user_id) do update set money_spent_cents = public.player_stats.money_spent_cents + excluded.money_spent_cents;
  update public.stripe_events set result = jsonb_build_object('credited', pr.oreshards, 'purchase', pr.id) where id = p_event_id;
  return jsonb_build_object('ok', true, 'repeat', false, 'oreshards', pr.oreshards, 'balance', l.balance_after, 'user_id', pr.user_id);
end $$;

/** A session whose delayed payment failed: the purchase is closed as failed (nothing was credited). */
create function public.oreshard_fail(p_session text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_referee();
  update public.purchases set status = 'failed', updated_at = now() where stripe_session_id = p_session and status = 'created';
  return found;
end $$;

/** A refund or a chargeback (dispute): the Oreshards go back out (the balance may go below zero), the money-spent total comes down,
 *  the purchase is marked, and a dispute flags the account for Ken (profiles.flags.payment_review). Exactly once per purchase. */
create function public.oreshard_reverse(p_payment_intent text, p_kind text, p_amount_cents integer, p_event_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pr public.purchases; l public.oreshard_ledger; st text;
begin
  perform private.assert_referee();
  if p_kind not in ('refund', 'dispute') then raise exception 'kind is refund or dispute'; end if;
  if p_payment_intent is null or p_payment_intent !~ '^pi_[A-Za-z0-9]{8,64}$' then raise exception 'bad payment intent'; end if;
  select * into pr from public.purchases where stripe_payment_intent = p_payment_intent for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown payment'); end if;
  st := case when p_kind = 'dispute' then 'disputed' else 'refunded' end;
  if pr.status in ('refunded', 'disputed') then
    if p_kind = 'dispute' and pr.status = 'refunded' then update public.purchases set status = 'disputed', updated_at = now() where id = pr.id; end if;
    return jsonb_build_object('ok', true, 'repeat', true);
  end if;
  if pr.status <> 'paid' then return jsonb_build_object('ok', true, 'repeat', true, 'status', pr.status); end if;
  l := private.oreshard_apply(pr.user_id, -pr.oreshards, 'reversal', p_kind || ':' || pr.bundle_id, 'reverse:' || pr.stripe_session_id, -pr.amount_cents, pr.currency, true);
  update public.purchases set status = st, reversed_at = now(), updated_at = now() where id = pr.id;
  update public.player_stats set money_spent_cents = greatest(0, money_spent_cents - pr.amount_cents) where user_id = pr.user_id;
  if p_kind = 'dispute' or l.balance_after < 0 then
    update public.profiles set flags = flags || jsonb_build_object('payment_review', jsonb_build_object('kind', p_kind, 'at', now(), 'purchase', pr.id)) where id = pr.user_id;
  end if;
  update public.stripe_events set result = jsonb_build_object('reversed', pr.oreshards, 'purchase', pr.id, 'kind', p_kind) where id = p_event_id;
  return jsonb_build_object('ok', true, 'repeat', false, 'oreshards', -pr.oreshards, 'balance', l.balance_after, 'user_id', pr.user_id);
end $$;

-- ---------------------------------------------------------------------------
-- Admin: the player page shows Oreshards, purchases and reversals
-- ---------------------------------------------------------------------------
create function public.admin_oreshards(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return jsonb_build_object(
    'oreshards', coalesce((select oreshards from public.oreshard_wallets where user_id = p_user), 0),
    'money_spent_cents', coalesce((select money_spent_cents from public.player_stats where user_id = p_user), 0),
    'review', (select flags -> 'payment_review' from public.profiles where id = p_user),
    'purchases', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'bundle', p.bundle_name, 'oreshards', p.oreshards, 'amount_cents', p.amount_cents, 'currency', p.currency,
                                                             'status', p.status, 'session', p.stripe_session_id, 'payment_intent', p.stripe_payment_intent, 'at', p.created_at,
                                                             'credited_at', p.credited_at, 'reversed_at', p.reversed_at) order by p.created_at desc)
                           from (select * from public.purchases where user_id = p_user order by created_at desc limit 100) p), '[]'::jsonb),
    'ledger', coalesce((select jsonb_agg(to_jsonb(l) order by l.id desc) from (select * from public.oreshard_ledger where user_id = p_user order by id desc limit 100) l), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function private.oreshard_apply(uuid, integer, text, text, text, integer, text, boolean), private.oreshard_bundle(text), private.oreshard_buy_block(uuid) from public, anon, authenticated;
revoke all on function public.my_oreshards(), public.oreshard_checkout_start(text), public.oreshards_to_coins(integer, text), public.admin_oreshards(uuid),
  public.oreshard_checkout_link(uuid, text, text), public.stripe_event_begin(text, text), public.stripe_event_forget(text), public.oreshard_credit(text, text, integer, text, text, text),
  public.oreshard_fail(text), public.oreshard_reverse(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.my_oreshards(), public.oreshard_checkout_start(text), public.oreshards_to_coins(integer, text), public.admin_oreshards(uuid) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.oreshard_checkout_link(uuid, text, text), public.stripe_event_begin(text, text), public.stripe_event_forget(text), public.oreshard_credit(text, text, integer, text, text, text),
      public.oreshard_fail(text), public.oreshard_reverse(text, text, integer, text) to service_role;
  end if;
end $$;

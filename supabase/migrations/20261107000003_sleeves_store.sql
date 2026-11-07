-- Card sleeves in the store (Ken, Nov 7: "Let's make a couple card sleeves too for the store").
-- Data-driven: public.sleeves lists every card back (sleeve) the game knows: its name, its price in Oreshards (null = not sold),
-- whether it is on sale, and its order. The art is always art/sleeves/<id>.webp (the Oreheart default and the chest back keep their
-- old paths in the game), so a new sleeve is one row here plus one picture: no code. Brush paints six store sleeves and the Founder.
-- Bought with Oreshards only (never coins), owned forever (player_cosmetics), equipped like any back. Safe for the real database.

create table if not exists public.sleeves (
  id              text primary key check (id ~ '^[a-z][a-z0-9-]{0,29}$'),
  name            text not null check (length(btrim(name)) between 1 and 40),
  blurb           text check (blurb is null or length(blurb) <= 160),
  kind            text not null default 'store' check (kind in ('default', 'store', 'beta', 'chest', 'event')),
  price_oreshards integer check (price_oreshards is null or price_oreshards between 1 and 100000),
  enabled         boolean not null default true,
  sort            integer not null default 100,
  created_at      timestamptz not null default now()
);
revoke all on public.sleeves from public, anon, authenticated;
alter table public.sleeves enable row level security;

insert into public.sleeves (id, name, blurb, kind, price_oreshards, sort) values
  ('default', 'Oreheart', 'The classic back. Everyone has it.', 'default', null, 0),
  ('founder', 'Founder', 'Only beta testers will ever have it.', 'beta', null, 1),
  ('chest', 'Treasure Chest', 'From the 99-pack chest.', 'chest', null, 2),
  ('goblin-junkpile', 'Goblin Junkpile', 'Rusty, lumpy and proud of it.', 'store', 400, 10),
  ('gnome-arcane', 'Gnome Arcane', 'Humming with very careful magic.', 'store', 400, 11),
  ('dwarf-deepforge', 'Dwarf Deepforge', 'Hammered out under the mountain.', 'store', 400, 12),
  ('crystal-mine', 'Crystal Mine', 'It glows. Nobody knows why.', 'store', 450, 13),
  ('piglet-stampede', 'Piglet Stampede', 'Oink. Oink oink. OINK.', 'store', 350, 14),
  ('skullfang-arena', 'Skullfang Arena', 'For champions of the swamp.', 'store', 500, 15)
on conflict (id) do nothing;

-- the Oreshard ledger learns the sleeve purchase
alter table public.oreshard_ledger drop constraint if exists oreshard_ledger_reason_check;
alter table public.oreshard_ledger add constraint oreshard_ledger_reason_check check (reason in ('purchase', 'reversal', 'convert', 'admin_grant', 'sleeve'));

-- ---------------------------------------------------------------------------
-- Player doors
-- ---------------------------------------------------------------------------
/** The sleeve store: every sleeve on sale, its price, whether I own it, and my Oreshards. */
create function public.sleeve_shop() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return jsonb_build_object(
    'oreshards', coalesce((select oreshards from public.oreshard_wallets where user_id = uid), 0),
    'enabled', coalesce((private.setting('oreshards_enabled'))::boolean, false),
    'sleeves', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'blurb', s.blurb, 'price', s.price_oreshards,
                          'owned', exists (select 1 from public.player_cosmetics c where c.user_id = uid and c.kind = 'card_back' and c.item = s.id)) order by s.sort, s.id)
                        from public.sleeves s where s.kind = 'store' and s.enabled and s.price_oreshards is not null), '[]'::jsonb));
end $$;

/** Buy a sleeve with Oreshards (once; the same idem key twice is one purchase). */
create function public.buy_sleeve(p_id text, p_idem_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); s public.sleeves; bal integer; l public.oreshard_ledger;
begin
  if p_idem_key is null or p_idem_key !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'bad idem_key'; end if;
  select * into s from public.sleeves where id = p_id;
  if not found or s.kind <> 'store' or not s.enabled or s.price_oreshards is null then raise exception 'That sleeve is not for sale.'; end if;
  if exists (select 1 from public.player_cosmetics where user_id = uid and kind = 'card_back' and item = s.id) then
    -- already owned: a repeat of the same click is fine, a new one is refused
    if exists (select 1 from public.oreshard_ledger where idem_key = 'sleeve:' || p_idem_key and user_id = uid) then
      return jsonb_build_object('ok', true, 'repeat', true, 'oreshards', coalesce((select oreshards from public.oreshard_wallets where user_id = uid), 0));
    end if;
    raise exception 'You already have that sleeve.';
  end if;
  bal := coalesce((select oreshards from public.oreshard_wallets where user_id = uid), 0);
  if bal < 0 then raise exception 'This account owes Oreshards from a refund; nothing can be spent until it is back to zero.'; end if;
  if bal < s.price_oreshards then raise exception 'Not enough Oreshards (this sleeve costs %, you have %).', s.price_oreshards, bal; end if;
  l := private.oreshard_apply(uid, -s.price_oreshards, 'sleeve', s.id, 'sleeve:' || p_idem_key);
  insert into public.player_cosmetics (user_id, kind, item, ref) values (uid, 'card_back', s.id, 'store') on conflict do nothing;
  return jsonb_build_object('ok', true, 'repeat', false, 'sleeve', s.id, 'oreshards', l.balance_after);
end $$;

-- my_cosmetics: the names come from the sleeves table (a new sleeve needs no code)
create or replace function public.my_cosmetics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return jsonb_build_object(
    'equipped', coalesce((select card_back from public.profiles where id = uid), 'default'),
    'card_backs', jsonb_build_array(jsonb_build_object('item', 'default', 'ref', 'everyone', 'name', coalesce((select name from public.sleeves where id = 'default'), 'Oreheart')))
      || coalesce((select jsonb_agg(jsonb_build_object('item', c.item, 'ref', c.ref, 'at', c.created_at, 'name', coalesce(s.name, c.item)) order by coalesce(s.sort, 999), c.created_at)
                   from public.player_cosmetics c left join public.sleeves s on s.id = c.item where c.user_id = uid and c.kind = 'card_back'), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- Admin: the sleeves list, prices, on/off, and new sleeves (a row + art/sleeves/<id>.webp)
-- ---------------------------------------------------------------------------
create function public.admin_sleeves() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'blurb', s.blurb, 'kind', s.kind, 'price', s.price_oreshards, 'enabled', s.enabled, 'sort', s.sort,
                        'owners', (select count(*) from public.player_cosmetics c where c.kind = 'card_back' and c.item = s.id)) order by s.sort, s.id)
                   from public.sleeves s), '[]'::jsonb);
end $$;

create function public.admin_set_sleeve(p_id text, p_name text, p_blurb text, p_price integer, p_enabled boolean, p_sort integer, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.assert_admin(); old public.sleeves; s public.sleeves;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if p_id is null or p_id !~ '^[a-z][a-z0-9-]{0,29}$' then raise exception 'id: lower-case letters, digits and dashes (the art is art/sleeves/<id>.webp)'; end if;
  if p_price is not null and (p_price < 1 or p_price > 100000) then raise exception 'price must be 1 to 100000 Oreshards, or empty for not sold'; end if;
  select * into old from public.sleeves where id = p_id;
  if found and old.kind in ('default', 'beta', 'chest') and p_price is not null then raise exception 'The % sleeve can''t be sold.', old.name; end if;
  insert into public.sleeves (id, name, blurb, kind, price_oreshards, enabled, sort)
    values (p_id, btrim(p_name), nullif(btrim(coalesce(p_blurb, '')), ''), coalesce(old.kind, 'store'), p_price, coalesce(p_enabled, true), coalesce(p_sort, 100))
  on conflict (id) do update set name = excluded.name, blurb = excluded.blurb, price_oreshards = excluded.price_oreshards, enabled = excluded.enabled, sort = excluded.sort
  returning * into s;
  perform private.audit(aid, 'set_sleeve', null, to_jsonb(old), to_jsonb(s), p_reason);
  return to_jsonb(s);
end $$;

revoke all on function public.sleeve_shop(), public.buy_sleeve(text, text), public.my_cosmetics(), public.admin_sleeves(),
  public.admin_set_sleeve(text, text, text, integer, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.sleeve_shop(), public.buy_sleeve(text, text), public.my_cosmetics(), public.admin_sleeves(),
  public.admin_set_sleeve(text, text, text, integer, boolean, integer, text) to authenticated;

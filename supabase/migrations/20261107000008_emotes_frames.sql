-- Emotes, avatar frames and the Founder avatars (Ken, Nov 7).
-- * Emotes: Sketch's art (art/emotes/manifest.json). Everyone owns the 10 free starter emotes; three faction packs (6 each) and every
--   single emote sell for coins or Oreshards (admin prices; a pack is cheaper than its six singles). A wheel of up to 8 equipped emotes;
--   in a PvP match the referee checks ownership (pvp_emote_ok) before passing one on.
-- * Frames: 8 (Sketch, art/frames/manifest.json): 6 for sale, the Founder frame (beta reward only) and the Producer frame (Ken only;
--   only an admin can grant it). Shown around the avatar where others see you: match, PvP lobby, Friends, Rankings.
-- * Founder avatars: 32 (art/avatars/founder/manifest.json), with the Founder frame, given by the beta welcome (and now to everyone
--   who already has the Founder card back). Never sold. set_avatar refuses one you were not given.
-- * Ken (ken.turney@gmail.com): the Producer frame (equipped) and title, and every Founder item; his avatar is left as it is. A no-op
--   when that account does not exist yet; safe to run again.
-- Safe for the real database.

alter table public.player_cosmetics drop constraint if exists player_cosmetics_kind_check;
alter table public.player_cosmetics add constraint player_cosmetics_kind_check check (kind in ('card_back', 'emote', 'frame', 'avatar'));
alter table public.profiles add column if not exists frame text;
alter table public.profiles add column if not exists title text check (title is null or length(title) <= 30);
alter table public.profiles add column if not exists emote_wheel text[] not null default
  array['free-starter/friends', 'free-starter/good-game', 'free-starter/nice', 'free-starter/thinking', 'free-starter/your-turn', 'free-starter/yes', 'free-starter/no-thanks', 'free-starter/hello'];

alter table public.transactions drop constraint transactions_reason_check;
alter table public.transactions add constraint transactions_reason_check check (reason in
  ('signup_bonus', 'admin_grant', 'match_reward', 'pack_purchase', 'donation_reward', 'refund_reversal', 'quest_reward', 'oreshard_convert', 'cosmetic'));
alter table public.oreshard_ledger drop constraint if exists oreshard_ledger_reason_check;
alter table public.oreshard_ledger add constraint oreshard_ledger_reason_check check (reason in ('purchase', 'reversal', 'convert', 'admin_grant', 'sleeve', 'pack', 'cosmetic'));

-- ---------------------------------------------------------------------------
-- The catalog (admin-editable prices; null = not sold)
-- ---------------------------------------------------------------------------
create table if not exists public.emote_packs (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null check (length(btrim(name)) between 1 and 40),
  free boolean not null default false,
  price_coins integer check (price_coins is null or price_coins between 1 and 1000000),
  price_oreshards integer check (price_oreshards is null or price_oreshards between 1 and 100000),
  enabled boolean not null default true,
  sort integer not null default 100
);
create table if not exists public.emotes (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,30}/[a-z][a-z0-9-]{1,30}$'),
  pack text not null references public.emote_packs (id),
  label text not null check (length(btrim(label)) between 1 and 40),
  price_coins integer check (price_coins is null or price_coins between 1 and 1000000),
  price_oreshards integer check (price_oreshards is null or price_oreshards between 1 and 100000),
  enabled boolean not null default true,
  sort integer not null default 100
);
create table if not exists public.frames (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null check (length(btrim(name)) between 1 and 40),
  kind text not null check (kind in ('store', 'founder', 'producer')),
  price_coins integer check (price_coins is null or price_coins between 1 and 1000000),
  price_oreshards integer check (price_oreshards is null or price_oreshards between 1 and 100000),
  enabled boolean not null default true,
  sort integer not null default 100
);
revoke all on public.emote_packs, public.emotes, public.frames from public, anon, authenticated;
alter table public.emote_packs enable row level security;
alter table public.emotes enable row level security;
alter table public.frames enable row level security;

insert into public.emote_packs (id, name, free, price_coins, price_oreshards, sort) values
  ('free-starter', 'Free Starter', true, null, null, 0),
  ('goblin-grumbles', 'Goblin Grumbles', false, 800, 400, 10),
  ('gnome-gizmos', 'Gnome Gizmos', false, 800, 400, 20),
  ('dwarf-grudges', 'Dwarf Grudges', false, 800, 400, 30)
on conflict (id) do nothing;
insert into public.emotes (id, pack, label, price_coins, price_oreshards, sort) values
  ('free-starter/hello', 'free-starter', 'Hello!', null, null, 0),
  ('free-starter/good-game', 'free-starter', 'Good game! (GG)', null, null, 1),
  ('free-starter/oops', 'free-starter', 'Oops!', null, null, 2),
  ('free-starter/wow', 'free-starter', 'Wow!', null, null, 3),
  ('free-starter/friends', 'free-starter', 'Friends?', null, null, 4),
  ('free-starter/thinking', 'free-starter', 'Thinking...', null, null, 5),
  ('free-starter/your-turn', 'free-starter', 'Your turn!', null, null, 6),
  ('free-starter/nice', 'free-starter', 'Nice!', null, null, 7),
  ('free-starter/yes', 'free-starter', 'Yes!', null, null, 8),
  ('free-starter/no-thanks', 'free-starter', 'No thanks', null, null, 9),
  ('goblin-grumbles/grubnak-laugh', 'goblin-grumbles', 'Grubnak laughs', 200, 100, 10),
  ('goblin-grumbles/grubnak-rage', 'goblin-grumbles', 'Grubnak rages', 200, 100, 11),
  ('goblin-grumbles/belch', 'goblin-grumbles', 'BURP!', 200, 100, 12),
  ('goblin-grumbles/oink', 'goblin-grumbles', 'Oink!', 200, 100, 13),
  ('goblin-grumbles/kaboom', 'goblin-grumbles', 'KA-BOOM!', 200, 100, 14),
  ('goblin-grumbles/mine', 'goblin-grumbles', 'Mine!', 200, 100, 15),
  ('gnome-gizmos/knobbin-smug', 'gnome-gizmos', 'Knobbin smirks', 200, 100, 20),
  ('gnome-gizmos/thinking', 'gnome-gizmos', 'Thinking...', 200, 100, 21),
  ('gnome-gizmos/ta-da', 'gnome-gizmos', 'Ta-da!', 200, 100, 22),
  ('gnome-gizmos/confused', 'gnome-gizmos', 'Confused', 200, 100, 23),
  ('gnome-gizmos/eureka', 'gnome-gizmos', 'Eureka!', 200, 100, 24),
  ('gnome-gizmos/robot-salute', 'gnome-gizmos', 'Robot salute', 200, 100, 25),
  ('dwarf-grudges/borgo-proud', 'dwarf-grudges', 'Borgo stands proud', 200, 100, 30),
  ('dwarf-grudges/borgo-facepalm', 'dwarf-grudges', 'Borgo facepalm', 200, 100, 31),
  ('dwarf-grudges/wham', 'dwarf-grudges', 'WHAM!', 200, 100, 32),
  ('dwarf-grudges/cheers', 'dwarf-grudges', 'Cheers!', 200, 100, 33),
  ('dwarf-grudges/hmph', 'dwarf-grudges', 'Hmph!', 200, 100, 34),
  ('dwarf-grudges/shield-up', 'dwarf-grudges', 'Shield up!', 200, 100, 35)
on conflict (id) do nothing;
insert into public.frames (id, name, kind, price_coins, price_oreshards, sort) values
  ('producer', 'Producer', 'producer', null, null, 0),
  ('founder', 'Founder', 'founder', null, null, 10),
  ('goblin-junkpile', 'Goblin Junkpile', 'store', 1000, 500, 20),
  ('gnome-arcane', 'Gnome Arcane', 'store', 1000, 500, 30),
  ('dwarf-deepforge', 'Dwarf Deepforge', 'store', 1000, 500, 40),
  ('crystal-crown', 'Crystal Crown', 'store', 1000, 500, 50),
  ('piglet-pen', 'Piglet Pen', 'store', 1000, 500, 60),
  ('skullfang', 'Skullfang', 'store', 1000, 500, 70)
on conflict (id) do nothing;

-- the Founder avatars may be saved (set_avatar still checks the player was given them)
update public.settings
set value = (select jsonb_agg(x order by x) from (select jsonb_array_elements_text(value) as x from public.settings where key = 'avatar_cards'
                                                   union select jsonb_array_elements_text('["founder-boy-black", "founder-boy-white", "founder-girl-black", "founder-girl-white", "founder-man-black", "founder-man-white", "founder-woman-black", "founder-woman-white", "founder-east-asian-boy", "founder-east-asian-girl", "founder-east-asian-man", "founder-east-asian-woman", "founder-south-asian-boy", "founder-south-asian-girl", "founder-south-asian-man", "founder-south-asian-woman", "founder-latino-boy", "founder-latino-girl", "founder-latino-man", "founder-latino-woman", "founder-mena-boy", "founder-mena-girl", "founder-mena-man", "founder-mena-woman", "founder-sea-pacific-boy", "founder-sea-pacific-girl", "founder-sea-pacific-man", "founder-sea-pacific-woman", "founder-indigenous-boy", "founder-indigenous-girl", "founder-indigenous-man", "founder-indigenous-woman"]'::jsonb)) ids),
    updated_at = now()
where key = 'avatar_cards';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
/** the emotes this player may use: every free one, plus the ones bought (singles or through a pack) */
create or replace function private.owned_emotes(p_user uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e.id order by e.sort), '{}') from public.emotes e join public.emote_packs p on p.id = e.pack
  where e.enabled and (p.free or exists (select 1 from public.player_cosmetics c where c.user_id = p_user and c.kind = 'emote' and c.item = e.id))
$$;
/** pay for a cosmetic: coins or Oreshards; raises a plain-words error when short */
create or replace function private.pay_cosmetic(p_user uuid, p_coins integer, p_shards integer, p_pay text, p_ref text, p_idem text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare bal integer;
begin
  if p_pay = 'oreshards' then
    if p_shards is null then raise exception 'That is not sold for Oreshards.'; end if;
    perform 1 from public.oreshard_wallets where user_id = p_user for update;
    bal := coalesce((select oreshards from public.oreshard_wallets where user_id = p_user), 0);
    if bal < 0 then raise exception 'This account owes Oreshards from a refund; nothing can be spent until it is back to zero.'; end if;
    if bal < p_shards then raise exception 'Not enough Oreshards (this costs %, you have %).', p_shards, bal; end if;
    perform private.oreshard_apply(p_user, -p_shards, 'cosmetic', p_ref, 'cos:' || p_idem);
    return jsonb_build_object('paid_with', 'oreshards', 'price', p_shards);
  elsif p_pay = 'coins' then
    if p_coins is null then raise exception 'That is not sold for coins.'; end if;
    if coalesce((select coins from public.wallets where user_id = p_user), 0) < p_coins then raise exception 'Not enough coins (this costs %).', p_coins; end if;
    perform private.ledger_apply(p_user, -p_coins, 'cosmetic', p_ref, 'cos:' || p_idem, null);
    return jsonb_build_object('paid_with', 'coins', 'price', p_coins);
  end if;
  raise exception 'Pay with coins or Oreshards.';
end $$;
/** the Founder items: the card back, the frame and every Founder avatar */
create or replace function private.grant_founder(p_user uuid, p_ref text) returns void
language sql security definer set search_path = '' as $$
  insert into public.player_cosmetics (user_id, kind, item, ref)
    select p_user, k, i, p_ref from (values ('card_back', 'founder'), ('frame', 'founder')) v(k, i)
    union all select p_user, 'avatar', a, p_ref from unnest(array['founder-boy-black', 'founder-boy-white', 'founder-girl-black', 'founder-girl-white', 'founder-man-black', 'founder-man-white', 'founder-woman-black', 'founder-woman-white', 'founder-east-asian-boy', 'founder-east-asian-girl', 'founder-east-asian-man', 'founder-east-asian-woman', 'founder-south-asian-boy', 'founder-south-asian-girl', 'founder-south-asian-man', 'founder-south-asian-woman', 'founder-latino-boy', 'founder-latino-girl', 'founder-latino-man', 'founder-latino-woman', 'founder-mena-boy', 'founder-mena-girl', 'founder-mena-man', 'founder-mena-woman', 'founder-sea-pacific-boy', 'founder-sea-pacific-girl', 'founder-sea-pacific-man', 'founder-sea-pacific-woman', 'founder-indigenous-boy', 'founder-indigenous-girl', 'founder-indigenous-man', 'founder-indigenous-woman']) a
  on conflict do nothing
$$;

-- ---------------------------------------------------------------------------
-- Player doors
-- ---------------------------------------------------------------------------
create or replace function public.my_emotes() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); own text[];
begin
  own := private.owned_emotes(uid);
  return jsonb_build_object('owned', to_jsonb(own),
    'wheel', to_jsonb(coalesce((select array_agg(w) from unnest((select emote_wheel from public.profiles where id = uid)) w where w = any (own)), '{}'::text[])));
end $$;

create or replace function public.set_emote_wheel(p_ids text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); own text[] := private.owned_emotes(uid); bad text;
begin
  if p_ids is null or cardinality(p_ids) > 8 then raise exception 'Up to 8 emotes on the wheel.'; end if;
  if (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids) then raise exception 'Each emote once.'; end if;
  select x into bad from unnest(p_ids) x where not (x = any (own)) limit 1;
  if found then raise exception 'You don''t have that emote yet.'; end if;
  update public.profiles set emote_wheel = p_ids where id = uid;
  return jsonb_build_object('wheel', to_jsonb(p_ids));
end $$;

create or replace function public.emote_shop() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); own text[] := private.owned_emotes(uid);
begin
  return jsonb_build_object(
    'coins', coalesce((select coins from public.wallets where user_id = uid), 0),
    'oreshards', coalesce((select oreshards from public.oreshard_wallets where user_id = uid), 0),
    'packs', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'free', p.free, 'price_coins', p.price_coins, 'price_oreshards', p.price_oreshards,
                 'owned', not exists (select 1 from public.emotes e where e.pack = p.id and e.enabled and not (e.id = any (own))),
                 'emotes', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'label', e.label, 'price_coins', e.price_coins, 'price_oreshards', e.price_oreshards, 'owned', e.id = any (own)) order by e.sort), '[]'::jsonb)
                            from public.emotes e where e.pack = p.id and e.enabled)) order by p.sort)
               from public.emote_packs p where p.enabled), '[]'::jsonb));
end $$;

/** buy an emote pack ('pack') or one emote ('emote') with coins or Oreshards; the same idem key twice is one purchase */
create or replace function public.buy_emote(p_what text, p_id text, p_pay text, p_idem_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); p public.emote_packs; e public.emotes; paid jsonb; got text[];
begin
  if p_idem_key is null or p_idem_key !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'bad idem_key'; end if;
  if exists (select 1 from public.transactions where idem_key = 'cos:' || p_idem_key and user_id = uid)
     or exists (select 1 from public.oreshard_ledger where idem_key = 'cos:' || p_idem_key and user_id = uid) then
    return jsonb_build_object('ok', true, 'repeat', true, 'owned', to_jsonb(private.owned_emotes(uid)));
  end if;
  if p_what = 'pack' then
    select * into p from public.emote_packs where id = p_id and enabled;
    if not found or p.free then raise exception 'That pack is not for sale.'; end if;
    select array_agg(x.id) into got from public.emotes x where x.pack = p.id and x.enabled and not (x.id = any (private.owned_emotes(uid)));
    if got is null then raise exception 'You have every emote in that pack.'; end if;
    paid := private.pay_cosmetic(uid, p.price_coins, p.price_oreshards, p_pay, 'emote-pack:' || p.id, p_idem_key);
  elsif p_what = 'emote' then
    select * into e from public.emotes where id = p_id and enabled;
    if not found then raise exception 'That emote is not for sale.'; end if;
    if e.id = any (private.owned_emotes(uid)) then raise exception 'You already have that emote.'; end if;
    paid := private.pay_cosmetic(uid, e.price_coins, e.price_oreshards, p_pay, 'emote:' || e.id, p_idem_key);
    got := array[e.id];
  else raise exception 'Buy a pack or an emote.';
  end if;
  insert into public.player_cosmetics (user_id, kind, item, ref) select uid, 'emote', x, 'store' from unnest(got) x on conflict do nothing;
  return jsonb_build_object('ok', true, 'repeat', false, 'got', to_jsonb(got), 'owned', to_jsonb(private.owned_emotes(uid))) || paid;
end $$;

create or replace function public.my_frames() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return jsonb_build_object('equipped', (select frame from public.profiles where id = uid), 'title', (select title from public.profiles where id = uid),
    'coins', coalesce((select coins from public.wallets where user_id = uid), 0),
    'oreshards', coalesce((select oreshards from public.oreshard_wallets where user_id = uid), 0),
    'frames', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'kind', f.kind, 'price_coins', f.price_coins, 'price_oreshards', f.price_oreshards,
                 'owned', exists (select 1 from public.player_cosmetics c where c.user_id = uid and c.kind = 'frame' and c.item = f.id)) order by f.sort)
               from public.frames f where f.enabled and (f.kind = 'store' or exists (select 1 from public.player_cosmetics c where c.user_id = uid and c.kind = 'frame' and c.item = f.id))), '[]'::jsonb),
    'avatars', coalesce((select jsonb_agg(c.item order by c.item) from public.player_cosmetics c where c.user_id = uid and c.kind = 'avatar'), '[]'::jsonb));
end $$;

create or replace function public.set_frame(p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  if p_id is not null and not exists (select 1 from public.player_cosmetics where user_id = uid and kind = 'frame' and item = p_id) then
    raise exception 'You don''t have that frame yet.';
  end if;
  update public.profiles set frame = p_id where id = uid;
  return jsonb_build_object('equipped', p_id);
end $$;

create or replace function public.buy_frame(p_id text, p_pay text, p_idem_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); f public.frames; paid jsonb;
begin
  if p_idem_key is null or p_idem_key !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'bad idem_key'; end if;
  if exists (select 1 from public.transactions where idem_key = 'cos:' || p_idem_key and user_id = uid)
     or exists (select 1 from public.oreshard_ledger where idem_key = 'cos:' || p_idem_key and user_id = uid) then
    return jsonb_build_object('ok', true, 'repeat', true);
  end if;
  select * into f from public.frames where id = p_id and enabled;
  if not found or f.kind <> 'store' then raise exception 'That frame is not for sale.'; end if;
  if exists (select 1 from public.player_cosmetics where user_id = uid and kind = 'frame' and item = f.id) then raise exception 'You already have that frame.'; end if;
  paid := private.pay_cosmetic(uid, f.price_coins, f.price_oreshards, p_pay, 'frame:' || f.id, p_idem_key);
  insert into public.player_cosmetics (user_id, kind, item, ref) values (uid, 'frame', f.id, 'store') on conflict do nothing;
  return jsonb_build_object('ok', true, 'repeat', false, 'frame', f.id) || paid;
end $$;

-- the beta welcome now also gives the Founder frame and the 32 Founder avatars
create or replace function public.beta_welcome() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); seen boolean;
begin
  if not coalesce((private.setting('beta_mode'))::boolean, false) then return jsonb_build_object('show', false, 'beta', false); end if;
  perform private.grant_founder(uid, 'beta');
  seen := coalesce((select flags ? 'beta_welcomed' from public.profiles where id = uid), false);
  if not seen then update public.profiles set flags = flags || jsonb_build_object('beta_welcomed', now()) where id = uid; end if;
  return jsonb_build_object('show', not seen, 'beta', true, 'reward', 'founder',
                            'equipped', coalesce((select card_back from public.profiles where id = uid), 'default'),
                            'frame', (select frame from public.profiles where id = uid), 'avatar', (select avatar from public.profiles where id = uid),
                            'avatars', '["founder-boy-black", "founder-boy-white", "founder-girl-black", "founder-girl-white", "founder-man-black", "founder-man-white", "founder-woman-black", "founder-woman-white", "founder-east-asian-boy", "founder-east-asian-girl", "founder-east-asian-man", "founder-east-asian-woman", "founder-south-asian-boy", "founder-south-asian-girl", "founder-south-asian-man", "founder-south-asian-woman", "founder-latino-boy", "founder-latino-girl", "founder-latino-man", "founder-latino-woman", "founder-mena-boy", "founder-mena-girl", "founder-mena-man", "founder-mena-woman", "founder-sea-pacific-boy", "founder-sea-pacific-girl", "founder-sea-pacific-man", "founder-sea-pacific-woman", "founder-indigenous-boy", "founder-indigenous-girl", "founder-indigenous-man", "founder-indigenous-woman"]'::jsonb);
end $$;

-- the PvP gate: the referee also learns the frame and title (the opponent sees them)
create or replace function public.pvp_gate() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return (select jsonb_build_object('user_id', p.id, 'username', p.username, 'avatar', p.avatar, 'card_back', p.card_back, 'frame', p.frame, 'title', p.title) from public.profiles p where p.id = uid);
end $$;

-- the referee: may this player use this emote? (free, or bought)
create or replace function public.pvp_emote_ok(p_user uuid, p_emote text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_referee();
  return p_emote = any (private.owned_emotes(p_user));
end $$;

create or replace function public.set_avatar(p_card text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  if p_card is null or not (p_card = any (private.setting_text_list('avatar_cards'))) then
    raise exception 'That picture can''t be an avatar.';
  end if;
  -- a restricted account can't save a mature avatar; the wording gives nothing away
  if private.mature_fallback(p_card) is not null and not private.can_see_mature(uid) then
    raise exception 'That picture can''t be an avatar.';
  end if;
  -- Nov 7: a Founder avatar only for those who were given one (the beta welcome, or an admin)
  if p_card like 'founder-%' and not exists (select 1 from public.player_cosmetics where user_id = uid and kind = 'avatar' and item = p_card) then
    raise exception 'That picture can''t be an avatar.';
  end if;
  update public.profiles set avatar = p_card where id = uid;
end $$;

create or replace function public.leaderboard(p_limit integer default 10) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); lim integer := least(greatest(coalesce(p_limit, 10), 1), 100); me jsonb;
begin
  me := public.my_rank();
  return jsonb_build_object(
    'season', private.season_now(), 'season_end', private.season_end(),
    'top', coalesce((select jsonb_agg(jsonb_build_object('place', row_number, 'user_id', user_id, 'username', username, 'avatar', avatar, 'rating', points, 'label', private.rank_name(points), 'frame', (select pp.frame from public.profiles pp where pp.id = x.user_id), 'wins', wins, 'losses', losses, 'games', games, 'me', user_id = uid) order by row_number)
                     from (select row_number() over (order by r.points desc, r.user_id) as row_number, r.user_id, p.username, p.avatar, r.points, r.wins, r.losses, r.games
                           from public.ratings r join public.profiles p on p.id = r.user_id
                           where r.season = private.season_now() and r.games > 0 order by r.points desc, r.user_id limit lim) x), '[]'::jsonb),
    'me', me,
    'players', me -> 'players',
    'shares', coalesce((select jsonb_object_agg(name, n) from (select private.rank_of(r.points) ->> 'name' as name, count(*) as n from public.ratings r where r.season = private.season_now() and r.games > 0 group by 1) s), '{}'::jsonb));
end $$;

create or replace function private.friend_card(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar,
    'rating', coalesce((select r.points from public.ratings r where r.user_id = p.id and r.season = private.season_now()), 0),
    'rank', private.rank_name(coalesce((select r.points from public.ratings r where r.user_id = p.id and r.season = private.season_now()), 0)),
    'status', private.player_status(p.id), 'frame', p.frame, 'title', p.title)
  from public.profiles p where p.id = p_user
$$;

-- ---------------------------------------------------------------------------
-- Admin: prices and on/off for emote packs, emotes and frames; grant a cosmetic (the only way to the Producer frame)
-- ---------------------------------------------------------------------------
create or replace function public.admin_cosmetics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return jsonb_build_object(
    'emote_packs', coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('owners', (select count(distinct c.user_id) from public.player_cosmetics c join public.emotes e on e.id = c.item where c.kind = 'emote' and e.pack = p.id)) order by p.sort) from public.emote_packs p), '[]'::jsonb),
    'emotes', coalesce((select jsonb_agg(to_jsonb(e) order by e.sort) from public.emotes e), '[]'::jsonb),
    'frames', coalesce((select jsonb_agg(to_jsonb(f) || jsonb_build_object('owners', (select count(*) from public.player_cosmetics c where c.kind = 'frame' and c.item = f.id)) order by f.sort) from public.frames f), '[]'::jsonb));
end $$;

create or replace function public.admin_set_cosmetic_price(p_kind text, p_id text, p_coins integer, p_oreshards integer, p_enabled boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.assert_admin(); before jsonb; after jsonb;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if (p_coins is not null and (p_coins < 1 or p_coins > 1000000)) or (p_oreshards is not null and (p_oreshards < 1 or p_oreshards > 100000)) then raise exception 'prices: coins 1-1000000, Oreshards 1-100000, or empty for not sold'; end if;
  if p_kind = 'emote_pack' then
    select to_jsonb(x) into before from public.emote_packs x where id = p_id; if before is null then raise exception 'unknown emote pack'; end if;
    if (before ->> 'free')::boolean and (p_coins is not null or p_oreshards is not null) then raise exception 'The free starter emotes can''t be sold.'; end if;
    update public.emote_packs set price_coins = p_coins, price_oreshards = p_oreshards, enabled = coalesce(p_enabled, enabled) where id = p_id;
    select to_jsonb(x) into after from public.emote_packs x where id = p_id;
  elsif p_kind = 'emote' then
    select to_jsonb(x) into before from public.emotes x where id = p_id; if before is null then raise exception 'unknown emote'; end if;
    update public.emotes set price_coins = p_coins, price_oreshards = p_oreshards, enabled = coalesce(p_enabled, enabled) where id = p_id;
    select to_jsonb(x) into after from public.emotes x where id = p_id;
  elsif p_kind = 'frame' then
    select to_jsonb(x) into before from public.frames x where id = p_id; if before is null then raise exception 'unknown frame'; end if;
    if before ->> 'kind' <> 'store' and (p_coins is not null or p_oreshards is not null) then raise exception 'The % frame can''t be sold.', before ->> 'name'; end if;
    update public.frames set price_coins = p_coins, price_oreshards = p_oreshards, enabled = coalesce(p_enabled, enabled) where id = p_id;
    select to_jsonb(x) into after from public.frames x where id = p_id;
  else raise exception 'kind: emote_pack, emote or frame';
  end if;
  perform private.audit(aid, 'set_cosmetic_price', null, before, after, p_reason);
  return after;
end $$;

create or replace function public.admin_grant_cosmetic(p_user uuid, p_kind text, p_item text, p_title text, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.assert_admin();
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'no such player'; end if;
  if p_kind = 'founder' then perform private.grant_founder(p_user, 'admin');
  elsif p_kind = 'frame' then
    if not exists (select 1 from public.frames where id = p_item) then raise exception 'unknown frame'; end if;
    insert into public.player_cosmetics (user_id, kind, item, ref) values (p_user, 'frame', p_item, 'admin') on conflict do nothing;
  elsif p_kind = 'emote' then
    if not exists (select 1 from public.emotes where id = p_item) then raise exception 'unknown emote'; end if;
    insert into public.player_cosmetics (user_id, kind, item, ref) values (p_user, 'emote', p_item, 'admin') on conflict do nothing;
  else raise exception 'kind: founder, frame or emote';
  end if;
  if p_title is not null then update public.profiles set title = nullif(btrim(p_title), '') where id = p_user; end if;
  perform private.audit(aid, 'grant_cosmetic', p_user, null, jsonb_build_object('kind', p_kind, 'item', p_item, 'title', p_title), p_reason);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function private.owned_emotes(uuid), private.pay_cosmetic(uuid, integer, integer, text, text, text), private.grant_founder(uuid, text) from public, anon, authenticated;
revoke all on function public.my_emotes(), public.set_emote_wheel(text[]), public.emote_shop(), public.buy_emote(text, text, text, text), public.my_frames(), public.set_frame(text),
  public.buy_frame(text, text, text), public.admin_cosmetics(), public.admin_set_cosmetic_price(text, text, integer, integer, boolean, text),
  public.admin_grant_cosmetic(uuid, text, text, text, text) from public, anon;
grant execute on function public.my_emotes(), public.set_emote_wheel(text[]), public.emote_shop(), public.buy_emote(text, text, text, text), public.my_frames(), public.set_frame(text),
  public.buy_frame(text, text, text), public.admin_cosmetics(), public.admin_set_cosmetic_price(text, text, integer, integer, boolean, text),
  public.admin_grant_cosmetic(uuid, text, text, text, text) to authenticated;
revoke all on function public.pvp_emote_ok(uuid, text) from public, anon, authenticated;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.pvp_emote_ok(uuid, text) to service_role; end if; end $$;

-- ---------------------------------------------------------------------------
-- One-time grants
-- ---------------------------------------------------------------------------
-- everyone who already has the Founder card back (the beta welcome before today) gets the rest of the Founder items
do $$ declare r record; begin
  for r in select distinct user_id from public.player_cosmetics where kind = 'card_back' and item = 'founder' loop perform private.grant_founder(r.user_id, 'beta'); end loop;
end $$;
-- Ken (Nov 7: "My special border is going to go to the account of ken.turney@gmail.com ... I'll choose the avatar I want"):
-- the Producer frame (equipped) and title, every Founder item; his avatar is not touched. Re-runnable; nothing happens without the account.
do $$ declare kid uuid; begin
  select id into kid from auth.users where lower(email) = 'ken.turney@gmail.com' limit 1;
  if kid is null or not exists (select 1 from public.profiles where id = kid) then return; end if;
  perform private.grant_founder(kid, 'producer-grant');
  insert into public.player_cosmetics (user_id, kind, item, ref) values (kid, 'frame', 'producer', 'producer-grant') on conflict do nothing;
  update public.profiles set frame = 'producer', title = 'Producer' where id = kid;
  perform private.audit(kid, 'grant_cosmetic', kid, null, jsonb_build_object('kind', 'producer', 'items', jsonb_build_array('frame:producer', 'founder')), 'one-time Producer grant (Ken, Nov 7)');
end $$;

-- The Main Dashboard (design D, Ken approved Nov 5) and the 10-step Ranked ladder (Forge, Nov 5):
--   * Ranked uses ONE number, the Elo rating. The rank is read off it with thresholds per step (admin setting ranked_ladder):
--     Stone < 700, Copper, Iron, Silver, Sapphire (1000, where everyone starts), Emerald, Ruby, Amethyst, Diamond, Oreheart 1500+.
--     Each step but Oreheart has divisions III, II, I (thirds of the step). The older offline rank points stay for vs-computer.
--   * pvp_rank_of says the step, the division, the label, the floors and the place on the server; leaderboard() gives the
--     top players and the caller's own row; season_info() the season and when it ends.
--   * What's New: an admin-editable table (news_posts: patch notes, events, news), read by news_feed(), seeded with the real
--     recent patch. Events are placeholders until tournaments exist.

insert into public.settings (key, value) values
  ('ranked_ladder', '[{"name": "Stone", "min": 0}, {"name": "Copper", "min": 700}, {"name": "Iron", "min": 800}, {"name": "Silver", "min": 900}, {"name": "Sapphire", "min": 1000}, {"name": "Emerald", "min": 1100}, {"name": "Ruby", "min": 1200}, {"name": "Amethyst", "min": 1300}, {"name": "Diamond", "min": 1400}, {"name": "Oreheart", "min": 1500}]'::jsonb),
  ('dashboard_counts', 'true'::jsonb)
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
               'ranked_ladder', 'dashboard_counts']
$$;
revoke all on function private.editable_settings() from public, anon, authenticated;

-- the ladder step for a rating: {tier (0..9), name, division ('III'|'II'|'I'|''), label, floor, next (null at the top), progress (0..1 inside the division)}
create or replace function private.rank_of(p_rating integer) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  ladder jsonb := coalesce(private.setting('ranked_ladder'), '[{"name": "Stone", "min": 0}]'::jsonb);
  n integer := jsonb_array_length(ladder);
  i integer; t integer := 0; floor_r integer := 0; next_r integer := null; nm text := 'Stone';
  span integer; d integer; div text := ''; dfloor integer; dnext integer; prog numeric;
begin
  for i in 0..n - 1 loop
    if p_rating >= (ladder -> i ->> 'min')::int then t := i; nm := ladder -> i ->> 'name'; floor_r := (ladder -> i ->> 'min')::int; next_r := case when i < n - 1 then (ladder -> (i + 1) ->> 'min')::int else null end; end if;
  end loop;
  if next_r is null then
    return jsonb_build_object('tier', t, 'name', nm, 'division', '', 'label', nm, 'floor', floor_r, 'next', null, 'div_floor', floor_r, 'div_next', null, 'progress', 1);
  end if;
  span := greatest(1, next_r - floor_r);
  d := least(2, greatest(0, ((p_rating - floor_r) * 3) / span)); -- 0 = III, 1 = II, 2 = I
  div := (array['III', 'II', 'I'])[d + 1];
  dfloor := floor_r + (span * d) / 3; dnext := case when d = 2 then next_r else floor_r + (span * (d + 1)) / 3 end;
  prog := least(1, greatest(0, (p_rating - dfloor)::numeric / greatest(1, dnext - dfloor)));
  return jsonb_build_object('tier', t, 'name', nm, 'division', div, 'label', nm || ' ' || div, 'floor', floor_r, 'next', next_r, 'div_floor', dfloor, 'div_next', dnext, 'progress', round(prog, 3));
end $$;
create or replace function private.rank_name(p_rating integer) returns text
language sql stable set search_path = '' as $$ select private.rank_of(p_rating) ->> 'label' $$;

-- when the season ends (the quarter's last moment, UTC)
create or replace function private.season_end() returns timestamptz
language sql stable set search_path = '' as $$
  select (date_trunc('quarter', now() at time zone 'utc') + interval '3 months') at time zone 'utc'
$$;

create or replace function public.pvp_rank_of(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.ratings; my_rating integer; place bigint;
begin
  perform private.assert_referee();
  select * into r from public.ratings where user_id = p_user and season = private.season_now();
  my_rating := coalesce(r.rating, 1000);
  select count(*) + 1 into place from public.ratings x where x.season = private.season_now() and x.games > 0 and (x.rating > my_rating or (x.rating = my_rating and x.user_id < p_user));
  return jsonb_build_object('season', private.season_now(), 'season_end', private.season_end(), 'rating', my_rating, 'name', private.rank_name(my_rating),
    'games', coalesce(r.games, 0), 'wins', coalesce(r.wins, 0), 'losses', coalesce(r.losses, 0), 'peak', coalesce(r.peak, 1000),
    'place', case when coalesce(r.games, 0) > 0 then place else null end, 'rank', private.rank_of(my_rating),
    'ladder', coalesce(private.setting('ranked_ladder'), '[]'::jsonb));
end $$;

-- the player's own rank card (the referee's view, for the signed-in player themself)
create or replace function public.my_rank() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); r public.ratings; my_rating integer; place bigint; total bigint;
begin
  select * into r from public.ratings where user_id = uid and season = private.season_now();
  my_rating := coalesce(r.rating, 1000);
  select count(*) + 1 into place from public.ratings x where x.season = private.season_now() and x.games > 0 and (x.rating > my_rating or (x.rating = my_rating and x.user_id < uid));
  select count(*) into total from public.ratings x where x.season = private.season_now() and x.games > 0;
  return jsonb_build_object('season', private.season_now(), 'season_end', private.season_end(), 'rating', my_rating, 'name', private.rank_name(my_rating),
    'games', coalesce(r.games, 0), 'wins', coalesce(r.wins, 0), 'losses', coalesce(r.losses, 0), 'peak', coalesce(r.peak, 1000),
    'place', case when coalesce(r.games, 0) > 0 then place else null end, 'players', total, 'rank', private.rank_of(my_rating),
    'ladder', coalesce(private.setting('ranked_ladder'), '[]'::jsonb));
end $$;

-- the top of the season, and the caller's own row (usernames and avatars are public profile facts)
create or replace function public.leaderboard(p_limit integer default 10) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player(); lim integer := least(greatest(coalesce(p_limit, 10), 1), 100); me jsonb;
begin
  me := public.my_rank();
  return jsonb_build_object(
    'season', private.season_now(), 'season_end', private.season_end(),
    'top', coalesce((select jsonb_agg(jsonb_build_object('place', row_number, 'user_id', user_id, 'username', username, 'avatar', avatar, 'rating', rating, 'label', private.rank_name(rating), 'wins', wins, 'losses', losses, 'games', games, 'me', user_id = uid) order by row_number)
                     from (select row_number() over (order by r.rating desc, r.user_id) as row_number, r.user_id, p.username, p.avatar, r.rating, r.wins, r.losses, r.games
                           from public.ratings r join public.profiles p on p.id = r.user_id
                           where r.season = private.season_now() and r.games > 0 order by r.rating desc, r.user_id limit lim) x), '[]'::jsonb),
    'me', me,
    'players', me -> 'players',
    'shares', coalesce((select jsonb_object_agg(name, n) from (select private.rank_of(r.rating) ->> 'name' as name, count(*) as n from public.ratings r where r.season = private.season_now() and r.games > 0 group by 1) s), '{}'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- What's New: patch notes, events and news, editable by admins (the Studio admin page comes later)
-- ---------------------------------------------------------------------------
create table public.news_posts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('patch', 'event', 'news')),
  title       text not null check (length(title) between 1 and 120),
  subtitle    text,                                   -- a patch's version or date words, an event's time line
  body        jsonb not null default '[]'::jsonb,    -- patch: [{"section": "new"|"fixed"|"known"|"announce", "items": ["..."]}]; news / event: ["line", ...]
  event_on    date,                                   -- events only
  action      text check (action is null or action in ('join', 'remind')), -- events only; shown disabled until tournaments exist
  active      boolean not null default true,
  sort        integer not null default 0,
  posted_on   date not null default current_date,
  created_by  uuid,
  updated_at  timestamptz not null default now()
);
revoke all on public.news_posts from public, anon, authenticated;
alter table public.news_posts enable row level security;

create or replace function public.news_feed() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not logged in' using errcode = '28000'; end if;
  return jsonb_build_object(
    'patch', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'subtitle', subtitle, 'body', body, 'posted_on', posted_on) order by sort desc, posted_on desc) from public.news_posts where active and kind = 'patch'), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'subtitle', subtitle, 'body', body, 'event_on', event_on, 'action', action) order by event_on nulls last, sort desc) from public.news_posts where active and kind = 'event'), '[]'::jsonb),
    'news', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'subtitle', subtitle, 'body', body, 'posted_on', posted_on) order by sort desc, posted_on desc) from public.news_posts where active and kind = 'news'), '[]'::jsonb));
end $$;

-- admins edit the posts (the Studio admin page will call this); null p_id = new
create or replace function public.admin_news_set(p_id uuid, p_kind text, p_title text, p_subtitle text, p_body jsonb, p_event_on date, p_action text, p_active boolean, p_sort integer, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.assert_admin(); nid uuid;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if p_id is null then
    insert into public.news_posts (kind, title, subtitle, body, event_on, action, active, sort, created_by)
      values (p_kind, p_title, p_subtitle, coalesce(p_body, '[]'::jsonb), p_event_on, p_action, coalesce(p_active, true), coalesce(p_sort, 0), aid) returning id into nid;
  else
    update public.news_posts set kind = p_kind, title = p_title, subtitle = p_subtitle, body = coalesce(p_body, '[]'::jsonb), event_on = p_event_on, action = p_action,
      active = coalesce(p_active, true), sort = coalesce(p_sort, 0), updated_at = now() where id = p_id returning id into nid;
    if nid is null then raise exception 'no such post'; end if;
  end if;
  insert into public.admin_audit (admin_id, action, target_user, before, after, reason) values (aid, 'news_set', null, jsonb_build_object('post', p_id), jsonb_build_object('post', nid, 'kind', p_kind, 'title', p_title), p_reason);
  return nid;
end $$;

-- the seed: the real recent patch (Nov 1 live patch and the Nov 5 test-server work), two placeholder events, one news line
insert into public.news_posts (kind, title, subtitle, body, sort, posted_on) values
  ('patch', 'Patch 0.9.5 (test server)', 'November 5', '[
     {"section": "new", "items": ["<b>Ranked, Unranked and Practice</b> on the test server, with the connection clock and the average wait", "<b>Card upgrades</b>: combine copies, five looks from Original to Mythic, found in packs too", "<b>Packs</b>: 11 cards (3 cheap Miners, 4 Common, 2 Uncommon, 1 Rare, 1 Rare or better), Commanders and crystals in packs", "<b>Bundles and My Packs</b>: 1, 6, 24 and the 99 treasure chest; open one or many", "<b>Bad-luck shield</b>: 40 packs without a Legendary and the 40th brings one"]},
     {"section": "fixed", "items": ["Ranked no longer says \"cannot reach the server\"", "PvP mulligans happen at the same time", "Starter decks follow the copy limit"]},
     {"section": "known", "items": ["Friend codes can take a moment to appear", "Phone: some screens are still being restyled"]}
   ]'::jsonb, 10, '2026-11-05'),
  ('patch', 'Patch Nov 1 (live)', 'November 1', '[
     {"section": "new", "items": ["<b>Combat v3</b>: dice you can see, fair shuffles, new costs and movement", "<b>Guard arrows</b> and the rebuilt tutorial", "<b>Offline play</b> on the installed app"]},
     {"section": "fixed", "items": ["Units no longer freeze after a Respond window"]}
   ]'::jsonb, 5, '2026-11-01'),
  ('news', 'Welcome to the test server', 'Oreheart Online, early days', '["Coins, packs and ranks here are for testing: they may be wiped before launch.", "Found something odd? Tell Ken."]'::jsonb, 1, '2026-11-05');
insert into public.news_posts (kind, title, subtitle, body, event_on, action, sort) values
  ('event', 'Crystal Cup', 'Tournament · coming soon', '["A Swiss tournament for every army. Dates and rules follow once tournaments exist."]'::jsonb, null, 'join', 2),
  ('event', 'Goblin Rumble Weekend', 'Double coins on goblin quests · coming soon', '["A weekend event. Dates follow."]'::jsonb, null, 'remind', 1);

revoke all on function public.my_rank(), public.leaderboard(integer), public.news_feed(), public.admin_news_set(uuid, text, text, text, jsonb, date, text, boolean, integer, text) from public, anon;
grant execute on function public.my_rank(), public.leaderboard(integer), public.news_feed(), public.admin_news_set(uuid, text, text, text, jsonb, date, text, boolean, integer, text) to authenticated;
revoke all on function private.rank_of(integer), private.rank_name(integer), private.season_end() from public, anon, authenticated;

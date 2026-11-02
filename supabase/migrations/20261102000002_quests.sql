-- Oreheart Online, Phase B (Nov 2): daily quests.
-- Three quests a day (one easy, one medium, one hard). Progress comes from match summaries:
-- the browser reports vs-computer matches through quest_report(); PvP matches are reported
-- by the server itself (private.pvp_finish). A reward is paid once per quest through
-- private.ledger_apply(). Finishing all three of a day's quests grows a streak; every
-- quest_streak_days days of streak give one free pack.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- The quest catalogue (admin-editable rows). kind says which summary number counts:
--   battles -> battles, wins -> wins, battles_with / wins_with -> same but only when
--   summary.commander = params.commander, creatures_played -> creaturesPlayed,
--   faction_cards -> cardsByFaction[params.faction], cost7_played -> cost7Plays,
--   hits_landed -> hitsLanded, hits_blocked -> hitsBlocked, units_defeated -> unitsDefeated,
--   commander_damage -> commanderDamage, mine_hold -> mineHoldTurns (best run, not a sum),
--   miner_mines -> minerMines.
create table public.quest_defs (
  id      text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name    text not null,
  text    text not null,
  tier    text not null check (tier in ('easy', 'medium', 'hard')),
  kind    text not null check (kind in ('battles', 'wins', 'battles_with', 'wins_with', 'creatures_played', 'faction_cards',
                                        'cost7_played', 'hits_landed', 'hits_blocked', 'units_defeated', 'commander_damage',
                                        'mine_hold', 'miner_mines')),
  target  integer not null check (target between 1 and 1000),
  params  jsonb not null default '{}'::jsonb,
  active  boolean not null default true
);

insert into public.quest_defs (id, name, text, tier, kind, target, params) values
  ('pick-a-fight',        'Pick a Fight',          'Play 2 battles.',                              'easy',   'battles',          2,  '{}'),
  ('summon-the-rabble',   'Summon the Rabble',     'Play 8 creatures.',                            'easy',   'creatures_played', 8,  '{}'),
  ('clink-clink',         'Clink Clink',           'Mine with Miners 5 times.',                    'easy',   'miner_mines',      5,  '{}'),
  ('thwack',              'THWACK!',               'Land 10 hits.',                                'easy',   'hits_landed',      10, '{}'),
  ('winner-winner',       'Winner Winner',         'Win 2 battles.',                               'medium', 'wins',             2,  '{}'),
  ('day-out',             '[Commander]''s Day Out', 'Fight 3 battles with [Commander].',           'medium', 'battles_with',     3,  '{"pick": "commander"}'),
  ('faction-pride',       '[Faction] Pride',       'Play 10 [Faction] cards.',                     'medium', 'faction_cards',    10, '{"pick": "faction"}'),
  ('big-spender',         'Big Spender',           'Play a card that costs 7 or more.',            'medium', 'cost7_played',     1,  '{}'),
  ('bonk-collector',      'Bonk Collector',        'Defeat 8 enemy units.',                        'medium', 'units_defeated',   8,  '{}'),
  ('shield-wall',         'Shield Wall',           'Block 5 hits.',                                'medium', 'hits_blocked',     5,  '{}'),
  ('crown-jewels',        'Crown Jewels',          'Win a battle with [Commander].',               'hard',   'wins_with',        1,  '{"pick": "commander"}'),
  ('mine-all-mine',       'Mine, All Mine',        'Hold a mine for 3 turns in a row.',            'hard',   'mine_hold',        3,  '{}'),
  ('right-in-the-kisser', 'Right in the Kisser',   'Deal 10 damage to Commanders.',                'hard',   'commander_damage', 10, '{}'),
  ('hat-trick',           'Hat Trick',             'Win 3 battles.',                               'hard',   'wins',             3,  '{}')
on conflict (id) do nothing;

-- The quests dealt to players. Rows are never deleted; a rerolled quest is marked and replaced.
create table public.player_quests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  quest_id   text not null references public.quest_defs (id),
  params     jsonb not null default '{}'::jsonb,        -- e.g. {"commander": "grubnak"} or {"faction": "goblins"}
  dealt_on   date not null,
  progress   integer not null default 0 check (progress >= 0),
  target     integer not null check (target >= 1),
  done_at    timestamptz,
  paid_tx    bigint,
  rerolled   boolean not null default false,
  expires_on date not null
);
create index player_quests_user on public.player_quests (user_id, dealt_on desc);

-- Every match report, once: a match (or practice game) can only count a single time.
create table public.quest_reports (
  user_id    uuid not null,
  ref        text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, ref)
);
create index quest_reports_user_day on public.quest_reports (user_id, created_at desc);
create trigger quest_reports_append_only before update or delete on public.quest_reports
  for each row execute function private.forbid_change();

create table public.quest_streaks (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  days           integer not null default 0 check (days >= 0),
  last_day       date,                                  -- the last day all three quests were finished
  last_reroll_on date                                   -- one reroll a day
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.quest_reward(p_tier text) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((private.setting('quest_reward_' || p_tier))::int,
                  case p_tier when 'easy' then 25 when 'medium' then 50 else 75 end)
$$;

-- Fills [Commander] and [Faction] in a quest's name or text from the dealt params.
create function private.quest_fill(p_text text, p_params jsonb) returns text
language sql stable security definer set search_path = '' as $$
  select replace(replace(p_text,
    '[Commander]', coalesce(private.setting('commander_names') ->> (p_params ->> 'commander'),
                            initcap(coalesce(p_params ->> 'commander', 'the Commander')))),
    '[Faction]', case p_params ->> 'faction' when 'goblins' then 'Goblin' when 'gnomes' then 'Gnome' when 'dwarves' then 'Dwarf'
                 else 'Faction' end)
$$;

-- Deals one random active quest of a tier (not one of p_avoid), with its [Commander]/[Faction] picked.
create function private.quest_deal(p_user uuid, p_tier text, p_on date, p_avoid text[] default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  ids text[];
  d public.quest_defs;
  prm jsonb := '{}'::jsonb;
  cmds text[] := private.setting_text_list('commander_ids');
  facs text[] := array['goblins', 'gnomes', 'dwarves'];
  qid uuid;
  pick integer;
begin
  ids := array(select q.id from public.quest_defs q where q.active and q.tier = p_tier and not (q.id = any (p_avoid)) order by q.id);
  if cardinality(ids) = 0 then
    ids := array(select q.id from public.quest_defs q where q.active and q.tier = p_tier order by q.id);
  end if;
  if cardinality(ids) = 0 then return null; end if;
  -- (the roll is taken once, here; inside the WHERE it would be re-rolled for every row)
  pick := 1 + private.random_below(cardinality(ids));
  select * into d from public.quest_defs where id = ids[pick];
  if d.params ->> 'pick' = 'commander' and cardinality(cmds) > 0 then
    prm := jsonb_build_object('commander', cmds[1 + private.random_below(cardinality(cmds))]);
  elsif d.params ->> 'pick' = 'faction' then
    prm := jsonb_build_object('faction', facs[1 + private.random_below(3)]);
  end if;
  insert into public.player_quests (user_id, quest_id, params, dealt_on, target, expires_on)
    values (p_user, d.id, prm, p_on, d.target, p_on + 3) returning id into qid;
  return qid;
end $$;

-- Caps one match summary (4.3 of the contract) so a tampered report can't race through quests.
create function private.quest_cap_summary(p_summary jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'turns',           least(greatest(coalesce((p_summary ->> 'turns')::int, 0), 0), 60),
    'won',             coalesce((p_summary ->> 'won')::boolean, false),
    'commander',       left(coalesce(p_summary ->> 'commander', ''), 64),
    'battles',         1,
    'wins',            case when coalesce((p_summary ->> 'won')::boolean, false) then 1 else 0 end,
    'creaturesPlayed', least(greatest(coalesce((p_summary ->> 'creaturesPlayed')::int, 0), 0), 60),
    'cardsByFaction',  jsonb_build_object(
        'goblins', least(greatest(coalesce((p_summary -> 'cardsByFaction' ->> 'goblins')::int, 0), 0), 60),
        'gnomes',  least(greatest(coalesce((p_summary -> 'cardsByFaction' ->> 'gnomes')::int, 0), 0), 60),
        'dwarves', least(greatest(coalesce((p_summary -> 'cardsByFaction' ->> 'dwarves')::int, 0), 0), 60)),
    'cost7Plays',      least(greatest(coalesce((p_summary ->> 'cost7Plays')::int, 0), 0), 20),
    'hitsLanded',      least(greatest(coalesce((p_summary ->> 'hitsLanded')::int, 0), 0), 200),
    'hitsBlocked',     least(greatest(coalesce((p_summary ->> 'hitsBlocked')::int, 0), 0), 100),
    'unitsDefeated',   least(greatest(coalesce((p_summary ->> 'unitsDefeated')::int, 0), 0), 60),
    'commanderDamage', least(greatest(coalesce((p_summary ->> 'commanderDamage')::int, 0), 0), 60),
    'mineHoldTurns',   least(greatest(coalesce((p_summary ->> 'mineHoldTurns')::int, 0), 0), 60),
    'minerMines',      least(greatest(coalesce((p_summary ->> 'minerMines')::int, 0), 0), 120))
$$;

-- How much one summary adds to a quest of this kind.
create function private.quest_gain(p_kind text, p_params jsonb, p_sum jsonb) returns integer
language sql immutable set search_path = '' as $$
  select case p_kind
    when 'battles'          then 1
    when 'wins'             then (p_sum ->> 'wins')::int
    when 'battles_with'     then case when p_sum ->> 'commander' = p_params ->> 'commander' then 1 else 0 end
    when 'wins_with'        then case when p_sum ->> 'commander' = p_params ->> 'commander' then (p_sum ->> 'wins')::int else 0 end
    when 'creatures_played' then (p_sum ->> 'creaturesPlayed')::int
    when 'faction_cards'    then coalesce((p_sum -> 'cardsByFaction' ->> coalesce(p_params ->> 'faction', ''))::int, 0)
    when 'cost7_played'     then (p_sum ->> 'cost7Plays')::int
    when 'hits_landed'      then (p_sum ->> 'hitsLanded')::int
    when 'hits_blocked'     then (p_sum ->> 'hitsBlocked')::int
    when 'units_defeated'   then (p_sum ->> 'unitsDefeated')::int
    when 'commander_damage' then (p_sum ->> 'commanderDamage')::int
    when 'mine_hold'        then (p_sum ->> 'mineHoldTurns')::int
    when 'miner_mines'      then (p_sum ->> 'minerMines')::int
    else 0 end
$$;

-- Deals today's three quests when the player has none for today. Locks the profile row
-- so two calls at once can't deal six.
create function private.quest_deal_today(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare today date := private.today(); t text;
begin
  perform 1 from public.profiles where id = p_user for update;
  if exists (select 1 from public.player_quests where user_id = p_user and dealt_on = today) then return; end if;
  foreach t in array array['easy', 'medium', 'hard'] loop
    perform private.quest_deal(p_user, t, today,
      array(select q.quest_id from public.player_quests q where q.user_id = p_user and q.done_at is null and q.expires_on >= today));
  end loop;
  insert into public.quest_streaks (user_id) values (p_user) on conflict (user_id) do nothing;
end $$;

-- Applies one match summary to every open quest of the player. The ref (practice:<uuid> or
-- match:<uuid>) may only ever be reported once per player. Pays each finished quest ONCE
-- (ledger idem_key quest:<row id>) and keeps the streak. Returns the ids of the quests
-- finished by this report.
create function private.quest_progress(p_user uuid, p_summary jsonb, p_ref text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  today date := private.today();
  sm jsonb := private.quest_cap_summary(coalesce(p_summary, '{}'::jsonb));
  q record;
  gain integer;
  newp integer;
  t public.transactions;
  done_now jsonb := '[]'::jsonb;
  st public.quest_streaks;
  streak_len integer := coalesce((private.setting('quest_streak_days'))::int, 7);
begin
  if p_user is null or p_ref is null or length(p_ref) not between 8 and 120 then raise exception 'bad quest report'; end if;
  begin
    insert into public.quest_reports (user_id, ref) values (p_user, p_ref);
  exception when unique_violation then
    raise exception 'That match was already counted.';
  end;
  perform private.quest_deal_today(p_user);
  -- A match that ended before turn 3 counts for nothing (but the ref is used up).
  if (sm ->> 'turns')::int < 3 then return done_now; end if;
  for q in select pq.id, pq.quest_id, pq.params, pq.progress, pq.target, qd.kind, qd.tier, qd.name
           from public.player_quests pq join public.quest_defs qd on qd.id = pq.quest_id
           where pq.user_id = p_user and pq.done_at is null and not pq.rerolled and pq.expires_on >= today
           order by pq.dealt_on, pq.id for update of pq loop
    gain := greatest(coalesce(private.quest_gain(q.kind, q.params, sm), 0), 0);
    if gain = 0 then continue; end if;
    newp := case when q.kind = 'mine_hold' then greatest(q.progress, gain) else q.progress + gain end;
    newp := least(newp, q.target);
    if newp >= q.target then
      update public.player_quests set progress = newp, done_at = now() where id = q.id;
      if private.quest_reward(q.tier) > 0 then
        t := private.ledger_apply(p_user, private.quest_reward(q.tier), 'quest_reward', q.id::text, 'quest:' || q.id, null);
        update public.player_quests set paid_tx = t.id where id = q.id and paid_tx is null;
        update public.player_stats set coins_earned = coins_earned + private.quest_reward(q.tier) where user_id = p_user;
      end if;
      done_now := done_now || jsonb_build_object('id', q.id, 'quest_id', q.quest_id, 'name', private.quest_fill(q.name, q.params),
                                                 'tier', q.tier, 'reward', private.quest_reward(q.tier));
    else
      update public.player_quests set progress = newp where id = q.id;
    end if;
  end loop;
  -- Streak: all of today's dealt quests done (once per day).
  if done_now <> '[]'::jsonb
     and not exists (select 1 from public.player_quests where user_id = p_user and dealt_on = today and not rerolled and done_at is null)
     and exists (select 1 from public.player_quests where user_id = p_user and dealt_on = today and not rerolled) then
    insert into public.quest_streaks (user_id) values (p_user) on conflict (user_id) do nothing;
    select * into st from public.quest_streaks where user_id = p_user for update;
    if st.last_day is distinct from today then
      update public.quest_streaks
        set days = case when st.last_day = today - 1 then st.days + 1 else 1 end, last_day = today
        where user_id = p_user returning * into st;
      if streak_len > 0 and st.days % streak_len = 0 then
        update public.wallets set free_packs = free_packs + 1, updated_at = now() where user_id = p_user;
      end if;
    end if;
  end if;
  return done_now;
end $$;

-- ---------------------------------------------------------------------------
-- Player doors
-- ---------------------------------------------------------------------------

-- The Quests screen. Deals today's three when needed. Shows today's quests and the open
-- ones from the last days (at most 6), newest first.
create function public.my_quests() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  today date := private.today();
  st public.quest_streaks;
begin
  perform private.quest_deal_today(uid);
  select * into st from public.quest_streaks where user_id = uid;
  return jsonb_build_object(
    'quests', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'quest_id', x.quest_id, 'name', private.quest_fill(x.name, x.params), 'text', private.quest_fill(x.text, x.params),
        'tier', x.tier, 'reward', private.quest_reward(x.tier), 'progress', x.progress, 'target', x.target,
        'done', x.done_at is not null, 'dealt_on', x.dealt_on, 'expires_on', x.expires_on)
        order by x.dealt_on desc, x.tier_sort, x.id)
      from (select pq.id, pq.quest_id, pq.params, pq.progress, pq.target, pq.done_at, pq.dealt_on, pq.expires_on,
                   qd.name, qd.text, qd.tier, case qd.tier when 'easy' then 1 when 'medium' then 2 else 3 end as tier_sort
            from public.player_quests pq join public.quest_defs qd on qd.id = pq.quest_id
            where pq.user_id = uid and not pq.rerolled
              and (pq.dealt_on = today or (pq.done_at is null and pq.expires_on >= today))
            order by pq.dealt_on desc, pq.id limit 6) x), '[]'::jsonb),
    'reroll_left', case when st.last_reroll_on = today then 0 else 1 end,
    'streak_days', coalesce(st.days, 0),
    'streak_goal', coalesce((private.setting('quest_streak_days'))::int, 7),
    'free_packs', (select free_packs from public.wallets where user_id = uid),
    'today', today);
end $$;

-- Swap one unfinished quest for another of the same tier. Once a day.
create function public.quest_reroll(p_quest uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  today date := private.today();
  q public.player_quests;
  d public.quest_defs;
  st public.quest_streaks;
  nid uuid;
begin
  perform private.quest_deal_today(uid);
  insert into public.quest_streaks (user_id) values (uid) on conflict (user_id) do nothing;
  select * into st from public.quest_streaks where user_id = uid for update;
  if st.last_reroll_on = today then raise exception 'You already swapped a quest today.'; end if;
  select * into q from public.player_quests where id = p_quest and user_id = uid for update;
  if not found or q.rerolled or q.expires_on < today then raise exception 'quest not found'; end if;
  if q.done_at is not null then raise exception 'That quest is already done.'; end if;
  select * into d from public.quest_defs where id = q.quest_id;
  update public.player_quests set rerolled = true where id = q.id;
  nid := private.quest_deal(uid, d.tier, q.dealt_on,
    array[q.quest_id] || array(select x.quest_id from public.player_quests x where x.user_id = uid and x.done_at is null and not x.rerolled and x.expires_on >= today));
  if nid is null then raise exception 'No other quest of that kind to swap in.'; end if;
  -- the swapped-in quest keeps the old one's expiry
  update public.player_quests set expires_on = q.expires_on where id = nid;
  update public.quest_streaks set last_reroll_on = today where user_id = uid;
  return public.my_quests();
end $$;

-- The browser's report of a finished vs-computer match. p_ref = practice:<uuid> (the game's match id).
-- At most 20 reports a day. Returns the Quests screen plus "just_done": the quests this report finished.
create function public.quest_report(p_summary jsonb, p_ref text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  done_now jsonb;
begin
  if p_ref is null or p_ref !~ '^practice:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'bad match reference';
  end if;
  if p_summary is null or jsonb_typeof(p_summary) <> 'object' then raise exception 'bad match summary'; end if;
  -- Serialise this player's reports (the wallet row is the per-player lock everywhere).
  perform 1 from public.wallets where user_id = uid for update;
  if (select count(*) from public.quest_reports r where r.user_id = uid and r.created_at >= private.day_start()) >= 20 then
    raise exception 'Enough battles counted for today; quests pick up again tomorrow.';
  end if;
  done_now := private.quest_progress(uid, p_summary, p_ref);
  return public.my_quests() || jsonb_build_object('just_done', done_now);
end $$;

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------

revoke all on public.quest_defs, public.player_quests, public.quest_reports, public.quest_streaks from public, anon, authenticated;
grant select on public.quest_defs, public.player_quests, public.quest_streaks to authenticated;

alter table public.quest_defs    enable row level security;
alter table public.player_quests enable row level security;
alter table public.quest_reports enable row level security;
alter table public.quest_streaks enable row level security;

create policy active_quest_defs on public.quest_defs    for select to authenticated using (active);
create policy own_quests        on public.player_quests for select to authenticated using (user_id = (select auth.uid()));
create policy own_streak        on public.quest_streaks for select to authenticated using (user_id = (select auth.uid()));

revoke all on function private.quest_reward(text), private.quest_fill(text, jsonb), private.quest_deal(uuid, text, date, text[]),
  private.quest_cap_summary(jsonb), private.quest_gain(text, jsonb, jsonb), private.quest_deal_today(uuid),
  private.quest_progress(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.my_quests(), public.quest_reroll(uuid), public.quest_report(jsonb, text) from public, anon, authenticated;
grant execute on function public.my_quests() to authenticated;
grant execute on function public.quest_reroll(uuid) to authenticated;
grant execute on function public.quest_report(jsonb, text) to authenticated;

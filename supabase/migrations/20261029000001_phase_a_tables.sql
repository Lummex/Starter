-- Oreheart Online, Phase A: tables, Row Level Security, privileges.
-- Rule: players can READ their own rows and WRITE nothing directly.
-- Every change goes through the functions in the next migration.

create schema if not exists private;
-- The private schema is never exposed through the API (only "public" is).
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------------------

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  avatar         text check (avatar is null or avatar ~ '^[a-z0-9-]{1,64}$'),
  flags          jsonb not null default '{}'::jsonb,
  -- Age gate (COPPA). Only the group is kept, never the birth date.
  age_group      text not null default '13_plus' check (age_group in ('13_plus', 'under_13')),
  -- not_needed (13+), pending (under 13, waiting for a parent), approved, revoked
  consent_status text not null default 'not_needed' check (consent_status in ('not_needed', 'pending', 'approved', 'revoked')),
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles (lower(username));

create table public.roles (
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('admin', 'moderator')),
  granted_by  uuid,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role)
);

-- Ban history, the coin ledger and card history use plain uuids (no foreign key),
-- so they survive if an account is ever deleted; those rows can never be removed.
create table public.bans (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  reason      text not null check (length(btrim(reason)) >= 3),
  banned_by   uuid,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,                       -- null = permanent
  lifted_at   timestamptz,
  lifted_by   uuid,
  lift_reason text
);
create index bans_user on public.bans (user_id);

create table public.wallets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  coins      integer not null default 0 check (coins >= 0),
  updated_at timestamptz not null default now()
);

-- Append-only coin ledger. Corrections are new rows, never edits.
create table public.transactions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null,
  delta         integer not null check (delta <> 0),
  reason        text not null check (reason in
                  ('signup_bonus','admin_grant','match_reward','pack_purchase','donation_reward','refund_reversal')),
  ref           text,
  idem_key      text not null unique,
  balance_after integer not null check (balance_after >= 0),
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index transactions_user on public.transactions (user_id, id desc);

-- ---------------------------------------------------------------------------
-- Cards: one row per physical card (instance), each with its own id.
-- Never shown to players (they only see counts through my_collection()).
-- Ready for trading later: owner changes only through private.card_transfer(),
-- and every change is an append-only card_history row.
-- ---------------------------------------------------------------------------

create table public.card_instances (
  id                 uuid primary key default gen_random_uuid(),
  card_id            text not null check (card_id ~ '^[a-z0-9-]{1,64}$'),
  owner_id           uuid,                    -- current owner (null = destroyed/removed)
  original_owner_id  uuid not null,           -- the player who first got it
  origin             text not null check (origin in ('starter', 'pack', 'admin_grant', 'donation', 'event', 'reward')),
  origin_ref         text,                    -- pack opening id, admin action, donation id, ...
  status             text not null default 'owned' check (status in ('owned', 'destroyed')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index card_instances_owner on public.card_instances (owner_id, card_id);
create index card_instances_original on public.card_instances (original_owner_id);

create table public.card_history (
  id                bigint generated always as identity primary key,
  card_instance_id  uuid not null references public.card_instances (id),
  event             text not null check (event in ('created', 'transferred', 'destroyed', 'admin_moved')),
  from_user         uuid,
  to_user           uuid,
  reason            text,                     -- 'starter', 'trade', 'pack', admin reason, ...
  ref               text,                     -- trade id, pack opening id, audit id, ...
  created_by        uuid,                     -- admin or null (server)
  created_at        timestamptz not null default now()
);
create index card_history_instance on public.card_history (card_instance_id, id);
create index card_history_users on public.card_history (to_user);

create table public.decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 40),
  commander   text check (commander is null or commander ~ '^[a-z0-9-]{1,64}$'),
  cards       text[] not null default '{}' check (cardinality(cards) <= 100),
  source      text not null default 'saved' check (source in ('saved', 'imported')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index decks_user on public.decks (user_id);

-- ---------------------------------------------------------------------------
-- Parent consent for players under 13 (COPPA, "email plus" method).
-- ---------------------------------------------------------------------------

create table public.parental_consents (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null unique,
  parent_email        text not null,          -- the account's email is the parent's
  method              text not null default 'email_plus',
  status              text not null default 'pending' check (status in ('pending', 'approved', 'revoked', 'expired')),
  notice_version      text not null,          -- which privacy notice the parent saw
  request_token_hash  text,                   -- sha256 of the link token; the token itself is never stored here
  request_sent_at     timestamptz not null default now(),
  request_expires_at  timestamptz not null,
  approved_at         timestamptz,
  approved_ip         text,
  revoke_token_hash   text,
  revoked_at          timestamptz,
  revoked_by          text,                   -- 'parent' or 'admin:<uuid>'
  updated_at          timestamptz not null default now()
);

create table public.consent_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  event       text not null check (event in ('requested', 'resent', 'approved', 'revoked', 'expired')),
  ip          text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index consent_events_user on public.consent_events (user_id, id);

-- Emails our own server sends (parent consent). A small Edge Function sends
-- the rows and fills sent_at. Nobody reads this through the API.
create table public.email_outbox (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  to_email    text not null,
  kind        text not null check (kind in ('parent_consent_request', 'parent_consent_confirmed', 'parent_consent_revoked', 'contact_reply')),
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  attempts    integer not null default 0,
  last_error  text
);
create index email_outbox_unsent on public.email_outbox (id) where sent_at is null;

-- "Contact us" messages (parents and players). Nobody gets a personal email:
-- messages land here and Ken answers them in the back counter's Inbox.
create table public.contact_messages (
  id              bigint generated always as identity primary key,
  topic           text not null check (topic in ('parent_request', 'delete_account', 'question', 'problem', 'other')),
  message         text not null check (length(btrim(message)) between 5 and 2000),
  reply_email     text check (reply_email is null or (length(reply_email) <= 200 and reply_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,}$')),
  name            text check (name is null or length(name) <= 80),
  child_username  text check (child_username is null or child_username ~ '^[A-Za-z0-9_]{3,16}$'),
  user_id         uuid,                       -- the logged-in sender, if any
  ip              text,
  created_at      timestamptz not null default now(),
  status          text not null default 'new' check (status in ('new', 'handled')),
  handled_at      timestamptz,
  handled_by      uuid,
  handled_note    text,
  reply_text      text                        -- the answer sent from the no-reply address, if any
);
create index contact_messages_status on public.contact_messages (status, id desc);
create index contact_messages_ip on public.contact_messages (ip, created_at);

-- ---------------------------------------------------------------------------
-- Admin record, settings, stats, ranked seasons (seasons/ratings filled from Phase C)
-- ---------------------------------------------------------------------------

-- Append-only record of every admin action.
create table public.admin_audit (
  id           bigint generated always as identity primary key,
  admin_id     uuid not null,
  action       text not null,
  target_user  uuid,
  before       jsonb,
  after        jsonb,
  reason       text not null check (length(btrim(reason)) >= 3),
  ip           text,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index admin_audit_created on public.admin_audit (created_at desc);
create index admin_audit_target on public.admin_audit (target_user);

create table public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.player_stats (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  games               integer not null default 0,
  wins                integer not null default 0,
  losses              integer not null default 0,
  ties                integer not null default 0,
  abandons            integer not null default 0,
  win_streak          integer not null default 0,
  best_streak         integer not null default 0,
  turns_total         integer not null default 0,
  cards_played        integer not null default 0,
  creatures_defeated  integer not null default 0,
  ore_mined           integer not null default 0,
  sites_captured      integer not null default 0,
  packs_opened        integer not null default 0,
  coins_earned        integer not null default 0,
  coins_spent         integer not null default 0,
  -- Real money given (US cents). Stays 0 until Phase D donations fill it.
  money_spent_cents   bigint  not null default 0 check (money_spent_cents >= 0),
  last_match_at       timestamptz,
  by_faction          jsonb not null default '{}'::jsonb,
  by_commander        jsonb not null default '{}'::jsonb
);

-- Ranked play (Phase C). One season per quarter; ratings are per season.
create table public.seasons (
  id          text primary key check (id ~ '^[0-9]{4}-Q[1-4]$'),   -- e.g. 2027-Q1
  name        text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'upcoming' check (status in ('upcoming', 'active', 'finished')),
  check (ends_at > starts_at)
);

create table public.player_ratings (
  user_id      uuid not null references auth.users (id) on delete cascade,
  season_id    text not null references public.seasons (id),
  rating       double precision not null default 1500,  -- Glicko-2 rating (hidden)
  rd           double precision not null default 350,   -- rating deviation (how unsure)
  volatility   double precision not null default 0.06,
  games        integer not null default 0,
  wins         integer not null default 0,
  losses       integer not null default 0,
  tier         text,                                     -- visible rank, from rating - 2*rd
  peak_tier    text,
  updated_at   timestamptz not null default now(),
  primary key (user_id, season_id)
);

-- ---------------------------------------------------------------------------
-- Append-only guards (they also stop the database owner by accident)
-- ---------------------------------------------------------------------------

create function private.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

create trigger transactions_append_only before update or delete on public.transactions
  for each row execute function private.forbid_change();
create trigger transactions_no_truncate before truncate on public.transactions
  for each statement execute function private.forbid_change();
create trigger admin_audit_append_only before update or delete on public.admin_audit
  for each row execute function private.forbid_change();
create trigger admin_audit_no_truncate before truncate on public.admin_audit
  for each statement execute function private.forbid_change();
create trigger card_history_append_only before update or delete on public.card_history
  for each row execute function private.forbid_change();
create trigger card_history_no_truncate before truncate on public.card_history
  for each statement execute function private.forbid_change();
create trigger consent_events_append_only before update or delete on public.consent_events
  for each row execute function private.forbid_change();
-- Kept forever, changed only by status/owner updates: bans, card instances, consents.
create trigger bans_no_delete before delete on public.bans
  for each row execute function private.forbid_change();
create trigger card_instances_no_delete before delete on public.card_instances
  for each row execute function private.forbid_change();
create trigger card_instances_no_truncate before truncate on public.card_instances
  for each statement execute function private.forbid_change();
create trigger parental_consents_no_delete before delete on public.parental_consents
  for each row execute function private.forbid_change();
create trigger contact_messages_no_delete before delete on public.contact_messages
  for each row execute function private.forbid_change();

-- ---------------------------------------------------------------------------
-- Privileges: Supabase gives anon/authenticated ALL on new public tables by
-- default. Take everything away, then hand back SELECT only where a player
-- may read their own rows.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;

grant select on public.profiles, public.bans, public.wallets, public.transactions,
                public.decks, public.player_stats, public.player_ratings, public.seasons
  to authenticated;
-- No grants at all: roles, admin_audit, settings, card_instances, card_history,
-- parental_consents, consent_events, email_outbox, contact_messages.

-- ---------------------------------------------------------------------------
-- Row Level Security: on for every table. No policy = nobody.
-- ---------------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.roles              enable row level security;
alter table public.bans               enable row level security;
alter table public.wallets            enable row level security;
alter table public.transactions       enable row level security;
alter table public.card_instances     enable row level security;
alter table public.card_history       enable row level security;
alter table public.decks              enable row level security;
alter table public.parental_consents  enable row level security;
alter table public.consent_events     enable row level security;
alter table public.email_outbox       enable row level security;
alter table public.contact_messages   enable row level security;
alter table public.admin_audit        enable row level security;
alter table public.settings           enable row level security;
alter table public.player_stats       enable row level security;
alter table public.seasons            enable row level security;
alter table public.player_ratings     enable row level security;

create policy own_profile      on public.profiles       for select to authenticated using (id = (select auth.uid()));
create policy own_bans         on public.bans           for select to authenticated using (user_id = (select auth.uid()));
create policy own_wallet       on public.wallets        for select to authenticated using (user_id = (select auth.uid()));
create policy own_transactions on public.transactions   for select to authenticated using (user_id = (select auth.uid()));
create policy own_decks        on public.decks          for select to authenticated using (user_id = (select auth.uid()));
create policy own_stats        on public.player_stats   for select to authenticated using (user_id = (select auth.uid()));
create policy own_ratings      on public.player_ratings for select to authenticated using (user_id = (select auth.uid()));
create policy all_seasons      on public.seasons        for select to authenticated using (true);
-- Everything else: RLS on, no policies.

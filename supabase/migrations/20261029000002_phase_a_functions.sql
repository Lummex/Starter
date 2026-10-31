-- Oreheart Online, Phase A: server functions.
-- private.*  = internal helpers, never callable through the API.
-- public.*   = the only doors players, parents and admins have. Each one checks
--              who is calling. Admin doors start with private.assert_admin().

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

create function private.setting(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select value from public.settings where key = p_key
$$;

create function private.setting_text_list(p_key text) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array(select jsonb_array_elements_text(public.settings.value)
                        from public.settings where key = p_key), '{}'::text[])
$$;

-- 64 hex characters from two random uuids (244 random bits). Used for email links.
create function private.new_token() returns text
language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

create function private.sha(p_text text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p_text, ''), 'UTF8')), 'hex')
$$;

-- Lowercase, undo look-alike tricks (0->o, 1->i, 3->e, ...), keep letters only.
create function private.normalize_name(p_name text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(translate(lower(coalesce(p_name, '')), '0134578@$!|', 'oieastbasii'), '[^a-z]', '', 'g')
$$;

-- Returns null when the username is fine, otherwise a short reason for the player.
-- The word lists live in settings and are edited in the back counter.
create function private.username_problem(p_name text, p_ignore uuid default null) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  n text := private.normalize_name(p_name);
  w text;
begin
  if p_name is null or p_name !~ '^[A-Za-z0-9_]{3,16}$' then
    return 'Use 3 to 16 letters, numbers or _.';
  end if;
  if n = any (private.setting_text_list('reserved_usernames')) then
    return 'That name is reserved.';
  end if;
  foreach w in array private.setting_text_list('reserved_name_parts') loop
    if position(w in n) > 0 then return 'That name is reserved.'; end if;
  end loop;
  foreach w in array private.setting_text_list('blocked_words') loop
    if position(w in n) > 0 then return 'Please pick a different name.'; end if;
  end loop;
  if exists (select 1 from public.profiles
             where lower(username) = lower(p_name) and id is distinct from p_ignore) then
    return 'That name is taken.';
  end if;
  return null;
end $$;

create function private.active_ban(p_user uuid) returns public.bans
language sql stable security definer set search_path = '' as $$
  select * from public.bans
  where user_id = p_user and lifted_at is null and (expires_at is null or expires_at > now())
  order by created_at desc limit 1
$$;

create function private.is_banned(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bans
                 where user_id = p_user and lifted_at is null and (expires_at is null or expires_at > now()))
$$;

-- Every player door: logged in, not banned, and (under 13) approved by a parent.
create function private.assert_player() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  b public.bans;
  cs text;
begin
  if uid is null then raise exception 'not logged in' using errcode = '28000'; end if;
  b := private.active_ban(uid);
  if b.id is not null then
    raise exception 'banned until %', coalesce(to_char(b.expires_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"'), 'further notice')
      using errcode = '42501';
  end if;
  select consent_status into cs from public.profiles where id = uid;
  if cs = 'pending' then raise exception 'waiting for a parent to approve this account' using errcode = '42501'; end if;
  if cs = 'revoked' then raise exception 'a parent withdrew approval for this account' using errcode = '42501'; end if;
  return uid;
end $$;

-- Every admin door: admin role + 2-step login (aal2) + not banned.
create function private.assert_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.roles where user_id = uid and role = 'admin') then
    raise exception 'not admin' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception '2-step login required' using errcode = '42501';
  end if;
  if private.is_banned(uid) then
    raise exception 'not admin' using errcode = '42501';
  end if;
  return uid;
end $$;

create function private.request_header(p_name text) returns text
language sql stable set search_path = '' as $$
  select left(nullif(current_setting('request.headers', true), '')::json ->> p_name, 300)
$$;

create function private.request_ip() returns text
language sql stable set search_path = '' as $$
  select nullif(split_part(coalesce(private.request_header('x-forwarded-for'), ''), ',', 1), '')
$$;

create function private.audit(p_admin uuid, p_action text, p_target uuid, p_before jsonb, p_after jsonb, p_reason text)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit (admin_id, action, target_user, before, after, reason, ip, user_agent)
  values (p_admin, p_action, p_target, p_before, p_after, btrim(p_reason),
          private.request_ip(), private.request_header('user-agent'))
$$;

-- The ONLY way coins change. Idempotent: the same idem_key twice = one row.
create function private.ledger_apply(p_user uuid, p_delta integer, p_reason text, p_ref text,
                                     p_idem_key text, p_created_by uuid)
returns public.transactions
language plpgsql security definer set search_path = '' as $$
declare
  bal integer;
  t public.transactions;
begin
  if p_idem_key is null or length(p_idem_key) < 8 then raise exception 'idem_key required'; end if;
  select coins into bal from public.wallets where user_id = p_user for update;
  if not found then raise exception 'player has no wallet'; end if;
  -- Checked after taking the wallet lock, so two identical requests can't both pay.
  select * into t from public.transactions where idem_key = p_idem_key;
  if found then
    if t.user_id <> p_user or t.delta <> p_delta then raise exception 'idem_key already used for another change'; end if;
    return t;
  end if;
  if bal + p_delta < 0 then raise exception 'not enough coins (has %)', bal; end if;
  update public.wallets set coins = bal + p_delta, updated_at = now() where user_id = p_user;
  insert into public.transactions (user_id, delta, reason, ref, idem_key, balance_after, created_by)
  values (p_user, p_delta, p_reason, p_ref, p_idem_key, bal + p_delta, p_created_by)
  returning * into t;
  return t;
end $$;

-- ---------------------------------------------------------------------------
-- Cards: the ONLY ways card instances are made or change owner.
-- ---------------------------------------------------------------------------

-- Makes p_count new cards of p_card for p_user, each with its own id and a 'created' history row.
create function private.card_grant(p_user uuid, p_card text, p_count integer, p_origin text, p_ref text, p_by uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_count is null or p_count < 1 or p_count > 1000 then raise exception 'bad card count'; end if;
  with made as (
    insert into public.card_instances (card_id, owner_id, original_owner_id, origin, origin_ref)
    select p_card, p_user, p_user, p_origin, p_ref from generate_series(1, p_count)
    returning id
  )
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
  select made.id, 'created', null, p_user, p_origin, p_ref, p_by from made;
  get diagnostics n = row_count;
  return n;
end $$;

-- Moves one card to another player (trading later; admin fixes). Checks the current owner.
create function private.card_transfer(p_instance uuid, p_from uuid, p_to uuid, p_reason text, p_ref text, p_by uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare c public.card_instances;
begin
  select * into c from public.card_instances where id = p_instance for update;
  if not found then raise exception 'card not found'; end if;
  if c.status <> 'owned' or c.owner_id is distinct from p_from then raise exception 'card is not owned by the sender'; end if;
  if p_to is null or p_to = p_from then raise exception 'bad receiver'; end if;
  if not exists (select 1 from public.profiles where id = p_to) then raise exception 'receiver not found'; end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  update public.card_instances set owner_id = p_to, updated_at = now() where id = p_instance;
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
  values (p_instance, case when p_by is null then 'transferred' else 'admin_moved' end, p_from, p_to, btrim(p_reason), p_ref, p_by);
end $$;

-- Null when the deck may be stored, otherwise the reason. (Full deck legality
-- is the game's validateDeck; ownership is enforced from Phase B.)
create function private.deck_problem(p_name text, p_commander text, p_cards text[]) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  known text[] := private.setting_text_list('card_ids');
  bad text;
begin
  if p_name is null or length(btrim(p_name)) not between 1 and 40 then return 'Deck name must be 1 to 40 characters.'; end if;
  if p_commander is not null and not (p_commander = any (private.setting_text_list('commander_ids'))) then
    return 'Unknown commander.';
  end if;
  if p_cards is null then return 'No cards.'; end if;
  if cardinality(p_cards) > coalesce((private.setting('deck_max_cards'))::int, 100) then return 'Too many cards.'; end if;
  select c into bad from unnest(p_cards) c where c is null or not (c = any (known)) limit 1;
  if found then return 'Unknown card: ' || coalesce(left(bad, 64), 'empty'); end if;
  return null;
end $$;

-- Under-13 players type no free text except the username: their decks get plain names.
create function private.child_deck_name(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select 'Deck ' || (coalesce(max(nullif(substring(name from '^Deck ([0-9]{1,3})$'), '')::int), 0) + 1)
  from public.decks where user_id = p_user
$$;

-- ---------------------------------------------------------------------------
-- Sign-up: profile, wallet, stats, every starter-deck card (as instances),
-- signup coins, and for under-13s a parent consent request.
-- Runs inside the same transaction as the new auth user.
-- ---------------------------------------------------------------------------

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uname text := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
  child boolean := coalesce(new.raw_user_meta_data ->> 'age_group', '') = 'under_13';
  problem text;
  bonus integer := coalesce((private.setting('signup_bonus_coins'))::int, 0);
  card record;
  tok text;
begin
  if uname is null then
    uname := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  problem := private.username_problem(uname);
  if problem is not null then
    raise exception 'username: %', problem using errcode = '23514';
  end if;
  insert into public.profiles (id, username, age_group, consent_status, created_at, last_seen_at)
    values (new.id, uname, case when child then 'under_13' else '13_plus' end,
            case when child then 'pending' else 'not_needed' end,
            coalesce(new.created_at, now()), coalesce(new.created_at, now()));
  insert into public.wallets (user_id, coins) values (new.id, 0);
  insert into public.player_stats (user_id) values (new.id);
  for card in select key, value::int as n from jsonb_each_text(coalesce(private.setting('starter_collection'), '{}'::jsonb)) loop
    if card.n > 0 then perform private.card_grant(new.id, card.key, card.n, 'starter', null, null); end if;
  end loop;
  if bonus > 0 then
    perform private.ledger_apply(new.id, bonus, 'signup_bonus', null, 'signup:' || new.id, null);
  end if;
  if child then
    -- The account's email is the parent's. They get our consent email (outbox)
    -- with a link only they can open; nothing is playable online until they approve.
    tok := private.new_token();
    insert into public.parental_consents (user_id, parent_email, notice_version, request_token_hash, request_expires_at)
      values (new.id, coalesce(new.email, ''), coalesce(private.setting('consent_notice_version') #>> '{}', 'draft'),
              private.sha(tok), now() + interval '7 days');
    insert into public.consent_events (user_id, event, detail) values (new.id, 'requested', jsonb_build_object('to', new.email));
    insert into public.email_outbox (user_id, to_email, kind, payload)
      values (new.id, coalesce(new.email, ''), 'parent_consent_request',
              jsonb_build_object('token', tok, 'username', uname, 'expires_at', now() + interval '7 days'));
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Public doors (no login needed)
-- ---------------------------------------------------------------------------

-- Sign-up form check.
create function public.username_available(p_username text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare problem text := private.username_problem(p_username);
begin
  return jsonb_build_object('ok', problem is null, 'problem', problem);
end $$;

-- Which server is this? 'test' (practice/preview) or 'production'. The game and the
-- back counter compare it with their own build setting and refuse to mix them.
create function public.server_info() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('server_kind', coalesce(private.setting('server_kind') #>> '{}', 'test'))
$$;

-- Parent consent page: what is this link about? (Only the child's username, nothing else.)
create function public.parent_consent_info(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.parental_consents; uname text;
begin
  select * into c from public.parental_consents where request_token_hash = private.sha(p_token);
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  select username into uname from public.profiles where id = c.user_id;
  return jsonb_build_object('status', case when c.status = 'pending' and c.request_expires_at < now() then 'expired' else c.status end,
                            'username', uname, 'expires_at', c.request_expires_at, 'notice_version', c.notice_version);
end $$;

-- The parent approves (link from our consent email + "I am the parent and I agree").
create function public.parent_give_consent(p_token text, p_agree boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.parental_consents;
  uname text;
  rtok text := private.new_token();
begin
  if p_agree is distinct from true then raise exception 'consent not given'; end if;
  select * into c from public.parental_consents where request_token_hash = private.sha(p_token) for update;
  if not found or c.status <> 'pending' then raise exception 'this link is not valid any more'; end if;
  if c.request_expires_at < now() then raise exception 'this link has expired; your child can send a new one'; end if;
  update public.parental_consents
    set status = 'approved', approved_at = now(), approved_ip = private.request_ip(),
        request_token_hash = null, revoke_token_hash = private.sha(rtok), updated_at = now()
    where id = c.id;
  update public.profiles set consent_status = 'approved' where id = c.user_id returning username into uname;
  insert into public.consent_events (user_id, event, ip, detail)
    values (c.user_id, 'approved', private.request_ip(), jsonb_build_object('notice_version', c.notice_version));
  -- The "plus" in email plus: a confirmation to the parent with a link to withdraw.
  insert into public.email_outbox (user_id, to_email, kind, payload)
    values (c.user_id, c.parent_email, 'parent_consent_confirmed', jsonb_build_object('revoke_token', rtok, 'username', uname));
  return jsonb_build_object('ok', true, 'username', uname);
end $$;

-- The parent withdraws approval (link in the confirmation email). The account stops working online.
create function public.parent_revoke_consent(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.parental_consents; uname text;
begin
  select * into c from public.parental_consents where revoke_token_hash = private.sha(p_token) for update;
  if not found or c.status <> 'approved' then raise exception 'this link is not valid any more'; end if;
  update public.parental_consents set status = 'revoked', revoked_at = now(), revoked_by = 'parent',
    revoke_token_hash = null, updated_at = now() where id = c.id;
  update public.profiles set consent_status = 'revoked' where id = c.user_id returning username into uname;
  insert into public.consent_events (user_id, event, ip) values (c.user_id, 'revoked', private.request_ip());
  insert into public.email_outbox (user_id, to_email, kind, payload)
    values (c.user_id, c.parent_email, 'parent_consent_revoked', jsonb_build_object('username', uname));
  return jsonb_build_object('ok', true, 'username', uname);
end $$;

-- "Contact us" form (game parent pages, consent-email landing page, profile). No login needed.
-- At most 5 messages per sender (IP, or account) per hour, and 500 per hour in total.
create function public.contact_submit(p_topic text, p_message text, p_reply_email text default null,
                                      p_name text default null, p_child_username text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  sender_ip text := private.request_ip();
  uid uuid := auth.uid();
  mid bigint;
begin
  if (select count(*) from public.contact_messages m where m.created_at > now() - interval '1 hour'
        and ((sender_ip is not null and m.ip = sender_ip) or (uid is not null and m.user_id = uid))) >= 5
     or (select count(*) from public.contact_messages m where m.created_at > now() - interval '1 hour') >= 500 then
    raise exception 'too many messages, please try again later';
  end if;
  begin
    insert into public.contact_messages (topic, message, reply_email, name, child_username, user_id, ip)
      values (p_topic, btrim(coalesce(p_message, '')), nullif(lower(btrim(coalesce(p_reply_email, ''))), ''),
              nullif(btrim(coalesce(p_name, '')), ''), nullif(btrim(coalesce(p_child_username, '')), ''), uid, sender_ip)
      returning id into mid;
  exception when check_violation or not_null_violation then
    raise exception 'please check the form: a topic, a message of 5-2000 characters, a valid reply email (or none), name up to 80 characters';
  end;
  return jsonb_build_object('ok', true, 'id', mid);
end $$;

-- ---------------------------------------------------------------------------
-- Player doors
-- ---------------------------------------------------------------------------

-- Everything the game needs after login. Also updates "last seen" (at most every 5 minutes).
-- Works for banned and not-yet-approved players too, so the game can show the right message.
create function public.my_status() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  b public.bans;
begin
  if uid is null then raise exception 'not logged in' using errcode = '28000'; end if;
  update public.profiles set last_seen_at = now()
    where id = uid and last_seen_at < now() - interval '5 minutes';
  select * into p from public.profiles where id = uid;
  if not found then raise exception 'no profile'; end if;
  b := private.active_ban(uid);
  return jsonb_build_object(
    'user_id', uid,
    'username', p.username,
    'avatar', p.avatar,
    'needs_avatar', p.avatar is null,
    'age_group', p.age_group,
    'consent_status', p.consent_status,
    'decks_imported', coalesce((p.flags ->> 'decks_imported')::boolean, false),
    'coins', (select coins from public.wallets where user_id = uid),
    'banned', b.id is not null,
    'ban_expires_at', b.expires_at,
    'ban_reason', b.reason);
end $$;

-- What the player owns, as counts per card (card ids/instances stay back-end only).
create function public.my_collection() returns table (card_id text, count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not logged in' using errcode = '28000'; end if;
  return query select ci.card_id, count(*) from public.card_instances ci
    where ci.owner_id = auth.uid() and ci.status = 'owned' group by ci.card_id order by ci.card_id;
end $$;

-- An under-13 player whose parent hasn't approved yet can send the email again (once per 10 minutes).
create function public.resend_parent_consent() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  c public.parental_consents;
  tok text := private.new_token();
  uname text;
begin
  if uid is null then raise exception 'not logged in' using errcode = '28000'; end if;
  select * into c from public.parental_consents where user_id = uid for update;
  if not found or c.status not in ('pending', 'expired') then raise exception 'nothing to send'; end if;
  if c.request_sent_at > now() - interval '10 minutes' then raise exception 'please wait a few minutes before sending again'; end if;
  update public.parental_consents set status = 'pending', request_token_hash = private.sha(tok), request_sent_at = now(),
    request_expires_at = now() + interval '7 days', updated_at = now() where id = c.id;
  select username into uname from public.profiles where id = uid;
  insert into public.consent_events (user_id, event) values (uid, 'resent');
  insert into public.email_outbox (user_id, to_email, kind, payload)
    values (uid, c.parent_email, 'parent_consent_request', jsonb_build_object('token', tok, 'username', uname, 'expires_at', now() + interval '7 days'));
end $$;

create function public.set_avatar(p_card text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  if p_card is null or not (p_card = any (private.setting_text_list('avatar_cards'))) then
    raise exception 'That picture can''t be an avatar.';
  end if;
  update public.profiles set avatar = p_card where id = uid;
end $$;

-- Create (p_id null) or replace one of your decks. Returns the deck id.
create function public.save_deck(p_id uuid, p_name text, p_commander text, p_cards text[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  child boolean := (select age_group = 'under_13' from public.profiles where id = uid);
  nm text := p_name;
  problem text;
  did uuid;
begin
  if child then nm := coalesce((select name from public.decks where id = p_id and user_id = uid), private.child_deck_name(uid)); end if;
  problem := private.deck_problem(nm, p_commander, p_cards);
  if problem is not null then raise exception '%', problem; end if;
  if p_id is null then
    -- Lock the profile so two saves at once can't pass the deck limit together.
    perform 1 from public.profiles where id = uid for update;
    if (select count(*) from public.decks where user_id = uid) >= coalesce((private.setting('max_decks'))::int, 30) then
      raise exception 'You can keep at most % decks.', coalesce((private.setting('max_decks'))::int, 30);
    end if;
    insert into public.decks (user_id, name, commander, cards)
      values (uid, btrim(nm), p_commander, p_cards) returning id into did;
  else
    update public.decks set name = btrim(nm), commander = p_commander, cards = p_cards, updated_at = now()
      where id = p_id and user_id = uid returning id into did;
    if did is null then raise exception 'deck not found'; end if;
  end if;
  return did;
end $$;

create function public.delete_deck(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  delete from public.decks where id = p_id and user_id = uid;
  if not found then raise exception 'deck not found'; end if;
end $$;

-- One-time import of the decks saved in this browser (first login only).
-- p_decks = [{"name":..., "commander":..., "cards":[...]}, ...]
create function public.import_local_decks(p_decks jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  child boolean := (select age_group = 'under_13' from public.profiles where id = uid);
  maxd int := coalesce((private.setting('max_decks'))::int, 30);
  d jsonb;
  nm text; cmd text; cards text[];
  problem text;
  imported int := 0;
  skipped jsonb := '[]'::jsonb;
begin
  perform 1 from public.profiles where id = uid for update;
  if coalesce((select (flags ->> 'decks_imported')::boolean from public.profiles where id = uid), false) then
    raise exception 'decks already imported';
  end if;
  if p_decks is null or jsonb_typeof(p_decks) <> 'array' then raise exception 'expected a list of decks'; end if;
  if jsonb_array_length(p_decks) > 100 then raise exception 'too many decks'; end if;
  for d in select * from jsonb_array_elements(p_decks) loop
    begin
      nm := d ->> 'name';
      cmd := nullif(d ->> 'commander', '');
      cards := array(select jsonb_array_elements_text(d -> 'cards'));
      if child then nm := private.child_deck_name(uid); end if;
      problem := private.deck_problem(nm, cmd, cards);
    exception when others then
      problem := 'not a deck';
    end;
    if problem is null and (select count(*) from public.decks where user_id = uid) >= maxd then
      problem := 'deck limit reached';
    end if;
    if problem is null then
      insert into public.decks (user_id, name, commander, cards, source) values (uid, btrim(nm), cmd, cards, 'imported');
      imported := imported + 1;
    else
      skipped := skipped || jsonb_build_object('name', left(coalesce(d ->> 'name', ''), 40), 'problem', problem);
    end if;
  end loop;
  update public.profiles set flags = flags || '{"decks_imported": true}'::jsonb where id = uid;
  return jsonb_build_object('imported', imported, 'skipped', skipped);
end $$;

-- ---------------------------------------------------------------------------
-- Admin doors (admin role + 2-step login + reason + audit row)
-- ---------------------------------------------------------------------------

-- Tells the admin site what to show. Reveals nothing about anyone else.
create function public.am_i_admin() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'admin', auth.uid() is not null
             and exists (select 1 from public.roles where user_id = auth.uid() and role = 'admin')
             and not private.is_banned(auth.uid()),
    'aal', coalesce(auth.jwt() ->> 'aal', ''))
$$;

create function public.admin_list_players(p_search text default '', p_page int default 1, p_page_size int default 25)
returns table (id uuid, username text, email text, created_at timestamptz, last_seen_at timestamptz,
               coins integer, money_spent_cents bigint, banned boolean, ban_expires_at timestamptz,
               age_group text, consent_status text, is_admin boolean, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := lower(btrim(coalesce(p_search, '')));
  sz int := least(greatest(coalesce(p_page_size, 25), 1), 100);
  pg int := greatest(coalesce(p_page, 1), 1);
begin
  perform private.assert_admin();
  return query
    select p.id, p.username, u.email::text, p.created_at, p.last_seen_at, w.coins,
           coalesce(s.money_spent_cents, 0)::bigint,
           b.id is not null, b.expires_at, p.age_group, p.consent_status,
           exists (select 1 from public.roles r where r.user_id = p.id and r.role = 'admin'),
           count(*) over ()
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.wallets w on w.user_id = p.id
    left join public.player_stats s on s.user_id = p.id
    left join lateral (select x.id, x.expires_at from public.bans x
                       where x.user_id = p.id and x.lifted_at is null and (x.expires_at is null or x.expires_at > now())
                       order by x.created_at desc limit 1) b on true
    where q = '' or position(q in lower(p.username)) > 0 or position(q in lower(coalesce(u.email::text, ''))) > 0
    order by p.created_at desc
    limit sz offset (pg - 1) * sz;
end $$;

create function public.admin_player_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform private.assert_admin();
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'email', u.email,
    'email_confirmed_at', u.email_confirmed_at,
    'coins', (select coins from public.wallets where user_id = p.id),
    'money_spent_cents', coalesce((select money_spent_cents from public.player_stats where user_id = p.id), 0),
    'roles', coalesce((select jsonb_agg(role) from public.roles where user_id = p.id), '[]'),
    'ban', (select to_jsonb(b) from private.active_ban(p.id) b where b.id is not null),
    'bans', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from public.bans b where b.user_id = p.id), '[]'),
    'consent', (select jsonb_build_object('status', c.status, 'parent_email', c.parent_email, 'method', c.method,
                         'notice_version', c.notice_version, 'requested_at', c.request_sent_at,
                         'expires_at', c.request_expires_at, 'approved_at', c.approved_at,
                         'revoked_at', c.revoked_at, 'revoked_by', c.revoked_by)
                from public.parental_consents c where c.user_id = p.id),
    'consent_events', coalesce((select jsonb_agg(jsonb_build_object('event', e.event, 'at', e.created_at, 'ip', e.ip) order by e.id)
                                from public.consent_events e where e.user_id = p.id), '[]'),
    'decks', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'commander', d.commander,
                         'cards', cardinality(d.cards), 'source', d.source, 'updated_at', d.updated_at) order by d.updated_at desc)
                       from public.decks d where d.user_id = p.id), '[]'),
    'transactions', coalesce((select jsonb_agg(to_jsonb(t) order by t.id desc)
                              from (select * from public.transactions where user_id = p.id order by id desc limit 200) t), '[]'),
    'cards_owned', (select count(*) from public.card_instances where owner_id = p.id and status = 'owned'),
    'cards_by_origin', coalesce((select jsonb_object_agg(o.origin, o.n) from
                         (select origin, count(*) n from public.card_instances where owner_id = p.id and status = 'owned' group by origin) o), '{}'),
    'stats', (select to_jsonb(s) from public.player_stats s where s.user_id = p.id))
  into r
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = p_user;
  if r is null then raise exception 'player not found'; end if;
  return r;
end $$;

-- A player's own card instances, with ids (filter by card id; paged).
create function public.admin_player_cards(p_user uuid, p_card_id text default null, p_page int default 1, p_page_size int default 100)
returns table (instance_id uuid, card_id text, origin text, original_owner_id uuid, original_owner_name text,
               created_at timestamptz, moves bigint, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  sz int := least(greatest(coalesce(p_page_size, 100), 1), 500);
  pg int := greatest(coalesce(p_page, 1), 1);
begin
  perform private.assert_admin();
  return query
    select ci.id, ci.card_id, ci.origin, ci.original_owner_id, op.username, ci.created_at,
           (select count(*) from public.card_history h where h.card_instance_id = ci.id and h.event <> 'created'),
           count(*) over ()
    from public.card_instances ci
    left join public.profiles op on op.id = ci.original_owner_id
    where ci.owner_id = p_user and ci.status = 'owned'
      and (coalesce(p_card_id, '') = '' or ci.card_id = p_card_id)
    order by ci.card_id, ci.created_at, ci.id
    limit sz offset (pg - 1) * sz;
end $$;

-- Look up one card by its id: who has it, who first got it, how, and every account it passed through.
create function public.admin_card_lookup(p_instance uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform private.assert_admin();
  select jsonb_build_object(
    'instance_id', ci.id, 'card_id', ci.card_id, 'status', ci.status, 'origin', ci.origin, 'origin_ref', ci.origin_ref,
    'created_at', ci.created_at,
    'owner_id', ci.owner_id, 'owner_name', (select username from public.profiles where id = ci.owner_id),
    'original_owner_id', ci.original_owner_id, 'original_owner_name', (select username from public.profiles where id = ci.original_owner_id),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
        'at', h.created_at, 'event', h.event,
        'from_user', h.from_user, 'from_name', (select username from public.profiles where id = h.from_user),
        'to_user', h.to_user, 'to_name', (select username from public.profiles where id = h.to_user),
        'reason', h.reason, 'ref', h.ref, 'by', h.created_by) order by h.id)
      from public.card_history h where h.card_instance_id = ci.id), '[]'))
  into r
  from public.card_instances ci where ci.id = p_instance;
  if r is null then raise exception 'card not found'; end if;
  return r;
end $$;

create function public.admin_ban(p_user uuid, p_reason text, p_expires_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  b public.bans;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'player not found'; end if;
  if p_user = aid then raise exception 'you can''t ban yourself'; end if;
  if exists (select 1 from public.roles where user_id = p_user and role = 'admin') then
    raise exception 'admins can''t be banned here';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'end date must be in the future'; end if;
  if private.is_banned(p_user) then raise exception 'already banned'; end if;
  insert into public.bans (user_id, reason, banned_by, expires_at)
    values (p_user, btrim(p_reason), aid, p_expires_at) returning * into b;
  perform private.audit(aid, 'ban', p_user, jsonb_build_object('banned', false), to_jsonb(b), p_reason);
  return to_jsonb(b);
end $$;

create function public.admin_unban(p_user uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  b public.bans;
  after_row public.bans;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  b := private.active_ban(p_user);
  if b.id is null then raise exception 'not banned'; end if;
  update public.bans set lifted_at = now(), lifted_by = aid, lift_reason = btrim(p_reason)
    where user_id = p_user and lifted_at is null;
  select * into after_row from public.bans where id = b.id;
  perform private.audit(aid, 'unban', p_user, to_jsonb(b), to_jsonb(after_row), p_reason);
  return to_jsonb(after_row);
end $$;

-- p_idem_key: one fresh id per click in the admin site, so a double click pays once.
create function public.admin_grant_coins(p_user uuid, p_amount integer, p_reason text, p_idem_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  before_coins integer;
  t public.transactions;
  key text := 'admin:' || coalesce(p_idem_key, '');
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then raise exception 'amount must be between -100000 and 100000, not 0'; end if;
  if p_idem_key is null or length(p_idem_key) < 8 then raise exception 'idem_key required'; end if;
  if exists (select 1 from public.transactions where idem_key = key) then
    select * into t from public.transactions where idem_key = key;
    return jsonb_build_object('transaction', to_jsonb(t), 'repeat', true);
  end if;
  select coins into before_coins from public.wallets where user_id = p_user for update;
  if not found then raise exception 'player not found'; end if;
  t := private.ledger_apply(p_user, p_amount, 'admin_grant', 'admin:' || aid, key, aid);
  perform private.audit(aid, 'grant_coins', p_user,
                        jsonb_build_object('coins', before_coins),
                        jsonb_build_object('coins', t.balance_after, 'delta', p_amount, 'transaction_id', t.id),
                        p_reason);
  return jsonb_build_object('transaction', to_jsonb(t), 'repeat', false);
end $$;

-- Rename a player (e.g. a rude name). Same name rules as sign-up.
create function public.admin_rename_player(p_user uuid, p_new_name text, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  old text;
  problem text;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  select username into old from public.profiles where id = p_user for update;
  if not found then raise exception 'player not found'; end if;
  problem := private.username_problem(btrim(p_new_name), p_user);
  if problem is not null then raise exception '%', problem; end if;
  update public.profiles set username = btrim(p_new_name) where id = p_user;
  perform private.audit(aid, 'rename', p_user, jsonb_build_object('username', old), jsonb_build_object('username', btrim(p_new_name)), p_reason);
  return jsonb_build_object('username', btrim(p_new_name));
end $$;

-- Withdraw an under-13 account's approval (e.g. a parent asked by email). Audited.
create function public.admin_revoke_consent(p_user uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  c public.parental_consents;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  select * into c from public.parental_consents where user_id = p_user for update;
  if not found or c.status = 'revoked' then raise exception 'no approval to withdraw'; end if;
  update public.parental_consents set status = 'revoked', revoked_at = now(), revoked_by = 'admin:' || aid,
    request_token_hash = null, revoke_token_hash = null, updated_at = now() where id = c.id;
  update public.profiles set consent_status = 'revoked' where id = p_user;
  insert into public.consent_events (user_id, event, detail) values (p_user, 'revoked', jsonb_build_object('by', 'admin'));
  perform private.audit(aid, 'revoke_consent', p_user, jsonb_build_object('consent', c.status), jsonb_build_object('consent', 'revoked'), p_reason);
  return jsonb_build_object('consent', 'revoked');
end $$;

-- Settings the back counter may edit. server_kind is NOT here (Ken sets it once by SQL).
create function private.editable_settings() returns text[]
language sql immutable set search_path = '' as $$
  select array['signup_bonus_coins', 'max_decks', 'blocked_words', 'reserved_usernames', 'reserved_name_parts']
$$;

create function public.admin_get_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return (select jsonb_object_agg(s.key, jsonb_build_object('value', s.value, 'updated_at', s.updated_at))
          from public.settings s where s.key = any (private.editable_settings()))
         || jsonb_build_object('server_kind', jsonb_build_object('value', coalesce(private.setting('server_kind'), '"test"'), 'read_only', true));
end $$;

create function public.admin_set_setting(p_key text, p_value jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  old jsonb := private.setting(p_key);
  v jsonb := p_value;
  bad text;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if p_key is null or not (p_key = any (private.editable_settings())) then raise exception 'that setting can''t be changed here'; end if;
  if p_key in ('signup_bonus_coins', 'max_decks') then
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then raise exception 'must be a whole number'; end if;
    if p_key = 'signup_bonus_coins' and (v::int < 0 or v::int > 100000) then raise exception 'must be 0 to 100000'; end if;
    if p_key = 'max_decks' and (v::int < 1 or v::int > 100) then raise exception 'must be 1 to 100'; end if;
  else
    -- Word lists: letters only (compared after the name clean-up), 2-30 letters, no repeats, at most 2000.
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

-- Back counter Inbox: "Contact us" messages, newest first.
create function public.admin_inbox(p_status text default 'new', p_page int default 1, p_page_size int default 50)
returns table (id bigint, created_at timestamptz, topic text, message text, reply_email text, name text,
               child_username text, user_id uuid, username text, status text, handled_at timestamptz,
               handled_by_name text, handled_note text, reply_text text, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  sz int := least(greatest(coalesce(p_page_size, 50), 1), 200);
  pg int := greatest(coalesce(p_page, 1), 1);
begin
  perform private.assert_admin();
  return query
    select m.id, m.created_at, m.topic, m.message, m.reply_email, m.name, m.child_username, m.user_id, pu.username,
           m.status, m.handled_at, ph.username, m.handled_note, m.reply_text, count(*) over ()
    from public.contact_messages m
    left join public.profiles pu on pu.id = m.user_id
    left join public.profiles ph on ph.id = m.handled_by
    where coalesce(p_status, '') = '' or m.status = p_status
    order by m.id desc
    limit sz offset (pg - 1) * sz;
end $$;

-- Mark a message handled (or reopen it) with a note of what was done. Audited.
-- Optional p_reply: an answer emailed to the sender from the no-reply address (Ken's own email is never used).
create function public.admin_inbox_mark(p_id bigint, p_status text, p_note text, p_reply text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  m public.contact_messages;
begin
  if p_note is null or length(btrim(p_note)) < 3 then raise exception 'reason required'; end if;
  if p_status is null or p_status not in ('new', 'handled') then raise exception 'status must be new or handled'; end if;
  select * into m from public.contact_messages where id = p_id for update;
  if not found then raise exception 'message not found'; end if;
  if nullif(btrim(coalesce(p_reply, '')), '') is not null then
    if m.reply_email is null then raise exception 'this message has no reply address'; end if;
    if length(btrim(p_reply)) > 4000 then raise exception 'reply too long (max 4000 characters)'; end if;
    insert into public.email_outbox (user_id, to_email, kind, payload)
      values (m.user_id, m.reply_email, 'contact_reply', jsonb_build_object('message_id', m.id, 'topic', m.topic, 'reply', btrim(p_reply)));
    update public.contact_messages set reply_text = btrim(p_reply) where id = p_id;
  end if;
  update public.contact_messages
    set status = p_status,
        handled_at = case when p_status = 'handled' then now() else null end,
        handled_by = case when p_status = 'handled' then aid else null end,
        handled_note = btrim(p_note)
    where id = p_id;
  perform private.audit(aid, 'inbox_' || p_status, m.user_id,
                        jsonb_build_object('message_id', m.id, 'status', m.status, 'topic', m.topic),
                        jsonb_build_object('message_id', m.id, 'status', p_status, 'replied', nullif(btrim(coalesce(p_reply, '')), '') is not null), p_note);
  return jsonb_build_object('id', p_id, 'status', p_status);
end $$;

create function public.admin_audit_log(p_page int default 1, p_page_size int default 50, p_target uuid default null)
returns table (id bigint, created_at timestamptz, admin_id uuid, admin_name text, action text, target_user uuid,
               target_name text, before jsonb, after jsonb, reason text, ip text, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  sz int := least(greatest(coalesce(p_page_size, 50), 1), 200);
  pg int := greatest(coalesce(p_page, 1), 1);
begin
  perform private.assert_admin();
  return query
    select a.id, a.created_at, a.admin_id, pa.username, a.action, a.target_user, pt.username,
           a.before, a.after, a.reason, a.ip, count(*) over ()
    from public.admin_audit a
    left join public.profiles pa on pa.id = a.admin_id
    left join public.profiles pt on pt.id = a.target_user
    where p_target is null or a.target_user = p_target
    order by a.id desc
    limit sz offset (pg - 1) * sz;
end $$;

-- A new database is a TEST server until Ken marks the real one (one SQL line, see ken-setup-steps.md).
insert into public.settings (key, value) values ('server_kind', '"test"') on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Who may call what. Supabase lets everyone run new functions by default,
-- so take that away and open only the doors above.
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.server_info() to anon, authenticated;
grant execute on function public.parent_consent_info(text) to anon, authenticated;
grant execute on function public.parent_give_consent(text, boolean) to anon, authenticated;
grant execute on function public.parent_revoke_consent(text) to anon, authenticated;
grant execute on function public.contact_submit(text, text, text, text, text) to anon, authenticated;
grant execute on function public.my_status() to authenticated;
grant execute on function public.my_collection() to authenticated;
grant execute on function public.resend_parent_consent() to authenticated;
grant execute on function public.set_avatar(text) to authenticated;
grant execute on function public.save_deck(uuid, text, text, text[]) to authenticated;
grant execute on function public.delete_deck(uuid) to authenticated;
grant execute on function public.import_local_decks(jsonb) to authenticated;
grant execute on function public.am_i_admin() to authenticated;
grant execute on function public.admin_list_players(text, int, int) to authenticated;
grant execute on function public.admin_player_detail(uuid) to authenticated;
grant execute on function public.admin_player_cards(uuid, text, int, int) to authenticated;
grant execute on function public.admin_card_lookup(uuid) to authenticated;
grant execute on function public.admin_ban(uuid, text, timestamptz) to authenticated;
grant execute on function public.admin_unban(uuid, text) to authenticated;
grant execute on function public.admin_grant_coins(uuid, integer, text, text) to authenticated;
grant execute on function public.admin_rename_player(uuid, text, text) to authenticated;
grant execute on function public.admin_revoke_consent(uuid, text) to authenticated;
grant execute on function public.admin_get_settings() to authenticated;
grant execute on function public.admin_set_setting(text, jsonb, text) to authenticated;
grant execute on function public.admin_audit_log(int, int, uuid) to authenticated;
grant execute on function public.admin_inbox(text, int, int) to authenticated;
grant execute on function public.admin_inbox_mark(bigint, text, text, text) to authenticated;

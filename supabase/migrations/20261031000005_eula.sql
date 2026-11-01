-- End User License Agreement (Ken, Oct 31: "they're going to need to agree to that").
-- * profiles.eula_version / eula_accepted_at: the version a player last agreed to, and when.
-- * eula_acceptances: every agreement kept forever (append-only), so we can show who agreed to which text.
-- * settings eula_version: the current text's version (made from projects/oreheart-8/src/content/eula.json by
--   supabase/scripts/make-settings-sql.mjs). Anyone whose version differs is asked again (my_status.needs_eula).
-- * sign-up: the browser sends eula_version in the sign-up data; when it matches the current version it is recorded.
-- * accept_eula(version): the "Agree" button for everyone else (new text, or older accounts).

alter table public.profiles add column eula_version text, add column eula_accepted_at timestamptz;

create table public.eula_acceptances (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  version     text not null,
  ip          text,
  created_at  timestamptz not null default now()
);
create index eula_acceptances_user on public.eula_acceptances (user_id, id);
alter table public.eula_acceptances enable row level security;
revoke all on public.eula_acceptances from public, anon, authenticated;
create trigger eula_acceptances_append_only before update or delete on public.eula_acceptances
  for each row execute function private.forbid_change();
create trigger eula_acceptances_no_truncate before truncate on public.eula_acceptances
  for each statement execute function private.forbid_change();

insert into public.settings (key, value) values ('eula_version', '"2026-10-31-draft"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create function private.record_eula(p_user uuid, p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set eula_version = p_version, eula_accepted_at = now() where id = p_user;
  insert into public.eula_acceptances (user_id, version, ip) values (p_user, p_version, private.request_ip());
end $$;

create function private.handle_new_user_eula() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ->> 'eula_version' = (private.setting('eula_version') #>> '{}') then
    perform private.record_eula(new.id, new.raw_user_meta_data ->> 'eula_version');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_eula after insert on auth.users
  for each row execute function private.handle_new_user_eula();

create or replace function public.my_status() returns jsonb
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
    'eula_version', private.setting('eula_version') #>> '{}',
    'needs_eula', p.eula_version is distinct from (private.setting('eula_version') #>> '{}'),
    'age_group', p.age_group,
    'consent_status', p.consent_status,
    'decks_imported', coalesce((p.flags ->> 'decks_imported')::boolean, false),
    'coins', (select coins from public.wallets where user_id = uid),
    'banned', b.id is not null,
    'ban_expires_at', b.expires_at,
    'ban_reason', b.reason);
end $$;

create function public.accept_eula(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not logged in' using errcode = '28000'; end if;
  if p_version is distinct from (private.setting('eula_version') #>> '{}') then
    raise exception 'The agreement has changed. Please reload the game and read it again.';
  end if;
  if (select eula_version from public.profiles where id = uid) is distinct from p_version then
    perform private.record_eula(uid, p_version);
  end if;
end $$;

revoke all on function private.record_eula(uuid, text), private.handle_new_user_eula() from public, anon, authenticated;
revoke all on function public.accept_eula(text) from public, anon, authenticated;
grant execute on function public.accept_eula(text) to authenticated;
grant execute on function public.my_status() to authenticated;

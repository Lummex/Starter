-- Mature avatars and the 16+ age group (Ken, Oct 31: "kids under 16 shouldn't see racier imagery", and nobody is
-- ever told they are restricted: back-counter business only).
--
-- * age_group gains '16_plus'. The browser works the group out from the birth month and year and sends ONLY the
--   group (the birth date is never stored, as before). 13_plus now means 13 to 15 (or an older account that never
--   said); under_13 stays the parent-consent path.
-- * settings avatar_mature: {"<avatar id>": "<safe fallback id>"} for every mature avatar (from avatars.json;
--   empty until Brush marks them; changed by a migration made with supabase/scripts/make-settings-sql.mjs).
-- * set_avatar refuses a mature avatar for a restricted account (same wording as any other refused picture).
-- * avatar_as_seen_by(id): what the signed-in viewer should see for someone else's avatar (the fallback when
--   the viewer is restricted). Signed-out and offline viewers never reach the server and count as restricted.
-- * admin_set_age_group: the back counter can set an account's group (audited), e.g. for older accounts.

alter table public.profiles drop constraint if exists profiles_age_group_check;
alter table public.profiles add constraint profiles_age_group_check
  check (age_group in ('13_plus', 'under_13', '16_plus'));

insert into public.settings (key, value) values ('avatar_mature', '{}'::jsonb)
on conflict (key) do nothing;

-- the sign-up trigger keeps 13_plus / under_13; this one lifts a 16+ sign-up (runs after it: same event, later name)
create function private.handle_new_user_age() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ->> 'age_group' = '16_plus' then
    update public.profiles set age_group = '16_plus' where id = new.id and age_group = '13_plus';
  end if;
  return new;
end $$;
create trigger on_auth_user_created_age after insert on auth.users
  for each row execute function private.handle_new_user_age();

-- null when the avatar is not mature, else its safe stand-in (never itself)
create function private.mature_fallback(p_avatar text) returns text
language sql stable security definer set search_path = '' as $$
  select nullif(private.setting('avatar_mature') ->> p_avatar, p_avatar)
$$;

-- an account may see mature avatars only when its stored group is 16_plus and it is not on the parent path
create function private.can_see_mature(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select age_group = '16_plus' and consent_status = 'not_needed' from public.profiles where id = p_user), false)
$$;

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
  update public.profiles set avatar = p_card where id = uid;
end $$;

-- Someone else's avatar as the signed-in viewer should see it (opponents, profiles). A restricted viewer gets the
-- safe stand-in; a 16+ viewer gets the real pick. Not for the owner's own pick (they always see it as it is).
create function public.avatar_as_seen_by(p_avatar text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  fb text;
begin
  if uid is null then raise exception 'not logged in' using errcode = '28000'; end if;
  if p_avatar is null then return null; end if;
  fb := private.mature_fallback(p_avatar);
  if fb is null or private.can_see_mature(uid) then return p_avatar; end if;
  return fb;
end $$;

-- Back counter: set an account's age group (audited). Never for the parent-consent path (under_13 stays under_13).
create function public.admin_set_age_group(p_user uuid, p_group text, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid := private.assert_admin();
  p public.profiles;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if p_group not in ('13_plus', '16_plus') then raise exception 'age group must be 13_plus or 16_plus'; end if;
  select * into p from public.profiles where id = p_user for update;
  if not found then raise exception 'player not found'; end if;
  if p.age_group = 'under_13' then raise exception 'an under-13 account stays on the parent path'; end if;
  if p.age_group = p_group then return jsonb_build_object('age_group', p_group); end if;
  update public.profiles set age_group = p_group where id = p_user;
  -- a now-restricted account can't keep a mature avatar
  if p_group <> '16_plus' and private.mature_fallback(p.avatar) is not null then
    update public.profiles set avatar = private.mature_fallback(p.avatar) where id = p_user;
  end if;
  perform private.audit(aid, 'set_age_group', p_user, jsonb_build_object('age_group', p.age_group), jsonb_build_object('age_group', p_group), p_reason);
  return jsonb_build_object('age_group', p_group);
end $$;

-- Lock the new functions down the same way as the rest (new functions are runnable by everyone by default).
revoke all on function private.handle_new_user_age(), private.mature_fallback(text), private.can_see_mature(uuid) from public, anon, authenticated;
revoke all on function public.avatar_as_seen_by(text), public.admin_set_age_group(uuid, text, text) from public, anon, authenticated;
grant execute on function public.avatar_as_seen_by(text) to authenticated;
grant execute on function public.admin_set_age_group(uuid, text, text) to authenticated;

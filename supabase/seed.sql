-- LOCAL DEVELOPMENT ONLY (supabase db reset / supabase start load this file).
-- Never push it to the real project: the deploy workflow runs "supabase db push"
-- WITHOUT --include-seed.
-- Four demo players so the admin site has something to show. They have NO
-- password, so nobody can log in as them. No admin is made here: local admin
-- testing registers an account and runs the same one-line SQL Ken uses.

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at) values
  ('d0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'demo1@example.test', '{"username":"Mudfoot_Demo"}',    now(), now() - interval '9 days'),
  ('d0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'demo2@example.test', '{"username":"Cogsworth_Demo"}',  now(), now() - interval '4 days'),
  ('d0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'demo3@example.test', '{"username":"Anvilbeard_Demo"}', now(), now() - interval '1 day'),
  -- An under-13 player still waiting for a parent (shows the consent column in the back counter).
  ('d0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'demo4-parent@example.test', '{"username":"Pebble_Demo","age_group":"under_13"}', now(), now() - interval '2 hours')
on conflict (id) do nothing;

update public.profiles set avatar = 'goblin-scrounger' where id = 'd0000000-0000-4000-8000-000000000001';
update public.profiles set avatar = 'gnome-prospector' where id = 'd0000000-0000-4000-8000-000000000002';

insert into public.decks (user_id, name, commander, cards, source)
select 'd0000000-0000-4000-8000-000000000001', 'Swamp Rush', 'grubnak',
       array(select 'goblin-scrounger' from generate_series(1, 30)) || array(select 'fizzle' from generate_series(1, 20)), 'saved'
where not exists (select 1 from public.decks where user_id = 'd0000000-0000-4000-8000-000000000001');

insert into public.bans (user_id, reason, expires_at)
select 'd0000000-0000-4000-8000-000000000003', 'Demo ban (local seed)', now() + interval '3 days'
where not exists (select 1 from public.bans where user_id = 'd0000000-0000-4000-8000-000000000003');

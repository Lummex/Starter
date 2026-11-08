-- Nov 8 (launch, Ken): the Dashboard's What's New on the live site showed the test-server seed from 20261106000001_dashboard
-- ("Patch 0.9.5 (test server)", "Welcome to the test server", two made-up events). Safe to run more than once:
-- 1. every seeded post (made by a migration, created_by is null) that is not one of the launch posts below is switched off;
--    posts an admin wrote (created_by set) are left alone. Nothing is deleted.
-- 2. the launch posts are added once (matched by title).
-- The TEST server shows the same posts; its TEST banner comes from server_kind in the game, not from these rows.

update public.news_posts
   set active = false, updated_at = now()
 where created_by is null
   and active
   and title not in ('Patch 1.0: Open Beta', 'Welcome, Founders!');

insert into public.news_posts (kind, title, subtitle, body, sort, posted_on)
select 'patch', 'Patch 1.0: Open Beta', 'November 8', '[
  {"section": "new", "items": [
    "<b>Online play</b>: Ranked (with a ladder from Stone up), Unranked, and matches against a friend",
    "<b>Friends</b>: add players by name or code, see who is online, and challenge them",
    "<b>Emotes</b> in matches, plus <b>card sleeves</b> and <b>avatar frames</b> to show off",
    "<b>Founder rewards</b> for open beta players: the Founder frame, Founder avatars and the Founder card back",
    "<b>The new Shop</b>: single packs, bundles with free packs, and the Treasure Chest",
    "<b>Bad Luck Guarantee</b>: a Legendary within every 20 packs",
    "<b>Commanders in packs</b> as Ultra Rares",
    "<b>Card upgrades</b>: combine copies to climb from Original all the way to Mythic",
    "<b>New combat odds</b>: dice you can see, a small chance to miss or block, and never two misses in a row",
    "<b>Deck names</b>: name your decks and see them in the match",
    "<b>The bug button</b> on the Dashboard: tell us what broke, right from the game"
  ]}
]'::jsonb, 100, date '2026-11-08'
where not exists (select 1 from public.news_posts where title = 'Patch 1.0: Open Beta');

insert into public.news_posts (kind, title, subtitle, body, sort, posted_on)
select 'news', 'Welcome, Founders!', 'The mines are open', '[
  "The crystal mines are open, the goblins are already arguing over them, and you got here first. Welcome to the Oreheart Open Beta!",
  "Every Founder gets the Founder frame, the Founder avatars and the Founder card back. They are for Founders only, so wear them proudly.",
  "Something broke, wobbled or caught fire? Press the bug button at the top of the Dashboard and tell us. Our dwarves will hit it with a hammer."
]'::jsonb, 100, date '2026-11-08'
where not exists (select 1 from public.news_posts where title = 'Welcome, Founders!');

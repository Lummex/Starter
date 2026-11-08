-- Nov 7 (Ken): two data changes, safe to run on production (plain updates, re-runnable, no table changes).
--  1. "Set them at ultra rare": the three starter Commander cards move from Rare to Ultra Rare in the pack pool. With the Rare-or-better
--     slot at Ultra Rare 20 %, about 1 pack in 33 deals a Commander (it was about 1 in 5). Everyone still owns one of each from the start;
--     their upgrade steps now follow Ultra Rare (upgrade_steps "Ultra Rare": [1, 2, 3, 4]).
--  2. Every card sleeve on sale costs 300 Oreshards (admin_set_sleeve still changes any one of them later). The Founder back stays unsold.
update public.cards set rarity = 'Ultra Rare' where id in ('commander-grubnak', 'commander-sproingle', 'commander-borgo');
update public.sleeves set price_oreshards = 300 where price_oreshards is not null;

-- Ken, Nov 7: "the sign-up coins, I want them to be able to get 7 packs." A pack is 400 coins (migration 11), so a new player
-- starts with 7 x 400 = 2800 coins. Only new sign-ups get it; the admin site can still change the number (signup_bonus_coins).
update public.settings set value = '2800'::jsonb where key = 'signup_bonus_coins';

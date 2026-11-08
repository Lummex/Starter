-- Ken, Nov 7 (final numbers): online matches pay 50 coins for a win and 20 for a loss, up to 400 coins a day.
-- (Packs are 400 coins since migration 11, so a day of PvP is worth about one pack.) The admin site can still change them.
update public.settings set value = '50'::jsonb where key = 'pvp_win_coins';
update public.settings set value = '20'::jsonb where key = 'pvp_loss_coins';
update public.settings set value = '400'::jsonb where key = 'pvp_daily_coin_cap';

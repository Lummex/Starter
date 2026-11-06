-- "Most popular" on the 24-pack is OFF until real sales say so (Ken's rule, Forge Nov 6): the admin toggle shop_badges.most_popular stays null by default.
update public.settings set value = '{"best_value": 99, "most_popular": null}'::jsonb, updated_at = now() where key = 'shop_badges';

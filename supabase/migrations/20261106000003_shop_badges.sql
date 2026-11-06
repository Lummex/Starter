-- The Shop in design D (Ken approved the mockup Nov 5): the 24-pack Warband Bundle wears "Most popular", the chest "Best value" (admin setting shop_badges).
update public.settings set value = '{"best_value": 99, "most_popular": 24}'::jsonb, updated_at = now() where key = 'shop_badges';

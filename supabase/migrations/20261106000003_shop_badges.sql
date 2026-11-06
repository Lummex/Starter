-- The Shop in design D (Nov 6): the chest wears "Best value" (admin setting shop_badges). (The 24 was briefly "Most popular"; 20261106000004 turns that off until real sales say so.)
update public.settings set value = '{"best_value": 99, "most_popular": 24}'::jsonb, updated_at = now() where key = 'shop_badges';

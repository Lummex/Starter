-- Nov 7 (Ken: "most popular can stay in"): the MOST POPULAR plaque shows on the 24-pack bundle by default (replaces the Nov 6 "off until
-- real sales" rule). Production-safe: one settings update, re-runnable; the admin toggle still changes or clears it.
update public.settings set value = jsonb_set(coalesce(value, '{}'::jsonb), '{most_popular}', '24'::jsonb), updated_at = now() where key = 'shop_badges';

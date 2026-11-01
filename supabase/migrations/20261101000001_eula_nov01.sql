-- End User License Agreement, third draft (Ken, Nov 1: his chosen outline, own words). New version => everyone agrees again.
update public.settings set value = '"2026-11-01-draft"'::jsonb, updated_at = now() where key = 'eula_version';

-- End User License Agreement, 2026-11-01b: birth-date wording fixed (the sign-up screen asks for month and year but never keeps them). New version => everyone agrees again.
update public.settings set value = '"2026-11-01b-draft"'::jsonb, updated_at = now() where key = 'eula_version';

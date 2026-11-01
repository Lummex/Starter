-- End User License Agreement, second draft (Ken, Oct 31: our own text in the standard EULA structure, with the
-- protected party "Oreheart and anyone affiliated with Oreheart"). New version => everyone is asked to agree again
-- (my_status.needs_eula). Version string from projects/oreheart-8/src/content/eula.json.
update public.settings set value = '"2026-10-31b-draft"'::jsonb, updated_at = now() where key = 'eula_version';

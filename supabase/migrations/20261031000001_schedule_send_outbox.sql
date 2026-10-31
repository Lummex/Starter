-- Runs the send-outbox Edge Function every minute (pg_cron + pg_net).
-- Quietly does nothing when the extensions or settings are missing (e.g. local reset).
-- Ken sets, once:  alter database postgres set app.settings.send_outbox_url = 'https://<ref>.supabase.co/functions/v1/send-outbox';
--                  alter database postgres set app.settings.send_outbox_key = '<secret key>';
do $$
declare
  fn_url text := current_setting('app.settings.send_outbox_url', true);
  fn_key text := current_setting('app.settings.send_outbox_key', true);
begin
  if coalesce(fn_url, '') = '' or coalesce(fn_key, '') = '' then
    raise notice 'send-outbox schedule skipped: app.settings.send_outbox_url / send_outbox_key not set';
    return;
  end if;
  begin
    create extension if not exists pg_cron;
    create extension if not exists pg_net with schema extensions;
  exception when others then
    raise notice 'send-outbox schedule skipped: pg_cron/pg_net unavailable (%)', sqlerrm;
    return;
  end;
  begin
    perform cron.unschedule('send-outbox') where exists (select 1 from cron.job where jobname = 'send-outbox');
    perform cron.schedule('send-outbox', '* * * * *', $job$
      select net.http_post(
        url := current_setting('app.settings.send_outbox_url'),
        headers := jsonb_build_object('Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.send_outbox_key'),
          'apikey', current_setting('app.settings.send_outbox_key')),
        body := '{}'::jsonb);
    $job$);
  exception when others then
    raise notice 'send-outbox schedule skipped: % ', sqlerrm;
  end;
end $$;

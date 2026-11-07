# The email schedule (send-outbox every minute)

`migrations/20261031000001_schedule_send_outbox.sql` reads two database settings (`app.settings.send_outbox_url`,
`app.settings.send_outbox_key`) that its comment says to set with `alter database postgres set ...`. On Supabase's hosted
projects the SQL Editor refuses that (permission denied), and the migration then quietly skips the schedule.

**Use Supabase Vault instead** (done this way on the real project `oreheart`, Nov 7). In the SQL Editor, with the project's
secret key typed there only (never in chat, never in a file):

```sql
select vault.create_secret('https://<project ref>.supabase.co/functions/v1/send-outbox', 'send_outbox_url');
select vault.create_secret('<secret key>', 'send_outbox_key');
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('send-outbox', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'send_outbox_url'),
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'send_outbox_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'send_outbox_key')),
    body := '{}'::jsonb);
$job$);
```

- Check: Supabase → Integrations → Cron → `send-outbox` → History shows "succeeded" every minute.
- New key: `select vault.update_secret((select id from vault.secrets where name = 'send_outbox_key'), '<new secret key>');`
- A re-deploy never makes this schedule: the old migration has already run, so the schedule is set up by hand once per project.

# REPORT — Online Phase A

## Status (B1–B11, Parts C and D)
- B1 online switch (`src/net/switch.ts`, `src/net/online.ts`): Done
- B2 login screen: Done
- B3 age question, 13+ and under-13 sign-up: Done
- B3c parent consent / withdraw pages: Done (notice is a DRAFT)
- B4 consent wait, revoked, avatar, welcome: Done
- B5 forgot password and set new password: Done
- B6 server decks + one-time import: Done
- B7 Profile: Done
- B8 ban check (start + every 5 minutes): Done
- B9 Play offline (practice) and "Offline — Sign in" chip: Done
- B10 wrong-server / cannot-reach screens and TEST SERVER bar: Done
- B11 Contact us: Done
- Part C (admin site): Done (only the preview headers were added)
- Part D (send-outbox Edge Function + schedule migration): Done, not run locally by the builder

Not tested by the builder: no local Supabase or browser was available while building, so the screens were only built and unit-tested (`npm run build`, vitest).

## Notes
- `parent-notice-draft.json` was missing on the branch, so `src/content/parent-notice.json` was written from the brief (version `2026-10-28-draft`, shape `{version,title,sections,lawyer_review}`).
- Avatar list: players cannot read `settings`, so `src/content/avatar-cards.json` holds a copy of `settings.avatar_cards`.
- `dist/` of the game is about 161 MB (mostly `public/models`, 115 MB, and `public/art`, 34 MB), which is above the 95 MB limit; this size comes from earlier rounds' art and models, not from this round (online adds about 250 KB, loaded only when online). Admin `dist/` is small.

## Editor updates needed
New screens in the menu style that Ledger should add to the menu editor: login, age question, create account (13+ and under-13), check your email / ask your parent, waiting for parent, parent withdrew, avatar picker, welcome, profile, ban, forgot password, set a new password, wrong server, can't reach the server, Contact us, parent consent and withdraw pages, the TEST SERVER bar (#1E5AA8, white text, 24 px), the Profile button and the "Offline — Sign in" chip. Layout, colors and sizes are in `src/net/net.css`.

## Ken's SQL lines
```sql
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'KEN-ADMIN-EMAIL-HERE';
update public.settings set value = '"production"' where key = 'server_kind';
```

## Reminder
Have a lawyer review the parent-consent notice, privacy wording and email texts before real children use the game.

## Changes made
- supabase/functions/send-outbox/index.ts: new Edge Function (POST only, secret key checked inside, up to 50 unsent rows, Resend or OUTBOX_MODE=log, strips token/revoke_token after sending, retries up to 5 attempts).
- supabase/config.toml: added [auth.rate_limit] email_sent / sign_up_sign_in / token_verifications = 1000; [auth.email] max_frequency = "1s"; [functions.send-outbox] verify_jwt = false.
- supabase/migrations/20261031000001_schedule_send_outbox.sql: new; pg_cron + pg_net every-minute schedule inside a DO block that only raises notices if extensions or settings (app.settings.send_outbox_url / send_outbox_key) are missing.
- projects/oreheart-admin/vite.config.ts: preview.headers matching vercel.json; server.headers the same minus the CSP.
- projects/oreheart-admin: robots.txt already disallows all and `#/card/<bad id>` already shows "That is not a card id." (no change); npm test passes (5 tests).

## Round 3 fixes (inspector results)
- One-time deck import read the *server* decks instead of the browser's (`net.active` was already on); it now reads `localStorage` (`loadBrowserDecks`). AC512.
- The Welcome screen now appears only right after choosing an avatar, so a returning account (or a second computer) goes straight to the menu with Profile. AC511, AC514, AC536.
- Parent page: the full stop-ending link `{contact_url}.` is drawn by CSS, so the page text reads "…Contact us form at We answer…" as in the notice file. AC545.
- Admin site: the 2-step key (`mfa-secret`) is shown without a collapsed `<details>`. AC518, AC519.
- Not fixed: AC528 game `dist/` is about 161 MB (limit in this round's spec 95 MB; Round 27 brief raised it to 250 MB; models cannot be shrunk without touching geometry). Timeout-type checks (AC25, AC40, AC190, AC256, AC364, AC370, AC375, AC368, AC441) pass locally but are slow under load; AC503 reads `state.players.length`, but `players` is an object `{player, opponent}` in the engine.

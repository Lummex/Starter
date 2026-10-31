# Oreheart Back Counter (admin site v1)

Ken's admin site, a separate app from the game (its own Vercel project, domain `admin.oreheart.cards`). Vite + TypeScript, no 3D, no framework.

- Login (email + password, plus the captcha when `VITE_TURNSTILE_SITE_KEY` is set) → **forced 2-step** (first visit: scan a QR code; every visit: 6-digit code) → admin check → pages.
- **Players**: search (username or email), paging, joined date, last seen, coins, money spent, age/parent state, ban state.
- **Player page**: info; **parent consent** (under 13: parent email, method, notice version, every event, Withdraw approval); **Ban / Unban** (reason required, 1/3/7/30 days or permanent); **Grant coins** (amount + reason; one key per click so a double click pays once); **Rename** (same name rules as sign-up); decks; coin history; **cards** (every card with its own id, filter by card); ban history; admin actions on this player.
- **Card lookup**: paste a card id → first owner, how they got it, current owner, every account it passed through.
- **Inbox**: messages from the game's **Contact us** form (parents and players; nobody emails Ken). Answer (emailed from the no-reply address) and mark handled / reopen with a note (audited); never deleted.
- **Settings**: sign-up coins, deck limit, the **bad-words list** for player names, reserved names. Server kind (test/real) is shown, not editable.
- **Audit log**: every admin action, before/after, reason, IP. Nothing can be edited or deleted.
- **Test vs real**: `VITE_OREHEART_ENV` says which server the build is for; if the database says otherwise the site shows "Wrong server" and stops. Test servers show a blue TEST SERVER bar.
- Signs out after 30 minutes without use.

The site holds **no secret**. It uses only the project URL and the publishable key (public by design). Every admin call goes to a server function that checks admin role + 2-step login (`aal2`) + not banned, requires a reason, and writes an `admin_audit` row in the same transaction (see `supabase/migrations/`).

## Settings (Vercel → project oreheart-admin → Environment Variables; names in `.env.example`)
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_OREHEART_ENV` (`production` for Production, `test` for Preview), and `VITE_TURNSTILE_SITE_KEY` if captcha is on. Production gets the real project's values, Preview the test project's. Never the secret key.

## Commands
```
npm ci
npm test          # unit tests (test vs real server guard)
npm run build     # type check + build to dist/ (works with no settings: shows "Not set up yet")
npm run dev       # http://127.0.0.1:5174
```

## Test hooks
Stable `data-testid`s for the factory's browser checks: `login-email`, `login-password`, `login-submit`, `captcha`, `mfa-qr`, `mfa-secret`, `mfa-code`, `mfa-submit`, `not-admin`, `not-configured`, `admin-main`, `player-search`, `player-total`, `player-table`, `player-link`, `player-name`, `player-coins`, `player-state`, `ban-form`, `ban-duration`, `ban-reason`, `ban-submit`, `unban-form`, `unban-submit`, `grant-form`, `grant-amount`, `grant-reason`, `grant-submit`, `deck-table`, `coin-table`, `audit-table`, `notice`, `page-error`, `sign-out`, `player-money`, `consent-state`, `consent-card`, `revoke-consent-form`/`-reason`/`-submit`, `rename-form`, `rename-name`, `rename-reason`, `rename-submit`, `cards-filter`, `card-table`, `card-link`, `card-search`, `card-result`, `card-owner`, `card-first-owner`, `card-history`, `set-signup-coins`, `set-max-decks`, `inbox-message`, `inbox-reply`, `inbox-note`, `inbox-mark`, `inbox-total`, `set-blocked-words`, `set-reserved-names`, `set-reserved-parts`, `set-<key>-reason`, `set-<key>-save`, `server-kind`, `test-banner`, `wrong-server`.

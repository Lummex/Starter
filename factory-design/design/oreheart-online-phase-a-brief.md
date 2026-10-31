# Oreheart — Online Phase A (player login, new-player sign-up, parent consent for under-13s, server decks, admin "back counter") — owner, Oct 28 — READ THIS FIRST

**This is the current round. It is the whole job.** The game is `projects/oreheart-8` on branch `factory/issue-8`. This round also has a second app, `projects/oreheart-admin`, and a database folder, `supabase/` (repo root). The factory must already know about both (see `factory-changes.md`); if it does not, stop and say so in REPORT.md.

Owner's words (Oct 28): *"this round, I want to implement the password for the game. New user, the back counter, where I have all that control."* Later the same day: practice/test players must never mix with real players; under-13s need a parent's email and approval; player names get a bad-words filter Ken can edit; Ken can rename players; every card a player owns gets its own traceable id (for trading later); the player page shows money spent.

Full design: `factory-design/design/oreheart-online-backcounter-design.md` on main plus `design-notes-online.md` (sections 6–9: test vs real server, card tracing, under-13 consent, ranked play). This brief wins where they differ.

## Already done before this round (keep, don't rewrite)
- **`supabase/`** is written and tested (**218 database checks pass**): `migrations/` (tables, Row Level Security on every table, sign-up trigger, card instances + history, parent consent, email outbox, settings, `private.assert_admin()`, every player/parent/admin function), `seed.sql` (local demo players only), `config.toml` (local test copy), `tests/phase_a_security.test.sql` + `tests/run-supabase.sh`, `scripts/make-settings-sql.mjs`.
- **`projects/oreheart-admin/`** (the back counter) is written, builds with no keys, its unit tests pass (`npm test`), and it was clicked through in a browser against these functions.
- Your job: **the game side** (Part B), **the email sender** (Part D), wiring everything together, and making every check below pass. Fix bugs you find in the prepared files, but do not remove or loosen any security rule or check; say every change in REPORT.md.
- Database changes go in a **new** migration file (`supabase/migrations/<timestamp>_<name>.sql`). Never edit a migration that is already there.

## Rules for this round (owner)
- **Change nothing that is not listed here.** No game-rule, card, number, layout-position or test-hook changes. Rounds 27/28 are separate.
- **"Play offline (practice)" must play exactly like the game does today** (tutorial, vs computer, Card Comp, deck builder with local decks). It earns nothing.
- **`?test=1` keeps working exactly as today**: no login screen, straight to the intro/menu, local decks, every existing hook unchanged. All existing checks must keep passing. The online parts are tested with `?test=1&online=1` (Part F).
- **When `VITE_SUPABASE_URL` is not set** (e.g. a local build) the game behaves exactly as today (no login screen). Never crash because a setting is missing.
- **Test and real servers never mix** (B10). Never point a check at a real Supabase project (test or production): all checks run against the local Supabase the factory starts (`http://127.0.0.1:54321`, mail catcher on `:54324`).
- **Size:** keep the built `dist/` under **95 MB** (AC90). Online adds about 60 KB (supabase-js). No new pictures, sounds or fonts.
- **Owner art is binding.** Avatars are existing card art only (`pictureOf(card)`); no new picture, icon or emblem. Original names only.
- **Keys:** the game and the admin site only ever use `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY` and `VITE_OREHEART_ENV` (all public by design). Never put any secret key anywhere; the secret scan (AC527) fails the round if you do. Never print a key in logs, REPORT.md or screenshots. The email service key (Part D) lives only in Supabase Edge Function secrets.
- **Children (COPPA):** follow B3b exactly. Collect nothing more from an under-13 than listed there. *(Owner note: the approach must be checked by a lawyer before public launch.)*
- **No personal email anywhere:** parents and players reach us only through the Contact us form (B11); automated emails come from a no-reply address.
- **Do not touch `factory-data/oreheart-8/acceptance`** and do not run git commands.
- **Editors must match the game.** New screens (login, create account, age question, parent email, check your email, parent consent page, avatar picker, welcome, profile, ban and waiting-for-parent messages, test-server bar) go in REPORT.md under **"Editor updates needed"** (layout, colors, text, sizes) so Ledger can add them to the menu editor.
- **Priority if the budget runs out** (stop cleanly at a working state): (1) offline and `?test=1` unchanged + secret scan + B10 server guard, (2) B1–B5 login, sign-up, age question and under-13 path, (3) Part D emails + B11 Contact us, (4) B6 server decks + import, (5) B7–B9, (6) admin-site checks (Part C), (7) polish. In REPORT.md list each item as Done / Partly / Not started.

---

## Part A — the database (`supabase/`, already done)

Players can **read their own rows and write nothing directly**. Everything else goes through these doors:

| Function | Who | What |
|---|---|---|
| `username_available(p_username)` | anyone | `{ok, problem}`: 3–16 letters/numbers/_, unique ignoring case, not reserved, no word from the editable bad-words list (also with look-alikes like `sh1t`, `s_h_i_t`) |
| `server_info()` | anyone | `{server_kind: 'test' \| 'production'}` (B10) |
| `contact_submit(p_topic, p_message, p_reply_email, p_name, p_child_username)` | anyone | the **Contact us** form (B11); topics `parent_request`, `delete_account`, `question`, `problem`, `other`; message 5–2000 characters; max 5 per sender per hour |
| `parent_consent_info(p_token)` | anyone (link in the parent's email) | `{status, username, expires_at, notice_version}` only |
| `parent_give_consent(p_token, p_agree)` | anyone with the email link | approves the child's account (needs `p_agree = true`); one use; sends the confirmation email |
| `parent_revoke_consent(p_token)` | anyone with the confirmation-email link | withdraws approval; the account stops working online |
| `my_status()` | logged in | `{user_id, username, avatar, needs_avatar, age_group, consent_status, decks_imported, coins, banned, ban_expires_at, ban_reason}`; also updates "last seen" |
| `my_collection()` | logged in | `[{card_id, count}]` (card instance ids are never shown to players) |
| `resend_parent_consent()` | logged in, under 13, waiting | sends the parent email again (once per 10 minutes) |
| `set_avatar(p_card)` | logged in, allowed (*) | avatar = a card id from `settings.avatar_cards` |
| `save_deck(p_id, p_name, p_commander, p_cards)` | logged in, allowed (*) | create (`p_id` null) or replace own deck; returns the id. Max decks (setting, 30), max 100 cards, known ids. **Under-13 decks get plain names "Deck 1", "Deck 2"… whatever name is sent** |
| `delete_deck(p_id)` | logged in, allowed (*) | delete own deck |
| `import_local_decks(p_decks)` | logged in, allowed (*) | once per account: `[{name, commander, cards}]` → `{imported, skipped:[{name, problem}]}` |
| `am_i_admin()` | logged in | `{admin, aal}` (about yourself only) |
| `admin_*` (list players, player detail, player cards, card lookup, ban, unban, grant coins, rename, revoke consent, get/set settings, inbox, inbox mark/answer, audit log) | admin + 2-step (`aal2`) | refused otherwise; every change needs a reason and writes an `admin_audit` row with before/after |

(*) "allowed" = not banned, and for under-13s approved by a parent. Otherwise the error says `banned until …`, `waiting for a parent to approve this account` or `a parent withdrew approval for this account`.

- **Sign-up trigger:** a new account gets a profile (username from sign-up `data.username`; age group from `data.age_group`), a wallet, an empty stats row, **every starter-deck card as its own card instance** (359 cards, 60 kinds, each with a unique id, first owner = this player, origin `starter`, plus a history row), and the sign-up coins (`settings.signup_bonus_coins`, **300**, editable in the back counter). For `age_group: 'under_13'` it also creates the parent consent request and queues the parent email (Part D). A bad username stops the sign-up.
- **Cards** live in `card_instances` (one row per card) and `card_history` (append-only). Only server functions make or move them; trading later uses `private.card_transfer()`. Ownership is stored but not enforced in Phase A (the deck builder still shows every card, as today); enforcement comes with the grey-out in Phase B.
- **Money spent** (`player_stats.money_spent_cents`) is 0 until Phase D donations fill it.
- **Ranked tables** `seasons` and `player_ratings` exist but stay empty until Phase C (see `design-notes-online.md` §9). Don't use them now.
- If cards or starter decks change in a later round, regenerate settings into a NEW migration with `node supabase/scripts/make-settings-sql.mjs > supabase/migrations/<ts>_settings.sql` (it overwrites `signup_bonus_coins` and the word lists with the file's values; remove those lines if Ken has changed them in the back counter).

## Part B — the game

### B1. Supabase client (only when set up)
1. Add `@supabase/supabase-js` (v2). New file `src/net/online.ts` makes the client from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, `persistSession: true`. Export `onlineEnabled = Boolean(url && key) && !(test && !online)` where `test = ?test=1`, `online = ?online=1`.
2. When `onlineEnabled` is false, nothing below shows and nothing loads; the game starts exactly as today.

### B2. Login screen first
When `onlineEnabled` and no saved session: after the intro (or instead of the menu) show the **login screen**, in the same look as the main menu (menus.ts styles, dark iron and gold, brown-gold text `#D4A94F`, gold `#FFD700`, Alegreya SC). It has:
- **Sign in**: email + password (+ captcha box when `VITE_TURNSTILE_SITE_KEY` is set; Supabase requires a captcha token on sign-in, sign-up and password reset once captcha is on). Wrong password → "Wrong email or password." Unconfirmed email → "Please confirm your email first" + **Send the email again** (`auth.resend`).
- **Create account** (B3), **Forgot password?** (B5), **Play offline (practice)** (B9).
- With a saved session the login screen is skipped (straight to the menu). Landscape phone (844×390) and mouse both work; every button ≥ 44 px tall; nothing off screen.

### B3. Create account — age question first
1. First screen: **"When were you born?"** — month and year pickers (neutral: no hint which answer is "right", no pre-filled year). Under 13 (from today's date) → B3b; otherwise B3a. Remember the answer for this device (localStorage `oreheart.ageGate` = `13_plus`/`under_13` + date) so going back and changing it shows the same path for 24 hours. **Never send or store the birth date**; only the group.
2. **B3a (13+)**: username, email, password, confirm password, captcha box (when set).
3. **B3b (under 13)**: username, **"Parent or guardian's email"** (label says: "We'll ask your parent or guardian to say yes before you can play online."), password, confirm password, captcha. No child email, no other fields.
4. Username: 3–16 letters, numbers or `_`; while typing (debounced 400 ms) call `username_available` and show the problem text under the field ("That name is taken.", "That name is reserved.", "Please pick a different name.", "Use 3 to 16 letters, numbers or _."). The server checks again at sign-up.
5. Password: at least 10 characters with lower case, upper case and a number; confirm must match.
6. `auth.signUp({email, password, options: {data: {username, age_group}, captchaToken, emailRedirectTo: <this page's origin>}})` with `age_group` = `'13_plus'` or `'under_13'`. Then **"Check your email"** (13+) or **"Ask your parent or guardian to check their email"** (under 13: "We sent them two emails: one to confirm the address, one to say yes."), each with **Send again**. A "Database error saving new user" reply means the name was taken in the meantime: show "That name is taken." and go back to the form.

### B3c. Parent consent page (opened from the parent's email)
1. The parent's email links to the game with `?parent_consent=<token>`. Show a plain page (no login needed, game menus hidden): `parent_consent_info(token)` → "**<username>** would like an Oreheart account." + the **parent notice** (what we keep: the username, the parent's email, game progress; no birth date, photo, chat or free text; nothing shared with others except the username in games; how to withdraw; the Contact us form) + checkbox **"I am this child's parent or guardian and I agree"** + **Approve** (`parent_give_consent(token, true)`) → "Thank you. <username> can now play online. We sent you a confirmation email with a link to withdraw at any time."
2. Expired → "This link has expired. Ask your child to press **Send again** in the game." Invalid/used → "This link is not valid any more."
3. `?parent_withdraw=<token>` (from the confirmation email) → page with **Withdraw approval** → `parent_revoke_consent(token)` → "Done. The account can't play online any more. To delete it, use the Contact us form."
4. The notice text is the prepared first draft `parent-notice-draft.json` ("DRAFT – lawyer review before launch"): copy it unchanged to `src/content/parent-notice.json` (the `lawyer_review` list is not shown to parents). Its `version` must equal `settings.consent_notice_version` (`2026-10-28-draft`). Fill `{username}` and `{contact_url}` (this site's `?contact=1`). **No email address of Ken's or anyone's appears anywhere in the game or emails.** Keep the DRAFT marker visible on the page while `version` ends in `-draft`.
5. Every parent page (consent, withdraw, expired) has a **Contact us** button (B11) with the child's username pre-filled.

### B4. After the first allowed login
1. If `my_status().consent_status = 'pending'`: show **"Waiting for your parent or guardian"** with **Send the email again** (`resend_parent_consent`), **Sign out** and **Play offline (practice)**. Nothing else online. `revoked` → "A parent withdrew approval for this account." + Sign out + Play offline.
2. If `needs_avatar`: **Choose your avatar** — a grid of existing card art (`settings.avatar_cards`, shown with `pictureOf`, no new art). Pick → `set_avatar`.
3. Then a short **Welcome** card (one screen, Grubnak's tone, kid-friendly): "Welcome to the Skullfang Arena, <username>! Your starter decks are ready." → menu.
4. Then B6.4 (one-time import) if the browser has local decks.

### B5. Forgot password
"Forgot password?" → email (+ captcha) → `auth.resetPasswordForEmail(email, {redirectTo: <origin>})` → "If that email has an account, we sent a link." (same text whether or not it exists). When the game opens from the reset link (`PASSWORD_RECOVERY` event) show **Set a new password** (same rule) → `auth.updateUser({password})` → menu. (For an under-13 account the email goes to the parent.)

### B6. Decks saved on the server
1. When signed in and allowed, the Deck Builder (`src/ui/decks.ts`) loads the player's decks from the `decks` table and saves with `save_deck` / `delete_deck` instead of localStorage. Same screens, same buttons, same deck rules (`validateDeck` still shows problems in the builder as today). Starter decks stay read-only templates.
2. **Under-13 players**: the deck-name field is hidden; decks show the server's name ("Deck 1"…).
3. A save that the server refuses shows its message in the builder and keeps the player's edits on screen.
4. **One-time import:** on the first allowed login on a browser that has local decks (`oreheart.decks`) and `my_status().decks_imported` is false, send them all to `import_local_decks` once and say "Imported N decks" (+ any skipped deck and why). Local decks stay in the browser for offline play.
5. Matches (vs computer, Card Comp) can use server decks exactly like local ones. Offline play keeps using local decks.

### B7. Profile
A **Profile** button on the main menu (signed in only) opens: avatar (card art), username, joined date, stats from `player_stats` (all zero for now: "No online matches yet"), and **Sign out**. No coin counter yet (Phase B). No rank yet (Phase C).

### B8. Banned players
On start and every 5 minutes call `my_status()`. If `banned`: show **"Your account is banned until <date, local time>."** (or "…banned." if permanent) with the reason, Sign out and **Play offline (practice)**.

### B9. Play offline (practice)
The link opens the normal main menu with the game exactly as today. A small "Offline — Sign in" chip on the menu goes back to the login screen. If the network is down at start, show "Can't reach the server" with **Try again** and **Play offline (practice)**.

### B11. Contact us (nobody emails Ken)
1. A **Contact us** form at `?contact=1`, linked from every parent page, the parent emails' landing pages, the login screen and the Profile page. Fields: topic (Parent request, Delete an account, Question, Problem, Other), message (5–2000 characters), reply email (optional; pre-filled when logged in), name (optional), player name (optional; pre-filled on parent pages) and the captcha box when set. `contact_submit(...)` → "Thanks, we got your message. If you gave an email, we'll answer from a no-reply address."
2. Show the server's refusal text (bad email, too short, too many messages) under the form, keeping what was typed.
3. The game never shows an email address to write to.

### B10. Test server vs real server
1. Read `import.meta.env.VITE_OREHEART_ENV` (`production` on the real site; anything else = `test`). Before showing the login screen call `server_info()`. If the build says `production` and the server says `test`, or the other way round, show **"Wrong server"** with the explanation and **Play offline (practice)** only; never log anyone in. Use the same logic as `projects/oreheart-admin/src/env-guard.ts` (copy it into the game as `src/net/env-guard.ts`).
2. On a test server show a thin blue bar at the top of the menus: **"TEST SERVER — practice accounts only"** (not during a match).

## Part C — the admin site (`projects/oreheart-admin`, already done)
Keep it as it is (Vite + TS, no 3D, no game code or art). `npm ci && npm test && npm run build`. Settings: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY`, `VITE_OREHEART_ENV`. Pages: Players (search, joined, last seen, coins, **money spent**, **age/parent**, ban state), Player page (info, **parent consent card with events and Withdraw approval**, ban/unban, grant coins, **rename**, decks, coin history, **cards with unique ids**, ban history, admin actions), **Card lookup** (`#/card/<id>`: first owner, how they got it, current owner, full history), **Inbox** (Contact us messages: answer from the no-reply address, mark handled with a note), **Settings** (sign-up coins, deck limit, **bad-words list**, reserved names; server kind read-only), Audit log. Only change it to fix a failing check; list each change in REPORT.md.

## Part D — the email sender (new, small)
1. Edge Function `supabase/functions/send-outbox/index.ts` (Deno): reads unsent `email_outbox` rows (oldest first, max 50, `attempts < 5`), sends each through Resend's HTTP API, sets `sent_at` (or `attempts+1`, `last_error`). Runs every minute from `pg_cron` (new migration) and can be called right after sign-up. Uses the secret `RESEND_API_KEY`, `SITE_URL` and `EMAIL_FROM` (a **no-reply** address, e.g. `Oreheart <no-reply@oreheart.cards>`) from **Edge Function secrets only** (Ken pastes them). Every email says "This address can't receive replies — use the Contact us form: SITE_URL/?contact=1". The function uses the service connection Supabase gives Edge Functions; nothing secret in the repo.
2. Emails (plain, kid-friendly wording, from `EMAIL_FROM`): `parent_consent_request` → link `SITE_URL/?parent_consent=<token>` (+ the notice summary, expires in 7 days); `parent_consent_confirmed` → "You approved <username>" + withdraw link `SITE_URL/?parent_withdraw=<revoke_token>`; `parent_consent_revoked` → "You withdrew approval"; `contact_reply` → the admin's answer to a Contact us message (quote the topic, not the original text).
3. After a row is sent, remove the tokens from its `payload` (keep `username`, `kind`, `sent_at`).
4. With `OUTBOX_MODE=log` (local/factory) it doesn't call Resend: it logs and marks the row sent, so checks can read the token from the row before it's cleared (or from the log).

## Part E — Ken's lines
Put these in REPORT.md under **"Ken's SQL lines"** exactly:
```sql
-- 1. Make your admin account an admin (on each project you want to use the back counter on):
insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'KEN-ADMIN-EMAIL-HERE';
-- 2. ONLY on the real (production) project, once:
update public.settings set value = '"production"' where key = 'server_kind';
```

---

## Part F — Tests (the factory's checks)

How the tests run (set up by the factory, see `factory-changes.md`): `supabase start` + `supabase db reset` on the runner; the game and the admin site are built with `VITE_SUPABASE_URL=http://127.0.0.1:54321`, the **local** publishable key from `supabase status -o env` (a fixed demo key, not a secret), `VITE_OREHEART_ENV=test`, no captcha; game on `:4173`, admin site on `:4174`; emails from the local mail catcher on `:54324`; outbox in `OUTBOX_MODE=log`. Test helpers may use the local secret key only inside the test runner to create users or read rows — never in app code. Every test uses its own new users (unique emails).

### Database
- **AC500** `supabase/tests/run-supabase.sh` passes (all checks in `phase_a_security.test.sql`, currently 218) on the local Supabase.

### Offline and existing behaviour
- **AC501** With `?test=1` (no `online=1`) the game starts exactly as before: no login screen, `window.oreheart` hooks unchanged; every existing check passes.
- **AC502** A vitest unit test in `projects/oreheart-8/tests/` shows `onlineEnabled` is false when `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is empty, and when `?test=1` is set without `online=1`; the start-up then goes straight to the intro/menu as today.
- **AC503** "Play offline (practice)" opens the main menu; the tutorial and a vs-computer match start and play with local decks; no request to `/rest/v1/` is made during the match.

### Sign-up and login (`?test=1&online=1`, real mouse/keyboard)
- **AC504** The login screen appears before the main menu, with Sign in, Create account, Forgot password? and Play offline (practice); all buttons ≥ 44 px tall and fully on screen at 1920×1080, 1366×768 and 844×390.
- **AC505** 13+ path: born-in month/year 20 years ago → create account → "Check your email"; the confirmation email arrives in the mail catcher; opening its link and signing in reaches **Choose your avatar** → Welcome → menu.
- **AC506** Username checks show the right message for: `ab`, `Grubnak`, an already used name in other capitals, and a name containing a bad word; the Create button stays disabled until the name is OK and the passwords match.
- **AC507** Wrong password shows "Wrong email or password."; signing in before confirming shows the confirm message and "Send the email again".
- **AC508** Forgot password sends an email; its link opens "Set a new password"; the new password works and the old one doesn't.
- **AC509** A new account has 359 card instances (60 kinds, each its own id, origin `starter`, first owner = the player, one history row each), `my_collection()` counts match `settings.starter_collection`, the wallet holds `signup_bonus_coins` (300), and there is exactly one `signup_bonus` ledger row.
- **AC510** Reloading keeps the player signed in; Sign out returns to the login screen.
- **AC531** The age question has no pre-selected year and no hint; the network traffic of the whole sign-up never contains the birth month or year (only `age_group`); choosing a year, going back and choosing another within 24 h shows the first path again.

### Under 13 (COPPA path)
- **AC532** Under-13 path: the form has no child-email field, only "Parent or guardian's email"; sign-up stores `age_group = under_13`, `consent_status = pending`; a `parent_consent_request` outbox row goes to that email.
- **AC533** Before approval, signing in (after the address is confirmed) shows "Waiting for your parent or guardian"; `save_deck`, `set_avatar` and `import_local_decks` called directly are refused with "waiting for a parent"; Play offline still works.
- **AC534** The parent link `?parent_consent=<token>` shows the child's username and the notice; Approve is disabled until the checkbox is ticked; after Approve the child can save decks, a `parent_consent_confirmed` email with a withdraw link is sent, and the same link can't be used twice.
- **AC535** `?parent_withdraw=<token>` withdraws approval; the child is back to "A parent withdrew approval"; saving is refused.
- **AC536** An under-13 deck saved with the name "Sam Smith Ohio" is stored as "Deck 1"; the deck builder shows no name field for under-13s.
- **AC537** An expired link shows the "expired" message; **Send the email again** sends a new working link (the old one stops working); a second resend within 10 minutes is refused.
- **AC538** `parental_consents`, `consent_events` and `email_outbox` can't be read or changed by any player or anon (direct API calls refused); after sending, outbox payloads no longer contain tokens.
- **AC545** The parent consent page shows every section of `parent-notice.json` (same text as the draft file, without `lawyer_review`), the DRAFT marker, the child's username and a working Contact us link; no email address appears on the page, in the built game JS, or in any outbox email except the recipient's own.

### Server decks
- **AC511** Save a deck in the Deck Builder, then sign in as the same player in a **second, fresh browser context** ("another computer"): the same deck (name, commander, cards) is there.
- **AC512** First login on a browser with 2 local decks imports them once ("Imported 2 decks"); logging in again does not import again; the local decks are still in localStorage.
- **AC513** A deck with an unknown card id sent straight to `save_deck` is refused, and the builder shows a server refusal message without losing the player's edits.
- **AC514** A vs-computer match can be started with a server deck.

### A normal player calling the API directly (supabase-js with the player's own login, no admin)
- **AC515** Each of these is refused or changes 0 rows, and a re-read as the test runner shows nothing changed: update own `wallets.coins`; insert a `transactions` row; insert/update/delete another player's `decks` row; `save_deck`/`delete_deck` with another player's deck id; insert into `roles`; read `roles`, `admin_audit`, `settings`; update own `profiles.username` or `consent_status`; read or update `card_instances`; insert `card_history`; `rpc('admin_grant_coins' | 'admin_ban' | 'admin_list_players' | 'admin_rename_player' | 'admin_set_setting' | 'admin_card_lookup', …)`.
- **AC516** The same player can read their own `profiles`, `wallets`, `decks` rows and no one else's.
- **AC517** Logged out (publishable key only): every table select and every function except `username_available`, `server_info` and the three parent-link functions is refused.

### The back counter (admin site, `:4174`)
- **AC518** A **non-admin** who signs in and completes 2-step sees "Not an admin", and the admin functions called directly with their login are refused.
- **AC519** The **admin with password only** is sent to 2-step setup, and `rpc('admin_list_players')` with that aal1 login is refused ("2-step login required"). The test enrols by reading `[data-testid=mfa-secret]` and typing a TOTP code made from it (otplib); a wrong code shows an error.
- **AC520** After 2-step the player list shows every test player with joined date, last seen, coins, **money spent ($0.00)**, **age/parent state** and ban state; search by username part and by email works; paging works with more than 25 players.
- **AC521** Player page shows info, decks, coin history and the player's **cards with unique ids**; clicking a card id opens Card lookup with first owner, origin and history.
- **AC522** Grant coins: an empty reason is refused; 75 coins with a reason raises the player's coins by exactly 75 (also when the same request is sent twice); the audit log shows before/after and the reason.
- **AC523** Ban for 3 days with a reason: `save_deck` is refused, the game shows "Your account is banned until <date>" with the reason; the audit log shows the ban. Unban with a reason: saving works again and the audit log shows the unban.
- **AC524** Ban without a reason is refused; an admin can't ban themself or another admin.
- **AC525** Audit log page lists every admin action newest first; `admin_audit` can't be changed or deleted, even by the database owner.
- **AC526** The admin site sends `X-Frame-Options: DENY`, a CSP with `frame-ancestors 'none'`, `X-Robots-Tag: noindex`; `robots.txt` disallows all.
- **AC539** **Rename**: renaming a player to a taken, reserved or bad-word name shows the server's reason; a good name with a reason works, the game shows the new name after reload, and the audit log shows old → new.
- **AC540** **Bad-words list**: adding a word in Settings (with a reason) makes the game's sign-up refuse a name containing it at once; entries with spaces or digits are refused; the change is in the audit log with before/after.
- **AC541** **Sign-up coins** changed to 250 in Settings → the next new player gets 250; players who joined before keep theirs.
- **AC542** **Under-13 view**: the player list shows "Under 13: waiting for parent" / "approved" / "withdrawn"; the player page shows the parent email, method, notice version and every consent event; **Withdraw approval** (with a reason) blocks the account and is audited. No page shows a consent token.
- **AC543** **Card lookup** by id shows first owner, origin, current owner and every history row; a card moved by `private.card_transfer()` in the test runner shows both owners; an invalid id shows "That is not a card id."

### Test vs real server
- **AC546** Contact us → Inbox: a logged-out parent sends a "Delete an account" message with a reply email and player name; it appears in the back counter **Inbox** (New) with those details; answering it with a note queues a `contact_reply` email to that reply address and moves it to Handled; the audit log shows it. A 6th message within an hour from the same address is refused; players and anon can't read `contact_messages`.
- **AC544** With `VITE_OREHEART_ENV=production` and the local server still `test`, both the game and the admin site show "Wrong server" and never show a login form; with `test` they work and show the blue TEST SERVER bar. `admin_set_setting('server_kind', …)` is refused. `npm test` in `projects/oreheart-admin` passes.

### Keys, size, report
- **AC527** Secret scan (`factory/scripts/secret-scan.mjs`) passes on the repo **and** on both built `dist/` folders.
- **AC528** The built game `dist/` is under 95 MB (AC90 still passes); the admin site's `dist/` is under 2 MB.
- **AC529** The game's built JS calls no `admin_` function other than `am_i_admin`; the admin site's built JS contains no game code or art.
- **AC530** REPORT.md contains Ken's SQL lines (Part E), a reminder that the parent notice (B3c.4) and the contact approach need a lawyer before launch, the Editor updates needed, and Done / Partly / Not started for B1–B11, Parts C and D.

## Editor updates needed (write in REPORT.md)
Login, Contact us form, Create account (age question, 13+ form, under-13 form), Check your email, Ask your parent, Parent consent page, Withdraw page, Waiting for parent, Forgot password, Set a new password, Choose your avatar, Welcome, Profile, Ban message, Wrong server, Test-server bar, Offline chip: layout (positions, sizes), text, colors, fonts. Size of `dist/` at the end (game and admin site).

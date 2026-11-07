# Oreheart launch checklist: PvP + the new menus (prepared Nov 7 by Anvil-online)

Ken, Nov 7: "No, we'll wait and get the new menus. All together. I'd also like to launch the PvP."

**What goes live:** ONE release built from branch `pvp-nov2`: the regular game (everything on factory/issue-8 today), the D menus,
login and accounts, PvP (ranked, unranked, friend codes, practice), Friends and challenges, the Shop, packs, quests, the Collection,
upgrades and Commander tiers. It replaces what oreheart.cards serves now (deployment ED7LocbbJq538uVXM41qYmy7Dca4).
**Nothing goes live until Ken clicks.** TEST stays the test bed and never changes because of this list.

Who does what:
- **KEN** = anything with a secret, a key, a password or an account click. You paste every secret yourself, never in chat.
- **TEAM** = everything else (Anvil-online drives GitHub in its own Chrome tab, checks the result, tells Forge).

Each step says "skip if done". Several of them you may have done for Phase A already.

---

## Part 1: Before launch day (about 1 hour of Ken's clicks, once)

### 1. GitHub safety gate (KEN, 2 minutes, skip if done)
1. github.com/Lummex/Starter → **Settings** → **Environments**.
2. If **supabase-production** is missing: **New environment** → name `supabase-production` → **Configure environment**.
3. Tick **Required reviewers** → add **Lummex** → **Save protection rules**.
   Now every change to the REAL database waits for your Approve click.

### 2. GitHub secrets for the real project (KEN, 3 minutes, skip if done)
1. Supabase → project **oreheart** → **Project Settings** → **General**: copy the **Project ID** (the ref).
2. GitHub → Lummex/Starter → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - `SUPABASE_PROJECT_REF` = that ref.
   - `SUPABASE_DB_PASSWORD` = the **oreheart** database password from your password manager.
   (`SUPABASE_ACCESS_TOKEN` is already there; TEST uses it too.)

### 3. Login settings in the real project (KEN, 10 minutes, skip if done)
Supabase → project **oreheart** → **Authentication**:
1. **Sign In / Providers → Email**: on, **Confirm email** on.
2. **Passwords**: minimum **10**, require lower case, upper case and numbers.
3. **URL Configuration**: Site URL `https://oreheart.cards`. Redirect URLs: `https://oreheart.cards/**` and `https://admin.oreheart.cards/**`.
4. **Multi-Factor**: TOTP on.
5. **Attack Protection → Captcha**: Cloudflare Turnstile on → paste the Turnstile **secret** key (dash.cloudflare.com → Turnstile → your widget; its hostnames must include `oreheart.cards`).

### 4. Email (Resend) for the real project (KEN, 10 minutes, skip if done)
1. resend.com → **Domains**: `oreheart.cards` shows **Verified** (if not: add it and copy the DNS lines into Vercel → Domains → oreheart.cards → DNS).
2. resend.com → **API Keys** → **Create API key** (name it `oreheart-real`, Sending access).
3. Supabase → **oreheart** → **Authentication → Emails → SMTP**: on. Host `smtp.resend.com`, port `465`, user `resend`, password = that key, sender `no-reply@oreheart.cards`, name `Oreheart`.
4. Supabase → **oreheart** → **Edge Functions → Secrets** → add:
   - `RESEND_API_KEY` = the same key,
   - `EMAIL_FROM` = `Oreheart <no-reply@oreheart.cards>`,
   - `SITE_URL` = `https://oreheart.cards`.

### 5. Decide the real-money shop (KEN, a decision, see Part 4)
- **OFF at launch (recommended):** skip step 6. On launch day you switch it off in the back counter (step 10.4).
- **ON at launch:** do step 6 too.

### 6. Stripe LIVE (KEN, 15 minutes; only if the shop is ON)
Stripe Dashboard, **live mode** (the toggle top right says Live; NOT the sandbox):
1. **Developers → API keys → Create restricted key** → name `oreheart-live` → permissions: **Checkout Sessions: Write**, **Customers: Write**, everything else None → **Create**.
2. Supabase → **oreheart** → **Edge Functions → Secrets** → add `STRIPE_SECRET_KEY` = that `rk_live_…` key.
3. Stripe live → **Developers → Webhooks → Add destination**:
   - URL `https://<oreheart ref>.supabase.co/functions/v1/stripe-webhook`;
   - events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created` → **Add**.
4. On that endpoint → **Signing secret → Reveal** → Supabase → **oreheart** → **Edge Functions → Secrets** → add `STRIPE_WEBHOOK_SECRET` = that `whsec_…`.
5. Stripe live → **Settings → Payment methods**: leave Cards on (Apple Pay / Google Pay / Link as you like).
6. Stripe Tax is NOT switched on by the code. Decide it with your accountant before turning the shop on.

### 7. Vercel production settings (KEN, 5 minutes, skip if done)
Vercel → project **oreheart-8** → **Settings → Environment Variables**. Tick **Production** only for these, with the **oreheart** (real) values:
1. `VITE_SUPABASE_URL` = `https://<oreheart ref>.supabase.co`
2. `VITE_SUPABASE_PUBLISHABLE_KEY` = oreheart → Project Settings → **API Keys** → the **publishable** key (public by design; NEVER the secret one)
3. `VITE_OREHEART_ENV` = `production`
4. `VITE_TURNSTILE_SITE_KEY` = the Turnstile **site** key (Production and Preview)
The **Preview** column keeps the TEST values. If a value lands in the wrong column, the game shows "Wrong server" instead of mixing players.

---

## Part 2: Launch day

### 8. Put the database in place (TEAM starts it, KEN approves)
1. TEAM: GitHub → Actions → **Supabase — deploy** → Use workflow from `pvp-nov2`, branch `pvp-nov2`, target **production**, DEPLOY.
   It first runs every check on a throwaway copy, then waits.
2. KEN: open the run Forge sends you → **Review deployments** → tick `supabase-production` → **Approve and deploy**.
3. TEAM: checks the run is green (all migrations, the `match`, `send-outbox`, `stripe-checkout` and `stripe-webhook` functions).

### 9. Mark the real database as real (KEN, 2 minutes, once, ONLY in oreheart)
Supabase → **oreheart** → **SQL Editor** → run:
```sql
update public.settings set value = '"production"' where key = 'server_kind';
```
Never run this in oreheart-test.

### 10. First things in the real database (KEN, 10 minutes)
1. **Email schedule** (sends the parent emails): Supabase → **oreheart** → **SQL Editor**, with your ref and the project's **secret** key (Project Settings → API Keys → secret; type it here only):
   ```sql
   alter database postgres set app.settings.send_outbox_url = 'https://<oreheart ref>.supabase.co/functions/v1/send-outbox';
   alter database postgres set app.settings.send_outbox_key = '<secret key>';
   ```
   Then tell Forge "outbox set". TEAM re-runs the deploy once, so the minute-by-minute schedule is created.
2. **Your admin account**:
   - In the game (oreheart.cards after step 11), Create account with your ADMIN email (not your player one) and confirm it.
   - SQL Editor:
     ```sql
     insert into public.roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = 'KEN-ADMIN-EMAIL-HERE';
     ```
3. Open `https://admin.oreheart.cards`, sign in, scan the 2-step QR code on two devices.
4. **Shop OFF at launch** (if you chose that): back counter → **Settings** → `oreshards_enabled` → **false** → reason "launch: coins and packs only" → Save.
   Packs, coins, quests and PvP keep working. Turn it on later with the same switch.

### 11. Promote (KEN, 1 minute)
1. TEAM sends you the final launch preview link and its Vercel deployment.
2. Vercel → **oreheart-8** → **Deployments** → that deployment → **⋯** → **Promote to Production**.
   Vercel rebuilds it with the Production settings (the real database).
3. TEAM checks oreheart.cards in its own muted tab:
   - the new bundle is live;
   - there is no TEST bar or "Test server" anywhere;
   - sign-up, login, the Dashboard, the Shop and a PvP code all load;
   - no "Wrong server" box.
   Then Forge tells you "live and checked".

### 12. If something is wrong (KEN, 1 minute)
Vercel → **oreheart-8** → **Deployments** → `ED7LocbbJq538uVXM41qYmy7Dca4` (today's live game) → **⋯** → **Promote to Production**.
The old game comes back at once. The real database keeps its accounts.

---

## Part 3: Team steps (ready now)
- **Deploy workflow for the real project:** `.github/workflows/supabase-deploy.yml` already has the `production` target. It runs every SQL check on a throwaway copy first, shows a dry run, and waits for Ken's Approve on `supabase-production` (step 1). It deploys all four functions.
- **Production mode:**
  - the build/database guard is in place (`env-guard.ts`: a production build on the TEST database, or the other way round, refuses to run and says "Wrong server");
  - Nov 7: the Lobby's TEST bar and the Dashboard's "Test server" words now show only on the TEST database;
  - the Stripe webhook takes only LIVE events on the real database and only test events on TEST, so a test card can never buy real Oreshards.
- **Size:** 295.6 MB of 300 MB with Friends included (about 33 KB more). No trim needed.
- **Up to date with the live game:** pvp-nov2 contains every factory/issue-8 commit (merged Nov 7, up to c24b5b02). Re-checked right before the final preview.
- **Checks:** SQL suites on TEST (security, economy, quests, PvP, Oreshards, Friends); the browser checks for PvP, the shop, Oreshards, Friends and Exit; the unit tests.
- **After Promote:** the TEAM smoke test in step 11.3.

## Part 4: Recommendation: the real-money shop OFF at launch
**Recommended: OFF for the first one to two weeks; coins and packs only.**
- Launch day already changes a lot at once (accounts, PvP, the menus). Real money adds refunds, chargebacks and tax to watch on day one.
- The Oreshards path was only proven in the sandbox with test cards, not yet with a real card and a real payout.
- Stripe Tax is not set up. Selling a currency without it can leave tax unpaid.
- Turning it on later is one switch in the back counter (no new release) plus Part 1 step 6.

**ON from day one** is possible if you want it: do step 6, then make ONE small real purchase yourself (Pouch, $1.99) and refund it from the Stripe Dashboard. Check the 200 Oreshards arrive and then go away again.

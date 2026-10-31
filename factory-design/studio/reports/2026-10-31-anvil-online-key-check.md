# Anvil report — Online Phase A key check (2026-10-31)

Ken finished setup steps 1, 2, 4 and 5 and asked "can u test the keys and see if its all correct".
No secret value was printed, copied or logged. Public values (project URLs, publishable keys) were tested from inside Ken's browser only.

## Result: 3 things to fix, everything else passes

### FAIL 1 — Vercel Preview has the REAL project's publishable key
Vercel → oreheart-8 → Environment Variables → Preview `VITE_SUPABASE_PUBLISHABLE_KEY` is byte-for-byte the same key as the Production one, and that key is accepted by the real project (zzqyzlerjyjzutbzdsgk) and rejected by the test one (cmwzdcqfydsdiraynafn). Previews would get the test URL with the real key = "Invalid API key" on every login.
**Fix (Ken, 2 min):** Supabase → project **Orehart-test** → Project Settings → API Keys → copy the **publishable** key (starts `sb_publishable_`). Vercel → oreheart-8 → Settings → Environment Variables → the `VITE_SUPABASE_PUBLISHABLE_KEY` row marked **Preview** → ⋯ → Edit → replace the value → Save.

### FAIL 2 — GitHub secret SUPABASE_TEST_DB_PASSWORD is wrong
The read-only check workflow connected to the TEST database with that secret and Supabase answered "password authentication failed". The real and test password secrets are also identical (both 46 characters), so most likely the real project's password was pasted into both. The real password was NOT tested (nothing is run against the real project).
**Fix (Ken, 2 min):** find the **Orehart-test** database password in your password manager (or reset it: Supabase → Orehart-test → Project Settings → Database → Reset database password). GitHub → Lummex/Starter → Settings → Secrets and variables → Actions → `SUPABASE_TEST_DB_PASSWORD` → Update. Then re-run the check: GitHub → Actions → "Supabase — key check (test only)" → Run workflow. Green = fixed.

### FAIL 3 — GitHub push protection is OFF
Secret scanning is on, but Push protection (the switch that refuses a push containing a key) is off.
**Fix (Ken, 30 s):** GitHub → Lummex/Starter → Settings → Advanced Security → scroll to "Secret Protection" → Push protection → Enable.

### WARN — Real project password rules not set
Supabase → **OreHeart** (real) → Authentication → Sign In / Providers → Email shows Minimum password length **6** and Password requirements **not selected**. The test project is correct (10, lower+upper+digits+symbols).
**Fix (Ken, 1 min):** same page in the real project → Minimum password length **10**, Password requirements → "Lowercase, uppercase letters and digits" (or the symbols one, to match test) → Save.

## PASS
- Vercel: all 6 variables exist, type Config, right columns. Preview URL = test project, Preview env = `test`; Production URL = real project, Production key = real project's publishable key (returns 200 from its auth settings), Production env = `production`.
- Real project auth settings seen through its publishable key: email sign-in on, confirm email on, sign-ups open, no other providers.
- Test project (dashboard): email on, confirm email on, min length 10, requirements lower+upper+digits+symbols, Site URL = the factory/issue-8 preview, redirect URLs `https://oreheart-8-*-lummex.vercel.app/**` and `https://oreheart-admin-*-lummex.vercel.app/**`.
- GitHub secrets: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD, SUPABASE_TEST_PROJECT_REF, SUPABASE_TEST_DB_PASSWORD all exist. Both refs are exactly the right projects. The access token works and can see both projects.
- Environments: supabase-production (required reviewer Lummex) and supabase-test exist.
- Secret scanning: on.

## Not checked (dashboard pages did not render in time)
- Multi-Factor (TOTP) on/off in both projects; real project's Site URL and redirect URLs. Ken can eyeball these (step 2.3 and 2.4).
- Still to do per the steps (Ken said so): Resend SMTP, Turnstile captcha (+ `VITE_TURNSTILE_SITE_KEY` in Vercel), Edge Function secrets, admin Vercel project.

## What Anvil added
- `.github/workflows/supabase-key-check.yml` on main: manual, read-only, TEST project only. Checks the five secrets are set, refs match, token lists projects, test DB password opens a read-only connection. Run #1 stopped at "passwords are the same"; run #2 showed the rejected password; a third commit makes a rejected password fail the run properly. Re-run after each fix.

## Side note for Forge
Ken asked in Anvil's chat: "Do you think you can have the workers make an intro video for the game? Using the cards and the artwork. And the storyline that we kind of have." Anvil answered that it is doable (Runway + card art + the mine war story) and that Forge would plan it; it is a visual job, so Ken chooses the look.

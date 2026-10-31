# Online Phase A: login, sign-up, parent consent, server decks, email sender

Read "Online Phase A" at the top of SPEC.md, then `factory-design/design/oreheart-online-phase-a-brief.md` (it wins where they differ). `supabase/` and `projects/oreheart-admin/` are done: change them only to fix a failing check, and list each change in REPORT.md. `?test=1` without `online=1` must behave exactly as today. Never put a secret key or the word service_role in either app. Don't edit the acceptance tests and don't run git.

Priority (stop cleanly at a working state): offline/`?test=1` unchanged + secret scan + server guard → B1–B5 → Part D + Contact us → server decks → B7–B9 → admin checks → polish.

The 40 checks that failed last round belong to Rounds 27/28. Don't make them worse, and don't work on them this round.

## Rules & cards
- `src/net/online.ts` (supabase-js v2, `onlineEnabled`, session kept), `src/net/env-guard.ts` copied from the admin site, plus vitest `tests/online.test.ts` and `tests/env-guard.test.ts`. ACs: AC501, AC502, AC544.
- Start-up flow: server check → login or session → ban, then consent, then avatar, then welcome, then one-time import → menu. Call `my_status` every 5 minutes. `?test=1&online=1` = test mode plus online. ACs: AC503, AC505, AC510, AC523, AC533, AC535.
- Auth calls: signUp with `{username, age_group}` and the redirect keeping the query, resend, reset, and `PASSWORD_RECOVERY` → set a new password (also without `?test=1`). Map server errors to the SPEC texts. ACs: AC505–AC508, AC531, AC532.
- Server decks in `src/ui/decks.ts`: load from `decks`, save with `save_deck`/`delete_deck`, show the server's refusal in the builder and keep the edits. Under 13: no Rename. Import once from `oreheart.decks`. The match deck picker ("Deck choice") lists server decks. ACs: AC511–AC514, AC536.

## Interface
- New screens in the menu style, using the exact SPEC texts and labels: login, age question (empty Month/Year selects, saved in `oreheart.ageGate`), 13+ and under-13 forms with a live username check, Check your email / Ask your parent, Forgot password / Set a new password, Waiting / Withdrawn, Choose your avatar (the "Avatars" group, card art only), Welcome, Profile button and screen, ban screen, Wrong server / Can't reach the server, the "Offline — Sign in" chip, and the blue TEST SERVER bar. Buttons are at least 44 px tall and fit at 844×390. ACs: AC503–AC510, AC523, AC531–AC537, AC539, AC544.
- Parent pages `?parent_consent=` and `?parent_withdraw=`: the notice from `src/content/parent-notice.json` with the DRAFT marker, the checkbox, Approve, and the expired and invalid texts. Contact us pre-fills the child's name. ACs: AC534, AC535, AC537, AC545.
- Contact us page `?contact=1`: Topic, Message, the three optional fields and Send. Show refusals in a role `alert` and keep what was typed. No email address anywhere in the game, including placeholders. ACs: AC545, AC546.

## Other
- `supabase/functions/send-outbox/index.ts` (Part D): `OUTBOX_MODE=log`, remove tokens after sending, return 200 `{sent, failed}` to a POST with the secret key. Add `[functions.send-outbox] verify_jwt = false` and a NEW pg_cron migration that is skipped quietly when not available locally. ACs: AC538, AC546.
- `supabase/config.toml` (local copy): raise `[auth.rate_limit]` email_sent, sign_up_sign_in and token_verifications to 1000, and set `[auth.email] max_frequency = "1s"`, because the parallel email checks would otherwise hit limits. ACs: AC505, AC507, AC508.
- Admin site: send the security headers from the local preview too (`preview.headers` in `vite.config.ts`, matching `vercel.json`). Check that `#/card/<bad id>` shows "That is not a card id." ACs: AC526, AC543.
- If `parent-notice-draft.json` is missing on the branch, create `src/content/parent-notice.json` (version `2026-10-28-draft`, `{title, sections:[{heading,text}], lawyer_review}`) and say so in REPORT.md. AC: AC545.
- Run the secret scan on the repo and both `dist/` folders. Keep the game `dist/` under 95 MB and the admin `dist/` under 2 MB. ACs: AC527–AC529.
- REPORT.md: Ken's SQL lines (exact), the lawyer reminder, Editor updates needed, `dist/` sizes, Done/Partly/Not started for B1–B11 and Parts C and D, and every change made to `supabase/` or the admin site. AC: AC530.

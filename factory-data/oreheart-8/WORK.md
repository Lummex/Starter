# Online Phase A — Oct 31 round: fix the remaining checks, not the game

Owner: "Fix the checks, not the game." The checks AC503, AC518, AC528 and AC530 were rewritten this round. Do not change any game rule, number or layout. Leave the 13 older look-and-feel failures alone (don't make them worse, don't work on them). `?test=1` without `online=1` must behave exactly as today. Never put a secret key or the word service_role in either app. Don't edit the acceptance tests and don't run git.

## Other
- Write `projects/oreheart-8/REPORT.md` (the game's own report; the check no longer reads the factory report). It must contain the heading text "Ken's SQL lines" and both exact SQL lines from SPEC (roles insert with `KEN-ADMIN-EMAIL-HERE`, and the `server_kind` = `"production"` update), the lawyer reminder, "Editor updates needed", `dist/` sizes, and Done/Partly/Not started for B1, B6, B11 (all of B1–B11), "Part C" and "Part D", plus every change made to `supabase/` or the admin site. AC530.
- Game `dist/` size limit is now 250 MB (it is about 161 MB — no shrinking needed); admin `dist/` stays under 2 MB with no game art; the game calls no `admin_` function except `am_i_admin`. Just confirm, no change expected. AC528, AC529.
- AC518: the check now prints the error if a non-admin's second TOTP enrolment (via supabase-js, after the admin site already set up 2-step) fails. Run it; if enrol is refused, find why (e.g. `[auth.mfa]` settings / `max_enrolled_factors` in `supabase/config.toml`, or the admin site leaving the user in a state that blocks a new factor) and fix it in config or the admin site, listing the change in REPORT.md. AC518.

## Rules & cards
- AC503: after "Play offline (practice)" the check now goes to `/?test=1&seed=5`, calls `newMatch()` and presses Done once. Make sure an offline/test-mode match never calls `/rest/v1/` (no `my_status` poll, deck load, or profile call when not signed in / not `online=1`). Likely `src/net/online.ts`, start-up flow. AC503.

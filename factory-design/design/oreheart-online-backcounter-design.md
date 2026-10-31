# Oreheart Online + Back Counter: design

Author: Anvil (Game Builder), Oct 28 2026, job from Forge for Ken. **Design only.** No factory round, no labels, nothing live. Nothing here is built yet.

Ken's choices (fixed): **Supabase** (auth + Postgres + Realtime + Edge Functions), **Stripe** for donations, a **separate admin site** (admin.oreheart.cards) with 2-step login, admin accounts only.

What the current game is (checked on factory/issue-8 today, projects/oreheart-8):

- The rules engine `src/engine/engine.ts` (81 KB) is **pure**: `createMatch(opts)`, `legalActions(state)`, `applyAction(state, action) → {ok, state, events, error}`. State is plain JSON and the dice are a seeded RNG stored in the state (`src/engine/rng.ts`, mulberry32). It only imports `./content` (the JSON card data), `./rng` and `tutorial.json`. No DOM, no browser storage. **This is the big win: the same engine can run on the server unchanged.**
- Sides are `'player' | 'opponent'`; `state.priority` says who may act (including the Respond window).
- `src/game.ts` (class `Game`) runs the match locally with the computer opponent (AI timers, modes, autoplay).
- Decks live in the browser: `src/ui/decks.ts` uses localStorage (`loadDecks`/`storeDecks`, key list of saved decks, hidden starters). Deck rules are in `src/engine/decks.ts` (`validateDeck`, `deckProblems`).
- **Rarity already exists** on every one of the 66 cards in `cards.json`: Common (25), Uncommon (13), Rare (15), Ultra Rare (8), Collector (5). Copy limits per rarity come from `CONFIG.copyLimits` (game-config.json); crystals default to 99.

---

## 1. Architecture

```
 Players' browsers                         Ken / admins
 ┌──────────────────────────┐              ┌──────────────────────────────┐
 │ Game client (Vercel)     │              │ Admin site (Vercel, separate │
 │ oreheart.cards           │              │ project) admin.oreheart.cards│
 │ supabase-js + publishable│              │ supabase-js + publishable key│
 │ key only                 │              │ only, login + TOTP required  │
 └──────────┬───────────────┘              └──────────────┬───────────────┘
            │ HTTPS (JWT)                                 │ HTTPS (JWT with aal2)
            ▼                                             ▼
 ┌─────────────────────────────────── Supabase project "oreheart" ──────────────────┐
 │ Auth (email+password, reset, email confirm, captcha, TOTP for admins)           │
 │ Postgres: tables below, Row Level Security ON for every table                   │
 │   - players may READ their own rows; they can WRITE almost nothing directly     │
 │   - all money/cards/match changes go through server functions                   │
 │ Edge Functions (Deno, hold the secret key): match-*, queue-*, deck-save,        │
 │   open-pack (or SQL RPC), admin-*, stripe-webhook, donate-checkout              │
 │ Realtime: players get their OWN match view rows (RLS-filtered)                  │
 │ pg_cron: turn timers, queue cleanup, daily jobs                                 │
 └──────────────────────────────────────────────▲──────────────────────────────────┘
                                                │ signed webhook
                                         ┌──────┴──────┐
                                         │   Stripe    │ (Checkout page hosted by Stripe)
                                         └─────────────┘
```

Key rules:

1. **Two keys only in the browsers: the project URL and the publishable (anon) key.** Both are public by design. The secret/service-role key and Stripe keys live **only** in Supabase Edge Function secrets. Nothing secret goes into Vercel `VITE_*` variables (those end up in the client code).
2. **The server is the only one that changes coins, cards, packs, decks' legality, matches and stats.** The client asks; the server checks and does.
3. **The admin site is a separate Vercel project** (its own build, its own domain, not linked from the game). Being separate does not by itself make it safe; the real lock is on the server: every admin action checks (a) the caller has the `admin` role in `roles`, (b) the login used 2-step (`aal2` in the JWT), (c) the account isn't banned, and writes an `admin_audit` row in the same transaction. A hacker who copies the admin site's code gets nothing, because the code holds no secret.
4. Offline/vs-computer play stays possible (tutorial, practice) but **earns nothing** (the server can't verify it).

### 1.1 Data model (Postgres, schema `public`; all ids uuid unless noted)

| Table | Main columns | Notes |
|---|---|---|
| `profiles` | `id` (= auth.users.id), `username` (unique, 3–16 chars, citext), `created_at`, `last_seen_at`, `avatar` (card id), `flags` jsonb (e.g. `early_adopter`) | Made by a trigger when a user signs up. Username checked against a bad-words list + reserved names (admin, oreheart, …). |
| `roles` | `user_id`, `role` ('admin' \| 'moderator'), `granted_by`, `granted_at` | **Nobody can insert here from any client.** Ken adds the first admin with one SQL line in the Supabase dashboard. |
| `bans` | `id`, `user_id`, `reason`, `banned_by`, `created_at`, `expires_at` (null = permanent), `lifted_at`, `lifted_by` | Active ban = row with `lifted_at is null and (expires_at is null or expires_at > now())`. History kept, never deleted. |
| `wallets` | `user_id` (pk), `coins` int **check (coins >= 0)**, `updated_at` | One row per player. Only changed by `ledger_apply()`. |
| `transactions` | `id` bigserial, `user_id`, `delta` int, `reason` ('match_reward','pack_purchase','admin_grant','donation_reward','signup_bonus','refund_reversal',…), `ref` (match/pack/donation/admin action id), `idem_key` **unique**, `balance_after`, `created_at`, `created_by` | **Append-only ledger.** No update/delete for anyone (revoked even from the admin role; corrections are new rows). `idem_key` stops double-grants when a request is repeated. |
| `cards` | `id` text (= cards.json id), `name`, `type`, `faction`, `rarity` ('Common','Uncommon','Rare','Ultra Rare','Collector'), `in_packs` bool, `disabled` bool, `content_version` | **Copy of cards.json**, filled by a sync script when the game deploys. Source of truth for rarity stays the Studio Card Editor → cards.json (owner rule: every editor matches). The back counter shows rarity read-only. |
| `rarities` | `name` pk, `sort`, `color` | The 5 tiers above. |
| `collections` | `user_id`, `card_id`, `count` int check (>= 0), pk (user_id, card_id) | What each player owns. Changed only by server functions. |
| `item_grants` | `id`, `user_id`, `kind` ('card','cosmetic','title','card_back'), `item_id`, `source` ('donation','admin','event'), `ref`, `created_at` | Early-adopter items, admin gifts. Cards also land in `collections`. |
| `decks` | `id`, `user_id`, `name`, `commander`, `cards` text[] , `valid` bool, `problems` jsonb, `updated_at` | Saved via `deck-save` (server re-runs `validateDeck` + ownership). Max 30 decks per player. |
| `pack_types` | `id` text, `name`, `price_coins`, `active`, `faction` (null = all), `card_pool` ('all_in_packs' or list), `max_per_day`, `updated_by`, `updated_at` | Editable in back counter. |
| `pack_slots` | `pack_type`, `slot_no`, `count` (cards in this slot), `odds` jsonb e.g. `{"Common":0,"Uncommon":0,"Rare":85,"Ultra Rare":13,"Collector":2}` | **Check: odds add up to exactly 100** (stored as basis points to avoid rounding: 10000). Pack size = sum of `count`. |
| `pack_openings` | `id`, `user_id`, `pack_type`, `price_paid`, `odds_snapshot` jsonb, `cards` text[], `created_at` | Every opening kept with the odds used at that moment (proof + support). |
| `matches` | `id`, `mode` ('casual','ranked','friend'), `player_a`, `player_b`, `deck_a`, `deck_b` (frozen copies), `state` jsonb (**full secret state**, never readable by players), `seq` int, `status` ('active','finished','abandoned'), `turn_deadline`, `winner`, `result` ('a','b','tie','abandoned'), `end_reason`, `started_at`, `ended_at`, `engine_version` | Only the service role reads/writes `state`. |
| `match_views` | `match_id`, `side` ('player'/'opponent'), `user_id`, `seq`, `view` jsonb, `events` jsonb, `deadline` | **What each player is allowed to see** (own hand, public board, opponent hand as a count). RLS: you read only your own row. Realtime pushes changes. |
| `match_moves` | `match_id`, `seq`, `side`, `action` jsonb, `ok`, `error`, `created_at`, `ms_taken` | Every action, accepted or rejected → replays, cheat checks, bug hunting. |
| `match_queue` | `user_id` pk, `mode`, `deck_id`, `rating`, `joined_at`, `heartbeat_at` | Matchmaking queue. |
| `player_stats` | `user_id` pk, `games`, `wins`, `losses`, `ties`, `abandons`, `win_streak`, `best_streak`, `turns_total`, `cards_played`, `creatures_defeated`, `ore_mined`, `sites_captured`, `packs_opened`, `coins_earned`, `coins_spent`, `rating`, `last_match_at`, `by_faction` jsonb, `by_commander` jsonb | Updated only by the match-finish function. |
| `donations` | `id`, `user_id`, `stripe_session_id` **unique**, `stripe_payment_intent`, `amount_cents`, `currency`, `status` ('paid','refunded','disputed'), `reward_tier`, `rewarded_at`, `created_at` | Webhook writes here; unique session id = a payment is rewarded once. |
| `reward_tiers` | `id`, `min_amount_cents`, `items` jsonb (cards, cosmetics, coins), `active` | Editable in back counter (e.g. any donation → "Early Adopter" card back + title + 1 promo card). |
| `admin_audit` | `id` bigserial, `admin_id`, `action`, `target_user`, `before` jsonb, `after` jsonb, `reason` text (required), `ip`, `user_agent`, `created_at` | **Append-only for everyone, including admins.** Written inside the same transaction as the change. |
| `settings` | `key`, `value` jsonb | Match rewards, daily caps, timers, signup bonus, queue rules. Editable in back counter (audited). |

### 1.2 Row Level Security (RLS) rules

RLS is switched **on for every table**. Default = deny. Then only these are allowed for normal logged-in players (`auth.uid()`):

| Table | Player may SELECT | Player may INSERT/UPDATE/DELETE |
|---|---|---|
| profiles | own row; everyone's `username`/`avatar` via a public view `public_profiles` | update own `avatar` only (column grant); username change via function (rate-limited) |
| wallets, transactions, collections, item_grants, pack_openings, donations | own rows only | **nothing** |
| cards, rarities, pack_types, pack_slots, reward_tiers | all rows (public info; pack odds must be visible to players) | nothing |
| decks | own rows | nothing directly (use `deck-save`/`deck-delete`) |
| match_views | own row (`user_id = auth.uid()`) | nothing |
| matches | own matches, but **only safe columns** through view `my_matches` (no `state`) | nothing |
| match_moves | own finished matches (replays) | nothing |
| match_queue | own row | nothing (use `queue-join`/`queue-leave`) |
| player_stats | own row; leaderboard view shows public columns | nothing |
| bans | own active ban (so the game can say "you're banned until …") | nothing |
| roles, admin_audit, settings, matches.state | **nothing** | nothing |

Admin reads go through `SECURITY DEFINER` SQL functions (`admin_list_players(search, page)`, `admin_player_detail(id)`, …) that start with `perform assert_admin();`:

```sql
create function assert_admin() returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'not admin';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception '2-step login required';
  end if;
end $$;
```

Banned players: a check `not is_banned(auth.uid())` is part of every player function (queue, deck save, pack open, match action). Bans also end their active session: the ban function signs them out of all sessions (Supabase admin API from the Edge Function) and forfeits any running match.

### 1.3 Server-side only (never trusted from the client)

| Action | Where | What it checks |
|---|---|---|
| Sign up profile + wallet + starter collection | DB trigger on auth.users | username rules; gives starter cards (enough for the starter decks) + signup coins |
| Save/delete deck | Edge `deck-save` | `validateDeck` (same engine file) + **owned copies** + not banned |
| Open pack | SQL function `open_pack(pack_type, idem_key)` (one transaction) | enough coins, pack active, daily limit; random draws with `gen_random_bytes` (crypto RNG, not the game RNG); writes ledger, collection, pack_openings |
| Join/leave queue, pair players | Edge `queue-join`/`queue-leave` + SQL `try_pair()` | deck valid + owned, not banned, not already in a match |
| Every match action | Edge `match-action` | it's your turn (`state.priority` = your side), `seq` matches, `applyAction` says ok |
| Timeouts, abandon, finish, rewards, stats | Edge `match-tick` (pg_cron) + `finish_match()` SQL | deadlines; rewards follow `settings` with daily caps |
| Coins/cards grants, ban/unban, pack odds edits, settings | Edge `admin-*` or SQL admin functions | `assert_admin()` (role + aal2) + reason text + audit row |
| Donation rewards | Edge `stripe-webhook` | Stripe signature, unique session id, paid status |

---

## 2. Player vs player (PvP) plan

### 2.1 Server-authoritative turns

- The engine is bundled into the Edge Function (one esbuild step makes `engine.bundle.js` from `src/engine/*` + the content JSON; the function imports it). Same code as the game → identical rules. The bundle records `engine_version` (git sha); a match always finishes on the version it started with (old bundle kept until no match uses it).
- **Start:** `try_pair()` makes a `matches` row; `match-start` builds the state with `createMatch({...})` using both frozen decks/commanders and a **server-made random seed** (crypto random). Player A = engine side `'player'`, B = `'opponent'`.
- **A move:** client sends `{match_id, seq, action}` to `match-action`. The function: checks login and ban → locks the match row (`select … for update`) → checks `seq` and `state.priority === mySide` → `applyAction(state, action)` → if ok: saves state, `seq+1`, writes `match_moves`, writes **both** `match_views` (redacted for each side) with the events. If not ok: logs the rejected move, returns the error, nothing changes.
- **Redaction (`viewFor(state, side)`)** — new small engine file: removes the opponent's hand (shows only card count and card backs), both decks' order (shows counts), **the RNG value `state.rng`** (whoever knows it can predict draws), and any hidden choices. Events are redacted the same way (opponent's draw = "drew a card", not which).
- Because the server holds the RNG and decks, nobody can stack their deck, see the other hand, play a card they don't own, or move twice.
- The client still uses `legalActions`/`moveDests` on its own view for highlights, so the board feels instant; the server's answer is the truth. If they disagree, the client takes the server's view (snaps back).

### 2.2 Reconnect

- On login, the game asks `my_matches` for an `active` match → if there is one, it opens it and loads its own `match_views` row (latest `seq`) → subscribes to Realtime on that row. Nothing is lost when a tab closes or Wi-Fi drops.
- If the client sees a `seq` gap, it simply reloads the whole view (views are full snapshots, not diffs).
- Heartbeat every 15 s (`match_presence`). Opponent sees "Opponent reconnecting… 0:45".

### 2.3 Timeouts

- Defaults (in `settings`, editable): turn clock **90 s** + **a 3-minute reserve** per player per match; Respond window **15 s**, then auto-pass; mulligan **30 s**.
- `turn_deadline` is stored on the match; pg_cron runs `match-tick` every **5 seconds** → for each overdue match it applies the engine's normal "pass"/"end phase" action for the slow side (so the game moves on legally).
- Disconnected for **2 minutes**, or **3 timed-out turns in a row** → that player forfeits (`end_reason = 'abandon'`); counts as a loss + `abandons+1`; no reward for the winner if the match had fewer than 3 turns (stops farming).
- Both players disconnected for 10 min → match `abandoned`, no result for either.

### 2.4 Matchmaking

- **Phase C1 = Casual only**, simplest fair queue: join with a valid deck → `try_pair()` (under a Postgres advisory lock so two servers can't pair the same person) takes the oldest waiting player who isn't you and isn't your last opponent (when possible). If none, you wait; the queue screen shows time waiting and a Cancel button.
- **Play a friend:** "Create code" → 6-letter code → friend enters it. Very cheap to add and great for testing with Ken.
- **Later (ranked):** rating (Elo, start 1000) in `player_stats`; pairing within ±100, widening by 50 every 10 s. Only after there are enough players.
- Queue rows without a heartbeat for 30 s are removed by pg_cron.

### 2.5 Match rewards and anti-farming

- Win 25 coins, tie 15, loss 10 (example, in `settings`); daily coin cap from matches (e.g. 300); no rewards for matches under 3 turns or vs the same opponent more than 3 times a day.
- Every reward is a ledger row with `idem_key = 'match:<id>:<side>'` → paid at most once.

### 2.6 What must change in the current client-only game

| Area | Today | Change |
|---|---|---|
| Start-up | Straight to the main menu | **Login screen** first: Sign in / Create account (username, email, password) / Forgot password; "Play offline (practice)" link keeps tutorial + vs computer. |
| Decks | `src/ui/decks.ts` localStorage | Load/save through Supabase (`decks`), one-time import of the player's local decks on first login (checked against what they own). Starter decks stay as read-only templates. |
| Deck builder | Shows every card, limit by rarity | Shows **"owned ×N"** per card; unowned cards greyed (~45% opacity + lock icon) and can't be added; limit = min(owned, copy limit). Filter "Owned only". |
| Collection / packs | none | New screens: Collection, Shop (packs with price + **visible odds**), Pack opening (cards flip one by one, rarity glow), coin counter on the top bar. |
| Match driver | `Game` class runs both sides + AI locally | New `NetGame` with the **same listener interface** as `Game` (so `app.ts` barely changes): sends actions to `match-action`, receives views/events via Realtime, shows timers. `Game` stays for offline/tutorial. |
| Engine | full state everywhere | Add `viewFor(state, side)`; make UI helpers accept a view where the opponent's hand/deck are hidden (placeholder cards). Fix anything that reads opponent hand contents. |
| AI | runs in the client | Not used in PvP. (Later: "vs computer" for rewards could run server-side; not in this plan.) |
| Profile | none | Profile page: username, stats, early-adopter badge, Donate button, sign out. |
| Ban | none | Banned players see a message with the end date; can't queue or open packs. |
| Size | ~95 MB budget | Adds supabase-js (~50 KB gzipped) + a few screens; under 0.5 MB. Pack-opening effects must reuse existing art; no new big textures. |

---

## 3. Phased factory rounds

Each phase is one build. Server parts (SQL migrations, Edge Functions) live in `supabase/` in the repo and are deployed by a new workflow **"Supabase — deploy"** (needs Ken's OK and his GitHub secrets). The admin site is a **new app**, `projects/oreheart-admin` (Vite + TS, no 3D), its own Vercel project. Factory acceptance tests run against a **local Supabase** (Supabase CLI in GitHub Actions, Docker), never against the real project.

### Phase A — Accounts, server decks, admin site v1
1. Migrations: profiles, roles, bans, wallets, transactions, decks, admin_audit, settings, player_stats (empty), RLS for all; signup trigger; `assert_admin()`.
2. Game: login / register / reset password screens; offline practice link; decks saved on the server + one-time import of local decks.
3. Admin site: login → **forced TOTP enrolment/challenge** → player list (search, paging, joined date, last seen, coins, ban state) → player page (info, decks, ledger) → **Ban/Unban** (reason required) → **Grant coins** (amount, reason) → **Audit log** page.

**Done when:** a new player can register, confirm email, log in on another computer and see the same decks; a player with devtools cannot change coins, decks of others, or roles (tested with direct API calls using a player JWT → all refused); the admin site refuses any login without TOTP and any non-admin (tested); ban stops queue/deck save and shows the message; every grant/ban appears in the audit log with before/after; game size still < 95 MB.

### Phase B — Coins, rarity, packs, collection, grey-out
1. Migrations: cards (+ sync from cards.json), rarities, collections, item_grants, pack_types, pack_slots, pack_openings; `open_pack()`; starter collection for new and existing players.
2. Game: coin counter, Shop with odds, pack opening screen, Collection screen, deck builder owned counts + grey-out + limit.
3. Admin: edit pack types (price, active, size via slots) and slot odds (must total 100 %; preview "expected cards per 100 packs"); grant cards; player collection view.

**Done when:** 1,000 test openings match the configured odds within normal random spread; coins can't go below zero even with 10 parallel open requests (tested); same `idem_key` twice = one pack; deck builder can't add an unowned or over-owned copy and the server refuses a forged deck; admin odds edits are audited; size < 95 MB.

### Phase C — Matchmaking, PvP, stats (largest; split if the factory needs it)
- **C1:** engine bundle in Edge Functions, `viewFor`, matches/match_views/match_moves, `match-start`/`match-action`, friend code. **C2:** casual queue + `try_pair`, NetGame client, timers, reconnect, pg_cron `match-tick`. **C3:** finish/forfeit, rewards, `player_stats`, profile stats page, admin stats per player + match list + replay viewer (moves list).

**Done when:** two browsers (two accounts) can find each other in the queue and play a full match to the end; an illegal or out-of-turn action sent by hand is rejected and logged; the opponent's hand and the RNG never appear in the network traffic (checked in devtools); closing a tab and reopening returns to the same match; a player who stays away loses by timeout; stats and rewards update exactly once.

### Phase D — Stripe donations + early-adopter rewards
- Edge `donate-checkout` (makes a Stripe Checkout session with `client_reference_id = user id`, fixed amounts $3/$5/$10/$25 + custom) → Stripe hosted page → back to the game. Edge `stripe-webhook`: verify signature → on `checkout.session.completed` with `payment_status = paid`: insert `donations` (unique session id) → grant the reward tier (items + cards + `early_adopter` flag) via ledger/item_grants. On refund/dispute: mark donation, (Ken decides) remove or keep items.
- Admin: donations list, totals per month, reward tiers editor.

**Done when:** in Stripe **test mode**, a test donation gives the items once (sending the same webhook 3× still = once); a fake webhook without a valid signature is refused; refund updates the record; the game never sees any Stripe secret.

### How it fits with Rounds 27 and 28

- **Round 27** (looks, heights, models) and **Round 28** (move orders) change `creature3d.ts`, `scene.ts`, models, `app.ts` visuals. Online work changes start-up, menus, `decks.ts`, a new net layer, and a new app. Little overlap, but both touch `app.ts`, so **don't build them at the same time on factory/issue-8.**
- The admin site (new folder) and the Supabase migrations don't touch the game branch at all, so they can be prepared while 27/28 run.

**Suggested order:**
0. Ken does section 4 (Supabase Free project, Stripe in test mode, domain) — no cost yet.
1. **Round 27** → **Round 28** (already planned; they are about how the game looks/plays).
2. **Phase A** (accounts + admin site) — also needs the factory to know a second app (`projects/oreheart-admin`) and the Supabase deploy workflow; Wright/Anvil prepare that before the round, with Ken's OK.
3. **Phase B** (economy + packs).
4. **Phase C1 → C2 → C3** (PvP). Biggest risk; do it with friend matches first, open the public queue after testing.
5. **Phase D** (donations) last, and only after Ken has checked the tax/legal side.
6. Then switch Supabase to Pro and Vercel to Pro **before** opening sign-ups to the public.

Note from my notes: the factory planner bug (only the first 100 comments of #8 are read) and the Vercel build-queue jam still need Ken's fixes; a second app makes the queue worse unless the old Git-connected projects are switched off.

---

## 4. What Ken must do himself (all secrets typed by Ken; agents never see them)

**A. Supabase**
1. Sign up at supabase.com (turn on 2-step login for the Supabase account itself, Account → Security).
2. New project **"oreheart"**, region close to most players (e.g. East US). Save the database password in a password manager.
3. Plan: **Free while building and testing**; **Pro ($25/month) before real players** (Free pauses after a week without use and has no daily backups).
4. Authentication → Sign In / Providers: Email on, "Confirm email" on. URL Configuration: Site URL `https://oreheart.cards`; Redirect URLs `https://oreheart.cards/**`, `https://admin.oreheart.cards/**`, and the preview pattern `https://oreheart-8-*-lummex.vercel.app/**`.
5. Authentication → Multi-Factor: TOTP enabled (on by default).
6. Authentication → SMTP: connect an email sender (e.g. Resend, free tier). **Needed:** Supabase's built-in email only sends to the project's own team addresses, so password reset/confirm emails won't reach players without it. Secret: the SMTP password, typed in the dashboard.
7. Authentication → Attack protection: turn on CAPTCHA (Cloudflare Turnstile, free) for sign-up; site key goes in the game env, secret key in the Supabase dashboard.

**B. Keys — names only (Ken pastes the values)**

| Where | Name | Secret? |
|---|---|---|
| Vercel project oreheart-8 (game) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY` | No (public by design) |
| Vercel project oreheart-admin | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | No |
| Supabase → Edge Functions → Secrets | `STRIPE_SECRET_KEY` (a **restricted** key: Checkout Sessions write, nothing else), `STRIPE_WEBHOOK_SECRET`, `SITE_URL` | Yes (Stripe) |
| (automatic in Edge Functions) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` / secret key | Supabase puts these in; nobody copies them |
| GitHub → Lummex/Starter → Settings → Secrets | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | Yes (for the deploy workflow) |
| Supabase → Auth → SMTP / Captcha | SMTP password, Turnstile secret | Yes |

**Never** put the service-role/secret key or any Stripe secret key in Vercel or in the game code.

**C. Stripe**
1. Create the account at stripe.com; turn on 2-step login; fill in business details and bank account (needed before real payouts).
2. Stay in **test mode** for Phase D building.
3. Developers → Webhooks → add endpoint `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`, events: `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`. Copy its signing secret into Supabase secrets.
4. Create the restricted key and paste it into Supabase secrets. Later repeat 3–4 in live mode with Ken's OK.

**D. Admin site domain**
1. Vercel → new project **oreheart-admin** (from the repo, root `projects/oreheart-admin`) — or let Anvil create it with Ken's OK.
2. Project → Domains → add `admin.oreheart.cards`. If oreheart.cards uses Vercel DNS it works at once; otherwise add the CNAME Vercel shows at the domain registrar.
3. Optional extra lock: Vercel Deployment Protection on the admin project (password protection is a paid add-on; not needed, since the real lock is on the server).

**E. Ken's admin account**
1. Use a **separate email** for the admin account (not the player account), with a strong password.
2. Register it once on the game (or admin site), confirm the email.
3. In Supabase → SQL editor, run the one line the agents give him (`insert into roles (user_id, role, granted_by) select id, 'admin', id from auth.users where email = '…';`). This is the only way anyone becomes admin.
4. Log in at admin.oreheart.cards → scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy). **Add a second factor on a second device** — there are no recovery codes; losing the phone means fixing it in the Supabase dashboard.

**F. Approvals** Ken gives: each phase's factory round, the Supabase deploy workflow, the second Vercel project, plan upgrades, going live with Stripe.

---

## 5. Costs and risks

### 5.1 Costs per month (prices checked on the official pages, Oct 28 2026)

| Service | While building | When open to the public |
|---|---|---|
| Supabase | Free $0 (500 MB DB, 50,000 monthly users, pauses after 1 week idle, 2 projects) | **Pro $25** (includes 100,000 monthly users, 8 GB disk, 250 GB egress, daily backups 7 days); more only if far bigger |
| Vercel | Hobby $0 (current) | **Pro $20** recommended: Hobby is for personal, non-commercial projects, and taking donations makes it commercial. Bandwidth matters: the game is ~95 MB, Hobby includes 100 GB/month ≈ only ~1,000 first-time full downloads |
| Stripe | $0 (test mode) | No monthly fee; **2.9% + 30¢** per US card donation, +1.5% international cards, +1% if currency conversion, **$15 per dispute**. A $5 donation costs ≈ 45¢ (9%); a $10 one ≈ 59¢ |
| Email (Resend or similar) | $0 free tier | $0 at small size |
| Turnstile captcha | $0 | $0 |
| Domain admin.oreheart.cards | $0 (subdomain) | $0 |
| **Total** | **$0** | **≈ $45/month + Stripe fees** |

### 5.2 Risks

**Security**
- Biggest risk is a mistake in RLS. Mitigation: deny-by-default; players write nothing directly; an automated test in every phase logs in as a normal player and tries every forbidden read/write; Supabase's Security Advisor (dashboard) must show zero warnings before going live.
- Admin takeover: role in DB + TOTP required on the server + separate admin email + audit log + no secrets in the admin site. Only Ken can add admins (SQL). Consider a daily email to Ken listing admin actions.
- Leaked keys: secret keys only in Supabase/GitHub secrets; a scan in the factory refuses any commit containing `sb_secret_`, `service_role`, `sk_live_`, `sk_test_`, `whsec_`.
- Bots/spam accounts: captcha on sign-up, email confirmation, rate limits on functions.

**Cheating**
- Server-authoritative engine, hidden RNG and hands, rejected moves logged, ownership checked at deck save **and** match start. Remaining risks: two accounts of the same person farming coins (daily caps, no repeat-opponent rewards, admin can see linked patterns) and players using outside helpers (can't stop fully; card games accept this).

**Payments, taxes, law (Ken should check this himself or with a professional; we are not legal or tax advisors)**
- If donors get items in return, it's legally closer to a **sale** than a donation (not tax-deductible for the donor; income for Ken). Naming it "Support Oreheart" may be more accurate than "Donate". Sales tax/VAT may apply depending on where buyers live (Stripe Tax can calculate it, extra fee).
- **Keep packs coin-only and coins not buyable with money.** Paid random packs ("loot boxes") are banned or regulated in some countries (e.g. Belgium) and app stores require odds to be shown. Donor rewards here are fixed items, not random.
- Accounts with emails need a privacy policy and terms, a way to delete an account, and an age rule (US: under-13 players bring COPPA rules; simplest is 13+ only). EU players: GDPR.
- Refunds/chargebacks: decide whether items are removed; $15 dispute fee each.

**Game size**
- Online features add < 0.5 MB to the game; the admin site is a separate project and does not count. No new textures. Pack-opening and collection screens reuse existing card art and the card frame. Size stays checked every round (< 95 MB; ask Ken before 100 MB).

**Delivery risk**
- Phase C is the hardest (hidden info, timers, reconnect). The engine being pure makes it doable, but expect C to need 2–3 rounds. The factory must learn to run Supabase locally for tests (Docker in GitHub Actions) — extra setup before Phase A.
- Vercel queue jam and the #8 comment-paging bug (see Anvil notes) will slow every phase until Ken fixes them.

### 5.3 Open questions for Ken (to ask on the "Waiting for you" page, not now)
1. Starter collection: everyone gets all starter-deck cards at sign-up? (recommended yes)
2. Crystals: free and unlimited for everyone? (recommended yes; packs only have creatures and spells)
3. Pack defaults: 8 cards = 5 Common, 2 Uncommon, 1 slot with Rare 85% / Ultra Rare 13% / Collector 2%; price 100 coins? Collector cards in packs at all, or donor/event only?
4. Refund/dispute: take the early-adopter items back or not?
5. Button wording: "Donate" or "Support Oreheart"?


---

## 6. Test server vs real server (Ken: "practice players shouldn't mix with paid players")

- **Two Supabase projects** (both Free while building): **oreheart-test** (previews, Ken's testing, demo data) and **oreheart** (production, real players only). Same migrations in both, deployed by the same "Supabase — deploy" workflow with a `target: test | production` choice. The factory's automated checks use neither: they run on a throwaway local Supabase.
- **Vercel**: Production environment → the real project's public URL/key; Preview environment → the test project's. Same for the admin site. A new public build setting `VITE_OREHEART_ENV` = `production` (Production) or `test` (Preview).
- **Double lock**: each database says what it is (`settings.server_kind`, `test` by default; Ken runs one SQL line once on the real project to make it `production`; the back counter can't change it). The game and the back counter call `server_info()` at start and **refuse to run** if the build and the server disagree (e.g. a preview accidentally pointing at the real database). A test-server build shows a blue "TEST SERVER" bar.
- Accounts never move between the two; a player who signed up on a preview must sign up again on the real game.

## 7. Card tracing (Ken: "a unique card identification number ... so we can trace if anyone's hacking")

- **Every physical card is a row** in `card_instances` with its own id (uuid), the card type (`card_id`), the current owner, the **first owner** (never changes), and **how it was made** (`starter`, `pack`, `admin_grant`, `donation`, `event`, `reward`) with a reference (pack opening id, admin action, ...).
- **Every change is a row** in `card_history` (append-only, even the database owner can't edit or delete): `created`, `transferred` (a trade), `admin_moved`, `destroyed`, with from/to player, reason, reference and time. Cards are never deleted, only marked `destroyed`.
- **Only two server functions** make or move cards: `private.card_grant()` (sign-up, packs, grants, rewards) and `private.card_transfer()` (checks the sender really owns the card, locks it, so it can't be traded twice). Players can't call either and can't read card ids at all; the game sees counts per card through `my_collection()`.
- **Trading (later)**: a trade will be a server function that locks both sides' cards and calls `card_transfer()` for each, in one transaction, with a `trades` row as the reference. Nothing else needs to change.
- **Back counter**: "Card lookup" (paste a card id → first owner, how they got it, current owner, every account it passed through) and a player's card list (filter by card, each id clickable).
- Size: 359 starter cards per player → about 3.6 million rows per 10,000 players (~1 GB with history). Fine for Supabase Pro (8 GB); watch it on Free (500 MB ≈ 1,000–1,500 players). If it ever matters, starter cards can become "virtual" until first traded.

## 8. Players under 13 (COPPA) — **Ken: have a lawyer check this before public launch; we are not lawyers**

- **Neutral age question** on Create account: "When were you born?" (month + year), not a yes/no box that hints at the right answer. Only the group (`13_plus` / `under_13`) is kept, never the birth date. The game remembers the answer on that device so going back and changing it doesn't work.
- **Under 13**: the child gives a username, a password and **a parent's or guardian's email** (we never ask for the child's email). That email becomes the account's login email.
- **Consent method: "email plus"** (the FTC's commonly used method when data is only used inside the game and not shared): (1) we email the parent a notice (what we collect and why, that nothing is shown to others except the username, how to withdraw) with an **Approve** link; (2) the parent opens it and ticks "I am this child's parent or guardian and I agree"; (3) we send a **second, confirming email** with a link to **withdraw** at any time. The link works only from the parent's mailbox (random 64-character token, only its hash is stored, 7-day expiry, one use).
- **Until a parent approves, nothing online works** (no deck saving, no avatar, later no matches or packs); the child can play offline practice. Withdrawing stops the account the same way.
- **Minimum data**: username (checked by the bad-words filter), password, the parent's email, the age group, consent records. No birth date, no photo (avatars are card art), **no free text**: a child's decks get plain names ("Deck 1", "Deck 2"); there is no chat. PvP (Phase C) shows only the username.
- **Back counter**: players list shows "Under 13: waiting / approved / withdrawn"; the player page shows the parent email, method, notice version, every consent event with time and IP, and a **Withdraw approval** button (audited) for when a parent asks by email. Parent requests to see or delete data are handled by Ken from the Inbox (Contact us form) for now (a delete button comes with account deletion, before launch).
- The **parent notice** (first draft, `parent-notice-draft.json` / `.md`, "DRAFT – lawyer review before launch") lists exactly what we keep and why, how to withdraw and how data is deleted. Its `version` must match `settings.consent_notice_version`.
- **No personal email (Ken, Oct 29).** Parents and players reach us through a **Contact us** form (game parent pages, consent-email landing pages, login and profile). Messages are stored server-side (`contact_messages`, RLS on, players can't read them, never deleted, max 5 per sender per hour) and appear in the back counter **Inbox**, where Ken answers (sent from the no-reply address through the email sender) and marks them handled with a note (audited). All automated emails (consent, password reset, answers) come from a no-reply address.
- **Lawyer check:** COPPA notices normally have to give the operator's contact details (name, address, phone number and/or email). We use a Contact us form plus a no-reply sender instead of a personal email, so the lawyer must confirm whether that is enough or whether a postal address, phone or monitored email must also be shown.
- Emails come from a small Edge Function that sends the `email_outbox` rows through the email service (Resend); its API key lives only in Supabase Edge Function secrets.
- For the lawyer: COPPA (US), and GDPR-K/UK Age Appropriate Design Code if EU/UK children play (ages differ by country, 13–16). Also needed before launch: a privacy policy with a children's section, the Contact us form and Inbox (built), and a data deletion process.

## 9. Ranked play (Phase C3 or later — design only)

**Goal (Ken):** every player has a rank that goes up when they win and down when they lose, better players rank higher, ranks reset every quarter, matchmaking pairs evenly ranked players, practice/offline never counts.

- **Rating method: Glicko-2** (hidden): each player has a rating (start 1500), a rating deviation RD (how sure we are; start 350) and a volatility. It is the standard used by many online games and chess sites; it settles new players quickly and is fairer than plain Elo when people play irregularly. Updated by the server after each **ranked** match only (`finish_match()`), never from casual, friend, practice, tutorial or vs-computer games.
- **Visible rank = tiers** from the conservative rating (rating − 2×RD), so new or long-absent players don't show a rank they haven't proven. Tier names (approved by Forge, Oct 29): **Pebble, Copper, Iron, Silver, Gold, Crystal, Oreheart Champion**, with divisions III–II–I in each except the top. Top tier = top 100 by rating. First **5 placement matches** show "Unranked".
- **Seasons = calendar quarters** (`2027-Q1` …, table `seasons`). **Soft reset** at the start of each season: new rating = 1500 + (old − 1500) × 0.5, RD raised to at least 250 (so the first games move you fast), 5 placement matches again. Ratings are stored per season (`player_ratings`, already in Phase A), so old seasons stay visible. End-of-season reward (e.g. a card back per highest tier reached) is optional.
- **Matchmaking (ranked queue)**: pair the closest ratings, starting within ±100 and widening by +50 every 10 s (max ±400); not the same opponent twice in a row when anyone else is waiting; never put two people from the same household/IP together if possible (anti-farming). Both players must be 13+ or approved under-13s.
- **Anti-abuse**: rewards and rating changes once per match (`idem_key`), no rating change for matches under 3 turns, forfeit = loss, repeated-opponent cap per day, admin can void a match (audited, rating rolled back via a new correction row).
- **Back counter**: season standings (rank, username, tier, rating, RD, games, W/L), a player's **rank history** (rating after every ranked match, season by season, from a `rating_history` table added in Phase C), and per-season tier counts. Admin can start/end seasons (audited).
- **Already in Phase A** (to avoid a later migration): tables `seasons` and `player_ratings` (empty, RLS on, players read only their own rating). Phase C adds `rating_history`, the ranked queue mode and the Glicko-2 update in `finish_match()`.

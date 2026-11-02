# Oreheart Online, night of Nov 2: PvP + coins/packs + daily quests + pack opening

Branch `pvp-nov2` (combined-oct31 868857df + factory/issue-8 9ac12236). Anvil is the only committer. TEST Supabase project only. Nothing goes live.
Plan this follows: `oreheart-online-backcounter-design.md` (Phases B and C). Ken's words: `studio/night-nov2.md` (local Oreheart folder).

This file is the contract between the four workers. Names, shapes and numbers here are binding; change them only by telling Anvil.

## Who owns which files (one writer per file set)

| Worker | Files |
|---|---|
| **Anvil** (lead) | `src/engine/mirror.ts`, `src/engine/view.ts`, `src/engine/engine.ts` (two small changes), `src/server/**`, `supabase/functions/match/**`, `tools/bundle-engine.mjs`, `tools/pvp-mock-server.mjs`, `.github/workflows/supabase-deploy.yml`, hidden checks AC600–AC629 (`factory-data/oreheart-8/acceptance/pvp-nov2.spec.mjs`), unit tests `tests/pvp-*.test.ts` |
| **Helper A, database** | `supabase/migrations/20261102*.sql`, `supabase/scripts/make-cards-sql.mjs`, `supabase/tests/phase_bc_*.test.sql` (+ run scripts), `supabase/seed.sql` if needed |
| **Helper B, economy screens** | `src/net/economy.ts`, `src/net/shop.ts`, `src/net/collection.ts`, `src/net/quests.ts`, `src/net/packopen.ts`, `src/net/quest-summary.ts`, `src/net/economy.css`, `src/ui/decks.ts` (owned counts / grey-out only), `public/art/packs/**`, unit tests `tests/economy-*.test.ts`, hidden checks AC640–AC669 (`factory-data/oreheart-8/acceptance/economy-nov2.spec.mjs`) |
| **Helper C, PvP client** | `src/net/pvp.ts`, `src/net/pvp.css`, `src/ui/app.ts`, `src/main.ts`, `src/net/flow.ts`, `src/game.ts` (only if a shared interface is needed), unit tests `tests/pvp-client-*.test.ts`, hidden checks AC630–AC639 (`factory-data/oreheart-8/acceptance/pvp-client-nov2.spec.mjs`) |

Nobody edits another worker's files. If you need something from another worker's file, ask Anvil (or write the smallest hook request in your report).
All paths are under `projects/oreheart-8/` unless they start with `supabase/`, `factory-data/` or `.github/`.

## Shared rules (owner rules, apply to everyone)
- Secrets never in chat or in files. The browser only ever holds the project URL and the publishable key.
- Nothing is written to coins, cards, matches or quests from the browser; every change is a server function.
- Vs-computer play is UNCHANGED: no game rule, number or layout changes offline. The engine changes below are switched on only by `pvp: true`.
- Silver UI (`net.css` kit: `.net-panel`, `.net-btn`, `.net-chip`, `.net-input`, `.net-actions`), no gold. Whimsical, kid-friendly, "deadly serious, completely ridiculous". Graphics over words in-game.
- PC first (mouse, big screen), and it must run smoothly on phones (landscape). Test both sizes.
- Hidden checks that need a database call `needDb()` (skip when `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_TEST_ADMIN_KEY` are unset), exactly like the Phase A checks in `acceptance.spec.mjs` lines 13864–13990 (helpers `makeUser`, `loginApi`, `gameSignIn`, `gameToMenu`). Copy those helpers into your own spec file; don't edit `acceptance.spec.mjs`.
- Unit tests run with vitest (`node_modules/.bin/vitest run <file>`); Node 20 is at `C:/Users/kentu/miniconda311/pkgs/nodejs-20.20.2-h80290e7_2/node.exe` (not on PATH). Local PostgreSQL 16 for SQL tests: `C:/Users/kentu/AppData/Local/Temp/claude/C--Users-kentu-Documents-Oreheart/443b6905-e55d-47cd-850e-4ee135de1ba0/scratchpad/pg/Library/bin` (use `PG_BIN=<that> bash supabase/tests/run-local.sh`).
- Baseline on this branch: `tsc --noEmit` clean; vitest 244 pass, 8 known asset failures (model files; ignore), 1 skipped. Keep it that way.

---

## Part 1. Database (Helper A)

Migrations `supabase/migrations/20261102000001_phase_b_economy.sql`, `..._000002_quests.sql`, `..._000003_pvp.sql` (split as you like, keep this order). Every table: RLS on, default deny, grants only as listed. Players never insert/update/delete directly. Follow the Phase A style exactly (schema `private` for helpers, `security definer set search_path = ''`, `private.assert_player()` at every player door, `private.ledger_apply()` is the ONLY way coins move, `private.card_grant()` the only way cards are made).

### 1.1 Cards copy
- `public.cards (id text pk, name, type, faction, rarity, cost int, in_packs bool, disabled bool, content_version text)` + `public.rarities (name pk, sort int, color text)` with the 5 tiers Common / Uncommon / Rare / Ultra Rare / Collector. Players may SELECT both.
- `supabase/scripts/make-cards-sql.mjs` reads `projects/oreheart-8/src/content/cards.json` and writes the insert statements (`insert ... on conflict (id) do update`) into the migration (like `make-settings-sql.mjs` does for settings). `in_packs = type in ('creature','spell') and not disabled`; crystals are never in packs (free and unlimited, Ken).

### 1.2 Packs
- `pack_types (id text pk, name text, blurb text, price_coins int check >= 0, active bool, faction text null, max_per_day int, art text, updated_by uuid, updated_at)`; `pack_slots (pack_type, slot_no, count int, odds jsonb)` where odds is basis points per rarity summing to exactly 10000 (check constraint via a function). `pack_openings (id uuid, user_id, pack_type, price_paid int, free bool, odds_snapshot jsonb, cards text[], idem_key text unique, created_at)`.
- Defaults (admin-editable rows): `standard` "Oreheart Pack" (all factions + neutral), `goblin` "Junkpile Pack", `gnome` "Gizmo Pack", `dwarf` "Deepforge Pack". Each: 8 cards = slot 1: 5 cards Common 10000; slot 2: 2 cards Uncommon 10000; slot 3: 1 card Rare 8500 / Ultra Rare 1300 / Collector 200. Price 100 coins. `max_per_day` 50. Faction packs draw from that faction's cards plus neutral (`faction = 'any'`) cards. If a rarity has no card in the pool, fall back to the next lower rarity.
- `public.open_pack(p_pack_type text, p_idem_key text, p_use_free boolean default false) returns jsonb`: one transaction: `assert_player()`; pack active; daily count < max_per_day; idem: if `pack_openings.idem_key` exists for this user return the same opening again (no second charge); pay with `ledger_apply(uid, -price, 'pack_purchase', opening_id, p_idem_key, null)` (or spend one free pack: `wallets.free_packs` column, add it, check >= 1); roll each slot with `gen_random_bytes` (crypto RNG, uniform, no modulo bias worries at this size: use `(get_byte(gen_random_bytes(4),0) ... )::bigint % n` is acceptable); grant the cards with `card_grant(uid, card, 1, 'pack', opening_id, null)`; insert the opening with the odds snapshot. Returns `{ "opening_id", "pack_type", "price_paid", "free", "cards": [{"card_id","rarity","is_new": bool}], "coins_after": int, "free_packs_after": int, "odds": <the slots> }`. `is_new` = the player owned none of that card before this opening.
- `public.shop_info() returns jsonb`: `{ "packs": [{id,name,blurb,price_coins,faction,art,max_per_day,opened_today,slots:[{slot_no,count,odds}]}], "coins": int, "free_packs": int }` (odds in basis points, the client shows percentages).
- `public.my_collection()` already exists (counts per card). Keep it.
- Deck ownership: `private.deck_problem()` (used by `save_deck`/`import_local_decks`) now also refuses a deck that uses more copies of a card than the player owns (crystal cards exempt: free and unlimited). Message: `you own N of <card name>`. Everyone keeps the starter collection (setting `starter_collection`, Phase A gives it at sign-up). Add a one-off repair in the migration: every existing profile without any card instance gets the starter collection (so older test accounts aren't empty).

### 1.3 Match rewards and stats
- Settings (new keys, all through `admin_set_setting`, so extend `private.editable_settings()` and the validation in `admin_set_setting` to accept them as whole numbers in sane ranges): `pvp_win_coins` 25, `pvp_loss_coins` 10, `pvp_daily_coin_cap` 300, `pvp_min_turns` 3, `quest_reward_easy` 25, `quest_reward_medium` 50, `quest_reward_hard` 75, `quest_streak_days` 7, `pvp_phase_seconds` 120, `pvp_bank_seconds` 60, `pvp_respond_seconds` 12, `pvp_timeouts_to_forfeit` 3.
- `private.match_reward(p_user uuid, p_match uuid, p_won boolean, p_turns int)`: pays `pvp_win_coins`/`pvp_loss_coins` once (`idem_key = 'match:'||match||':'||user`), only if turns >= pvp_min_turns and today's pvp coins (sum of transactions reason 'match_reward' today) stay <= cap. Updates `player_stats` (games, wins, losses, last_match_at, by_commander jsonb).

### 1.4 Daily quests
- `quest_defs (id text pk, name text, text text, tier text check in (easy,medium,hard), kind text, target int, params jsonb, active bool)`. Kinds and the summary field they read (see 4.3): `battles`→`battles`, `wins`→`wins`, `battles_with`→`battles` where `summary.commander = params.commander`, `wins_with`→`wins` where commander matches, `creatures_played`, `faction_cards` (params.faction)→`cardsByFaction[faction]`, `cost7_played`, `hits_landed`, `hits_blocked`, `units_defeated`, `commander_damage`, `mine_hold`→`mineHoldTurns`, `miner_mines`.
- Seed rows (names in the game's voice; `[Commander]`/`[Faction]` are filled from params when the quest is dealt):
  - easy (25): `pick-a-fight` "Pick a Fight" play 2 battles; `summon-the-rabble` "Summon the Rabble" play 8 creatures; `clink-clink` "Clink Clink" mine with Miners 5 times; `thwack` "THWACK!" land 10 hits.
  - medium (50): `winner-winner` "Winner Winner" win 2 battles; `day-out` "[Commander]'s Day Out" fight 3 battles with [Commander]; `faction-pride` "[Faction] Pride" play 10 [Faction] cards; `big-spender` "Big Spender" play a card that costs 7 or more; `bonk-collector` "Bonk Collector" defeat 8 enemy units; `shield-wall` "Shield Wall" block 5 hits.
  - hard (75): `crown-jewels` "Crown Jewels" win a battle with [Commander]; `mine-all-mine` "Mine, All Mine" hold a mine for 3 turns in a row; `right-in-the-kisser` "Right in the Kisser" deal 10 damage to Commanders; `hat-trick` "Hat Trick" win 3 battles.
- `player_quests (id uuid, user_id, quest_id, params jsonb, dealt_on date, progress int, target int, done_at, paid_tx bigint, rerolled bool, expires_on date)`. Players SELECT own rows.
- `public.my_quests() returns jsonb`: deals today's 3 if none dealt today (one easy, one medium, one hard, random defs; `[Commander]` = a random commander id from settings `commander_ids`, `[Faction]` = random of goblins/gnomes/dwarves); unfinished quests from earlier days stay until `expires_on = dealt_on + 3`; at most 6 open. Returns `{ "quests": [{id, quest_id, name, text (filled in), tier, reward, progress, target, done, expires_on}], "reroll_left": 0|1, "streak_days": int, "free_packs": int, "today": date }`.
- `public.quest_reroll(p_quest uuid)`: once a day per player, replaces one undone quest with another of the same tier.
- `private.quest_progress(p_user uuid, p_summary jsonb, p_ref text)`: adds progress to every open quest from the summary (with the per-report caps in 4.3), marks `done_at` when progress >= target and pays the reward ONCE: `ledger_apply(uid, reward, 'quest_reward', quest row id, 'quest:'||row id, null)`; records the ref in `quest_reports (user_id, ref, created_at)` with a unique (user_id, ref) so a match can only be reported once. Streak: `quest_streaks (user_id pk, days int, last_day date)`; when all 3 of today's dealt quests are done, `days + 1` (once per day); at every `quest_streak_days` days, `wallets.free_packs + 1`.
- `public.quest_report(p_summary jsonb, p_ref text) returns jsonb`: the browser's report of a finished vs-computer match. `assert_player()`; at most 20 reports per player per day; `p_ref` must be `practice:<uuid>`; applies 4.3 caps; calls `quest_progress`; returns `my_quests()`.

### 1.5 PvP tables (the Edge Function writes them with the service role; players only read)
- `rooms (code text pk check ~ '^[A-HJ-NP-Z]{6}$', host uuid, guest uuid, host_deck jsonb, guest_deck jsonb, status text check in (waiting, started, cancelled, expired), match_id uuid, created_at, expires_at)`. Players SELECT rows where they are host or guest.
- `matches (id uuid pk default gen_random_uuid(), mode text default 'friend', room_code text, player_a uuid, player_b uuid, state jsonb NOT readable by anyone but the service role, seq int default 0, status text check in (active, finished), clock jsonb, winner uuid, result text, end_reason text, turns int, engine_version text, created_at, updated_at, ended_at)`. View `public.my_matches` (security_invoker) exposing id, mode, room_code, player_a, player_b, seq, status, winner, result, end_reason, turns, created_at, ended_at for matches where I am a or b. No grant on `matches` itself to authenticated.
- `match_views (match_id uuid, user_id uuid, side text, seq int, view jsonb, events jsonb, deadline timestamptz, updated_at, primary key (match_id, user_id))`. Players SELECT own rows. `alter publication supabase_realtime add table public.match_views;` (realtime filtered by RLS).
- `match_moves (id bigint identity, match_id, seq int, user_id, action jsonb, ok bool, error text, ms int, created_at)`. Players SELECT moves of their own finished matches.
- `public.pvp_gate() returns jsonb`: `assert_player()`, returns `{ "user_id", "username", "avatar" }` (the Edge Function calls it as the player to check ban/consent). `public.my_active_match() returns uuid` (my match with status active, newest).
- `private.pvp_finish(p_match uuid, p_winner uuid, p_result text, p_end_reason text, p_turns int, p_summary_a jsonb, p_summary_b jsonb)`: marks the match finished (idempotent: a second call does nothing), pays `match_reward` for both, runs `quest_progress` for both with the summaries (ref `match:<id>`).

### 1.6 Tests
`supabase/tests/phase_bc_economy.test.sql` etc. in the Phase A style (the local shim gives `auth.uid()`): odds sum check refuses 9999; 1,000 openings in SQL land within normal spread of the odds (rare slot: 850 ± 60 Rare); 10 parallel-looking openings with the same idem_key = one charge; coins can't go below zero (a player with 150 coins opening two 100-coin packs gets exactly one, the second raises); a deck with more copies than owned is refused; `quest_progress` pays each quest once even when called twice with different refs; the same ref twice is refused; `pvp_finish` twice pays once; a player can't read another player's match_views or any `matches.state`; nobody can update `match_views`. Run them on the local PostgreSQL (`run-local.sh`) and keep `run-supabase.sh` working for the factory (add the new test files to both).

---

## Part 2. Engine and referee (Anvil)

### 2.1 Engine changes (`src/engine/engine.ts`), all off unless `pvp: true`
- `createMatch({ pvp: true, playerDeck, opponentDeck, playerCommander, opponentCommander, seed })`: `opponentDeck` (a card-id list) works like `playerDeck`. State gets `pvp: true`.
- Respond window: when `s.pvp`, `openWindow()` and the attack case ALWAYS open the window (priority goes to the responder, `pendingResponse` set) even when the responder holds nothing that can respond; `pass` is the only reply then. (Forge's call so nobody can tell who holds a counter.) The engine's `legalActions()` already lists `pass` during a window.

### 2.2 `src/engine/mirror.ts`
`mirror(x)`: point reflection of the board for side B so that B's client always plays as `'player'`: every object key and string value `'player'`↔`'opponent'`, every `row` → `8 - row`, every `col` → `14 - col`, every `facing` reversed (N↔S, E↔W, NE↔SW, NW↔SE). Applies to states, actions and events alike. `mirror(mirror(x))` deep-equals `x`. Property test: random legal playouts, `applyAction(mirror(s), mirror(a))` equals `mirror(applyAction(s, a))`.

### 2.3 `src/engine/view.ts`
`viewFor(state, side)`: deep copy with the other side's `hand` entries replaced by `{ uid: 'h:'+i, hidden: true }`, BOTH `deck` arrays replaced by `{ uid: 'd:'+i, hidden: true }` entries of the same length, `rng` set to 0. `eventsFor(events, side)`: the other side's `draw` events become `{ type: 'draw', player, hidden: true }`; everything else unchanged. Then, for side B, `mirror()` both.

### 2.4 `src/server/referee.ts` (pure, no I/O) and `src/server/service.ts` (ops over a `Store` interface)
Match record: `{ id, players: { a: {userId, username, avatar}, b: {...} }, state, seq, status, clock: { deadline (ms), respondDeadline (ms|null), frozenLeft (ms|null), bank: {a, b} (s), timeouts: {a, b} }, engineVersion }`.
- Clock (Ken): each priority holder gets `phaseSeconds` (120) + their bank; unused seconds (floor) go to the bank, capped at `bankSeconds` (60); a timeout empties that player's bank. During a Respond window the main clock freezes (`frozenLeft`) and `respondDeadline = now + respondSeconds`. A new deadline is set whenever `priority` or `phase` changes after an accepted action.
- `applyTimeouts(match, now)`: if `respondDeadline` passed → `pass` for the responder; else if `deadline` passed → for the priority holder: mulligan `{type:'mulligan', uids:[]}`, else `{type:'done'}`; count `timeouts[side]++`; after `timeoutsToForfeit` (3) in a row the match ends (`end_reason: 'timeout'`). An accepted action by that player resets their count.
- Any player's action is checked: match active, caller is a or b, `seq` equals the match's seq, `state.priority` is the caller's side (or it is a `surrender`/`brew` the engine accepts for them), the action is un-mirrored for side B, then `applyAction`; refused actions are logged and change nothing.
- `finish`: `winner`, `result` ('a'|'b'), `end_reason` ('win'|'surrender'|'timeout'), `turns = state.turn`, plus the quest summary per side (4.3) computed from all events of the match.

### 2.5 The server API (the `match` Edge Function; the mock server speaks the same)
`POST <functions>/match` with the player's JWT, body `{ op, ... }`, JSON answer `{ ok: true, ...result }` or `{ ok: false, error }` (HTTP 200 either way, 401 only when not signed in).
| op | body | result |
|---|---|---|
| `create` | `{ commander, deckId? , cards? }` (a starter deck id, or a saved deck's card list) | `{ code, expiresAt }` |
| `cancel` | `{ code }` | `{}` |
| `join` | `{ code, commander, deckId?, cards? }` | `{ matchId, view }` (starts the match; the host learns of it by polling `room` or from the `match_views` insert) |
| `room` | `{ code }` | `{ status, matchId? }` |
| `my_match` | `{}` | `{ matchId?: string }` (an active match to return to) |
| `state` | `{ matchId }` | `{ view }` |
| `act` | `{ matchId, seq, action }` | `{ view }` or `{ ok:false, error, view }` (the error text is the engine's) |
| `tick` | `{ matchId }` | `{ view }` (applies due timeouts; harmless when nothing is due) |
| `forfeit` | `{ matchId }` | `{ view }` |

`view` (what one player may see): `{ matchId, seq, status: 'active'|'over', mySide: 'a'|'b', state, events, deadline (ISO or null), respondDeadline, bank: { me, them }, timeouts: { me, them }, names: { me, them }, avatars: { me, them }, result: null | { won: bool, reason, coins } }`. In `state` and `events` the player is ALWAYS engine side `'player'` (side B gets the mirrored board), the other hand and both decks are hidden, `rng` is 0.
The same `view` is written to `match_views.view` (with `events` for that seq) after every accepted action, so Realtime delivers it.

Local end-to-end without Supabase: `tools/pvp-mock-server.mjs` (Node, in-memory store, same `service.ts`) on `http://127.0.0.1:4310/match`, fake sign-in by header `x-mock-user: <name>`. The client uses it when the page is opened with `?test=1&pvp=mock&user=<name>` (see 3.1). Two Playwright pages with different `user=` play a whole match through it.

---

## Part 3. PvP client (Helper C)

### 3.1 `src/net/pvp.ts`
- `Transport` interface `{ call(op, body): Promise<any>; watch(matchId, onView): () => void }` with two implementations: **Supabase** (`client().functions.invoke('match', { body })`, `watch` = Realtime `postgres_changes` on `match_views` filtered `user_id=eq.<me>` PLUS a 3 s poll of `state` as a fallback, plus re-fetch on `visibilitychange`/`online`) and **mock** (`fetch` to `http://127.0.0.1:4310/match` with header `x-mock-user`, 500 ms poll). Pick mock when `?pvp=mock`.
- `class NetGame`: the surface `app.ts` already uses from `Game`: `state`, `subscribe(fn)`, `act(action)` (sends `{matchId, seq, action}`; on `ok` set `state` from the view and emit the view's events; on refusal return `{ ok:false, error }` and re-sync to the returned view), `legalActions()` (the engine's `legalActions(this.state)` on the view; during the other player's priority: brew actions only, like `Game`), `getState()`, `movesLeft()`, `mode = 'standard'`, `paused = false`, `options`, `difficulty = 'pvp'`, `autoSkip = false`, `ai = false`, `aiPace = null`, `newMatch()` no-op, `setMode/setStance/setAiStyle` no-ops, `setPaused` no-op. Extra: `deadline`, `respondDeadline`, `bank`, `names`, `avatars`, `mySide`, `status`, `result`, `forfeit()`, `tick()` (call the server when the local clock passes `deadline`/`respondDeadline` by 1 s, at most every 2 s), `stop()`.
- Views arrive out of order sometimes: ignore a view whose `seq` is lower than the current one; a view with `seq` more than 1 ahead is fine (views are full snapshots).
- Room screens (silver, `net.css` kit, in `pvp.css` only what's new): main menu button **"Play a friend"** (only when `net.active`) → a screen with **"Make a code"** and **"I have a code"**. Make a code: pick Commander and deck (reuse the existing Choose Your Commander / deck pick UI if practical, else a compact picker: 3 starter Commanders + the player's saved decks), call `create`, show the 6-letter code BIG with a Copy button and "Waiting for your friend…" (poll `room` every 2 s; Cancel). I have a code: six-letter input (uppercase, no I or O), pick Commander/deck, `join`. Errors in plain words ("That code has expired", "That's your own code").
- Match screen (`app.ts`): `beginNetMatch(ng: NetGame)`: like `beginMatch` but no `newMatch`; `this.game = ng`; timer bar shows `ng.deadline` (server clock, no local reset), the bank chip shows `ng.bank.me`; the Respond bar runs from `ng.respondDeadline`; hide Pause/speed/Card Play/Comp-vs-Comp and the computer's "thinking" UI; standing orders, chase, guard arrows and stances keep working (they send ordinary actions); `aiTargets()` must not read hidden hand entries (`hidden: true`); the opponent's played cards still pop up from the public events; "Give up match!" calls `forfeit`; when `status === 'over'` show the normal result screen with "Back to menu" (no "Play again"); name plates show `names.them` / `avatars.them` (the existing `getPlayerName()` hook / avatar spot).
- Reconnect: in `flow.ts proceed()` (after `net.active = true`) call `my_match`; if there is one, open it straight away (`beginNetMatch` with `state` loaded). Also a **"Back to your match"** button on the main menu while one is active.
- Match end: call `onMatchEnd` from `src/net/economy.ts` (Helper B) for vs-computer matches only (PvP progress is counted by the server): `onMatchEnd({ state, events, pvp: false })` where `events` is every event emitted during the match (collect them in the listener). For PvP pass `pvp: true` (it only refreshes the coin counter).
- Hidden checks AC630–AC639 (`pvp-client-nov2.spec.mjs`), all against the mock server (start it from the spec with `child_process` if not running, or document `node tools/pvp-mock-server.mjs` first): two pages (`user=alice`, `user=bob`) make a code, join, both see the match; the first player's Deploy works and the other sees it; an out-of-turn `act` from the page's hooks is refused with an error and the board unchanged; reload a page mid-match and it is back in the same match at the same seq; forfeit ends it for both; the timer bar's `aria-valuenow` follows the server deadline; at phone size (390×844 landscape → 844×390) the code screen fits.

### 3.2 Test hooks (`window.oreheart`, test pages only): `pvp: { create(commander, deckId), join(code, commander, deckId), view(), act(a), forfeit(), tick(), seq() }`.

---

## Part 4. Coins, packs, collection, quests and the pack opening (Helper B)

### 4.1 Menu and coin counter (`economy.ts`)
`export function economyMenu(el)` is called from `flow.ts menuExtras` (Anvil adds the call; you fill the function): when `net.active`, append a coin chip (painted coin look, number) that refreshes from `shop_info`, and buttons **Shop**, **Collection**, **Quests**. `export async function onMatchEnd(o: { state, events, pvp: boolean })`: if `!pvp` and `net.active`, build the summary (4.3) and call `quest_report`; then refresh the chip; if a quest just completed show a small toast ("Quest done! +50 coins"). `export function refreshCoins()`.

### 4.2 Screens (`shop.ts`, `collection.ts`, `quests.ts`), silver kit, back button to the menu
- **Shop**: the 4 packs as cards with their art (`/art/packs/<id>.webp`; placeholder = a painted-looking CSS/canvas foil until Brush's art lands in `art/packs/` — Brush delivers to the local Oreheart folder `art/packs/` with a README; copy into `public/art/packs/`), price, "x opened today", and the odds in plain words ("8 cards: 5 Common, 2 Uncommon, 1 Rare or better: Rare 85 %, Ultra Rare 13 %, Collector 2 %"). Buy → `open_pack(id, idem_key = crypto.randomUUID(), use_free)` → pack opening screen. Not enough coins → the button is disabled with "Need 100 coins" and a hint "Finish quests to earn coins". Free pack available → a "FREE" ribbon and it uses it first.
- **Collection**: every card (from `CARDS`, not disabled) as an `ohCardEl` thumbnail with "×N" badge, unowned greyed with a small lock, filters by faction / rarity / owned; counts header "You own 123 of 359 cards (61 different)".
- **Quests**: the open quests as parchment-free silver rows: name, text, a progress bar (`progress/target`), reward coins, Done tick and "+50" when paid, expiry ("2 days left"); one **Reroll** per day (dice icon) on undone quests; streak line "Quest streak: 3 days (free pack at 7)". Whimsical. Refresh on open.
- **Deck builder** (`decks.ts`): when `net.active` show "owned ×N" on every card, grey out (about 45 % + lock) cards the player owns none of, and cap the copy limit at `min(owned, copy limit)`; crystals are unlimited. Offline: unchanged.

### 4.3 `quest-summary.ts` (pure, unit-tested)
`summarize(events: any[], finalState: any, mySide = 'player'): Summary` with `{ turns, won: boolean, commander: string, battles: 1, wins: 0|1, creaturesPlayed, cardsByFaction: { goblins, gnomes, dwarves }, cost7Plays, hitsLanded, hitsBlocked, unitsDefeated, commanderDamage, mineHoldTurns, minerMines }`, counting only MY side's deeds: creatures I summoned (`summon` events with `owner`/`player` me), cards I played by their faction (summon + cast), plays of cards with `cost >= 7`, my swings that hit (`hit`/`damage` events where the attacker is mine), hits I blocked (`block` events where the defender is mine), enemy units I defeated (`defeat`/`death` events of enemy creatures caused by my attacks), damage I dealt to the enemy Commander, the longest run of consecutive turns one of my creatures kept mining the same mine, and my `mine` events by Miners. Read the real event names from `engine.ts` (grep `ev.push({ type:`) and write the mapping down in the file. Server-side caps per report (A enforces, you match in the unit test): turns ≤ 60, creaturesPlayed ≤ 60, cost7Plays ≤ 20, hitsLanded ≤ 200, hitsBlocked ≤ 100, unitsDefeated ≤ 60, commanderDamage ≤ 60, mineHoldTurns ≤ 60, minerMines ≤ 120; a report with `turns < 3` counts nothing.

### 4.4 Pack opening (`packopen.ts`), Ken: "I want it to be animated when you open the pack. It rips open."
- Full-screen scene over the silver background. The pack (art or placeholder) sits centre, idles with a slow foil sheen (a moving highlight gradient masked by the pack shape) and a tiny wobble. Tap/click or "Rip it open": the pack shakes, glows, then **tears along a jagged torn edge** near the top (two pieces: the top strip flies off with a spin; the body stays), **foil shreds fly** (20–40 small sparkly triangles/strips with the pack's colours, gravity + spin, 1.2 s), and 8 cards slide out face DOWN (card back `ohCardHTML({id:'back',type:'back',...})`) into a fan/row.
- The player **flips each card** (tap) or "Flip all": a 3D Y-flip (CSS `rotateY`) revealing the real card (`ohCardEl`); rarer cards glow more: Common none; Uncommon a soft silver rim; Rare a blue-white bloom; Ultra Rare a purple-gold... NO gold: use a bright violet bloom with sparkles; Collector a rainbow shimmer with a short burst. `is_new` shows a small "NEW" tag. Sounds: a rip and a flip, commercial-safe, synthesized in the existing `audio.ts` style if no file exists (ask Anvil before adding files > 100 KB); respect Ken's "fewer sounds".
- Buttons: "Open another" (if affordable) and "Done". Must run at 60 fps on PC and smoothly on a phone: CSS transforms/opacity only, `will-change`, no layout thrash, shreds as absolutely positioned divs or one canvas, prefers-reduced-motion shortens everything.
- Test hooks (`window.oreheart.packs`): `open(id)` (uses a stubbed result when offline, so the animation is testable without a database), `state()` → `{ phase: 'idle'|'ripping'|'cards'|'done', flipped: n, cards: [...] }`, `flipAll()`, `skip()`.

### 4.5 Hidden checks AC640–AC669 (`economy-nov2.spec.mjs`)
Offline (no db): the pack opening runs through its phases with the stub and all 8 cards flip; rarity glow classes present; phone size fits. With db (`needDb()`): a new user has 300 coins and the starter collection; `shop_info` lists 4 active packs with odds summing to 100 %; opening a pack costs 100 and adds 8 card instances; the same idem_key twice charges once; a user with 50 coins is refused; 10 parallel openings with 10 idem keys and 300 coins give exactly 3 openings and 0 coins; the quest screen shows 3 quests; a `quest_report` of a 5-turn won match advances "Pick a Fight" and pays nothing until it is done; reporting the same ref twice adds nothing; the deck builder refuses a 5th copy of a card the player owns 4 of.

---

## Part 5. Checks, order of work, and what Anvil does with the pieces
1. Anvil: engine + mirror + view + referee + mock server first (so Helper C can test against it within the first hour); then the Edge Function and the deploy workflow.
2. Helpers A, B, C start at once from this contract. Report back with: files, how you tested, what is left, anything you need from another worker.
3. Anvil merges, runs `tsc`, vitest, the local SQL tests, the full hidden suite (local, no db) and the PvP mock checks; deploys the migrations and the function to the TEST project (through Ken's GitHub workflow "Supabase — deploy", target test, branch pvp-nov2); runs the two-browser match against the test project if test accounts can be made; makes ONE preview; then a separate Fable security review (someone who wrote none of it).

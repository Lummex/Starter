# Anvil-online report: server regions (Nov 6, 2026)

Branch `pvp-nov2` on Lummex/Starter, commit 2a26738e (regions) and 46772db9 (three follow-ups: AC111 on Ken's rarity rules, the lobby deck picker's chip frame, the Commander deck rows in one line). TEST database only (OreHeart-Test, deploy #35, run 42286218394, green: the SQL suite 123/123 on the throwaway copy, then the migration and the match function applied to TEST. Deploy #34 before it stopped at the suite (118/123): the five new regions checks that failed were test-side (Side C was still in an old live match, so the pairing rightly skipped them; one-letter region ids tripped the shape check first; the admin statement read private.setting), fixed in ddf85375; the TEST database was not touched by #34); nothing live. Preview: https://oreheart-8-7e99crrof-lummex.vercel.app

## What Ken asked (Nov 5)
"We need to add a server, so you can know the East Coast, West Coast, Central ... so players can log into their servers. And also I'd like to show for now how many players are in their server playing. Or waiting in lobby."

## What a region is, in plain words
There is ONE database for everyone (East US). A region is three things:
1. Its own matchmaking pool: Ranked and Unranked queues pair players within the region, so two players in a region are close to each other.
2. The place where the match function runs for that player (the game sends the region's edge; the function's database calls still go to East US). US Central has no edge of its own, so its calls run in East US, where the database is.
3. A home for the live counts: online (seen in the last 2 minutes), playing (in an active match), waiting (in the queue).
Lag, honestly: the dice and the clocks live in the one database, so a West player's every move still crosses the country once (about 60-80 ms each way). The region pins the function next to the player, not the data. Per-region databases would be separate Supabase projects with separate accounts and money, so they are not done.
Small player base: nobody in your region after 45 s and the game offers "Search all regions"; a player who says yes pairs with anyone, and anyone pairs with them. Nobody is split into an empty queue without being told.

## What the player sees
- PvP Lobby, left column: SERVER with US East / US Central / US West, each with its ping and "n online · n playing · n waiting"; the nearest by ping is lit until you tap another; the choice is remembered on the browser and on the account.
- The Dashboard's top-bar server pill names the chosen server ("US East · online").
- Queue: "Looking for an opponent (rating 1000, n waiting)"; after the fallback time, "Nobody near in US West yet · 1 waiting elsewhere" with a Search all regions button; "Searching every server" once pressed.
- Admin settings: `regions` (the list with id, name, edge, enabled; Europe is in the list but off), `region_fallback_seconds` (45, 10-600), `region_counts` (true/false).

## Code and database
- Migration `supabase/migrations/20261106000005_regions.sql` (reviewed line by line against the newest settings code: its `admin_set_setting` is the Nov 5 tier-steps body plus a true/false branch for `region_counts` / `dashboard_counts` and a `regions` branch; the editable list is the Nov 6 dashboard list plus the three new keys; `int_setting_range` wraps the pack-bundles version; every column and function it uses exists: profiles.last_seen_at, pvp_queue, matches.player_a/b with status 'active', private.assert_player / avg_wait / rating_of, public.pvp_pairings). New doors: `regions_info()` (also the heartbeat), `set_region(text)`, referee-only `pvp_queue_join(..., p_region, p_any)` and a region-aware `pvp_queue_pair`. The old 4- and 5-argument `pvp_queue_join` overloads stay (nothing calls them; dropping them is a later tidy).
- Game: `src/net/regions.ts` (ping, picker, pill words, heartbeat), lobby and queue in `src/net/pvp.ts`, the Dashboard pill in `src/net/dashboard.ts`, the mock server and memory store, `supabase/functions/match/index.ts` (x-region pin, region in queue calls). Unit tests `tests/pvp-regions.test.ts` (6, green). SQL checks added to `supabase/tests/phase_bc_pvp.test.sql` (run by the TEST deploy).
- Fixed while finishing: the "Search all regions" offer now counts who is waiting elsewhere from the newest queue answer, not the first one; the page's `window.oreheart.pvp.region` hook is reachable.
- Known gap (not new): `admin_set_setting` has no branch for `shop_badges`, `pack_bundles`, `pack_bundle_promises` or `ranked_ladder` (they fall into the word-list branch), so the admin site cannot change those four through that door yet; they were set by data migrations. A small follow-up.

## Checks
AC695 (the regions browser check) passes with the mock server; the PvP and economy sweep AC650-709: 33 pass, 10 skipped (database rig), AC679 is the known timing flake (passed alone); AC111/AC672/AC205 and the Commander-screen set AC72/137/144/145/146/208/463 pass after the follow-ups; vitest tests/pvp-regions.test.ts 6 pass; the SQL suite runs inside the TEST deploy (its result is the deploy's).
The check step that looked for the Dashboard's server pill on the mock-menu pages now reads the region hook instead (the mock pages keep the old menu, Nov 6); the pill is looked at on the preview.

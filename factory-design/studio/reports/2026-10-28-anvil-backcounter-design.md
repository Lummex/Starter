# 2026-10-28 Anvil: Oreheart Online + back counter design

Job from Forge (for Ken). **Design only:** no factory round, no labels, nothing live, game branch untouched.

## Done
- Wrote `factory-design/design/oreheart-online-backcounter-design.md`:
  1. Architecture: game (Vercel) + separate admin site (admin.oreheart.cards) ↔ one Supabase project; Stripe webhook as an Edge Function. 20 tables (profiles, roles, bans, wallets, append-only transactions ledger, cards/rarities, collections, item_grants, decks, pack_types/pack_slots/pack_openings, matches/match_views/match_moves/match_queue, player_stats, donations/reward_tiers, admin_audit, settings), RLS table (players read own rows, write nothing directly), list of server-only actions.
  2. PvP: the existing engine is pure (JSON state, seeded RNG inside the state, no DOM) so it runs unchanged in an Edge Function; per-side redacted views (hide opponent hand, deck order and the RNG); seq-locked moves; reconnect from saved views; timers via pg_cron; casual queue + friend codes first, ranked later; client changes listed (login, NetGame with the same interface as Game, server decks, owned counts/grey-out).
  3. Phases A (accounts + admin v1), B (coins/packs/collection), C1–C3 (PvP), D (Stripe) with "done when" checks. Suggested order: Ken's setup → Round 27 → Round 28 → A → B → C → D → plan upgrades before public sign-ups.
  4. Ken's own steps: Supabase (Free now, Pro $25 before launch), auth settings, SMTP, captcha, key names per place, Stripe test mode + webhook, admin domain, separate admin email + TOTP on two devices.
  5. Costs: $0 while building; ≈ $45/month (Supabase Pro $25 + Vercel Pro $20) + Stripe 2.9% + 30¢ per US donation. Risks: RLS mistakes, admin takeover, key leaks, farming, donations-for-items = sale, loot-box rules (keep packs coin-only), privacy/age, Vercel bandwidth for a 95 MB game.

## Checked
- Engine facts read from factory/issue-8 today (engine.ts exports, rng.ts, decks.ts localStorage, cards.json: all 66 cards already have rarity: 25 Common, 13 Uncommon, 15 Rare, 8 Ultra Rare, 5 Collector).
- Prices read from supabase.com/pricing, stripe.com/pricing, vercel.com/pricing on Oct 28 2026.
- Nothing built, so nothing claimed to work.

## Open for Ken (ask on "Waiting for you" when the work starts)
Starter collection, free crystals, pack defaults (size/odds/price), refund handling of donor items, "Donate" vs "Support Oreheart". Plus approvals: second app in the factory, Supabase deploy workflow, plan upgrades.

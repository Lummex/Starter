# Anvil: Gauge's fix list on the PvP night build (Nov 2)

**Preview (TEST server, not live):** https://oreheart-8-owchwcl7q-lummex.vercel.app, branch pvp-nov2 at c774d8a9 (includes factory/issue-8 b05c0aeb). TEST database and the `match` function redeployed from this commit. Nothing promoted.

## What changed
1. **Respond run-outs are not timeouts.** A Respond window running out just means "let it happen": no timeout count, no forfeit. A pass also no longer clears the count of whole phases that ran out, because the browser now sends passes by itself. Three new referee tests.
2. **Respond pace (Forge's call, Ken judges).** Exact behaviour in PvP:
   - You hold no counter you can play (no playable Respond card, no Brew, and no Crystal card that could pay for a held counter): no dialog, no click. A small note says what the enemy did ("Enemy summons Goblin Miner."), and your browser passes after a fixed 2 s. The board stays usable meanwhile (orders can still be given).
   - You can respond: the normal dialog, up to the server's 12 s.
   - What the other player can see: every window takes at least 2 s. A window that lasts longer shows the other player is thinking, so it hints they hold something. Nothing else shows.
   - If the browser is closed, the server passes at 12 s.
   - Vs-computer play is unchanged.
3. **Keyboard:** while Shop, Collection, Quests or a pack is up, everything behind it is inert, for signed-in players too (same code path). Check AC667.
4. **Readable text:** FREE and NEW are white on the painted chip, the Commander tick is the painted tick. **Spell and crystal name plates are NOT this build's fault:** oreheart.cards shows the same white name on the same pale plate (same computed colours). Left alone. Ken may want it looked at separately.
5. **Menu:** coins, Play a friend, Shop, Collection, Quests are in a column under the menu words on PC and two rows along the bottom on a phone. Clear of the logo and the words. Check AC611 at three sizes.
6. **Small:** the focus ring only shows for keyboard players; Collection's Back stays on screen; "85%" can't split; a double tap only flips; the pack scene has Back before the rip (the cards are already paid for and in the Collection, and a toast says so).
7. **The rip:** longer build-up with a harder shake, a white-hot line along the tear with a quick flash and a jolt, 64 larger shreds from the torn edge (36 on a phone, 8 with reduced motion) plus a last puff as the cards come out. The strip swings off to the right. The card back only rises inside the pack, and the title stays on top.
8. **Computer-looking parts replaced with painted ones:** silver gem buttons on the menu and Reroll; panel-silver on panels; frame-chip on filters, coin count and the deck list; frame-progress on quest bars; frame-card-slot on the code letters and Commander tiles; count-blank coins for owned counts; painted icons for ticks and swords. Emoji removed.

## For Brush
- **A small painted lock**, for unowned cards in the Collection and Deck Builder. I removed the emoji, so unowned cards are only greyed for now.
- Optional: a silver-blue version of `frame-chip-lit`. I tint the green one with a colour shift for chosen filters, FREE and NEW.

## Checks
- Unit tests: 296 pass, the same 8 known asset failures, 1 skipped.
- Hidden checks on these areas (AC580-582, AC600-611, AC630-669, every Respond, counter and Deck Builder check): 89 pass, 18 skip (they need the database rig). AC580 now passes here (b05c0aeb's fix).
- Vercel build proven: the preview serves the game, sw.js and the pack art; the bundle holds the new code and talks to the TEST project (`server_kind: test`); the `match` function refuses anonymous callers.
- `.vercelignore` is back to plain `tools/`, same as factory/issue-8.

## Not done or not proven
- **Still no real match on the TEST server**: Ken's first friend match is that test (studio/pvp-test-steps.md).
- **The Respond dialog for a real holder in PvP was only exercised if a test hand happened to hold a playable counter**; that code path is the old dialog, unchanged.
- The rip was looked at frame by frame in screenshots at PC and phone sizes. Smoothness was not re-measured after the extra shreds, and not tried on a real phone.
- Not touched: the full hidden suite (only what these changes touch), the Crushing Defeat logo cut-off at phone size, painted-art gold on packs (Ken's taste call).

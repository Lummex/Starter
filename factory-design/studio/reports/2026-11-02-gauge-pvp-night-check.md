# Gauge check of the PvP night build (2026-11-02)

Target: preview https://oreheart-8-qar9akevc-lummex.vercel.app, branch pvp-nov2 (a7981c49 code; the preview's build is 187e000c, and a7981c49 only adds Anvil's report and notes). TEST database. The live game was not touched. Ken asked for this check himself.

**Verdict: GO for Ken to test it.** Cheating, hidden information, the mirrored board, reconnect and the database settings all held up. One rule problem should be fixed first if it's quick (finding 1). The real TEST server has still never played a match; only the stand-in has.

## Findings, most serious first
1. **HIGH: letting three Respond timers run out in a row loses the match, even on the other player's turn.** In PvP a Respond window opens on every enemy summon, spell and attack, and each one that runs out counts as a timeout (`applyTimeouts` in referee.ts). Three in a row is a forfeit. Proven through the referee code: A summons three times, B presses nothing, and after 36 s of windows the match ends with "reason: timeout, winner A" (crystals were topped up to allow three summons in one Deploy; attacks count the same way by the code, but I didn't run that). So a player who looks away, or closes the tab in a busy enemy turn, can lose in about 36 s, while the clock's timeouts are otherwise whole phases, and the client's code comment says the server simply passes for you. Recommend Respond run-outs don't count as timeouts (Anvil). Until then Ken should press "Let it happen". If Ken wants Respond run-outs to count, it's his call.
2. **MEDIUM: keyboard reaches the hidden main menu behind the Shop.** Tab twice then Enter on `?test=1&econ=shop` opens the Deck Builder. Only seen on that test page, not confirmed for a signed-in player opening the Shop from the menu.
3. **MEDIUM: white text on pale backgrounds.** FREE ribbon, NEW tag and the Commander tick on the friend screens are close to unreadable (contrast about 1.1-2.1; economy.css asks for dark, the computed fill is white). Spell and crystal card names on their pale name plates are also hard to read; may be the normal card format, not checked elsewhere.
4. **LOW-MEDIUM: menu chips sit on the logo** (coin, Shop, Collection, Quests): nearly hide it at phone size, cover its top edge on PC. Seen with the fake test user, and the test banner adds to it.
5. **LOW:** a bright white ring on the first pack card from about 1.9 s (looks like keyboard focus; reads as a rarity glow on a Common). Collection's Back button scrolls away (over 1,000 px at the list's end). Odds line breaks between "85" and "%". Double tap on a pack card flips then zooms. No way out of the pack scene before ripping. "Crushing Defeat" logo top is cut off at 844x390 (not checked against older builds).
6. **Facts for Ken's taste:**
   - Gold: the only gold found in the UI styling is the scrollbar track (rgb 42,29,12) and an orange lock emoji. Painted art has gold: the OREHEART logo trim on all packs including Gizmo (gnome pack), the Deepforge gear, the card back, quest icons.
   - Computer-looking parts: "Play a friend" (flat rectangle), menu chips, filter and Reroll pills, quest bars, shop panels, friend code box, Deck dropdown (browser select, no arrow), thin scrollbar, emoji used as graphics.
   - Respond windows: 168 windows in 764 moves of the test match. A player with no counter must click "Let it happen" each time, or the attacker waits up to 12 s.
   - Rip: the card back rises over the title at about 0.6 s, the strip swings across the logo at about 0.67 s, shreds are few and small in the frames.

## What was checked and passed
**1. Vs computer and offline, on the deployed preview (PC 1600x900, phone 844x390).**
- Real visit: the offline worker installs by itself, 927 of 927 core files cached in 11-41 s. Network off + reload: the menu opens.
- Network off + reload, then a match vs the computer to turn 8, with the computer answering: 0 errors, pieces drawn.
- AC580 x2: **offline is OK on the deployed preview.** The deployed sw.js has plain line endings and the check's list pattern matches, which fits Anvil's Windows explanation. I ran the same logic by my own script, not the check file itself.
- In real online mode with no network, a signed-out player gets "Can't reach the server" with "Play offline (practice)".

**2. Screens (helper, stand-in data).** Shop, Collection, Quests, pack opening and friend screens at 1600x900, 1280x720, 844x390.
- The rip is smooth: about 60 fps; worst first-rip gap 66.7 ms; phone with 4x slower CPU 56 fps (a weak stand-in: it still has the RTX 5080).
- Never stuck, under triple clicks, spam and spending to 0 coins. 0 errors. Numbers match the rules (8 cards, 100 coins, 5/2/1, 85/13/2 %, quests 25/50/75, one reroll). All four packs, Flip one and Flip all, all rarity glows work.

**3. PvP, on the local stand-in server from pvp-nov2 (same referee code), deployed client in two separate browser sessions.**
- Whole match by real screens and hooks: code made and joined, 764 moves, 91 turns, ended by a win; loser and winner both got the right end screen. 0 refused legal moves.
- Cheats from the second page, all refused with the board unchanged: out of turn (game hook and direct fetch), spoofed player field, stale and future moves, moving an enemy unit, hitting the Commander from afar, playing a hidden card, a stranger reading or giving up for them, an unknown server op. Editing crystals in my own page then summoning: refused, server still says 0.
- Separate attack on the referee code with a fake clock: 12 random matches, 8,400 moves, about 25,000 cheat attempts, 0 accepted, 0 state changes. Double move race and two guests on one code: one wins. Expired code, wrong deck, others' decks refused.
- Hidden information: 791 match responses scanned in the browsers (807 in total) and every view of the 8,400 moves: no other hand, no deck order, rng 0, no dice or seed field, other side's draws unnamed. The only "secret" id ever seen was a unit bounced back to hand, which everyone just watched on the board: not a leak.
- Mirror: every unit correct for both players at every step (row 8-r, col 14-c, owner swapped); stats, Commanders, mines match. Screenshots agree.
- Reconnect: closing the tab and opening a new one goes straight back to the same match and move; reload too.
- Clock, live on the stand-in: 2:00 bar with the bank shown; nobody touching anything gives auto-keep or auto-Done each 2 minutes, and three in a row loses at 8 minutes with "You ran out of time." A closed tab with an active opponent lost at about 5 minutes in the referee test (unanswered windows included).

**4. Real database reach.** Nothing found that can reach it from this preview.
- The built game talks only to the TEST project (host and the test key in the bundle; the real project's id is nowhere in it). Asked anonymously, the TEST server says `server_kind: test`.
- In the code, the real project's id appears only in the key-check workflow and an old report. The game refuses to work if build and server disagree (env-guard).
- Server deploys are manual, owner-only, default test; production needs Ken's approve click. All 9 listed runs went to test.
- Anonymous read of matches, match_views, rooms, moves, wallets, settings, profiles, decks: refused (401). The match function without a login: refused.
- No secrets found in supabase/, game code, tools or workflows (name scan).
- Caveat: don't promote this deployment. A production build takes the real settings from Vercel (which I can't read), and the real database doesn't have these tables.

## What I could not check
- **A real match on the TEST server.** It needs two confirmed accounts and I may not create them. So Realtime push, real move speed, the database store, real coins, packs, quests and rewards are unproven by me (Anvil's SQL checks covered them on a local database). Ken's first friend match is that test.
- Read rules for a signed-in player (other players' views): read in the migrations only, not tried.
- A real phone or slow network; pinch; fullscreen. Sound (muted). Deck Builder ownership with real data. Menu Shop, Collection, Quests as a signed-in player (the fake user gets 401, expected). Vs-computer only to turn 8, by hooks.
- No full suite rerun; Anvil ran it.

Split: 1 Opus helper on the screens; I did offline, PvP, referee and the database audit, and spot-checked the helper's pictures.
